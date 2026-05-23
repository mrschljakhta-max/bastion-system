/* =========================================================
   BASTION — AUTH PANEL v24
   Supabase Auth + MFA/TOTP UI
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
  const passwordToggle = document.getElementById("authPasswordToggle");
  const subtitle = document.getElementById("modeSubtitle");
  const ring = document.getElementById("hudRing");

  if (!zone || !choice || !panel) return;

  let authMode = "login";
  let currentStep = "credentials";
  let mfaContext = null;

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
      title: "ЗАПИТ ДОСТУПУ",
      kicker: "НОВИЙ КОРИСТУВАЧ",
      submit: "НАДІСЛАТИ ЗАЯВКУ",
      switcher: "ПЕРЕЙТИ ДО ВХОДУ",
      subtitle: "ЗАЯВКА НА ДОСТУП ДО СИСТЕМИ",
      passwordAutocomplete: "new-password"
    },
    mfaRegister: {
      title: "ДВОФАКТОРНИЙ ЗАХИСТ",
      kicker: "СКАНУЙТЕ QR-КОД",
      submit: "ПІДТВЕРДИТИ",
      switcher: "ПОВЕРНУТИСЬ",
      subtitle: "ПІДКЛЮЧЕННЯ ДВОФАКТОРНОЇ АВТЕНТИФІКАЦІЇ"
    },
    mfaLogin: {
      title: "КОД АВТЕНТИФІКАТОРА",
      kicker: "GOOGLE AUTHENTICATOR",
      submit: "ПЕРЕВІРИТИ",
      switcher: "ПОВЕРНУТИСЬ",
      subtitle: "ПЕРЕВІРКА ДВОФАКТОРНОЇ АВТЕНТИФІКАЦІЇ"
    }
  };

  function ensureMfaUi() {
    if (document.getElementById("mfaPanel")) return;

    const mfa = document.createElement("div");
    mfa.className = "mfa-panel";
    mfa.id = "mfaPanel";
    mfa.hidden = true;

    mfa.innerHTML = `
      <div class="mfa-qr-wrap" id="mfaQrWrap">
        <div class="mfa-qr-frame">
          <img id="mfaQrImage" class="mfa-qr-image" alt="QR-код для Google Authenticator" />
        </div>
        <div class="mfa-secret" id="mfaSecret"></div>
        <div class="mfa-hint">
          Відскануйте QR-код у Google Authenticator, після цього введіть 6-значний код.
        </div>
      </div>

      <label class="auth-field mfa-code-field">
        <span>КОД АВТЕНТИФІКАТОРА</span>
        <input
          id="mfaCode"
          name="mfaCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="000000"
          spellcheck="false"
        />
      </label>

      <div class="mfa-hint mfa-login-hint" id="mfaLoginHint">
        Введіть 6-значний код із Google Authenticator.
      </div>
    `;

    const submitBtn = document.getElementById("authSubmit");
    panel.insertBefore(mfa, submitBtn);
  }

  function setMode(mode) {
    authMode = mode === "register" ? "register" : "login";
    currentStep = "credentials";
    mfaContext = null;

    const data = config[authMode];

    panel.dataset.mode = authMode;
    panel.dataset.step = "credentials";
    title.textContent = data.title;
    kicker.textContent = data.kicker;
    submit.textContent = data.submit;
    switcher.textContent = data.switcher;

    if (subtitle) subtitle.textContent = data.subtitle;
    if (password) password.autocomplete = data.passwordAutocomplete;

    showCredentials();
  }

  function showCredentials() {
    currentStep = "credentials";
    panel.dataset.step = "credentials";

    document.querySelectorAll(".auth-field").forEach((field) => {
      if (!field.classList.contains("mfa-code-field")) {
        field.hidden = false;
      }
    });

    const mfaPanel = document.getElementById("mfaPanel");
    if (mfaPanel) mfaPanel.hidden = true;

    login.required = true;
    password.required = authMode !== "register";
    if (password?.closest(".auth-field")) {
      password.closest(".auth-field").hidden = authMode === "register";
    }
    submit.textContent = config[authMode].submit;
    switcher.textContent = config[authMode].switcher;
  }

  function showMfa(context) {
    ensureMfaUi();

    mfaContext = context;
    currentStep = "mfa";
    panel.dataset.step = "mfa";

    const hasQr = Boolean(context?.qrImageSrc || context?.qrCode || context?.secret);
    const isRegister = hasQr || context?.mode === "register";
    const data = hasQr ? config.mfaRegister : config.mfaLogin;

    title.textContent = data.title;
    kicker.textContent = data.kicker;
    submit.textContent = data.submit;
    switcher.textContent = data.switcher;
    if (subtitle) subtitle.textContent = data.subtitle;

    document.querySelectorAll(".auth-field").forEach((field) => {
      if (!field.classList.contains("mfa-code-field")) {
        field.hidden = true;
      }
    });

    const mfaPanel = document.getElementById("mfaPanel");
    const qrWrap = document.getElementById("mfaQrWrap");
    const qrImage = document.getElementById("mfaQrImage");
    const secret = document.getElementById("mfaSecret");
    const loginHint = document.getElementById("mfaLoginHint");
    const code = document.getElementById("mfaCode");

    if (mfaPanel) mfaPanel.hidden = false;

    if (isRegister && context.qrCode) {
      qrWrap.hidden = false;
      qrImage.src = context.qrImageSrc || window.BastionAuth?.toQrImageSrc?.(context.qrCode) || context.qrCode || "";
      secret.textContent = context.secret ? `SECRET: ${context.secret}` : "";
      loginHint.hidden = true;
    } else {
      qrWrap.hidden = true;
      loginHint.hidden = false;
    }

    login.required = false;
    password.required = false;

    setTimeout(() => code?.focus(), 120);
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
    if (passwordToggle) passwordToggle.disabled = isLoading;
    switcher.disabled = isLoading;
    back.disabled = isLoading;

    const mfaCode = document.getElementById("mfaCode");
    if (mfaCode) mfaCode.disabled = isLoading;

    if (isLoading) {
      submit.textContent =
        currentStep === "mfa"
          ? "ПЕРЕВІРКА..."
          : mode === "register"
            ? "НАДСИЛАННЯ..."
            : "ПЕРЕВІРКА...";
    } else {
      if (currentStep === "mfa") {
        submit.textContent = "ПІДТВЕРДИТИ";
      } else {
        submit.textContent = config[mode].submit;
      }
    }
  }

  function shakePanel() {
    panel.classList.remove("auth-shake");
    void panel.offsetWidth;
    panel.classList.add("auth-shake");
  }

  async function handleCredentialsSubmit() {
    const email = login.value.trim();
    const pass = password.value;

    if (!window.BastionAuth) {
      console.error("BastionAuth не знайдено. Перевір підключення scripts/auth.js");
      alert("Модуль авторизації не підключено.");
      return;
    }

    if (!email || (authMode !== "register" && !pass)) {
      shakePanel();
      alert(authMode === "register" ? "Введіть email." : "Введіть email та пароль.");
      return;
    }

    setLoading(true, authMode);

    try {
      if (authMode === "register") {
        const ok = await window.BastionAuth.requestAccess(email);
        if (!ok) {
          shakePanel();
          return;
        }
        alert("Заявку на доступ надіслано. Дочекайтесь рішення адміністратора.");
        closePanel();
        return;
      }

      const result = await window.BastionAuth.handleLogin(email, pass);

      if (!result?.success) {
        shakePanel();
        return;
      }

      const mfa = await window.BastionAuth.prepareMfaAfterLogin();

      if (!mfa?.success) {
        shakePanel();
        return;
      }

      showMfa(mfa);
    } catch (error) {
      console.error("Помилка auth credentials:", error);
      shakePanel();
      alert("Помилка авторизації. Перевір консоль браузера.");
    } finally {
      setLoading(false, authMode);
    }
  }

  async function handleMfaSubmit() {
    const code = document.getElementById("mfaCode")?.value.trim();

    if (!code || code.length < 6) {
      shakePanel();
      alert("Введіть 6-значний код.");
      return;
    }

    setLoading(true, authMode);

    try {
      const result = await window.BastionAuth.verifyTotpCode(
        mfaContext.factorId,
        mfaContext.challengeId,
        code
      );

      if (!result?.success) {
        shakePanel();
        return;
      }

      if (subtitle) subtitle.textContent = "ДОСТУП ДОЗВОЛЕНО";
      submit.textContent = "ДОСТУП ВІДКРИТО";

      setTimeout(async () => {
        try {
          const profile = await window.BastionAccess?.getMyAccessProfile?.();
          const target = window.BastionAccess?.routeForRole?.(profile?.role) || "./pages/app.html";
          window.location.href = target;
        } catch (error) {
          console.warn("Не вдалося визначити роль, відкриваю app:", error);
          window.location.href = "./pages/app.html";
        }
      }, 650);
    } catch (error) {
      console.error("Помилка MFA:", error);
      shakePanel();
      alert("Помилка перевірки 2FA.");
    } finally {
      setLoading(false, authMode);
    }
  }

  choice.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-auth-mode]");
    if (!btn) return;

    openPanel(btn.dataset.authMode);
  });

  back?.addEventListener("click", closePanel);

  switcher?.addEventListener("click", () => {
    if (currentStep === "mfa") {
      showCredentials();
      return;
    }

    const next = authMode === "register" ? "login" : "register";

    panel.reset();
    setMode(next);

    setTimeout(() => login?.focus(), 80);
  });


  passwordToggle?.addEventListener("click", () => {
    if (!password) return;

    const shouldShow = password.type === "password";
    password.type = shouldShow ? "text" : "password";

    passwordToggle.classList.toggle("is-visible", shouldShow);
    passwordToggle.setAttribute("aria-pressed", String(shouldShow));
    passwordToggle.setAttribute("aria-label", shouldShow ? "Приховати пароль" : "Показати пароль");
    passwordToggle.title = shouldShow ? "Приховати пароль" : "Показати пароль";

    password.focus();
  });

  panel.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (currentStep === "mfa") {
      await handleMfaSubmit();
      return;
    }

    await handleCredentialsSubmit();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });
})();
