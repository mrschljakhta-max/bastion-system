const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

async function checkAllowedEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

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
  const normalizedEmail = String(email || "").trim().toLowerCase();

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
  const allowed = await checkAllowedEmail(email);

  if (!allowed) {
    await requestAccess(email);
    alert("Ваш email ще не підтверджений адміністратором. Заявку на доступ надіслано.");
    return false;
  }

  alert("Email підтверджено. Наступний крок — реєстрація та 2FA.");
  return true;
}

async function handleLogin(email, password) {
  const allowed = await checkAllowedEmail(email);

  if (!allowed) {
    alert("Користувача не знайдено або доступ ще не підтверджено.");
    return false;
  }

  alert("Користувача знайдено. Наступний крок — пароль та 2FA.");
  return true;
}

window.BastionAuth = {
  checkAllowedEmail,
  requestAccess,
  handleRegister,
  handleLogin
};
