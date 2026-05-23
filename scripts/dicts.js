/* BASTION DICTS v167 — Supabase registry carousel + create-dictionary modal */
(() => {
  const STATIC_FALLBACK = [
    { code: "bands", table_name: "dict_bands", title: "BANDS", title_ua: "Діапазони", records_count: 58, sort_order: 10 },
    { code: "settlements", table_name: "dict_settlements", title: "SETTLEMENTS", title_ua: "Населені пункти", records_count: 124, sort_order: 20 },
    { code: "uav", table_name: "dict_uav", title: "UAV", title_ua: "БПЛА", records_count: 152, sort_order: 30 },
    { code: "stations", table_name: "dict_stations", title: "STATIONS", title_ua: "Станції", records_count: 87, sort_order: 40 },
    { code: "units", table_name: "dict_units", title: "UNITS", title_ua: "Підрозділи", records_count: 96, sort_order: 50 },
    { code: "cover_objects", table_name: "dict_cover_objects", title: "COVER OBJECTS", title_ua: "Об’єкти прикриття", records_count: 63, sort_order: 60 }
  ];

  const carousel = document.getElementById("dictsCarousel");
  const left = document.querySelector(".dicts-arrow--left");
  const right = document.querySelector(".dicts-arrow--right");
  const modal = document.getElementById("dictCreateModal");
  const form = document.getElementById("dictCreateForm");
  const columnsBox = document.getElementById("dictColumnsBox");
  const addColumnBtn = document.getElementById("dictAddColumnBtn");
  const statusEl = document.getElementById("dictCreateStatus");
  const closeBtns = document.querySelectorAll("[data-dict-modal-close]");

  let folders = [];
  let registryRows = [];
  let active = 0;

  const TYPE_OPTIONS = [
    ["text", "Текст"],
    ["integer", "Ціле число"],
    ["numeric", "Число"],
    ["boolean", "Так / ні"],
    ["date", "Дата"],
    ["timestamptz", "Дата + час"],
    ["jsonb", "JSON"]
  ];

  function getClient() {
    return window.BastionSupabase || window.supabaseClient || window.sb || null;
  }

  function formatCount(value) {
    const count = Number(value || 0);
    if (count === 1) return "1 запис";
    return `${count} записи`;
  }

  function transliterate(value) {
    const map = {
      а:"a", б:"b", в:"v", г:"h", ґ:"g", д:"d", е:"e", є:"ie", ж:"zh", з:"z", и:"y", і:"i", ї:"i", й:"i",
      к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch",
      ш:"sh", щ:"shch", ь:"", ю:"iu", я:"ia", ы:"y", э:"e", ё:"yo", ъ:""
    };
    return String(value || "")
      .trim()
      .toLowerCase()
      .split("")
      .map((ch) => map[ch] ?? ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_")
      .slice(0, 48);
  }

  function normalizeCode(title) {
    const code = transliterate(title);
    return /^[a-z]/.test(code) ? code : `dict_${code || Date.now()}`;
  }

  function createFolder(row, isAdd = false) {
    const button = document.createElement("button");
    button.className = isAdd ? "dict-folder dict-folder--add" : "dict-folder";
    button.type = "button";
    button.dataset.key = isAdd ? "__add__" : row.code;
    if (!isAdd) button.dataset.table = row.table_name || "";
    button.innerHTML = `
      <span class="dict-folder__inner">
        <b class="dict-folder__title">${isAdd ? "+ ДОДАТИ" : escapeHtml(row.title || row.title_ua || row.code)}</b>
        <i class="dict-folder__count">${isAdd ? "ДОВІДНИК" : formatCount(row.records_count)}</i>
      </span>
    `;
    button.addEventListener("click", () => {
      const index = folders.indexOf(button);
      active = index >= 0 ? index : active;
      renderCarousel();
      if (isAdd) openCreateModal();
    });
    return button;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function circularDistance(index, center, length) {
    let distance = index - center;
    if (distance > length / 2) distance -= length;
    if (distance < -length / 2) distance += length;
    return distance;
  }

  function renderCarousel() {
    folders = [...carousel.querySelectorAll(".dict-folder")];
    if (!folders.length) return;
    active = (active + folders.length) % folders.length;

    folders.forEach((folder, index) => {
      folder.classList.remove("dict-folder--side", "dict-folder--mid", "dict-folder--active");
      const distance = circularDistance(index, active, folders.length);
      const absDistance = Math.abs(distance);

      if (distance === 0) {
        folder.dataset.slot = "0";
        folder.classList.add("dict-folder--active");
      } else if (absDistance === 1) {
        folder.dataset.slot = String(distance);
        folder.classList.add("dict-folder--mid");
      } else if (absDistance === 2) {
        folder.dataset.slot = String(distance);
        folder.classList.add("dict-folder--side");
      } else {
        folder.dataset.slot = "hidden";
      }
    });
  }

  function rotate(direction) {
    if (!folders.length) return;
    active = (active + direction + folders.length) % folders.length;
    renderCarousel();
  }

  async function loadRegistry() {
    const client = getClient();
    if (!client) {
      console.warn("[BASTION DICTS] Supabase client not found. Static fallback enabled.");
      return STATIC_FALLBACK;
    }

    const { data, error } = await client
      .from("dict_registry")
      .select("id, code, table_name, title, title_ua, category, records_count, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[BASTION DICTS] dict_registry unavailable. Static fallback enabled.", error);
      return STATIC_FALLBACK;
    }

    return data?.length ? data : STATIC_FALLBACK;
  }

  async function rebuildCarousel() {
    registryRows = await loadRegistry();
    carousel.innerHTML = "";
    registryRows.forEach((row) => carousel.appendChild(createFolder(row)));
    carousel.appendChild(createFolder({}, true));
    folders = [...carousel.querySelectorAll(".dict-folder")];
    active = Math.min(1, folders.length - 1);
    renderCarousel();
  }

  function buildTypeSelect() {
    return TYPE_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  }

  function addColumnRow(name = "name", type = "text") {
    const row = document.createElement("div");
    row.className = "dict-column-row";
    row.innerHTML = `
      <input class="dict-column-name" type="text" value="${escapeHtml(name)}" placeholder="Назва колонки, напр. name" required />
      <select class="dict-column-type">${buildTypeSelect()}</select>
      <button class="dict-column-remove" type="button" aria-label="Видалити колонку">×</button>
    `;
    row.querySelector("select").value = type;
    row.querySelector(".dict-column-remove").addEventListener("click", () => {
      if (columnsBox.querySelectorAll(".dict-column-row").length > 1) row.remove();
    });
    columnsBox.appendChild(row);
  }

  function resetCreateForm() {
    form?.reset();
    columnsBox.innerHTML = "";
    addColumnRow("name", "text");
    addColumnRow("alias", "text");
    setStatus("");
  }

  function openCreateModal() {
    resetCreateForm();
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
    setTimeout(() => document.getElementById("dictTitleInput")?.focus(), 30);
  }

  function closeCreateModal() {
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.dataset.type = type;
  }

  function collectColumns() {
    return [...columnsBox.querySelectorAll(".dict-column-row")].map((row) => ({
      name: normalizeCode(row.querySelector(".dict-column-name")?.value || ""),
      type: row.querySelector(".dict-column-type")?.value || "text"
    })).filter((column) => column.name && column.name !== "id");
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    const client = getClient();
    const titleInput = document.getElementById("dictTitleInput");
    const titleUaInput = document.getElementById("dictTitleUaInput");
    const titleUa = titleUaInput?.value?.trim() || titleInput?.value?.trim();
    const title = transliterate(titleInput?.value || "").replaceAll("_", " ").toUpperCase() || titleInput?.value?.trim()?.toUpperCase();
    const code = normalizeCode(titleUa || title);
    const columns = collectColumns();

    if (!client) {
      setStatus("Supabase client не знайдено. Перевір підключення config.js та supabase-client.js.", "error");
      return;
    }
    if (!titleUa || !code) {
      setStatus("Введи назву довідника.", "error");
      return;
    }
    if (!columns.length) {
      setStatus("Додай хоча б одну колонку.", "error");
      return;
    }

    setStatus("Створюю довідник у Supabase…", "loading");

    const { error } = await client.rpc("create_dictionary", {
      p_title: title,
      p_title_ua: titleUa,
      p_code: code,
      p_columns: columns
    });

    if (error) {
      console.error("[BASTION DICTS] create_dictionary failed", error);
      setStatus(`Помилка: ${error.message || "RPC create_dictionary не виконалась"}`, "error");
      return;
    }

    setStatus("Довідник створено. Оновлюю карусель…", "success");
    await rebuildCarousel();
    setTimeout(closeCreateModal, 650);
  }

  function initSitemapDots() {
    const pageMap = {
      core: "./app.html",
      dicts: "./dicts.html",
      nodes: "./nodes.html",
      upload: "./upload.html",
      calculator: "./calculator.html",
      analysis: "./analysis.html",
      command: "./command.html"
    };

    document.querySelectorAll(".map-dot").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const href = pageMap[dot.dataset.target];
        if (href) window.location.href = href;
      });
    });
  }

  function bindEvents() {
    left?.addEventListener("click", () => rotate(-1));
    right?.addEventListener("click", () => rotate(1));
    addColumnBtn?.addEventListener("click", () => addColumnRow("", "text"));
    form?.addEventListener("submit", handleCreateSubmit);
    closeBtns.forEach((button) => button.addEventListener("click", closeCreateModal));
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeCreateModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") rotate(-1);
      if (event.key === "ArrowRight") rotate(1);
      if (event.key === "Escape" && modal?.classList.contains("is-open")) closeCreateModal();
    });
  }

  bindEvents();
  initSitemapDots();
  rebuildCarousel();
})();
