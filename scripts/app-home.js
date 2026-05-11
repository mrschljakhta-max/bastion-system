(() => {
  const canvas = document.getElementById("appParticlesCanvas");
  const ctx = canvas?.getContext("2d");
  const sectorGroup = document.getElementById("sectorPaths");
  const labelsMount = document.getElementById("moduleLabels");
  const moduleDetail = document.getElementById("moduleDetail");
  const userMenuButton = document.getElementById("userMenuButton");
  const profileModal = document.getElementById("profileModal");
  const logoutButton = document.getElementById("logoutButton");

  const operatorName = document.getElementById("operatorName");
  const operatorRole = document.getElementById("operatorRole");
  const profileLogin = document.getElementById("profileLogin");
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");

  const iconBase = "../assets/icons/orbital/";

  const modules = [
    {
      id: "dicts",
      num: "01",
      icon: "dicts.svg",
      title: "Довідники",
      subtitle: "Dictionaries Core",
      href: "./dicts.html",
      items: ["Управління довідниками", "Еталонні дані", "Нормалізація", "Словники"]
    },
    {
      id: "upload",
      num: "02",
      icon: "upload.svg",
      title: "Завантаження",
      subtitle: "Upload / Intake",
      href: "./upload.html",
      items: ["Завантаження Word / Excel", "Імпорт даних", "Запуск ETL процесів"]
    },
    {
      id: "nodes",
      num: "03",
      icon: "nodes.svg",
      title: "Зв’язки / Вузли",
      subtitle: "Network / Nodes",
      href: "./nodes.html",
      items: ["Візуалізація зв’язків", "Граф залежностей", "Intelligence Network", "Вузли системи"]
    },
    {
      id: "calculator",
      num: "04",
      icon: "calculator.svg",
      title: "Калькулятор",
      subtitle: "Combat Calculator",
      href: "./calculator.html",
      items: ["Обчислення", "Комбінації", "Сумісність", "Бойові формули"]
    },
    {
      id: "analysis",
      num: "05",
      icon: "analysis.svg",
      title: "Аналіз",
      subtitle: "Analysis Engine",
      href: "./analysis.html",
      items: ["Дашборди", "Аналітика", "Карти та Heatmaps", "Статистика"]
    },
    {
      id: "command",
      num: "06",
      icon: "command.svg",
      title: "Висновки для командира",
      subtitle: "Command Intelligence",
      href: "./command.html",
      items: ["AI-рекомендації", "Оцінка ризиків", "Тактичні інсайти", "Critical Alerts"]
    }
  ];

  function getStoredUser() {
    const sessionUser = window.BastionAuth?.user || window.BastionAuth?.currentUser || null;
    return {
      login: localStorage.getItem("bastion_login") || sessionUser?.user_metadata?.login || sessionUser?.email || "",
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

  function setUserInfo() {
    const user = getStoredUser();
    const login = user.login || "Користувач";
    const role = user.role || "demo";
    if (operatorName) operatorName.textContent = login;
    if (operatorRole) operatorRole.textContent = role;
    if (profileLogin) profileLogin.textContent = login;
    if (profileEmail) profileEmail.textContent = user.email || "email не визначено";
    if (profileRole) profileRole.textContent = role;
  }

  function polarToCartesian(cx, cy, radius, angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
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

  function buildOrbitalMenu() {
    if (!sectorGroup || !labelsMount) return;

    const cx = 500;
    const cy = 500;
    const innerR = 212;
    const outerR = 438;
    const gap = 5;
    const labelR = 327;
    const push = 20;

    sectorGroup.innerHTML = "";
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
      link.setAttribute("class", "sector-link");
      link.style.setProperty("--sector-tx", `${dx * 16}px`);
      link.style.setProperty("--sector-ty", `${dy * 16}px`);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", sectorPath(cx, cy, innerR, outerR, start, end));
      path.setAttribute("class", "sector-path");
      path.setAttribute("data-id", module.id);
      link.appendChild(path);
      sectorGroup.appendChild(link);

      const labelPos = polarToCartesian(cx, cy, labelR, mid);
      const label = document.createElement("a");
      label.className = "module-label";
      label.href = module.href;
      label.dataset.id = module.id;
      label.style.left = `${labelPos.x / 10}%`;
      label.style.top = `${labelPos.y / 10}%`;
      label.style.setProperty("--label-tx", `${dx * push}px`);
      label.style.setProperty("--label-ty", `${dy * push}px`);
      label.innerHTML = `
        <span class="num">${module.num}</span>
        <img class="module-icon" src="${iconBase}${module.icon}?v=49" alt="" />
        <strong>${module.title}</strong>
      `;
      labelsMount.appendChild(label);
    });

    const interactive = [...document.querySelectorAll("[data-id]")];
    interactive.forEach((el) => {
      el.addEventListener("mouseenter", () => activateModule(el.dataset.id));
      el.addEventListener("mouseleave", () => activateModule(null));
      el.addEventListener("focus", () => activateModule(el.dataset.id));
      el.addEventListener("blur", () => activateModule(null));
    });
  }

  function activateModule(id) {
    document.querySelectorAll(".sector-path, .module-label").forEach((el) => {
      el.classList.toggle("is-active", !!id && el.dataset.id === id);
    });

    if (!moduleDetail) return;

    if (!id) {
      moduleDetail.classList.remove("is-visible");
      return;
    }

    const module = modules.find((item) => item.id === id);
    const label = document.querySelector(`.module-label[data-id="${id}"]`);
    if (!module || !label) return;

    const stage = document.querySelector(".orbital-stage");
    const stageRect = stage.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();

    let left = labelRect.left - stageRect.left + labelRect.width / 2;
    let top = labelRect.top - stageRect.top + labelRect.height / 2;

    const centerX = stageRect.width / 2;
    const centerY = stageRect.height / 2;
    const vx = left - centerX;
    const vy = top - centerY;
    const len = Math.max(Math.hypot(vx, vy), 1);

    left += (vx / len) * 145;
    top += (vy / len) * 98;

    left = Math.max(130, Math.min(stageRect.width - 130, left));
    top = Math.max(72, Math.min(stageRect.height - 72, top));

    moduleDetail.style.left = `${left}px`;
    moduleDetail.style.top = `${top}px`;
    moduleDetail.innerHTML = `
      <b>${module.num} · ${module.subtitle}</b>
      <strong>${module.title}</strong>
      <ul>${module.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    `;
    moduleDetail.classList.add("is-visible");
  }

  function openProfile() {
    profileModal?.classList.add("is-open");
    profileModal?.setAttribute("aria-hidden", "false");
  }

  function closeProfile() {
    profileModal?.classList.remove("is-open");
    profileModal?.setAttribute("aria-hidden", "true");
  }

  async function logout() {
    try {
      const sb = window.BastionSupabase || window.supabaseClient || window.sb || null;
      if (sb?.auth?.signOut) await sb.auth.signOut();
    } catch (_) {}

    localStorage.removeItem("bastion_login");
    localStorage.removeItem("bastion_role");
    localStorage.removeItem("bastion_email");
    localStorage.removeItem("bastion_access_token");
    window.location.replace("../index.html");
  }

  function bindProfile() {
    userMenuButton?.addEventListener("click", openProfile);
    logoutButton?.addEventListener("click", logout);
    document.querySelectorAll("[data-close-profile]").forEach((el) => el.addEventListener("click", closeProfile));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeProfile();
    });
  }

  function bindMapDots() {
    document.querySelectorAll(".map-dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        const target = dot.dataset.target;
        document.querySelectorAll(".map-dot").forEach((item) => item.classList.toggle("is-active", item === dot));
        if (target === "core") {
          activateModule(null);
          return;
        }
        activateModule(target);
      });
    });
  }

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const particles = Array.from({ length: 58 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.8 + .35,
    vx: (Math.random() - .5) * .10,
    vy: -Math.random() * .20 - .03,
    a: Math.random() * .32 + .08
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
      glow.addColorStop(0, `rgba(255,42,46,${p.a})`);
      glow.addColorStop(1, "rgba(255,42,46,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(drawParticles);
  }

  function init() {
    if (!guardAccess()) return;
    setUserInfo();
    buildOrbitalMenu();
    bindProfile();
    bindMapDots();
    resize();
    drawParticles();
    window.addEventListener("resize", resize);
  }

  init();
})();
