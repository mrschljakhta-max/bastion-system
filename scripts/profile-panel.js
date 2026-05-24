/* BASTION Profile Panel v181
   Opens profile command modal from the right HUD plate and performs logout.
   Fix: creates a fixed invisible hitbox over the right HUD plate, so decorative layers cannot block the click.
*/
(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  const userMenuButton = byId("userMenuButton");
  const profileModal = byId("profileModal");
  const logoutButton = byId("logoutButton");

  const operatorName = byId("operatorName");
  const operatorRole = byId("operatorRole");
  const plateOperatorName = byId("plateOperatorName");
  const plateOperatorRole = byId("plateOperatorRole");

  const profileLogin = byId("profileLogin");
  const profileLoginValue = byId("profileLoginValue");
  const profileEmail = byId("profileEmail");
  const profileRole = byId("profileRole");
  const profileStatus = byId("profileStatus");
  const profileSession = byId("profileSession");

  const userAvatarTop = byId("userAvatarTop");
  const userAvatarModal = byId("userAvatarModal");
  const plateAvatarUser = document.querySelector(".plate-avatar-user");

  function safeText(value, fallback = "") {
    return String(value ?? fallback).replace(/[<>]/g, "").trim();
  }

  function normalizeRole(value) {
    return safeText(value || "DEMO", "DEMO").toUpperCase();
  }

  function getSupabaseClient() {
    let sb = window.BastionSupabase || window.supabaseClient || window.sb || null;

    if (!sb?.auth && window.supabase?.createClient) {
      const cfg = window.BASTION_CONFIG || {};
      const url = cfg.SUPABASE_URL || window.SUPABASE_URL;
      const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;

      if (url && key) {
        sb = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });

        window.BastionSupabase = sb;
        window.supabaseClient = sb;
        window.sb = sb;
      }
    }

    return sb;
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

    const sb = getSupabaseClient();
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

  function openProfile(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!profileModal) {
      console.warn("[BASTION profile-panel] #profileModal not found");
      return;
    }

    profileModal.classList.add("is-open");
    profileModal.setAttribute("aria-hidden", "false");
    userMenuButton?.setAttribute("aria-expanded", "true");
    document.body.classList.add("profile-modal-open");
  }

  function closeProfile(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    profileModal?.classList.remove("is-open");
    profileModal?.setAttribute("aria-hidden", "true");
    userMenuButton?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("profile-modal-open");
  }

  async function logout(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      const sb = getSupabaseClient();
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


  function ensureProfileHitbox() {
    if (!userMenuButton) return null;

    let hitbox = document.getElementById("bastionProfileHitbox");
    if (!hitbox) {
      hitbox = document.createElement("button");
      hitbox.id = "bastionProfileHitbox";
      hitbox.type = "button";
      hitbox.setAttribute("aria-label", "Відкрити профіль користувача");
      hitbox.setAttribute("title", "Профіль користувача");
      document.body.appendChild(hitbox);
    }

    hitbox.addEventListener("click", openProfile);
    return hitbox;
  }

  function bind() {
    if (!userMenuButton) {
      console.warn("[BASTION profile-panel] #userMenuButton not found");
    }

    userMenuButton?.addEventListener("click", openProfile);
    ensureProfileHitbox();

    /* Delegated fallback: works even if HUD child layers or future markup catch the click. */
    document.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("#userMenuButton, .b116-panel--right");
      if (trigger) openProfile(event);
    }, true);

    logoutButton?.addEventListener("click", logout);

    document.querySelectorAll("[data-close-profile]").forEach((el) => {
      el.addEventListener("click", closeProfile);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && profileModal?.classList.contains("is-open")) {
        closeProfile(event);
      }
    });
  }

  loadProfile();
  bind();

  window.BastionProfilePanel = {
    open: openProfile,
    close: closeProfile,
    reload: loadProfile
  };
})();
