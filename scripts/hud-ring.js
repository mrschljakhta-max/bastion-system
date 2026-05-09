const sectors = document.querySelectorAll(".ring-sector");
const subtitle = document.getElementById("modeSubtitle");
const enterLink = document.getElementById("enterLink");
const startPage = document.querySelector(".start-page");

const modes = {
  login: {
    subtitle: "ВИКОНАЙТЕ ВХІД У СИСТЕМУ",
    href: "./pages/login.html",
    label: "ВХІД • ЗАПИТ ДОСТУПУ"
  },
  register: {
    subtitle: "ЗАЯВКА НА ДОСТУП",
    href: "./pages/register.html",
    label: "ЗАПИТ ДОСТУПУ"
  },
  developer: {
    subtitle: "ТЕРМІНАЛ РОЗРОБНИКА",
    href: "./pages/developer.html",
    label: "РЕЖИМ РОЗРОБНИКА"
  }
};

let switchTimer = null;

function setMode(mode) {
  const data = modes[mode];
  if (!data || !startPage) return;

  sectors.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.mode === mode);
  });

  startPage.classList.remove("mode-login", "mode-register", "mode-developer");
  startPage.classList.add(`mode-${mode}`, "is-switching");

  window.clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => {
    startPage.classList.remove("is-switching");
  }, 420);

  if (subtitle) subtitle.textContent = data.subtitle;

  if (enterLink) {
    enterLink.href = data.href;
    enterLink.textContent = data.label;
  }
}

sectors.forEach((sector) => {
  sector.addEventListener("mouseenter", () => setMode(sector.dataset.mode));
  sector.addEventListener("focus", () => setMode(sector.dataset.mode));

  sector.addEventListener("click", () => {
    const mode = sector.dataset.mode;
    const data = modes[mode];

    if (data) window.location.href = data.href;
  });
});

setMode("login");
