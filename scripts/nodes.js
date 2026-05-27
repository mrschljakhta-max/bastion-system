(() => {
  "use strict";

  const relations = [
    { id: "ew-matrix", name: "EW MATRIX", dictionaries: ["STATIONS", "UAV", "MODE", "WEATHER"] },
    { id: "supply-chain", name: "SUPPLY CHAIN", dictionaries: ["UNITS", "BRIGADES", "SUPPLY"] },
    { id: "radar-network", name: "RADAR NETWORK", dictionaries: ["STATIONS", "RADAR", "FREQUENCY", "SETTLEMENTS", "UNITS"] },
    { id: "air-picture", name: "AIR PICTURE", dictionaries: ["UAV", "ROUTES", "AZIMUTH", "WEATHER"] },
  ];

  const positions = [
    { x: -540, y: 2, scale: .68, opacity: .40, z: 1, rot: -7 },
    { x: -292, y: -3, scale: .84, opacity: .74, z: 5, rot: -4 },
    { x: 0, y: 0, scale: 1.18, opacity: 1, z: 12, rot: 0 },
    { x: 292, y: -3, scale: .84, opacity: .74, z: 5, rot: 4 },
    { x: 540, y: 2, scale: .68, opacity: .40, z: 1, rot: 7 },
  ];

  const state = {
    active: 0,
    flippedId: null,
    isAnimating: false,
  };

  const carousel = document.getElementById("relationsCarousel");
  const prevBtn = document.querySelector("[data-rel-prev]");
  const nextBtn = document.querySelector("[data-rel-next]");

  if (!carousel) return;

  function allCards() {
    return [
      ...relations.map((relation, index) => ({ ...relation, kind: "relation", index })),
      { id: "create-relation", name: "СТВОРИТИ ЗВ’ЯЗОК", dictionaries: [], kind: "create", index: relations.length },
    ];
  }

  function circularDelta(index, active, total) {
    let delta = index - active;
    const half = Math.floor(total / 2);
    if (delta > half) delta -= total;
    if (delta < -half) delta += total;
    return delta;
  }

  function positionFor(delta) {
    const bounded = Math.max(-2, Math.min(2, delta));
    return positions[bounded + 2];
  }

  function buildCard(card, index) {
    const isCreate = card.kind === "create";
    const dictionaryCount = card.dictionaries.length;
    const list = card.dictionaries.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
    const frontContent = isCreate
      ? `<div class="relation-create-plus">+</div><div class="relation-create-text">СТВОРИТИ<br>ЗВ’ЯЗОК</div>`
      : `<div class="relation-title">${escapeHtml(card.name)}</div><div class="relation-count">${dictionaryCount}</div><div class="relation-count-label">довідники</div>`;
    const backContent = isCreate
      ? `<div class="relation-create-plus">+</div><div class="relation-create-text">RELATION<br>BUILDER</div>`
      : `<div class="relation-back-heading">ДОВІДНИКИ</div><ul class="relation-dict-list">${list}</ul>`;

    return `
      <button class="relation-card${isCreate ? " is-create" : ""}" type="button" data-card-index="${index}" data-card-id="${card.id}" aria-label="${escapeAttr(card.name)}">
        <span class="relation-card__tilt">
          <span class="relation-card__inner">
            <span class="relation-card__face relation-card__face--front">
              <span class="relation-card__frame"></span>
              <span class="relation-card__content">${frontContent}</span>
            </span>
            <span class="relation-card__face relation-card__face--back">
              <span class="relation-card__frame"></span>
              <span class="relation-card__content">${backContent}</span>
            </span>
          </span>
        </span>
      </button>
    `;
  }

  function initialRender() {
    carousel.innerHTML = allCards().map((card, index) => buildCard(card, index)).join("");
    updateCards(false);
  }

  function updateCards(animate = true) {
    const cards = allCards();
    const total = cards.length;

    if (animate) {
      state.isAnimating = true;
      carousel.classList.add("is-carousel-moving");
      window.clearTimeout(updateCards._timer);
      updateCards._timer = window.setTimeout(() => {
        state.isAnimating = false;
        carousel.classList.remove("is-carousel-moving");
      }, 760);
    }

    carousel.querySelectorAll(".relation-card").forEach((el) => {
      const index = Number(el.dataset.cardIndex || 0);
      const delta = circularDelta(index, state.active, total);
      const p = positionFor(delta);
      const hidden = Math.abs(delta) > 2;

      el.style.setProperty("--x", `${p.x}px`);
      el.style.setProperty("--y", `${p.y}px`);
      el.style.setProperty("--scale", p.scale);
      el.style.setProperty("--opacity", p.opacity);
      el.style.setProperty("--z", p.z);
      el.style.setProperty("--orbit-rot", `${p.rot}deg`);
      el.style.setProperty("--delta", delta);

      el.classList.toggle("is-active", delta === 0);
      el.classList.toggle("is-flipped", el.dataset.cardId === state.flippedId);
      el.classList.toggle("is-left", delta < 0);
      el.classList.toggle("is-right", delta > 0);
      el.classList.toggle("is-hidden", hidden);
      el.setAttribute("aria-hidden", hidden ? "true" : "false");
      el.tabIndex = hidden ? -1 : 0;
    });
  }

  function setActive(index) {
    const total = allCards().length;
    if (state.isAnimating) return;
    state.active = (index + total) % total;
    state.flippedId = null;
    resetTilt();
    updateCards(true);
  }

  function flipActive() {
    const activeEl = carousel.querySelector(".relation-card.is-active");
    if (!activeEl || activeEl.classList.contains("is-create")) return;
    activeEl.classList.add("is-flip-boost");
    window.setTimeout(() => activeEl.classList.remove("is-flip-boost"), 720);
    state.flippedId = state.flippedId === activeEl.dataset.cardId ? null : activeEl.dataset.cardId;
    updateCards(false);
  }

  function resetTilt() {
    carousel.querySelectorAll(".relation-card").forEach((card) => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }

  carousel.addEventListener("click", (event) => {
    const card = event.target.closest(".relation-card");
    if (!card || card.classList.contains("is-hidden")) return;
    const index = Number(card.dataset.cardIndex || 0);
    if (index !== state.active) {
      setActive(index);
      return;
    }
    if (card.classList.contains("is-create")) {
      window.dispatchEvent(new CustomEvent("bastion:nodes-create-relation"));
      return;
    }
    card.classList.add("is-pulse");
    setTimeout(() => card.classList.remove("is-pulse"), 320);
  });

  carousel.addEventListener("mousemove", (event) => {
    const card = event.target.closest(".relation-card.is-active");
    if (!card || state.isAnimating) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--ry", `${px * 10}deg`);
    card.style.setProperty("--rx", `${py * -10}deg`);
  });

  carousel.addEventListener("mouseleave", resetTilt);

  prevBtn?.addEventListener("click", () => setActive(state.active - 1));
  nextBtn?.addEventListener("click", () => setActive(state.active + 1));

  document.addEventListener("keydown", (event) => {
    const tag = (event.target && event.target.tagName || "").toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return;
    if (event.code === "Space") {
      event.preventDefault();
      flipActive();
    }
    if (event.key === "Escape") {
      state.flippedId = null;
      updateCards(false);
    }
    if (event.key === "ArrowLeft") setActive(state.active - 1);
    if (event.key === "ArrowRight") setActive(state.active + 1);
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("\n", " ");
  }

  initialRender();
})();
