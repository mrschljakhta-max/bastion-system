/* BASTION Profile Panel v204
   Opens profile command modal from the right HUD plate and performs logout.
   Fix: robust delegated click handler for HUD layers with pointer-events overrides.
*/
(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  const userMenuButton = byId("userMenuButton");
  const profileModal = byId("profileModal");
  const logoutButton = byId("logoutButton");
  const profileThemeStatus = byId("profileThemeStatus");
  const profileThemeToggle = byId("profileThemeToggle");

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
  const profileAvatarEditButton = byId("profileAvatarEditButton");
  const profileAvatarInput = byId("profileAvatarInput");
  const profileLoginInput = byId("profileLoginInput");
  const profileSaveLoginButton = byId("profileSaveLoginButton");
  const profileAccessComment = byId("profileAccessComment");
  const profileSubmitAccessButton = byId("profileSubmitAccessButton");
  const profileInlineStatus = byId("profileInlineStatus");
  const profileLoginPanel = byId("profileLoginPanel");
  const profileAccessPanel = byId("profileAccessPanel");
  const profileThemePanel = byId("profileThemePanel");

  const userAvatarTop = byId("userAvatarTop");
  const userAvatarModal = byId("userAvatarModal");
  const plateAvatarUser = document.querySelector(".plate-avatar-user");

  function safeText(value, fallback = "") {
    return String(value ?? fallback).replace(/[<>]/g, "").trim();
  }

  function normalizeRole(value) {
    return safeText(value || "DEMO", "DEMO").toUpperCase();
  }


  function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function getStoredTheme() {
    let theme = "dark";
    try {
      theme = localStorage.getItem("bastion_theme") || localStorage.getItem("bastion:start-theme") || "dark";
    } catch (error) {}
    return normalizeTheme(theme);
  }

  function applyTheme(theme, options = {}) {
    const nextTheme = normalizeTheme(theme);

    document.documentElement.setAttribute("data-theme", nextTheme);
    if (document.body) document.body.setAttribute("data-theme", nextTheme);

    try {
      localStorage.setItem("bastion_theme", nextTheme);
      localStorage.setItem("bastion:start-theme", nextTheme);
    } catch (error) {
      console.warn("[BASTION theme] localStorage unavailable:", error);
    }

    document.querySelectorAll("[data-profile-theme]").forEach((button) => {
      const isActive = button.dataset.profileTheme === nextTheme;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (profileThemeStatus) {
      profileThemeStatus.textContent = nextTheme === "light" ? "Обрана світла тема" : "Обрана темна тема";
    }

    if (profileThemeToggle) {
      profileThemeToggle.checked = nextTheme === "light";
      profileThemeToggle.setAttribute("aria-checked", String(nextTheme === "light"));
    }

    window.dispatchEvent(new CustomEvent("bastion:theme-change", { detail: { theme: nextTheme, source: options.source || "profile" } }));
  }

  function initThemeControls() {
    applyTheme(getStoredTheme(), { source: "profile-init" });
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

  function fitTextToBox(element, options = {}) {
    if (!element) return;

    const min = Number(options.min || 12);
    const max = Number(options.max || 42);
    const step = Number(options.step || 1);
    const parent = options.box || element.parentElement;
    if (!parent) return;

    element.style.fontSize = `${max}px`;
    element.classList.add("is-fit-text");

    const available = Math.max(40, parent.clientWidth - 2);
    let size = max;

    while (size > min && element.scrollWidth > available) {
      size -= step;
      element.style.fontSize = `${size}px`;
    }

    element.classList.toggle("is-overflowing", element.scrollWidth > available);
  }

  function fitProfileText() {
    requestAnimationFrame(() => {
      fitTextToBox(profileLogin, { min: 24, max: 58, step: 1 });
      fitTextToBox(profileLoginValue, { min: 13, max: 21, step: 1 });
      fitTextToBox(profileEmail, { min: 12, max: 21, step: 1 });
      fitTextToBox(profileRole, { min: 13, max: 21, step: 1 });
      fitTextToBox(profileSession, { min: 13, max: 21, step: 1 });

      document.querySelectorAll("[data-profile-fit]").forEach((element) => {
        if (![profileLogin, profileLoginValue, profileEmail, profileRole, profileSession].includes(element)) {
          fitTextToBox(element, { min: 11, max: 20, step: 1 });
        }
      });
    });
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
    el.setAttribute("title", value);
  }

  function applyProfile(profile = {}) {
    const login = safeText(profile.login || profile.nickname || "lavash.squad");
    const email = safeText(profile.email || "");
    const role = normalizeRole(profile.role || profile.access_level || "DEMO");
    const avatar = safeText(profile.avatar || profile.avatar_url || "");
    const emailLabel = email || "email не визначено";

    if (operatorName) operatorName.textContent = login;
    if (operatorRole) operatorRole.textContent = role;
    if (plateOperatorName) plateOperatorName.textContent = login;
    if (plateOperatorRole) plateOperatorRole.textContent = role;

    setText(profileLogin, login);
    setText(profileLoginValue, login);
    setText(profileEmail, emailLabel);
    setText(profileRole, role);
    setText(profileStatus, "ACTIVE");
    setText(profileSession, email ? "Захищена" : "Локальна");

    if (avatar) {
      if (userAvatarTop) userAvatarTop.src = avatar;
      if (userAvatarModal) userAvatarModal.src = avatar;
      if (plateAvatarUser) plateAvatarUser.src = avatar;
    }

    fitProfileText();
  }



  let profileTooltipEl = null;

  function ensureProfileTooltip() {
    if (profileTooltipEl) return profileTooltipEl;
    profileTooltipEl = document.createElement("div");
    profileTooltipEl.className = "profile-floating-tooltip";
    profileTooltipEl.setAttribute("role", "tooltip");
    document.body.appendChild(profileTooltipEl);
    return profileTooltipEl;
  }

  function showProfileTooltip(target) {
    const text = safeText(target?.dataset?.tooltip || target?.getAttribute?.("aria-label") || "");
    if (!text) return;

    const tooltip = ensureProfileTooltip();
    tooltip.textContent = text;

    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 10;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add("is-visible");
  }

  function hideProfileTooltip() {
    profileTooltipEl?.classList.remove("is-visible");
  }

  function bindProfileTooltips() {
    document.querySelectorAll("#profileModal [data-tooltip]").forEach((target) => {
      target.addEventListener("mouseenter", () => showProfileTooltip(target));
      target.addEventListener("mouseleave", hideProfileTooltip);
      target.addEventListener("focus", () => showProfileTooltip(target));
      target.addEventListener("blur", hideProfileTooltip);
    });
  }

  function setInlineStatus(message = "", tone = "info") {
    if (!profileInlineStatus) return;
    profileInlineStatus.textContent = message;
    profileInlineStatus.dataset.tone = tone;
  }

  function hideInlinePanels() {
    [profileLoginPanel, profileAccessPanel, profileThemePanel].forEach((panel) => {
      if (panel) panel.hidden = true;
    });
    document.querySelectorAll("[data-profile-panel]").forEach((button) => button.classList.remove("is-active"));
    setInlineStatus("");
  }

  function openInlinePanel(name) {
    let panel = profileLoginPanel;
    if (name === "access") panel = profileAccessPanel;
    if (name === "theme") panel = profileThemePanel;
    hideInlinePanels();

    if (panel) {
      panel.hidden = false;
      document.querySelector(`[data-profile-panel="${name}"]`)?.classList.add("is-active");
    }

    if (name === "login" && profileLoginInput) {
      profileLoginInput.value = profileLoginValue?.textContent?.trim() || "";
      setTimeout(() => profileLoginInput.focus(), 30);
    }

    if (name === "access") {
      const current = normalizeRole(profileRole?.textContent || "DEMO");
      const selected = document.querySelector(`input[name="profileAccessLevel"][value="${current}"]`) ||
        document.querySelector('input[name="profileAccessLevel"][value="OPERATOR"]');
      if (selected) selected.checked = true;
      setTimeout(() => profileAccessComment?.focus(), 30);
    }
  }

  function applyAvatarSource(src) {
    const avatar = safeText(src || "");
    if (!avatar) return;
    if (userAvatarTop) userAvatarTop.src = avatar;
    if (userAvatarModal) userAvatarModal.src = avatar;
    if (plateAvatarUser) plateAvatarUser.src = avatar;
  }

  async function getCurrentUserAndClient() {
    const sb = getSupabaseClient();
    if (!sb?.auth?.getUser) return { sb, user: null };
    try {
      const { data, error } = await sb.auth.getUser();
      return { sb, user: error ? null : data?.user || null };
    } catch (error) {
      console.warn("[BASTION profile-panel] auth user failed:", error);
      return { sb, user: null };
    }
  }

  async function handleAvatarFile(file) {
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type || "")) {
      setInlineStatus("Підтримуються PNG, JPG або WEBP.", "error");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setInlineStatus("Файл завеликий. Максимум — 5 MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;

      try {
        localStorage.setItem("bastion_profile_avatar", dataUrl);
      } catch (error) {
        console.warn("[BASTION profile-panel] avatar local save failed:", error);
      }

      applyAvatarSource(dataUrl);
      setInlineStatus("Аватарку оновлено локально.", "success");
    };

    reader.onerror = () => setInlineStatus("Не вдалося прочитати файл аватарки.", "error");
    reader.readAsDataURL(file);
  }

  async function saveLogin() {
    const nextLogin = safeText(profileLoginInput?.value || "");
    if (nextLogin.length < 3) {
      setInlineStatus("Логін має містити щонайменше 3 символи.", "error");
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(nextLogin)) {
      setInlineStatus("Дозволені латинські літери, цифри, крапка, дефіс і нижнє підкреслення.", "error");
      return;
    }

    try {
      localStorage.setItem("bastion_profile_nickname", nextLogin);
      localStorage.setItem("bastion_login", nextLogin);
    } catch (error) {
      console.warn("[BASTION profile-panel] login local save failed:", error);
    }

    const currentEmail = safeText(profileEmail?.textContent || localStorage.getItem("bastion_email") || "");
    const currentRole = normalizeRole(profileRole?.textContent || localStorage.getItem("bastion_role") || "DEMO");
    applyProfile({
      login: nextLogin,
      email: currentEmail === "email не визначено" ? "" : currentEmail,
      role: currentRole,
      avatar: localStorage.getItem("bastion_profile_avatar") || ""
    });

    const { sb, user } = await getCurrentUserAndClient();
    if (sb?.from && user?.id) {
      try {
        await sb.from("profiles").upsert({
          id: user.id,
          email: user.email || currentEmail || null,
          nickname: nextLogin,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });
      } catch (error) {
        console.warn("[BASTION profile-panel] Supabase nickname update failed:", error);
      }
    }

    setInlineStatus("Логін оновлено.", "success");
    setTimeout(hideInlinePanels, 700);
  }

  async function submitAccessRequest() {
    const selected = document.querySelector('input[name="profileAccessLevel"]:checked');
    const requestedLevel = normalizeRole(selected?.value || "");
    const currentLevel = normalizeRole(profileRole?.textContent || "DEMO");
    const comment = safeText(profileAccessComment?.value || "");

    if (!requestedLevel) {
      setInlineStatus("Оберіть бажаний рівень доступу.", "error");
      return;
    }

    if (requestedLevel === currentLevel) {
      setInlineStatus("Цей рівень доступу вже активний.", "error");
      return;
    }

    const email = safeText(profileEmail?.textContent || localStorage.getItem("bastion_email") || "");
    const login = safeText(profileLoginValue?.textContent || localStorage.getItem("bastion_login") || "");

    try {
      const pending = JSON.parse(localStorage.getItem("bastion_access_requests") || "[]");
      pending.push({
        login,
        email,
        current_level: currentLevel,
        requested_level: requestedLevel,
        comment,
        status: "pending",
        created_at: new Date().toISOString()
      });
      localStorage.setItem("bastion_access_requests", JSON.stringify(pending.slice(-20)));
    } catch (error) {
      console.warn("[BASTION profile-panel] access request local save failed:", error);
    }

    const { sb, user } = await getCurrentUserAndClient();
    if (sb?.from) {
      try {
        await sb.from("access_requests").insert({
          user_id: user?.id || null,
          email: email && email !== "email не визначено" ? email : user?.email || null,
          login: login || null,
          current_level: currentLevel,
          requested_level: requestedLevel,
          comment: comment || null,
          status: "pending",
          created_at: new Date().toISOString()
        });
      } catch (error) {
        console.warn("[BASTION profile-panel] Supabase access request insert failed:", error);
      }
    }

    setInlineStatus(`Заявку на рівень ${requestedLevel} підготовлено.`, "success");
    if (profileAccessComment) profileAccessComment.value = "";
    setTimeout(hideInlinePanels, 950);
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

  function ensureProfileInBody() {
    if (profileModal && profileModal.parentElement !== document.body) {
      document.body.appendChild(profileModal);
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

    ensureProfileInBody();
    profileModal.classList.add("is-open");
    profileModal.setAttribute("aria-hidden", "false");
    userMenuButton?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("profile-modal-lock");
    document.body.classList.add("profile-modal-open");
    hideInlinePanels();
    fitProfileText();
  }

  function closeProfile(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    hideProfileTooltip();
    profileModal?.classList.remove("is-open");
    profileModal?.setAttribute("aria-hidden", "true");
    userMenuButton?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("profile-modal-lock");
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

  function bind() {
    if (!userMenuButton) {
      console.warn("[BASTION profile-panel] #userMenuButton not found");
    }

    userMenuButton?.addEventListener("click", openProfile);

    /* Delegated fallback: works even if HUD child layers or future markup catch the click. */
    document.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("#userMenuButton, .b116-panel--right");
      if (trigger) openProfile(event);
    }, true);

    profileAvatarEditButton?.addEventListener("click", (event) => {
      hideProfileTooltip();
      event.preventDefault();
      event.stopPropagation();
      profileAvatarInput?.click();
    });

    profileAvatarInput?.addEventListener("change", (event) => {
      const file = event.target?.files?.[0];
      handleAvatarFile(file);
      if (profileAvatarInput) profileAvatarInput.value = "";
    });

    document.querySelectorAll("[data-profile-panel]").forEach((button) => {
      button.addEventListener("click", (event) => {
        hideProfileTooltip();
        event.preventDefault();
        event.stopPropagation();
        openInlinePanel(button.dataset.profilePanel);
      });
    });

    document.querySelectorAll("[data-profile-panel-close]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideInlinePanels();
      });
    });


    profileSaveLoginButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveLogin();
    });

    profileLoginInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveLogin();
    });

    profileSubmitAccessButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      submitAccessRequest();
    });

    logoutButton?.addEventListener("click", (event) => {
      hideProfileTooltip();
      logout(event);
    });

    profileThemeToggle?.addEventListener("change", (event) => {
      hideProfileTooltip();
      event.stopPropagation();
      applyTheme(profileThemeToggle.checked ? "light" : "dark", { source: "profile-toggle" });
    });

    document.querySelectorAll("[data-profile-theme]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyTheme(button.dataset.profileTheme, { source: "profile-click" });
      });
    });

    document.querySelectorAll("[data-close-profile]").forEach((el) => {
      el.addEventListener("click", closeProfile);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && profileModal?.classList.contains("is-open")) {
        closeProfile(event);
      }
    });

    window.addEventListener("resize", fitProfileText, { passive: true });
  }

  initThemeControls();
  loadProfile();
  bind();
  bindProfileTooltips();

  window.BastionProfilePanel = {
    open: openProfile,
    close: closeProfile,
    reload: loadProfile,
    applyTheme,
    getTheme: getStoredTheme
  };
})();
