/* =========================================================
   BASTION — Admin Control v1
   ========================================================= */

(function () {
  const profileBox = document.getElementById("adminProfile");
  const inviteForm = document.getElementById("inviteForm");
  const inviteEmail = document.getElementById("inviteEmail");
  const inviteRole = document.getElementById("inviteRole");
  const inviteNote = document.getElementById("inviteNote");
  const inviteSubmit = document.getElementById("inviteSubmit");
  const sendEmailBtn = document.getElementById("sendEmailBtn");
  const inviteResult = document.getElementById("inviteResult");
  const inviteUrl = document.getElementById("inviteUrl");
  const copyInviteUrl = document.getElementById("copyInviteUrl");
  const mailtoInvite = document.getElementById("mailtoInvite");
  let lastInvite = null;

  function setProfile(message) {
    profileBox.textContent = message;
  }

  function renderTable(tableId, rows, columns) {
    const table = document.getElementById(tableId);
    if (!table) return;

    if (!rows?.length) {
      table.innerHTML = `<tr><td>Даних немає або RPC ще не налаштовано.</td></tr>`;
      return;
    }

    table.innerHTML = `
      <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${columns.map((c) => `<td>${c.render ? c.render(row) : row[c.key] ?? ""}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    `;
  }

  async function adminRpc(name) {
    const { data, error } = await window.BastionAuth.supabaseClient.rpc(name);
    if (error) throw error;
    return data || [];
  }

  async function refreshUsers() {
    try {
      const rows = await adminRpc("admin_list_allowed_users");
      renderTable("usersTable", rows, [
        { key: "email", label: "Email" },
        { key: "role", label: "Роль" },
        { key: "status", label: "Статус" },
        { key: "is_active", label: "Активний" },
        { key: "created_at", label: "Створено" }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable("usersTable", [], []);
    }
  }

  async function refreshRequests() {
    try {
      const rows = await adminRpc("admin_list_access_requests");
      renderTable("requestsTable", rows, [
        { key: "email", label: "Email" },
        { key: "status", label: "Статус" },
        { key: "requested_at", label: "Дата" },
        { key: "note", label: "Нотатка" }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable("requestsTable", [], []);
    }
  }

  async function refreshLogs() {
    try {
      const rows = await adminRpc("admin_list_activity_logs");
      renderTable("logsTable", rows, [
        { key: "created_at", label: "Дата" },
        { key: "email", label: "Email" },
        { key: "action", label: "Дія" },
        { key: "details", label: "Details", render: (row) => `<code>${JSON.stringify(row.details || {})}</code>` }
      ]);
    } catch (error) {
      console.warn(error);
      renderTable("logsTable", [], []);
    }
  }

  function buildMailto(invite) {
    const subject = encodeURIComponent("BASTION — доступ до системи");
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

  inviteForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    inviteSubmit.disabled = true;
    inviteSubmit.textContent = "Створюю…";

    try {
      lastInvite = await window.BastionAccess.createInvite({
        email: inviteEmail.value,
        role: inviteRole.value,
        note: inviteNote.value
      });

      inviteUrl.textContent = lastInvite.setup_url;
      mailtoInvite.href = buildMailto(lastInvite);
      inviteResult.hidden = false;
      sendEmailBtn.disabled = false;
      inviteSubmit.textContent = "Доступ створено";
    } catch (error) {
      console.error(error);
      alert(error.message || "Не вдалося створити доступ.");
      inviteSubmit.textContent = "Створити доступ";
    } finally {
      inviteSubmit.disabled = false;
    }
  });

  copyInviteUrl?.addEventListener("click", async () => {
    if (!lastInvite?.setup_url) return;
    await navigator.clipboard.writeText(lastInvite.setup_url);
    copyInviteUrl.textContent = "Скопійовано";
    setTimeout(() => (copyInviteUrl.textContent = "Скопіювати"), 1200);
  });

  sendEmailBtn?.addEventListener("click", async () => {
    if (!lastInvite) return;
    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = "Надсилаю…";

    try {
      await window.BastionAccess.sendInviteEmail({
        email: lastInvite.email,
        role: lastInvite.role,
        setupUrl: lastInvite.setup_url
      });
      sendEmailBtn.textContent = "Лист надіслано";
    } catch (error) {
      console.warn(error);
      alert("Edge Function для email ще не налаштована. Використай копіювання посилання або mailto.");
      sendEmailBtn.textContent = "Надіслати лист";
    } finally {
      sendEmailBtn.disabled = false;
    }
  });

  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById(`tab-${btn.dataset.adminTab}`)?.classList.add("is-active");
    });
  });

  document.getElementById("refreshUsers")?.addEventListener("click", refreshUsers);
  document.getElementById("refreshRequests")?.addEventListener("click", refreshRequests);
  document.getElementById("refreshLogs")?.addEventListener("click", refreshLogs);

  document.getElementById("adminLogout")?.addEventListener("click", async () => {
    await window.BastionAuth.signOut();
    window.location.href = "../index.html";
  });

  async function init() {
    try {
      const session = await window.BastionAuth.getCurrentSession();
      if (!session) {
        setProfile("Увійдіть через стартову сторінку як admin.");
        return;
      }

      const profile = await window.BastionAccess.requireRole("admin", "../index.html");
      if (!profile) return;
      setProfile(`${profile.email} · ${profile.role}`);
      refreshUsers();
      refreshRequests();
      refreshLogs();
    } catch (error) {
      console.error(error);
      setProfile("Admin-доступ не підтверджено.");
    }
  }

  init();
})();
