const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function showAuthMessage(message, type = "info") {
  console.log(`[BASTION AUTH][${type}]`, message);
  alert(message);
}

function isAlreadyRegisteredError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already")
  );
}

function toQrImageSrc(qrCode) {
  const value = String(qrCode || "").trim();

  if (!value) return "";

  if (
    value.startsWith("data:image") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  }

  return value;
}

async function checkAllowedEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const { data, error } = await supabaseClient.rpc("is_email_allowed", {
    input_email: normalizedEmail
  });

  if (error) {
    console.error("Помилка перевірки email:", error);
    return false;
  }

  return data === true;
}

async function requestAccess(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const { error } = await supabaseClient
    .from("access_requests")
    .insert({
      email: normalizedEmail,
      status: "pending"
    });

  if (error) {
    console.error("Помилка створення заявки:", error);
    return false;
  }

  return true;
}

async function handleRegister(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    showAuthMessage("Введіть email та пароль.", "warning");
    return false;
  }

  const allowed = await checkAllowedEmail(normalizedEmail);

  if (!allowed) {
    await requestAccess(normalizedEmail);

    showAuthMessage(
      "Ваш email ще не підтверджений адміністратором. Заявку на доступ надіслано.",
      "warning"
    );

    return {
      success: false,
      pendingApproval: true
    };
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email: normalizedEmail,
    password
  });

  if (!error) {
    console.log("REGISTER:", data);

    return {
      success: true,
      mode: "register",
      data
    };
  }

  if (!isAlreadyRegisteredError(error)) {
    console.error("Помилка реєстрації:", error);

    showAuthMessage(
      error.message || "Не вдалося створити обліковий запис.",
      "error"
    );

    return false;
  }

  // Якщо користувач уже створений у Supabase Auth, але ще не налаштована 2FA:
  // повторна реєстрація з правильним паролем має пустити його до QR-коду.
  const loginResult = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (loginResult.error) {
    console.error("Користувач уже існує, але пароль не підійшов:", loginResult.error);

    showAuthMessage(
      "Цей email уже зареєстрований. Введіть правильний пароль або перейдіть до входу.",
      "warning"
    );

    return false;
  }

  console.log("REGISTER EXISTING USER LOGIN:", loginResult.data);

  return {
    success: true,
    mode: "register",
    existingUser: true,
    data: loginResult.data
  };
}

async function handleLogin(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    showAuthMessage("Введіть email та пароль.", "warning");
    return false;
  }

  const allowed = await checkAllowedEmail(normalizedEmail);

  if (!allowed) {
    showAuthMessage(
      "Користувача не знайдено або доступ ще не підтверджено адміністратором.",
      "warning"
    );

    return false;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    console.error("Помилка входу:", error);

    showAuthMessage(
      "Невірний email або пароль.",
      "error"
    );

    return false;
  }

  console.log("LOGIN:", data);

  return {
    success: true,
    mode: "login",
    data
  };
}

/* =========================================================
   BASTION MFA / TOTP
   Google Authenticator через Supabase Auth MFA
   ========================================================= */

async function getAuthenticatorFactors() {
  const { data, error } = await supabaseClient.auth.mfa.listFactors();

  if (error) {
    console.error("Помилка отримання MFA factors:", error);
    return [];
  }

  return data?.totp || [];
}

async function getVerifiedTotpFactor() {
  const factors = await getAuthenticatorFactors();
  return factors.find((factor) => factor.status === "verified") || null;
}

async function removeUnverifiedTotpFactors() {
  const factors = await getAuthenticatorFactors();
  const unverified = factors.filter((factor) => factor.status !== "verified");

  for (const factor of unverified) {
    const { error } = await supabaseClient.auth.mfa.unenroll({
      factorId: factor.id
    });

    if (error) {
      console.warn("Не вдалося прибрати старий unverified MFA factor:", error);
    }
  }
}

async function enrollTotpFactor() {
  await removeUnverifiedTotpFactors();

  const { data, error } = await supabaseClient.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "BASTION"
  });

  if (error) {
    console.error("Помилка створення MFA factor:", error);
    showAuthMessage(error.message || "Не вдалося створити QR-код 2FA.", "error");
    return false;
  }

  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp?.qr_code || "",
    qrImageSrc: toQrImageSrc(data.totp?.qr_code || ""),
    secret: data.totp?.secret || ""
  };
}

async function challengeTotpFactor(factorId) {
  const { data, error } = await supabaseClient.auth.mfa.challenge({
    factorId
  });

  if (error) {
    console.error("Помилка MFA challenge:", error);
    showAuthMessage(error.message || "Не вдалося створити MFA challenge.", "error");
    return false;
  }

  return {
    success: true,
    challengeId: data.id
  };
}

async function verifyTotpCode(factorId, challengeId, code) {
  const token = String(code || "").trim();

  if (!factorId || !challengeId || !token) {
    showAuthMessage("Введіть код автентифікатора.", "warning");
    return false;
  }

  const { data, error } = await supabaseClient.auth.mfa.verify({
    factorId,
    challengeId,
    code: token
  });

  if (error) {
    console.error("Помилка MFA verify:", error);
    showAuthMessage("Невірний код автентифікатора.", "error");
    return false;
  }

  return {
    success: true,
    data
  };
}

async function prepareMfaAfterRegister() {
  const verifiedFactor = await getVerifiedTotpFactor();

  if (verifiedFactor) {
    const challenge = await challengeTotpFactor(verifiedFactor.id);

    if (!challenge?.success) {
      return false;
    }

    return {
      success: true,
      mode: "login",
      factorId: verifiedFactor.id,
      challengeId: challenge.challengeId,
      qrCode: "",
      qrImageSrc: "",
      secret: ""
    };
  }

  const enrollment = await enrollTotpFactor();

  if (!enrollment?.success) {
    return false;
  }

  const challenge = await challengeTotpFactor(enrollment.factorId);

  if (!challenge?.success) {
    return false;
  }

  return {
    success: true,
    mode: "register",
    factorId: enrollment.factorId,
    challengeId: challenge.challengeId,
    qrCode: enrollment.qrCode,
    qrImageSrc: enrollment.qrImageSrc,
    secret: enrollment.secret
  };
}

async function prepareMfaAfterLogin() {
  const factor = await getVerifiedTotpFactor();

  if (!factor) {
    // Якщо користувач уже існує, але 2FA ще не підключено —
    // показуємо QR-код, а не просто поле коду.
    return await prepareMfaAfterRegister();
  }

  const challenge = await challengeTotpFactor(factor.id);

  if (!challenge?.success) {
    return false;
  }

  return {
    success: true,
    mode: "login",
    factorId: factor.id,
    challengeId: challenge.challengeId,
    qrCode: "",
    qrImageSrc: "",
    secret: ""
  };
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Помилка виходу:", error);
    return false;
  }

  return true;
}

async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Помилка отримання сесії:", error);
    return null;
  }

  return data?.session || null;
}

window.BastionAuth = {
  supabaseClient,
  normalizeEmail,
  toQrImageSrc,
  checkAllowedEmail,
  requestAccess,
  handleRegister,
  handleLogin,
  getAuthenticatorFactors,
  getVerifiedTotpFactor,
  removeUnverifiedTotpFactors,
  enrollTotpFactor,
  challengeTotpFactor,
  verifyTotpCode,
  prepareMfaAfterRegister,
  prepareMfaAfterLogin,
  signOut,
  getCurrentSession
};
