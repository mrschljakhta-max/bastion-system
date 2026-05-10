(() => {
  const root = document.documentElement;
  const card = document.getElementById("setupCard");
  const password = document.getElementById("password");
  const login = document.getElementById("login");
  const strengthCore = document.getElementById("strengthCore");
  const strengthLabel = document.getElementById("strengthLabel");
  const secureBadge = document.getElementById("secureBadge");
  const submitBtn = document.querySelector(".submit-btn");
  const statusLine = document.getElementById("statusLine");
  const canvas = document.getElementById("particlesCanvas");
  const ctx = canvas?.getContext("2d");

  const rules = {
    length: document.querySelector('[data-rule="length"]'),
    letter: document.querySelector('[data-rule="letter"]'),
    digit: document.querySelector('[data-rule="digit"]'),
    special: document.querySelector('[data-rule="special"]'),
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let targetBgX = 50;
  let targetBgY = 50;
  let currentBgX = 50;
  let currentBgY = 50;

  function setMouseVars(event) {
    const xRatio = event.clientX / window.innerWidth;
    const yRatio = event.clientY / window.innerHeight;
    const x = xRatio * 100;
    const y = yRatio * 100;

    root.style.setProperty("--mx", `${x}%`);
    root.style.setProperty("--my", `${y}%`);

    targetBgX = 50 + (xRatio - 0.5) * 1.6;
    targetBgY = 50 + (yRatio - 0.5) * 1.0;

    if (card) {
      const rect = card.getBoundingClientRect();
      const cx = ((event.clientX - rect.left) / rect.width) * 100;
      const cy = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--card-x", `${cx}%`);
      card.style.setProperty("--card-y", `${cy}%`);
    }
  }

  function animateScene() {
    if (!prefersReducedMotion) {
      currentBgX += (targetBgX - currentBgX) * 0.035;
      currentBgY += (targetBgY - currentBgY) * 0.035;
      root.style.setProperty("--bg-x", `${currentBgX.toFixed(2)}%`);
      root.style.setProperty("--bg-y", `${currentBgY.toFixed(2)}%`);
    }

    requestAnimationFrame(animateScene);
  }

  if (!prefersReducedMotion) {
    window.addEventListener("pointermove", setMouseVars, { passive: true });
    animateScene();
  }

  function scorePassword(value) {
    const checks = {
      length: value.length >= 8,
      letter: /[a-zA-ZА-Яа-яІіЇїЄєҐґ]/.test(value),
      digit: /\d/.test(value),
      special: /[^a-zA-ZА-Яа-яІіЇїЄєҐґ\d\s]/.test(value),
      long: value.length >= 12,
    };

    let score = 0;
    if (checks.length) score += 1;
    if (checks.letter) score += 1;
    if (checks.digit) score += 1;
    if (checks.special) score += 1;
    if (checks.long) score += 1;

    return { score, checks };
  }

  function updateStrength() {
    if (!password || !strengthCore || !strengthLabel) return;

    const value = password.value || "";
    const { score, checks } = scorePassword(value);

    Object.entries(rules).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("is-ok", Boolean(checks[key]));
      el.textContent = `${checks[key] ? "●" : "◎"} ${labelForRule(key)}`;
    });

    const level = value.length ? Math.max(1, Math.min(5, score)) : 0;
    strengthCore.dataset.level = String(level);
    strengthCore.classList.remove("is-scanning");
    void strengthCore.offsetWidth;
    strengthCore.classList.add("is-scanning");

    const labelMap = {
      0: "ОЧІКУЄТЬСЯ",
      1: "СЛАБКИЙ",
      2: "БАЗОВИЙ",
      3: "НОРМАЛЬНИЙ",
      4: "СИЛЬНИЙ",
      5: "БОЙОВИЙ",
    };

    strengthLabel.textContent = labelMap[level];

    const isReady = Boolean(login?.value.trim()) && level >= 4;
    card?.classList.toggle("is-strong", level >= 4);
    secureBadge?.classList.toggle("is-ready", isReady);
    submitBtn?.classList.toggle("is-ready", isReady);

    if (statusLine) {
      statusLine.textContent = isReady
        ? "ACCESS READY. Логін і пароль відповідають базовим вимогам безпеки."
        : "Створіть логін і пароль для вашого акаунта. Використовуйте комбінацію літер і цифр.";
    }
  }

  function labelForRule(key) {
    return {
      length: "Мін. 8 символів",
      letter: "Літера",
      digit: "Цифра",
      special: "Спецсимвол",
    }[key] || key;
  }

  password?.addEventListener("input", updateStrength);
  login?.addEventListener("input", updateStrength);

  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target || "password";
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "◉" : "⊘";
    });
  });

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const particles = [];
  const particleCount = 160;

  function createParticle(fromBottom = false) {
    const typeRoll = Math.random();
    const isSoft = typeRoll > 0.72;
    const isBright = typeRoll < 0.20;

    return {
      x: Math.random() * window.innerWidth,
      y: fromBottom ? window.innerHeight + Math.random() * 130 : Math.random() * window.innerHeight,
      r: isSoft ? Math.random() * 5 + 2.2 : Math.random() * 1.9 + 0.45,
      vx: (Math.random() - 0.38) * (isSoft ? 0.18 : 0.55),
      vy: -(Math.random() * (isSoft ? 0.35 : 0.95) + (isBright ? 0.35 : 0.12)),
      a: isSoft ? Math.random() * 0.12 + 0.05 : Math.random() * 0.55 + 0.16,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.04,
      flicker: Math.random() * Math.PI * 2,
      bright: isBright,
      soft: isSoft,
    };
  }

  for (let i = 0; i < particleCount; i += 1) {
    particles.push(createParticle(false));
  }

  function animateParticles() {
    if (!canvas || !ctx || prefersReducedMotion) return;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      p.x += p.vx + Math.sin(p.spin) * 0.05;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      p.flicker += 0.045;

      if (p.y < -40 || p.x > window.innerWidth + 80 || p.x < -80) {
        Object.assign(p, createParticle(true));
      }

      const flickerAlpha = p.a * (0.72 + Math.sin(p.flicker) * 0.28);
      const radius = p.soft ? p.r * 8 : p.r * (p.bright ? 7 : 4.5);

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, p.bright ? `rgba(255, 95, 95, ${flickerAlpha})` : `rgba(255, 42, 80, ${flickerAlpha})`);
      gradient.addColorStop(0.35, `rgba(255, 20, 70, ${flickerAlpha * 0.35})`);
      gradient.addColorStop(1, "rgba(255, 20, 70, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.bright && Math.random() > 0.86) {
        ctx.strokeStyle = `rgba(255, 130, 130, ${flickerAlpha * 0.35})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 16, p.y - p.vy * 16);
        ctx.stroke();
      }
    }

    ctx.restore();
    requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  animateParticles();
  updateStrength();
})();
