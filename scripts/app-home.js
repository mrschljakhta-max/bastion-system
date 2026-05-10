(() => {
  const canvas = document.getElementById("appParticlesCanvas");
  const ctx = canvas?.getContext("2d");
  const operatorName = document.getElementById("operatorName");
  const operatorRole = document.getElementById("operatorRole");

  function setUserInfo() {
    try {
      const sessionUser =
        window.BastionAuth?.user ||
        window.BastionAuth?.currentUser ||
        null;

      const login =
        localStorage.getItem("bastion_login") ||
        sessionUser?.user_metadata?.login ||
        sessionUser?.email ||
        "Користувач";

      const role =
        localStorage.getItem("bastion_role") ||
        sessionUser?.user_metadata?.role ||
        "очікується";

      if (operatorName) operatorName.textContent = login;
      if (operatorRole) operatorRole.textContent = `Рівень доступу: ${role}`;
    } catch (_) {}
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

  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 2 + .5,
    vx: (Math.random() - .45) * .32,
    vy: -(Math.random() * .42 + .08),
    a: Math.random() * .42 + .12
  }));

  function draw() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.y < -20 || p.x < -20 || p.x > window.innerWidth + 20) {
        p.x = Math.random() * window.innerWidth;
        p.y = window.innerHeight + Math.random() * 60;
      }

      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      g.addColorStop(0, `rgba(255, 42, 80, ${p.a})`);
      g.addColorStop(1, "rgba(255, 42, 80, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  resize();
  setUserInfo();
  window.addEventListener("resize", resize);
  draw();
})();
