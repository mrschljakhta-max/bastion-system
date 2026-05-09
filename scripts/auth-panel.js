/* =========================================================
   BASTION — AUTH PANEL v23
   Підключено до scripts/auth.js:
   - login → BastionAuth.handleLogin()
   - register → BastionAuth.handleRegister()
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
      setMode("login");
    }, 260);
  }

  function setLoading(isLoading, mode) {
    submit.disabled = isLoading;
    login.disabled = isLoading;
    password.disabled = isLoading;
    switcher.disabled = isLoading;
    back.disabled = isLoading;

    if (isLoading) {
      submit.textContent = mode === "register" ? "РЕЄСТРАЦІЯ..." : "ПЕРЕВІРКА...";
    } else {
      submit.textContent = config[mode].submit;
    }
  }

  function shakePanel() {
    panel.classList.remove("auth-shake");
    void panel.offsetWidth;
    panel.classList.add("auth-shake");
  }

  choice.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-auth-mode]");
    if (!btn) return;

    openPanel(btn.dataset.authMode);
  });

  back?.addEventListener("click", closePanel);

  switcher?.addEventListener("click", () => {
    const current = panel.dataset.mode === "register" ? "register" : "login";
    const next = current === "register" ? "login" : "register";

    panel.reset();
    setMode(next);

    setTimeout(() => login?.focus(), 80);
  });

  panel.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mode = panel.dataset.mode === "register" ? "register" : "login";
    const email = login.value.trim();
    const pass = password.value;

    if (!window.BastionAuth) {
      console.error("BastionAuth не знайдено. Перевір підключення scripts/auth.js");
      alert("Модуль авторизації не підключено.");
      return;
    }

    if (!email || !pass) {
      shakePanel();
      alert("Введіть email та пароль.");
      return;
    }

    try {
      setLoading(true, mode);

      const result =
        mode === "register"
          ? await window.BastionAuth.handleRegister(email, pass)
          : await window.BastionAuth.handleLogin(email, pass);

      if (!result?.success) {
        shakePanel();
        return;
      }

      console.log("AUTH OK:", result);

      // Наступний крок: тут підключимо екран 2FA / QR-код.
      subtitle.textContent =
        mode === "register"
          ? "ПІДКЛЮЧЕННЯ ДВОФАКТОРНОЇ АВТЕНТИФІКАЦІЇ"
          : "ПЕРЕВІРКА ДВОФАКТОРНОЇ АВТЕНТИФІКАЦІЇ";

    } catch (error) {
      console.error("Помилка auth-panel:", error);
      shakePanel();
      alert("Помилка авторизації. Перевір консоль браузера.");
    } finally {
      setLoading(false, mode);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });
})();
