/* BASTION Profile Panel v176
   Opens profile command modal from the right HUD plate and performs logout.
*/
(() => {
  const userMenuButton = document.getElementById("userMenuButton");
  const profileModal = document.getElementById("profileModal");
  const logoutButton = document.getElementById("logoutButton");

  const operatorName = document.getElementById("operatorName");
  const operatorRole = document.getElementById("operatorRole");
  const plateOperatorName = document.getElementById("plateOperatorName");
  const plateOperatorRole = document.getElementById("plateOperatorRole");

  const profileLogin = document.getElementById("profileLogin");
  const profileLoginValue = document.getElementById("profileLoginValue");
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");
  const profileStatus = document.getElementById("profileStatus");
  const profileSession = document.getElementById("profileSession");

  const userAvatarTop = document.getElementById("userAvatarTop");
  const userAvatarModal = document.getElementById("userAvatarModal");
  const plateAvatarUser = document.querySelector(".plate-avatar-user");

  function safeText(value, fallback = "") {
    return String(value ?? fallback).replace(/[<>]/g, "").trim();
  }

  function normalizeRole(value) {
    return safeText(value || "DEMO", "DEMO").toUpperCase();
  }

  function getLocalProfile() {
    const email = safeText(localStorage.getItem("bastion_email") || "");
    const login = safeText(
      localStorage.getItem("bastion_profile_nickname") ||
      localStorage.getItem("bastion_login") ||
      email.split("@")[0] ||
      "lavash.squad"
    );

    return {
      login,
      email,
      role: normalizeRole(localStorage.getItem("bastion_role") || "DEMO"),
      avatar: safeText(localStorage.getItem("bastion_profile_avatar") || "")
    };
  }

  function applyProfile(profile = {}) {
    const login = safeText(profile.login || profile.nickname || "lavash.squad");
    const email = safeText(profile.email || "");
    const role = normalizeRole(profile.role || profile.access_level || "DEMO");
    const avatar = safeText(profile.avatar || profile.avatar_url || "");

    if (operatorName) operatorName.textContent = login;
    if (operatorRole) operatorRole.textContent = role;
    if (plateOperatorName) plateOperatorName.textContent = login;
    if (plateOperatorRole) plateOperatorRole.textContent = role;

    if (profileLogin) profileLogin.textContent = login;
    if (profileLoginValue) profileLoginValue.textContent = login;
    if (profileEmail) profileEmail.textContent = email || "email не визначено";
    if (profileRole) profileRole.textContent = role;
    if (profileStatus) profileStatus.textContent = "ACTIVE";
    if (profileSession) profileSession.textContent = email ? "Захищена" : "Локальна";

    if (avatar) {
      if (userAvatarTop) userAvatarTop.src = avatar;
      if (userAvatarModal) userAvatarModal.src = avatar;
      if (plateAvatarUser) plateAvatarUser.src = avatar;
    }
  }

  async function loadProfile() {
    const local = getLocalProfile();
    applyProfile(local);

    const sb = window.BastionSupabase || window.supabaseClient || window.sb || null;
    if (!sb?.auth?.getUser) return;

    try {
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError || !authData?.user) return;

      const authUser = authData.user;
      localStorage.setItem("bastion_email", authUser.email || local.email || "");

      if (sb?.from) {
        const { data: profile, error: profileError } = await sb
          .from("profiles")
          .select("id,email,nickname,access_level,avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!profileError && profile) {
          applyProfile({
            login: profile.nickname || authUser.email?.split("@")?.[0] || local.login,
            email: profile.email || authUser.email || local.email,
            role: profile.access_level || local.role,
            avatar: profile.avatar_url || local.avatar
          });
          return;
        }
      }

      applyProfile({
        login: authUser.email?.split("@")?.[0] || local.login,
        email: authUser.email || local.email,
        role: local.role,
        avatar: local.avatar
      });
    } catch (error) {
      console.warn("[BASTION profile-panel] profile load failed:", error);
    }
  }

  function openProfile() {
    profileModal?.classList.add("is-open");
    profileModal?.setAttribute("aria-hidden", "false");
    userMenuButton?.setAttribute("aria-expanded", "true");
  }

  function closeProfile() {
    profileModal?.classList.remove("is-open");
    profileModal?.setAttribute("aria-hidden", "true");
    userMenuButton?.setAttribute("aria-expanded", "false");
  }

  async function logout() {
    try {
      const sb = window.BastionSupabase || window.supabaseClient || window.sb || null;
      if (sb?.auth?.signOut) await sb.auth.signOut();
    } catch (error) {
      console.warn("[BASTION logout] signOut failed:", error);
    }

    [
      "bastion_login",
      "bastion_role",
      "bastion_email",
      "bastion_access_token",
      "bastion_profile_nickname",
      "bastion_profile_avatar"
    ].forEach((key) => localStorage.removeItem(key));

    window.location.replace("../index.html");
  }

  function bind() {
    userMenuButton?.addEventListener("click", openProfile);
    logoutButton?.addEventListener("click", logout);

    document.querySelectorAll("[data-close-profile]").forEach((el) => {
      el.addEventListener("click", closeProfile);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeProfile();
    });
  }

  loadProfile();
  bind();
})();
