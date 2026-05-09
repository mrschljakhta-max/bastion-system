const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function showAuthMessage(message, type = "info") {
  console.log(`[BASTION AUTH][${type}]`, message);

  // Поки залишаємо alert, далі замінимо на красивий HUD-message у формі.
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

  showAuthMessage(
    "Реєстрація успішна. Наступний крок — підключення двофакторної автентифікації.",
    "success"
  );

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

  showAuthMessage(
    "Вхід успішний. Наступний крок — перевірка двофакторної автентифікації.",
    "success"
  );

  return {
    success: true,
    mode: "login",
    data
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
  signOut,
  getCurrentSession
};
