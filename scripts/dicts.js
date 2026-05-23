/* BASTION DICTS v167 — Supabase registry + create dictionary modal */
(() => {
  const carousel = document.getElementById("dictsCarousel");
  const left = document.querySelector(".dicts-arrow--left");
  const right = document.querySelector(".dicts-arrow--right");

  const fallbackDictionaries = [
    { code: "projectiles", table_name: "dict_projectiles", title: "СНАРЯДИ", records_count: 0, sort_order: 10 },
    { code: "charges", table_name: "dict_charges", title: "ЗАРЯДИ", records_count: 0, sort_order: 20 },
    { code: "fuzes", table_name: "dict_fuzes", title: "ПІДРИВНИКИ", records_count: 0, sort_order: 30 },
    { code: "units", table_name: "dict_units", title: "ПІДРОЗДІЛИ", records_count: 0, sort_order: 40 }
  ];

  let folders = [];
  let active = 0;
  let sb = null;

  function createSupabaseClient() {
    const cfg = window.BASTION_CONFIG || {};
    const url = cfg.SUPABASE_URL || window.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    if (!window.supabase || !url || !key) return null;
    return window.supabase.createClient(url, key);
  }

  function countLabel(value) {
    const n = Number(value || 0);
    if (n === 1) return "1 запис";
    if (n >= 2 && n <= 4) return `${n} записи`;
    return `${n} записів`;
  }

  function sanitizeColumnName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[а]/g, "a")
      .replace(/[б]/g, "b")
      .replace(/[в]/g, "v")
      .replace(/[гґ]/g, "g")
      .replace(/[д]/g, "d")
      .replace(/[еє]/g, "e")
      .replace(/[ж]/g, "zh")
      .replace(/[з]/g, "z")
      .replace(/[иі]/g, "i")
      .replace(/[ї]/g, "yi")
      .replace(/[й]/g, "y")
      .replace(/[к]/g, "k")
      .replace(/[л]/g, "l")
      .replace(/[м]/g, "m")
      .replace(/[н]/g, "n")
      .replace(/[о]/g, "o")
      .replace(/[п]/g, "p")
      .replace(/[р]/g, "r")
      .replace(/[с]/g, "s")
      .replace(/[т]/g, "t")
      .replace(/[у]/g, "u")
      .replace(/[ф]/g, "f")
      .replace(/[х]/g, "kh")
      .replace(/[ц]/g, "ts")
      .replace(/[ч]/g, "ch")
      .replace(/[ш]/g, "sh")
      .replace(/[щ]/g, "shch")
      .replace(/[ю]/g, "yu")
      .replace(/[я]/g, "ya")
      .replace(/[ь'’`]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "col_$1");
  }

  function buildFolder(item, isAdd = false) {
    const button = document.createElement("button");
    button.className = `dict-folder${isAdd ? " dict-folder--add" : ""}`;
    button.type = "button";
    if (isAdd) {
      button.dataset.action = "add-dict";
    } else {
      button.dataset.key = item.code || item.table_name || item.title;
      button.dataset.table = item.table_name || "";
      button.dataset.registryId = item.id || "";
    }

    const inner = document.createElement("span");
    inner.className = "dict-folder__inner";

    const title = document.createElement("b");
    title.className = "dict-folder__title";
    title.textContent = isAdd ? "+ ДОДАТИ" : (item.title || item.title_ua || item.code || "ДОВІДНИК").toUpperCase();

    const count = document.createElement("i");
    count.className = "dict-folder__count";
    count.textContent = isAdd ? "довідник" : countLabel(item.records_count);

    inner.append(title, count);
    button.append(inner);
    return button;
  }

  function circularDistance(index, center, length) {
    let distance = index - center;
    if (distance > length / 2) distance -= length;
    if (distance < -length / 2) distance += length;
    return distance;
  }

  function renderCarouselPositions() {
    if (!folders.length) return;
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

  function setCarouselItems(items) {
    if (!carousel) return;
    carousel.innerHTML = "";
    const visibleItems = (items && items.length ? items : fallbackDictionaries)
      .filter((item) => item.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));

    visibleItems.forEach((item) => carousel.appendChild(buildFolder(item)));
    carousel.appendChild(buildFolder({}, true));
    folders = [...carousel.querySelectorAll(".dict-folder")];
    active = Math.min(1, Math.max(0, folders.length - 1));

    folders.forEach((folder, index) => {
      folder.addEventListener("click", () => {
        active = index;
        renderCarouselPositions();
        if (folder.dataset.action === "add-dict") openCreateModal();
      });
    });

    renderCarouselPositions();
  }

  async function loadRegistry() {
    sb = createSupabaseClient();
    if (!sb) {
      setCarouselItems(fallbackDictionaries);
      return;
    }

    const { data, error } = await sb
      .from("dict_registry")
      .select("id, code, table_name, title, title_ua, records_count, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("BASTION dict_registry fallback:", error.message);
      setCarouselItems(fallbackDictionaries);
      return;
    }

    setCarouselItems(data || fallbackDictionaries);
  }

  function rotate(direction) {
    if (!folders.length) return;
    active = (active + direction + folders.length) % folders.length;
    renderCarouselPositions();
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

  const modal = document.getElementById("dictCreateModal");
  const form = document.getElementById("dictCreateForm");
  const titleInput = document.getElementById("dictTitleInput");
  const columnsList = document.getElementById("dictColumnsList");
  const addColumnBtn = document.getElementById("addDictColumnBtn");
  const statusEl = document.getElementById("dictCreateStatus");

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.dataset.type = type;
  }

  function openCreateModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    setStatus("");
    setTimeout(() => titleInput?.focus(), 60);
  }

  function closeCreateModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function createColumnRow(name = "", type = "text") {
    const row = document.createElement("div");
    row.className = "dict-column-row";
    row.innerHTML = `
      <input type="text" value="${name}" data-column-name required />
      <select data-column-type>
        <option value="text">Текст</option>
        <option value="integer">Ціле число</option>
        <option value="numeric">Число</option>
        <option value="date">Дата</option>
        <option value="boolean">Так / Ні</option>
      </select>
      <button type="button" class="dict-remove-column" aria-label="Прибрати колонку">×</button>
    `;
    row.querySelector("select").value = type;
    row.querySelector(".dict-remove-column").addEventListener("click", () => {
      if (columnsList.querySelectorAll(".dict-column-row").length <= 1) {
        setStatus("Має залишитись хоча б одна колонка.", "error");
        return;
      }
      row.remove();
    });
    return row;
  }

  addColumnBtn?.addEventListener("click", () => {
    columnsList?.appendChild(createColumnRow("note", "text"));
  });

  columnsList?.querySelectorAll(".dict-remove-column").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (columnsList.querySelectorAll(".dict-column-row").length > 1) btn.closest(".dict-column-row")?.remove();
    });
  });

  document.querySelectorAll("[data-close-dict-modal]").forEach((item) => item.addEventListener("click", closeCreateModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCreateModal();
    if (event.key === "ArrowLeft") rotate(-1);
    if (event.key === "ArrowRight") rotate(1);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sb) sb = createSupabaseClient();
    if (!sb) {
      setStatus("Supabase не підключений. Перевір scripts/config.js.", "error");
      return;
    }

    const title = titleInput.value.trim();
    const rows = [...columnsList.querySelectorAll(".dict-column-row")];
    const columns = rows.map((row) => {
      const rawName = row.querySelector("[data-column-name]").value;
      return {
        name: sanitizeColumnName(rawName),
        type: row.querySelector("[data-column-type]").value
      };
    }).filter((col) => col.name);

    const uniqueNames = new Set(columns.map((col) => col.name));
    if (!title) return setStatus("Введи назву довідника.", "error");
    if (!columns.length) return setStatus("Додай хоча б одну колонку.", "error");
    if (uniqueNames.size !== columns.length) return setStatus("Назви колонок не повинні дублюватись.", "error");

    setStatus("Створюю довідник у Supabase...", "loading");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await sb.rpc("create_bastion_dictionary", {
      p_title: title,
      p_columns: columns
    });

    submitBtn.disabled = false;

    if (error) {
      setStatus(`Помилка: ${error.message}`, "error");
      return;
    }

    setStatus("Довідник створено. Оновлюю карусель...", "success");
    await loadRegistry();
    setTimeout(closeCreateModal, 700);
  });

  left?.addEventListener("click", () => rotate(-1));
  right?.addEventListener("click", () => rotate(1));

  initSitemapDots();
  loadRegistry();
})();
