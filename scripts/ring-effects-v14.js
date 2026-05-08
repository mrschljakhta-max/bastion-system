(() => {
  const ring = document.getElementById("hudRing");
  if (!ring) return;

  let raf = 0;
  let tx = 0;
  let ty = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function applyTilt() {
    raf = 0;
    ring.style.setProperty("--ringTiltX", `${ty.toFixed(2)}deg`);
    ring.style.setProperty("--ringTiltY", `${tx.toFixed(2)}deg`);
  }

  function onMove(event) {
    const rect = ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const nx = clamp((event.clientX - cx) / (rect.width / 2), -1, 1);
    const ny = clamp((event.clientY - cy) / (rect.height / 2), -1, 1);

    tx = nx * 1.65;
    ty = -ny * 1.35;

    ring.classList.add("is-ring-reactive");

    if (!raf) raf = requestAnimationFrame(applyTilt);
  }

  function reset() {
    tx = 0;
    ty = 0;
    ring.classList.remove("is-ring-reactive");
    if (!raf) raf = requestAnimationFrame(applyTilt);
  }

  ring.addEventListener("mousemove", onMove);
  ring.addEventListener("mouseleave", reset);
  ring.addEventListener("blur", reset, true);
})();


/* =========================================================
   BASTION — LIVE PREMIUM EFFECTS v17
   ========================================================= */

(function () {
  const ring = document.querySelector(".hud-ring");
  const center =
    document.querySelector(".hero-center") ||
    document.querySelector(".bastion-core") ||
    document.querySelector(".core-shell") ||
    ring;

  if (!ring || !center) return;

  if (!ring.querySelector(".ring-v17-sparks")) {
    const sparks = document.createElement("div");
    sparks.className = "ring-v17-sparks";

    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement("i");
      spark.className = "ring-v17-spark";

      const angle = Math.round((360 / count) * i + (i % 3) * 9);
      const delay = (i * 0.47).toFixed(2);
      const duration = (6.8 + (i % 5) * 0.6).toFixed(2);

      spark.style.setProperty("--spark-angle", `${angle}deg`);
      spark.style.setProperty("--spark-radius", "46%");
      spark.style.setProperty("--spark-delay", `${delay}s`);
      spark.style.setProperty("--spark-duration", `${duration}s`);

      sparks.appendChild(spark);
    }

    ring.appendChild(sparks);
  }

  let raf = null;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;
  let currentPx = 0;
  let currentPy = 0;
  let targetPx = 0;
  let targetPy = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;

  function animateTilt() {
    currentTiltX = lerp(currentTiltX, targetTiltX, 0.09);
    currentTiltY = lerp(currentTiltY, targetTiltY, 0.09);
    currentPx = lerp(currentPx, targetPx, 0.08);
    currentPy = lerp(currentPy, targetPy, 0.08);

    ring.style.setProperty("--ring-tilt-x", `${currentTiltX.toFixed(3)}deg`);
    ring.style.setProperty("--ring-tilt-y", `${currentTiltY.toFixed(3)}deg`);
    ring.style.setProperty("--ring-parallax-x", `${currentPx.toFixed(2)}px`);
    ring.style.setProperty("--ring-parallax-y", `${currentPy.toFixed(2)}px`);

    if (
      Math.abs(currentTiltX - targetTiltX) > 0.01 ||
      Math.abs(currentTiltY - targetTiltY) > 0.01 ||
      Math.abs(currentPx - targetPx) > 0.02 ||
      Math.abs(currentPy - targetPy) > 0.02
    ) {
      raf = requestAnimationFrame(animateTilt);
    } else {
      raf = null;
    }
  }

  function kickTiltLoop() {
    if (!raf) raf = requestAnimationFrame(animateTilt);
  }

  center.addEventListener("pointermove", (event) => {
    const rect = center.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    targetTiltX = clamp(y * -4.2, -3.2, 3.2);
    targetTiltY = clamp(x * 4.8, -3.8, 3.8);
    targetPx = clamp(x * 4, -4, 4);
    targetPy = clamp(y * 3, -3, 3);

    ring.classList.add("is-ring-awake");
    kickTiltLoop();
  }, { passive: true });

  center.addEventListener("pointerenter", () => {
    ring.classList.add("is-ring-awake");
  });

  center.addEventListener("pointerleave", () => {
    targetTiltX = 0;
    targetTiltY = 0;
    targetPx = 0;
    targetPy = 0;

    ring.classList.remove("is-ring-awake");
    kickTiltLoop();
  });

  const accessCandidates = [
    ".enter-link",
    ".access-actions",
    ".access-link",
    ".start-access"
  ];

  for (const selector of accessCandidates) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.dataset.bastionDotReady === "1") return;
      if (!node.children.length && node.textContent.includes("•")) {
        node.innerHTML = node.textContent
          .split("•")
          .map((part) => part.trim())
          .join(' <span class="access-dot">•</span> ');
        node.dataset.bastionDotReady = "1";
      }
    });
  }
})();


/* =========================================================
   BASTION — VISIBLE PREMIUM EFFECTS v18
   Фікс під реальні класи сторінки.
   ========================================================= */

(function () {
  const ring = document.querySelector(".hud-ring");
  const center = document.querySelector(".ring-center") || ring;
  const logo = document.querySelector(".brand-mark");
  const access = document.querySelector(".enter-link");

  if (!ring || !center) return;

  /* Real logo FX layers */
  if (center && !center.querySelector(".logo-burst-v18")) {
    const burst = document.createElement("span");
    burst.className = "logo-burst-v18";
    const sweep = document.createElement("span");
    sweep.className = "logo-sweep-v18";

    center.insertBefore(burst, logo || center.firstChild);
    center.insertBefore(sweep, logo || center.firstChild);

    if (logo) {
      const syncLogoPosition = () => {
        const centerRect = center.getBoundingClientRect();
        const logoRect = logo.getBoundingClientRect();
        if (!centerRect.height || !logoRect.height) return;
        const logoCenterY = (logoRect.top + logoRect.height / 2) - centerRect.top;
        center.style.setProperty("--logo-v18-top", `${logoCenterY}px`);
      };

      syncLogoPosition();
      window.addEventListener("resize", syncLogoPosition, { passive: true });
      setTimeout(syncLogoPosition, 350);
    }
  }

  /* Real scan line */
  if (center && !center.querySelector(".core-scan-line-v18")) {
    const scan = document.createElement("span");
    scan.className = "core-scan-line-v18";
    center.appendChild(scan);
  }

  /* Sparks */
  if (!ring.querySelector(".ring-v17-sparks")) {
    const sparks = document.createElement("div");
    sparks.className = "ring-v17-sparks";

    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement("i");
      spark.className = "ring-v17-spark";

      const angle = Math.round((360 / count) * i + (i % 4) * 7);
      const delay = (i * 0.31).toFixed(2);
      const duration = (5.4 + (i % 6) * 0.38).toFixed(2);

      spark.style.setProperty("--spark-angle", `${angle}deg`);
      spark.style.setProperty("--spark-radius", "47%");
      spark.style.setProperty("--spark-delay", `${delay}s`);
      spark.style.setProperty("--spark-duration", `${duration}s`);

      sparks.appendChild(spark);
    }

    ring.appendChild(sparks);
  }

  /* Wrap access dot */
  if (access && access.dataset.bastionDotReady !== "1" && access.textContent.includes("•")) {
    access.innerHTML = access.textContent
      .split("•")
      .map((part) => part.trim())
      .join(' <span class="access-dot">•</span> ');
    access.dataset.bastionDotReady = "1";
  }

  /* Stronger cursor tilt */
  let raf = null;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;
  let currentPx = 0;
  let currentPy = 0;
  let targetPx = 0;
  let targetPy = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;

  function animateTilt() {
    currentTiltX = lerp(currentTiltX, targetTiltX, 0.12);
    currentTiltY = lerp(currentTiltY, targetTiltY, 0.12);
    currentPx = lerp(currentPx, targetPx, 0.10);
    currentPy = lerp(currentPy, targetPy, 0.10);

    ring.style.setProperty("--ring-tilt-x", `${currentTiltX.toFixed(3)}deg`);
    ring.style.setProperty("--ring-tilt-y", `${currentTiltY.toFixed(3)}deg`);
    ring.style.setProperty("--ring-parallax-x", `${currentPx.toFixed(2)}px`);
    ring.style.setProperty("--ring-parallax-y", `${currentPy.toFixed(2)}px`);

    if (
      Math.abs(currentTiltX - targetTiltX) > 0.01 ||
      Math.abs(currentTiltY - targetTiltY) > 0.01 ||
      Math.abs(currentPx - targetPx) > 0.02 ||
      Math.abs(currentPy - targetPy) > 0.02
    ) {
      raf = requestAnimationFrame(animateTilt);
    } else {
      raf = null;
    }
  }

  function kickTiltLoop() {
    if (!raf) raf = requestAnimationFrame(animateTilt);
  }

  const motionZone = document.querySelector(".access-shell") || ring;

  motionZone.addEventListener("pointermove", (event) => {
    const rect = motionZone.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    targetTiltX = clamp(y * -6.2, -4.8, 4.8);
    targetTiltY = clamp(x * 7.0, -5.8, 5.8);
    targetPx = clamp(x * 7, -7, 7);
    targetPy = clamp(y * 5, -5, 5);

    ring.classList.add("is-ring-awake");
    kickTiltLoop();
  }, { passive: true });

  motionZone.addEventListener("pointerenter", () => {
    ring.classList.add("is-ring-awake");
  });

  motionZone.addEventListener("pointerleave", () => {
    targetTiltX = 0;
    targetTiltY = 0;
    targetPx = 0;
    targetPy = 0;

    ring.classList.remove("is-ring-awake");
    kickTiltLoop();
  });
})();
