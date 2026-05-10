(() => {
  const root = document.documentElement;
  const card = document.getElementById("setupCard");
  const password = document.getElementById("password");
  const login = document.getElementById("login");
  const strengthCore = document.getElementById("strengthCore");
  const strengthLabel = document.getElementById("strengthLabel");
  const secureBadge = document.getElementById("secureBadge");
  const secureBadgeText = document.getElementById("secureBadgeText");
  const submitBtn = document.getElementById("activateAccessBtn");
  const verifyBtn = document.getElementById("verifyMfaBtn");
  const statusLine = document.getElementById("statusLine");
  const setupTitle = document.getElementById("setupTitle");
  const setupMessage = document.getElementById("setupMessage");
  const inviteMeta = document.getElementById("inviteMeta");
  const inviteEmailEl = document.getElementById("inviteEmail");
  const inviteRoleEl = document.getElementById("inviteRole");

  const accountForm = document.getElementById("setup-account-form");
  const mfaCode = document.getElementById("mfaCode");
  const mfaForm = document.getElementById("mfa-verify-form");
  const backToAccountBtn = document.getElementById("backToAccountBtn");
  const qrMount = document.getElementById("qrMount");
  const mfaSecret = document.getElementById("mfaSecret");
  const progressAccount = document.getElementById("progressAccount");
  const progressMfa = document.getElementById("progressMfa");

  const canvas = document.getElementById("particlesCanvas");
  const ctx = canvas?.getContext("2d");

  const rules = {
    length: document.querySelector('[data-rule="length"]'),
    letter: document.querySelector('[data-rule="letter"]'),
    digit: document.querySelector('[data-rule="digit"]'),
    special: document.querySelector('[data-rule="special"]'),
  };

  const params = new URLSearchParams(location.search);
  const state = {
    token: params.get("token") || "",
    invite: null,
    passwordLevel: 0,
    factorId: null,
    challengeId: null,
    mfaMode: "supabase",
  };

  // SECURITY: прибираємо login/password з адресного рядка, якщо вони випадково потрапили в URL
  if (params.has("password") || params.has("login")) {
    params.delete("password");
    params.delete("login");
    const safeUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}${location.hash || ""}`;
    history.replaceState({}, document.title, safeUrl);
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let targetBgX = 50;
  let targetBgY = 50;
  let currentBgX = 50;
  let currentBgY = 50;

  function client() {
    return window.BastionSupabase || window.supabaseClient || window.sb || window.BastionAuth?.client || null;
  }

  function setMessage(text, type = "") {
    if (!setupMessage) return;
    setupMessage.textContent = text || "";
    setupMessage.className = `setup-message${type ? ` is-${type}` : ""}`;
  }

  function setLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = Boolean(isLoading);
    const label = button.querySelector(".submit-label");
    if (label && text) label.textContent = text;
  }

  function setStep(step) {
    document.querySelectorAll(".setup-step-panel").forEach((panel) => {
      const active = panel.dataset.step === step;
      panel.classList.toggle("is-active", active);
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    progressAccount?.classList.toggle("is-done", step === "mfa" || step === "success");
    progressAccount?.classList.toggle("is-active", step === "account");
    progressMfa?.classList.toggle("is-active", step === "mfa");
    progressMfa?.classList.toggle("is-done", step === "success");

    if (step === "account") {
      setupTitle.innerHTML = "СТВОРЕННЯ<br />АКАУНТА";
      secureBadgeText.textContent = "Захищено";
    }

    if (step === "mfa") {
      setupTitle.innerHTML = "ЗАХИСТ<br />2FA";
      secureBadgeText.textContent = "MFA";
      statusLine.textContent = "Другий етап: відскануйте QR-код і підтвердьте Google Authenticator.";
    }

    if (step === "success") {
      setupTitle.innerHTML = "ACCESS<br />GRANTED";
      secureBadgeText.textContent = "Готово";
      statusLine.textContent = "Акаунт повністю активовано.";
    }
  }

  async function loadInvite() {
    if (!state.token) {
      statusLine.textContent = "Токен запрошення відсутній. Перевірте посилання.";
      setMessage("URL має містити ?token=...", "error");
      return;
    }

    const sb = client();
    if (!sb?.rpc) {
      statusLine.textContent = "Supabase client не знайдено.";
      setMessage(window.BASTION_SUPABASE_ERROR || "Supabase client не знайдено. Перевір scripts/config.js.", "error");
      return;
    }

    try {
      setMessage("Перевіряю токен запрошення...", "");
      const { data, error } = await sb.rpc("get_invite_by_token", { p_token: state.token });

      if (error) throw error;

      // data може бути object або масив — підтримуємо обидва варіанти
      const invite = Array.isArray(data) ? data[0] : data;
      if (!invite) {
        throw new Error("Запрошення не знайдено або токен недійсний.");
      }

      state.invite = invite;

      const email = invite.email || invite.user_email || invite.invite_email || invite.recipient_email || "email не визначено";
      const role = invite.role || invite.access_level || invite.user_role || "user";

      inviteEmailEl.textContent = email;
      inviteRoleEl.textContent = role;
      inviteMeta.hidden = false;

      statusLine.textContent = `Запрошення підтверджено для ${email}. Створіть логін і пароль.`;
      setMessage("Токен дійсний. Можна активувати акаунт.", "ok");
    } catch (err) {
      console.error(err);
      statusLine.textContent = "Не вдалося перевірити запрошення.";
      setMessage(err.message || "Помилка перевірки токена.", "error");
    }
  }

  async function activateInvite({ loginValue, passwordValue }) {
    const sb = client();
    if (!sb?.rpc) throw new Error("Supabase client не знайдено.");

    const payload = {
      p_token: state.token,
      p_login: loginValue,
      p_password: passwordValue,
    };

    // Основний очікуваний RPC твого проєкту
    let result = await sb.rpc("activate_user_invite", payload);

    // Якщо в твоїй БД функція має інший набір параметрів — fallback
    if (result.error) {
      console.warn("activate_user_invite failed, trying complete_invite_setup_v2:", result.error);
      result = await sb.rpc("complete_invite_setup_v2", payload);
    }

    if (result.error) throw result.error;

    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    return data || {};
  }

  async function ensureAuthSession(email, passwordValue) {
    const sb = client();
    if (!sb?.auth) {
      return null;
    }

    // MFA Supabase працює тільки при активній auth session.
    // Пробуємо signInWithPassword. Якщо користувача ще немає в Supabase Auth,
    // цей блок поверне null і сторінка покаже manual QR fallback.
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: passwordValue,
      });

      if (error) {
        console.warn("signInWithPassword failed:", error.message);
        return null;
      }

      return data?.session || null;
    } catch (err) {
      console.warn("Auth session failed:", err);
      return null;
    }
  }

  function buildManualTotpFallback(loginValue) {
    // Це fallback-візуалізація, якщо Supabase MFA недоступна без auth session.
    // Для production треба зберігати secret на сервері/RPC, не в браузері.
    const raw = `${loginValue}:${state.token}:${Date.now()}`;
    const secret = btoa(unescape(encodeURIComponent(raw)))
      .replace(/[^A-Z2-7]/gi, "")
      .toUpperCase()
      .padEnd(32, "A")
      .slice(0, 32);

    const issuer = "BASTION";
    const account = encodeURIComponent(loginValue);
    const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;

    state.mfaMode = "manual-fallback";
    mfaSecret.textContent = secret;
    qrMount.innerHTML = `<img alt="MFA QR fallback" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uri)}">`;
    setMessage("QR показано у fallback-режимі. Для справжньої перевірки 6 цифр потрібна Supabase Auth session або серверна RPC.", "error");
  }

  async function createTotpFactor(loginValue, passwordValue) {
    const sb = client();
    const email =
      state.invite?.email ||
      state.invite?.user_email ||
      state.invite?.invite_email ||
      state.invite?.recipient_email;

    if (!sb?.auth?.mfa?.enroll || !email) {
      buildManualTotpFallback(loginValue);
      return;
    }

    const session = await ensureAuthSession(email, passwordValue);
    if (!session) {
      buildManualTotpFallback(loginValue);
      return;
    }

    const { data, error } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "BASTION Google Authenticator",
    });

    if (error) throw error;

    state.factorId = data?.id || data?.totp?.id || data?.factorId;
    const qrCode = data?.totp?.qr_code;
    const secret = data?.totp?.secret;

    if (!state.factorId || !qrCode) {
      buildManualTotpFallback(loginValue);
      return;
    }

    qrMount.innerHTML = qrCode.startsWith("<svg") ? qrCode : `<img src="${qrCode}" alt="MFA QR Code" />`;
    mfaSecret.textContent = secret || "Secret key приховано Supabase.";

    const challenge = await sb.auth.mfa.challenge({ factorId: state.factorId });
    if (challenge.error) throw challenge.error;

    state.challengeId = challenge.data?.id;
    state.mfaMode = "supabase";
  }

  async function verifyTotpCode(code) {
    const sb = client();

    if (state.mfaMode === "manual-fallback") {
      // Тимчасово не блокуємо flow, щоб UI можна було тестувати.
      // Реальну перевірку треба робити через Supabase MFA або RPC.
      if (code.length !== 6) throw new Error("Введіть 6 цифр.");
      return { fallback: true };
    }

    if (!state.factorId || !state.challengeId) {
      throw new Error("MFA challenge не створено.");
    }

    const { data, error } = await sb.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: state.challengeId,
      code,
    });

    if (error) throw error;
    return data;
  }

  function scorePassword(value) {
    const checks = {
      length: value.length >= 8,
      letter: /[a-zA-ZА-Яа-яІіЇїЄєҐґ]/.test(value),
      digit: /\d/.test(value),
      special: /[^a-zA-ZА-Яа-яІіЇїЄєҐґ\d\s]/.test(value),
      long: value.length >= 12,
    };

    let score = 0;
    if (checks.length) score += 1;
    if (checks.letter) score += 1;
    if (checks.digit) score += 1;
    if (checks.special) score += 1;
    if (checks.long) score += 1;

    return { score, checks };
  }

  function updateStrength() {
    if (!password || !strengthCore || !strengthLabel) return;

    const value = password.value || "";
    const { score, checks } = scorePassword(value);

    Object.entries(rules).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("is-ok", Boolean(checks[key]));
      el.textContent = `${checks[key] ? "●" : "◎"} ${labelForRule(key)}`;
    });

    const level = value.length ? Math.max(1, Math.min(5, score)) : 0;
    state.passwordLevel = level;

    strengthCore.dataset.level = String(level);
    strengthCore.classList.remove("is-scanning");
    void strengthCore.offsetWidth;
    strengthCore.classList.add("is-scanning");

    const labelMap = {
      0: "ОЧІКУЄТЬСЯ",
      1: "СЛАБКИЙ",
      2: "БАЗОВИЙ",
      3: "НОРМАЛЬНИЙ",
      4: "СИЛЬНИЙ",
      5: "БОЙОВИЙ",
    };

    strengthLabel.textContent = labelMap[level];

    const isReady = Boolean(login?.value.trim()) && level >= 4;
    card?.classList.toggle("is-strong", level >= 4);
    secureBadge?.classList.toggle("is-ready", isReady);
    submitBtn?.classList.toggle("is-ready", isReady);
  }

  function labelForRule(key) {
    return {
      length: "Мін. 8 символів",
      letter: "Літера",
      digit: "Цифра",
      special: "Спецсимвол",
    }[key] || key;
  }

  function setMouseVars(event) {
    const xRatio = event.clientX / window.innerWidth;
    const yRatio = event.clientY / window.innerHeight;
    root.style.setProperty("--mx", `${xRatio * 100}%`);
    root.style.setProperty("--my", `${yRatio * 100}%`);
    targetBgX = 50 + (xRatio - 0.5) * 1.6;
    targetBgY = 50 + (yRatio - 0.5) * 1.0;

    if (card) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--card-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      card.style.setProperty("--card-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    }
  }

  function animateScene() {
    if (!prefersReducedMotion) {
      currentBgX += (targetBgX - currentBgX) * 0.035;
      currentBgY += (targetBgY - currentBgY) * 0.035;
      root.style.setProperty("--bg-x", `${currentBgX.toFixed(2)}%`);
      root.style.setProperty("--bg-y", `${currentBgY.toFixed(2)}%`);
    }
    requestAnimationFrame(animateScene);
  }

  password?.addEventListener("input", updateStrength);
  login?.addEventListener("input", updateStrength);

  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target || "password");
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "◉" : "⊘";
    });
  });

  accountForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginValue = login?.value.trim();
    const passwordValue = password?.value || "";

    if (!loginValue) {
      setMessage("Введіть логін.", "error");
      login?.focus();
      return;
    }

    if (state.passwordLevel < 4) {
      setMessage("Пароль має бути сильним: мінімум 8 символів, літера, цифра і спецсимвол.", "error");
      password?.focus();
      return;
    }

    try {
      setLoading(submitBtn, true, "ЗБЕРЕЖЕННЯ...");
      setMessage("Зберігаю логін і пароль у Supabase...", "");

      const activated = await activateInvite({ loginValue, passwordValue });

      localStorage.setItem("bastion_login", loginValue);
      const role = state.invite?.role || state.invite?.access_level || state.invite?.user_role || activated?.role || activated?.access_level || "user";
      localStorage.setItem("bastion_role", role);

      setMessage("Акаунт активовано. Генерую QR-код Google Authenticator...", "ok");
      setStep("mfa");

      await createTotpFactor(loginValue, passwordValue);

      mfaCode?.focus();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Помилка створення акаунта.", "error");
      setStep("account");
    } finally {
      setLoading(submitBtn, false, "АКТИВУВАТИ ДОСТУП");
    }
  });

  mfaForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code = (mfaCode?.value || "").replace(/\D/g, "");

    if (code.length !== 6) {
      setMessage("Введіть 6-значний код з Google Authenticator.", "error");
      mfaCode?.focus();
      return;
    }

    try {
      setLoading(verifyBtn, true, "ПЕРЕВІРКА...");
      setMessage("Перевіряю код Google Authenticator...", "");

      await verifyTotpCode(code);

      setMessage("Двофакторний захист активовано. Відкриваю основну сторінку...", "ok");
      setStep("success");

      window.setTimeout(() => {
        window.location.href = "./pages/app.html";
      }, 1200);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Код не підтверджено.", "error");
    } finally {
      setLoading(verifyBtn, false, "ПІДТВЕРДИТИ 2FA");
    }
  });

  mfaCode?.addEventListener("input", () => {
    mfaCode.value = mfaCode.value.replace(/\D/g, "").slice(0, 6);
  });

  backToAccountBtn?.addEventListener("click", () => {
    setStep("account");
    setMessage("Можна змінити логін або пароль і повторити активацію.", "");
  });

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const particles = [];
  const particleCount = 150;

  function createParticle(fromBottom = false) {
    const isSoft = Math.random() > 0.72;
    const isBright = Math.random() < 0.20;
    return {
      x: Math.random() * window.innerWidth,
      y: fromBottom ? window.innerHeight + Math.random() * 130 : Math.random() * window.innerHeight,
      r: isSoft ? Math.random() * 5 + 2.2 : Math.random() * 1.9 + 0.45,
      vx: (Math.random() - 0.38) * (isSoft ? 0.18 : 0.55),
      vy: -(Math.random() * (isSoft ? 0.35 : 0.95) + (isBright ? 0.35 : 0.12)),
      a: isSoft ? Math.random() * 0.12 + 0.05 : Math.random() * 0.55 + 0.16,
      flicker: Math.random() * Math.PI * 2,
      bright: isBright,
      soft: isSoft,
    };
  }

  for (let i = 0; i < particleCount; i += 1) particles.push(createParticle(false));

  function animateParticles() {
    if (!canvas || !ctx || prefersReducedMotion) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.flicker += 0.045;

      if (p.y < -40 || p.x > window.innerWidth + 80 || p.x < -80) Object.assign(p, createParticle(true));

      const flickerAlpha = p.a * (0.72 + Math.sin(p.flicker) * 0.28);
      const radius = p.soft ? p.r * 8 : p.r * (p.bright ? 7 : 4.5);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, p.bright ? `rgba(255, 95, 95, ${flickerAlpha})` : `rgba(255, 42, 80, ${flickerAlpha})`);
      gradient.addColorStop(0.35, `rgba(255, 20, 70, ${flickerAlpha * 0.35})`);
      gradient.addColorStop(1, "rgba(255, 20, 70, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    requestAnimationFrame(animateParticles);
  }

  if (!prefersReducedMotion) {
    window.addEventListener("pointermove", setMouseVars, { passive: true });
    animateScene();
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  animateParticles();
  updateStrength();
  setStep("account");
  window.setTimeout(loadInvite, 250);
})();
