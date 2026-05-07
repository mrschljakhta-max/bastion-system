const embersRoot = document.getElementById("embers");

if (embersRoot) {
  const count = 58;

  for (let i = 0; i < count; i += 1) {
    const ember = document.createElement("span");
    ember.className = "ember";
    ember.style.left = `${Math.random() * 100}%`;
    ember.style.bottom = `${Math.random() * 100}%`;
    ember.style.animationDuration = `${12 + Math.random() * 22}s`;
    ember.style.animationDelay = `${Math.random() * 16}s`;
    ember.style.opacity = `${0.25 + Math.random() * 0.65}`;
    embersRoot.appendChild(ember);
  }
}
