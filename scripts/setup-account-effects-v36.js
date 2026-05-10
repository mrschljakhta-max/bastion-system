(() => {
  const root = document.body;
  const card = document.getElementById("setupCard");
  const password = document.getElementById("password");
  const login = document.getElementById("login");
  const strengthCore = document.getElementById("strengthCore");
  const strengthText = document.getElementById("strengthText");
  const secureBadge = document.getElementById("secureBadge");
  const accessStatus = document.getElementById("accessStatus");
  const particlesCanvas = document.getElementById("spaceParticles");

  const rules = {
    length: document.getElementById("ruleLength"),
    letter: document.getElementById("ruleLetter"),
    digit: document.getElementById("ruleDigit"),
    special: document.getElementById("ruleSpecial"),
  };

  function scorePassword(value) {
    const checks = {
      length: value.length >= 8,
      letter: /[a-zа-яіїєґ]/i.test(value),
      digit: /\d/.test(value),
      special: /[^a-zа-яіїєґ0-9]/i.test(value),
    };

    let score = Object.values(checks).filter(Boolean).length;

    if (value.length >= 12 && checks.letter && checks.digit) score += 1;
    if (value.length >= 16 && checks.special) score += 1;

    return {
      checks,
      score: Math.min(score, 5),
    };
  }

  function setRuleState(el, ok) {
    if (!el) return;

    const wasOk = el.classList.contains("ok");
    el.classList.toggle("ok", ok);

    if (ok && !wasOk) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
    }
  }

  function updateStrength() {
    if (!password || !strengthCore || !strengthText) return;

    const value = password.value || "";
    const { checks, score } = scorePassword(value);

    strengthCore.classList.remove("active", "level-1", "level-2", "level-3", "level-4", "level-5");

    if (value.length > 0) {
      strengthCore.classList.add("active", `level-${score || 1}`);
    }

    const labels = {
      0: "очікується",
      1: "слабкий",
      2: "нормальний",
      3: "стабільний",
      4: "сильний",
      5: "бойовий",
    };

    strengthText.textContent = labels[score] || labels[0];

    setRuleState(rules.length, checks.length);
    setRuleState(rules.letter, checks.letter);
    setRuleState(rules.digit, checks.digit);
    setRuleState(rules.special, checks.special);

    const ready = score >= 4 && (login?.value || "").trim().length >= 3;

    secureBadge?.classList.toggle("ready", ready);
    accessStatus?.classList.toggle("ready", ready);

    if (ready && accessStatus) {
      accessStatus.textContent = "ACCESS READY. Дані відповідають базовим вимогам безпеки.";
    } else if (accessStatus) {
      accessStatus.textContent = "Створіть логін і пароль для вашого акаунта. Використовуйте комбінацію літер і цифр.";
    }
  }

  password?.addEventListener("input", updateStrength);
  login?.addEventListener("input", updateStrength);

  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target || "password");
      if (!target) return;

      const isPassword = target.type === "password";
      target.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "◉" : "⊘";
    });
  });

  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;

    root.style.setProperty("--mx", `${x * 100}%`);
    root.style.setProperty("--my", `${y * 100}%`);
    root.style.setProperty("--parallax-x", `${(x - 0.5) * -18}px`);
    root.style.setProperty("--parallax-y", `${(y - 0.5) * -12}px`);

    if (card) {
      const rect = card.getBoundingClientRect();
      const cardX = ((event.clientX - rect.left) / rect.width) * 100;
      const cardY = ((event.clientY - rect.top) / rect.height) * 100;

      card.style.setProperty("--card-x", `${Math.max(0, Math.min(100, cardX))}%`);
      card.style.setProperty("--card-y", `${Math.max(0, Math.min(100, cardY))}%`);
    }
  });

  function initParticles() {
    if (!particlesCanvas) return;

    const ctx = particlesCanvas.getContext("2d");
    let width = 0;
    let height = 0;
    let particles = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      particlesCanvas.width = Math.floor(width * dpr);
      particlesCanvas.height = Math.floor(height * dpr);
      particlesCanvas.style.width = `${width}px`;
      particlesCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = Array.from({ length: Math.min(90, Math.floor(width / 18)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.7 + 0.35,
        vx: Math.random() * 0.18 + 0.025,
        vy: Math.random() * -0.08 - 0.015,
        a: Math.random() * 0.32 + 0.12,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 42, 88, ${p.a})`;
        ctx.shadowColor = "rgba(255, 42, 88, .65)";
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener("resize", resize);
  }

  initParticles();
  updateStrength();
})();
