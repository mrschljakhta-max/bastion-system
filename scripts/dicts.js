/* BASTION DICTS v169 — registry carousel + create/manage dictionaries */
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
      .select("id, code, table_name, title, title_ua, records_count, is_active, sort_order")
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
  function openCreateModal() { modal?.classList.add("is-open"); modal?.setAttribute("aria-hidden", "false"); setStatus(""); setTimeout(() => titleInput?.focus(), 60); }
  function closeCreateModal() { modal?.classList.remove("is-open"); modal?.setAttribute("aria-hidden", "true"); }

  function createColumnRow(name = "", type = "text") {
    const row = document.createElement("div");
    row.className = "dict-column-row";
    row.innerHTML = `<input type="text" value="${name}" data-column-name required /><select data-column-type><option value="text">Текст</option><option value="integer">Ціле число</option><option value="numeric">Число</option><option value="date">Дата</option><option value="boolean">Так / Ні</option></select><button type="button" class="dict-remove-column" aria-label="Прибрати колонку">×</button>`;
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

  /* MANAGE MODAL */
  const manageModal = document.getElementById("dictManageModal");
  const manageTitleInput = document.getElementById("dictManageNameInput");
  const manageTableName = document.getElementById("dictManageTableName");
  const manageLead = document.getElementById("dictManageLead");
  const manageStatus = document.getElementById("dictManageStatus");
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

  function setManageStatus(message, type = "") { if (manageStatus) { manageStatus.textContent = message || ""; manageStatus.dataset.type = type; } }
  function closeManageModal() { manageModal?.classList.remove("is-open"); manageModal?.setAttribute("aria-hidden", "true"); currentDict = null; }

  async function openManageModal(item) {
    currentDict = item;
    manageModal?.classList.add("is-open");
    manageModal?.setAttribute("aria-hidden", "false");
    manageTitleInput.value = item.title || item.title_ua || "";
    manageTableName.textContent = item.table_name || "—";
    manageLead.textContent = `${item.title || "Довідник"} • ${countLabel(item.records_count)}`;
    setManageStatus("Завантажую структуру і записи...", "loading");
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
    } else currentColumns = data || [];
    renderColumnsManager();
  }

  function editableColumns() {
    return currentColumns.filter((c) => !protectedColumns.has(c.column_name));
  }

  function renderColumnsManager() {
    if (!columnsManager) return;
    columnsManager.innerHTML = "";
    currentColumns.forEach((col) => {
      const row = document.createElement("div");
      row.className = "dict-column-chip";
      const type = normalizeType(col.data_type || col.udt_name);
      row.innerHTML = `<span><b>${col.column_name}</b><small>${columnTypeLabels[type] || type}</small></span>`;
      if (!protectedColumns.has(col.column_name) && col.column_name !== "is_active") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "×";
        btn.title = "Видалити колонку";
        btn.addEventListener("click", () => dropColumn(col.column_name));
        row.appendChild(btn);
      }
      columnsManager.appendChild(row);
    });
  }

  async function addColumnToCurrent() {
    const colName = sanitizeColumnName(newColumnName.value);
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
    const ok = window.confirm(`Видалити колонку "${colName}"? Дані в цій колонці будуть втрачені.`);
    if (!ok) return;
    setManageStatus("Видаляю колонку...", "loading");
    const { error } = await sb.rpc("drop_bastion_dictionary_column", { p_table_name: currentDict.table_name, p_column_name: colName });
    if (error) return setManageStatus(`Помилка видалення колонки: ${error.message}`, "error");
    await loadDictionaryStructure();
    await loadDictionaryRows();
    setManageStatus("Колонку видалено.", "success");
  }

  function sortParams() {
    const val = sortSelect?.value || "name_asc";
    if (val === "name_desc") return { column: "name", ascending: false };
    if (val === "created_desc") return { column: "created_at", ascending: false };
    return { column: "name", ascending: true };
  }

  async function loadDictionaryRows() {
    if (!sb || !currentDict?.table_name) return;
    const search = (searchInput?.value || "").trim();
    const sort = sortParams();
    let query = sb.from(currentDict.table_name).select("*").limit(500);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
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
      return `<input class="dict-cell-check" type="checkbox" data-field="${name}" ${value !== false ? "checked" : ""}>`;
    }
    if (type === "date") return `<input class="dict-cell-input" type="date" data-field="${name}" value="${value || ""}">`;
    if (type === "integer" || type === "numeric") return `<input class="dict-cell-input" type="number" step="${type === "numeric" ? "any" : "1"}" data-field="${name}" value="${value ?? ""}">`;
    return `<input class="dict-cell-input" type="text" data-field="${name}" value="${String(value ?? "").replaceAll('"', '&quot;')}">`;
  }

  function renderRecordsTable() {
    if (!recordsTable) return;
    const cols = editableColumns();
    recordsTable.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr>${cols.map((c) => `<th>${c.column_name}</th>`).join("")}<th>Дії</th></tr>`;
    const tbody = document.createElement("tbody");
    if (!currentRows.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length + 1}" class="dict-empty-cell">Записів немає</td></tr>`;
    } else {
      currentRows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.dataset.id = row.id;
        tr.innerHTML = `${cols.map((c) => `<td>${inputForCell(row, c)}</td>`).join("")}<td class="dict-row-actions"><button type="button" data-save-row>Зберегти</button></td>`;
        tr.querySelector("[data-save-row]").addEventListener("click", () => saveRow(tr, row.id));
        tbody.appendChild(tr);
      });
    }
    recordsTable.append(thead, tbody);
  }

  function valueFromInput(input) {
    if (input.type === "checkbox") return input.checked;
    if (input.type === "number") return input.value === "" ? null : Number(input.value);
    return input.value;
  }

  async function saveRow(tr, id = null) {
    const payload = {};
    tr.querySelectorAll("[data-field]").forEach((input) => { payload[input.dataset.field] = valueFromInput(input); });
    payload.updated_at = new Date().toISOString();
    setManageStatus("Зберігаю рядок...", "loading");
    const result = id ? await sb.from(currentDict.table_name).update(payload).eq("id", id) : await sb.from(currentDict.table_name).insert(payload);
    if (result.error) return setManageStatus(`Помилка збереження: ${result.error.message}`, "error");
    await refreshCount();
    await loadDictionaryRows();
    setManageStatus("Рядок збережено.", "success");
  }

  function addEmptyRow() {
    if (!recordsTable) return;
    const cols = editableColumns();
    let tbody = recordsTable.querySelector("tbody");
    if (!tbody) { renderRecordsTable(); tbody = recordsTable.querySelector("tbody"); }
    if (tbody.querySelector(".dict-empty-cell")) tbody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.className = "dict-new-row";
    const empty = {};
    cols.forEach((c) => { empty[c.column_name] = c.column_name === "is_active" ? true : ""; });
    tr.innerHTML = `${cols.map((c) => `<td>${inputForCell(empty, c)}</td>`).join("")}<td class="dict-row-actions"><button type="button" data-save-row>Створити</button></td>`;
    tr.querySelector("[data-save-row]").addEventListener("click", () => saveRow(tr, null));
    tbody.prepend(tr);
  }

  async function refreshCount() {
    if (!sb || !currentDict?.table_name || !currentDict?.id) return;
    const { count } = await sb.from(currentDict.table_name).select("id", { count: "exact", head: true });
    if (typeof count === "number") {
      await sb.from("dict_registry").update({ records_count: count, updated_at: new Date().toISOString() }).eq("id", currentDict.id);
      currentDict.records_count = count;
      manageLead.textContent = `${currentDict.title || "Довідник"} • ${countLabel(count)}`;
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
    manageLead.textContent = `${title} • ${countLabel(currentDict.records_count)}`;
    await loadRegistry();
    setManageStatus("Назву збережено.", "success");
  });

  deleteDictBtn?.addEventListener("click", async () => {
    if (!currentDict?.id) return;
    const expected = currentDict.title || currentDict.title_ua || currentDict.code;
    const typed = window.prompt(`Для видалення довідника введи його назву:\n${expected}`);
    if (typed !== expected) return setManageStatus("Видалення скасовано: назва не співпала.", "error");
    setManageStatus("Архівую довідник...", "loading");
    const { error } = await sb.from("dict_registry").update({ is_active: false, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", currentDict.id);
    if (error) return setManageStatus(`Помилка видалення: ${error.message}`, "error");
    await loadRegistry();
    closeManageModal();
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
