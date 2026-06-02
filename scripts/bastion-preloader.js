(function () {
  "use strict";

  const TARGET_PAGES = new Map([
    ["app.html", "ІНІЦІАЛІЗАЦІЯ ЯДРА"],
    ["dicts.html", "ЗАВАНТАЖЕННЯ ДОВІДНИКІВ"],
    ["nodes.html", "ПОБУДОВА ЗВ'ЯЗКІВ"],
    ["upload.html", "ІНІЦІАЛІЗАЦІЯ ІМПОРТУ"],
  ]);

  const MIN_VISIBLE_MS = 3000;
  const START_PROGRESS = 20;
  const startTime = performance.now();
  let progressTimer = null;
  let currentProgress = START_PROGRESS;
  let targetProgress = START_PROGRESS;

  function pageKeyFromUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.pathname.split("/").pop() || "app.html";
    } catch (_) {
      return String(url || "").split("/").pop().split(/[?#]/)[0];
    }
  }

  function getStatusForCurrentPage() {
    const key = pageKeyFromUrl(window.location.href);
    return TARGET_PAGES.get(key) || "ІНІЦІАЛІЗАЦІЯ МОДУЛЯ";
  }

  function isTargetHref(href) {
    const key = pageKeyFromUrl(href);
    return TARGET_PAGES.has(key);
  }

  function getResolvedHref(link) {
    const raw = link.getAttribute("href") || link.getAttribute("xlink:href") || "";
    try {
      return new URL(raw, window.location.href).href;
    } catch (_) {
      return raw;
    }
  }

  function getOverlay() {
    let overlay = document.getElementById("bastionPagePreloader");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bastionPagePreloader";
      overlay.className = "bastion-preloader";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      document.body.prepend(overlay);
    }

    if (overlay.dataset.preloaderVersion !== "345") {
      overlay.innerHTML = [
        '<div class="bastion-preloader__stage">',
        '  <div class="bastion-preloader__fingerprint">',
        '    <img class="bastion-preloader__image" src="../assets/preloaders/bastion-fingerprint-preloader.png" alt="Ініціалізація BASTION" decoding="async" />',
        '  </div>',
        '  <div class="bastion-preloader__percent" data-preloader-percent>20%</div>',
        '  <div class="bastion-preloader__status" data-preloader-status>ІНІЦІАЛІЗАЦІЯ МОДУЛЯ</div>',
        '  <div class="bastion-preloader__bar-shell">',
        '    <div class="bastion-preloader__bar" aria-hidden="true"><span class="bastion-preloader__bar-fill" data-preloader-fill></span></div>',
        '  </div>',
        '</div>'
      ].join("");
      overlay.dataset.preloaderVersion = "345";
    }

    return overlay;
  }

  function setProgress(value) {
    currentProgress = Math.max(START_PROGRESS, Math.min(100, Math.round(value)));
    const overlay = getOverlay();
    const fill = overlay.querySelector("[data-preloader-fill]");
    const percent = overlay.querySelector("[data-preloader-percent]");
    if (fill) fill.style.width = currentProgress + "%";
    if (percent) percent.textContent = currentProgress + "%";
  }

  function setTarget(value) {
    targetProgress = Math.max(targetProgress, Math.min(96, Math.round(value)));
  }

  function setStatus(text) {
    const node = getOverlay().querySelector("[data-preloader-status]");
    if (node) node.textContent = text || "ІНІЦІАЛІЗАЦІЯ МОДУЛЯ";
  }

  function showPreloader(status) {
    const overlay = getOverlay();
    overlay.classList.remove("is-hidden");
    document.body.classList.add("bastion-preloader-lock");
    setStatus(status || getStatusForCurrentPage());
    currentProgress = START_PROGRESS;
    targetProgress = START_PROGRESS;
    setProgress(START_PROGRESS);
  }

  function hidePreloader() {
    const overlay = getOverlay();
    setProgress(100);
    window.setTimeout(() => {
      overlay.classList.add("is-hidden");
      document.body.classList.remove("bastion-preloader-lock");
      window.setTimeout(() => overlay.remove(), 520);
      document.dispatchEvent(new CustomEvent("bastion:preloader:done"));
    }, 260);
  }

  function waitWindowLoad() {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }

  function waitFonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3500))
    ]);
  }

  function waitImages() {
    const images = Array.from(document.images || []);
    if (!images.length) return Promise.resolve();
    const jobs = images.map((img) => {
      if (img.complete && img.naturalWidth !== 0) {
        if (typeof img.decode === "function") return img.decode().catch(() => undefined);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    });
    return Promise.race([
      Promise.all(jobs),
      new Promise((resolve) => setTimeout(resolve, 7000))
    ]);
  }

  function waitCriticalUi() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function minDelay() {
    const elapsed = performance.now() - startTime;
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_VISIBLE_MS - elapsed)));
  }

  function animateProgress() {
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      if (currentProgress < targetProgress) {
        const step = Math.max(1, Math.ceil((targetProgress - currentProgress) * 0.10));
        setProgress(currentProgress + step);
      } else if (currentProgress < 94 && targetProgress >= 92) {
        setProgress(currentProgress + 1);
      }
    }, 135);
  }

  function initPreloader() {
    showPreloader(getStatusForCurrentPage());
    animateProgress();

    Promise.all([
      waitWindowLoad().then(() => setTarget(54)),
      waitImages().then(() => setTarget(76)),
      waitFonts().then(() => setTarget(86)),
      waitCriticalUi().then(() => setTarget(92)),
      minDelay()
    ]).then(() => {
      clearInterval(progressTimer);
      hidePreloader();
    });
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute("href") || link.getAttribute("xlink:href");
    if (!href || href.startsWith("#") || link.target === "_blank") return;
    if (!isTargetHref(href)) return;
    event.preventDefault();
    const key = pageKeyFromUrl(href);
    const resolvedHref = getResolvedHref(link);
    showPreloader(TARGET_PAGES.get(key));
    animateProgress();
    setTarget(34);
    setTimeout(() => { window.location.href = resolvedHref; }, 220);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPreloader, { once: true });
  } else {
    initPreloader();
  }
})();
