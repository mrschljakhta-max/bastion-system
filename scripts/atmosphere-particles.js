/* =========================================================
   BASTION — ATMOSPHERE PARTICLES v19
   Без canvas/WebGL. Легкий DOM particle system.
   ========================================================= */

(function () {
  const page = document.querySelector(".start-page");
  const oldEmbers = document.getElementById("embers");
  const shell = document.querySelector(".access-shell");
  const ring = document.querySelector(".hud-ring");

  if (!page) return;

  // Якщо старий main.js вже накидав .ember — прибираємо, щоб не дублювати візуальний шум.
  if (oldEmbers) {
    oldEmbers.innerHTML = "";
  }

  let root = document.querySelector(".bastion-atmosphere");
  if (!root) {
    root = document.createElement("div");
    root.className = "bastion-atmosphere";
    page.appendChild(root);
  }

  const createLayer = (className) => {
    let layer = root.querySelector(`.${className.split(" ").join(".")}`);
    if (!layer) {
      layer = document.createElement("div");
      layer.className = className;
      root.appendChild(layer);
    }
    return layer;
  };

  const layers = {
    back: createLayer("embers-layer back"),
    mid: createLayer("embers-layer mid"),
    front: createLayer("embers-layer front"),
    ash: createLayer("ash-layer"),
    plasma: createLayer("plasma-layer"),
    dust: createLayer("ring-dust-layer"),
  };

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function addEmber(layer, options) {
    const el = document.createElement("span");
    el.className = "ember-particle";

    const size = rand(options.sizeMin, options.sizeMax);
    el.style.setProperty("--x", `${rand(0, 100).toFixed(2)}%`);
    el.style.setProperty("--size", `${size.toFixed(2)}px`);
    el.style.setProperty("--duration", `${rand(options.durationMin, options.durationMax).toFixed(2)}s`);
    el.style.setProperty("--delay", `${rand(0, options.delayMax).toFixed(2)}s`);
    el.style.setProperty("--alpha", rand(options.alphaMin, options.alphaMax).toFixed(2));
    el.style.setProperty("--rise", `${rand(options.riseMin, options.riseMax).toFixed(1)}vh`);
    el.style.setProperty("--drift", `${rand(options.driftMin, options.driftMax).toFixed(1)}vw`);
    el.style.setProperty("--scale", rand(options.scaleMin, options.scaleMax).toFixed(2));

    layer.appendChild(el);
  }

  function addAsh(layer) {
    const el = document.createElement("span");
    el.className = "ash-particle";

    const size = rand(1.2, 4.8);
    el.style.setProperty("--x", `${rand(0, 100).toFixed(2)}%`);
    el.style.setProperty("--size", `${size.toFixed(2)}px`);
    el.style.setProperty("--duration", `${rand(24, 52).toFixed(2)}s`);
    el.style.setProperty("--delay", `${rand(0, 36).toFixed(2)}s`);
    el.style.setProperty("--alpha", rand(.06, .20).toFixed(2));
    el.style.setProperty("--rise", `${rand(70, 136).toFixed(1)}vh`);
    el.style.setProperty("--drift", `${rand(-18, 18).toFixed(1)}vw`);
    el.style.setProperty("--spin", `${rand(-220, 220).toFixed(1)}deg`);
    el.style.setProperty("--scale", rand(.8, 1.8).toFixed(2));

    layer.appendChild(el);
  }

  function addPlasma(layer) {
    const el = document.createElement("span");
    el.className = "plasma-streak";
    el.style.setProperty("--x", `${rand(4, 96).toFixed(2)}%`);
    el.style.setProperty("--y", `${rand(16, 82).toFixed(2)}%`);
    el.style.setProperty("--length", `${rand(120, 340).toFixed(1)}px`);
    el.style.setProperty("--angle", `${pick([-16, -11, -7, 7, 11, 16])}deg`);
    el.style.setProperty("--duration", `${rand(8, 18).toFixed(2)}s`);
    el.style.setProperty("--delay", `${rand(0, 22).toFixed(2)}s`);
    layer.appendChild(el);
  }

  function addRingDust(layer, index, total) {
    const el = document.createElement("i");
    el.className = "ring-dust";
    const angle = (360 / total) * index + rand(-12, 12);
    el.style.setProperty("--angle", `${angle.toFixed(2)}deg`);
    el.style.setProperty("--radius", `${rand(37, 47).toFixed(2)}%`);
    el.style.setProperty("--duration", `${rand(5.5, 11).toFixed(2)}s`);
    el.style.setProperty("--delay", `${rand(0, 9).toFixed(2)}s`);
    el.style.setProperty("--alpha", rand(.24, .72).toFixed(2));
    layer.appendChild(el);
  }

  // Density tuned for desktop GitHub Pages performance.
  for (let i = 0; i < 38; i += 1) {
    addEmber(layers.back, {
      sizeMin: 1.2, sizeMax: 2.8,
      durationMin: 24, durationMax: 48,
      delayMax: 34,
      alphaMin: .10, alphaMax: .28,
      riseMin: 90, riseMax: 145,
      driftMin: -10, driftMax: 10,
      scaleMin: .7, scaleMax: 1.35,
    });
  }

  for (let i = 0; i < 42; i += 1) {
    addEmber(layers.mid, {
      sizeMin: 1.6, sizeMax: 4.2,
      durationMin: 16, durationMax: 34,
      delayMax: 24,
      alphaMin: .18, alphaMax: .48,
      riseMin: 82, riseMax: 132,
      driftMin: -16, driftMax: 16,
      scaleMin: .9, scaleMax: 1.75,
    });
  }

  for (let i = 0; i < 18; i += 1) {
    addEmber(layers.front, {
      sizeMin: 3.4, sizeMax: 8.2,
      durationMin: 12, durationMax: 25,
      delayMax: 18,
      alphaMin: .12, alphaMax: .32,
      riseMin: 70, riseMax: 118,
      driftMin: -22, driftMax: 22,
      scaleMin: 1.1, scaleMax: 2.1,
    });
  }

  for (let i = 0; i < 28; i += 1) addAsh(layers.ash);
  for (let i = 0; i < 8; i += 1) addPlasma(layers.plasma);
  for (let i = 0; i < 26; i += 1) addRingDust(layers.dust, i, 26);

  // Awake mode: синхронізує атмосферу з hover кільця.
  const setAwake = (value) => {
    document.body.classList.toggle("bastion-awake", value);
  };

  if (shell) {
    shell.addEventListener("pointerenter", () => setAwake(true));
    shell.addEventListener("pointerleave", () => setAwake(false));
  }

  if (ring) {
    ring.addEventListener("pointerenter", () => setAwake(true));
    ring.addEventListener("pointerleave", () => setAwake(false));
  }
})();
