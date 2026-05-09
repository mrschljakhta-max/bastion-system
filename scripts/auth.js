/* =========================================================
   BASTION — SUPABASE AUTH BRIDGE v21
   Перший етап: перевірка email у whitelist allowed_users.
   Далі сюди додамо signUp/signIn + MFA TOTP.
   ========================================================= */

(function () {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn("Supabase config не знайдено або SDK не підключено.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  async function checkAllowedEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return { allowed: false, reason: "empty_email" };
    }

    const { data, error } = await supabaseClient
      .from("allowed_users")
      .select("email, role, status")
      .ilike("email", normalizedEmail)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("allowed_users check error:", error);
      return { allowed: false, reason: "query_error", error };
    }

    if (!data) {
      return { allowed: false, reason: "not_allowed" };
    }

    return { allowed: true, user: data };
  }

  async function handleRegister(email, password) {
    const check = await checkAllowedEmail(email);

    if (!check.allowed) {
      alert("Цей email ще не доданий адміністратором до списку дозволених користувачів.");
      return false;
    }

    alert("Email підтверджено. Наступним кроком підключимо реєстрацію та QR-код 2FA.");
    return true;
  }

  async function handleLogin(email, password) {
    const check = await checkAllowedEmail(email);

    if (!check.allowed) {
      alert("Користувача не знайдено у списку дозволених.");
      return false;
    }

    alert("Email підтверджено. Наступним кроком підключимо вхід та код 2FA.");
    return true;
  }

  window.BastionAuth = {
    client: supabaseClient,
    checkAllowedEmail,
    handleRegister,
    handleLogin
  };
})();
