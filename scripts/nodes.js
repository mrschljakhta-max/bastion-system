(() => {
  "use strict";

  const relations = [
    {
      id: "ew-matrix",
      name: "EW MATRIX",
      dictionaries: ["STATIONS", "UAV", "MODE", "WEATHER"],
    },
    {
      id: "supply-chain",
      name: "SUPPLY CHAIN",
      dictionaries: ["UNITS", "BRIGADES", "SUPPLY"],
    },
    {
      id: "radar-network",
      name: "RADAR NETWORK",
      dictionaries: ["STATIONS", "RADAR", "FREQUENCY", "SETTLEMENTS", "UNITS"],
    },
    {
      id: "air-picture",
      name: "AIR PICTURE",
      dictionaries: ["UAV", "ROUTES", "AZIMUTH", "WEATHER"],
    },
  ];

  const positions = [
    { x: -540, scale: .66, opacity: .38, z: 1 },
    { x: -292, scale: .82, opacity: .72, z: 5 },
    { x: 0, scale: 1.24, opacity: 1, z: 12 },
    { x: 292, scale: .82, opacity: .72, z: 5 },
    { x: 540, scale: .66, opacity: .38, z: 1 },
  ];

  const state = {
    active: 0,
    flippedId: null,
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

  function render() {
    const cards = allCards();
    const total = cards.length;
    carousel.innerHTML = cards.map((card, index) => {
      const isCreate = card.kind === "create";
      const dictionaryCount = card.dictionaries.length;
      const list = card.dictionaries.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
      const frontContent = isCreate
        ? `<div class="relation-create-plus">+</div><div class="relation-create-text">СТВОРИТИ<br>ЗВ’ЯЗОК</div>`
        : `<div class="relation-title">${escapeHtml(card.name)}</div><div class="relation-count">${dictionaryCount}</div><div class="relation-count-label">ДОВІДНИКИ</div>`;
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
    }).join("");

    carousel.querySelectorAll(".relation-card").forEach((el) => {
      const index = Number(el.dataset.cardIndex || 0);
      const delta = circularDelta(index, state.active, total);
      const p = positionFor(delta);
      el.style.setProperty("--x", `${p.x}px`);
      el.style.setProperty("--scale", p.scale);
      el.style.setProperty("--opacity", p.opacity);
      el.style.setProperty("--z", p.z);
      el.classList.toggle("is-active", delta === 0);
      el.classList.toggle("is-flipped", el.dataset.cardId === state.flippedId);
      el.hidden = Math.abs(delta) > 2;
    });
  }

  function setActive(index) {
    const total = allCards().length;
    state.active = (index + total) % total;
    state.flippedId = null;
    render();
  }

  function flipActive() {
    const activeEl = carousel.querySelector(".relation-card.is-active");
    if (!activeEl || activeEl.classList.contains("is-create")) return;
    state.flippedId = state.flippedId === activeEl.dataset.cardId ? null : activeEl.dataset.cardId;
    render();
  }

  carousel.addEventListener("click", (event) => {
    const card = event.target.closest(".relation-card");
    if (!card) return;
    const index = Number(card.dataset.cardIndex || 0);
    if (index !== state.active) {
      setActive(index);
      return;
    }
    if (card.classList.contains("is-create")) {
      window.dispatchEvent(new CustomEvent("bastion:nodes-create-relation"));
      return;
    }
    // Таблиця зв'язку буде підключена наступним етапом.
    card.classList.add("is-pulse");
    setTimeout(() => card.classList.remove("is-pulse"), 260);
  });

  carousel.addEventListener("mousemove", (event) => {
    const card = event.target.closest(".relation-card.is-active");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--ry", `${px * 10.5}deg`);
    card.style.setProperty("--rx", `${py * -10.5}deg`);
  });

  carousel.addEventListener("mouseleave", () => {
    carousel.querySelectorAll(".relation-card").forEach((card) => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

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
      render();
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

  render();
})();
