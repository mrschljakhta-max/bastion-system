/* =========================================================
   BASTION — Admin Control v8
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
  const inviteLoginPreview = document.getElementById('inviteLoginPreview');
  const inviteNoteCounter = document.getElementById('inviteNoteCounter');
  const clearInviteForm = document.getElementById('clearInviteForm');
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

  function applyStoredPalette() {
    const palette = localStorage.getItem('BASTION_ADMIN_PALETTE') || 'crimson';
    document.body.dataset.palette = palette;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'BASTION_ADMIN_PALETTE') applyStoredPalette();
  });

  applyStoredPalette();

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

  function statusBadge(value) {
    const v = String(value ?? '—');
    return `<span class="admin-status-badge" data-status="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
  }

  function actionButtons(items) {
    return `<div class="admin-row-actions">${items.join('')}</div>`;
  }

  async function refreshUsers() {
    try {
      const rows = await adminRpc('admin_list_allowed_users');
      renderTable('usersTable', rows, [
        { key: 'login', label: 'Login', render: (row) => `<strong>${escapeHtml(row.login || '—')}</strong>` },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Роль' },
        { key: 'status', label: 'Статус', render: (row) => statusBadge(row.status) },
        { key: 'is_active', label: 'Активний', render: (row) => row.is_active ? '✅' : '—' },
        { key: 'created_at', label: 'Створено' },
        {
          key: 'actions',
          label: 'Дії',
          render: (row) => {
            const email = escapeHtml(row.email || '');
            const login = escapeHtml(row.login || '');
            const isActive = Boolean(row.is_active) && row.status !== 'disabled';
            return actionButtons([
              `<button type="button" data-user-toggle="${email}" data-active="${isActive ? 'false' : 'true'}">${isActive ? 'Вимкнути' : 'Увімкнути'}</button>`,
              `<button type="button" class="danger" data-user-delete="${email}" data-login="${login}">Видалити</button>`
            ]);
          }
        }
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
        { key: 'email', label: 'Email', render: (row) => `<strong>${escapeHtml(row.email)}</strong>` },
        { key: 'status', label: 'Статус', render: (row) => statusBadge(row.status) },
        { key: 'requested_at', label: 'Дата' },
        { key: 'note', label: 'Повідомлення', render: (row) => `<span class="admin-note-cell">${escapeHtml(row.note || '—')}</span>` },
        {
          key: 'actions',
          label: 'Дії',
          render: (row) => {
            const id = escapeHtml(row.id || '');
            const email = escapeHtml(row.email || '');
            const note = escapeHtml(row.note || '');
            return actionButtons([
              `<button type="button" data-request-use="${id}" data-email="${email}" data-note="${note}">Взяти email</button>`,
              `<button type="button" data-request-status="${id}" data-status="approved">Вирішено</button>`,
              `<button type="button" class="danger" data-request-status="${id}" data-status="rejected">Відхилити</button>`
            ]);
          }
        }
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



  function normalizeLoginFromEmail(email) {
    const raw = String(email || '').split('@')[0] || '';
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '')
      .replace(/^[._-]+|[._-]+$/g, '') || '—';
  }

  function updateInvitePreview() {
    if (inviteLoginPreview) inviteLoginPreview.value = normalizeLoginFromEmail(inviteEmail?.value);
    if (inviteNoteCounter && inviteNote) inviteNoteCounter.textContent = `${inviteNote.value.length} / 255`;
  }

  inviteEmail?.addEventListener('input', updateInvitePreview);
  inviteNote?.addEventListener('input', updateInvitePreview);
  clearInviteForm?.addEventListener('click', () => {
    inviteForm?.reset();
    lastInvite = null;
    if (inviteResult) inviteResult.hidden = true;
    if (sendEmailBtn) sendEmailBtn.disabled = true;
    if (inviteForm) inviteForm.dataset.requestId = '';
    if (inviteSubmit) inviteSubmit.textContent = 'Створити доступ →';
    updateInvitePreview();
  });

  updateInvitePreview();

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
        p_note: inviteNote.value || null,
        p_request_id: inviteForm?.dataset?.requestId || null
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
      inviteSubmit.textContent = 'Доступ створено ✓';

      if (inviteForm?.dataset?.requestId) {
        try {
          await adminRpc('admin_update_access_request_status', {
            p_request_id: inviteForm.dataset.requestId,
            p_status: 'approved'
          });
        } catch (requestError) {
          console.warn('Не вдалося оновити статус заявки:', requestError);
        }
        inviteForm.dataset.requestId = '';
      }

      refreshUsers();
      refreshRequests();
      refreshLogs();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося створити доступ.');
      inviteSubmit.textContent = 'Створити доступ →';
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
      console.error('Edge Function email failed:', error);
      alert(error?.message || 'Помилка відправки листа через Edge Function. Перевір Logs у Supabase.');
      sendEmailBtn.textContent = 'Помилка відправки';
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

  document.getElementById('usersTable')?.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-user-toggle]');
    const remove = event.target.closest('[data-user-delete]');

    try {
      if (toggle) {
        const email = toggle.dataset.userToggle;
        const active = toggle.dataset.active === 'true';
        await adminRpc('admin_set_user_active', { p_email: email, p_is_active: active });
        await refreshUsers();
        await refreshLogs();
      }

      if (remove) {
        const email = remove.dataset.userDelete;
        const login = remove.dataset.login || email;
        const typed = prompt(`Повне видалення акаунта.

Буде видалено доступ, invite, MFA-secret і profile binding.
Для підтвердження введіть login або email:
${login}`);
        if (!typed) return;
        if (typed.trim().toLowerCase() !== String(login).toLowerCase() && typed.trim().toLowerCase() !== String(email).toLowerCase()) {
          alert('Підтвердження не збігається. Видалення скасовано.');
          return;
        }
        await adminRpc('admin_delete_user_full', { p_email: email, p_confirm: typed.trim() });
        await refreshUsers();
        await refreshLogs();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося виконати дію з користувачем.');
    }
  });

  document.getElementById('requestsTable')?.addEventListener('click', async (event) => {
    const use = event.target.closest('[data-request-use]');
    const status = event.target.closest('[data-request-status]');

    try {
      if (use) {
        inviteEmail.value = use.dataset.email || '';
        inviteNote.value = use.dataset.note || '';
        inviteForm.dataset.requestId = use.dataset.requestUse || '';
        updateInvitePreview();
        activateTab('invite');
        inviteEmail.focus();
        return;
      }

      if (status) {
        await adminRpc('admin_update_access_request_status', {
          p_request_id: status.dataset.requestStatus,
          p_status: status.dataset.status
        });
        await refreshRequests();
        await refreshLogs();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося оновити заявку.');
    }
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
