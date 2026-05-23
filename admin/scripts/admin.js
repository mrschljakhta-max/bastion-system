/* =========================================================
   BASTION — Admin Control v115
   Access requests / users / admin access / logs / settings control center
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

  const usersTable = document.getElementById('usersTable');
  const requestsTable = document.getElementById('requestsTable');
  const logsTable = document.getElementById('logsTable');

  const userSearch = document.getElementById('userSearch');
  const userStatusFilter = document.getElementById('userStatusFilter');
  const requestSearch = document.getElementById('requestSearch');
  const requestStatusFilter = document.getElementById('requestStatusFilter');
  const logSearch = document.getElementById('logSearch');
  const logActionFilter = document.getElementById('logActionFilter');

  const adminAccessForm = document.getElementById('adminAccessForm');
  const adminAccessQuery = document.getElementById('adminAccessQuery');
  const adminAccessRole = document.getElementById('adminAccessRole');
  const adminAccessFind = document.getElementById('adminAccessFind');
  const adminAccessGrant = document.getElementById('adminAccessGrant');
  const adminAccessRevoke = document.getElementById('adminAccessRevoke');
  const adminAccessResult = document.getElementById('adminAccessResult');

  let lastInvite = null;
  let adminSession = null;
  let usersCache = [];
  let requestsCache = [];
  let logsCache = [];

  const client = window.supabase.createClient(
    window.BASTION_CONFIG.SUPABASE_URL,
    window.BASTION_CONFIG.SUPABASE_ANON_KEY
  );

  function applyStoredPalette() {
    if (window.BastionSettings?.apply) {
      window.BastionSettings.apply();
      return;
    }
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

  function formatDate(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return escapeHtml(value);
      return date.toLocaleString('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return escapeHtml(value);
    }
  }

  function renderTable(tableId, rows, columns, emptyText = 'Даних немає.') {
    const table = document.getElementById(tableId);
    if (!table) return;

    if (!rows?.length) {
      table.innerHTML = `<tr><td class="admin-empty-cell">${escapeHtml(emptyText)}</td></tr>`;
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
    const v = String(value ?? '—').toLowerCase();
    return `<span class="admin-status-badge" data-status="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
  }

  function actionButtons(items) {
    return `<div class="admin-row-actions">${items.join('')}</div>`;
  }

  function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function normalizeText(value) {
    return String(value ?? '').toLowerCase().trim();
  }

  function updateUsersMetrics(rows = usersCache) {
    setMetric('usersTotalCount', rows.length);
    setMetric('usersActiveCount', rows.filter((r) => Boolean(r.is_active) && String(r.status).toLowerCase() !== 'disabled').length);
    setMetric('usersMfaCount', rows.filter((r) => Boolean(r.mfa_enabled)).length);
  }

  function updateRequestsMetrics(rows = requestsCache) {
    setMetric('requestsTotalCount', rows.length);
    setMetric('requestsPendingCount', rows.filter((r) => String(r.status).toLowerCase() === 'pending').length);
    setMetric('requestsApprovedCount', rows.filter((r) => String(r.status).toLowerCase() === 'approved').length);
  }

  function updateLogsMetrics(rows = logsCache) {
    setMetric('logsTotalCount', rows.length);
    setMetric('logsAdminCount', rows.filter((r) => String(r.action || '').startsWith('admin_')).length);
    setMetric('logsMfaCount', rows.filter((r) => String(r.action || '').includes('mfa')).length);
  }

  function getFilteredUsers() {
    const q = normalizeText(userSearch?.value);
    const status = normalizeText(userStatusFilter?.value || 'all');

    return usersCache.filter((row) => {
      const haystack = `${row.login || ''} ${row.email || ''} ${row.role || ''} ${row.status || ''}`.toLowerCase();
      const rowStatus = normalizeText(row.status);
      const isActive = Boolean(row.is_active) && rowStatus !== 'disabled';
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && isActive) ||
        (status === 'disabled' && !isActive) ||
        rowStatus === status;
      return matchesSearch && matchesStatus;
    });
  }

  function getFilteredRequests() {
    const q = normalizeText(requestSearch?.value);
    const status = normalizeText(requestStatusFilter?.value || 'pending');

    return requestsCache.filter((row) => {
      const haystack = `${row.email || ''} ${row.note || ''} ${row.status || ''}`.toLowerCase();
      const rowStatus = normalizeText(row.status);
      return (!q || haystack.includes(q)) && (status === 'all' || rowStatus === status);
    });
  }

  function getFilteredLogs() {
    const q = normalizeText(logSearch?.value);
    const action = normalizeText(logActionFilter?.value || 'all');

    return logsCache.filter((row) => {
      const details = JSON.stringify(row.details || {});
      const haystack = `${row.email || ''} ${row.action || ''} ${details}`.toLowerCase();
      const rowAction = normalizeText(row.action);
      const actionGroup =
        action === 'all' ||
        (action === 'admin' && rowAction.startsWith('admin_')) ||
        (action === 'invite' && rowAction.includes('invite')) ||
        (action === 'mfa' && rowAction.includes('mfa')) ||
        (action === 'login' && rowAction.includes('login')) ||
        (action === 'delete' && rowAction.includes('delete'));
      return (!q || haystack.includes(q)) && actionGroup;
    });
  }

  function renderUsers() {
    const rows = getFilteredUsers();
    updateUsersMetrics(usersCache);

    renderTable('usersTable', rows, [
      { key: 'login', label: 'Login', render: (row) => `<strong>${escapeHtml(row.login || '—')}</strong>` },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Роль', render: (row) => `<span class="admin-role-pill">${escapeHtml(row.role || '—')}</span>` },
      { key: 'status', label: 'Статус', render: (row) => statusBadge(row.status) },
      { key: 'mfa_enabled', label: '2FA', render: (row) => Boolean(row.mfa_enabled) ? '<span class="admin-good">ON</span>' : '<span class="admin-muted-inline">OFF</span>' },
      { key: 'is_active', label: 'Доступ', render: (row) => Boolean(row.is_active) && row.status !== 'disabled' ? '<span class="admin-good">Активний</span>' : '<span class="admin-danger-text">Закрито</span>' },
      { key: 'created_at', label: 'Створено', render: (row) => formatDate(row.created_at) },
      {
        key: 'actions',
        label: 'Дії',
        render: (row) => {
          const email = escapeHtml(row.email || '');
          const login = escapeHtml(row.login || '');
          const isActive = Boolean(row.is_active) && row.status !== 'disabled';
          return actionButtons([
            `<button type="button" data-user-toggle="${email}" data-active="${isActive ? 'false' : 'true'}">${isActive ? 'Вимкнути' : 'Увімкнути'}</button>`,
            `<button type="button" data-user-logs="${email}">Логи</button>`,
            `<button type="button" class="danger" data-user-delete="${email}" data-login="${login}">Видалити</button>`
          ]);
        }
      }
    ], 'Користувачів не знайдено.');
  }

  function renderRequests() {
    const rows = getFilteredRequests();
    updateRequestsMetrics(requestsCache);

    renderTable('requestsTable', rows, [
      { key: 'email', label: 'Email', render: (row) => `<strong>${escapeHtml(row.email)}</strong>` },
      { key: 'status', label: 'Статус', render: (row) => statusBadge(row.status) },
      { key: 'requested_at', label: 'Дата', render: (row) => formatDate(row.requested_at) },
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
    ], 'Заявок за цим фільтром немає.');
  }

  function humanLog(row) {
    const details = row.details || {};
    const action = String(row.action || 'подія');
    const target = details.target_email || details.email || details.login || details.target_login || '';

    const dictionary = {
      admin_login: 'Адміністратор увійшов у панель',
      admin_create_user_invite: `Створено invite${target ? ` для ${target}` : ''}`,
      admin_invite_created: `Створено invite${target ? ` для ${target}` : ''}`,
      admin_access_request_approved: `Заявку схвалено${target ? `: ${target}` : ''}`,
      admin_access_request_rejected: `Заявку відхилено${target ? `: ${target}` : ''}`,
      admin_enable_user: `Доступ увімкнено${target ? `: ${target}` : ''}`,
      admin_disable_user: `Доступ вимкнено${target ? `: ${target}` : ''}`,
      admin_delete_user_full: `Користувача видалено${target ? `: ${target}` : ''}`,
      user_invite_activated: `Користувач активував invite${target ? `: ${target}` : ''}`,
      bastion_invite_auth_mapping_finalized: `Завершено привʼязку акаунта${target ? `: ${target}` : ''}`
    };

    return dictionary[action] || action.replaceAll('_', ' ');
  }

  function renderLogs() {
    const rows = getFilteredLogs();
    updateLogsMetrics(logsCache);

    renderTable('logsTable', rows, [
      { key: 'created_at', label: 'Дата', render: (row) => formatDate(row.created_at) },
      { key: 'email', label: 'Email/Login', render: (row) => `<strong>${escapeHtml(row.email || '—')}</strong>` },
      { key: 'action', label: 'Подія', render: (row) => `<span class="admin-log-human">${escapeHtml(humanLog(row))}</span><small>${escapeHtml(row.action || '')}</small>` },
      {
        key: 'details',
        label: 'Details',
        render: (row) => `<button type="button" class="admin-details-btn" data-log-details="${escapeHtml(JSON.stringify(row.details || {}))}">Деталі</button>`
      }
    ], 'Логів за цим фільтром немає.');
  }

  function renderAdminAccessResult(row, mode = 'found') {
    if (!adminAccessResult) return;

    if (!row) {
      adminAccessResult.innerHTML = `
        <div class="admin-empty-card">
          <strong>Користувача не знайдено</strong>
          <span>Перевір login або email. Користувач має спочатку пройти звичайну реєстрацію.</span>
        </div>
      `;
      return;
    }

    const isAdmin = Boolean(row.is_admin);
    const adminRole = row.admin_role || '—';
    const status = isAdmin ? 'admin enabled' : 'user only';
    adminAccessResult.innerHTML = `
      <div class="admin-access-profile" data-mode="${escapeHtml(mode)}">
        <div>
          <span>Користувач</span>
          <strong>${escapeHtml(row.login || '—')}</strong>
          <small>${escapeHtml(row.email || '—')}</small>
        </div>
        <div>
          <span>Основна роль</span>
          <strong>${escapeHtml(row.user_role || row.role || '—')}</strong>
          <small>${escapeHtml(row.status || '—')}</small>
        </div>
        <div>
          <span>Адмін-доступ</span>
          <strong class="${isAdmin ? 'admin-good' : 'admin-muted-inline'}">${escapeHtml(status)}</strong>
          <small>${escapeHtml(adminRole)}</small>
        </div>
        <div>
          <span>2FA</span>
          <strong class="${row.mfa_enabled ? 'admin-good' : 'admin-muted-inline'}">${row.mfa_enabled ? 'ON' : 'OFF'}</strong>
          <small>${row.auth_user_id ? 'auth linked' : 'no auth binding'}</small>
        </div>
      </div>
    `;

    if (adminAccessRole && row.admin_role) adminAccessRole.value = row.admin_role;
  }

  async function findAdminAccessUser(silent = false) {
    const query = adminAccessQuery?.value?.trim();
    if (!query) {
      if (!silent) alert('Введіть login або email користувача.');
      return null;
    }

    const rows = await adminRpc('admin_find_user_for_admin_access', { p_query: query });
    const row = Array.isArray(rows) ? rows[0] : rows;
    renderAdminAccessResult(row || null);
    return row || null;
  }

  async function refreshUsers() {
    try {
      usersCache = await adminRpc('admin_list_allowed_users');
      renderUsers();
    } catch (error) {
      console.warn(error);
      usersCache = [];
      renderUsers();
    }
  }

  async function refreshRequests() {
    try {
      requestsCache = await adminRpc('admin_list_access_requests');
      renderRequests();
    } catch (error) {
      console.warn(error);
      requestsCache = [];
      renderRequests();
    }
  }

  async function refreshLogs() {
    try {
      logsCache = await adminRpc('admin_list_activity_logs');
      renderLogs();
    } catch (error) {
      console.warn(error);
      logsCache = [];
      renderLogs();
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

      await refreshUsers();
      await refreshRequests();
      await refreshLogs();
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
    btn.addEventListener('click', () => activateTab(btn.dataset.adminTab));
  });

  usersTable?.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-user-toggle]');
    const remove = event.target.closest('[data-user-delete]');
    const logs = event.target.closest('[data-user-logs]');

    try {
      if (logs) {
        const email = logs.dataset.userLogs;
        if (logSearch) logSearch.value = email;
        if (logActionFilter) logActionFilter.value = 'all';
        activateTab('logs');
        renderLogs();
        return;
      }

      if (toggle) {
        const email = toggle.dataset.userToggle;
        const active = toggle.dataset.active === 'true';
        const message = active
          ? `Увімкнути доступ для ${email}?`
          : `Вимкнути доступ для ${email}? Користувач не зможе зайти на сайт.`;
        if (!confirm(message)) return;
        await adminRpc('admin_set_user_active', { p_email: email, p_is_active: active });
        await refreshUsers();
        await refreshLogs();
      }

      if (remove) {
        const email = remove.dataset.userDelete;
        const login = remove.dataset.login || email;
        const typed = prompt(`Повне видалення акаунта.\n\nБуде видалено доступ, invite, MFA-secret і profile binding.\nДля підтвердження введіть login або email:\n${login}`);
        if (!typed) return;
        if (typed.trim().toLowerCase() !== String(login).toLowerCase() && typed.trim().toLowerCase() !== String(email).toLowerCase()) {
          alert('Підтвердження не збігається. Видалення скасовано.');
          return;
        }
        if (!confirm(`Остаточно видалити ${email}? Цю дію не можна швидко відкотити.`)) return;
        await adminRpc('admin_delete_user_full', { p_email: email, p_confirm: typed.trim() });
        await refreshUsers();
        await refreshLogs();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося виконати дію з користувачем.');
    }
  });

  requestsTable?.addEventListener('click', async (event) => {
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
        const newStatus = status.dataset.status;
        if (newStatus === 'rejected' && !confirm('Відхилити цю заявку?')) return;
        await adminRpc('admin_update_access_request_status', {
          p_request_id: status.dataset.requestStatus,
          p_status: newStatus
        });
        await refreshRequests();
        await refreshLogs();
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося оновити заявку.');
    }
  });

  logsTable?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-log-details]');
    if (!btn) return;
    try {
      const parsed = JSON.parse(btn.dataset.logDetails || '{}');
      alert(JSON.stringify(parsed, null, 2));
    } catch (_) {
      alert(btn.dataset.logDetails || '{}');
    }
  });

  userSearch?.addEventListener('input', renderUsers);
  userStatusFilter?.addEventListener('change', renderUsers);
  requestSearch?.addEventListener('input', renderRequests);
  requestStatusFilter?.addEventListener('change', renderRequests);
  logSearch?.addEventListener('input', renderLogs);
  logActionFilter?.addEventListener('change', renderLogs);

  adminAccessFind?.addEventListener('click', async () => {
    adminAccessFind.disabled = true;
    adminAccessFind.textContent = 'Шукаю…';
    try {
      await findAdminAccessUser();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося знайти користувача.');
    } finally {
      adminAccessFind.disabled = false;
      adminAccessFind.textContent = 'Знайти';
    }
  });

  adminAccessForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = adminAccessQuery?.value?.trim();
    const role = adminAccessRole?.value || 'admin';
    if (!query) return alert('Введіть login або email користувача.');
    if (!confirm(`Надати адмін-доступ (${role}) для ${query}?`)) return;

    adminAccessGrant.disabled = true;
    adminAccessGrant.textContent = 'Надаю…';
    try {
      const rows = await adminRpc('admin_grant_admin_access', { p_query: query, p_admin_role: role });
      const row = Array.isArray(rows) ? rows[0] : rows;
      renderAdminAccessResult(row || null, 'granted');
      await refreshLogs();
      alert('Адмін-доступ надано. Користувач може входити в admin/index.html тим самим login/password.');
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося надати адмін-доступ.');
    } finally {
      adminAccessGrant.disabled = false;
      adminAccessGrant.textContent = 'Надати адмін-доступ →';
    }
  });

  adminAccessRevoke?.addEventListener('click', async () => {
    const query = adminAccessQuery?.value?.trim();
    if (!query) return alert('Введіть login або email користувача.');
    if (!confirm(`Відкликати адмін-доступ для ${query}?`)) return;

    adminAccessRevoke.disabled = true;
    adminAccessRevoke.textContent = 'Відкликаю…';
    try {
      const rows = await adminRpc('admin_revoke_admin_access', { p_query: query });
      const row = Array.isArray(rows) ? rows[0] : rows;
      renderAdminAccessResult(row || null, 'revoked');
      await refreshLogs();
      alert('Адмін-доступ відкликано.');
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося відкликати адмін-доступ.');
    } finally {
      adminAccessRevoke.disabled = false;
      adminAccessRevoke.textContent = 'Відкликати';
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

      await Promise.all([refreshUsers(), refreshRequests(), refreshLogs()]);
    } catch (error) {
      console.error(error);
      clearAdminSession();
      window.location.href = LOGIN_URL;
    }
  }

  init();
})();
