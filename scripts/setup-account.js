/* =========================================================
   BASTION — Setup Account Flow v1
   invite token → password → TOTP QR → activation
   ========================================================= */

(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const status = document.getElementById("setupStatus");
  const form = document.getElementById("setupForm");
  const emailInput = document.getElementById("setupEmail");
  const roleInput = document.getElementById("setupRole");
  const passwordInput = document.getElementById("setupPassword");
  const submitBtn = document.getElementById("setupSubmit");

  const mfaBox = document.getElementById("setupMfa");
  const qr = document.getElementById("setupQr");
  const secret = document.getElementById("setupSecret");
  const codeInput = document.getElementById("setupCode");
  const verifyBtn = document.getElementById("setupVerify");

  let invite = null;
  let mfaContext = null;

  function setStatus(message, type = "info") {
    status.textContent = message;
    status.dataset.type = type;
  }

  function setBusy(isBusy) {
    submitBtn.disabled = isBusy;
    verifyBtn.disabled = isBusy;
    passwordInput.disabled = isBusy;
    codeInput.disabled = isBusy;
  }

  async function init() {
    if (!token) {
      setStatus("Посилання налаштування пошкоджене: token відсутній.", "error");
      return;
    }

    try {
      invite = await window.BastionAccess.getInviteByToken(token);

      if (!invite) {
        setStatus("Запрошення не знайдено або його строк дії завершився.", "error");
        return;
      }

      emailInput.value = invite.email;
      roleInput.value = invite.role;
      form.hidden = false;
      setStatus("Запрошення підтверджено. Створіть пароль для акаунта.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося перевірити запрошення.", "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    if (!password || password.length < 8) {
      setStatus("Пароль має містити мінімум 8 символів.", "error");
      return;
    }

    setBusy(true);
    setStatus("Створюю акаунт…", "info");

    try {
      const { error } = await window.BastionAuth.supabaseClient.auth.signUp({
        email: invite.email,
        password
      });

      if (error && !String(error.message || "").toLowerCase().includes("already")) {
        throw error;
      }

      if (error) {
        const login = await window.BastionAuth.supabaseClient.auth.signInWithPassword({
          email: invite.email,
          password
        });
        if (login.error) throw login.error;
      }

      mfaContext = await window.BastionAuth.prepareMfaAfterRegister();
      if (!mfaContext?.success) throw new Error("Не вдалося створити QR-код 2FA.");

      qr.src = mfaContext.qrImageSrc || window.BastionAuth.toQrImageSrc(mfaContext.qrCode);
      secret.textContent = mfaContext.secret ? `SECRET: ${mfaContext.secret}` : "";
      form.hidden = true;
      mfaBox.hidden = false;
      setStatus("Відскануйте QR-код і введіть 6-значний код.", "success");
      setTimeout(() => codeInput.focus(), 150);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося створити акаунт.", "error");
    } finally {
      setBusy(false);
    }
  });

  verifyBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (code.length < 6) {
      setStatus("Введіть 6-значний код.", "error");
      return;
    }

    setBusy(true);
    setStatus("Перевіряю 2FA…", "info");

    try {
      const verified = await window.BastionAuth.verifyTotpCode(
        mfaContext.factorId,
        mfaContext.challengeId,
        code
      );
      if (!verified?.success) throw new Error("Код 2FA не підтверджено.");

      await window.BastionAccess.activateInvite(token);
      setStatus("Доступ активовано. Тепер увійдіть через стартову сторінку.", "success");
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 1000);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не вдалося активувати доступ.", "error");
    } finally {
      setBusy(false);
    }
  });

  init();
})();
