/* =========================================================
   BASTION — Setup Account Flow v10
   invite token → password → optional TOTP QR → activation
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
  const passwordConfirmInput = document.getElementById("setupPasswordConfirm");
  const submitBtn = document.getElementById("setupSubmit");
  const togglePassword = document.getElementById("togglePassword");
  const togglePasswordConfirm = document.getElementById("togglePasswordConfirm");
  const strength = document.querySelector(".setup-strength");
  const strengthText = document.getElementById("setupStrengthText");

  const ruleLength = document.getElementById("ruleLength");
  const ruleLetter = document.getElementById("ruleLetter");
  const ruleNumber = document.getElementById("ruleNumber");
  const ruleMatch = document.getElementById("ruleMatch");

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
      const marker = el.dataset.stepMarker;
      el.classList.toggle("is-active", marker === step);
      el.classList.toggle("is-done", step !== "invite" && marker === "invite");
    });
  }

  function setStatus(message, type = "info") {
    const icon = type === "error" ? "⚠" : type === "success" ? "✓" : "🔒";
    if (status) {
      status.dataset.type = type;
      status.innerHTML = `<i>${icon}</i><span>${escapeHtml(message)}</span>`;
    }

    if (!led) return;
    led.textContent = type === "error" ? "Помилка" : type === "success" ? "Захищено" : "Перевірка";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setTitle(text) {
    if (title) title.textContent = text;
  }

  function setBusy(isBusy) {
    if (submitBtn) submitBtn.disabled = isBusy;
    if (verifyBtn) verifyBtn.disabled = isBusy;
    if (passwordInput) passwordInput.disabled = isBusy;
    if (passwordConfirmInput) passwordConfirmInput.disabled = isBusy;
    if (codeInput) codeInput.disabled = isBusy;
  }

  function getPasswordChecks() {
    const password = String(passwordInput?.value || "");
    const confirm = String(passwordConfirmInput?.value || "");
    return {
      length: password.length >= 8,
      letter: /[a-zа-яіїєґ]/i.test(password),
      number: /\d/.test(password),
      match: password.length > 0 && password === confirm,
      special: /[^a-zа-яіїєґ0-9]/i.test(password),
      long: password.length >= 12,
    };
  }

  function updatePasswordUi() {
    const checks = getPasswordChecks();
    const baseScore = [checks.length, checks.letter, checks.number, checks.special, checks.long].filter(Boolean).length;
    const level = Math.min(4, Math.max(0, baseScore - 1));

    ruleLength?.classList.toggle("is-ok", checks.length);
    ruleLetter?.classList.toggle("is-ok", checks.letter);
    ruleNumber?.classList.toggle("is-ok", checks.number);
    ruleMatch?.classList.toggle("is-ok", checks.match);

    if (strength) strength.dataset.level = String(level);
    if (strengthText) {
      strengthText.textContent = level <= 1 ? "слабкий" : level === 2 ? "середній" : level === 3 ? "надійний" : "дуже надійний";
    }

    return checks.length && checks.letter && checks.number && checks.match;
  }

  async function ensureSession(email, password) {
    const session = await window.BastionAuth.getCurrentSession();
    if (session) return session;

    const login = await window.BastionAuth.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (login.error) throw login.error;
    return login.data?.session || null;
  }

  async function init() {
    setStep("invite");

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

  passwordInput?.addEventListener("input", updatePasswordUi);
  passwordConfirmInput?.addEventListener("input", updatePasswordUi);

  function bindPasswordToggle(button, input) {
    button?.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "⊘" : "⊗";
    });
  }

  bindPasswordToggle(togglePassword, passwordInput);
  bindPasswordToggle(togglePasswordConfirm, passwordConfirmInput);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    if (!updatePasswordUi()) {
      setStatus("Пароль має містити мінімум 8 символів, літеру, цифру та збігатися з підтвердженням.", "error");
      return;
    }

    setBusy(true);
    setTitle("Створення акаунта");
    setStatus("Створюю акаунт у Supabase Auth…", "info");

    try {
      const signup = await window.BastionAuth.supabaseClient.auth.signUp({
        email: invite.email,
        password,
      });

      if (signup.error) {
        const msg = String(signup.error.message || "").toLowerCase();
        const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("user");
        if (!alreadyExists) throw signup.error;
      }

      await ensureSession(invite.email, password);

      if (window.BastionAuth.prepareMfaAfterRegister) {
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
        return;
      }

      const activated = await window.BastionAccess.activateInvite(token);
      if (!activated) throw new Error("Не вдалося активувати invite-token.");
      showComplete();
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

  function showComplete() {
    form.hidden = true;
    mfaBox.hidden = true;
    completeBox.hidden = false;
    setStep("mfa");
    setTitle("Активація завершена");
    setStatus("Доступ активовано. Можна входити в систему.", "success");

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1800);
  }

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

      showComplete();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося активувати доступ.", "error");
    } finally {
      setBusy(false);
    }
  });

  init();
})();
