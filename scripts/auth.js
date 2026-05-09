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

    return false;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email: normalizedEmail,
    password
  });

  if (error) {
    console.error("Помилка реєстрації:", error);

    showAuthMessage(
      error.message || "Не вдалося створити обліковий запис.",
      "error"
    );

    return false;
  }

  console.log("REGISTER:", data);

  return {
    success: true,
    mode: "register",
    data
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

async function enrollTotpFactor() {
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
    secret: enrollment.secret
  };
}

async function prepareMfaAfterLogin() {
  const factor = await getVerifiedTotpFactor();

  if (!factor) {
    // Користувач увійшов, але ще не має підтвердженого 2FA.
    // Для безпеки змушуємо пройти enroll.
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
  checkAllowedEmail,
  requestAccess,
  handleRegister,
  handleLogin,
  getAuthenticatorFactors,
  getVerifiedTotpFactor,
  enrollTotpFactor,
  challengeTotpFactor,
  verifyTotpCode,
  prepareMfaAfterRegister,
  prepareMfaAfterLogin,
  signOut,
  getCurrentSession
};
