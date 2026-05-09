/* =========================================================
   BASTION — AUTH PANEL v20
   Перемикає стартовий напис на форму входу / реєстрації
   ========================================================= */

(function () {
  const zone = document.getElementById("accessAuthZone");
  const choice = document.getElementById("accessChoice");
  const panel = document.getElementById("authPanel");
  const back = document.getElementById("authBack");
  const switcher = document.getElementById("authSwitch");
  const title = document.getElementById("authTitle");
  const kicker = document.getElementById("authKicker");
  const submit = document.getElementById("authSubmit");
  const login = document.getElementById("authLogin");
  const password = document.getElementById("authPassword");
  const confirm = document.getElementById("authPasswordConfirm");
  const subtitle = document.getElementById("modeSubtitle");
  const ring = document.getElementById("hudRing");

  if (!zone || !choice || !panel) return;

  const config = {
    login: {
      title: "ВХІД У СИСТЕМУ",
      kicker: "РЕЖИМ ДОСТУПУ",
      submit: "УВІЙТИ",
      switcher: "СТВОРИТИ ОБЛІКОВИЙ ЗАПИС",
      subtitle: "ВИКОНАЙТЕ ВХІД У СИСТЕМУ",
      passwordAutocomplete: "current-password"
    },
    register: {
      title: "РЕЄСТРАЦІЯ",
      kicker: "НОВИЙ ОПЕРАТОР",
      submit: "ЗАРЕЄСТРУВАТИСЬ",
      switcher: "ПЕРЕЙТИ ДО ВХОДУ",
      subtitle: "СТВОРЕННЯ ОБЛІКОВОГО ЗАПИСУ",
      passwordAutocomplete: "new-password"
    }
  };

  function setMode(mode) {
    const nextMode = mode === "register" ? "register" : "login";
    const data = config[nextMode];

    panel.dataset.mode = nextMode;
    title.textContent = data.title;
    kicker.textContent = data.kicker;
    submit.textContent = data.submit;
    switcher.textContent = data.switcher;

    if (subtitle) subtitle.textContent = data.subtitle;
    if (password) password.autocomplete = data.passwordAutocomplete;
    if (confirm) confirm.required = nextMode === "register";
  }

  function openPanel(mode) {
    setMode(mode);

    panel.hidden = false;
    zone.classList.add("is-auth-open");
    ring?.classList.add("is-ring-awake", "is-auth-active");

    requestAnimationFrame(() => {
      panel.classList.add("is-visible");
      setTimeout(() => login?.focus(), 180);
    });
  }

  function closePanel() {
    panel.classList.remove("is-visible");
    ring?.classList.remove("is-auth-active");

    setTimeout(() => {
      panel.hidden = true;
      zone.classList.remove("is-auth-open");
      ring?.classList.remove("is-ring-awake");

      if (subtitle) subtitle.textContent = config.login.subtitle;

      panel.reset();
    }, 260);
  }

  choice.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-auth-mode]");
    if (!btn) return;
    openPanel(btn.dataset.authMode);
  });

  back?.addEventListener("click", closePanel);

  switcher?.addEventListener("click", () => {
    const current = panel.dataset.mode === "register" ? "register" : "login";
    setMode(current === "register" ? "login" : "register");
    setTimeout(() => login?.focus(), 80);
  });

  panel.addEventListener("submit", (event) => {
    event.preventDefault();

    const mode = panel.dataset.mode === "register" ? "register" : "login";

    if (mode === "register" && password?.value !== confirm?.value) {
      confirm?.focus();
      panel.classList.remove("auth-shake");
      void panel.offsetWidth;
      panel.classList.add("auth-shake");
      return;
    }

    // Тут пізніше підключимо реальну авторизацію.
    // Поки що показуємо стан очікування, щоб форма виглядала живою.
    const original = submit.textContent;
    submit.textContent = mode === "register" ? "СТВОРЕННЯ..." : "ПЕРЕВІРКА...";
    submit.disabled = true;

    setTimeout(() => {
      submit.textContent = original;
      submit.disabled = false;
    }, 900);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });
})();
