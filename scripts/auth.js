const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

async function checkAllowedEmail(email) {
  const { data, error } = await supabaseClient
    .from("allowed_users")
    .select("*")
    .eq("email", email)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

async function handleRegister(email) {
  const allowed = await checkAllowedEmail(email);

  if (!allowed) {
    alert("Email ще не підтверджений адміністратором");
    return false;
  }

  alert("Email підтверджено. Переходимо до 2FA.");
  return true;
}

async function handleLogin(email) {
  const allowed = await checkAllowedEmail(email);

  if (!allowed) {
    alert("Користувача не знайдено");
    return false;
  }

  alert("Користувача знайдено. Переходимо до 2FA.");
  return true;
}
