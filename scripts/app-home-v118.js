(() => {
  const canvas = document.getElementById("particlesCanvas");
  const ctx = canvas?.getContext("2d");
  const sectorGroup = document.getElementById("sectorPaths");
  const energyBeams = document.getElementById("energyBeams");
  const labelsMount = document.getElementById("moduleLabels");
  const floatingDetail = document.getElementById("floatingDetail");
  const userMenuButton = document.getElementById("userMenuButton");
  const profileModal = document.getElementById("profileModal");
  const logoutButton = document.getElementById("logoutButton");
  const operatorName = document.getElementById("operatorName");
  const operatorRole = document.getElementById("operatorRole");
  const profileLogin = document.getElementById("profileLogin");
  const profileLoginValue = document.getElementById("profileLoginValue");
  const profileStatus = document.getElementById("profileStatus");
  const profileSession = document.getElementById("profileSession");
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");
  const profileNicknameInput = document.getElementById("profileNicknameInput");
  const profileAvatarInput = document.getElementById("profileAvatarInput");
  const saveProfileButton = document.getElementById("saveProfileButton");
  const userAvatarTop = document.getElementById("userAvatarTop");
  const userAvatarModal = document.getElementById("userAvatarModal");
  const plateOperatorName = document.getElementById("plateOperatorName");
  const plateOperatorRole = document.getElementById("plateOperatorRole");
  const plateAvatarUser = document.querySelector(".plate-avatar-user");
  const iconBase = "../assets/icons/orbital/";

  const modules = [
    { id: "dicts", num: "01", icon: "dicts.svg", title: "Довідники", subtitle: "Dictionaries Core", href: "./dicts.html", items: ["Управління довідниками", "Еталонні дані", "Нормалізація", "Словники"] },
    { id: "nodes", num: "02", icon: "nodes.svg", title: "Зв’язки", subtitle: "Network / Nodes", href: "./nodes.html", items: ["Візуалізація зв’язків", "Граф залежностей", "Intelligence Network", "Вузли системи"] },
    { id: "upload", num: "03", icon: "upload.svg", title: "Завантаження", subtitle: "Upload / Intake", href: "./upload.html", items: ["Завантаження Word / Excel", "Імпорт даних", "Запуск ETL процесів"] },
    { id: "calculator", num: "04", icon: "calculator.svg", title: "Калькулятор", subtitle: "Combat Calculator", href: "./calculator.html", items: ["Обчислення", "Комбінації", "Сумісність", "Бойові формули"] },
    { id: "analysis", num: "05", icon: "analysis.svg", title: "Аналіз", subtitle: "Analysis Engine", href: "./analysis.html", items: ["Дашборди", "Аналітика", "Карти та Heatmaps", "Статистика"] },
    { id: "command", num: "06", icon: "command.svg", title: "Висновки", subtitle: "Command Intelligence", href: "./command.html", items: ["AI-рекомендації", "Оцінка ризиків", "Тактичні інсайти", "Critical Alerts"] }
  ];

  function getStoredUser() {
    const sessionUser = window.BastionAuth?.user || window.BastionAuth?.currentUser || null;

    return {
      login: localStorage.getItem("bastion_profile_nickname") || localStorage.getItem("bastion_login") || sessionUser?.user_metadata?.login || sessionUser?.email || "",
      role: localStorage.getItem("bastion_role") || sessionUser?.user_metadata?.role || "demo",
      email: localStorage.getItem("bastion_email") || sessionUser?.email || ""
    };
  }

  function guardAccess() {
    const user = getStoredUser();

    if (!user.login && !user.email) {
      window.location.replace("../index.html");
      return false;
    }

    return true;
  }

  function safeText(value, fallback = "") {
    return String(value ?? fallback).replace(/[<>]/g, "").trim();
  }

  function normalizeRole(value) {
    return safeText(value || "DEMO", "DEMO").toUpperCase();
  }

  function applyProfileToHud(profile, authUser) {
    const email = safeText(profile?.email || authUser?.email || localStorage.getItem("bastion_email") || "");
    const fallbackLogin = safeText(localStorage.getItem("bastion_profile_nickname") || localStorage.getItem("bastion_login") || email?.split("@")?.[0] || "lavash.squad");
    const nickname = safeText(profile?.nickname || fallbackLogin || "lavash.squad").slice(0, 32);
    const role = normalizeRole(profile?.access_level || localStorage.getItem("bastion_role") || "DEMO");
    const avatarUrl = safeText(profile?.avatar_url || localStorage.getItem("bastion_profile_avatar") || "");

    if (operatorName) operatorName.textContent = nickname;
    if (operatorRole) operatorRole.textContent = role;

    if (plateOperatorName) plateOperatorName.textContent = nickname;
    if (plateOperatorRole) plateOperatorRole.textContent = role;

    if (profileLogin) profileLogin.textContent = nickname;
    if (profileLoginValue) profileLoginValue.textContent = nickname;
    if (profileEmail) profileEmail.textContent = email || "email не визначено";
    if (profileRole) profileRole.textContent = role;
    if (profileStatus) profileStatus.textContent = "ACTIVE";
    if (profileSession) profileSession.textContent = email ? "Захищена" : "Локальна";
    if (profileNicknameInput) profileNicknameInput.value = nickname;

    if (avatarUrl) {
      if (userAvatarTop) userAvatarTop.src = avatarUrl;
      if (userAvatarModal) userAvatarModal.src = avatarUrl;
      if (plateAvatarUser) plateAvatarUser.src = avatarUrl;
    }
  }

  async function setUserInfo() {
    const localUser = getStoredUser();

    applyProfileToHud({
      email: localUser.email,
      nickname: localStorage.getItem("bastion_profile_nickname") || localUser.login || "lavash.squad",
      access_level: localUser.role || "DEMO",
      avatar_url: localStorage.getItem("bastion_profile_avatar") || ""
    }, null);

    const sb = window.BastionSupabase || window.supabaseClient || window.sb || null;
    if (!sb?.auth?.getUser) return;

    try {
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError || !authData?.user) return;

      const authUser = authData.user;

      const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("id,email,nickname,access_level,avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.warn("[BASTION profile] Не вдалося отримати profiles:", profileError);
        applyProfileToHud({ email: authUser.email }, authUser);
        return;
      }

      applyProfileToHud(profile || { email: authUser.email }, authUser);
    } catch (error) {
      console.warn("[BASTION profile] Помилка профілю:", error);
    }
  }

  function polarToCartesian(cx, cy, radius, angle) {
    const rad = (angle - 90) * Math.PI / 180;

    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  }

  function sectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
    const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
    const startInner = polarToCartesian(cx, cy, innerR, endAngle);
    const endInner = polarToCartesian(cx, cy, innerR, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", startOuter.x, startOuter.y,
      "A", outerR, outerR, 0, largeArc, 1, endOuter.x, endOuter.y,
      "L", startInner.x, startInner.y,
      "A", innerR, innerR, 0, largeArc, 0, endInner.x, endInner.y,
      "Z"
    ].join(" ");
  }


  function beamPath(cx, cy, innerR, outerR, angle) {
    const p1 = polarToCartesian(cx, cy, innerR, angle);
    const p2 = polarToCartesian(cx, cy, outerR, angle);

    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }

  function buildOrbitalMenu() {
    if (!sectorGroup || !labelsMount) return;

    const cx = 500;
    const cy = 500;
    const innerR = 214;
    const outerR = 438;
    const gap = 5;
    const labelR = 318;
    const push = 22;

    sectorGroup.innerHTML = "";
    if (energyBeams) energyBeams.innerHTML = "";
    labelsMount.innerHTML = "";

    modules.forEach((module, index) => {
      const start = index * 60 + gap / 2;
      const end = (index + 1) * 60 - gap / 2;
      const mid = (start + end) / 2;

      const rad = (mid - 90) * Math.PI / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);

      const link = document.createElementNS("http://www.w3.org/2000/svg", "a");
      link.setAttribute("href", module.href);
      link.setAttribute("data-id", module.id);
      link.setAttribute("aria-label", module.title);
      link.setAttribute("class", `sector-link sector-${module.num}`);
      link.style.setProperty("--sector-tx", `${dx * 18}px`);
      link.style.setProperty("--sector-ty", `${dy * 18}px`);

      const underGlow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      underGlow.setAttribute("d", sectorPath(cx, cy, innerR + 6, outerR - 6, start + 1.2, end - 1.2));
      underGlow.setAttribute("class", "sector-under-glow");
      underGlow.setAttribute("data-id", module.id);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", sectorPath(cx, cy, innerR, outerR, start, end));
      path.setAttribute("class", "sector-path");
      path.setAttribute("data-id", module.id);

      const edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
      edge.setAttribute("d", sectorPath(cx, cy, innerR + 8, outerR - 8, start + 1.8, end - 1.8));
      edge.setAttribute("class", "sector-edge");
      edge.setAttribute("data-id", module.id);

      const scan = document.createElementNS("http://www.w3.org/2000/svg", "path");
      scan.setAttribute("d", sectorPath(cx, cy, innerR + 36, outerR - 34, start + 9, end - 9));
      scan.setAttribute("class", "sector-scan");
      scan.setAttribute("data-id", module.id);

      const sheen = document.createElementNS("http://www.w3.org/2000/svg", "path");
      sheen.setAttribute("d", sectorPath(cx, cy, innerR + 18, outerR - 18, start + 4, end - 4));
      sheen.setAttribute("class", "sector-sheen");
      sheen.setAttribute("data-id", module.id);

      link.appendChild(underGlow);
      link.appendChild(path);
      link.appendChild(scan);
      link.appendChild(edge);
      link.appendChild(sheen);
      sectorGroup.appendChild(link);

      if (energyBeams) {
        const beam = document.createElementNS("http://www.w3.org/2000/svg", "path");
        beam.setAttribute("d", beamPath(cx, cy, 160, 446, mid));
        beam.setAttribute("class", "sector-beam");
        beam.setAttribute("data-id", module.id);
        energyBeams.appendChild(beam);
      }

      const labelPos = polarToCartesian(cx, cy, labelR, mid);
      const label = document.createElement("a");

      label.className = "module-label";
      label.href = module.href;
      label.dataset.id = module.id;
      label.style.left = `${labelPos.x / 10}%`;
      label.style.top = `${labelPos.y / 10}%`;
      label.style.setProperty("--label-tx", `${dx * push}px`);
      label.style.setProperty("--label-ty", `${dy * push}px`);

      const isBottomFlip = module.num === "03" || module.num === "04";
      label.classList.toggle("is-bottom-flip", isBottomFlip);

      const numberImg = `<img class="sector-number-art" src="../assets/ui/sector-numbers/sector-${module.num}.svg?v=88" alt="" />`;
      const titleText = `<span class="sector-title-text">${module.title}</span>`;
      const divider = `<span class="sector-art-divider"></span>`;

      label.innerHTML = `
        <span class="sector-art-stack" aria-hidden="true">
          ${isBottomFlip ? `${titleText}${divider}${numberImg}` : `${numberImg}${divider}${titleText}`}
        </span>
        <span class="sr-only">${module.num} ${module.title}</span>
      `;

      labelsMount.appendChild(label);
    });

    document.querySelectorAll(".sector-link, .module-label").forEach((el) => {
      el.addEventListener("mouseenter", () => activateModule(el.dataset.id));
      el.addEventListener("mouseleave", () => activateModule(null));
      el.addEventListener("focus", () => activateModule(el.dataset.id));
      el.addEventListener("blur", () => activateModule(null));
    });
  }

  function activateModule(id) {
    document.body.dataset.activeModule = id || "";

    document.querySelectorAll(".sector-link, .sector-path, .sector-under-glow, .sector-sheen, .sector-edge, .sector-scan, .sector-beam, .module-label").forEach((el) => {
      el.classList.toggle("is-active", !!id && el.dataset.id === id);
    });

    // v69: tooltip/detail card disabled by design. Hover only activates sector movement/glow/text.
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

      if (sb?.auth?.signOut) {
        await sb.auth.signOut();
      }
    } catch (_) {}

    localStorage.removeItem("bastion_login");
    localStorage.removeItem("bastion_role");
    localStorage.removeItem("bastion_email");
    localStorage.removeItem("bastion_access_token");
    localStorage.removeItem("bastion_profile_nickname");
    localStorage.removeItem("bastion_profile_avatar");

    window.location.replace("../index.html");
  }

  function bindProfile() {
    userMenuButton?.addEventListener("click", openProfile);
    logoutButton?.addEventListener("click", logout);

    saveProfileButton?.addEventListener("click", async () => {
      const nickname = safeText(profileNicknameInput?.value || "").slice(0, 32);
      if (nickname.length >= 3) {
        localStorage.setItem("bastion_profile_nickname", nickname);
        if (operatorName) operatorName.textContent = nickname;
        if (plateOperatorName) plateOperatorName.textContent = nickname;

        const sb = window.BastionSupabase || window.supabaseClient || window.sb || null;
        try {
          const { data: authData } = await sb?.auth?.getUser?.() || {};
          const userId = authData?.user?.id;
          if (userId && sb?.from) {
            const { error } = await sb
              .from("profiles")
              .update({ nickname, updated_at: new Date().toISOString() })
              .eq("id", userId);

            if (error) console.warn("[BASTION profile] Не вдалося зберегти nickname:", error);
          }
        } catch (error) {
          console.warn("[BASTION profile] Помилка збереження nickname:", error);
        }
      }
      closeProfile();
    });

    profileAvatarInput?.addEventListener("change", () => {
      const file = profileAvatarInput.files?.[0];
      if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        localStorage.setItem("bastion_profile_avatar", dataUrl);
        if (userAvatarTop) userAvatarTop.src = dataUrl;
        if (userAvatarModal) userAvatarModal.src = dataUrl;
        if (plateAvatarUser) plateAvatarUser.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    document.querySelectorAll("[data-close-profile]").forEach((el) => {
      el.addEventListener("click", closeProfile);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeProfile();
    });
  }

  function bindMapDots() {
    document.querySelectorAll(".map-dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        const target = dot.dataset.target;

        document.querySelectorAll(".map-dot").forEach((item) => {
          item.classList.toggle("is-active", item === dot);
        });

        if (target === "core") {
          activateModule(null);
          window.location.href = "./app.html";
          return;
        }

        const pageMap = {
          dicts: "./dicts.html",
          upload: "./upload.html",
          nodes: "./nodes.html",
          calculator: "./calculator.html",
          analysis: "./analysis.html",
          command: "./command.html"
        };

        activateModule(target);
        if (pageMap[target]) window.location.href = pageMap[target];
      });
    });
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const particles = Array.from({ length: 38 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.15 + .2,
    vx: (Math.random() - .5) * .06,
    vy: -Math.random() * .10 - .012,
    a: Math.random() * .18 + .04
  }));

  function drawParticles() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = "lighter";

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -20) {
        p.y = window.innerHeight + 20;
        p.x = Math.random() * window.innerWidth;
      }

      if (p.x < -20) p.x = window.innerWidth + 20;
      if (p.x > window.innerWidth + 20) p.x = -20;

      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);

      glow.addColorStop(0, `rgba(255, 51, 56, ${p.a})`);
      glow.addColorStop(1, "rgba(255, 51, 56, 0)");

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(drawParticles);
  }

  function injectBeamGradient() {
    const svg = document.querySelector(".beam-layer");
    if (!svg || svg.querySelector("#beamGradient")) return;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(255,51,56,0)" />
        <stop offset="35%" stop-color="rgba(255,51,56,.12)" />
        <stop offset="50%" stop-color="rgba(255,120,120,.85)" />
        <stop offset="65%" stop-color="rgba(255,51,56,.12)" />
        <stop offset="100%" stop-color="rgba(255,51,56,0)" />
      </linearGradient>
    `;
    svg.prepend(defs);
  }



  function bindHudPointer() {
    let raf = 0;
    let lastEvent = null;

    const update = () => {
      raf = 0;
      if (!lastEvent) return;
      const x = Math.round((lastEvent.clientX / Math.max(window.innerWidth, 1)) * 100);
      const y = Math.round((lastEvent.clientY / Math.max(window.innerHeight, 1)) * 100);
      document.body.style.setProperty("--mx", `${x}%`);
      document.body.style.setProperty("--my", `${y}%`);
    };

    window.addEventListener("pointermove", (event) => {
      lastEvent = event;
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
  }

  function init() {
    if (!guardAccess()) return;

    injectBeamGradient();
    setUserInfo();
    buildOrbitalMenu();
    bindProfile();
    bindMapDots();
    bindHudPointer();
    resizeCanvas();
    drawParticles();

    window.addEventListener("resize", resizeCanvas);
  }

  init();
})();
