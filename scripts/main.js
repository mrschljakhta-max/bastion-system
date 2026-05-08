const embersRoot = document.getElementById("embers");

if (embersRoot) {
  const count = 46;

  for (let i = 0; i < count; i += 1) {
    const ember = document.createElement("span");
    ember.className = "ember";
    ember.style.left = `${Math.random() * 100}%`;
    ember.style.bottom = `${Math.random() * 100}%`;
    ember.style.animationDuration = `${14 + Math.random() * 26}s`;
    ember.style.animationDelay = `${Math.random() * 18}s`;
    ember.style.opacity = `${0.18 + Math.random() * 0.52}`;
    embersRoot.appendChild(ember);
  }
}
