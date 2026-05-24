/* BASTION Profile Panel v181
   Hard fix: opens profile modal from the visual bounds of the top-right HUD plate,
   even when decorative HUD layers, pseudo-elements, or pointer-events rules interfere.
*/
(() => {
  const PROFILE_VERSION = "181";

  function byId(id) {
    return document.getElementById(id);
  }

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

    const targets = {
      operatorName: login,
      operatorRole: role,
      plateOperatorName: login,
      plateOperatorRole: role,
      profileLogin: login,
      profileLoginValue: login,
      profileEmail: email || "email не визначено",
      profileRole: role,
      profileStatus: "ACTIVE",
      profileSession: email ? "Захищена" : "Локальна"
    };

    Object.entries(targets).forEach(([id, text]) => {
      const node = byId(id);
      if (node) node.textContent = text;
    });

    if (avatar) {
      [byId("userAvatarTop"), byId("userAvatarModal"), document.querySelector(".plate-avatar-user")]
        .filter(Boolean)
        .forEach((img) => { img.src = avatar; });
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

    const userMenuButton = byId("userMenuButton");
    const profileModal = byId("profileModal");

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

    const userMenuButton = byId("userMenuButton");
    const profileModal = byId("profileModal");

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

    sessionStorage.clear();
    window.location.replace("../index.html");
  }

  function pointInsideRightPlate(event) {
    const button = byId("userMenuButton");
    if (!button || typeof event.clientX !== "number" || typeof event.clientY !== "number") return false;

    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    const padX = Math.max(18, rect.width * 0.06);
    const padY = Math.max(14, rect.height * 0.08);

    return (
      event.clientX >= rect.left - padX &&
      event.clientX <= rect.right + padX &&
      event.clientY >= rect.top - padY &&
      event.clientY <= rect.bottom + padY
    );
  }

  function isRightPlateTarget(event) {
    const target = event.target;
    if (target?.closest?.("#userMenuButton, .b116-panel--right")) return true;
    return pointInsideRightPlate(event);
  }

  function hardenRightPlate() {
    const button = byId("userMenuButton");
    if (!button) return;

    button.style.pointerEvents = "auto";
    button.style.cursor = "pointer";
    button.style.zIndex = "30001";
    button.style.display = "block";
    button.style.visibility = "visible";
    button.style.opacity = "1";
    button.setAttribute("data-profile-panel-version", PROFILE_VERSION);

    button.querySelectorAll("*").forEach((child) => {
      child.style.pointerEvents = "none";
    });
  }

  function bind() {
    hardenRightPlate();

    byId("userMenuButton")?.addEventListener("click", openProfile);
    byId("logoutButton")?.addEventListener("click", logout);

    document.querySelectorAll("[data-close-profile]").forEach((el) => {
      el.addEventListener("click", closeProfile);
    });

    ["pointerdown", "mousedown", "touchstart", "click"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (byId("profileModal")?.classList.contains("is-open")) return;
        if (isRightPlateTarget(event)) openProfile(event);
      }, true);
    });

    document.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && document.activeElement === byId("userMenuButton")) {
        openProfile(event);
        return;
      }

      if (event.key === "Escape" && byId("profileModal")?.classList.contains("is-open")) {
        closeProfile(event);
      }
    });
  }

  function init() {
    loadProfile();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.BastionProfilePanel = {
    version: PROFILE_VERSION,
    open: openProfile,
    close: closeProfile,
    reload: loadProfile
  };
})();
