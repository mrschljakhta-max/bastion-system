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
  const inviteStatusEl = document.getElementById("inviteStatus");

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
    loginValue: "",
    passwordValue: "",
    email: "",
    role: "",
    factorId: null,
    challengeId: null,
    authUserId: null,
  };

  // SECURITY: якщо login/password випадково є в URL — видаляємо з адресного рядка
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

  function getFunctionUrl(name) {
    const cfg = window.BASTION_CONFIG || {};
    const base = (cfg.SUPABASE_URL || window.SUPABASE_URL || "").replace(/\/$/, "");
    if (!base) throw new Error("SUPABASE_URL не знайдено у config.js.");
    return `${base}/functions/v1/${name}`;
  }

  function getAnonKey() {
    const cfg = window.BASTION_CONFIG || {};
    const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "";
    if (!key) throw new Error("SUPABASE_ANON_KEY не знайдено у config.js.");
    return key;
  }

  async function callEdgeFunction(name, payload) {
    const response = await fetch(getFunctionUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": getAnonKey(),
        "Authorization": `Bearer ${getAnonKey()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || `Edge Function ${name} failed`);
    }

    return data;
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
      secureBadge?.classList.remove("is-mfa-real");
    }

    if (step === "mfa") {
      setupTitle.innerHTML = "ЗАХИСТ<br />2FA";
      secureBadgeText.textContent = "MFA";
      secureBadge?.classList.add("is-mfa-real");
      statusLine.textContent = "Другий етап: відскануйте QR-код і підтвердьте Google Authenticator.";
    }

    if (step === "success") {
      setupTitle.innerHTML = "ACCESS<br />GRANTED";
      secureBadgeText.textContent = "Готово";
      statusLine.textContent = "Акаунт повністю активовано.";
    }
  }

  function normalizeInviteRpcResponse(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (data.invite) return data.invite;
    if (data.success === false) return null;
    return data;
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
      setMessage("Перевіряю персональне запрошення...", "");

      const { data, error } = await sb.rpc("get_invite_by_token", { p_token: state.token });
      if (error) throw error;

      const invite = normalizeInviteRpcResponse(data);
      if (!invite) throw new Error(data?.message || "Запрошення не знайдено або токен недійсний.");

      state.invite = invite;
      state.email = invite.email || invite.user_email || invite.invite_email || invite.recipient_email || "";
      state.role = invite.role || invite.access_level || invite.user_role || "user";

      if (inviteEmailEl) inviteEmailEl.textContent = state.email || "email не визначено";
      if (inviteRoleEl) inviteRoleEl.textContent = state.role;
      if (inviteStatusEl) inviteStatusEl.textContent = invite.status || invite.invite_status || "active";
      if (inviteMeta) inviteMeta.hidden = false;

      statusLine.textContent = "Запрошення підтверджено. Створіть логін і пароль для цього акаунта.";
      setMessage(`Запрошення підтягнуто: ${state.email} / ${state.role}`, "ok");
    } catch (err) {
      console.error(err);
      statusLine.textContent = "Не вдалося перевірити запрошення.";
      setMessage(err.message || "Помилка перевірки токена.", "error");
    }
  }

  async function ensureAuthUserAndSession(email, passwordValue, loginValue) {
    const sb = client();
    if (!sb?.auth) throw new Error("Supabase Auth client не знайдено.");

    // Щоб enroll MFA не падав з AAL2/AAL помилкою:
    // 1) пробуємо signIn, якщо user уже існує;
    // 2) якщо user не існує — signUp;
    // 3) після signUp обовʼязково робимо signOut + signInWithPassword,
    //    щоб отримати нормальну AAL1 session перед mfa.enroll().

    const firstSignIn = await sb.auth.signInWithPassword({
      email,
      password: passwordValue,
    });

    if (!firstSignIn.error && firstSignIn.data?.session) {
      state.authUserId = firstSignIn.data.user?.id || null;

      // Форсуємо оновлення session перед MFA.
      await sb.auth.refreshSession().catch(() => null);

      return firstSignIn.data;
    }

    const signUp = await sb.auth.signUp({
      email,
      password: passwordValue,
      options: {
        data: {
          login: loginValue,
          role: state.role,
          invite_token: state.token,
          source: "bastion_invite",
        },
      },
    });

    if (signUp.error) {
      throw new Error(signUp.error.message || "Не вдалося створити Supabase Auth користувача.");
    }

    state.authUserId = signUp.data?.user?.id || null;

    // Важливо: навіть якщо signUp повернув session, Supabase MFA інколи
    // вимагає свіжий signIn-контекст. Тому робимо контрольний signOut/signIn.
    await sb.auth.signOut().catch(() => null);

    const secondSignIn = await sb.auth.signInWithPassword({
      email,
      password: passwordValue,
    });

    if (secondSignIn.error || !secondSignIn.data?.session) {
      throw new Error(
        secondSignIn.error?.message ||
        "Supabase створив користувача, але не видав session. Перевір Authentication → Providers → Email → Confirm email OFF."
      );
    }

    state.authUserId = secondSignIn.data.user?.id || state.authUserId || null;

    await sb.auth.refreshSession().catch(() => null);

    return secondSignIn.data;
  }

  async function enrollRealTotpFactor() {
    const sb = client();
    if (!sb?.auth?.mfa?.enroll) {
      throw new Error("Supabase MFA API недоступний. Перевір supabase-js v2 і MFA TOTP Enabled.");
    }

    // якщо вже є незавершені фактори — це не критично; enroll створить новий
    let enrollResult = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "BASTION Google Authenticator"
    });

    if (enrollResult.error && /AAL2|required|aal/i.test(enrollResult.error.message || "")) {
      await sb.auth.refreshSession().catch(() => null);

      // Повторний signIn допомагає отримати свіжу AAL1 session перед enroll.
      if (state.email && state.passwordValue) {
        await sb.auth.signInWithPassword({
          email: state.email,
          password: state.passwordValue
        }).catch(() => null);
      }

      enrollResult = await sb.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "BASTION Google Authenticator"
      });
    }

    const { data, error } = enrollResult;

    if (error) {
      throw new Error(error.message || "Не вдалося створити TOTP фактор.");
    }

    state.factorId = data?.id || data?.totp?.id || data?.factorId;
    const qrCode = data?.totp?.qr_code;
    const secret = data?.totp?.secret;

    if (!state.factorId || !qrCode) {
      throw new Error("Supabase не повернув QR-код або factorId.");
    }

    if (qrMount) {
      qrMount.classList.remove("is-error");
      qrMount.innerHTML = qrCode.startsWith("<svg") ? qrCode : `<img src="${qrCode}" alt="MFA QR Code" />`;
    }

    if (mfaSecret) {
      mfaSecret.classList.toggle("is-hidden", !secret);
      mfaSecret.textContent = secret || "Secret приховано Supabase";
    }

    const challenge = await sb.auth.mfa.challenge({ factorId: state.factorId });

    if (challenge.error) {
      throw new Error(challenge.error.message || "Не вдалося створити MFA challenge.");
    }

    state.challengeId = challenge.data?.id;
    if (!state.challengeId) throw new Error("Supabase не повернув challengeId.");
  }

  async function completeInviteAfterMfa() {
    const sb = client();
    if (!sb?.rpc) throw new Error("Supabase RPC недоступний.");

    const payload = {
      p_token: state.token,
      p_login: state.loginValue,
      p_password: state.passwordValue
    };

    let result = await sb.rpc("complete_invite_setup_v2", payload);

    if (result.error) {
      // fallback на стару назву, якщо вона ще використовується
      result = await sb.rpc("activate_user_invite", payload);
    }

    if (result.error) {
      throw new Error(result.error.message || "MFA підтверджено, але invite не вдалося завершити.");
    }

    localStorage.setItem("bastion_login", state.loginValue);
    localStorage.setItem("bastion_role", state.role || "user");
    localStorage.setItem("bastion_email", state.email || "");

    return result.data;
  }

  async function verifyTotpCode(code) {
    const sb = client();

    if (!state.factorId || !state.challengeId) {
      throw new Error("MFA challenge не створено. Поверніться на попередній етап.");
    }

    const { data, error } = await sb.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: state.challengeId,
      code
    });

    if (error) {
      throw new Error(error.message || "Код Google Authenticator не підтверджено.");
    }

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

    const isReady = Boolean(login?.value.trim()) && level >= 4 && Boolean(state.email);
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

    if (!state.email) {
      setMessage("Email запрошення ще не підтягнуто. Оновіть сторінку або перевірте token.", "error");
      return;
    }

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
      state.loginValue = loginValue;
      state.passwordValue = passwordValue;

      setLoading(submitBtn, true, "СТВОРЕННЯ AUTH...");
      setMessage("Створюю/оновлюю Supabase Auth акаунт для цього логіна...", "edge");

      const authData = await ensureAuthUserAndSession(state.email, passwordValue, loginValue);
      state.authUserId = authData?.user?.id || state.authUserId || null;

      setLoading(submitBtn, true, "ГЕНЕРАЦІЯ MFA...");
      setMessage("Генерую серверний TOTP secret для Google Authenticator...", "edge");

      const data = await callEdgeFunction("bastion-setup-mfa", {
        token: state.token,
        login: loginValue,
        password: passwordValue
      });

      if (qrMount) {
        qrMount.classList.remove("is-error");
        qrMount.innerHTML = `<img src="${data.qr_url}" alt="Google Authenticator QR Code">`;
      }

      if (mfaSecret) {
        mfaSecret.classList.remove("is-hidden");
        mfaSecret.textContent = data.secret || "Secret приховано";
      }

      setStep("mfa");
      setMessage(`QR створено для ${data.email}. Відскануйте його у Google Authenticator.`, "ok");
      mfaCode?.focus();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Помилка створення MFA.", "error");
      setStep("account");
      if (qrMount) {
        qrMount.classList.add("is-error");
        qrMount.textContent = error.message || "Помилка MFA";
      }
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
      setMessage("Перевіряю код через серверну Edge Function...", "edge");

      const result = await callEdgeFunction("bastion-verify-mfa", {
        token: state.token,
        code
      });

      const sb = client();
      if (sb?.rpc) {
        const { error: bindError } = await sb.rpc("bastion_finalize_invite_auth_mapping", {
          p_token: state.token,
          p_login: state.loginValue,
          p_auth_user_id: state.authUserId || null
        });

        if (bindError) {
          console.warn("BASTION auth mapping warning:", bindError);
        }
      }

      localStorage.setItem("bastion_login", result.login || state.loginValue);
      localStorage.setItem("bastion_role", result.role || state.role || "user");
      localStorage.setItem("bastion_email", result.email || state.email || "");

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

  backToAccountBtn?.addEventListener("click", async () => {
    setStep("account");
    setMessage("Можна змінити логін або пароль і повторити генерацію MFA.", "");
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
