(() => {
  const page = document.querySelector('.upload-core-page');
  if (!page) return;

  const fileInput = document.getElementById('uploadFileInput');
  const dropZone = document.getElementById('uploadDropZone');
  const filesList = document.getElementById('uploadFilesList');
  const fileCount = document.getElementById('uploadFileCount');
  const plateText = document.getElementById('uploadPlateText');
  const platePercent = document.getElementById('uploadPlatePercent');
  const progressPlate = document.querySelector('.upload-progress-plate');
  const dropTitle = dropZone?.querySelector('.upload-orb__copy strong');
  const dropHint = dropZone?.querySelector('.upload-orb__copy span');
  const coreWordCloud = document.getElementById('uploadCoreWordCloud');
  const startButton = document.getElementById('uploadStartButton');
  const resultsButton = document.getElementById('uploadResultsButton');
  const clearQueueButton = document.getElementById('uploadClearQueueButton');
  const resultsModal = document.getElementById('uploadResultsModal');
  const resultsBody = document.getElementById('uploadResultsBody');
  const resetButton = document.getElementById('uploadResetButton');
  const confirmButton = document.getElementById('uploadConfirmButton');
  const IMPORT_STORAGE_KEYS = ['bastion.import.context', 'bastionImportContext', 'BASTION_IMPORT_CONTEXT', 'bastionUploadImportContext'];
  const allowed = new Set(['xlsx', 'csv', 'json']);
  const MIN_PARSE_TIME = 10000;
  const RIGHT_PANEL = document.getElementById('uploadRightPanel');

  const DICT_CONFIG = [
    { key: 'projectiles', table: 'dict_projectiles', label: 'Снаряди' },
    { key: 'charges', table: 'dict_charges', label: 'Заряди' },
    { key: 'fuzes', table: 'dict_fuzes', label: 'Підривники' },
    { key: 'primers', table: 'dict_primers', label: 'Праймери' }
  ];
  const NAME_FIELDS = ['name', 'title', 'title_ua', 'marking', 'mark', 'code', 'value', 'raw_value', 'nomenclature', 'item', 'назва', 'найменування'];
  const QTY_FIELDS = ['count', 'quantity', 'qty', 'amount', 'залишок', 'кількість', 'загалом', 'total'];
  const ALIAS_FIELDS = ['alias', 'aliases', 'short_name', 'full_name', 'display_name', 'markings', 'variants'];
  const DICT_HINTS = {
    projectiles: ['снаряд', 'projectile', 'projectiles', 'shell'],
    charges: ['заряд', 'charge', 'charges'],
    fuzes: ['підривник', 'fuze', 'fuzes', 'fuse', 'detonator'],
    primers: ['праймер', 'primer', 'primers', 'капсуль']
  };
  const UNKNOWN_TABLE = 'dict_unknown_values';

  let files = [];
  let parsed = false;
  let timer = null;
  let fileSeq = 0;
  let dictionariesLoaded = false;
  let dictionaryLoadPromise = null;
  let columnCache = new Map();
  let dictState = {
    units: [],
    catalogs: {},
    catalogIndex: new Map()
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function sb() { return window.sb || window.supabaseClient || window.BastionSupabase || null; }
  function normalizeValue(value) {
    return String(value ?? '')
      .trim()
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/[“”«»]/g, '"')
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('uk-UA');
  }

  function normalizeToken(value) {
    return normalizeValue(value)
      .replace(/[^0-9a-zа-яіїєґ_\-]+/giu, '')
      .replace(/_+/g, '_')
      .replace(/-+/g, '-');
  }

  function valueVariants(value) {
    const base = normalizeValue(value);
    const token = normalizeToken(value);
    const compact = base.replace(/\s+/g, '');
    return [...new Set([base, token, compact].filter(Boolean))];
  }
  function rowName(row) {
    if (row == null) return '';
    if (typeof row === 'string' || typeof row === 'number') return String(row);
    for (const field of NAME_FIELDS) if (row[field] != null && String(row[field]).trim()) return String(row[field]);
    const firstString = Object.values(row).find(v => typeof v === 'string' && v.trim());
    return firstString || '';
  }
  function rowQty(row) {
    if (row == null || typeof row !== 'object') return 0;
    for (const field of QTY_FIELDS) {
      if (row[field] != null && String(row[field]).trim() !== '') {
        const num = Number(String(row[field]).replace(',', '.'));
        return Number.isInteger(num) ? num : NaN;
      }
    }
    const numeric = Object.values(row).find(v => Number.isInteger(Number(v)));
    return numeric == null ? 0 : Number(numeric);
  }
  function splitAliases(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.flatMap(splitAliases);
    if (typeof value === 'object') return Object.values(value).flatMap(splitAliases);
    return String(value).split(/[;,|\n]/).map(v => v.trim()).filter(Boolean);
  }

  function collectRowNames(row) {
    const values = [rowName(row)];
    if (row && typeof row === 'object') {
      NAME_FIELDS.forEach(field => { if (row[field] != null) values.push(row[field]); });
      ALIAS_FIELDS.forEach(field => { if (row[field] != null) values.push(...splitAliases(row[field])); });
    }
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
  }

  function dictionaryMatchesConfig(item, cfg) {
    const hay = [item?.code, item?.table_name, item?.title, item?.title_ua, item?.name].join(' ').toLocaleLowerCase('uk-UA');
    return (DICT_HINTS[cfg.key] || []).some(h => hay.includes(h));
  }

  function inferDictConfig(item) {
    return DICT_CONFIG.find(cfg => dictionaryMatchesConfig(item, cfg)) || null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  async function fetchTable(table, columns = '*') {
    const client = sb();
    if (!client) return [];
    try {
      const { data, error } = await client.from(table).select(columns).limit(5000);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn(`[BASTION upload] ${table} unavailable:`, error?.message || error);
      return [];
    }
  }


  async function fetchRegistry() {
    const rows = await fetchTable('dict_registry', 'id, code, table_name, title, title_ua, is_active, sort_order');
    return rows.filter(r => r?.is_active !== false && r?.table_name);
  }

  async function fetchColumns(table) {
    if (columnCache.has(table)) return columnCache.get(table);
    const client = sb();
    let cols = [];
    if (client?.rpc) {
      try {
        const { data, error } = await client.rpc('get_bastion_dictionary_columns', { p_table_name: table });
        if (!error && Array.isArray(data)) cols = data.map(c => c.column_name || c.name).filter(Boolean);
      } catch (_) {}
    }
    if (!cols.length) {
      const sample = await fetchTable(table, '*');
      cols = Object.keys(sample?.[0] || {});
    }
    columnCache.set(table, cols);
    return cols;
  }

  async function loadDictionaries() {
    if (dictionariesLoaded) return dictState;
    if (dictionaryLoadPromise) return dictionaryLoadPromise;
    dictionaryLoadPromise = (async () => {
      const registry = await fetchRegistry();
      const unitsRegistry = registry.find(item => /unit|підрозді|частин|бригада|дивізіон|батаре/i.test([item.code, item.table_name, item.title, item.title_ua].join(' ')));
      const unitsTable = unitsRegistry?.table_name || 'dict_units';
      const units = await fetchTable(unitsTable, '*');

      const resolvedConfigs = DICT_CONFIG.map(cfg => {
        const reg = registry.find(item => dictionaryMatchesConfig(item, cfg));
        return { ...cfg, table: reg?.table_name || cfg.table, label: reg?.title || reg?.title_ua || cfg.label, registry: reg || null };
      });

      const catalogs = {};
      const catalogIndex = new Map();
      for (const cfg of resolvedConfigs) {
        const rows = await fetchTable(cfg.table, '*');
        catalogs[cfg.key] = rows;
        rows.forEach(row => {
          const names = collectRowNames(row);
          names.forEach(name => {
            valueVariants(name).forEach(norm => {
              if (!norm || catalogIndex.has(norm)) return;
              catalogIndex.set(norm, { ...cfg, row, name });
            });
          });
        });
      }
      dictState = { units, catalogs, catalogIndex, configs: resolvedConfigs, registry, unitsTable };
      dictionariesLoaded = true;
      page.classList.add('is-dicts-ready');
      return dictState;
    })();
    return dictionaryLoadPromise;
  }

  function findCatalogHit(name) {
    for (const key of valueVariants(name)) {
      const hit = dictState.catalogIndex.get(key);
      if (hit) return hit;
    }
    return null;
  }

  function indexDictionaryRow(cfg, row) {
    collectRowNames(row).forEach(name => {
      valueVariants(name).forEach(norm => {
        if (norm) dictState.catalogIndex.set(norm, { ...cfg, row, name });
      });
    });
  }

  function openPanel(side) {
    document.getElementById(side === 'left' ? 'uploadLeftPanel' : 'uploadRightPanel')?.classList.add('is-open');
  }
  function closePanel(side) {
    document.getElementById(side === 'left' ? 'uploadLeftPanel' : 'uploadRightPanel')?.classList.remove('is-open');
  }

  document.querySelectorAll('[data-upload-panel-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.uploadPanelToggle;
      const panel = document.getElementById(side === 'left' ? 'uploadLeftPanel' : 'uploadRightPanel');
      panel?.classList.toggle('is-open');
    });
  });
  document.querySelectorAll('[data-upload-panel-close]').forEach(btn => btn.addEventListener('click', () => closePanel(btn.dataset.uploadPanelClose)));

  function setPlate(text, percent) {
    progressPlate?.classList.remove('is-format-mode');
    progressPlate?.classList.add('is-progress-mode');
    plateText.textContent = text;
    platePercent.textContent = `${percent}%`;
  }

  function setPlateFormats() {
    progressPlate?.classList.remove('is-progress-mode');
    progressPlate?.classList.add('is-format-mode');
    plateText.textContent = 'Готовий';
    platePercent.textContent = '0%';
  }

  function setDropText(mode) {
    if (!dropTitle || !dropHint) return;
    if (mode === 'drag') {
      dropTitle.textContent = 'Відпустіть файл';
      dropHint.textContent = 'система прийме дані в чергу';
    } else {
      dropTitle.textContent = 'Перетягніть файл';
      dropHint.textContent = 'або натисніть для вибору файлів';
    }
  }

  function syncActionButtons() {
    const hasFiles = files.length > 0;
    if (startButton) {
      startButton.classList.toggle('is-hidden', parsed);
      startButton.disabled = !hasFiles || parsed || !!timer;
    }
    if (resultsButton) {
      resultsButton.classList.toggle('is-hidden', !parsed);
      resultsButton.disabled = !parsed;
    }
    if (clearQueueButton) clearQueueButton.disabled = !hasFiles;
    RIGHT_PANEL?.classList.toggle('has-queue', hasFiles);
    RIGHT_PANEL?.classList.toggle('is-parsed', parsed);
  }

  function renderFiles() {
    fileCount.textContent = String(files.length);
    syncActionButtons();
    if (!files.length) {
      filesList.innerHTML = `<div class="upload-empty-state"><img class="upload-empty-icon" src="../assets/upload/icons/files.svg?v=246" alt="" aria-hidden="true" /><strong>Файли не додано</strong><span>Перетягніть файли у центр або натисніть для вибору</span></div>`;
      return;
    }
    filesList.innerHTML = files.map((item) => {
      const ext = extOf(item.name).toUpperCase();
      return `<article class="upload-file-card" data-upload-file-index="${item.id}">
        <button class="upload-file-card__remove" type="button" data-upload-remove-file="${item.id}" aria-label="Видалити файл ${escapeHtml(item.name)}" title="Видалити файл">×</button>
        <div class="upload-file-card__icon">${ext}</div>
        <div>
          <div class="upload-file-card__name">${escapeHtml(item.name)}</div>
          <div class="upload-file-card__meta">${fmtSize(item.size)} · ${ext}</div>
          <div class="upload-file-card__status">${item.status || 'готовий'}</div>
        </div>
      </article>`;
    }).join('');
  }

  function addFiles(list) {
    const incoming = Array.from(list || []).filter(file => allowed.has(extOf(file.name)));
    if (!incoming.length) return;
    incoming.forEach(file => files.push({ id: ++fileSeq, name: file.name, size: file.size, file, status: 'готовий', review: null }));
    parsed = false;
    page.classList.remove('is-parsing', 'is-complete');
    setPlateFormats();
    renderFiles();
    pulseFileAdded();
    openPanel('right');
  }

  function removeFileById(id) {
    const numericId = Number(id);
    files = files.filter(item => item.id !== numericId);
    if (!files.length) {
      parsed = false;
      setPlateFormats();
    } else if (parsed) {
      parsed = files.every(item => item.status === 'оброблено');
    }
    renderFiles();
  }

  function clearQueue() {
    if (timer) { clearInterval(timer); timer = null; }
    files = [];
    parsed = false;
    page.classList.remove('is-parsing', 'is-complete');
    dropZone.classList.remove('is-file-added');
    fileInput.value = '';
    setPlateFormats();
    renderFiles();
  }

  function pulseFileAdded() {
    dropZone.classList.remove('is-file-added');
    void dropZone.offsetWidth;
    dropZone.classList.add('is-file-added');
    window.setTimeout(() => dropZone.classList.remove('is-file-added'), 900);
  }

  function spawnStageWord(text) {
    if (!text || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.createElement('span');
    el.className = 'upload-stage-word';
    el.textContent = text;
    const rect = dropZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.random() * Math.PI * 2;
    const radius = rect.width * (.36 + Math.random() * .18);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    el.style.setProperty('--core-x', `${cx}px`);
    el.style.setProperty('--core-y', `${cy}px`);
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2050);
  }

  function spawnCoreWord(text) {
    if (!text || !coreWordCloud || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.createElement('span');
    el.className = 'upload-core-word';
    el.textContent = text;
    const x = 18 + Math.random() * 64;
    const y = 18 + Math.random() * 64;
    const dx = (Math.random() * 36 - 18).toFixed(1);
    const dy = (Math.random() * 28 - 24).toFixed(1);
    el.style.setProperty('--cx', `${x}%`);
    el.style.setProperty('--cy', `${y}%`);
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    coreWordCloud.appendChild(el);
    window.setTimeout(() => el.remove(), 3000);
  }

  function spawnStageWordBurst(stage, pct) {
    const bank = {
      'Сканування': ['СКАНУВАННЯ', 'SCAN', 'INPUT'],
      'Перевірка': ['ПЕРЕВІРКА', 'FORMAT', 'VALIDATE'],
      'Парсинг': ['ПАРСИНГ', 'READ', 'DATA'],
      'Зіставлення': ['ДОВІДНИКИ', 'MATCH', 'DICT'],
      'Готовий': ['ГОТОВО', 'SYNC', '100%']
    };
    const fallback = ['КІЛЬКІСТЬ', 'UNIT', 'UNKNOWN', 'NORMALIZE'];
    const words = bank[stage] || fallback;
    const primaryWord = words[Math.floor(Math.random() * words.length)];
    spawnStageWord(primaryWord);
    spawnCoreWord(primaryWord);
    if (pct % 3 === 0) {
      window.setTimeout(() => {
        const secondaryWord = fallback[Math.floor(Math.random() * fallback.length)];
        spawnStageWord(secondaryWord);
        spawnCoreWord(secondaryWord);
      }, 120);
    }
  }

  async function parseFileRows(item) {
    const ext = extOf(item.name);
    if (ext === 'json') {
      const text = await item.file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.rows)) return data.rows;
      if (Array.isArray(data.items)) return data.items;
      return Object.values(data).flat().filter(v => typeof v === 'object' || typeof v === 'string');
    }
    if (ext === 'csv') {
      const text = await item.file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const header = lines[0]?.split(/[;,]/).map(h => h.trim().toLowerCase()) || [];
      const hasHeader = header.some(h => NAME_FIELDS.includes(h) || QTY_FIELDS.includes(h));
      return lines.slice(hasHeader ? 1 : 0).map(line => {
        const parts = line.split(/[;,]/).map(p => p.trim());
        if (hasHeader) {
          const obj = {};
          header.forEach((h, i) => obj[h] = parts[i]);
          return obj;
        }
        return { name: parts[0] || '', count: parts[1] || 0 };
      });
    }
    if (ext === 'xlsx') {
      if (!window.XLSX) throw new Error('XLSX parser не завантажився. Перевірте підключення бібліотеки SheetJS.');
      const buffer = await item.file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      return rows.map(row => {
        const normalized = {};
        Object.entries(row).forEach(([key, value]) => normalized[String(key).trim().toLowerCase()] = value);
        return Object.keys(normalized).length ? normalized : row;
      });
    }
    return [];
  }

  async function buildReviewForFile(item) {
    const dict = await loadDictionaries();
    let rawRows = [];
    let parseError = '';
    try {
      rawRows = await parseFileRows(item);
    } catch (error) {
      parseError = error?.message || 'Помилка читання файлу';
    }
    const known = [];
    const unknown = [];
    const quantityErrors = [];
    rawRows.forEach((row, index) => {
      const name = rowName(row) || `Рядок ${index + 1}`;
      const count = rowQty(row);
      const hit = findCatalogHit(name);
      const record = { index: index + 1, raw: row, name, count: Number.isFinite(count) ? count : 0, match: hit || null };
      if (!Number.isInteger(count)) quantityErrors.push(record);
      if (hit && Number.isInteger(count)) known.push(record);
      else unknown.push(record);
    });
    const detectedUnit = detectUnitForFile(item, rawRows);
    return {
      rows: rawRows,
      known,
      unknown,
      quantityErrors,
      parseError,
      unitId: detectedUnit?.value || '',
      unitName: detectedUnit?.name || '',
      unitAutoDetected: !!detectedUnit
    };
  }

  async function ensureReviewData() {
    await loadDictionaries();
    for (const item of files) {
      if (!item.review) item.review = await buildReviewForFile(item);
    }
  }

  async function startParsing() {
    if (!files.length || timer) return;
    parsed = false;
    page.classList.remove('is-complete');
    page.classList.add('is-parsing');
    syncActionButtons();
    let start = performance.now();
    let lastWordPct = -20;
    files.forEach(f => f.status = 'парсинг');
    renderFiles();
    const stages = [[0, 'Сканування'], [25, 'Перевірка'], [55, 'Парсинг'], [80, 'Зіставлення'], [96, 'Готовий']];
    const parsePromise = ensureReviewData();
    timer = setInterval(async () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / MIN_PARSE_TIME) * 100));
      const stage = stages.reduce((acc, cur) => pct >= cur[0] ? cur[1] : acc, 'Сканування');
      setPlate(stage, pct);
      if (pct - lastWordPct >= 9 && pct < 98) {
        lastWordPct = pct;
        spawnStageWordBurst(stage, pct);
      }
      if (pct >= 100) {
        clearInterval(timer);
        timer = null;
        await parsePromise;
        page.classList.remove('is-parsing');
        page.classList.add('is-complete');
        window.setTimeout(() => page.classList.remove('is-complete'), 1800);
        files.forEach(f => f.status = 'оброблено');
        parsed = true;
        setPlate('Готовий', 100);
        renderFiles();
      }
    }, 90);
  }

  function unitOptions(selected = '') {
    const rows = dictState.units || [];
    const fallback = rows.length ? '' : '<option value="45 ОАБр">45 ОАБр</option><option value="1 дивізіон">1 дивізіон</option><option value="2 батарея">2 батарея</option>';
    return `<option value="">Обрати підрозділ із довідника</option>${fallback}${rows.map(row => {
      const name = unitRowDisplay(row);
      const value = unitRowValue(row);
      return `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('')}`;
  }


  function unitRowValue(row) {
    const name = rowName(row) || row?.name || row?.title || row?.title_ua || row?.code || row?.id || '';
    return row?.id || name;
  }

  function unitRowDisplay(row) {
    return rowName(row) || row?.name || row?.title || row?.title_ua || row?.code || row?.id || '';
  }

  function collectUnitNames(row) {
    const values = collectRowNames(row);
    if (row && typeof row === 'object') {
      ['name', 'title', 'title_ua', 'code', 'short_name', 'full_name', 'display_name', 'unit_name', 'unit', 'підрозділ', 'пiдроздiл'].forEach(field => {
        if (row[field] != null) values.push(row[field]);
      });
    }
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
  }

  function normalizeForUnitSearch(value) {
    return normalizeToken(value).replace(/[_\-]+/g, '');
  }

  function findUnitHit(candidates = []) {
    const units = dictState.units || [];
    if (!units.length) return null;
    const haystack = candidates
      .flatMap(value => [normalizeValue(value), normalizeToken(value), normalizeForUnitSearch(value)])
      .join('\n');
    for (const row of units) {
      const names = collectUnitNames(row);
      for (const name of names) {
        const variants = [...valueVariants(name), normalizeForUnitSearch(name)]
          .map(v => String(v || '').trim())
          .filter(v => v.length >= 2);
        if (variants.some(v => haystack.includes(v))) {
          return { row, value: unitRowValue(row), name: unitRowDisplay(row) };
        }
      }
    }
    return null;
  }

  function detectUnitForFile(item, rows = []) {
    const rowPreview = rows.slice(0, 80).map(row => {
      if (row == null) return '';
      if (typeof row === 'string' || typeof row === 'number') return String(row);
      try { return JSON.stringify(row); } catch (_) { return Object.values(row).join(' '); }
    });
    return findUnitHit([item?.name || '', ...rowPreview]);
  }


  const REVIEW_ICONS = {
    file: '../assets/icons/upload-review/brand-bing.svg',
    review: '../assets/icons/upload-review/analyze.svg',
    parse: '../assets/icons/upload-review/spacing-horizontal.svg',
    rows: '../assets/icons/upload-review/table-column.svg',
    known: '../assets/icons/upload-review/file-check.svg',
    unknown: '../assets/icons/upload-review/file-unknown.svg',
    errors: '../assets/icons/upload-review/file-alert.svg',
    unit: '../assets/icons/upload-review/brand-unity.svg',
    resolve: '../assets/icons/upload-review/replace.svg',
    ignore: '../assets/icons/upload-review/file-scissors.svg',
    import: '../assets/icons/upload-review/package-import.svg',
    reset: '../assets/icons/upload-review/rotate-2.svg',
    close: '../assets/icons/upload-review/x.svg'
  };

  function reviewIcon(name, label = '') {
    const src = REVIEW_ICONS[name];
    if (!src) return '';
    const alt = label ? ` alt="${escapeHtml(label)}"` : ' alt="" aria-hidden="true"';
    return `<img class="upload-review-icon upload-review-icon--${name}" src="${src}"${alt}>`;
  }

  function knownRowsHtml(rows) {
    if (!rows.length) return `<div class="upload-result-empty">Відомі значення поки не визначені.</div>`;
    return `<table class="upload-result-table"><thead><tr><th>Назва</th><th>Категорія</th><th>Кількість</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.match?.label || '—')}</td><td>${escapeHtml(r.count)}</td></tr>`).join('')}</tbody></table>`;
  }

  function unknownRowsHtml(rows) {
    if (!rows.length) return `<div class="upload-result-empty is-ok">Невідомих значень немає.</div>`;
    return rows.map(r => `<article class="upload-unknown-row" data-unknown-index="${r.index}">
      <div><strong>${escapeHtml(r.name)}</strong><span>Рядок ${r.index} · к-сть: ${escapeHtml(r.count)}</span></div>
      <div class="upload-unknown-actions"><button type="button" data-upload-ignore-unknown="${r.index}">${reviewIcon('ignore')}<span>Ігнорувати</span></button><button type="button" data-upload-edit-unknown="${r.index}">${reviewIcon('resolve')}<span>Розпарсити</span></button></div>
    </article>`).join('');
  }

  function dictionaryOptions(selected = '') {
    const configs = dictState.configs?.length ? dictState.configs : DICT_CONFIG;
    return `<option value="">Оберіть категорію</option>${configs.map(cfg => `<option value="${escapeHtml(cfg.key)}" ${selected === cfg.key ? 'selected' : ''}>${escapeHtml(cfg.label)}</option>`).join('')}`;
  }

  function resolveEditorHtml(record) {
    return `<div class="upload-resolve-editor" data-resolve-index="${record.index}">
      <label><span>Категорія</span><select data-resolve-dict>${dictionaryOptions('')}</select></label>
      <label><span>Назва</span><input data-resolve-name value="${escapeHtml(record.name)}"></label>
      <label><span>Кількість</span><input data-resolve-qty type="number" step="1" value="${escapeHtml(record.count)}"></label>
      <label class="upload-resolve-check"><input data-resolve-active type="checkbox" checked><span>Активний запис</span></label>
      <button type="button" data-upload-save-resolve="${record.index}">${reviewIcon('import')}<span>Додати в довідник</span></button>
      <button type="button" data-upload-cancel-resolve="${record.index}">${reviewIcon('close')}<span>Скасувати</span></button>
    </div>`;
  }

  async function insertUnknownValue(file, record, status = 'ignored') {
    const client = sb();
    if (!client) return;
    try {
      await client.from(UNKNOWN_TABLE).insert({
        raw_value: record.name,
        value: record.name,
        source_file: file.name,
        row_index: record.index,
        quantity: Number.isInteger(record.count) ? record.count : null,
        status,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[BASTION upload] unknown value was not saved:', error?.message || error);
    }
  }

  async function resolveUnknownRecord(file, idx, form) {
    const cfg = (dictState.configs || DICT_CONFIG).find(c => c.key === form.dictKey);
    if (!cfg) throw new Error('Оберіть категорію довідника');
    const client = sb();
    if (!client) throw new Error('Supabase не підключено');
    const cols = await fetchColumns(cfg.table);
    const payload = {};
    if (cols.includes('name')) payload.name = form.name;
    else if (cols.includes('title')) payload.title = form.name;
    else if (cols.includes('value')) payload.value = form.name;
    else payload.name = form.name;
    if (cols.includes('is_active')) payload.is_active = !!form.active;
    if (cols.includes('active')) payload.active = !!form.active;
    if (cols.includes('quantity')) payload.quantity = Number(form.qty) || 0;
    if (cols.includes('count')) payload.count = Number(form.qty) || 0;
    if (cols.includes('created_at')) payload.created_at = new Date().toISOString();
    const { data, error } = await client.from(cfg.table).insert(payload).select('*').single();
    if (error) throw error;
    const saved = data || payload;
    indexDictionaryRow(cfg, saved);
    const record = file.review.unknown.find(r => r.index === idx);
    if (record) {
      record.name = form.name;
      record.count = Number(form.qty) || record.count;
      record.match = { ...cfg, row: saved, name: form.name };
      file.review.known.push(record);
      file.review.unknown = file.review.unknown.filter(r => r.index !== idx);
    }
  }

  function reviewTotals() {
    return files.reduce((acc, f) => {
      const review = f.review || { rows: [], known: [], unknown: [], quantityErrors: [] };
      acc.rows += review.rows?.length || 0;
      acc.known += review.known?.length || 0;
      acc.unknown += review.unknown?.length || 0;
      acc.errors += review.quantityErrors?.length || 0;
      return acc;
    }, { rows: 0, known: 0, unknown: 0, errors: 0 });
  }

  function unitDisplayName(value) {
    if (!value) return '';
    const found = (dictState.units || []).find(row => String(unitRowValue(row)) === String(value));
    return found ? (unitRowDisplay(found) || value) : value;
  }

  function reviewUnitsHtml() {
    const selectors = files.map((f) => {
      const review = f.review || {};
      const selectedName = review.unitId ? unitDisplayName(review.unitId) : '';
      const auto = review.unitAutoDetected && selectedName
        ? `<small class="upload-unit-auto">знайдено автоматично: ${escapeHtml(selectedName)}</small>`
        : `<small class="upload-unit-auto is-missing">підрозділ не визначено автоматично</small>`;
      return `<label class="upload-unit-map-row ${review.unitId ? 'is-detected' : 'is-missing'}"><span>${reviewIcon('file')}<b>${escapeHtml(f.name)}</b>${auto}</span><select data-upload-unit-select="${f.id}">${unitOptions(review.unitId)}</select></label>`;
    }).join('');

    return `<section class="upload-review-units">
      <div class="upload-review-units-title">${reviewIcon('unit')}<span>Підрозділи</span></div>
      <div class="upload-unit-missing">${selectors}</div>
    </section>`;
  }

  function flatRows(kind = 'all') {
    const rows = [];
    files.forEach((file, fileIndex) => {
      const review = file.review || { rows: [], known: [], unknown: [], quantityErrors: [] };
      const add = (record, type) => rows.push({ ...record, type, fileName: file.name, fileIndex: fileIndex + 1 });
      if (kind === 'all') {
        review.known.forEach(r => add(r, 'known'));
        review.unknown.forEach(r => add(r, 'unknown'));
        review.quantityErrors.forEach(r => {
          if (!review.unknown.some(u => u.index === r.index) && !review.known.some(k => k.index === r.index)) add(r, 'error');
        });
      } else if (kind === 'known') review.known.forEach(r => add(r, 'known'));
      else if (kind === 'unknown') review.unknown.forEach(r => add(r, 'unknown'));
      else if (kind === 'errors') review.quantityErrors.forEach(r => add(r, 'error'));
    });
    return rows;
  }

  function aggregatedRowsTable(rows, title, emptyText) {
    if (!rows.length) return `<section class="upload-review-list"><h4>${escapeHtml(title)}</h4><div class="upload-result-empty is-ok">${escapeHtml(emptyText)}</div></section>`;
    return `<section class="upload-review-list"><h4>${escapeHtml(title)} <b>${rows.length}</b></h4>
      <table class="upload-result-table upload-result-table--aggregate"><thead><tr><th>Файл</th><th>Назва</th><th>Категорія</th><th>Кількість</th><th>Статус</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${escapeHtml(r.fileName)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.match?.label || (r.type === 'unknown' ? 'Невідомо' : '—'))}</td><td>${escapeHtml(r.count)}</td><td><span class="upload-row-status upload-row-status--${r.type}">${r.type === 'known' ? 'Відомо' : r.type === 'error' ? 'Помилка' : 'Невідомо'}</span></td></tr>`).join('')}
      </tbody></table></section>`;
  }

  function parseModeHtml() {
    return files.map((f) => {
      const review = f.review || { unknown: [] };
      if (!review.unknown.length) return '';
      return `<article class="upload-result-file upload-result-file--parse" data-result-file-id="${f.id}">
        <div class="upload-result-file-title"><small>${reviewIcon('file')}<span>${escapeHtml(f.name)}</span></small></div>
        <section class="upload-unknown-block"><h4>Невідомі значення <b>${review.unknown.length}</b></h4>${unknownRowsHtml(review.unknown)}</section>
      </article>`;
    }).join('') || `<div class="upload-result-empty is-ok">Невідомих значень немає. Можна підтверджувати імпорт.</div>`;
  }

  function renderResultsBody(mode = 'review', filter = '') {
    const totals = reviewTotals();
    const activeFilter = mode === 'parse' ? 'unknown' : (filter || '');
    const kpi = [
      ['all', 'rows', 'Загальна кількість', totals.rows],
      ['known', 'known', 'Відомі', totals.known],
      ['unknown', 'unknown', 'Невідомі', totals.unknown],
      ['errors', 'errors', 'Помилки', totals.errors]
    ];
    const listTitle = activeFilter === 'all' ? 'Всі дані імпорту' : activeFilter === 'known' ? 'Відомі дані' : activeFilter === 'unknown' ? 'Невідомі дані' : activeFilter === 'errors' ? 'Помилки кількості' : '';
    const rows = activeFilter ? flatRows(activeFilter) : [];
    const detailsHtml = activeFilter ? aggregatedRowsTable(rows, listTitle, 'Даних у цій категорії немає.') : '';

    resultsBody.innerHTML = `
      <div class="upload-review-control-head">
        <div class="upload-review-toolbar">
          <button type="button" class="${mode === 'review' && !activeFilter ? 'is-active' : ''}" data-review-mode="review" data-review-filter="">${reviewIcon('review')}<span>Огляд</span></button>
          <button type="button" class="${mode === 'parse' ? 'is-active' : ''}" data-review-mode="parse">${reviewIcon('parse')}<span>Режим парсингу</span><b>${totals.unknown}</b></button>
        </div>
        <div class="upload-review-kpi-grid">
          ${kpi.map(([key, icon, label, value]) => `<button type="button" class="upload-review-kpi ${activeFilter === key && mode !== 'parse' ? 'is-active' : ''}" data-review-filter="${key}">${reviewIcon(icon)}<em>${label}</em><b>${value}</b></button>`).join('')}
        </div>
        ${reviewUnitsHtml()}
      </div>
      ${mode === 'parse' ? parseModeHtml() : detailsHtml}`;
  }

  async function openResults() {
    if (!parsed) return;
    document.body.classList.add('upload-results-active');
    resultsModal.classList.add('is-open');
    resultsModal.setAttribute('aria-hidden', 'false');
    resultsBody.innerHTML = '<div class="upload-results-loading">Підключаю довідники та звіряю значення…</div>';
    await ensureReviewData();
    renderResultsBody('review');
  }

  function closeResults() {
    resultsModal.classList.remove('is-open');
    resultsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('upload-results-active');
  }

  function resetAll() {
    if (timer) { clearInterval(timer); timer = null; }
    files = [];
    parsed = false;
    page.classList.remove('is-parsing', 'is-complete');
    dropZone.classList.remove('is-file-added');
    fileInput.value = '';
    setPlateFormats();
    closeResults();
    renderFiles();
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, e => { e.preventDefault(); dropZone.classList.add('is-dragging'); setDropText('drag'); }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, e => { e.preventDefault(); dropZone.classList.remove('is-dragging'); setDropText('idle'); }));
  dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));


  function guardResultsModalClick(event) {
    if (!document.body.classList.contains('upload-results-active')) return;
    const inResultsModal = resultsModal && resultsModal.contains(event.target);
    if (inResultsModal) return;
    const blockedProfileTarget = event.target.closest?.('#userMenuButton, .b116-panel--right, .b116-top-panels, [data-open-profile], [data-profile-open], .profile-entry, .profile-trigger');
    if (blockedProfileTarget) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }

  document.addEventListener('pointerdown', guardResultsModalClick, true);
  document.addEventListener('click', guardResultsModalClick, true);

  function uniqueImportUnits() {
    const map = new Map();
    files.forEach(file => {
      const review = file.review || {};
      const unitName = review.unitName || unitDisplayName(review.unitId) || '';
      const unitId = review.unitId || unitName;
      const key = normalizeToken(unitName || unitId);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          id: String(unitId),
          name: String(unitName || unitId),
          enabled: true,
          sourceFiles: []
        });
      }
      map.get(key).sourceFiles.push(file.name);
    });
    return [...map.values()];
  }

  function collectImportItems(file) {
    const review = file.review || {};
    const source = [];
    if (Array.isArray(review.known)) source.push(...review.known);
    if (Array.isArray(review.unknown)) source.push(...review.unknown);
    if (!source.length && Array.isArray(review.rows)) {
      review.rows.forEach((row, index) => {
        const name = rowName(row) || `Рядок ${index + 1}`;
        const count = rowQty(row);
        source.push({ index: index + 1, raw: row, name, count: Number.isFinite(count) ? count : 0, match: null });
      });
    }
    return source
      .map((record) => ({
        index: record.index || 0,
        name: record.name || rowName(record.raw) || '',
        quantity: Number.isInteger(Number(record.count)) ? Number(record.count) : null,
        category: record.match?.label || record.match?.config?.label || record.match?.dictLabel || '',
        dictKey: record.match?.config?.key || record.match?.dictKey || '',
        known: !!record.match && Number.isInteger(Number(record.count))
      }))
      .filter(item => item.quantity !== null);
  }

  function saveImportContext() {
    const payload = {
      version: 2,
      createdAt: new Date().toISOString(),
      units: uniqueImportUnits(),
      files: files.map(file => ({
        id: file.id,
        name: file.name,
        unitId: file.review?.unitId || '',
        unitName: file.review?.unitName || unitDisplayName(file.review?.unitId) || '',
        rows: file.review?.rows?.length || 0,
        known: file.review?.known?.length || 0,
        unknown: file.review?.unknown?.length || 0,
        errors: file.review?.quantityErrors?.length || 0,
        items: collectImportItems(file)
      })),
      totals: reviewTotals()
    };
    const raw = JSON.stringify(payload);
    IMPORT_STORAGE_KEYS.forEach(key => {
      try { window.localStorage?.setItem(key, raw); } catch (_) {}
      try { window.sessionStorage?.setItem(key, raw); } catch (_) {}
    });
    return payload;
  }

  startButton.addEventListener('click', startParsing);
  clearQueueButton?.addEventListener('click', clearQueue);
  filesList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-upload-remove-file]');
    if (!removeButton) return;
    event.preventDefault();
    event.stopPropagation();
    removeFileById(removeButton.dataset.uploadRemoveFile);
  });
  resultsButton.addEventListener('click', openResults);
  confirmButton?.addEventListener('click', async () => {
    await ensureReviewData();
    saveImportContext();
    for (const file of files) {
      const unknown = file.review?.unknown || [];
      for (const record of unknown) await insertUnknownValue(file, record, 'unresolved');
    }
    const confirmLabel = confirmButton.querySelector('span');
    if (confirmLabel) confirmLabel.textContent = 'Імпорт підтверджено';
    setTimeout(() => {
      window.location.assign('./calculator.html');
    }, 650);
  });
  resetButton.addEventListener('click', resetAll);
  document.querySelectorAll('[data-upload-results-close]').forEach(el => el.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closeResults(); }));
  resultsBody.addEventListener('click', async (event) => {
    const modeBtn = event.target.closest('[data-review-mode]');
    if (modeBtn) {
      renderResultsBody(modeBtn.dataset.reviewMode, modeBtn.dataset.reviewFilter || '');
      return;
    }
    const filterBtn = event.target.closest('[data-review-filter]');
    if (filterBtn && !filterBtn.closest('[data-review-mode]')) {
      renderResultsBody('review', filterBtn.dataset.reviewFilter || '');
      return;
    }
    const ignoreBtn = event.target.closest('[data-upload-ignore-unknown]');
    if (ignoreBtn) {
      const fileCard = ignoreBtn.closest('[data-result-file-id]');
      const file = files.find(f => String(f.id) === String(fileCard?.dataset.resultFileId));
      if (file?.review) {
        const idx = Number(ignoreBtn.dataset.uploadIgnoreUnknown);
        const record = file.review.unknown.find(r => r.index === idx);
        if (record) insertUnknownValue(file, record, 'ignored');
        file.review.unknown = file.review.unknown.filter(r => r.index !== idx);
        renderResultsBody('parse');
      }
    }
    const editBtn = event.target.closest('[data-upload-edit-unknown]');
    if (editBtn) {
      const fileCard = editBtn.closest('[data-result-file-id]');
      const rowEl = editBtn.closest('.upload-unknown-row');
      const file = files.find(f => String(f.id) === String(fileCard?.dataset.resultFileId));
      const idx = Number(editBtn.dataset.uploadEditUnknown);
      const record = file?.review?.unknown?.find(r => r.index === idx);
      if (record && rowEl) {
        rowEl.classList.add('is-resolving');
        rowEl.insertAdjacentHTML('beforeend', resolveEditorHtml(record));
        editBtn.disabled = true;
      }
    }
    const cancelBtn = event.target.closest('[data-upload-cancel-resolve]');
    if (cancelBtn) {
      const rowEl = cancelBtn.closest('.upload-unknown-row');
      rowEl?.querySelector('.upload-resolve-editor')?.remove();
      rowEl?.classList.remove('is-resolving');
      rowEl?.querySelector('[data-upload-edit-unknown]')?.removeAttribute('disabled');
    }
    const saveBtn = event.target.closest('[data-upload-save-resolve]');
    if (saveBtn) {
      const fileCard = saveBtn.closest('[data-result-file-id]');
      const editor = saveBtn.closest('.upload-resolve-editor');
      const file = files.find(f => String(f.id) === String(fileCard?.dataset.resultFileId));
      const idx = Number(saveBtn.dataset.uploadSaveResolve);
      const form = {
        dictKey: editor?.querySelector('[data-resolve-dict]')?.value || '',
        name: editor?.querySelector('[data-resolve-name]')?.value?.trim() || '',
        qty: editor?.querySelector('[data-resolve-qty]')?.value || 0,
        active: !!editor?.querySelector('[data-resolve-active]')?.checked
      };
      if (!form.name) return;
      saveBtn.disabled = true;
      saveBtn.querySelector('span').textContent = 'Додаю…';
      try {
        await resolveUnknownRecord(file, idx, form);
        renderResultsBody('parse');
      } catch (error) {
        saveBtn.disabled = false;
        saveBtn.querySelector('span').textContent = error?.message || 'Помилка';
        console.warn('[BASTION upload] resolve failed:', error?.message || error);
      }
    }
  });
  resultsBody.addEventListener('change', (event) => {
    const select = event.target.closest('[data-upload-unit-select]');
    if (!select) return;
    const file = files.find(f => String(f.id) === String(select.dataset.uploadUnitSelect));
    if (file?.review) {
      file.review.unitId = select.value;
      file.review.unitName = select.options[select.selectedIndex]?.textContent || '';
      file.review.unitAutoDetected = false;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resultsModal.classList.contains('is-open')) closeResults();
  });

  setPlateFormats();
  renderFiles();
  loadDictionaries();
})();
