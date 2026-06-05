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

  const inviteRoleCustom = document.getElementById('inviteRoleCustom');
  const inviteRoleTrigger = document.getElementById('inviteRoleTrigger');
  const inviteRoleMenu = document.getElementById('inviteRoleMenu');
  const inviteRoleValue = inviteRoleTrigger?.querySelector('.role-select-value');
  const inviteRoleOptions = Array.from(document.querySelectorAll('[data-role-value]'));
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
  const copyMainSiteUrl = document.getElementById('copyMainSiteUrl');
  const copyAdminStartUrl = document.getElementById('copyAdminStartUrl');

  const usersTable = document.getElementById('usersTable');
  const requestsTable = document.getElementById('requestsTable');
  const logsTable = document.getElementById('logsTable');

  const refreshUsersBtn = document.getElementById('refreshUsers');
  const userSearch = document.getElementById('userSearch');
  const userStatusFilter = document.getElementById('userStatusFilter');
  const userStatusCustom = document.getElementById('userStatusCustom');
  const userStatusTrigger = document.getElementById('userStatusTrigger');
  const userStatusMenu = document.getElementById('userStatusMenu');
  const userStatusValue = userStatusTrigger?.querySelector('.status-select-value');
  const userStatusOptions = Array.from(document.querySelectorAll('[data-status-value]'));
  const requestSearch = document.getElementById('requestSearch');
  const requestStatusFilter = document.getElementById('requestStatusFilter');
  const logSearch = document.getElementById('logSearch');
  const logActionFilter = document.getElementById('logActionFilter');
  const logActionCustom = document.getElementById('logActionCustom');
  const logActionTrigger = document.getElementById('logActionTrigger');
  const logActionMenu = document.getElementById('logActionMenu');
  const logActionValue = logActionTrigger?.querySelector('.status-select-value');
  const logActionOptions = Array.from(document.querySelectorAll('[data-log-action-value]'));
  const logDateFilterModal = document.getElementById('logDateFilterModal');
  const logDateFrom = document.getElementById('logDateFrom');
  const logDateTo = document.getElementById('logDateTo');
  const applyLogDateFilter = document.getElementById('applyLogDateFilter');

  const adminAccessForm = document.getElementById('adminAccessForm');
  const adminAccessQuery = document.getElementById('adminAccessQuery');
  const adminAccessRole = document.getElementById('adminAccessRole');
  const adminAccessFind = document.getElementById('adminAccessFind');
  const adminAccessGrant = document.getElementById('adminAccessGrant');
  const adminAccessRevoke = document.getElementById('adminAccessRevoke');
  const adminAccessResult = document.getElementById('adminAccessResult');
  let adminAccessDropdown = null;
  let adminAccessSelectedIndex = -1;
  let currentAdminAccessUser = null;

  let lastInvite = null;
  let adminSession = null;
  let usersCache = [];
  let requestsCache = [];
  let logsCache = [];
  let logDateRange = { from: '', to: '' };
  let pendingUserDelete = null;

  const userDeleteModal = document.getElementById('userDeleteModal');
  const userDeleteTarget = document.getElementById('userDeleteTarget');
  const confirmUserDelete = document.getElementById('confirmUserDelete');

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

  function formatDateStacked(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return escapeHtml(value);
      const day = date.toLocaleDateString('uk-UA', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      return `<span class="admin-date-stack"><strong>${escapeHtml(day)}</strong><small>${escapeHtml(time)}</small></span>`;
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
      <thead><tr>${columns.map((c) => `<th>${c.labelHtml || escapeHtml(c.label)}</th>`).join('')}</tr></thead>
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

  function boolIcon(value, label = '') {
    const ok = Boolean(value);
    return `<span class="admin-bool-icon ${ok ? 'is-ok' : 'is-no'}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ok ? '✓' : '×'}</span>`;
  }

  function actionIconButton(kind, attrs, label, icon) {
    return `<button type="button" class="admin-icon-action admin-icon-action--${escapeHtml(kind)}" ${attrs} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span>${icon}</span></button>`;
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

  function isUserPendingRegistration(row) {
    const status = normalizeText(row?.status);
    return status === 'pending' || status === 'invited' || status === 'mfa_pending' || !row?.login;
  }

  function updateUsersMetrics(rows = usersCache) {
    setMetric('usersTotalCount', rows.length);
    setMetric('usersActiveCount', rows.filter((r) => Boolean(r.is_active) && String(r.status).toLowerCase() !== 'disabled').length);
    setMetric('usersPendingCount', rows.filter(isUserPendingRegistration).length);
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
        (status === 'pending' && isUserPendingRegistration(row)) ||
        rowStatus === status;
      return matchesSearch && matchesStatus;
    });
  }

  function setStatusFilterValue(value, render = true) {
    if (!userStatusFilter) return;
    userStatusFilter.value = value;
    const selected = userStatusOptions.find((option) => option.dataset.statusValue === value);
    userStatusOptions.forEach((option) => option.classList.toggle('is-selected', option === selected));
    if (userStatusValue && selected) userStatusValue.textContent = selected.textContent.trim();
    usersKpiCards.forEach((card) => card.classList.toggle('is-active-filter', card.dataset.usersKpiFilter === value));
    if (render) renderUsers();
  }

  function closeStatusSelect() {
    userStatusCustom?.classList.remove('is-open');
    userStatusTrigger?.setAttribute('aria-expanded', 'false');
  }

  function toggleStatusSelect() {
    const open = !userStatusCustom?.classList.contains('is-open');
    userStatusCustom?.classList.toggle('is-open', open);
    userStatusTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setLogActionFilterValue(value, render = true) {
    if (!logActionFilter) return;
    logActionFilter.value = value;
    const selected = logActionOptions.find((option) => option.dataset.logActionValue === value);
    logActionOptions.forEach((option) => option.classList.toggle('is-selected', option === selected));
    if (logActionValue && selected) logActionValue.textContent = selected.textContent.trim();
    if (render) renderLogs();
  }

  function closeLogActionSelect() {
    logActionCustom?.classList.remove('is-open');
    logActionTrigger?.setAttribute('aria-expanded', 'false');
  }

  function toggleLogActionSelect() {
    const open = !logActionCustom?.classList.contains('is-open');
    logActionCustom?.classList.toggle('is-open', open);
    logActionTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function openLogDateModal() {
    if (!logDateFilterModal) return;
    if (logDateFrom) logDateFrom.value = logDateRange.from || '';
    if (logDateTo) logDateTo.value = logDateRange.to || '';
    logDateFilterModal.hidden = false;
    window.requestAnimationFrame(() => logDateFilterModal.classList.add('is-visible'));
  }

  function closeLogDateModal() {
    if (!logDateFilterModal) return;
    logDateFilterModal.classList.remove('is-visible');
    window.setTimeout(() => { logDateFilterModal.hidden = true; }, 160);
  }

  function setLogDatePreset(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = ''; let to = '';
    if (preset === 'today') {
      from = toDateInputValue(today); to = from;
    } else if (preset === 'yesterday') {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      from = toDateInputValue(d); to = from;
    } else if (preset === '7' || preset === '30') {
      const d = new Date(today); d.setDate(d.getDate() - Number(preset) + 1);
      from = toDateInputValue(d); to = toDateInputValue(today);
    } else if (preset === 'month') {
      from = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
      to = toDateInputValue(today);
    } else if (preset === 'all') {
      from = ''; to = '';
    }
    if (logDateFrom) logDateFrom.value = from;
    if (logDateTo) logDateTo.value = to;
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
      const rowDate = row.created_at ? new Date(row.created_at) : null;
      const fromOk = !logDateRange.from || (rowDate && rowDate >= new Date(`${logDateRange.from}T00:00:00`));
      const toOk = !logDateRange.to || (rowDate && rowDate <= new Date(`${logDateRange.to}T23:59:59`));
      return (!q || haystack.includes(q)) && actionGroup && fromOk && toOk;
    });
  }

  function renderUsers() {
    const rows = getFilteredUsers();
    updateUsersMetrics(usersCache);

    renderTable('usersTable', rows, [
      { key: 'login', label: 'Login', render: (row) => `<strong>${escapeHtml(row.login || '—')}</strong>` },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Роль', render: (row) => `<span class="admin-role-pill">${escapeHtml(row.role || '—')}</span>` },
      { key: 'status', label: 'Статус', render: (row) => {
        const active = Boolean(row.is_active) && String(row.status).toLowerCase() !== 'disabled';
        return boolIcon(active, active ? 'Активний' : 'Вимкнений');
      } },
      { key: 'mfa_enabled', label: '2FA', render: (row) => boolIcon(Boolean(row.mfa_enabled), Boolean(row.mfa_enabled) ? '2FA увімкнено' : '2FA вимкнено') },
      { key: 'is_active', label: 'Доступ', render: (row) => {
        const access = Boolean(row.is_active) && String(row.status).toLowerCase() !== 'disabled';
        return boolIcon(access, access ? 'Доступ активний' : 'Доступ закрито');
      } },
      { key: 'created_at', label: 'Створено', render: (row) => formatDateStacked(row.created_at) },
      {
        key: 'actions',
        label: 'Дії',
        render: (row) => {
          const email = escapeHtml(row.email || '');
          const login = escapeHtml(row.login || '');
          const isActive = Boolean(row.is_active) && String(row.status).toLowerCase() !== 'disabled';
          return actionButtons([
            actionIconButton('toggle', `data-user-toggle="${email}" data-active="${isActive ? 'false' : 'true'}"`, isActive ? 'Вимкнути користувача' : 'Увімкнути користувача', '⏻'),
            actionIconButton('logs', `data-user-logs="${email}"`, 'Переглянути логи', '≋'),
            actionIconButton('delete', `data-user-delete="${email}" data-login="${login}"`, 'Видалити користувача', '<img src="./assets/user-x.svg" alt="" />')
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

    const dateLabel = `<button type="button" class="admin-date-header-btn" data-log-date-filter-open title="Обрати період"><img src="./assets/calendar-event.svg" alt="" aria-hidden="true" /><span>Дата</span></button>`;
    renderTable('logsTable', rows, [
      { key: 'created_at', label: 'Дата', labelHtml: dateLabel, render: (row) => formatDateStacked(row.created_at) },
      { key: 'email', label: 'Email/Login', render: (row) => `<strong>${escapeHtml(row.email || '—')}</strong>` },
      { key: 'action', label: 'Подія', render: (row) => `<span class="admin-log-human">${escapeHtml(humanLog(row))}</span><small>${escapeHtml(row.action || '')}</small>` },
      {
        key: 'details',
        label: 'Деталі',
        render: (row) => `<button type="button" class="admin-details-btn" data-log-details="${escapeHtml(JSON.stringify(row.details || {}))}">Деталі</button>`
      }
    ], 'Логів за цим фільтром немає.');
  }


  function getAdminAccessCandidates(query = '') {
    const q = normalizeText(query);
    const rows = Array.isArray(usersCache) ? usersCache : [];

    return rows
      .filter((row) => {
        const login = normalizeText(row.login);
        const email = normalizeText(row.email);
        const status = normalizeText(row.status);
        const haystack = `${login} ${email} ${normalizeText(row.role)} ${status}`;
        const isUsable = login || email;
        return isUsable && (!q || haystack.includes(q));
      })
      .slice(0, 20);
  }

  function ensureAdminAccessDropdown() {
    if (!adminAccessQuery || adminAccessDropdown) return adminAccessDropdown;

    adminAccessDropdown = document.createElement('div');
    adminAccessDropdown.className = 'admin-autocomplete-panel';
    adminAccessDropdown.hidden = true;
    adminAccessDropdown.setAttribute('role', 'listbox');

    const shell = adminAccessQuery.closest('.field-control') || adminAccessQuery.parentElement;
    shell?.classList.add('has-admin-autocomplete');
    shell?.appendChild(adminAccessDropdown);

    return adminAccessDropdown;
  }

  function pickAdminAccessCandidate(row) {
    if (!row || !adminAccessQuery) return;
    adminAccessQuery.value = row.login || row.email || '';
    hideAdminAccessDropdown();
    renderAdminAccessResult({
      login: row.login,
      email: row.email,
      user_role: row.role,
      role: row.role,
      status: row.status,
      mfa_enabled: row.mfa_enabled,
      auth_user_id: row.auth_user_id,
      is_admin: row.is_admin,
      admin_role: row.admin_role
    }, 'selected');
  }

  function hideAdminAccessDropdown() {
    if (!adminAccessDropdown) return;
    adminAccessDropdown.hidden = true;
    adminAccessSelectedIndex = -1;
  }

  function renderAdminAccessDropdown(forceAll = false) {
    const panel = ensureAdminAccessDropdown();
    if (!panel || !adminAccessQuery) return;

    const query = adminAccessQuery.value.trim();
    const rows = getAdminAccessCandidates(forceAll ? '' : query);
    adminAccessSelectedIndex = -1;

    if (!rows.length) {
      panel.innerHTML = `
        <div class="admin-autocomplete-empty">
          <strong>Немає збігів</strong>
          <span>Спробуй інший login або email.</span>
        </div>
      `;
      panel.hidden = false;
      return;
    }

    panel.innerHTML = rows.map((row, index) => `
      <button type="button" class="admin-autocomplete-item" data-admin-access-option="${index}" role="option">
        <span class="admin-autocomplete-main">
          <strong>${escapeHtml(row.login || '—')}</strong>
          <small>${escapeHtml(row.email || '—')}</small>
        </span>
        <span class="admin-autocomplete-meta">
          <em>${escapeHtml(row.role || '—')}</em>
          ${Boolean(row.mfa_enabled) ? '<b>2FA</b>' : ''}
        </span>
      </button>
    `).join('');

    panel.hidden = false;
    panel.querySelectorAll('[data-admin-access-option]').forEach((item) => {
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const idx = Number(item.dataset.adminAccessOption);
        pickAdminAccessCandidate(rows[idx]);
      });
    });
  }

  function moveAdminAccessSelection(direction) {
    if (!adminAccessDropdown || adminAccessDropdown.hidden) return;
    const items = Array.from(adminAccessDropdown.querySelectorAll('.admin-autocomplete-item'));
    if (!items.length) return;

    adminAccessSelectedIndex = (adminAccessSelectedIndex + direction + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle('is-selected', index === adminAccessSelectedIndex));
    items[adminAccessSelectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function selectHighlightedAdminAccessCandidate() {
    if (!adminAccessDropdown || adminAccessDropdown.hidden) return false;
    const items = Array.from(adminAccessDropdown.querySelectorAll('.admin-autocomplete-item'));
    if (!items.length || adminAccessSelectedIndex < 0) return false;
    items[adminAccessSelectedIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return true;
  }

  function setAdminAccessGrantButton(label, action = 'grant', disabled = false) {
    if (!adminAccessGrant) return;
    adminAccessGrant.disabled = disabled;
    adminAccessGrant.dataset.adminAccessAction = action;
    adminAccessGrant.innerHTML = `
      <span class="admin-btn-icon"><img src="./assets/lock-access.svg" alt="" aria-hidden="true" /></span>
      <span>${escapeHtml(label)}</span>
    `;
  }

  function setAdminAccessFindButton(label = 'Знайти', disabled = false) {
    if (!adminAccessFind) return;
    adminAccessFind.disabled = disabled;
    adminAccessFind.innerHTML = `
      <span class="admin-btn-icon"><img src="./assets/list-search.svg" alt="" aria-hidden="true" /></span>
      <span>${escapeHtml(label)}</span>
    `;
  }

  function syncAdminAccessAction(row = currentAdminAccessUser) {
    if (!adminAccessGrant) return;
    if (!row) {
      setAdminAccessGrantButton('Надати адмін-доступ', 'grant', true);
      return;
    }

    const isAdmin = Boolean(row.is_admin);
    setAdminAccessGrantButton(isAdmin ? 'Відкликати адмін-доступ' : 'Надати адмін-доступ', isAdmin ? 'revoke' : 'grant', false);
  }

  function renderAdminAccessResult(row, mode = 'found') {
    if (!adminAccessResult) return;

    currentAdminAccessUser = row || null;
    syncAdminAccessAction(currentAdminAccessUser);

    if (!row) {
      adminAccessResult.innerHTML = `
        <div class="admin-empty-card">
          <strong>Користувача не знайдено</strong>
          <span>Перевірте логін або email. Користувач має спочатку пройти звичайну реєстрацію.</span>
        </div>
      `;
      return;
    }

    const isAdmin = Boolean(row.is_admin);
    const adminStatusText = isAdmin ? 'Так' : 'Ні';
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
          <strong class="${isAdmin ? 'admin-good' : 'admin-muted-inline'}">${adminStatusText}</strong>
          <small>${isAdmin ? 'Доступ до адмін-сайту активний' : 'Доступ до адмін-сайту відсутній'}</small>
        </div>
        <div>
          <span>2FA</span>
          <strong class="${row.mfa_enabled ? 'admin-good' : 'admin-muted-inline'}">${row.mfa_enabled ? 'Увімкнено' : 'Вимкнено'}</strong>
          <small>${row.auth_user_id ? 'auth linked' : 'no auth binding'}</small>
        </div>
      </div>
    `;
  }

  function confirmAdminAccessAction(row, action) {
    return new Promise((resolve) => {
      const isGrant = action === 'grant';
      const overlay = document.createElement('div');
      overlay.className = 'admin-confirm-overlay';
      overlay.innerHTML = `
        <div class="admin-confirm-dialog" role="dialog" aria-modal="true" aria-label="Підтвердження дії">
          <div class="admin-confirm-icon">${isGrant ? '+' : '−'}</div>
          <h3>${isGrant ? 'Надати адмін-доступ?' : 'Відкликати адмін-доступ?'}</h3>
          <p>${isGrant ? 'Користувач отримає право входу в адмінський сайт BASTION.' : 'Користувач втратить право входу в адмінський сайт BASTION.'}</p>
          <div class="admin-confirm-user">
            <span>Користувач</span>
            <strong>${escapeHtml(row?.login || '—')}</strong>
            <small>${escapeHtml(row?.email || '—')}</small>
          </div>
          <div class="admin-confirm-actions">
            <button type="button" class="admin-secondary" data-confirm-cancel>Відхилити</button>
            <button type="button" class="admin-confirm-primary" data-confirm-ok>${isGrant ? 'Надати' : 'Відкликати'}</button>
          </div>
        </div>
      `;

      const close = (result) => {
        overlay.classList.remove('is-visible');
        window.setTimeout(() => overlay.remove(), 160);
        resolve(result);
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(false);
      });
      overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => close(false));
      overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', () => close(true));

      document.body.appendChild(overlay);
      window.requestAnimationFrame(() => overlay.classList.add('is-visible'));
      overlay.querySelector('[data-confirm-cancel]')?.focus();
    });
  }

  async function findAdminAccessUser(silent = false) {
    const query = adminAccessQuery?.value?.trim();
    if (!query) {
      if (!silent) alert('Введіть логін або email користувача.');
      return null;
    }

    const rows = await adminRpc('admin_find_user_for_admin_access', { p_query: query });
    const row = Array.isArray(rows) ? rows[0] : rows;
    renderAdminAccessResult(row || null);
    return row || null;
  }


  function playRefreshButtonFeedback(button = refreshUsersBtn) {
    if (!button) return;
    const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    button.classList.remove('is-refreshing', 'is-updated');
    void button.offsetWidth;
    button.classList.add('is-refreshing');
    window.setTimeout(() => {
      button.classList.remove('is-refreshing');
      button.classList.add('is-updated');
      if (textNode) textNode.textContent = 'Оновлено';
      window.setTimeout(() => {
        button.classList.remove('is-updated');
        if (textNode) textNode.textContent = 'Оновити';
      }, 1000);
    }, 520);
  }

  async function refreshUsers() {
    try {
      usersCache = await adminRpc('admin_list_allowed_users');
      renderUsers();
      if (adminAccessDropdown && !adminAccessDropdown.hidden) renderAdminAccessDropdown(!adminAccessQuery?.value?.trim());
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


  function syncInviteRoleCustom() {
    if (!inviteRole || !inviteRoleValue) return;
    const selectedOption = inviteRole.options[inviteRole.selectedIndex];
    const label = selectedOption?.textContent || 'demo — демо-користувач';
    inviteRoleValue.textContent = label;
    inviteRoleOptions.forEach((option) => {
      const isSelected = option.dataset.roleValue === inviteRole.value;
      option.classList.toggle('is-selected', isSelected);
      option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function closeInviteRoleSelect() {
    inviteRoleCustom?.classList.remove('is-open');
    inviteRoleTrigger?.setAttribute('aria-expanded', 'false');
  }

  function openInviteRoleSelect() {
    inviteRoleCustom?.classList.add('is-open');
    inviteRoleTrigger?.setAttribute('aria-expanded', 'true');
  }

  inviteRoleTrigger?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (inviteRoleCustom?.classList.contains('is-open')) closeInviteRoleSelect();
    else openInviteRoleSelect();
  });

  inviteRoleOptions.forEach((option) => {
    option.addEventListener('click', (event) => {
      event.preventDefault();
      const value = option.dataset.roleValue;
      if (inviteRole && value) {
        inviteRole.value = value;
        inviteRole.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncInviteRoleCustom();
      closeInviteRoleSelect();
      inviteRoleTrigger?.focus();
    });
  });

  inviteRole?.addEventListener('change', syncInviteRoleCustom);
  document.addEventListener('click', (event) => {
    if (!inviteRoleCustom?.contains(event.target)) closeInviteRoleSelect();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeInviteRoleSelect();
  });

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
    if (inviteSubmit) inviteSubmit.textContent = 'Надіслати запрошення →';
    updateInvitePreview();
    syncInviteRoleCustom();
  });

  updateInvitePreview();
  syncInviteRoleCustom();

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
    inviteSubmit.textContent = 'Створюю доступ…';

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

      if (inviteUrl) inviteUrl.textContent = lastInvite.setup_url;
      if (mailtoInvite) mailtoInvite.href = buildMailto(lastInvite);
      if (inviteResult) inviteResult.hidden = true;

      inviteSubmit.textContent = 'Надсилаю лист…';
      await sendInviteEmail(lastInvite);
      inviteSubmit.textContent = 'Запрошення надіслано ✓';

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

      inviteForm?.reset();
      lastInvite = null;
      updateInvitePreview();
      syncInviteRoleCustom();
      setTimeout(() => {
        if (inviteSubmit) inviteSubmit.textContent = 'Надіслати запрошення →';
      }, 1600);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося створити або надіслати запрошення.');
      inviteSubmit.textContent = 'Надіслати запрошення →';
    } finally {
      inviteSubmit.disabled = false;
    }
  });

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function bindCopyButton(button, url) {
    if (!button) return;
    const hasCopyText = button.dataset.copyDefault !== '';
    const defaultText = button.dataset.copyDefault || button.textContent || 'Копіювати';

    button.addEventListener('click', async () => {
      try {
        await copyTextToClipboard(url);
        button.classList.add('is-copied');
        if (hasCopyText) button.textContent = '✓ Скопійовано';
        setTimeout(() => {
          button.classList.remove('is-copied');
          if (hasCopyText) button.textContent = defaultText;
        }, 1600);
      } catch (error) {
        console.error('Copy link failed:', error);
        if (hasCopyText) {
          button.textContent = 'Не скопійовано';
          setTimeout(() => (button.textContent = defaultText), 1600);
        }
      }
    });
  }

  copyInviteUrl?.addEventListener('click', async () => {
    if (!lastInvite?.setup_url) return;
    await copyTextToClipboard(lastInvite.setup_url);
    copyInviteUrl.textContent = 'Скопійовано';
    setTimeout(() => (copyInviteUrl.textContent = 'Скопіювати'), 1200);
  });

  bindCopyButton(copyMainSiteUrl, `${window.location.origin}/`);
  bindCopyButton(copyAdminStartUrl, `${window.location.origin}/admin/start.html`);
  syncAdminAccessAction(null);


  async function sendAdminAccessEmail(user, role) {
    if (!user?.email) {
      console.warn('Admin access email skipped: user email is empty', user);
      return { skipped: true, reason: 'empty_email' };
    }

    const adminLoginUrl = `${window.location.origin}/admin/login.html`;
    const { data, error } = await client.functions.invoke('send-admin-access-email', {
      body: {
        email: user.email,
        login: user.login,
        role: role || user.admin_role || 'admin',
        admin_login_url: adminLoginUrl
      }
    });

    if (error) throw error;
    return data || { ok: true };
  }

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
    if (eyebrowEl) {
      eyebrowEl.textContent = '';
      eyebrowEl.hidden = true;
    }
    btn.blur();

    if (save) localStorage.setItem(ACTIVE_TAB_KEY, tabName);
  }

  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.adminTab));
  });

  function openUserDeleteModal(email, login) {
    pendingUserDelete = { email, login: login || email };
    if (userDeleteTarget) userDeleteTarget.textContent = login && login !== email ? `${login} • ${email}` : email;
    if (userDeleteModal) {
      userDeleteModal.hidden = false;
      requestAnimationFrame(() => userDeleteModal.classList.add('is-open'));
    }
  }

  function closeUserDeleteModal() {
    pendingUserDelete = null;
    if (!userDeleteModal) return;
    userDeleteModal.classList.remove('is-open');
    window.setTimeout(() => { userDeleteModal.hidden = true; }, 160);
  }

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
        openUserDeleteModal(email, login);
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

  userStatusTrigger?.addEventListener('click', toggleStatusSelect);
  userStatusOptions.forEach((option) => {
    option.addEventListener('click', () => {
      setStatusFilterValue(option.dataset.statusValue || 'all');
      closeStatusSelect();
    });
  });
  document.addEventListener('click', (event) => {
    if (!userStatusCustom) return;
    if (!userStatusCustom.contains(event.target)) closeStatusSelect();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeStatusSelect();
      closeLogActionSelect();
      if (userDeleteModal && !userDeleteModal.hidden) closeUserDeleteModal();
    }
  });
  document.querySelectorAll('[data-delete-cancel]').forEach((btn) => {
    btn.addEventListener('click', closeUserDeleteModal);
  });
  confirmUserDelete?.addEventListener('click', async () => {
    if (!pendingUserDelete?.email) return;
    const { email } = pendingUserDelete;
    confirmUserDelete.disabled = true;
    try {
      await adminRpc('admin_delete_user_full', { p_email: email, p_confirm: email });
      closeUserDeleteModal();
      await refreshUsers();
      await refreshLogs();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося видалити користувача.');
    } finally {
      confirmUserDelete.disabled = false;
    }
  });

  userSearch?.addEventListener('input', renderUsers);
  userStatusFilter?.addEventListener('change', () => setStatusFilterValue(userStatusFilter.value || 'all'));
  requestSearch?.addEventListener('input', renderRequests);
  requestStatusFilter?.addEventListener('change', renderRequests);
  logSearch?.addEventListener('input', renderLogs);
  logActionFilter?.addEventListener('change', () => setLogActionFilterValue(logActionFilter.value || 'all'));
  logActionTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleLogActionSelect();
  });
  logActionOptions.forEach((option) => {
    option.addEventListener('click', () => {
      setLogActionFilterValue(option.dataset.logActionValue || 'all');
      closeLogActionSelect();
    });
  });
  logsTable?.addEventListener('click', (event) => {
    if (event.target.closest('[data-log-date-filter-open]')) openLogDateModal();
  });
  document.querySelectorAll('[data-log-date-close]').forEach((btn) => btn.addEventListener('click', closeLogDateModal));
  document.querySelectorAll('[data-date-preset]').forEach((btn) => btn.addEventListener('click', () => setLogDatePreset(btn.dataset.datePreset)));
  applyLogDateFilter?.addEventListener('click', () => {
    logDateRange = { from: logDateFrom?.value || '', to: logDateTo?.value || '' };
    closeLogDateModal();
    renderLogs();
  });
  setLogActionFilterValue(logActionFilter?.value || 'all', false);


  adminAccessQuery?.addEventListener('focus', () => renderAdminAccessDropdown(true));
  adminAccessQuery?.addEventListener('input', () => renderAdminAccessDropdown(false));
  adminAccessQuery?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!adminAccessDropdown || adminAccessDropdown.hidden) renderAdminAccessDropdown(true);
      moveAdminAccessSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveAdminAccessSelection(-1);
    } else if (event.key === 'Enter') {
      if (selectHighlightedAdminAccessCandidate()) event.preventDefault();
    } else if (event.key === 'Escape') {
      hideAdminAccessDropdown();
    }
  });
  document.addEventListener('click', (event) => {
    if (!adminAccessDropdown || !adminAccessQuery) return;
    const inside = adminAccessDropdown.contains(event.target) || adminAccessQuery.contains(event.target);
    if (!inside) hideAdminAccessDropdown();
  });

  adminAccessFind?.addEventListener('click', async () => {
    setAdminAccessFindButton('Шукаю…', true);
    try {
      await findAdminAccessUser();
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не вдалося знайти користувача.');
    } finally {
      setAdminAccessFindButton('Знайти', false);
    }
  });

  adminAccessForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = adminAccessQuery?.value?.trim();
    if (!query) return alert('Введіть логін або email користувача.');

    let row = currentAdminAccessUser;
    const rowKey = String(row?.login || row?.email || '').trim().toLowerCase();
    if (!row || (rowKey && !String(query).trim().toLowerCase().includes(rowKey) && rowKey !== String(query).trim().toLowerCase())) {
      row = await findAdminAccessUser(true);
    }

    if (!row) {
      renderAdminAccessResult(null);
      return;
    }

    const action = Boolean(row.is_admin) ? 'revoke' : 'grant';
    const confirmed = await confirmAdminAccessAction(row, action);
    if (!confirmed) return;

    setAdminAccessGrantButton(action === 'grant' ? 'Надаю…' : 'Відкликаю…', action, true);

    try {
      const rows = action === 'grant'
        ? await adminRpc('admin_grant_admin_access', { p_query: query, p_admin_role: 'admin' })
        : await adminRpc('admin_revoke_admin_access', { p_query: query });
      const updatedRow = Array.isArray(rows) ? rows[0] : rows;
      renderAdminAccessResult(updatedRow || null, action === 'grant' ? 'granted' : 'revoked');

      if (action === 'grant') {
        try {
          await sendAdminAccessEmail(updatedRow, 'admin');
        } catch (mailError) {
          console.error('Admin access email failed:', mailError);
        }
      }

      await Promise.all([refreshLogs(), refreshUsers()]);
      setAdminAccessGrantButton(action === 'grant' ? 'Доступ надано ✓' : 'Доступ відкликано ✓', action, true);
      window.setTimeout(() => syncAdminAccessAction(updatedRow || currentAdminAccessUser), 1400);
    } catch (error) {
      console.error(error);
      alert(error.message || (action === 'grant' ? 'Не вдалося надати адмін-доступ.' : 'Не вдалося відкликати адмін-доступ.'));
      syncAdminAccessAction(row);
    } finally {
      window.setTimeout(() => {
        adminAccessGrant.disabled = false;
        syncAdminAccessAction(currentAdminAccessUser);
      }, 300);
    }
  });


  refreshUsersBtn?.addEventListener('click', async () => {
    playRefreshButtonFeedback();
    await refreshUsers();
  });
  document.getElementById('refreshRequests')?.addEventListener('click', refreshRequests);
  document.getElementById('refreshLogs')?.addEventListener('click', async (event) => {
    playRefreshButtonFeedback(event.currentTarget);
    await refreshLogs();
  });

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
