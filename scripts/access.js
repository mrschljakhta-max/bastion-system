/* =========================================================
   BASTION — Access / Roles API v1
   Works with Supabase RPC from supabase/sql/2026_05_09_access_invites.sql
   ========================================================= */

(function () {
  function getClient() {
    if (window.BastionAuth?.supabaseClient) return window.BastionAuth.supabaseClient;

    const url = window.BASTION_CONFIG?.SUPABASE_URL || window.SUPABASE_URL;
    const key = window.BASTION_CONFIG?.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;

    if (!window.supabase || !url || !key) {
      throw new Error("Supabase client is not ready");
    }

    window.__BASTION_ACCESS_CLIENT__ =
      window.__BASTION_ACCESS_CLIENT__ || window.supabase.createClient(url, key);

    return window.__BASTION_ACCESS_CLIENT__;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getBaseUrl() {
    const path = window.location.pathname;
    const markerAdmin = path.indexOf("/admin/");
    const markerPages = path.indexOf("/pages/");
    const markerSetup = path.indexOf("/setup-account.html");

    let rootPath = path;

    if (markerAdmin >= 0) rootPath = path.slice(0, markerAdmin + 1);
    else if (markerPages >= 0) rootPath = path.slice(0, markerPages + 1);
    else if (markerSetup >= 0) rootPath = path.slice(0, markerSetup + 1);
    else rootPath = path.replace(/[^/]*$/, "");

    return `${window.location.origin}${rootPath}`;
  }

  function buildSetupUrl(token) {
    return `${getBaseUrl()}setup-account.html?token=${encodeURIComponent(token)}`;
  }

  async function getMyAccessProfile() {
    const { data, error } = await getClient().rpc("get_my_access_profile");
    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : data || null;
  }

  async function requireRole(roles, redirectUrl) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    const profile = await getMyAccessProfile();

    if (!profile?.is_active || !allowedRoles.includes(profile.role)) {
      if (redirectUrl) window.location.href = redirectUrl;
      return null;
    }

    return profile;
  }

  function routeForRole(role) {
    if (role === "admin") return "./admin/index.html";
    return "./pages/app.html";
  }

  function routeForRoleFromNested(role) {
    if (role === "admin") return "../admin/index.html";
    return "../pages/app.html";
  }

  async function createInvite({ email, role, note }) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await getClient().rpc("admin_create_user_invite", {
      input_email: normalizedEmail,
      input_role: role,
      input_note: note || null
    });

    if (error) throw error;

    const invite = Array.isArray(data) ? data[0] : data;
    return {
      ...invite,
      setup_url: buildSetupUrl(invite.token)
    };
  }

  async function sendInviteEmail({ email, role, setupUrl }) {
    const fnUrl = `${(window.BASTION_CONFIG?.SUPABASE_URL || window.SUPABASE_URL).replace(/\/$/, "")}/functions/v1/send-invite-email`;
    const { data: sessionData } = await getClient().auth.getSession();
    const jwt = sessionData?.session?.access_token;

    if (!jwt) throw new Error("Немає активної admin-сесії для відправки листа.");

    const response = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({ email, role, setupUrl })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Не вдалося відправити лист.");
    }

    return payload;
  }

  async function getInviteByToken(token) {
    const { data, error } = await getClient().rpc("get_invite_by_token", {
      input_token: String(token || "").trim()
    });

    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : data || null;
  }

  async function activateInvite(token) {
    const { data, error } = await getClient().rpc("activate_user_invite", {
      input_token: String(token || "").trim()
    });

    if (error) throw error;
    return data === true;
  }

  window.BastionAccess = {
    normalizeEmail,
    getBaseUrl,
    buildSetupUrl,
    getMyAccessProfile,
    requireRole,
    routeForRole,
    routeForRoleFromNested,
    createInvite,
    sendInviteEmail,
    getInviteByToken,
    activateInvite
  };
})();
