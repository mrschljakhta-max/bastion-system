const sectors = document.querySelectorAll(".ring-sector");
const subtitle = document.getElementById("modeSubtitle");
const enterLink = document.getElementById("enterLink");

const modes = {
  login: {
    subtitle: "Authorized access node",
    href: "./pages/login.html",
    label: "Enter system"
  },
  register: {
    subtitle: "Create new operator identity",
    href: "./pages/register.html",
    label: "Create access"
  },
  developer: {
    subtitle: "Developer access terminal",
    href: "./pages/developer.html",
    label: "Open dev mode"
  }
};

sectors.forEach((sector) => {
  sector.addEventListener("mouseenter", () => {
    const mode = sector.dataset.mode;
    const data = modes[mode];

    sectors.forEach((item) => item.classList.remove("is-active"));
    sector.classList.add("is-active");

    if (subtitle && data) subtitle.textContent = data.subtitle;
    if (enterLink && data) {
      enterLink.href = data.href;
      enterLink.textContent = data.label;
    }
  });

  sector.addEventListener("click", () => {
    const mode = sector.dataset.mode;
    const data = modes[mode];

    if (data) {
      window.location.href = data.href;
    }
  });
});
