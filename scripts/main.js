const embersRoot = document.getElementById("embers");

if (embersRoot) {
  const count = window.matchMedia("(max-width: 900px)").matches ? 22 : 42;

  for (let i = 0; i < count; i += 1) {
    const ember = document.createElement("span");
    ember.className = "ember";
    ember.style.left = `${Math.random() * 100}%`;
    ember.style.bottom = `${Math.random() * 100}%`;
    ember.style.animationDuration = `${18 + Math.random() * 30}s`;
    ember.style.animationDelay = `${Math.random() * 20}s`;
    ember.style.opacity = `${0.12 + Math.random() * 0.34}`;
    embersRoot.appendChild(ember);
  }
}

const startPage = document.querySelector(".start-page");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (startPage && !reducedMotion) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = null;

  const animateParallax = () => {
    currentX += (targetX - currentX) * 0.07;
    currentY += (targetY - currentY) * 0.07;

    startPage.style.setProperty("--mx", currentX.toFixed(4));
    startPage.style.setProperty("--my", currentY.toFixed(4));

    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      rafId = requestAnimationFrame(animateParallax);
    } else {
      rafId = null;
    }
  };

  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    targetX = Math.max(-0.5, Math.min(0.5, x));
    targetY = Math.max(-0.5, Math.min(0.5, y));

    if (!rafId) rafId = requestAnimationFrame(animateParallax);
  }, { passive: true });
}
