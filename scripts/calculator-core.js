(() => {
  const byId = (id) => document.getElementById(id);

  const fallbackLinkPresets = {
    distance: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера'],
      rows: [
        { id: 'r1', name: 'SN4 + ZA1 + PID1 + PR2', range: '24 200 м', enabled: true },
        { id: 'r2', name: 'SN7 + ZA8 + PID5 + PR1', range: '27 400 м', enabled: true },
        { id: 'r3', name: 'SN2 + ZA3 + PID2 + PR0', range: '14 500 м', enabled: true },
        { id: 'r4', name: 'SN6 + ZA10 + PID2 + PR1', range: '22 000 м', enabled: true },
        { id: 'r5', name: 'SN5 + ZA4 + PID3 + PR2', range: '18 500 м', enabled: true },
        { id: 'r6', name: 'SN8 + ZA6 + PID4 + PR0', range: '20 800 м', enabled: true }
      ]
    },
    nato155: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера', 'Модулі зарядів', 'Додаткові елементи'],
      rows: [
        { id: 'n1', name: '155 HE + Charge A + Fuse M', range: '23 000 м', enabled: true },
        { id: 'n2', name: '155 ERFB + Charge B + Fuse V', range: '31 000 м', enabled: true },
        { id: 'n3', name: '155 Smoke + Charge A + Fuse T', range: '18 000 м', enabled: true },
        { id: 'n4', name: '155 Illum + Charge C + Fuse T', range: '21 500 м', enabled: true }
      ]
    },
    reserve: {
      components: ['Снаряди', 'Заряди', 'Підривники'],
      rows: [
        { id: 'q1', name: 'Reserve A + Base charge + Fuse 1', range: '12 000 м', enabled: true },
        { id: 'q2', name: 'Reserve B + Base charge + Fuse 2', range: '15 000 м', enabled: true },
        { id: 'q3', name: 'Reserve C + Boost charge + Fuse 2', range: '17 500 м', enabled: true }
      ]
    }
  };

  let linkPresets = { ...fallbackLinkPresets };

  const createCalculatorSupabaseClient = () => {
    if (window.BastionSupabase) return window.BastionSupabase;
    if (window.supabaseClient) return window.supabaseClient;
    const cfg = window.BASTION_CONFIG || {};
    const url = cfg.SUPABASE_URL || window.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
    if (!window.supabase || !url || !key) return null;
    return window.supabase.createClient(url, key);
  };

  const cleanLabel = (value) => String(value ?? '')
    .replace(/^dict_/i, '')
    .replace(/^rel_/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const normalizeLinkKey = (value) => String(value || 'relation')
    .toLowerCase()
    .replace(/[а-яіїєґ]/gi, (ch) => ({
      'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya'
    }[ch.toLowerCase()] || ch))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'relation';

  const unique = (items) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

  const normalizeRelationSchemaColumns = (schema) => {
    const cols = Array.isArray(schema?.columns) ? schema.columns : [];
    return cols.map((col, index) => {
      const sourceTable = col.sourceTable || col.table || col.dict_table || col.source_table || '';
      const column = col.column || col.name || col.dict_column || '';
      const storageKey = col.storage_key || col.storageKey || `c_${String(index + 1).padStart(3, '0')}_${normalizeLinkKey(column).replace(/-/g, '_')}`;
      const quantityKey = col.quantity_key || col.quantityKey || `${storageKey}_qty`;
      return {
        dictionary: col.dictionary || col.dictTitle || col.title || cleanLabel(sourceTable) || `Елемент ${index + 1}`,
        label: col.label || cleanLabel(column) || `Колонка ${index + 1}`,
        sourceTable, column, storageKey, quantityKey,
        hasQuantity: col.hasQuantity ?? col.has_quantity ?? true
      };
    });
  };

  const formatRelationCell = (value, qty) => {
    const label = String(value ?? '').trim();
    if (!label) return '';
    const amount = String(qty ?? '').trim();
    return amount ? `${label} ×${amount}` : label;
  };

  const relationResultRange = (record, schema) => {
    const resultKeys = [
      'result_value', 'result', '__result', 'range', 'distance', 'дальність',
      schema?.result?.storage_key, schema?.result?.column
    ].filter(Boolean);
    for (const key of resultKeys) {
      const value = record?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        const text = String(value).trim();
        return /м|км/i.test(text) ? text : `${text} м`;
      }
    }
    return '—';
  };

  const relationRowName = (record, columns) => {
    const parts = columns.map((col) => formatRelationCell(record?.[col.storageKey], record?.[col.quantityKey])).filter(Boolean);
    return parts.length ? parts.join(' + ') : (record?.name || record?.title || record?.id || 'Рядок зв’язку');
  };

  const relationRowsFromRecords = (records, columns, schema) => records.map((record, index) => ({
    id: String(record?.id || `row-${index + 1}`),
    name: relationRowName(record, columns),
    range: relationResultRange(record, schema),
    enabled: record?.is_active === false ? false : true,
    raw: record
  }));

  const loadRelationRowsForCalculator = async (sb, relation, columns, schema) => {
    if (!sb || !relation.tableName) return [];
    try {
      const { data, error } = await sb.from(relation.tableName).select('*').limit(1000);
      if (!error && Array.isArray(data)) return relationRowsFromRecords(data, columns, schema);
    } catch (error) {
      console.warn('BASTION calculator relation table fallback:', relation.tableName, error?.message || error);
    }
    try {
      const { data, error } = await sb
        .from('rel_rows')
        .select('id, row_data, is_active, created_at')
        .eq('relation_id', relation.dbId)
        .eq('is_active', true)
        .limit(1000);
      if (!error && Array.isArray(data)) {
        return data.map((row, index) => {
          const payload = row.row_data || {};
          return {
            id: String(row.id || `row-${index + 1}`),
            name: Array.isArray(payload.values) ? payload.values.filter(Boolean).join(' + ') : relationRowName(payload, columns),
            range: relationResultRange(payload, schema),
            enabled: row.is_active !== false,
            raw: payload
          };
        });
      }
    } catch (error) {
      console.warn('BASTION calculator rel_rows fallback:', error?.message || error);
    }
    return [];
  };

  const loadLiveLinkPresets = async () => {
    const sb = createCalculatorSupabaseClient();
    if (!sb) return false;
    try {
      const { data, error } = await sb
        .from('rel_registry')
        .select('id, relation_name, relation_slug, table_name, description, schema, records_count, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error || !Array.isArray(data) || !data.length) throw error || new Error('rel_registry empty');

      const next = {};
      for (const item of data) {
        const schema = item.schema || {};
        const columns = normalizeRelationSchemaColumns(schema);
        const components = unique([
          ...(Array.isArray(schema.dictionaries) ? schema.dictionaries.map((d) => d.title || d.name || d.table || d) : []),
          ...columns.map((col) => col.dictionary)
        ]);
        const key = item.relation_slug || normalizeLinkKey(item.relation_name || item.table_name || item.id);
        const relation = { dbId: item.id, tableName: item.table_name || schema.table_name || `rel_${normalizeLinkKey(item.relation_name).replace(/-/g, '_')}` };
        const rows = await loadRelationRowsForCalculator(sb, relation, columns, schema);
        next[key] = {
          id: key,
          name: item.relation_name || schema.relation_name || key,
          description: item.description || schema.description || '',
          components: components.length ? components : ['Елементи зв’язку'],
          rows: rows.length ? rows : [{ id: `${key}-empty`, name: 'Записи зв’язку ще не додані', range: '—', enabled: false }],
          columns,
          source: 'supabase'
        };
      }
      linkPresets = Object.keys(next).length ? next : { ...fallbackLinkPresets };
      window.BASTION_CALCULATOR_LINKS = linkPresets;
      return true;
    } catch (error) {
      console.warn('BASTION calculator live links fallback:', error?.message || error);
      linkPresets = { ...fallbackLinkPresets };
      return false;
    }
  };

  const populateLinkSelect = () => {
    if (!linkSelect) return;
    const previous = linkSelect.value;
    linkSelect.innerHTML = Object.entries(linkPresets).map(([key, preset]) => (
      `<option value="${key.replace(/"/g, '&quot;')}">${String(preset.name || key).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</option>`
    )).join('');
    if (linkPresets[previous]) linkSelect.value = previous;
  };

  const fallbackUnitPresets = [
    { id: 'u1', name: '1 САДн', enabled: true },
    { id: 'u2', name: '2 САДн', enabled: true },
    { id: 'u3', name: '3 САДн', enabled: true },
    { id: 'u4', name: 'Резерв БК', enabled: true }
  ];

  const IMPORT_STORAGE_KEYS = [
    'bastion.import.context',
    'bastionImportContext',
    'BASTION_IMPORT_CONTEXT',
    'bastionUploadImportContext'
  ];

  const normalizeUnitName = (value) => String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/садн/gi, 'САДн')
    .replace(/адн/gi, 'АДн')
    .toLocaleLowerCase('uk-UA');

  const safeJsonParse = (value) => {
    try { return value ? JSON.parse(value) : null; } catch (_) { return null; }
  };

  const readImportContext = () => {
    for (const key of IMPORT_STORAGE_KEYS) {
      const raw = safeJsonParse(window.localStorage?.getItem(key)) || safeJsonParse(window.sessionStorage?.getItem(key));
      if (raw && typeof raw === 'object') return raw;
    }
    return null;
  };

  const unitsFromImportContext = () => {
    const ctx = readImportContext();
    const map = new Map();
    const addUnit = (value, sourceName = '') => {
      if (!value) return;
      const rawName = typeof value === 'string' ? value : (value.name || value.unitName || value.title || value.label || value.value || value.id || value.unitId || '');
      const name = String(rawName || '').trim();
      if (!name) return;
      const key = normalizeUnitName(name);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          id: String((typeof value === 'object' && (value.id || value.unitId)) || key),
          name,
          enabled: typeof value === 'object' ? value.enabled !== false : true,
          sourceFiles: []
        });
      }
      if (sourceName) map.get(key).sourceFiles.push(sourceName);
    };

    if (ctx) {
      if (Array.isArray(ctx.units)) ctx.units.forEach((unit) => addUnit(unit));
      if (Array.isArray(ctx.files)) {
        ctx.files.forEach((file) => {
          const unitName = file.unitName || file.unit || file.review?.unitName || file.review?.unit || '';
          const unitId = file.unitId || file.review?.unitId || unitName;
          addUnit({ id: unitId, name: unitName || unitId }, file.name || file.fileName || '');
        });
      }
    }

    return [...map.values()];
  };

  const numericQuantityFrom = (value) => {
    if (value == null || value === '') return null;
    const num = Number(String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : null;
  };

  const collectImportQuantities = () => {
    const ctx = readImportContext();
    const values = [];
    const scanItem = (item) => {
      if (!item || typeof item !== 'object') return;
      const candidates = [item.quantity, item.count, item.qty, item.amount, item.total, item.value, item['кількість'], item['загалом']];
      for (const candidate of candidates) {
        const qty = numericQuantityFrom(candidate);
        if (qty !== null) {
          values.push(qty);
          return;
        }
      }
    };
    const scanArray = (rows) => {
      if (!Array.isArray(rows)) return;
      rows.forEach(scanItem);
    };
    if (ctx && typeof ctx === 'object') {
      scanArray(ctx.items);
      scanArray(ctx.inventory);
      if (Array.isArray(ctx.files)) {
        ctx.files.forEach((file) => {
          scanArray(file.items);
          scanArray(file.rows);
          scanArray(file.known);
          scanArray(file.unknown);
          if (Array.isArray(file.review?.known)) scanArray(file.review.known);
          if (Array.isArray(file.review?.unknown)) scanArray(file.review.unknown);
        });
      }
    }
    return values.filter((value) => Number.isFinite(value));
  };

  const importLimitDefaults = () => {
    const values = collectImportQuantities();
    if (!values.length) return null;
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  };

  let unitPresets = unitsFromImportContext();
  if (!unitPresets.length) unitPresets = fallbackUnitPresets.map(unit => ({ ...unit }));

  const clampNumber = (value, min = 0, max = 9999) => {
    const parsed = Number.parseInt(String(value ?? '').replace(/\D+/g, ''), 10);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
  };

  const getLimitValue = (id) => {
    const input = byId(id);
    return input ? clampNumber(input.value, Number(input.min || 0), Number(input.max || 9999)) : 0;
  };

  const updateRange = (input, source = 'range') => {
    const out = byId(`${input.id}Out`);
    if (!out) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 9999);
    const next = clampNumber(source === 'number' ? out.value : input.value, min, max);
    input.value = String(next);
    out.value = String(next);
  };

  const applyImportLimitDefaults = () => {
    const defaults = importLimitDefaults();
    if (!defaults) return;
    const controls = [
      { range: byId('calcMin'), number: byId('calcMinOut'), value: defaults.min },
      { range: byId('calcMax'), number: byId('calcMaxOut'), value: defaults.max }
    ];
    const dynamicMax = Math.max(9999, defaults.max);
    controls.forEach(({ range, number, value }) => {
      if (range instanceof HTMLInputElement) {
        range.max = String(dynamicMax);
        range.value = String(value);
      }
      if (number instanceof HTMLInputElement) {
        number.max = String(dynamicMax);
        number.value = String(value);
      }
      if (range instanceof HTMLInputElement) updateRange(range, 'range');
    });
  };

  applyImportLimitDefaults();

  document.querySelectorAll('.calc-range-row input[type="range"]').forEach((input) => {
    updateRange(input);
    input.addEventListener('input', () => updateRange(input, 'range'));
    const out = byId(`${input.id}Out`);
    if (out instanceof HTMLInputElement) {
      out.addEventListener('input', () => updateRange(input, 'number'));
      out.addEventListener('blur', () => updateRange(input, 'number'));
    }
  });

  document.querySelectorAll('[data-stepper]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = byId(button.dataset.stepper);
      if (!input) return;
      const delta = Number(button.dataset.delta || 0) * 10;
      const next = Math.max(
        Number(input.min || 0),
        Math.min(Number(input.max || 9999), Number(input.value || 0) + delta)
      );
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  const linkSelect = byId('calcLinkSelect');
  const componentsBadge = byId('calcComponentsBadge');
  const componentsCount = byId('calcComponentsCount');
  const popover = byId('calcComponentsPopover');
  const popoverList = byId('calcComponentsPopoverList');
  const linkModal = byId('calcLinkModal');
  const linkRows = byId('calcLinkRows');
  const unitsBadge = byId('calcUnitsBadge');
  const unitsPopover = byId('calcUnitsPopover');
  const unitsPopoverList = byId('calcUnitsPopoverList');
  const matrixButton = byId('calcMatrixButton');
  const matrixModal = byId('calcMatrixModal');
  const unitRows = byId('calcUnitRows');
  const unitCount = byId('calcUnitCount');
  const tuningButton = byId('calcLinkTuningButton');
  const selectAllButton = byId('calcLinkSelectAll');
  const clearAllButton = byId('calcLinkClearAll');
  const unitsSelectAllButton = byId('calcUnitsSelectAll');
  const unitsClearAllButton = byId('calcUnitsClearAll');
  const unitLimitsButton = byId('calcUnitLimitsButton');
  const unitLimitsModal = byId('calcUnitLimitsModal');
  const unitLimitsRows = byId('calcUnitLimitsRows');
  const unitLimitsState = new Map();
  let unitLimitsInitialized = false;

  const currentPreset = () => {
    const key = linkSelect?.value || Object.keys(linkPresets)[0] || 'distance';
    return linkPresets[key] || Object.values(linkPresets)[0] || fallbackLinkPresets.distance;
  };

  if (popover && popover.parentElement !== document.body) {
    document.body.appendChild(popover);
  }
  if (unitsPopover && unitsPopover.parentElement !== document.body) {
    document.body.appendChild(unitsPopover);
  }

  const placePopover = () => {
    if (!popover || !componentsBadge || popover.hidden) return;
    const rect = componentsBadge.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - 32);
    let left = rect.left;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 16) left = 16;

    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;

    const below = rect.bottom + gap;
    const estimatedHeight = Math.min(popover.offsetHeight || 120, 220);
    const canOpenBelow = below + estimatedHeight < window.innerHeight - 16;
    popover.classList.toggle('is-floating-above', !canOpenBelow);
    popover.style.top = canOpenBelow ? `${below}px` : `${Math.max(16, rect.top - estimatedHeight - gap)}px`;
  };

  const placeUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge || unitsPopover.hidden) return;
    const rect = unitsBadge.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - 32);
    let left = rect.left;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 16) left = 16;
    unitsPopover.style.width = `${width}px`;
    unitsPopover.style.left = `${left}px`;
    const below = rect.bottom + gap;
    const estimatedHeight = Math.min(unitsPopover.offsetHeight || 120, 220);
    const canOpenBelow = below + estimatedHeight < window.innerHeight - 16;
    unitsPopover.classList.toggle('is-floating-above', !canOpenBelow);
    unitsPopover.style.top = canOpenBelow ? `${below}px` : `${Math.max(16, rect.top - estimatedHeight - gap)}px`;
  };

  const closePopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = true;
    componentsBadge.setAttribute('aria-expanded', 'false');
  };

  const closeUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge) return;
    unitsPopover.hidden = true;
    unitsBadge.setAttribute('aria-expanded', 'false');
  };

  const openPopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = false;
    componentsBadge.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(placePopover);
  };

  const openUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge) return;
    unitsPopover.hidden = false;
    unitsBadge.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(placeUnitsPopover);
  };

  const renderComponents = () => {
    const preset = currentPreset();
    if (componentsCount) componentsCount.textContent = String(preset.components.length);
    if (popoverList) {
      popoverList.innerHTML = '';
      preset.components.forEach((name) => {
        const item = document.createElement('span');
        item.textContent = name;
        popoverList.appendChild(item);
      });
    }
  };

  const renderUnits = () => {
    if (unitCount) unitCount.textContent = String(unitPresets.length);
    if (unitsPopoverList) {
      unitsPopoverList.innerHTML = '';
      unitPresets.forEach((unit) => {
        const item = document.createElement('span');
        item.textContent = unit.name;
        unitsPopoverList.appendChild(item);
      });
    }
  };

  const renderUnitRows = () => {
    if (!unitRows) return;
    unitRows.innerHTML = '';
    unitPresets.forEach((unit, index) => {
      const label = document.createElement('label');
      label.className = 'calc-link-row calc-unit-row';
      label.innerHTML = `
        <input type="checkbox" ${unit.enabled ? 'checked' : ''} data-unit-row="${unit.id}">
        <span class="calc-link-row__check" aria-hidden="true"></span>
        <span class="calc-link-row__body">
          <strong>${String(index + 1).padStart(2, '0')} · ${unit.name}</strong>
          <em>${unit.enabled ? 'Увімкнено для обміну' : 'Виключено з обміну'}</em>
        </span>
      `;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        unit.enabled = Boolean(input.checked);
        label.classList.toggle('is-disabled', !unit.enabled);
        const hint = label.querySelector('em');
        if (hint) hint.textContent = unit.enabled ? 'Увімкнено для обміну' : 'Виключено з обміну';
      });
      label.classList.toggle('is-disabled', !unit.enabled);
      unitRows.appendChild(label);
    });
  };
 
  const ensureUnitLimitState = () => {
    if (unitLimitsInitialized) return;
    const globalMin = getLimitValue('calcMin');
    const globalMax = getLimitValue('calcMax');
    unitPresets.forEach((unit) => {
      if (!unitLimitsState.has(unit.id)) {
        unitLimitsState.set(unit.id, { min: globalMin, max: globalMax, touched: false });
      }
    });
    unitLimitsInitialized = true;
  };

  const syncUnitLimitControl = (row, type, source = 'range') => {
    const range = row.querySelector(`[data-unit-limit-range="${type}"]`);
    const number = row.querySelector(`[data-unit-limit-number="${type}"]`);
    if (!(range instanceof HTMLInputElement) || !(number instanceof HTMLInputElement)) return;
    const next = clampNumber(source === 'number' ? number.value : range.value, Number(range.min || 0), Number(range.max || 9999));
    range.value = String(next);
    number.value = String(next);
    const unitId = row.dataset.unitId;
    if (!unitId) return;
    const state = unitLimitsState.get(unitId) || { min: getLimitValue('calcMin'), max: getLimitValue('calcMax'), touched: false };
    state[type] = next;
    state.touched = true;
    unitLimitsState.set(unitId, state);
  };

  const renderUnitLimitRows = () => {
    if (!unitLimitsRows) return;
    ensureUnitLimitState();
    unitLimitsRows.innerHTML = '';
    unitPresets.forEach((unit, index) => {
      const state = unitLimitsState.get(unit.id) || { min: getLimitValue('calcMin'), max: getLimitValue('calcMax'), touched: false };
      const row = document.createElement('article');
      row.className = 'calc-unit-limit-row';
      row.dataset.unitId = unit.id;
      row.innerHTML = `
        <div class="calc-unit-limit-row__title">
          <strong>${String(index + 1).padStart(2, '0')} · ${unit.name}</strong>
          <span>Індивідуальні обмеження</span>
        </div>
        <div class="calc-unit-limit-row__controls">
          <div class="calc-unit-limit-control">
            <span>Мінімум</span>
            <button type="button" data-unit-limit-step="min" data-delta="-10">−</button>
            <input type="range" min="0" max="9999" value="${state.min}" data-unit-limit-range="min" />
            <button type="button" data-unit-limit-step="min" data-delta="10">+</button>
            <input type="number" min="0" max="9999" value="${state.min}" inputmode="numeric" data-unit-limit-number="min" aria-label="Мінімум для ${unit.name}" />
          </div>
          <div class="calc-unit-limit-control">
            <span>Максимум</span>
            <button type="button" data-unit-limit-step="max" data-delta="-10">−</button>
            <input type="range" min="0" max="9999" value="${state.max}" data-unit-limit-range="max" />
            <button type="button" data-unit-limit-step="max" data-delta="10">+</button>
            <input type="number" min="0" max="9999" value="${state.max}" inputmode="numeric" data-unit-limit-number="max" aria-label="Максимум для ${unit.name}" />
          </div>
        </div>
      `;
      row.querySelectorAll('[data-unit-limit-range]').forEach((range) => {
        range.addEventListener('input', () => syncUnitLimitControl(row, range.dataset.unitLimitRange, 'range'));
      });
      row.querySelectorAll('[data-unit-limit-number]').forEach((number) => {
        number.addEventListener('input', () => syncUnitLimitControl(row, number.dataset.unitLimitNumber, 'number'));
        number.addEventListener('blur', () => syncUnitLimitControl(row, number.dataset.unitLimitNumber, 'number'));
      });
      row.querySelectorAll('[data-unit-limit-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const type = button.dataset.unitLimitStep;
          const range = row.querySelector(`[data-unit-limit-range="${type}"]`);
          if (!(range instanceof HTMLInputElement)) return;
          const next = clampNumber(Number(range.value || 0) + Number(button.dataset.delta || 0), Number(range.min || 0), Number(range.max || 9999));
          range.value = String(next);
          syncUnitLimitControl(row, type, 'range');
        });
      });
      unitLimitsRows.appendChild(row);
    });
  };

  const renderRows = () => {
    const preset = currentPreset();
    if (!linkRows) return;
    linkRows.innerHTML = '';
    preset.rows.forEach((row, index) => {
      const label = document.createElement('label');
      label.className = 'calc-link-row';
      label.innerHTML = `
        <input type="checkbox" ${row.enabled ? 'checked' : ''} data-link-row="${row.id}">
        <span class="calc-link-row__check" aria-hidden="true"></span>
        <span class="calc-link-row__body">
          <strong>${String(index + 1).padStart(2, '0')} · ${row.name}</strong>
          <em>Дальність: ${row.range}</em>
        </span>
      `;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        row.enabled = Boolean(input.checked);
        label.classList.toggle('is-disabled', !row.enabled);
      });
      label.classList.toggle('is-disabled', !row.enabled);
      linkRows.appendChild(label);
    });
  };

  const openModal = () => {
    if (!linkModal) return;
    closePopover();
    closeUnitsPopover();
    renderRows();
    linkModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = linkModal.querySelector('[data-close-calc-link-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeModal = () => {
    if (!linkModal) return;
    linkModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (tuningButton instanceof HTMLElement) tuningButton.focus({ preventScroll: true });
  };

  const openMatrixModal = () => {
    if (!matrixModal) return;
    closePopover();
    closeUnitsPopover();
    renderUnitRows();
    matrixModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = matrixModal.querySelector('[data-close-calc-matrix-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeMatrixModal = () => {
    if (!matrixModal) return;
    matrixModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (matrixButton instanceof HTMLElement) matrixButton.focus({ preventScroll: true });
  };


  const openUnitLimitsModal = () => {
    if (!unitLimitsModal) return;
    closePopover();
    closeUnitsPopover();
    renderUnitLimitRows();
    unitLimitsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = unitLimitsModal.querySelector('[data-close-calc-unit-limits-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeUnitLimitsModal = () => {
    if (!unitLimitsModal) return;
    unitLimitsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (unitLimitsButton instanceof HTMLElement) unitLimitsButton.focus({ preventScroll: true });
  };

  if (componentsBadge) {
    componentsBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      if (popover?.hidden) openPopover();
      else closePopover();
    });
  }

  if (unitsBadge) {
    unitsBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      if (unitsPopover?.hidden) openUnitsPopover();
      else closeUnitsPopover();
    });
  }

  document.addEventListener('click', (event) => {
    if (popover && !popover.hidden) {
      if (!(event.target instanceof Node && (popover.contains(event.target) || componentsBadge?.contains(event.target)))) closePopover();
    }
    if (unitsPopover && !unitsPopover.hidden) {
      if (!(event.target instanceof Node && (unitsPopover.contains(event.target) || unitsBadge?.contains(event.target)))) closeUnitsPopover();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closePopover();
    closeUnitsPopover();
    closeModal();
    closeMatrixModal();
    closeUnitLimitsModal();
  });

  window.addEventListener('resize', () => { placePopover(); placeUnitsPopover(); });
  window.addEventListener('scroll', () => { placePopover(); placeUnitsPopover(); }, true);

  if (linkSelect) {
    linkSelect.addEventListener('change', () => {
      closePopover();
      closeUnitsPopover();
      renderComponents();
      if (linkModal?.getAttribute('aria-hidden') === 'false') renderRows();
    });
    populateLinkSelect();
    renderComponents();
    loadLiveLinkPresets().then(() => {
      populateLinkSelect();
      renderComponents();
      if (linkModal?.getAttribute('aria-hidden') === 'false') renderRows();
    });
  }
  renderUnits();

  tuningButton?.addEventListener('click', openModal);
  matrixButton?.addEventListener('click', openMatrixModal);
  unitLimitsButton?.addEventListener('click', openUnitLimitsModal);
  document.querySelectorAll('[data-close-calc-link-modal]').forEach((item) => item.addEventListener('click', closeModal));
  document.querySelectorAll('[data-close-calc-matrix-modal]').forEach((item) => item.addEventListener('click', closeMatrixModal));
  document.querySelectorAll('[data-close-calc-unit-limits-modal]').forEach((item) => item.addEventListener('click', closeUnitLimitsModal));

  selectAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = true);
    renderRows();
  });

  clearAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = false);
    renderRows();
  });

  unitsSelectAllButton?.addEventListener('click', () => {
    unitPresets.forEach((unit) => unit.enabled = true);
    renderUnitRows();
  });

  unitsClearAllButton?.addEventListener('click', () => {
    unitPresets.forEach((unit) => unit.enabled = false);
    renderUnitRows();
  });

  document.querySelectorAll('.calc-mode').forEach((label) => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.calc-mode').forEach((item) => item.classList.remove('is-active'));
      label.classList.add('is-active');
      const input = label.querySelector('input');
      if (input) input.checked = true;
    });
  });



  const ANALYSIS_STORAGE_KEYS = [
    'bastion.analysis.result',
    'bastion.calculation.result',
    'bastionCalculatorResult',
    'bastionAnalysisResult'
  ];

  const parseRangeMeters = (value) => {
    const text = String(value ?? '').toLowerCase().replace(',', '.');
    const num = Number.parseFloat(text.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(num)) return 0;
    return text.includes('км') ? Math.round(num * 1000) : Math.round(num);
  };

  const normalizeItemName = (value) => String(value || '').trim() || 'Елемент';

  const analysisItemsFromImport = () => {
    const ctx = readImportContext();
    const rows = [];
    const pushItem = (file, item) => {
      if (!item || typeof item !== 'object') return;
      const unit = String(file?.unitName || file?.unit || file?.review?.unitName || file?.review?.unit || '').trim();
      if (!unit) return;
      const qty = numericQuantityFrom(item.quantity ?? item.count ?? item.qty ?? item.amount ?? item.total ?? item.value ?? item['кількість'] ?? item['загалом']);
      if (qty === null) return;
      rows.push({
        unit,
        name: normalizeItemName(item.name || item.title || item.label || item.value || item.item || item['назва'] || item['найменування']),
        qty
      });
    };
    if (ctx && Array.isArray(ctx.files)) {
      ctx.files.forEach((file) => {
        const itemArrays = [file.items, file.known, file.rows, file.inventory].filter(Array.isArray);
        itemArrays.forEach((arr) => arr.forEach((item) => pushItem(file, item)));
      });
    }
    return rows;
  };

  const normalizeInventoryKey = (value) => String(value || '')
    .toLocaleLowerCase('uk-UA')
    .replace(/[«»"']/g, '')
    .replace(/\s*[×x*]\s*\d+(?:[.,]\d+)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parseNeedFromToken = (token) => {
    const text = String(token || '').trim();
    const match = text.match(/^(.*?)\s*(?:[×x*]\s*(\d+(?:[.,]\d+)?))?\s*$/i);
    const name = String(match?.[1] || text).trim();
    const need = numericQuantityFrom(match?.[2]);
    return { name, need: need && need > 0 ? need : 1 };
  };

  const recipeComponentsFromRow = (row, preset) => {
    const raw = row?.raw && typeof row.raw === 'object' ? row.raw : null;
    const columns = Array.isArray(preset?.columns) ? preset.columns : [];
    const fromRaw = [];

    if (raw && columns.length) {
      columns.forEach((col) => {
        if (col?.hasQuantity === false) return;
        const valueKeys = [col.storageKey, col.storage_key, col.column, col.label, col.dictionary].filter(Boolean);
        let label = '';
        for (const key of valueKeys) {
          if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
            label = String(raw[key]).trim();
            break;
          }
        }
        if (!label) return;
        const qtyKeys = [col.quantityKey, col.quantity_key, `${col.storageKey || ''}_qty`, `${col.storage_key || ''}_qty`].filter(Boolean);
        let need = 1;
        for (const key of qtyKeys) {
          const parsed = numericQuantityFrom(raw[key]);
          if (parsed !== null && parsed > 0) {
            need = parsed;
            break;
          }
        }
        fromRaw.push({ name: label, need });
      });
    }

    const source = fromRaw.length ? fromRaw : String(row?.name || '')
      .split(/\s*\+\s*/)
      .map(parseNeedFromToken)
      .filter((item) => item.name);

    const merged = new Map();
    source.forEach((item) => {
      const key = normalizeInventoryKey(item.name);
      if (!key) return;
      const prev = merged.get(key) || { name: item.name, need: 0, key };
      prev.need += Math.max(1, Number(item.need || 1));
      merged.set(key, prev);
    });
    return [...merged.values()];
  };

  const buildStockByUnit = (items, enabledUnits) => {
    const stock = new Map();
    const ensureUnit = (unit) => {
      const key = normalizeUnitName(unit);
      if (!key || (enabledUnits.size && !enabledUnits.has(key))) return null;
      if (!stock.has(key)) stock.set(key, { unit, total: 0, items: new Map() });
      return stock.get(key);
    };

    items.forEach((item) => {
      const group = ensureUnit(item.unit);
      if (!group) return;
      const qty = Math.max(0, Number(item.qty || 0));
      const itemKey = normalizeInventoryKey(item.name);
      if (!itemKey) return;
      const previous = group.items.get(itemKey) || { name: item.name, qty: 0 };
      previous.qty += qty;
      group.items.set(itemKey, previous);
      group.total += qty;
    });

    return stock;
  };

  const findStockItem = (itemsMap, component) => {
    const exact = itemsMap.get(component.key);
    if (exact) return exact;
    const candidates = [...itemsMap.entries()];
    const loose = candidates.find(([key]) => key.includes(component.key) || component.key.includes(key));
    return loose ? loose[1] : null;
  };

  const groupRowsArray = (map) => [...map.values()].map(group => ({
    unit: group.unit,
    total: group.total,
    items: [...group.items.values()]
      .filter(item => Number(item.qty || 0) > 0 || Number(item.used || 0) > 0 || Number(item.initial || 0) > 0)
      .sort((a, b) => Number(b.qty || b.used || 0) - Number(a.qty || a.used || 0) || a.name.localeCompare(b.name, 'uk'))
  })).filter(group => group.items.length);

  const groupedAnalysisFromItems = (items) => {
    const minReserve = getLimitValue('calcMin');
    const maxTake = Math.max(0, getLimitValue('calcMax'));
    const enabledUnits = new Set(unitPresets.filter(u => u.enabled !== false).map(u => normalizeUnitName(u.name)));
    const preset = currentPreset();
    const enabledRows = (preset?.rows || []).filter(row => row.enabled !== false);
    const recipes = enabledRows.map(row => ({
      row,
      components: recipeComponentsFromRow(row, preset),
      rangeMeters: parseRangeMeters(row.range)
    })).filter(recipe => recipe.components.length);

    const stockByUnit = buildStockByUnit(items, enabledUnits);

    const legacyFallback = () => {
      const allocationMap = new Map();
      const remainMap = new Map();
      let totalStock = 0;
      let totalAllocated = 0;
      let totalRemain = 0;
      const ensureGroup = (map, unit) => {
        const key = normalizeUnitName(unit);
        if (!map.has(key)) map.set(key, { unit, total: 0, items: new Map() });
        return map.get(key);
      };
      items.forEach((item) => {
        const unitKey = normalizeUnitName(item.unit);
        if (enabledUnits.size && !enabledUnits.has(unitKey)) return;
        const qty = Math.max(0, Number(item.qty || 0));
        const usable = Math.max(0, qty - minReserve);
        const alloc = Math.max(0, Math.min(maxTake || usable, usable));
        const remain = Math.max(0, qty - alloc);
        totalStock += qty;
        totalAllocated += alloc;
        totalRemain += remain;
        const allocationGroup = ensureGroup(allocationMap, item.unit);
        const remainGroup = ensureGroup(remainMap, item.unit);
        allocationGroup.items.set(item.name, { name: item.name, qty: alloc, used: alloc, initial: qty });
        allocationGroup.total += alloc;
        const previousRemain = remainGroup.items.get(item.name) || { name: item.name, qty: 0, initial: 0, used: 0 };
        remainGroup.items.set(item.name, {
          name: item.name,
          qty: Number(previousRemain.qty || 0) + remain,
          initial: Number(previousRemain.initial || 0) + qty,
          used: Number(previousRemain.used || 0) + alloc
        });
        remainGroup.total += remain;
      });
      const remains = groupRowsArray(remainMap);
      const allocations = groupRowsArray(allocationMap);
      const flatRemains = remains.flatMap(group => group.items.map(item => ({ ...item, unit: group.unit })));
      const bottleneck = flatRemains.length
        ? flatRemains.slice().sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name, 'uk'))[0].name
        : '—';
      return {
        allocations,
        remains,
        kits: totalAllocated,
        remainTotal: totalRemain,
        remainPercent: totalStock ? Math.round((totalRemain / totalStock) * 100) : 0,
        bottleneck,
        calculationMode: 'legacy-stock-allocation'
      };
    };

    if (!recipes.length || !stockByUnit.size) return legacyFallback();

    const allocationMap = new Map();
    const remainMap = new Map();
    const unitRecipeResults = [];
    let totalStock = 0;
    let totalUsed = 0;
    let totalRemain = 0;

    const ensureResultGroup = (map, unit) => {
      const key = normalizeUnitName(unit);
      if (!map.has(key)) map.set(key, { unit, total: 0, items: new Map() });
      return map.get(key);
    };

    stockByUnit.forEach((unitStock, unitKey) => {
      totalStock += unitStock.total;
      const evaluated = recipes.map((recipe) => {
        const componentResults = recipe.components.map((component) => {
          const stockItem = findStockItem(unitStock.items, component);
          const initial = Number(stockItem?.qty || 0);
          const usableAfterReserve = Math.max(0, initial - minReserve);
          const available = maxTake > 0 ? Math.min(usableAfterReserve, maxTake) : usableAfterReserve;
          const kitsByItem = component.need > 0 ? Math.floor(available / component.need) : 0;
          return {
            name: stockItem?.name || component.name,
            key: component.key,
            need: component.need,
            initial,
            available,
            kitsByItem
          };
        });
        const kits = componentResults.length ? Math.min(...componentResults.map(item => item.kitsByItem)) : 0;
        const bottleneckItem = componentResults.slice().sort((a, b) => a.kitsByItem - b.kitsByItem || a.name.localeCompare(b.name, 'uk'))[0];
        return { recipe, components: componentResults, kits, bottleneckItem };
      });

      const best = evaluated.sort((a, b) => b.kits - a.kits || b.recipe.rangeMeters - a.recipe.rangeMeters || String(a.recipe.row.name).localeCompare(String(b.recipe.row.name), 'uk'))[0];
      const usedByKey = new Map();
      if (best && best.kits > 0) {
        const allocationGroup = ensureResultGroup(allocationMap, unitStock.unit);
        best.components.forEach((component) => {
          const used = best.kits * component.need;
          usedByKey.set(component.key, (usedByKey.get(component.key) || 0) + used);
          const previous = allocationGroup.items.get(component.key) || { name: component.name, qty: 0, used: 0, initial: 0 };
          previous.qty += used;
          previous.used += used;
          previous.initial += component.initial;
          allocationGroup.items.set(component.key, previous);
          allocationGroup.total += used;
          totalUsed += used;
        });
      }

      const remainGroup = ensureResultGroup(remainMap, unitStock.unit);
      unitStock.items.forEach((stockItem, itemKey) => {
        const used = Math.min(Number(stockItem.qty || 0), Number(usedByKey.get(itemKey) || 0));
        const remain = Math.max(0, Number(stockItem.qty || 0) - used);
        remainGroup.items.set(itemKey, {
          name: stockItem.name,
          qty: remain,
          initial: Number(stockItem.qty || 0),
          used
        });
        remainGroup.total += remain;
        totalRemain += remain;
      });

      unitRecipeResults.push({
        unit: unitStock.unit,
        recipe: best?.recipe?.row?.name || '—',
        kits: best?.kits || 0,
        range: best?.recipe?.row?.range || '—',
        rangeMeters: best?.recipe?.rangeMeters || 0,
        bottleneck: best?.bottleneckItem?.name || '—'
      });
    });

    const remains = groupRowsArray(remainMap);
    const allocations = groupRowsArray(allocationMap);
    const totalKits = unitRecipeResults.reduce((sum, item) => sum + Number(item.kits || 0), 0);
    const bottleneck = unitRecipeResults.length
      ? unitRecipeResults.slice().sort((a, b) => a.kits - b.kits || a.bottleneck.localeCompare(b.bottleneck, 'uk'))[0].bottleneck
      : '—';

    return {
      allocations,
      remains,
      kits: totalKits,
      remainTotal: totalRemain,
      remainPercent: totalStock ? Math.round((totalRemain / totalStock) * 100) : 0,
      bottleneck,
      unitRecipeResults,
      calculationMode: 'recipe-minimum-by-components',
      usedTotal: totalUsed
    };
  };

  const buildAnalysisResult = () => {
    const importItems = analysisItemsFromImport();
    const inventoryResult = groupedAnalysisFromItems(importItems);
    const preset = currentPreset();
    const enabledRows = (preset.rows || []).filter(row => row.enabled !== false);
    const bestRange = enabledRows.length
      ? Math.max(...enabledRows.map(row => parseRangeMeters(row.range)))
      : 0;
    const fallbackMode = document.querySelector('.calc-mode input:checked')?.value || 'general';
    return {
      version: 3,
      createdAt: new Date().toISOString(),
      mode: fallbackMode === 'range' ? 'Вибір максимальної дальності' : 'Загальний розрахунок',
      selectedLink: linkSelect?.selectedOptions?.[0]?.textContent?.trim() || linkSelect?.value || '',
      bestRange,
      kits: inventoryResult.kits,
      bottleneck: inventoryResult.bottleneck,
      remainTotal: inventoryResult.remainTotal,
      remainPercent: inventoryResult.remainPercent,
      allocations: inventoryResult.allocations,
      remains: inventoryResult.remains,
      unitRecipeResults: inventoryResult.unitRecipeResults || [],
      calculationMode: inventoryResult.calculationMode || '',
      usedTotal: inventoryResult.usedTotal || 0,
      source: 'calculator-import-context'
    };
  };

  const saveAnalysisResult = (result) => {
    const raw = JSON.stringify(result);
    ANALYSIS_STORAGE_KEYS.forEach((key) => {
      try { window.localStorage?.setItem(key, raw); } catch (_) {}
      try { window.sessionStorage?.setItem(key, raw); } catch (_) {}
    });
  };

  const runButton = byId('calcRunButton');
  if (runButton) {
    runButton.addEventListener('click', () => {
      const analysisResult = buildAnalysisResult();
      saveAnalysisResult(analysisResult);
      runButton.classList.add('is-loading');
      runButton.innerHTML = '<span aria-hidden="true">▣</span> Розрахунок… <span aria-hidden="true">›</span>';
      window.setTimeout(() => {
        window.location.href = './analysis.html';
      }, 650);
    });
  }


  // v278: Lavash-style 3D bend for calculator cards.
  const enableCardTilt = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = document.querySelectorAll('.calc-card');
    cards.forEach((card) => {
      let raf = 0;
      const resetTilt = () => {
        window.cancelAnimationFrame(raf);
        card.classList.remove('is-tilting');
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
        card.style.setProperty('--spot-x', '50%');
        card.style.setProperty('--spot-y', '22%');
      };
      card.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 8;
        const rotateX = (0.5 - y) * 8;
        window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(() => {
          card.classList.add('is-tilting');
          card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
          card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
          card.style.setProperty('--spot-x', `${(x * 100).toFixed(1)}%`);
          card.style.setProperty('--spot-y', `${(y * 100).toFixed(1)}%`);
        });
      });
      card.addEventListener('pointerleave', resetTilt);
      card.addEventListener('blur', resetTilt, true);
    });
  };
  enableCardTilt();
})();
