(() => {
  const canvas = document.getElementById("atmosphereCanvas");
  const root = document.getElementById("startPage");

  if (!canvas || !root) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let fogBands = [];
  let embers = [];
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createFog();
    createEmbers();
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function createFog() {
    fogBands = Array.from({ length: 9 }, (_, index) => ({
      x: rand(-width * 0.25, width * 0.95),
      y: rand(height * 0.54, height * 0.91),
      w: rand(width * 0.24, width * 0.56),
      h: rand(42, 115),
      speed: rand(0.025, 0.075) * (index % 2 ? 1 : -1),
      alpha: rand(0.025, 0.075),
      phase: rand(0, Math.PI * 2),
      pulse: rand(0.00035, 0.0009),
    }));
  }

  function createEmbers() {
    embers = Array.from({ length: 85 }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      r: rand(0.55, 2.2),
      speedY: rand(0.035, 0.16),
      speedX: rand(-0.045, 0.055),
      alpha: rand(0.12, 0.55),
      blur: rand(0, 9),
      phase: rand(0, Math.PI * 2),
    }));
  }

  function drawFog(time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const fog of fogBands) {
      fog.x += fog.speed;
      if (fog.speed > 0 && fog.x > width + fog.w * 0.3) fog.x = -fog.w;
      if (fog.speed < 0 && fog.x < -fog.w * 1.2) fog.x = width + fog.w * 0.2;

      const wave = Math.sin(time * fog.pulse + fog.phase);
      const x = fog.x + wave * 24;
      const y = fog.y + wave * 7;

      const gradient = ctx.createRadialGradient(
        x + fog.w * 0.5,
        y + fog.h * 0.5,
        0,
        x + fog.w * 0.5,
        y + fog.h * 0.5,
        fog.w * 0.58
      );

      gradient.addColorStop(0, `rgba(255, 110, 118, ${fog.alpha})`);
      gradient.addColorStop(0.45, `rgba(255, 46, 77, ${fog.alpha * 0.58})`);
      gradient.addColorStop(1, "rgba(255, 46, 77, 0)");

      ctx.filter = `blur(${18 + Math.abs(wave) * 16}px)`;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x + fog.w * 0.5, y + fog.h * 0.5, fog.w * 0.5, fog.h, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawEmbers(time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const ember of embers) {
      ember.x += ember.speedX + Math.sin(time * 0.00045 + ember.phase) * 0.025;
      ember.y -= ember.speedY;

      if (ember.y < -20) {
        ember.y = height + rand(0, height * 0.25);
        ember.x = rand(0, width);
      }

      if (ember.x < -20) ember.x = width + 20;
      if (ember.x > width + 20) ember.x = -20;

      const twinkle = 0.55 + Math.sin(time * 0.0013 + ember.phase) * 0.45;
      ctx.filter = `blur(${ember.blur}px)`;
      ctx.fillStyle = `rgba(255, 56, 76, ${ember.alpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawVaporLines(time) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(10px)";

    for (let i = 0; i < 4; i += 1) {
      const y = height * (0.58 + i * 0.055) + Math.sin(time * 0.00035 + i) * 16;
      const start = (time * (0.006 + i * 0.0018) + i * 260) % (width + 520) - 520;

      const gradient = ctx.createLinearGradient(start, y, start + 520, y);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, `rgba(255, 105, 115, ${0.035 + i * 0.008})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 22 + i * 7;
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.bezierCurveTo(start + 150, y - 28, start + 360, y + 30, start + 520, y - 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  function animate(time) {
    ctx.clearRect(0, 0, width, height);
    drawFog(time);
    drawVaporLines(time);
    drawEmbers(time);

    if (!reducedMotion) {
      requestAnimationFrame(animate);
    }
  }

  function onPointerMove(event) {
    const cx = width / 2;
    const cy = height / 2;
    targetX = (event.clientX - cx) / cx;
    targetY = (event.clientY - cy) / cy;
  }

  function parallaxLoop() {
    mouseX += (targetX - mouseX) * 0.045;
    mouseY += (targetY - mouseY) * 0.045;

    root.style.setProperty("--px", `${mouseX * 18}px`);
    root.style.setProperty("--py", `${mouseY * 12}px`);

    if (!reducedMotion) requestAnimationFrame(parallaxLoop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  resize();

  if (!reducedMotion) {
    requestAnimationFrame(animate);
    requestAnimationFrame(parallaxLoop);
  } else {
    drawFog(0);
    drawVaporLines(0);
    drawEmbers(0);
  }
})();
