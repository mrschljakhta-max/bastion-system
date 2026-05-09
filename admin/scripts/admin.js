/* =========================================================
   BASTION — Admin Control v5
   Uses separate admin session token, no Supabase Auth / 2FA
   ========================================================= */

(function () {
  const STORAGE_KEY = 'BASTION_ADMIN_SESSION_TOKEN';
  const START_URL = './start.html?v=6';
  const LOGIN_URL = './login.html?v=1';
  const ACTIVE_TAB_KEY = 'BASTION_ADMIN_ACTIVE_TAB';

  const profileBox = document.getElementById('adminProfile');
  const inviteForm = document.getElementById('inviteForm');
  const inviteEmail = document.getElementById('inviteEmail');
  const inviteRole = document.getElementById('inviteRole');
  const inviteNote = document.getElementById('inviteNote');
  const inviteSubmit = document.getElementById('inviteSubmit');
  const sendEmailBtn = document.getElementById('sendEmailBtn');
  const inviteResult = document.getElementById('inviteResult');
  const inviteUrl = document.getElementById('inviteUrl');
  const copyInviteUrl = document.getElementById('copyInviteUrl');
  const mailtoInvite = document.getElementById('mailtoInvite');

  let lastInvite = null;
  let adminSession = null;

  const client = window.supabase.createClient(
    window.BASTION_CONFIG.SUPABASE_URL,
    window.BASTION_CONFIG.SUPABASE_ANON_KEY
  );

  function getAdminToken() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function clearAdminSession() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('BASTION_ADMIN_LOGIN');
  }

  function setProfile(message) {
    if (profileBox) profileBox.textContent = message;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderTable(tableId, rows, columns) {
    const table = document.getElementById(tableId);
    if (!table) return;

    if (!rows?.length) {
      table.innerHTML = `<tr><td>Даних немає.</td></tr>`;
      return;
    }

    table.innerHTML = `
      <thead><tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((c) => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key])}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    `;
  }

  async function adminRpc(name, args = {}) {
    const token = getAdminToken();
    if (!token) {
      window.location.href = START_URL;
      return [];
    }

    const { data, error } = await client.rpc(name, {
      p_admin_token: token,
      ...args
    });

    if (error) throw error;
    return data || [];
  }

  async function refreshUsers() {
    try {
      const rows = await adminRpc('admin_list_allowed_users');
      renderTable('usersTable', rows, [
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Роль' },
        { key: 'status', label: 'Статус' },
        { key: 'is_active', label: 'Активний' },
        { key: 'created_at', label: 'Створено' }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable('usersTable', [], []);
    }
  }

  async function refreshRequests() {
    try {
      const rows = await adminRpc('admin_list_access_requests');
      renderTable('requestsTable', rows, [
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Статус' },
        { key: 'requested_at', label: 'Дата' },
        { key: 'note', label: 'Нотатка' }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable('requestsTable', [], []);
    }
  }

  async function refreshLogs() {
    try {
      const rows = await adminRpc('admin_list_activity_logs');
      renderTable('logsTable', rows, [
        { key: 'created_at', label: 'Дата' },
        { key: 'email', label: 'Email/Login' },
        { key: 'action', label: 'Дія' },
        {
          key: 'details',
          label: 'Details',
          render: (row) => `<code>${escapeHtml(JSON.stringify(row.details || {}))}</code>`
        }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable('logsTable', [], []);
    }
  }

  function makeSetupUrl(token) {
    const root = window.location.href.split('/admin/')[0];
    return `${root}/setup-account.html?token=${encodeURIComponent(token)}`;
  }

  function buildMailto(invite) {
    const subject = encodeURIComponent('BASTION — доступ до системи');
    const body = encodeURIComponent(
`Вам надано доступ до BASTION.

Роль: ${invite.role}

Інструкція:
1. Перейдіть за посиланням: ${invite.setup_url}
2. Створіть пароль.
3. Відскануйте QR-код у Google Authenticator.
4. Підтвердіть 2FA.
5. Після активації відкрийте стартову сторінку BASTION і натисніть "Вхід".

Не передавайте це посилання іншим особам.`
    );

    return `mailto:${encodeURIComponent(invite.email)}?subject=${subject}&body=${body}`;
  }

  inviteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    inviteSubmit.disabled = true;
    inviteSubmit.textContent = 'Створюю…';

    try {
      const rows = await adminRpc('admin_create_user_invite', {
        p_email: inviteEmail.value,
        p_role: inviteRole.value,
        p_note: inviteNote.value || null
      });

      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row?.invite_token) throw new Error('Invite token не створено.');

      lastInvite = {
        email: row.email,
        role: row.role,
        token: row.invite_token,
        setup_url: makeSetupUrl(row.invite_token)
      };

      inviteUrl.textContent = lastInvite.setup_url;
      mailtoInvite.href = buildMailto(lastInvite);
      inviteResult.hidden = false;
      sendEmailBtn.disabled = false;
      inviteSubmit.textContent = 'Доступ створено';

      refreshUsers();
      refreshLogs();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося створити доступ.');
      inviteSubmit.textContent = 'Створити доступ';
    } finally {
      inviteSubmit.disabled = false;
    }
  });

  copyInviteUrl?.addEventListener('click', async () => {
    if (!lastInvite?.setup_url) return;
    await navigator.clipboard.writeText(lastInvite.setup_url);
    copyInviteUrl.textContent = 'Скопійовано';
    setTimeout(() => (copyInviteUrl.textContent = 'Скопіювати'), 1200);
  });

  async function sendInviteEmail(invite) {
    const token = getAdminToken();
    const { data, error } = await client.functions.invoke('send-invite-email', {
      body: {
        admin_token: token,
        email: invite.email,
        role: invite.role,
        setup_url: invite.setup_url
      }
    });

    if (error) throw error;
    return data;
  }

  sendEmailBtn?.addEventListener('click', async () => {
    if (!lastInvite) return;

    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = 'Надсилаю…';

    try {
      await sendInviteEmail(lastInvite);
      sendEmailBtn.textContent = 'Лист надіслано';
      refreshLogs();
    } catch (error) {
      console.warn('Edge Function email failed, opening mailto fallback:', error);
      sendEmailBtn.textContent = 'Відкриваю пошту…';
      window.location.href = buildMailto(lastInvite);
    } finally {
      setTimeout(() => {
        sendEmailBtn.disabled = false;
        sendEmailBtn.textContent = 'Надіслати лист';
      }, 1600);
    }
  });

  function activateTab(tabName, save = true) {
    const tab = document.getElementById(`tab-${tabName}`);
    const btn = document.querySelector(`[data-admin-tab="${tabName}"]`);
    if (!tab || !btn) return;

    document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.remove('is-active'));
    document.querySelectorAll('.admin-tab').forEach((item) => item.classList.remove('is-active'));

    btn.classList.add('is-active');
    tab.classList.add('is-active');

    const title = tab.dataset.title || btn.textContent.trim() || 'Керування доступом';
    const titleEl = document.getElementById('adminPageTitle');
    const eyebrowEl = document.getElementById('adminEyebrow');
    if (titleEl) titleEl.textContent = title;
    if (eyebrowEl) eyebrowEl.textContent = 'ADMIN CONTROL NODE';

    if (save) localStorage.setItem(ACTIVE_TAB_KEY, tabName);
  }

  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.adminTab);
    });
  });

  document.getElementById('refreshUsers')?.addEventListener('click', refreshUsers);
  document.getElementById('refreshRequests')?.addEventListener('click', refreshRequests);
  document.getElementById('refreshLogs')?.addEventListener('click', refreshLogs);

  document.getElementById('adminLogout')?.addEventListener('click', async () => {
    const token = getAdminToken();
    try {
      if (token) await client.rpc('admin_logout', { p_token: token });
    } catch (error) {
      console.warn(error);
    }
    clearAdminSession();
    window.location.href = START_URL;
  });

  async function init() {
    const token = getAdminToken();
    if (!token) {
      window.location.href = START_URL;
      return;
    }

    try {
      const { data, error } = await client.rpc('admin_verify_session', { p_token: token });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.valid) {
        clearAdminSession();
        window.location.href = LOGIN_URL;
        return;
      }

      adminSession = row;
      setProfile(`${row.admin_login} · ${row.role}`);

      const savedTab = localStorage.getItem(ACTIVE_TAB_KEY) || 'invite';
      activateTab(savedTab, false);

      refreshUsers();
      refreshRequests();
      refreshLogs();
    } catch (error) {
      console.error(error);
      clearAdminSession();
      window.location.href = LOGIN_URL;
    }
  }

  init();
})();
