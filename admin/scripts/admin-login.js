/* =========================================================
   BASTION — Admin Login v1
   Separate admin login/password, no Supabase Auth, no 2FA
   ========================================================= */

(function () {
  const form = document.getElementById('adminLoginForm');
  const loginInput = document.getElementById('adminLogin');
  const passwordInput = document.getElementById('adminPassword');
  const submit = document.getElementById('adminLoginSubmit');
  const statusBox = document.getElementById('adminLoginStatus');

  const STORAGE_KEY = 'BASTION_ADMIN_SESSION_TOKEN';

  const client = window.supabase.createClient(
    window.BASTION_CONFIG.SUPABASE_URL,
    window.BASTION_CONFIG.SUPABASE_ANON_KEY
  );

  function setStatus(message, isError = false) {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
    statusBox.style.borderColor = isError ? 'rgba(255,60,80,.55)' : 'rgba(255,255,255,.12)';
  }

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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    submit.disabled = true;
    submit.textContent = 'ПЕРЕВІРКА…';
    setStatus('Перевіряю admin-доступ…');

    try {
      const { data, error } = await client.rpc('admin_login', {
        p_login: loginInput.value.trim(),
        p_password: passwordInput.value
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.session_token) {
        throw new Error('Сесія не створена. Перевір SQL-функцію admin_login.');
      }

      localStorage.setItem(STORAGE_KEY, row.session_token);
      localStorage.setItem('BASTION_ADMIN_LOGIN', row.admin_login || loginInput.value.trim());
      setStatus('Доступ підтверджено. Відкриваю панель…');

      window.location.href = './index.html?v=2';
    } catch (error) {
      console.error(error);
      localStorage.removeItem(STORAGE_KEY);
      setStatus(error.message || 'Невірний логін або пароль.', true);
      submit.disabled = false;
      submit.textContent = 'УВІЙТИ';
    }
  });

  verifyExistingSession();
})();
