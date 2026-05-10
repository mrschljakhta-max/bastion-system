/* =========================================================
   BASTION — Setup Account Flow v11
   invite token → password → TOTP QR → activation
   ========================================================= */

(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const status = document.getElementById("setupStatus");
  const title = document.getElementById("setupTitle");
  const led = document.getElementById("setupLed");

  const form = document.getElementById("setupForm");
  const emailInput = document.getElementById("setupEmail");
  const roleInput = document.getElementById("setupRole");
  const passwordInput = document.getElementById("setupPassword");
  const confirmInput = document.getElementById("setupConfirm");
  const loginInput = document.getElementById("setupLogin");
  const submitBtn = document.getElementById("setupSubmit");
  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirm = document.getElementById("toggleConfirm");

  const ruleLength = document.getElementById("ruleLength");
  const ruleLetter = document.getElementById("ruleLetter");
  const ruleNumber = document.getElementById("ruleNumber");
  const ruleMatch = document.getElementById("ruleMatch");
  const strengthBar = document.querySelector(".setup-strength");
  const strengthText = document.getElementById("setupStrengthText");

  const mfaBox = document.getElementById("setupMfa");
  const qr = document.getElementById("setupQr");
  const secret = document.getElementById("setupSecret");
  const copySecret = document.getElementById("copySecret");
  const codeInput = document.getElementById("setupCode");
  const verifyBtn = document.getElementById("setupVerify");
  const completeBox = document.getElementById("setupComplete");

  let invite = null;
  let mfaContext = null;
  let currentSecret = "";

  function setStep(step) {
    document.querySelectorAll("[data-step-marker]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.stepMarker === step);
    });
  }

  function setStatus(message, type = "info") {
    status.textContent = message;
    status.dataset.type = type;
    if (led) led.style.background = type === "error" ? "#ff2d55" : type === "success" ? "#6cffaa" : "#ffbd2f";
    if (led) led.style.boxShadow = `0 0 24px ${led.style.background}`;
  }

  function setTitle(text) {
    if (title) title.textContent = text;
  }

  function setBusy(isBusy) {
    if (submitBtn) submitBtn.disabled = isBusy;
    if (verifyBtn) verifyBtn.disabled = isBusy;
    if (passwordInput) passwordInput.disabled = isBusy;
    if (confirmInput) confirmInput.disabled = isBusy;
    if (loginInput) loginInput.disabled = isBusy;
    if (codeInput) codeInput.disabled = isBusy;
  }

  function validatePassword(value) {
    const password = String(value || "");
    const confirm = String(confirmInput?.value || "");
    const checks = {
      length: password.length >= 8,
      letter: /[a-zа-яіїєґ]/i.test(password),
      number: /\d/.test(password),
      match: Boolean(password) && password === confirm
    };

    ruleLength?.classList.toggle("is-ok", checks.length);
    ruleLetter?.classList.toggle("is-ok", checks.letter);
    ruleNumber?.classList.toggle("is-ok", checks.number);
    ruleMatch?.classList.toggle("is-ok", checks.match);

    const score = [checks.length, checks.letter, checks.number, password.length >= 12].filter(Boolean).length;
    if (strengthBar) strengthBar.dataset.level = password ? String(score) : "0";
    if (strengthText) {
      const label = !password ? "очікується" : score <= 2 ? "слабкий" : score === 3 ? "добрий" : "сильний";
      strengthText.innerHTML = `Надійність пароля: <b>${label}</b>`;
    }

    return checks.length && checks.letter && checks.number && checks.match;
  }

  async function ensureSession(email, password) {
    const session = await window.BastionAuth.getCurrentSession();
    if (session) return session;

    const login = await window.BastionAuth.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (login.error) throw login.error;
    return login.data?.session || null;
  }

  async function init() {
    setStep("invite");
    if (form) form.hidden = true;
    if (mfaBox) mfaBox.hidden = true;
    if (completeBox) completeBox.hidden = true;

    if (!window.supabase || !window.BastionAuth?.supabaseClient || !window.BastionAccess) {
      setTitle("Помилка підключення");
      setStatus("Supabase client is not ready. Перевірте підключення CDN, config.js, auth.js та access.js.", "error");
      return;
    }

    if (!token) {
      setTitle("Token відсутній");
      setStatus("Посилання налаштування пошкоджене: invite-token відсутній.", "error");
      return;
    }

    try {
      invite = await window.BastionAccess.getInviteByToken(token);

      if (!invite?.email) {
        setTitle("Запрошення недійсне");
        setStatus("Запрошення не знайдено, відкликано або його строк дії завершився.", "error");
        return;
      }

      emailInput.value = invite.email;
      roleInput.value = invite.role || "user";
      if (loginInput) loginInput.value = String(invite.email || "").split("@")[0] || "user";
      form.hidden = false;
      setStep("password");
      setTitle("Створення пароля");
      setStatus("Створіть надійний пароль для вашого акаунта. Використовуйте комбінацію літер і цифр.", "success");
      setTimeout(() => passwordInput.focus(), 150);
    } catch (error) {
      console.error(error);
      setTitle("Помилка перевірки");
      setStatus(error.message || "Не вдалося перевірити запрошення.", "error");
    }
  }

  passwordInput?.addEventListener("input", () => validatePassword(passwordInput.value));
  confirmInput?.addEventListener("input", () => validatePassword(passwordInput.value));

  togglePassword?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "⊗" : "⌧";
  });

  toggleConfirm?.addEventListener("click", () => {
    const isPassword = confirmInput.type === "password";
    confirmInput.type = isPassword ? "text" : "password";
    toggleConfirm.textContent = isPassword ? "⊗" : "⌧";
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    if (!validatePassword(password)) {
      setStatus("Пароль має містити мінімум 8 символів, літеру, цифру і збігатися з підтвердженням.", "error");
      return;
    }

    setBusy(true);
    setTitle("Створення акаунта");
    setStatus("Створюю акаунт у Supabase Auth…", "info");

    try {
      const signup = await window.BastionAuth.supabaseClient.auth.signUp({
        email: invite.email,
        password
      });

      if (signup.error) {
        const msg = String(signup.error.message || "").toLowerCase();
        const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("user");
        if (!alreadyExists) throw signup.error;
      }

      await ensureSession(invite.email, password);

      setTitle("2FA Authenticator");
      setStatus("Готую QR-код для Google Authenticator…", "info");

      mfaContext = await window.BastionAuth.prepareMfaAfterRegister();
      if (!mfaContext?.success) throw new Error("Не вдалося створити QR-код 2FA.");

      qr.src = mfaContext.qrImageSrc || window.BastionAuth.toQrImageSrc(mfaContext.qrCode);
      currentSecret = mfaContext.secret || "";
      secret.textContent = currentSecret || "SECRET недоступний — використайте QR-код";
      form.hidden = true;
      mfaBox.hidden = false;
      setStep("mfa");
      setStatus("Відскануйте QR-код і введіть 6-значний код.", "success");
      setTimeout(() => codeInput.focus(), 150);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося створити акаунт.", "error");
    } finally {
      setBusy(false);
    }
  });

  copySecret?.addEventListener("click", async () => {
    if (!currentSecret) return;
    await navigator.clipboard.writeText(currentSecret);
    copySecret.textContent = "Скопійовано";
    setTimeout(() => (copySecret.textContent = "Скопіювати"), 1200);
  });

  verifyBtn?.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      setStatus("Введіть 6-значний код з Authenticator.", "error");
      return;
    }

    setBusy(true);
    setStatus("Перевіряю 2FA і активую доступ…", "info");

    try {
      const verified = await window.BastionAuth.verifyTotpCode(
        mfaContext.factorId,
        mfaContext.challengeId,
        code
      );
      if (!verified?.success) throw new Error("Код 2FA не підтверджено.");

      const activated = await window.BastionAccess.activateInvite(token);
      if (!activated) throw new Error("Не вдалося активувати invite-token.");

      mfaBox.hidden = true;
      completeBox.hidden = false;
      setTitle("Активація завершена");
      setStatus("Доступ активовано. Можна входити в систему.", "success");

      setTimeout(() => {
        window.location.href = "./index.html";
      }, 1800);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося активувати доступ.", "error");
    } finally {
      setBusy(false);
    }
  });

  init();
})();
