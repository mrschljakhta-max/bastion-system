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
