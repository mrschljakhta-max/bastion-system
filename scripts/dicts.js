/* BASTION DICTS v205 — active toolbar mode toggles */
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

  const protectedColumns = new Set(["id", "created_at", "updated_at"]);
  const columnTypeLabels = { text: "Текст", integer: "Ціле число", numeric: "Число", date: "Дата", boolean: "Так / Ні", uuid: "UUID", timestamptz: "Дата/час" };

  const columnLabels = {
    id: "№",
    name: "Назва",
    alias: "Альтернативна назва",
    aliases: "Альтернативні назви",
    is_active: "Статус",
    active: "Активний",
    code: "Код",
    type: "Тип",
    category: "Категорія",
    caliber: "Калібр",
    weight: "Вага",
    unit: "Одиниця",
    description: "Опис",
    note: "Примітка",
    notes: "Примітки",
    sort_order: "Порядок",
    table_name: "Технічна таблиця",
    records_count: "Кількість записів",
    created_at: "Створено",
    updated_at: "Оновлено",
    deleted_at: "Видалено",
    title: "Назва",
    short_name: "Скорочення",
    full_name: "Повна назва",
    display_name: "Назва для відображення",
    oblast: "Область",
    region: "Регіон",
    area: "Район",
    district: "Район",
    city: "Місто",
    village: "Село",
    settlement_type: "Тип населеного пункту",
    parent_id: "Батьківський запис",
    parent_name: "Батьківська назва",
    source: "Джерело",
    source_type: "Тип джерела",
    priority: "Пріоритет",
    normalized_name: "Нормалізована назва",
    raw_name: "Початкова назва",
    value: "Значення",
    label: "Позначення",
    settlement: "Населений пункт",
    station: "Станція",
    uav_type: "Тип БпЛА",
    frequency: "Частота",
    direction: "Напрямок",
    range: "Дальність",
    latitude: "Широта",
    longitude: "Довгота",
    lat: "Широта",
    lon: "Довгота",
    lng: "Довгота"
  };

  function columnLabel(key) {
    const raw = String(key || "").trim();
    const normalized = raw.toLowerCase();
    if (columnLabels[normalized]) return columnLabels[normalized];
    return raw
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function actionIcon(name) {
    return `<img class="dict-action-icon" src="../assets/icons/actions/${name}.svg" alt="" aria-hidden="true">`;
  }

  let folders = [];
  let active = 0;
  let sb = null;
  let registryItems = [];
  let currentDict = null;
  let currentColumns = [];
  let currentRows = [];

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
      .trim().toLowerCase()
      .replace(/[а]/g, "a").replace(/[б]/g, "b").replace(/[в]/g, "v").replace(/[гґ]/g, "g")
      .replace(/[д]/g, "d").replace(/[еє]/g, "e").replace(/[ж]/g, "zh").replace(/[з]/g, "z")
      .replace(/[иі]/g, "i").replace(/[ї]/g, "yi").replace(/[й]/g, "y").replace(/[к]/g, "k")
      .replace(/[л]/g, "l").replace(/[м]/g, "m").replace(/[н]/g, "n").replace(/[о]/g, "o")
      .replace(/[п]/g, "p").replace(/[р]/g, "r").replace(/[с]/g, "s").replace(/[т]/g, "t")
      .replace(/[у]/g, "u").replace(/[ф]/g, "f").replace(/[х]/g, "kh").replace(/[ц]/g, "ts")
      .replace(/[ч]/g, "ch").replace(/[ш]/g, "sh").replace(/[щ]/g, "shch").replace(/[ю]/g, "yu")
      .replace(/[я]/g, "ya").replace(/[ь'’`]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^([0-9])/, "col_$1");
  }

  function normalizeType(type) {
    const t = String(type || "text").toLowerCase();
    if (t.includes("int")) return "integer";
    if (t.includes("numeric") || t.includes("double") || t.includes("real")) return "numeric";
    if (t.includes("bool")) return "boolean";
    if (t === "date") return "date";
    if (t.includes("timestamp")) return "timestamptz";
    if (t.includes("uuid")) return "uuid";
    return "text";
  }

  function buildFolder(item, isAdd = false) {
    const button = document.createElement("button");
    button.className = `dict-folder${isAdd ? " dict-folder--add" : ""}`;
    button.type = "button";
    if (isAdd) button.dataset.action = "add-dict";
    else {
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
      if (distance === 0) { folder.dataset.slot = "0"; folder.classList.add("dict-folder--active"); }
      else if (absDistance === 1) { folder.dataset.slot = String(distance); folder.classList.add("dict-folder--mid"); }
      else if (absDistance === 2) { folder.dataset.slot = String(distance); folder.classList.add("dict-folder--side"); }
      else folder.dataset.slot = "hidden";
    });
  }

  function setCarouselItems(items) {
    if (!carousel) return;
    carousel.innerHTML = "";
    const visibleItems = (items && items.length ? items : fallbackDictionaries)
      .filter((item) => item.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
    registryItems = visibleItems;
    visibleItems.forEach((item) => carousel.appendChild(buildFolder(item)));
    carousel.appendChild(buildFolder({}, true));
    folders = [...carousel.querySelectorAll(".dict-folder")];
    active = Math.min(1, Math.max(0, folders.length - 1));

    folders.forEach((folder, index) => {
      folder.addEventListener("click", () => {
        active = index;
        renderCarouselPositions();
        if (folder.dataset.action === "add-dict") openCreateModal();
        else {
          const item = registryItems.find((x) => String(x.id || "") === String(folder.dataset.registryId || "") || x.table_name === folder.dataset.table);
          if (item) openManageModal(item);
        }
      });
    });
    renderCarouselPositions();
  }

  async function loadRegistry() {
    sb = createSupabaseClient();
    if (!sb) return setCarouselItems(fallbackDictionaries);
    const { data, error } = await sb
      .from("dict_registry")
      .select("id, code, table_name, title, title_ua, records_count, is_active, sort_order, updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("BASTION dict_registry fallback:", error.message);
      return setCarouselItems(fallbackDictionaries);
    }
    setCarouselItems(data || fallbackDictionaries);
  }

  function rotate(direction) {
    if (!folders.length) return;
    active = (active + direction + folders.length) % folders.length;
    renderCarouselPositions();
  }

  function initSitemapDots() {
    const pageMap = { core: "./app.html", dicts: "./dicts.html", nodes: "./nodes.html", upload: "./upload.html", calculator: "./calculator.html", analysis: "./analysis.html", command: "./command.html" };
    document.querySelectorAll(".map-dot").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        const href = pageMap[dot.dataset.target];
        if (href) window.location.href = href;
      });
    });
  }

  /* CREATE MODAL */
  const modal = document.getElementById("dictCreateModal");
  const form = document.getElementById("dictCreateForm");
  const titleInput = document.getElementById("dictTitleInput");
  const columnsList = document.getElementById("dictColumnsList");
  const addColumnBtn = document.getElementById("addDictColumnBtn");
  const statusEl = document.getElementById("dictCreateStatus");

  function setStatus(message, type = "") { if (statusEl) { statusEl.textContent = message || ""; statusEl.dataset.type = type; } }
  function ensureDictModalInBody(target) {
    if (target && target.parentElement !== document.body) {
      document.body.appendChild(target);
    }
  }

  function syncDictModalBodyState() {
    const anyOpen = Boolean(document.querySelector(".dict-modal.is-open"));
    document.body.classList.toggle("dict-modal-open", anyOpen);
  }

  function openCreateModal() {
    ensureDictModalInBody(modal);
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("dict-modal-open");
    setStatus("");
    setTimeout(() => titleInput?.focus(), 60);
  }

  function closeCreateModal() {
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    syncDictModalBodyState();
  }

  function createColumnRow(name = "", type = "text") {
    const row = document.createElement("div");
    row.className = "dict-column-row";
    row.innerHTML = `<input type="text" value="${name}" data-column-name required /><select data-column-type><option value="text">Текст</option><option value="integer">Ціле число</option><option value="numeric">Число</option><option value="date">Дата</option><option value="boolean">Так / Ні</option></select><button type="button" class="dict-remove-column dict-svg-button" aria-label="Прибрати колонку">${actionIcon("x")}</button>`;
    row.querySelector("select").value = type;
    row.querySelector(".dict-remove-column").addEventListener("click", () => {
      if (columnsList.querySelectorAll(".dict-column-row").length <= 1) return setStatus("Має залишитись хоча б одна колонка.", "error");
      row.remove();
    });
    return row;
  }

  addColumnBtn?.addEventListener("click", () => columnsList?.appendChild(createColumnRow("note", "text")));
  columnsList?.querySelectorAll(".dict-remove-column").forEach((btn) => btn.addEventListener("click", () => {
    if (columnsList.querySelectorAll(".dict-column-row").length > 1) btn.closest(".dict-column-row")?.remove();
  }));
  document.querySelectorAll("[data-close-dict-modal]").forEach((item) => item.addEventListener("click", closeCreateModal));

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sb) sb = createSupabaseClient();
    if (!sb) return setStatus("Supabase не підключений. Перевір scripts/config.js.", "error");
    const title = titleInput.value.trim();
    const rows = [...columnsList.querySelectorAll(".dict-column-row")];
    const columns = rows.map((row) => ({ name: sanitizeColumnName(row.querySelector("[data-column-name]").value), type: row.querySelector("[data-column-type]").value })).filter((col) => col.name);
    const uniqueNames = new Set(columns.map((col) => col.name));
    if (!title) return setStatus("Введи назву довідника.", "error");
    if (!columns.length) return setStatus("Додай хоча б одну колонку.", "error");
    if (uniqueNames.size !== columns.length) return setStatus("Назви колонок не повинні дублюватись.", "error");
    setStatus("Створюю довідник у Supabase...", "loading");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const { error } = await sb.rpc("create_bastion_dictionary", { p_title: title, p_columns: columns });
    submitBtn.disabled = false;
    if (error) return setStatus(`Помилка: ${error.message}`, "error");
    setStatus("Довідник створено. Оновлюю карусель...", "success");
    await loadRegistry();
    setTimeout(closeCreateModal, 700);
  });

  /* MANAGE MODAL v170 — clean dictionary viewer + hidden edit tools */
  const manageModal = document.getElementById("dictManageModal");
  const manageTitle = document.getElementById("dictManageTitle");
  const manageTitleInput = document.getElementById("dictManageNameInput");
  const manageLead = document.getElementById("dictManageLead");
  const manageStatus = document.getElementById("dictManageStatus");
  const exportToggleBtn = document.getElementById("dictExportToggleBtn");
  const editToggleBtn = document.getElementById("dictEditToggleBtn");
  const sortToggleBtn = document.getElementById("dictSortToggleBtn");
  const editPanel = document.getElementById("dictEditPanel");
  const sortPanel = document.getElementById("dictSortPanel");
  const columnsManager = document.getElementById("dictColumnsManager");
  const newColumnName = document.getElementById("dictNewColumnName");
  const newColumnType = document.getElementById("dictNewColumnType");
  const addColumnManageBtn = document.getElementById("dictAddColumnManageBtn");
  const saveTitleBtn = document.getElementById("dictSaveTitleBtn");
  const deleteDictBtn = document.getElementById("dictDeleteBtn");
  const recordsTable = document.getElementById("dictRecordsTable");
  const searchInput = document.getElementById("dictSearchInput");
  const sortSelect = document.getElementById("dictSortSelect");
  const addRowBtn = document.getElementById("dictAddRowBtn");
  const reloadRowsBtn = document.getElementById("dictReloadRowsBtn");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setManageStatus(message, type = "") {
    if (manageStatus) {
      manageStatus.textContent = message || "";
      manageStatus.dataset.type = type;
    }
  }

  function closeManageModal() {
    manageModal?.classList.remove("is-open");
    manageModal?.setAttribute("aria-hidden", "true");
    syncDictModalBodyState();
    currentDict = null;
    currentColumns = [];
    currentRows = [];
    setEditMode(false);
    if (sortPanel) sortPanel.hidden = true;
    setExportMode(false);
  }

  function dictionaryTitle(item = currentDict) {
    return item?.title || item?.title_ua || item?.code || "ДОВІДНИК";
  }

  async function openManageModal(item) {
    currentDict = item;
    ensureDictModalInBody(manageModal);
    manageModal?.classList.add("is-open");
    manageModal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("dict-modal-open");
    setEditMode(false);
    if (sortPanel) sortPanel.hidden = true;
    setExportMode(false);
    if (manageTitle) manageTitle.textContent = dictionaryTitle(item).toUpperCase();
    if (manageTitleInput) manageTitleInput.value = dictionaryTitle(item);
    if (manageLead) manageLead.textContent = countLabel(item.records_count);
    if (dictMetaRecords) dictMetaRecords.textContent = String(Number(item.records_count || 0));
    if (dictMetaTable) dictMetaTable.textContent = item.table_name || "—";
    setManageStatus("Завантажую записи...", "loading");
    await loadDictionaryStructure();
    await loadDictionaryRows();
    setManageStatus("");
  }

  async function loadDictionaryStructure() {
    if (!sb || !currentDict?.table_name) return;
    const { data, error } = await sb.rpc("get_bastion_dictionary_columns", { p_table_name: currentDict.table_name });
    if (error) {
      setManageStatus(`Не вдалося завантажити колонки: ${error.message}`, "error");
      currentColumns = ["id", "name", "alias", "is_active", "created_at"].map((name) => ({ column_name: name, data_type: name === "is_active" ? "boolean" : "text" }));
    } else {
      currentColumns = data || [];
    }
    renderColumnsManager();
    refreshSortOptions();
  }

  function editableColumns() {
    return currentColumns.filter((c) => !protectedColumns.has(c.column_name));
  }

  // Columns visible in the dictionary table.
  // We hide only service fields. Every user-created column is shown equally, Excel-style.
  function displayColumns() {
    return currentColumns.filter((c) => !protectedColumns.has(c.column_name));
  }

  // Columns writable in add/edit rows. is_active remains writable as a checkbox.
  function writableColumns() {
    return currentColumns.filter((c) => !protectedColumns.has(c.column_name));
  }

  function hasColumn(name) {
    return currentColumns.some((c) => c.column_name === name);
  }

  function primaryColumn() {
    const cols = displayColumns();
    return cols.find((c) => c.column_name === "name")
      || cols.find((c) => c.column_name !== "is_active" && normalizeType(c.data_type || c.udt_name) !== "boolean")
      || cols[0];
  }

  function textSearchColumns() {
    return displayColumns().filter((c) => {
      const type = normalizeType(c.data_type || c.udt_name);
      return type === "text" && c.column_name !== "is_active";
    });
  }

  function refreshSortOptions() {
    if (!sortSelect) return;
    const current = sortSelect.value;
    const cols = displayColumns().filter((c) => c.column_name !== "is_active");
    const options = [];
    cols.forEach((c) => {
      options.push(`<option value="${escapeHtml(c.column_name)}__asc">${escapeHtml(columnLabel(c.column_name))}: А → Я</option>`);
      options.push(`<option value="${escapeHtml(c.column_name)}__desc">${escapeHtml(columnLabel(c.column_name))}: Я → А</option>`);
    });
    if (hasColumn("created_at")) options.push(`<option value="created_at__desc">Нові зверху</option>`);
    sortSelect.innerHTML = options.join("") || `<option value="">Без сортування</option>`;
    if ([...sortSelect.options].some((o) => o.value === current)) sortSelect.value = current;
  }

  function renderColumnsManager() {
    if (!columnsManager) return;
    columnsManager.innerHTML = "";
    currentColumns.forEach((col) => {
      const row = document.createElement("div");
      row.className = "dict-column-chip";
      const type = normalizeType(col.data_type || col.udt_name);
      row.innerHTML = `<span><b>${escapeHtml(columnLabel(col.column_name))}</b><small>${escapeHtml(columnTypeLabels[type] || type)}</small></span>`;
      if (!protectedColumns.has(col.column_name) && col.column_name !== "is_active") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dict-svg-button";
        btn.innerHTML = actionIcon("x");
        btn.title = "Видалити колонку";
        btn.addEventListener("click", () => dropColumn(col.column_name));
        row.appendChild(btn);
      }
      columnsManager.appendChild(row);
    });
  }

  async function addColumnToCurrent() {
    const colName = sanitizeColumnName(newColumnName?.value);
    if (!colName) return setManageStatus("Введи назву нової колонки.", "error");
    if (currentColumns.some((c) => c.column_name === colName)) return setManageStatus("Така колонка вже існує.", "error");
    setManageStatus("Додаю колонку...", "loading");
    const { error } = await sb.rpc("add_bastion_dictionary_column", { p_table_name: currentDict.table_name, p_column_name: colName, p_column_type: newColumnType.value });
    if (error) return setManageStatus(`Помилка додавання колонки: ${error.message}`, "error");
    newColumnName.value = "";
    await loadDictionaryStructure();
    await loadDictionaryRows();
    setManageStatus("Колонку додано.", "success");
  }

  async function dropColumn(colName) {
    const ok = window.confirm(`Видалити колонку "${columnLabel(colName)}"? Дані в цій колонці будуть втрачені.`);
    if (!ok) return;
    setManageStatus("Видаляю колонку...", "loading");
    const { error } = await sb.rpc("drop_bastion_dictionary_column", { p_table_name: currentDict.table_name, p_column_name: colName });
    if (error) return setManageStatus(`Помилка видалення колонки: ${error.message}`, "error");
    await loadDictionaryStructure();
    await loadDictionaryRows();
    setManageStatus("Колонку видалено.", "success");
  }

  function sortParams() {
    const val = sortSelect?.value || "";
    if (!val) return { column: primaryColumn()?.column_name, ascending: true };
    const [column, direction] = val.split("__");
    return { column, ascending: direction !== "desc" };
  }

  async function loadDictionaryRows() {
    if (!sb || !currentDict?.table_name) return;
    const search = (searchInput?.value || "").trim();
    const sort = sortParams();
    let query = sb.from(currentDict.table_name).select("*").limit(500);

    // Search across all text columns created by the user, not just name.
    const searchCols = textSearchColumns();
    if (search && searchCols.length) {
      const safeSearch = search.replaceAll(",", " ");
      query = query.or(searchCols.map((c) => `${c.column_name}.ilike.%${safeSearch}%`).join(","));
    }

    const orderColumn = hasColumn(sort.column) ? sort.column : primaryColumn()?.column_name;
    if (orderColumn) query = query.order(orderColumn, { ascending: sort.ascending, nullsFirst: false });
    const { data, error } = await query;
    if (error) {
      currentRows = [];
      renderRecordsTable();
      return setManageStatus(`Не вдалося завантажити записи: ${error.message}`, "error");
    }
    currentRows = data || [];
    renderRecordsTable();
  }

  function inputForCell(row, col) {
    const name = col.column_name;
    const type = normalizeType(col.data_type || col.udt_name);
    const value = row[name];
    if (name === "is_active" || type === "boolean") {
      return `<input class="dict-cell-check" type="checkbox" data-field="${escapeHtml(name)}" ${value !== false ? "checked" : ""}>`;
    }
    if (type === "date") return `<input class="dict-cell-input" type="date" data-field="${escapeHtml(name)}" value="${escapeHtml(value || "")}">`;
    if (type === "integer" || type === "numeric") return `<input class="dict-cell-input" type="number" step="${type === "numeric" ? "any" : "1"}" data-field="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}">`;
    return `<input class="dict-cell-input" type="text" data-field="${escapeHtml(name)}" value="${escapeHtml(value ?? "")}">`;
  }

  function renderRecordEditorRow(row = {}, id = null) {
    const cols = displayColumns();
    const rowNumber = id
      ? (currentRows.findIndex((item) => String(item.id) === String(id)) + 1 || "")
      : (currentRows.length + 1);
    const cells = cols.map((c) => `<td data-col="${escapeHtml(c.column_name)}">${inputForCell(row, c)}</td>`).join("");
    return `<tr class="dict-row-editor dict-row-editor--inline${id ? " dict-row-editor--edit" : " dict-row-editor--new"}" data-editor-for="${escapeHtml(id || "new")}"><td class="dict-col-num">${rowNumber}</td>${cells}<td class="dict-row-actions dict-row-actions--editor"><button type="button" class="dict-icon-mini dict-icon-mini--accept dict-svg-button" data-save-editor title="Зберегти запис" aria-label="Зберегти запис">${actionIcon("check")}</button><button type="button" class="dict-icon-mini dict-icon-mini--cancel dict-svg-button" data-cancel-editor title="Скасувати" aria-label="Скасувати">${actionIcon("x")}</button></td></tr>`;
  }

  function displayCellValue(row, col) {
    const name = col.column_name;
    const type = normalizeType(col.data_type || col.udt_name);
    const value = row[name];
    if (type === "boolean" || name === "is_active") {
      return `<input class="dict-cell-check" type="checkbox" data-toggle-field="${escapeHtml(name)}" ${value !== false ? "checked" : ""}>`;
    }
    if (value === null || typeof value === "undefined" || value === "") return `<span class="dict-empty-dash">—</span>`;
    return `<span class="dict-cell-value">${escapeHtml(value)}</span>`;
  }

  function renderRecordsTable() {
    if (!recordsTable) return;
    const cols = displayColumns();
    recordsTable.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th class="dict-col-num">№</th>${cols.map((c) => `<th>${escapeHtml(columnLabel(c.column_name))}</th>`).join("")}<th class="dict-col-actions">Дії</th></tr>`;
    const tbody = document.createElement("tbody");
    if (!currentRows.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="dict-empty-cell">Записів немає</td></tr>`;
    } else {
      currentRows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.dataset.id = row.id;
        tr.innerHTML = `<td class="dict-col-num">${idx + 1}</td>${cols.map((c) => `<td data-col="${escapeHtml(c.column_name)}">${displayCellValue(row, c)}</td>`).join("")}<td class="dict-row-actions"><button type="button" class="dict-icon-mini dict-svg-button" data-edit-row title="Редагувати запис" aria-label="Редагувати запис">${actionIcon("pencil")}</button><button type="button" class="dict-icon-mini dict-icon-mini--danger dict-svg-button" data-delete-row title="Видалити запис" aria-label="Видалити запис">${actionIcon("trash")}</button></td>`;
        tr.querySelectorAll("[data-toggle-field]").forEach((input) => {
          input.addEventListener("change", (event) => updateRowField(row.id, event.target.dataset.toggleField, event.target.checked));
        });
        tr.querySelector("[data-edit-row]").addEventListener("click", () => toggleEditorRow(tr, row));
        tr.querySelector("[data-delete-row]").addEventListener("click", () => deleteRow(row));
        tbody.appendChild(tr);
      });
    }
    recordsTable.append(thead, tbody);
  }

  function toggleEditorRow(anchorRow, row) {
    const next = anchorRow.nextElementSibling;
    if (next?.classList.contains("dict-row-editor")) return next.remove();
    recordsTable.querySelectorAll(".dict-row-editor").forEach((r) => r.remove());
    anchorRow.insertAdjacentHTML("afterend", renderRecordEditorRow(row, row.id));
    const editor = anchorRow.nextElementSibling;
    editor.querySelector("[data-save-editor]").addEventListener("click", () => saveRow(editor, row.id));
    editor.querySelector("[data-cancel-editor]").addEventListener("click", () => editor.remove());
  }

  function valueFromInput(input) {
    if (input.type === "checkbox") return input.checked;
    if (input.type === "number") return input.value === "" ? null : Number(input.value);
    return input.value;
  }

  async function saveRow(tr, id = null) {
    const payload = {};
    tr.querySelectorAll("[data-field]").forEach((input) => { payload[input.dataset.field] = valueFromInput(input); });
    if (hasColumn("updated_at")) payload.updated_at = new Date().toISOString();
    if (!hasColumn("is_active")) delete payload.is_active;
    setManageStatus(id ? "Зберігаю запис..." : "Створюю запис...", "loading");
    const result = id ? await sb.from(currentDict.table_name).update(payload).eq("id", id) : await sb.from(currentDict.table_name).insert(payload);
    if (result.error) return setManageStatus(`Помилка збереження: ${result.error.message}`, "error");
    await refreshCount();
    await loadDictionaryRows();
    setManageStatus(id ? "Запис збережено." : "Запис створено.", "success");
  }

  async function updateRowField(id, field, value) {
    if (!id || !field || !hasColumn(field)) return;
    const payload = { [field]: value };
    if (hasColumn("updated_at")) payload.updated_at = new Date().toISOString();
    setManageStatus("Оновлюю поле...", "loading");
    const { error } = await sb.from(currentDict.table_name).update(payload).eq("id", id);
    if (error) return setManageStatus(`Помилка оновлення: ${error.message}`, "error");
    setManageStatus("Поле оновлено.", "success");
  }

  async function deleteRow(row) {
    const pCol = primaryColumn()?.column_name || "id";
    const label = row[pCol] || row.id || "цей запис";
    if (!window.confirm(`Видалити запис "${label}"?`)) return;
    setManageStatus("Видаляю запис...", "loading");
    const { error } = await sb.from(currentDict.table_name).delete().eq("id", row.id);
    if (error) return setManageStatus(`Помилка видалення запису: ${error.message}`, "error");
    await refreshCount();
    await loadDictionaryRows();
    setManageStatus("Запис видалено.", "success");
  }

  function addEmptyRow() {
    if (!recordsTable) return;
    let tbody = recordsTable.querySelector("tbody");
    if (!tbody) { renderRecordsTable(); tbody = recordsTable.querySelector("tbody"); }
    if (tbody.querySelector(".dict-empty-cell")) tbody.innerHTML = "";
    recordsTable.querySelectorAll(".dict-row-editor").forEach((r) => r.remove());
    const empty = {};
    writableColumns().forEach((c) => { empty[c.column_name] = ""; });
    empty.is_active = true;
    tbody.insertAdjacentHTML("beforeend", renderRecordEditorRow(empty, null));
    const editor = tbody.lastElementChild;
    editor.querySelector("[data-save-editor]").addEventListener("click", () => saveRow(editor, null));
    editor.querySelector("[data-cancel-editor]").addEventListener("click", () => editor.remove());
  }


  function exportFileName(ext) {
    const title = dictionaryTitle(currentDict).toLowerCase()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "dictionary";
    const stamp = new Date().toISOString().slice(0, 10);
    return `${title}-${stamp}.${ext}`;
  }

  function exportHeaders() {
    return ["№", ...displayColumns().map((c) => columnLabel(c.column_name))];
  }

  function exportCell(row, col) {
    const name = col.column_name;
    const type = normalizeType(col.data_type || col.udt_name);
    const value = row[name];
    if (type === "boolean" || name === "is_active") return value !== false ? "✓" : "";
    if (value === null || typeof value === "undefined") return "";
    return String(value);
  }

  function exportRows() {
    const cols = displayColumns();
    return currentRows.map((row, index) => [index + 1, ...cols.map((c) => exportCell(row, c))]);
  }

  function downloadBlob(content, mime, filename) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 400);
  }

  function exportJson() {
    const columns = exportHeaders();
    const rows = exportRows().map((row) => Object.fromEntries(columns.map((name, idx) => [name, row[idx]])));
    const payload = {
      title: dictionaryTitle(currentDict),
      table: currentDict?.table_name || "",
      generated_at: new Date().toISOString(),
      columns,
      rows
    };
    downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", exportFileName("json"));
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function exportCsv() {
    const lines = [exportHeaders(), ...exportRows()].map((row) => row.map(csvEscape).join(";"));
    downloadBlob("\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8", exportFileName("csv"));
  }

  function exportExcel() {
    const headers = exportHeaders();
    const rows = exportRows();
    const htmlTable = `
      <html><head><meta charset="UTF-8"></head><body>
      <table border="1">
        <caption>${escapeHtml(dictionaryTitle(currentDict))}</caption>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      </body></html>`;
    downloadBlob("\ufeff" + htmlTable, "application/vnd.ms-excel;charset=utf-8", exportFileName("xls"));
  }

  function profileInfo() {
    const login = document.getElementById("profileLogin")?.textContent?.trim()
      || document.getElementById("operatorName")?.textContent?.trim()
      || "невідомо";
    const email = document.getElementById("profileEmail")?.textContent?.trim()
      || "email не визначено";
    return { login, email };
  }

  function exportPdf() {
    const headers = exportHeaders();
    const rows = exportRows();
    const now = new Date();
    const user = profileInfo();
    const isLight = document.documentElement.dataset.theme === "light" || document.body.dataset.theme === "light" || document.body.classList.contains("dicts-theme-light");
    const bg = isLight ? "#f8fbfd" : "#07090d";
    const fg = isLight ? "#202a36" : "#fff2f2";
    const soft = isLight ? "#5b6572" : "#ffb8b8";
    const tableBg = isLight ? "#ffffff" : "#0b1118";
    const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>${escapeHtml(dictionaryTitle(currentDict))}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { margin:0; background:${bg}; color:${fg}; font-family: Arial, sans-serif; }
        .pdf-shell { border:2px solid #ff3038; border-radius:18px; padding:22px; box-shadow:0 0 24px rgba(255,48,56,.22); }
        h1 { margin:0 0 8px; color:#ff3038; letter-spacing:.08em; font-size:26px; text-transform:uppercase; }
        .meta { display:grid; grid-template-columns:repeat(2, minmax(220px, 1fr)); gap:8px 22px; margin:14px 0 20px; color:${soft}; font-size:13px; }
        .meta b { color:#ff3038; }
        table { width:100%; border-collapse:collapse; background:${tableBg}; font-size:12px; }
        th { color:#ff3038; text-transform:uppercase; letter-spacing:.06em; background:${isLight ? '#f4f8fa' : '#121a22'}; }
        th, td { border:1px solid rgba(255,48,56,.35); padding:8px 10px; text-align:left; }
        td:first-child, th:first-child { text-align:center; width:44px; }
        .footer { margin-top:14px; color:${soft}; font-size:11px; text-align:right; }
      </style></head><body><section class="pdf-shell">
        <h1>${escapeHtml(dictionaryTitle(currentDict))}</h1>
        <div class="meta">
          <div><b>Дата формування:</b> ${now.toLocaleDateString("uk-UA")}</div>
          <div><b>Час формування:</b> ${now.toLocaleTimeString("uk-UA")}</div>
          <div><b>Виконавець:</b> ${escapeHtml(user.login)}</div>
          <div><b>Email:</b> ${escapeHtml(user.email)}</div>
          <div><b>Таблиця:</b> ${escapeHtml(currentDict?.table_name || "—")}</div>
          <div><b>Записів:</b> ${rows.length}</div>
        </div>
        <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <div class="footer">BASTION Dictionary Export</div>
      </section><script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return downloadBlob(html, "text/html;charset=utf-8", exportFileName("html"));
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function ensureExportPanel() {
    const card = document.querySelector("#dictManageModal .dict-records-card");
    if (!card) return null;
    let panel = document.getElementById("dictExportPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "dictExportPanel";
    panel.className = "dict-export-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dict-export-grid" aria-label="Формати експорту">
        ${["json", "excel", "pdf", "csv"].map((format) => `
          <button type="button" class="dict-export-format" data-export-format="${format}" aria-label="Експорт ${format.toUpperCase()}">
            <img class="dict-export-img dict-export-img--light" src="../assets/icons/export/export-${format}-light.png" alt="${format.toUpperCase()}" draggable="false">
            <img class="dict-export-img dict-export-img--dark" src="../assets/icons/export/export-${format}-dark.png" alt="${format.toUpperCase()}" draggable="false">
          </button>`).join("")}
      </div>`;
    const tableWrap = card.querySelector(".dict-table-wrap");
    if (tableWrap) card.insertBefore(panel, tableWrap);
    else card.prepend(panel);
    panel.querySelectorAll("[data-export-format]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const format = btn.dataset.exportFormat;
        if (format === "json") exportJson();
        if (format === "excel") exportExcel();
        if (format === "csv") exportCsv();
        if (format === "pdf") exportPdf();
      });
    });
    return panel;
  }

  function setEditMode(enabled) {
    if (!editPanel) return;
    editPanel.hidden = !enabled;
    editToggleBtn?.classList.toggle("is-active", enabled);
    editToggleBtn?.setAttribute("aria-pressed", enabled ? "true" : "false");
    if (enabled && sortPanel) sortPanel.hidden = true;
  }

  function setExportMode(enabled) {
    const modal = document.getElementById("dictManageModal");
    const panelShell = modal?.querySelector(".dict-view-panel");
    const card = modal?.querySelector(".dict-records-card");
    const panel = ensureExportPanel();
    if (!card || !panel) return;
    const tableWrap = card.querySelector(".dict-table-wrap");

    panel.hidden = !enabled;
    if (tableWrap) tableWrap.hidden = enabled;

    // У режимі експорту кнопка додавання запису не повинна відображатись.
    modal?.querySelectorAll(".dict-add-row-line, #dictAddRowBtn").forEach((item) => {
      item.hidden = enabled;
      item.classList.toggle("is-export-hidden", enabled);
    });

    if (enabled) {
      setEditMode(false);
      if (sortPanel) sortPanel.hidden = true;
    }

    modal?.classList.toggle("dict-export-mode", enabled);
    panelShell?.classList.toggle("dict-export-mode", enabled);
    card.classList.toggle("dict-export-mode", enabled);
    exportToggleBtn?.classList.toggle("is-active", enabled);
    exportToggleBtn?.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  function toggleExportMode() {
    const panel = ensureExportPanel();
    setExportMode(!!panel?.hidden);
  }

  async function refreshCount() {
    if (!sb || !currentDict?.table_name || !currentDict?.id) return;
    const { count } = await sb.from(currentDict.table_name).select("id", { count: "exact", head: true });
    if (typeof count === "number") {
      await sb.from("dict_registry").update({ records_count: count, updated_at: new Date().toISOString() }).eq("id", currentDict.id);
      currentDict.records_count = count;
      if (manageLead) manageLead.textContent = countLabel(count);
      if (dictMetaRecords) dictMetaRecords.textContent = String(count);
      await loadRegistry();
    }
  }

  saveTitleBtn?.addEventListener("click", async () => {
    const title = manageTitleInput.value.trim();
    if (!title || !currentDict?.id) return setManageStatus("Введи назву довідника.", "error");
    setManageStatus("Зберігаю назву...", "loading");
    const { error } = await sb.from("dict_registry").update({ title, title_ua: title, updated_at: new Date().toISOString() }).eq("id", currentDict.id);
    if (error) return setManageStatus(`Помилка: ${error.message}`, "error");
    currentDict.title = title;
    if (manageTitle) manageTitle.textContent = title.toUpperCase();
    await loadRegistry();
    setManageStatus("Назву збережено.", "success");
  });

  deleteDictBtn?.addEventListener("click", async () => {
    if (!currentDict?.id) return;
    const expected = dictionaryTitle(currentDict);
    const typed = window.prompt(`Для видалення довідника введи його назву:\n${expected}`);
    if (typed !== expected) return setManageStatus("Видалення скасовано: назва не співпала.", "error");
    setManageStatus("Архівую довідник...", "loading");
    const { error } = await sb.from("dict_registry").update({ is_active: false, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", currentDict.id);
    if (error) return setManageStatus(`Помилка видалення: ${error.message}`, "error");
    await loadRegistry();
    closeManageModal();
  });

  exportToggleBtn?.addEventListener("click", toggleExportMode);

  editToggleBtn?.addEventListener("click", () => {
    if (!editPanel) return;
    const willOpen = !!editPanel.hidden;
    setExportMode(false);
    setEditMode(willOpen);
  });

  sortToggleBtn?.addEventListener("click", () => {
    if (!sortPanel) return;
    setExportMode(false);
    setEditMode(false);
    sortPanel.hidden = !sortPanel.hidden;
    if (!sortPanel.hidden) searchInput?.focus();
  });

  addColumnManageBtn?.addEventListener("click", addColumnToCurrent);
  addRowBtn?.addEventListener("click", addEmptyRow);
  reloadRowsBtn?.addEventListener("click", loadDictionaryRows);
  searchInput?.addEventListener("input", () => { clearTimeout(searchInput._t); searchInput._t = setTimeout(loadDictionaryRows, 250); });
  sortSelect?.addEventListener("change", loadDictionaryRows);
  document.querySelectorAll("[data-close-manage-modal]").forEach((item) => item.addEventListener("click", closeManageModal));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeCreateModal(); closeManageModal(); }
    if (!modal?.classList.contains("is-open") && !manageModal?.classList.contains("is-open")) {
      if (event.key === "ArrowLeft") rotate(-1);
      if (event.key === "ArrowRight") rotate(1);
    }
  });

  left?.addEventListener("click", () => rotate(-1));
  right?.addEventListener("click", () => rotate(1));
  initSitemapDots();
  loadRegistry();
})();
