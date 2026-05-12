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
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");
  const iconBase = "../assets/icons/orbital/";

  const modules = [
    { id: "dicts", num: "01", icon: "dicts.svg", title: "Довідники", subtitle: "Dictionaries Core", href: "./dicts.html", items: ["Управління довідниками", "Еталонні дані", "Нормалізація", "Словники"] },
    { id: "upload", num: "02", icon: "upload.svg", title: "Завантаження", subtitle: "Upload / Intake", href: "./upload.html", items: ["Завантаження Word / Excel", "Імпорт даних", "Запуск ETL процесів"] },
    { id: "nodes", num: "03", icon: "nodes.svg", title: "Зв’язки / Вузли", subtitle: "Network / Nodes", href: "./nodes.html", items: ["Візуалізація зв’язків", "Граф залежностей", "Intelligence Network", "Вузли системи"] },
    { id: "calculator", num: "04", icon: "calculator.svg", title: "Калькулятор", subtitle: "Combat Calculator", href: "./calculator.html", items: ["Обчислення", "Комбінації", "Сумісність", "Бойові формули"] },
    { id: "analysis", num: "05", icon: "analysis.svg", title: "Аналіз", subtitle: "Analysis Engine", href: "./analysis.html", items: ["Дашборди", "Аналітика", "Карти та Heatmaps", "Статистика"] },
    { id: "command", num: "06", icon: "command.svg", title: "Висновки для командира", subtitle: "Command Intelligence", href: "./command.html", items: ["AI-рекомендації", "Оцінка ризиків", "Тактичні інсайти", "Critical Alerts"] }
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
    const labelR = 326;
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

      label.innerHTML = `
        <img class="sector-label-art" src="../assets/ui/sectors/sector-${module.num}.svg?v=68" alt="${module.num} ${module.title}" />
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

    if (!floatingDetail) return;

    if (!id) {
      floatingDetail.classList.remove("is-visible");
      return;
    }

    const module = modules.find((item) => item.id === id);
    const label = document.querySelector(`.module-label[data-id="${id}"]`);
    const stage = document.querySelector(".orbital-menu");

    if (!module || !label || !stage) return;

    const stageRect = stage.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();

    let left = labelRect.left - stageRect.left + labelRect.width / 2;
    let top = labelRect.top - stageRect.top + labelRect.height / 2;

    const centerX = stageRect.width / 2;
    const centerY = stageRect.height / 2;
    const vx = left - centerX;
    const vy = top - centerY;
    const length = Math.max(Math.hypot(vx, vy), 1);

    left += (vx / length) * 146;
    top += (vy / length) * 98;

    left = Math.max(135, Math.min(stageRect.width - 135, left));
    top = Math.max(76, Math.min(stageRect.height - 76, top));

    floatingDetail.style.left = `${left}px`;
    floatingDetail.style.top = `${top}px`;

    floatingDetail.innerHTML = `
      <b>${module.num} · ${module.subtitle}</b>
      <strong>${module.title}</strong>
      <ul>${module.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    `;

    floatingDetail.classList.add("is-visible");
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

      if (sb?.auth?.signOut) {
        await sb.auth.signOut();
      }
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
          return;
        }

        activateModule(target);
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
    if (!svg) return;

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

  function init() {
    if (!guardAccess()) return;

    injectBeamGradient();
    setUserInfo();
    buildOrbitalMenu();
    bindProfile();
    bindMapDots();
    resizeCanvas();
    drawParticles();

    window.addEventListener("resize", resizeCanvas);
  }

  init();
})();
