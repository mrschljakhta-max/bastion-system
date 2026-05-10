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

  function setMouseVars(event) {
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    root.style.setProperty("--mx", `${x}%`);
    root.style.setProperty("--my", `${y}%`);

    if (card) {
      const rect = card.getBoundingClientRect();
      const cx = ((event.clientX - rect.left) / rect.width) * 100;
      const cy = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--card-x", `${cx}%`);
      card.style.setProperty("--card-y", `${cy}%`);
    }
  }

  if (!prefersReducedMotion) {
    window.addEventListener("pointermove", setMouseVars, { passive: true });
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

  const particles = Array.from({ length: 42 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.4,
    vx: Math.random() * 0.18 + 0.03,
    vy: -(Math.random() * 0.22 + 0.04),
    a: Math.random() * 0.42 + 0.12,
  }));

  function animateParticles() {
    if (!canvas || !ctx || prefersReducedMotion) return;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -10 || p.x > window.innerWidth + 10) {
        p.x = Math.random() * window.innerWidth * 0.9;
        p.y = window.innerHeight + Math.random() * 80;
      }

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      gradient.addColorStop(0, `rgba(255, 40, 80, ${p.a})`);
      gradient.addColorStop(1, "rgba(255, 40, 80, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  animateParticles();
  updateStrength();
})();
