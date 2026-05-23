/* =========================================================
   BASTION — Admin Login v122
   Main logic:
   1) login -> email via bastion_get_login_account
   2) Supabase Auth verifies the real user password
   3) DB checks admin rights and creates admin session token
   Fallback: legacy local admin_login(login,password) for old local admin accounts.
   ========================================================= */

(function () {
  const form = document.getElementById('adminLoginForm');
  const loginInput = document.getElementById('adminLogin');
  const passwordInput = document.getElementById('adminPassword');
  const submit = document.getElementById('adminLoginSubmit');
  const passwordToggle = document.getElementById('adminPasswordToggle');
  const statusBox = document.getElementById('adminLoginStatus');

  const STORAGE_KEY = 'BASTION_ADMIN_SESSION_TOKEN';

  const client = window.supabase.createClient(
    window.BASTION_CONFIG.SUPABASE_URL,
    window.BASTION_CONFIG.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  function setStatus(message, isError = false) {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
    statusBox.style.borderColor = isError ? 'rgba(255,60,80,.55)' : 'rgba(255,255,255,.12)';
  }

  function normalizeLogin(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  passwordToggle?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    passwordToggle.textContent = isHidden ? '🙈' : '👁';
    passwordToggle.setAttribute('aria-label', isHidden ? 'Сховати пароль' : 'Показати пароль');
    passwordToggle.setAttribute('title', isHidden ? 'Сховати пароль' : 'Показати пароль');
    passwordInput.focus();
  });

  async function verifyExistingSession() {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;

    const { data, error } = await client.rpc('admin_verify_session', { p_token: token });
    if (error) return;

    const session = Array.isArray(data) ? data[0] : data;
    if (session?.valid) {
      window.location.href = './index.html?v=2';
    }
  }

  async function loginViaMainUserAccount(login, password) {
    const normalizedLogin = normalizeLogin(login);

    const { data: accountData, error: lookupError } = await client.rpc('bastion_get_login_account', {
      p_login: normalizedLogin
    });

    if (lookupError) throw lookupError;

    const account = Array.isArray(accountData) ? accountData[0] : accountData;
    const email = normalizeEmail(account?.email);

    if (!email) {
      throw new Error('Користувача не знайдено або доступ ще не активовано.');
    }

    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      throw new Error('Невірний логін або пароль');
    }

    const { data: sessionData, error: sessionError } = await client.rpc('admin_start_session_from_auth', {
      p_login: normalizedLogin
    });

    if (sessionError) throw sessionError;

    const row = Array.isArray(sessionData) ? sessionData[0] : sessionData;
    if (!row?.session_token) {
      throw new Error('Сесія не створена. Перевір SQL-функцію admin_start_session_from_auth.');
    }

    return row;
  }

  async function loginViaLegacyAdmin(login, password) {
    const { data, error } = await client.rpc('admin_login', {
      p_login: login.trim(),
      p_password: password
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.session_token) {
      throw new Error('Сесія не створена. Перевір SQL-функцію admin_login.');
    }

    return row;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    submit.disabled = true;
    submit.textContent = 'ПЕРЕВІРКА…';
    setStatus('Перевіряю admin-доступ…');

    try {
      localStorage.removeItem(STORAGE_KEY);

      let row;
      try {
        row = await loginViaMainUserAccount(login, password);
      } catch (mainError) {
        // Built-in legacy admin accounts may not exist in Supabase Auth.
        // For normal promoted users this fallback should not be used.
        console.warn('[BASTION admin] Main-user auth failed, trying legacy admin_login:', mainError);
        await client.auth.signOut().catch(() => {});
        row = await loginViaLegacyAdmin(login, password);
      }

      localStorage.setItem(STORAGE_KEY, row.session_token);
      localStorage.setItem('BASTION_ADMIN_LOGIN', row.admin_login || login);
      localStorage.setItem('BASTION_ADMIN_ROLE', row.role || 'admin');

      setStatus('Доступ підтверджено. Відкриваю панель…');
      window.location.href = './index.html?v=2';
    } catch (error) {
      console.error(error);
      await client.auth.signOut().catch(() => {});
      localStorage.removeItem(STORAGE_KEY);
      setStatus(error.message || 'Невірний логін або пароль.', true);
      submit.disabled = false;
      submit.textContent = 'УВІЙТИ';
    }
  });

  verifyExistingSession();
})();
