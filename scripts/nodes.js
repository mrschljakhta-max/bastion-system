(() => {
  "use strict";

  let relations = [];
  let dictionaryCatalog = [];
  let lastSupabaseError = "";


  let sb = null;
  const hiddenBuilderColumns = new Set(["id", "№", "row_number", "order_number", "active", "is_active", "enabled", "created_at", "updated_at", "created_by", "modified_by", "uuid", "deleted_at"]);

  function createSupabaseClient() {
    if (window.BastionSupabase) return window.BastionSupabase;
    if (window.supabaseClient) return window.supabaseClient;
    const cfg = window.BASTION_CONFIG || {};
    const url = cfg.SUPABASE_URL || window.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    if (!window.supabase || !url || !key) return null;
    return window.supabase.createClient(url, key);
  }

  async function loadLiveDictionaryCatalog() {
    sb = createSupabaseClient();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from("dict_registry")
        .select("id, code, table_name, title, title_ua, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error || !Array.isArray(data) || !data.length) throw error || new Error("dict_registry empty");

      const live = [];
      for (const item of data) {
        const table = item.table_name;
        if (!table) continue;
        const title = item.title_ua || item.title || item.code || table.replace(/^dict_/, "").toUpperCase();
        let columns = [];

        // 1) Основний спосіб — той самий RPC, який уже працює на сторінці “Довідники”.
        try {
          const meta = await sb.rpc("get_bastion_dictionary_columns", { p_table_name: table });
          if (!meta.error && Array.isArray(meta.data)) {
            columns = meta.data
              .map((col) => ({
                name: col.column_name || col.name,
                label: baseColumnLabel(col.column_name || col.name),
                type: normalizeType(col.data_type || col.udt_name || "text"),
                values: []
              }))
              .filter((col) => col.name && !hiddenBuilderColumns.has(String(col.name).toLowerCase()));
          }
        } catch (metaError) {
          console.warn("BASTION nodes column RPC fallback:", metaError?.message || metaError);
        }

        // 2) Значення для dropdown беремо із самих dict_* таблиць.
        const rowsRes = await sb.from(table).select("*").limit(500);
        const rows = rowsRes?.data || [];
        if (!columns.length && rows.length) {
          columns = Object.keys(rows[0])
            .filter((name) => !hiddenBuilderColumns.has(String(name).toLowerCase()))
            .map((name) => ({ name, label: baseColumnLabel(name), type: inferColumnType(rows.map((row) => row?.[name])), values: [] }));
        }
        columns = columns.map((col) => ({
          ...col,
          values: uniqueValues(rows.map((row) => row?.[col.name]))
        }));

        if (!columns.length) {
          const fallback = dictionaryCatalog.find((d) => d.table === table || d.title === title);
          columns = (fallback?.columns || []).map((col) => normalizeColumnObject(col));
        }
        live.push({ table, title: String(title).toUpperCase(), columns, registryId: item.id });
      }
      if (live.length) {
        dictionaryCatalog.splice(0, dictionaryCatalog.length, ...live);
        state.builderActiveDict = dictionaryCatalog[0]?.table || "";
      }
    } catch (error) {
      console.warn("BASTION nodes Supabase dictionary fallback:", error?.message || error);
    }
  }

  async function loadLiveRelations() {
    sb = sb || createSupabaseClient();
    if (!sb) return;
    try {
      const { data, error } = await sb
        .from("rel_registry")
        .select("id, relation_name, relation_slug, table_name, description, schema, records_count, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!Array.isArray(data) || !data.length) {
        relations = [];
        state.active = 0;
        state.flippedId = null;
        return;
      }

      const liveRelations = [];
      for (const item of data) {
        const relation = normalizeRelationRecord(item);
        relation.rows = await loadRelationRows(relation);
        liveRelations.push(relation);
      }
      relations = liveRelations;
      state.active = Math.min(state.active || 0, Math.max(0, allCards().length - 1));
      state.flippedId = null;
      lastSupabaseError = "";
    } catch (error) {
      lastSupabaseError = error?.message || String(error);
      console.warn("BASTION nodes rel_registry unavailable:", lastSupabaseError);
      relations = [];
      state.active = 0;
      state.flippedId = null;
    }
  }

  async function loadRelationRows(relation) {
    if (!sb || !relation?.tableName) return [];

    // 1) Нормальний режим: кожен зв’язок має свою фізичну rel_* таблицю.
    try {
      const { data, error } = await sb
        .from(relation.tableName)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1000);
      if (!error && Array.isArray(data)) {
        return data.map((row) => relationRowFromRecord(relation, row));
      }
    } catch (tableError) {
      console.warn(`BASTION relation table fallback (${relation.tableName}):`, tableError?.message || tableError);
    }

    // 2) Сумісність із ранньою схемою rel_rows, якщо вона вже була створена.
    try {
      const { data, error } = await sb
        .from("rel_rows")
        .select("id, row_data, is_active, created_at")
        .eq("relation_id", relation.dbId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (!error && Array.isArray(data)) {
        return data.map((row) => {
          const payload = row.row_data || {};
          if (Array.isArray(payload.values)) return payload.values;
          if (Array.isArray(payload.row)) return payload.row;
          return relationRowFromRecord(relation, payload);
        });
      }
    } catch (rowError) {
      console.warn("BASTION rel_rows fallback unavailable:", rowError?.message || rowError);
    }

    return [];
  }

  function relationRowFromRecord(relation, record) {
    const cols = relation.columns || [];
    const values = cols.map((col, index) => {
      const meta = withQuantityMeta(col, index);
      const key = meta.storage_key;
      const qtyKey = meta.quantity_key || `${key}_qty`;
      return makeCell(record?.[key] ?? record?.[col.key] ?? record?.[col.column] ?? record?.[col.label] ?? "", record?.[qtyKey] ?? "");
    });
    values.push(record?.result_value ?? record?.result ?? record?.__result ?? "");
    if (record?.id) values._recordId = record.id;
    return values;
  }

  function normalizeRelationRecord(item) {
    const schema = item.schema || {};
    const columns = Array.isArray(schema.columns)
      ? schema.columns.map((col, index) => withQuantityMeta({
          dictionary: col.dictionary || col.dictTitle || col.sourceTable || col.table || "DICT",
          sourceTable: col.sourceTable || col.table || col.dict_table || "",
          column: col.column || col.name || col.dict_column || "",
          label: col.label || baseColumnLabel(col.column || col.name || col.dict_column),
          type: col.type || col.data_type || "text",
          values: col.values || getCatalogColumnValues(col.sourceTable || col.table || col.dict_table, col.column || col.name || col.dict_column),
          key: col.key || `${col.sourceTable || col.table || col.dict_table}.${col.column || col.name || col.dict_column}`,
          storage_key: col.storage_key || `c_${String((col.order_index ?? index) + 1).padStart(3, "0")}_${slugify(col.column || col.name || col.dict_column).replace(/-/g, "_")}`,
          hasQuantity: col.hasQuantity ?? col.has_quantity ?? true,
          quantityType: col.quantityType || col.quantity_type || "integer",
          quantity_key: col.quantity_key
        }, index))
      : [];
    const dictionaries = Array.isArray(schema.dictionaries)
      ? schema.dictionaries.map((d) => d.title || d.name || d.table || d).filter(Boolean)
      : [...new Set(columns.map((c) => c.dictionary))];
    return {
      dbId: item.id,
      id: item.relation_slug || slugify(item.relation_name),
      tableName: item.table_name || `rel_${slugify(item.relation_name).replace(/-/g, "_")}`,
      name: item.relation_name || schema.relation_name || "RELATION",
      description: item.description || schema.description || "",
      dictionaries,
      columns,
      result: schema.result || { label: "Результат", type: "text" },
      rows: [],
      isLive: true
    };
  }

  async function saveRelationToSupabase(relation) {
    sb = sb || createSupabaseClient();
    if (!sb) throw new Error("Supabase не підключений.");

    const relationSlug = relation.id;
    const tableName = relation.tableName || `rel_${relationSlug.replace(/-/g, "_")}`;
    const normalizedColumns = relation.columns.map((col, index) => withQuantityMeta({
      ...col,
      order_index: index,
      key: col.key || `${col.sourceTable}.${col.column}`,
      storage_key: col.storage_key || `c_${String(index + 1).padStart(3, "0")}_${slugify(col.column).replace(/-/g, "_")}`
    }, index));
    const schema = {
      version: 2,
      relation_name: relation.name,
      description: relation.description || "",
      dictionaries: state.builderDraft.map((d) => ({ table: d.table, title: d.title, columns: d.columns })),
      columns: normalizedColumns,
      result: relation.result,
      table_name: tableName
    };

    // Основний шлях: RPC створює запис у rel_registry та фізичну rel_* таблицю.
    try {
      const rpc = await sb.rpc("create_bastion_relation", {
        p_relation_name: relation.name,
        p_relation_slug: relationSlug,
        p_table_name: tableName,
        p_description: relation.description || "",
        p_schema: schema
      });
      if (!rpc.error && rpc.data) return normalizeRelationRecord(Array.isArray(rpc.data) ? rpc.data[0] : rpc.data);
      if (rpc.error) throw rpc.error;
    } catch (rpcError) {
      console.warn("BASTION create_bastion_relation RPC fallback:", rpcError?.message || rpcError);
    }

    // Fallback: якщо SQL-функція ще не встановлена, зберігаємо metadata.
    // Важливо: фізична таблиця rel_* у цьому режимі не створюється.
    const payload = {
      relation_name: relation.name,
      relation_slug: relationSlug,
      table_name: tableName,
      description: relation.description || "",
      schema,
      records_count: 0,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb
      .from("rel_registry")
      .insert(payload)
      .select("id, relation_name, relation_slug, table_name, description, schema, records_count, is_active, created_at")
      .single();
    if (error) throw error;
    return normalizeRelationRecord(data);
  }


  function normalizeColumnObject(col) {
    if (typeof col === "object" && col) return { name: col.name || col.column || col.column_name, label: col.label || baseColumnLabel(col.name || col.column || col.column_name), type: col.type || col.data_type || "text", values: col.values || [] };
    return { name: String(col), label: baseColumnLabel(col), type: "text", values: [] };
  }

  function withQuantityMeta(col, index = 0) {
    const storage = col.storage_key || `c_${String(index + 1).padStart(3, "0")}_${slugify(col.column || col.name || col.dict_column || "value").replace(/-/g, "_")}`;
    return {
      ...col,
      storage_key: storage,
      hasQuantity: col.hasQuantity ?? col.has_quantity ?? col.with_quantity ?? true,
      quantityType: col.quantityType || col.quantity_type || "integer",
      quantity_key: col.quantity_key || `${storage}_qty`
    };
  }

  function hasQuantity(col) {
    return col && col.hasQuantity !== false && col.has_quantity !== false;
  }

  function getCellValue(cell) {
    return cell && typeof cell === "object" && !Array.isArray(cell) ? (cell.value ?? "") : (cell ?? "");
  }

  function getCellQty(cell) {
    return cell && typeof cell === "object" && !Array.isArray(cell) ? (cell.qty ?? "") : "";
  }

  function makeCell(value = "", qty = "") {
    return { value: value ?? "", qty: qty ?? "" };
  }

  function formatRelationCell(cell, col) {
    const value = String(getCellValue(cell) ?? "").trim();
    const qty = String(getCellQty(cell) ?? "").trim();
    if (hasQuantity(col) && qty) return value ? `${value} × ${qty}` : qty;
    return value;
  }

  function normalizeQuantityValue(raw, type = "integer") {
    const value = String(raw ?? "").replace(",", ".").trim();
    if (!value) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error("Кількість повинна бути числом.");
    if (type === "integer" && !Number.isInteger(num)) throw new Error("Для цілої кількості введіть ціле число.");
    return type === "integer" ? parseInt(value, 10) : num;
  }

  function inferColumnType(values) {
    const sample = values.find((v) => v !== null && v !== undefined && v !== "");
    if (typeof sample === "boolean") return "boolean";
    if (typeof sample === "number") return Number.isInteger(sample) ? "integer" : "decimal";
    return "text";
  }

  function uniqueValues(values) {
    return [...new Set(values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").map((v) => String(v)))]
      .sort((a, b) => a.localeCompare(b, "uk"));
  }

  const columnLabels = {
    name: "Назва", title: "Назва", alias: "Альтернативна назва", aliases: "Альтернативні назви",
    station_name: "Станція", station: "Станція", settlement: "Населений пункт", settlement_name: "Населений пункт",
    uav_type: "Тип БПЛА", mode: "Режим", weather: "Погода", frequency: "Частота", region: "Область",
    oblast: "Область", notes: "Примітки", description: "Опис", code: "Код", type: "Тип", class: "Клас"
  };
  function baseColumnLabel(key) {
    const raw = String(key || "").trim();
    const lower = raw.toLowerCase();
    if (columnLabels[lower]) return columnLabels[lower];
    return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  const positions = [
    { x: -560, y: 4, scale: .72, opacity: .44, z: 1, rot: 0 },
    { x: -318, y: 0, scale: .88, opacity: .78, z: 5, rot: 0 },
    { x: 0, y: 0, scale: 1.34, opacity: 1, z: 12, rot: 0 },
    { x: 318, y: 0, scale: .88, opacity: .78, z: 5, rot: 0 },
    { x: 560, y: 4, scale: .72, opacity: .44, z: 1, rot: 0 },
  ];

  const state = {
    active: 0,
    flippedId: null,
    isAnimating: false,
    activeRelation: null,
    exportMode: false,
    editMode: false,
    filterMode: false,
    addRowActive: false,
    editingRowIndex: null,
    editingOriginalRow: null,
    builderStep: 1,
    builderDraft: [],
    builderActiveDict: dictionaryCatalog[0]?.table || "",
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
    const dictionaryLabel = formatDictionaryWord(dictionaryCount);
    const list = card.dictionaries.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
    const frontContent = isCreate
      ? `<div class="relation-create-plus">+</div><div class="relation-create-text">СТВОРИТИ<br>ЗВ’ЯЗОК</div>`
      : `<div class="relation-title">${renderTitle(card.name)}</div><div class="relation-count">${dictionaryCount}</div><div class="relation-count-label">${dictionaryLabel}</div>`;
    const backContent = isCreate
      ? `<div class="relation-create-plus">+</div><div class="relation-create-text">RELATION<br>BUILDER</div>`
      : `<div class="relation-back-heading">ДОВІДНИКИ</div><ul class="relation-dict-list">${list}</ul>`;

    return `
      <button class="relation-card${isCreate ? " is-create" : ""}" type="button" data-card-index="${index}" data-card-id="${card.id}" aria-label="${escapeAttr(card.name)}">
        <span class="relation-card__tilt">
          <span class="relation-card__inner">
            <span class="relation-card__face relation-card__face--front"><span class="relation-card__frame"></span><span class="relation-card__content">${frontContent}</span></span>
            <span class="relation-card__face relation-card__face--back"><span class="relation-card__frame"></span><span class="relation-card__content">${backContent}</span></span>
          </span>
        </span>
      </button>`;
  }

  function initialRender() {
    carousel.innerHTML = allCards().map((card, index) => buildCard(card, index)).join("");
    ensureRelationModal();
    ensureBuilderModal();
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
      openBuilderModal();
      return;
    }
    const relation = relations.find((item) => item.id === card.dataset.cardId);
    if (relation) openRelationModal(relation);
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
    if (event.code === "Space") { event.preventDefault(); flipActive(); }
    if (event.key === "Escape") {
      const openModal = document.querySelector(".nodes-relation-modal.is-open, .nodes-builder-modal.is-open");
      if (openModal) closeModals();
      else { state.flippedId = null; updateCards(false); }
    }
    if (event.key === "ArrowLeft") setActive(state.active - 1);
    if (event.key === "ArrowRight") setActive(state.active + 1);
  });

  function ensureRelationModal() {
    if (document.getElementById("nodesRelationModal")) return;
    const modal = document.createElement("div");
    modal.id = "nodesRelationModal";
    modal.className = "nodes-relation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="nodes-modal-backdrop" data-nodes-close></div>
      <section class="nodes-modal-card" role="dialog" aria-modal="true" aria-label="Таблиця зв’язку">
        <button class="nodes-modal-close" type="button" data-nodes-close aria-label="Закрити">×</button>
        <header class="nodes-modal-head">
          <div class="nodes-modal-titlebox">
            <h2 id="nodesRelationTitle">ЗВ’ЯЗОК</h2>
            <p id="nodesRelationLead">0 записів</p>
          </div>
          <div class="nodes-toolbar" aria-label="Інструменти зв’язку">
            <button type="button" class="nodes-tool-btn" data-nodes-export aria-label="Експорт"><img src="../assets/icons/actions/download.svg" alt=""></button>
            <button type="button" class="nodes-tool-btn" data-nodes-edit aria-label="Редагування"><img src="../assets/icons/actions/pencil.svg" alt=""></button>
            <button type="button" class="nodes-tool-btn" data-nodes-filter aria-label="Пошук"><img src="../assets/icons/actions/search.svg" alt=""></button>
            <button type="button" class="nodes-tool-btn nodes-tool-btn--danger" data-nodes-delete aria-label="Видалити"><img src="../assets/icons/actions/trash.svg" alt=""></button>
          </div>
        </header>
        <div class="nodes-meta-strip">
          <span>СТАТУС: <b><i></i> АКТИВНИЙ</b></span>
          <span>ЗАПИСІВ: <b id="nodesMetaRows">0</b></span>
          <span>ТАБЛИЦЯ: <b id="nodesMetaTable">relation_table</b></span>
        </div>
        <section id="nodesFilterPanel" class="nodes-filter-panel" hidden>
          <input id="nodesSearchInput" type="text" placeholder="Пошук по таблиці зв’язку...">
        </section>
        <section id="nodesEditPanel" class="nodes-edit-panel" hidden></section>
        <section id="nodesExportPanel" class="nodes-export-panel" hidden>
          <div class="nodes-export-grid">
            ${["json", "excel", "pdf", "csv"].map((format) => `
              <button type="button" class="nodes-export-format" data-nodes-format="${format}" aria-label="${format.toUpperCase()}">
                <img class="nodes-export-img nodes-export-img--light" src="../assets/icons/export/export-${format}-light.png" alt="${format.toUpperCase()}">
                <img class="nodes-export-img nodes-export-img--dark" src="../assets/icons/export/export-${format}-dark.png" alt="${format.toUpperCase()}">
              </button>`).join("")}
          </div>
        </section>
        <section class="nodes-table-card">
          <div id="nodesTableWrap" class="nodes-table-wrap"></div>
          <div class="nodes-table-actions">
            <button type="button" class="nodes-add-record-btn" data-nodes-add-row>+ ДОДАТИ ЗАПИС</button>
          </div>
        </section>
        <p id="nodesModalStatus" class="nodes-modal-status"></p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", handleModalClick);
    modal.addEventListener("change", handleModalChange);
    modal.querySelector("#nodesSearchInput")?.addEventListener("input", () => renderRelationTable());
  }

  function ensureBuilderModal() {
    if (document.getElementById("nodesBuilderModal")) return;
    const modal = document.createElement("div");
    modal.id = "nodesBuilderModal";
    modal.className = "nodes-builder-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="nodes-modal-backdrop" data-builder-close></div>
      <section class="nodes-builder-card" role="dialog" aria-modal="true" aria-label="Створити зв’язок">
        <button class="nodes-modal-close" type="button" data-builder-close aria-label="Закрити">×</button>
        <header class="nodes-builder-head">
          <h2>СТВОРИТИ ЗВ’ЯЗОК</h2>
          <p>Оберіть довідники та колонки для супердовідника.</p>
        </header>
        <label class="nodes-builder-name"><span>НАЗВА ЗВ’ЯЗКУ</span><input id="nodesRelationNameInput" type="text" placeholder="Наприклад: EW MATRIX"></label>
        <section id="nodesBuilderBody" class="nodes-builder-body"></section>
        <footer class="nodes-builder-actions">
          <button type="button" class="nodes-ghost-btn" data-builder-cancel>СКАСУВАТИ</button>
          <button type="button" class="nodes-primary-btn" data-builder-next>ДАЛІ</button>
          <button type="button" class="nodes-primary-btn" data-builder-create hidden>СТВОРИТИ ЗВ’ЯЗОК</button>
        </footer>
        <p id="nodesBuilderStatus" class="nodes-modal-status"></p>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", handleBuilderClick);
    modal.addEventListener("change", handleBuilderChange);
  }

  function openRelationModal(relation) {
    ensureRelationModal();
    state.activeRelation = relation;
    state.exportMode = false;
    state.editMode = false;
    state.filterMode = false;
    state.addRowActive = false;
    state.editingRowIndex = null;
    state.editingOriginalRow = null;
    const modal = document.getElementById("nodesRelationModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("nodes-modal-open");
    document.getElementById("nodesRelationTitle").textContent = relation.name.toUpperCase();
    document.getElementById("nodesRelationLead").textContent = countLabel(relation.rows?.length || 0);
    document.getElementById("nodesMetaRows").textContent = String(relation.rows?.length || 0);
    document.getElementById("nodesMetaTable").textContent = relation.tableName || `rel_${relation.id.replace(/-/g, "_")}`;
    modal.querySelector("#nodesSearchInput").value = "";
    syncModes();
    renderRelationTable();
  }

  function closeModals() {
    document.querySelectorAll(".nodes-relation-modal, .nodes-builder-modal").forEach((modal) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("nodes-modal-open");
  }

  function handleModalClick(event) {
    if (event.target.closest("[data-nodes-close]")) return closeModals();
    if (event.target.closest("[data-nodes-export]")) { state.exportMode = !state.exportMode; state.editMode = false; state.filterMode = false; state.editingRowIndex = null; syncModes(); }
    if (event.target.closest("[data-nodes-edit]")) { state.editMode = !state.editMode; state.exportMode = false; state.filterMode = false; state.editingRowIndex = null; syncModes(); }
    if (event.target.closest("[data-nodes-filter]")) { state.filterMode = !state.filterMode; state.exportMode = false; state.editMode = false; state.editingRowIndex = null; syncModes(); }
    if (event.target.closest("[data-nodes-delete]")) return deleteRelation();
    if (event.target.closest("[data-nodes-add-row]")) return startAddRelationRow();
    if (event.target.closest("[data-nodes-save-row]")) return saveNewRelationRow();
    if (event.target.closest("[data-nodes-cancel-row]")) return cancelNewRelationRow();
    const editRowBtn = event.target.closest("[data-nodes-row-edit]");
    if (editRowBtn) return startEditRelationRow(Number(editRowBtn.dataset.nodesRowEdit));
    const saveRowBtn = event.target.closest("[data-nodes-row-save]");
    if (saveRowBtn) return saveEditedRelationRow(Number(saveRowBtn.dataset.nodesRowSave));
    const cancelRowBtn = event.target.closest("[data-nodes-row-cancel]");
    if (cancelRowBtn) return cancelEditRelationRow();
    const deleteRowBtn = event.target.closest("[data-nodes-row-delete]");
    if (deleteRowBtn) return deleteRelationRow(Number(deleteRowBtn.dataset.nodesRowDelete));
    const qtyStepBtn = event.target.closest("[data-qty-step]");
    if (qtyStepBtn) return stepQuantityInput(qtyStepBtn);
    const formatBtn = event.target.closest("[data-nodes-format]");
    if (formatBtn) exportRelation(formatBtn.dataset.nodesFormat);
  }

  function handleModalChange(event) {
    const enabled = event.target.closest("[data-qty-enabled]");
    if (enabled) {
      const index = Number(enabled.dataset.qtyEnabled);
      updateQuantityMeta(index, { hasQuantity: enabled.checked });
      const select = document.querySelector(`[data-qty-type="${index}"]`);
      if (select) select.disabled = !enabled.checked;
      return;
    }
    const type = event.target.closest("[data-qty-type]");
    if (type) {
      updateQuantityMeta(Number(type.dataset.qtyType), { quantityType: type.value });
    }
  }

  async function updateQuantityMeta(index, patch) {
    const relation = state.activeRelation;
    if (!relation?.columns?.[index]) return;
    relation.columns[index] = withQuantityMeta({ ...relation.columns[index], ...patch }, index);
    renderRelationTable();
    try {
      await persistRelationSchema(relation);
      setStatus("Налаштування кількості оновлено.", "success");
    } catch (error) {
      setStatus(`Метадані оновлено локально, але Supabase не зберіг: ${error.message}`, "warn");
    }
  }

  async function persistRelationSchema(relation) {
    sb = sb || createSupabaseClient();
    if (!sb || !relation?.dbId) return;
    const schema = {
      version: 2,
      relation_name: relation.name,
      description: relation.description || "",
      dictionaries: relation.dictionaries || [],
      columns: (relation.columns || []).map((c, i) => withQuantityMeta(c, i)),
      result: relation.result || { label: "Результат", type: "text" },
      table_name: relation.tableName
    };
    const { error } = await sb.from("rel_registry").update({ schema, updated_at: new Date().toISOString() }).eq("id", relation.dbId);
    if (error) throw error;
    const changed = (relation.columns || []).find((c) => hasQuantity(c));
    if (changed) {
      try {
        await sb.rpc("ensure_bastion_relation_quantity_columns", { p_relation_id: relation.dbId });
      } catch (_) {}
    }
  }

  function syncModes() {
    const modal = document.getElementById("nodesRelationModal");
    if (!modal) return;
    modal.querySelector("[data-nodes-export]")?.classList.toggle("is-active", state.exportMode);
    modal.querySelector("[data-nodes-edit]")?.classList.toggle("is-active", state.editMode);
    modal.querySelector("[data-nodes-filter]")?.classList.toggle("is-active", state.filterMode);
    modal.querySelector("#nodesExportPanel").hidden = !state.exportMode;
    modal.querySelector("#nodesEditPanel").hidden = !state.editMode;
    modal.querySelector("#nodesFilterPanel").hidden = !state.filterMode;
    modal.querySelector("#nodesTableWrap").hidden = state.exportMode || state.editMode;
    const addBtn = modal.querySelector("[data-nodes-add-row]");
    if (addBtn) {
      addBtn.hidden = state.exportMode || state.editMode;
      addBtn.disabled = state.addRowActive;
    }
    modal.classList.toggle("nodes-export-mode", state.exportMode);
    modal.classList.toggle("nodes-edit-mode", state.editMode);
    if (state.editMode) renderEditPanel();
  }

  function renderRelationTable() {
    const relation = state.activeRelation;
    const wrap = document.getElementById("nodesTableWrap");
    if (!relation || !wrap) return;
    const query = document.getElementById("nodesSearchInput")?.value?.trim()?.toLowerCase() || "";
    const headers = relationHeaders(relation);
    const sourceRows = relation.rows || [];
    const rows = sourceRows.filter((row) => !query || row.map((cell, idx) => idx < (relation.columns || []).length ? formatRelationCell(cell, relation.columns[idx]) : cell).join(" ").toLowerCase().includes(query));
    const bodyRows = rows.length
      ? rows.map((row, i) => renderRelationRow(relation, row, i)).join("")
      : (state.addRowActive ? "" : `<tr><td colspan="${headers.length}" class="nodes-empty-cell">Записів немає</td></tr>`);
    wrap.innerHTML = `
      <table class="nodes-relation-table">
        <thead><tr>${headers.map((h, i) => `<th>${renderHeader(h, i)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows}${state.addRowActive ? renderAddRelationRow(relation, rows.length) : ""}</tbody>
      </table>`;
    const addBtn = document.querySelector("[data-nodes-add-row]");
    if (addBtn) addBtn.disabled = state.addRowActive;
  }

  function renderHeader(h, index) {
    if (index === 0) return `<span class="nodes-th-main">№</span>`;
    if (h.kind === "actions") return `<span class="nodes-th-main nodes-th-actions">ДІЇ</span>`;
    if (h.kind === "result") return `<span class="nodes-th-main">${escapeHtml(h.label)}</span><span class="nodes-th-sub">RESULT</span>`;
    return `<span class="nodes-th-main">${escapeHtml(h.dictionary)}</span><span class="nodes-th-sub">${escapeHtml(h.label || h.column)}</span>`;
  }

  function renderRelationRow(relation, row, i) {
    const cols = relation.columns || [];
    const resultIndex = cols.length;
    const isEditing = state.editingRowIndex === i;
    const actions = isEditing
      ? `<span class="nodes-row-actions"><button type="button" class="nodes-inline-ok" data-nodes-row-save="${i}" aria-label="Зберегти">✓</button><button type="button" class="nodes-inline-cancel" data-nodes-row-cancel aria-label="Скасувати">×</button></span>`
      : `<span class="nodes-row-actions"><button type="button" class="nodes-row-action" data-nodes-row-edit="${i}" aria-label="Редагувати">✎</button><button type="button" class="nodes-row-action nodes-row-action--danger" data-nodes-row-delete="${i}" aria-label="Видалити">×</button></span>`;
    return `<tr data-row-index="${i}" class="${isEditing ? "is-editing" : ""}"><td class="nodes-num-cell">${i + 1}</td>${cols.map((col, idx) => `<td>${renderValueQtyCell(col, row[idx], isEditing, idx)}</td>`).join("")}<td>${renderResultInput(relation.result, row[resultIndex], isEditing)}</td><td class="nodes-actions-cell">${actions}</td></tr>`;
  }


  function renderAddRelationRow(relation, index) {
    const cols = relation.columns || [];
    return `<tr class="nodes-add-row"><td class="nodes-num-cell">${index + 1}</td>${cols.map((col, idx) => `<td>${renderAddValueQtyCell(col, idx)}</td>`).join("")}<td>${renderAddResultInput(relation.result)}</td><td class="nodes-actions-cell"><span class="nodes-inline-actions"><button type="button" class="nodes-inline-ok" data-nodes-save-row aria-label="Зберегти">✓</button><button type="button" class="nodes-inline-cancel" data-nodes-cancel-row aria-label="Скасувати">×</button></span></td></tr>`;
  }

  function renderAddValueQtyCell(col, idx) {
    const opts = (col.values || []).map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
    const meta = withQuantityMeta(col, idx);
    const qty = hasQuantity(meta) ? renderQtyControl({ attr: `data-add-qty="${idx}"`, value: "", type: meta.quantityType, disabled: false }) : "";
    return `<div class="nodes-value-qty-cell"><select class="nodes-cell-select" data-add-col="${idx}"><option value="">— обрати —</option>${opts}</select>${qty}</div>`;
  }

  function renderAddResultInput(result) {
    const type = result?.type || "text";
    if (type === "boolean") return `<select class="nodes-cell-select nodes-add-result" data-add-result><option value="">—</option><option>Так</option><option>Ні</option></select>`;
    if (type === "number" || type === "integer" || type === "decimal") return `<input class="nodes-cell-input nodes-add-result" data-add-result type="number" value="">`;
    return `<input class="nodes-cell-input nodes-add-result" data-add-result type="text" value="" placeholder="Результат">`;
  }

  function startAddRelationRow() {
    if (!state.activeRelation) return;
    state.exportMode = false;
    state.editMode = false;
    state.filterMode = false;
    state.addRowActive = true;
    state.editingRowIndex = null;
    state.editingOriginalRow = null;
    syncModes();
    renderRelationTable();
    document.querySelector(".nodes-add-row select, .nodes-add-row input")?.focus();
  }

  function cancelNewRelationRow() {
    state.addRowActive = false;
    renderRelationTable();
  }

  async function saveNewRelationRow() {
    const relation = state.activeRelation;
    if (!relation) return;
    let values;
    try {
      values = (relation.columns || []).map((col, idx) => {
        const value = document.querySelector(`[data-add-col="${idx}"]`)?.value || "";
        const qtyRaw = document.querySelector(`[data-add-qty="${idx}"]`)?.value || "";
        const meta = withQuantityMeta(col, idx);
        const qty = hasQuantity(meta) ? normalizeQuantityValue(qtyRaw, meta.quantityType) : null;
        return makeCell(value, qty ?? "");
      });
    } catch (validationError) {
      return setStatus(validationError.message, "warn");
    }
    const resultValue = document.querySelector("[data-add-result]")?.value || "";
    if (!values.some((v) => String(getCellValue(v)).trim() || String(getCellQty(v)).trim()) && !String(resultValue).trim()) {
      return setStatus("Заповніть хоча б одне поле нового запису.", "warn");
    }
    try {
      setStatus("Зберігаю новий запис...", "loading");
      const recordId = await saveRelationRowToSupabase(relation, values, resultValue);
      const newRow = [...values, resultValue];
      if (recordId) newRow._recordId = recordId;
      relation.rows = [...(relation.rows || []), newRow];
      state.addRowActive = false;
      updateRelationCounters(relation);
      renderRelationTable();
      setStatus("Запис додано.", "success");
    } catch (error) {
      setStatus(`Не вдалося додати запис: ${error.message}`, "error");
    }
  }


  function cloneRelationRow(row) {
    const copy = [...row.map((cell) => cell && typeof cell === "object" && !Array.isArray(cell) ? makeCell(cell.value, cell.qty) : cell)];
    if (row && row._recordId) copy._recordId = row._recordId;
    return copy;
  }

  function startEditRelationRow(index) {
    const relation = state.activeRelation;
    if (!relation?.rows?.[index]) return;
    state.addRowActive = false;
    state.editingRowIndex = index;
    state.editingOriginalRow = cloneRelationRow(relation.rows[index]);
    renderRelationTable();
    document.querySelector(`tr[data-row-index="${index}"] select, tr[data-row-index="${index}"] input`)?.focus();
  }

  function cancelEditRelationRow() {
    if (state.activeRelation && state.editingRowIndex !== null && state.editingOriginalRow) {
      state.activeRelation.rows[state.editingRowIndex] = cloneRelationRow(state.editingOriginalRow);
    }
    state.editingRowIndex = null;
    state.editingOriginalRow = null;
    renderRelationTable();
  }

  async function saveEditedRelationRow(index) {
    const relation = state.activeRelation;
    if (!relation?.rows?.[index]) return;
    let values;
    try {
      values = (relation.columns || []).map((col, idx) => {
        const rowEl = document.querySelector(`tr[data-row-index="${index}"]`);
        const value = rowEl?.querySelector(`[data-edit-col="${idx}"]`)?.value || "";
        const qtyRaw = rowEl?.querySelector(`[data-edit-qty="${idx}"]`)?.value || "";
        const meta = withQuantityMeta(col, idx);
        const qty = hasQuantity(meta) ? normalizeQuantityValue(qtyRaw, meta.quantityType) : null;
        return makeCell(value, qty ?? "");
      });
    } catch (validationError) {
      return setStatus(validationError.message, "warn");
    }
    const rowEl = document.querySelector(`tr[data-row-index="${index}"]`);
    const resultValue = rowEl?.querySelector("[data-edit-result]")?.value || "";
    try {
      setStatus("Зберігаю зміни...", "loading");
      await updateRelationRowInSupabase(relation, index, values, resultValue);
      const updated = [...values, resultValue];
      if (relation.rows[index]._recordId) updated._recordId = relation.rows[index]._recordId;
      relation.rows[index] = updated;
      state.editingRowIndex = null;
      state.editingOriginalRow = null;
      renderRelationTable();
      setStatus("Зміни збережено.", "success");
    } catch (error) {
      setStatus(`Не вдалося зберегти зміни: ${error.message}`, "error");
    }
  }

  async function deleteRelationRow(index) {
    const relation = state.activeRelation;
    if (!relation?.rows?.[index]) return;
    const ok = window.confirm("Видалити цей запис?");
    if (!ok) return;
    try {
      setStatus("Видаляю запис...", "loading");
      await deleteRelationRowFromSupabase(relation, index);
      relation.rows.splice(index, 1);
      state.editingRowIndex = null;
      state.editingOriginalRow = null;
      updateRelationCounters(relation);
      renderRelationTable();
      setStatus("Запис видалено.", "success");
    } catch (error) {
      setStatus(`Не вдалося видалити запис: ${error.message}`, "error");
    }
  }

  function relationRowPayload(relation, values, resultValue, index = 0) {
    const payload = {
      row_order: index + 1,
      result_value: resultValue,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    (relation.columns || []).forEach((col, colIndex) => {
      const meta = withQuantityMeta(col, colIndex);
      const key = meta.storage_key;
      payload[key] = getCellValue(values[colIndex]) || null;
      if (hasQuantity(meta)) payload[meta.quantity_key || `${key}_qty`] = getCellQty(values[colIndex]) === "" ? null : getCellQty(values[colIndex]);
    });
    return payload;
  }

  async function ensureQuantityColumnsForRelation(relation) {
    sb = sb || createSupabaseClient();
    if (!sb || !relation?.dbId) return;
    if (!(relation.columns || []).some((c) => hasQuantity(c))) return;
    try {
      await sb.rpc("ensure_bastion_relation_quantity_columns", { p_relation_id: relation.dbId });
    } catch (error) {
      console.warn("BASTION quantity columns RPC unavailable:", error?.message || error);
    }
  }

  async function updateRelationRowInSupabase(relation, index, values, resultValue) {
    sb = sb || createSupabaseClient();
    if (!sb || !relation?.isLive || !relation?.tableName) return;
    await ensureQuantityColumnsForRelation(relation);
    const payload = relationRowPayload(relation, values, resultValue, index);
    const recordId = relation.rows[index]?._recordId;
    if (!recordId) throw new Error("Не знайдено ID запису для оновлення. Перезавантаж сторінку та спробуй ще раз.");
    const { error } = await sb.from(relation.tableName).update(payload).eq("id", recordId);
    if (error) throw error;
  }

  async function deleteRelationRowFromSupabase(relation, index) {
    sb = sb || createSupabaseClient();
    if (!sb || !relation?.isLive || !relation?.tableName) return;
    const recordId = relation.rows[index]?._recordId;
    if (!recordId) throw new Error("Не знайдено ID запису для видалення. Перезавантаж сторінку та спробуй ще раз.");
    let { error } = await sb.from(relation.tableName).delete().eq("id", recordId);
    if (error) {
      const soft = await sb.from(relation.tableName).update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", recordId);
      error = soft.error;
    }
    if (error) throw error;
    try {
      await sb.from("rel_registry").update({ records_count: Math.max(0, (relation.rows || []).length - 1), updated_at: new Date().toISOString() }).eq("id", relation.dbId);
    } catch (_) {}
  }

  async function saveRelationRowToSupabase(relation, values, resultValue) {
    sb = sb || createSupabaseClient();
    if (!sb || !relation?.isLive || !relation?.tableName) return null;
    await ensureQuantityColumnsForRelation(relation);
    const payload = relationRowPayload(relation, values, resultValue, (relation.rows || []).length);
    let { data, error } = await sb.from(relation.tableName).insert(payload).select("id").single();
    if (error && /schema cache|column .*(_qty|row_order)|Could not find .*(_qty|row_order)/i.test(error.message || "")) {
      await ensureQuantityColumnsForRelation(relation);
      const retry = await sb.from(relation.tableName).insert(payload).select("id").single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    try {
      await sb.from("rel_registry").update({ records_count: (relation.rows || []).length + 1, updated_at: new Date().toISOString() }).eq("id", relation.dbId);
    } catch (_) {}
    return data?.id || null;
  }

  function updateRelationCounters(relation) {
    const count = relation.rows?.length || 0;
    const lead = document.getElementById("nodesRelationLead");
    const metaRows = document.getElementById("nodesMetaRows");
    if (lead) lead.textContent = countLabel(count);
    if (metaRows) metaRows.textContent = String(count);
  }

  function renderValueQtyCell(col, cell, editable = false, idx = 0) {
    const value = getCellValue(cell);
    const qty = getCellQty(cell);
    const meta = withQuantityMeta(col, idx);
    const disabled = editable ? "" : " disabled";
    const opts = (meta.values || []).map((v) => `<option value="${escapeAttr(v)}"${String(v) === String(value) ? " selected" : ""}>${escapeHtml(v)}</option>`).join("");
    const qtyInput = hasQuantity(meta) ? renderQtyControl({ attr: `data-edit-qty="${idx}"`, value: qty, type: meta.quantityType, disabled: !editable }) : "";
    return `<div class="nodes-value-qty-cell"><select class="nodes-cell-select" data-edit-col="${idx}"${disabled}><option value="">—</option>${opts}</select>${qtyInput}</div>`;
  }

  function renderQtyControl({ attr, value = "", type = "integer", disabled = false }) {
    const step = type === "decimal" ? "0.01" : "1";
    const disabledAttr = disabled ? " disabled" : "";
    const lockClass = disabled ? " is-locked" : "";
    return `<span class="nodes-qty-control${lockClass}" data-qty-control>
      <button type="button" class="nodes-qty-step nodes-qty-step--minus" data-qty-step="-1" aria-label="Зменшити кількість"${disabledAttr}>−</button>
      <input class="nodes-cell-input nodes-qty-input" ${attr} type="number" step="${step}" min="0" value="${escapeAttr(value)}" placeholder="к-сть"${disabledAttr}>
      <button type="button" class="nodes-qty-step nodes-qty-step--plus" data-qty-step="1" aria-label="Збільшити кількість"${disabledAttr}>+</button>
    </span>`;
  }

  function stepQuantityInput(button) {
    if (!button || button.disabled) return;
    const control = button.closest("[data-qty-control]");
    const input = control?.querySelector(".nodes-qty-input");
    if (!input || input.disabled) return;
    const direction = Number(button.dataset.qtyStep || 0);
    const step = Number(input.step || 1) || 1;
    const current = Number(String(input.value || "0").replace(",", ".")) || 0;
    const next = Math.max(0, current + direction * step);
    input.value = step < 1 ? String(Math.round(next * 100) / 100) : String(Math.round(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  function renderResultInput(result, value, editable = false) {
    const type = result?.type || "text";
    const disabled = editable ? "" : " disabled";
    if (type === "boolean") return `<select class="nodes-cell-select nodes-result-input" data-edit-result${disabled}><option value=""${!value ? " selected" : ""}>—</option><option${value === "Так" ? " selected" : ""}>Так</option><option${value === "Ні" ? " selected" : ""}>Ні</option></select>`;
    if (type === "number" || type === "integer" || type === "decimal") return `<input class="nodes-cell-input nodes-result-input" data-edit-result type="number" value="${escapeAttr(value || "")}"${disabled}>`;
    return `<input class="nodes-cell-input nodes-result-input" data-edit-result type="text" value="${escapeAttr(value || "")}"${disabled}>`;
  }

  function renderEditPanel() {
    const relation = state.activeRelation;
    const panel = document.getElementById("nodesEditPanel");
    if (!relation || !panel) return;
    panel.innerHTML = `
      <h3>СТРУКТУРА ЗВ’ЯЗКУ</h3>
      <div class="nodes-structure-list">
        ${(relation.columns || []).map((c, i) => {
          const meta = withQuantityMeta(c, i);
          return `<div class="nodes-structure-row nodes-structure-row--quantity"><b>${i + 1}</b><span>${escapeHtml(meta.dictionary)}</span><small>${escapeHtml(meta.label || meta.column)}</small><label class="nodes-quantity-toggle"><input type="checkbox" data-qty-enabled="${i}" ${hasQuantity(meta) ? "checked" : ""}> <span>Кількість</span></label><select data-qty-type="${i}" ${hasQuantity(meta) ? "" : "disabled"}><option value="integer"${meta.quantityType === "integer" ? " selected" : ""}>Ціле</option><option value="decimal"${meta.quantityType === "decimal" ? " selected" : ""}>Десяткове</option></select><button type="button">✎</button><button type="button">×</button></div>`;
        }).join("")}
        <div class="nodes-structure-row is-result"><b>R</b><span>${escapeHtml(relation.result?.label || "Результат")}</span><small>${escapeHtml(relation.result?.type || "text")}</small><button type="button">✎</button></div>
      </div>`;
  }

  async function deleteRelation() {
    const relation = state.activeRelation;
    if (!relation) return;
    const ok = window.confirm(`Видалити зв’язок «${relation.name}»?`);
    if (!ok) return;

    sb = sb || createSupabaseClient();
    if (!sb || !relation.dbId) {
      relations = relations.filter((item) => item.id !== relation.id);
      closeModals();
      initialRender();
      return;
    }

    try {
      const { error } = await sb
        .from("rel_registry")
        .update({ is_active: false, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", relation.dbId);
      if (error) throw error;
      relations = relations.filter((item) => item.id !== relation.id);
      closeModals();
      initialRender();
    } catch (error) {
      setStatus(`Не вдалося видалити зв’язок: ${error.message}`, "error");
    }
  }

  function openBuilderModal() {
    ensureBuilderModal();
    state.builderStep = 1;
    state.builderDraft = [];
    state.builderActiveDict = dictionaryCatalog[0]?.table || "";
    const modal = document.getElementById("nodesBuilderModal");
    modal.querySelector("#nodesRelationNameInput").value = "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("nodes-modal-open");
    renderBuilder();
  }

  function renderBuilder() {
    const body = document.getElementById("nodesBuilderBody");
    if (!body) return;
    const next = document.querySelector("[data-builder-next]");
    const create = document.querySelector("[data-builder-create]");
    next.hidden = state.builderStep !== 1;
    create.hidden = state.builderStep !== 2;
    if (state.builderStep === 1) renderBuilderStepOne(body);
    else renderBuilderStepTwo(body);
  }

  function renderBuilderStepOne(body) {
    const active = dictionaryCatalog.find((d) => d.table === state.builderActiveDict) || dictionaryCatalog[0];
    const selected = state.builderDraft.find((d) => d.table === active.table)?.columns || [];
    const activeColumns = (active?.columns || []).map(normalizeColumnObject).filter((col) => col.name);
    body.innerHTML = `
      <div class="nodes-builder-split">
        <aside class="nodes-builder-dicts"><h3>ДОВІДНИКИ</h3>${dictionaryCatalog.map((dict) => `<button type="button" class="${dict.table === active.table ? "is-active" : ""}" data-builder-dict="${dict.table}">${escapeHtml(dict.title)}<small>${escapeHtml(dict.table)}</small></button>`).join("")}</aside>
        <section class="nodes-builder-cols"><h3>КОЛОНКИ: ${escapeHtml(active.title)}</h3><div class="nodes-column-checks">
          ${activeColumns.length ? activeColumns.map((col) => `<label><input type="checkbox" value="${escapeAttr(col.name)}" ${selected.includes(col.name) ? "checked" : ""}> <span>${escapeHtml(col.label || col.name)}</span><small>${escapeHtml(String(col.type || "text").toUpperCase())}</small></label>`).join("") : `<p class="nodes-builder-empty">Колонки не знайдені. Перевір таблицю в Supabase або записи довідника.</p>`}
        </div><button type="button" class="nodes-primary-btn" data-builder-add-cols>ДОДАТИ ДО ЗВ’ЯЗКУ</button></section>
      </div>
      <div class="nodes-draft-preview"><b>CURRENT RELATION</b>${state.builderDraft.length ? state.builderDraft.map((d) => `<span>${escapeHtml(d.title)}: ${d.columns.map((c) => escapeHtml(baseColumnLabel(c))).join(", ")}</span>`).join("") : `<em>Колонки ще не додані.</em>`}</div>`;
  }

  function renderBuilderStepTwo(body) {
    const rows = [];
    state.builderDraft.forEach((dict) => dict.columns.forEach((col) => rows.push({ dict: dict.title, col })));
    body.innerHTML = `
      <section class="nodes-builder-structure">
        <h3>ФІНАЛЬНА СТРУКТУРА</h3>
        <p>Рядки можна буде перетягувати місцями після підключення збереження структури.</p>
        <div class="nodes-builder-rows">${rows.map((r, i) => `<div class="nodes-builder-row" draggable="true"><b>${i + 1}</b><span>${escapeHtml(r.dict)}</span><small>${escapeHtml(r.col)}</small></div>`).join("")}</div>
        <div class="nodes-result-row"><input id="nodesResultName" type="text" value="Результат"><select id="nodesResultType"><option value="text">Текст</option><option value="integer">Ціле число</option><option value="decimal">Десяткове</option><option value="boolean">Так/Ні</option></select></div>
      </section>`;
  }

  function handleBuilderClick(event) {
    if (event.target.closest("[data-builder-close], [data-builder-cancel]")) return closeModals();
    const dictBtn = event.target.closest("[data-builder-dict]");
    if (dictBtn) { state.builderActiveDict = dictBtn.dataset.builderDict; renderBuilder(); return; }
    if (event.target.closest("[data-builder-add-cols]")) return addBuilderColumns();
    if (event.target.closest("[data-builder-next]")) return nextBuilderStep();
    if (event.target.closest("[data-builder-create]")) return createBuilderRelation();
  }

  function handleBuilderChange() {}

  function addBuilderColumns() {
    const active = dictionaryCatalog.find((d) => d.table === state.builderActiveDict);
    const checks = [...document.querySelectorAll(".nodes-builder-cols input[type='checkbox']:checked")].map((c) => c.value);
    if (!active || !checks.length) return setBuilderStatus("Оберіть хоча б одну колонку.", "error");
    const existing = state.builderDraft.find((d) => d.table === active.table);
    if (existing) existing.columns = [...new Set([...existing.columns, ...checks])];
    else state.builderDraft.push({ table: active.table, title: active.title, columns: checks });
    setBuilderStatus("Колонки додано до зв’язку.", "success");
    renderBuilder();
  }

  function nextBuilderStep() {
    const name = document.getElementById("nodesRelationNameInput")?.value?.trim();
    if (!name) return setBuilderStatus("Введіть назву зв’язку.", "error");
    if (!state.builderDraft.length) return setBuilderStatus("Додайте хоча б один довідник і одну колонку.", "error");
    state.builderStep = 2;
    renderBuilder();
  }

  async function createBuilderRelation() {
    const name = document.getElementById("nodesRelationNameInput")?.value?.trim();
    const resultName = document.getElementById("nodesResultName")?.value?.trim() || "Результат";
    const resultType = document.getElementById("nodesResultType")?.value || "text";
    if (!name) return setBuilderStatus("Введіть назву зв’язку.", "error");
    if (!state.builderDraft.length) return setBuilderStatus("Додайте хоча б один довідник і одну колонку.", "error");

    const columns = [];
    state.builderDraft.forEach((d) => d.columns.forEach((col, index) => {
      const catalogCol = getCatalogColumn(d.table, col);
      columns.push(withQuantityMeta({
        dictionary: d.title,
        sourceTable: d.table,
        column: col,
        label: catalogCol?.label || baseColumnLabel(col),
        type: catalogCol?.type || "text",
        values: catalogCol?.values || getCatalogColumnValues(d.table, col),
        key: `${d.table}.${col}`,
        order_index: columns.length,
        hasQuantity: true,
        quantityType: "integer"
      }, columns.length));
    }));

    const relation = {
      id: slugify(name),
      tableName: `rel_${slugify(name).replace(/-/g, "_")}`,
      name,
      description: "",
      dictionaries: state.builderDraft.map((d) => d.title),
      columns,
      result: { label: resultName, type: resultType },
      rows: []
    };

    try {
      setBuilderStatus("Зберігаю зв’язок у Supabase...", "loading");
      const saved = await saveRelationToSupabase(relation);
      relations.unshift(saved);
      closeModals();
      initialRender();
      setActive(0);
      openRelationModal(saved);
    } catch (error) {
      setBuilderStatus(`Не вдалося зберегти у Supabase: ${error.message}. Перевір таблиці rel_registry / rel_rows та RLS.`, "error");
    }
  }

  function relationHeaders(relation) {
    return [{ label: "№" }, ...(relation.columns || []), { kind: "result", label: relation.result?.label || "Результат" }, { kind: "actions", label: "Дії" }];
  }

  function exportRelation(format) {
    const relation = state.activeRelation;
    if (!relation) return;
    const exportHeaders = relationHeaders(relation).filter((h) => h.kind !== "actions");
    const headers = exportHeaders.map((h, idx) => idx === 0 ? "№" : h.kind === "result" ? h.label : `${h.dictionary} / ${h.label || h.column}`);
    const rows = (relation.rows || []).map((row, idx) => [idx + 1, ...(relation.columns || []).map((col, colIdx) => formatRelationCell(row[colIdx], col)), row[(relation.columns || []).length] ?? ""]);
    const filename = exportFileName(relation.name, format === "excel" ? "xlsx" : format);
    if (format === "json") {
      const payload = { relation_name: relation.name, description: relation.description || "", generated_at: new Date().toISOString(), columns: headers, rows };
      return downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", filename);
    }
    if (format === "csv") return downloadBlob("\ufeff" + [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n"), "text/csv;charset=utf-8", filename);
    if (format === "excel") return downloadBlob(makeXlsxBlob(headers, rows, relation.name), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    if (format === "pdf") return exportPdfReport(relation, headers, rows, filename);
  }

  function exportFileName(title, ext) {
    const clean = String(title || "relation").toLowerCase().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
    return `${clean || "relation"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
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
    setTimeout(() => URL.revokeObjectURL(url), 700);
  }

  function makeXlsxBlob(headers, rows, title = "BASTION") {
    const shared = [];
    const si = new Map();
    const getSi = (v) => {
      const s = String(v ?? "");
      if (!si.has(s)) { si.set(s, shared.length); shared.push(s); }
      return si.get(s);
    };
    const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const colName = (n) => { let s = ""; while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; } return s; };
    const data = [headers, ...rows];
    const sheetRows = data.map((r, ridx) => `<row r="${ridx + 1}">${r.map((v, cidx) => `<c r="${colName(cidx)}${ridx + 1}" t="s"><v>${getSi(v)}</v></c>`).join("")}</row>`).join("");
    const files = {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(title).slice(0,31) || "Relation"}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`,
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
    };
    return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  
async function exportPdfReport(relation, headers, rows, filename) {
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js");
    if (!window.pdfMake) throw new Error("pdfMake unavailable");
    const user = profileInfo();
    const tableName = `rel_${relation.id.replace(/-/g, "_")}`;
    const body = [
      headers.map((h) => ({ text: h.toUpperCase(), bold: true, color:"#ffffff", fillColor:"#0c0f16", margin:[8,10] })),
      ...rows.map((r)=>r.map((v)=>({text:String(v ?? ""), margin:[8,12]})))
    ];

    const doc = {
      pageMargins:[22,24,22,26],
      content:[
        {
          columns:[
            [
              { text: relation.name.toUpperCase(), fontSize:28, bold:true, color:"#e91c24", characterSpacing:1.5 },
              { text: `Таблиця: ${tableName}`, margin:[0,8,0,0], color:"#222", fontSize:12 }
            ],
            {
              stack:[
                { text:"BASTION SYSTEM", alignment:"right", fontSize:22, bold:true, color:"#111" },
                { text:"◢", alignment:"right", color:"#e91c24", fontSize:30 }
              ]
            }
          ]
        },
        { canvas:[{type:"line", x1:0,y1:12,x2:760,y2:12,lineWidth:1,lineColor:"#e91c24"}], margin:[0,10,0,18] },
        {
          table:{ headerRows:1, widths: headers.map((_,i)=> i===0?36:"*"), body },
          layout:{
            fillColor:(row)=> row===0 ? "#0c0f16" : null,
            hLineColor:()=>"#d8d8d8",
            vLineColor:()=>"#d8d8d8"
          }
        }
      ],
      footer:(current,pageCount)=>({
        margin:[26,8],
        columns:[
          { text:"bastion-system.com", color:"#444", fontSize:9 },
          { text:`Дата: ${new Date().toLocaleDateString("uk-UA")}`, alignment:"center", fontSize:9 },
          { text:`Час: ${new Date().toLocaleTimeString("uk-UA")}`, alignment:"center", fontSize:9 },
          { text:`Виконавець: ${user.login}`, alignment:"center", fontSize:9 },
          { text:`Email: ${user.email}`, alignment:"center", fontSize:9 },
          { text:`Записів: ${rows.length}`, alignment:"right", fontSize:9 }
        ]
      }),
      defaultStyle:{ font:"Roboto", fontSize:10 }
    };
    window.pdfMake.createPdf(doc).download(filename);
  } catch(err) {

      const html = `<html><head><meta charset="UTF-8"><title>${escapeHtml(relation.name)}</title></head><body><h1>${escapeHtml(relation.name)}</h1><table border="1"><thead><tr>${headers.map((h)=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r)=>`<tr>${r.map((v)=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
      downloadBlob(html, "text/html;charset=utf-8", filename.replace(/\.pdf$/i, ".html"));
      setStatus("PDF-бібліотеку не завантажено. Збережено HTML-звіт як fallback.", "warn");
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function profileInfo() {
    return {
      login: document.getElementById("profileLogin")?.textContent?.trim() || document.getElementById("operatorName")?.textContent?.trim() || "невідомо",
      email: document.getElementById("profileEmail")?.textContent?.trim() || "email не визначено"
    };
  }

  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameBytes = enc.encode(name);
      const data = enc.encode(content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); dv.setUint16(12, 0, true); dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30); parts.push(local, data);
      const cent = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(cent.buffer);
      cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0, true); cdv.setUint16(10, 0, true); cdv.setUint16(12, 0, true); cdv.setUint16(14, 0, true); cdv.setUint32(16, crc, true); cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true); cdv.setUint16(28, nameBytes.length, true); cdv.setUint32(42, offset, true);
      cent.set(nameBytes, 46); central.push(cent); offset += local.length + data.length;
    }
    const centralSize = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array(22);
    const edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, central.length, true); edv.setUint16(10, central.length, true); edv.setUint32(12, centralSize, true); edv.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function setStatus(message, type = "") {
    const el = document.getElementById("nodesModalStatus");
    if (el) { el.textContent = message || ""; el.dataset.type = type; }
  }

  function setBuilderStatus(message, type = "") {
    const el = document.getElementById("nodesBuilderStatus");
    if (el) { el.textContent = message || ""; el.dataset.type = type; }
  }

  function getCatalogColumn(table, column) {
    const dict = dictionaryCatalog.find((d) => d.table === table);
    return (dict?.columns || []).map(normalizeColumnObject).find((item) => item.name === column);
  }

  function getCatalogColumnValues(table, column) {
    const col = getCatalogColumn(table, column);
    return col?.values?.length ? col.values : sampleValues(column);
  }

  function sampleValues(col) { return ["Варіант 1", "Варіант 2", "Варіант 3"].map((v) => `${v} (${col})`); }
  function slugify(s) { return String(s || "relation").toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").replace(/^-|-$/g, "") || `relation-${Date.now()}`; }
  function countLabel(n) { return `${n} ${n === 1 ? "запис" : (n >= 2 && n <= 4 ? "записи" : "записів")}`; }

  function formatDictionaryWord(count) {
    const n = Math.abs(Number(count) || 0);
    const lastTwo = n % 100;
    const lastOne = n % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return "довідників";
    if (lastOne === 1) return "довідник";
    if (lastOne >= 2 && lastOne <= 4) return "довідники";
    return "довідників";
  }

  function renderTitle(value) {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    return words.map((word) => `<span class="relation-title__line">${escapeHtml(word)}</span>`).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttr(value) { return escapeHtml(value).replaceAll("\n", " "); }

  async function bootNodesPage() {
    initialRender();
    await loadLiveDictionaryCatalog();
    await loadLiveRelations();
    initialRender();
    if (!relations.length && lastSupabaseError) {
      console.warn("BASTION relations not loaded:", lastSupabaseError);
    }
  }

  bootNodesPage();
})();
