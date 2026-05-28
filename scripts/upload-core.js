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
  const allowed = new Set(['xlsx', 'csv', 'json']);
  const MIN_PARSE_TIME = 10000;
  const RIGHT_PANEL = document.getElementById('uploadRightPanel');

  const DICT_CONFIG = [
    { key: 'projectiles', table: 'dict_projectiles', label: 'Снаряди' },
    { key: 'charges', table: 'dict_charges', label: 'Заряди' },
    { key: 'fuzes', table: 'dict_fuzes', label: 'Підривники' },
    { key: 'primers', table: 'dict_primers', label: 'Праймери' }
  ];
  const NAME_FIELDS = ['name', 'title', 'title_ua', 'marking', 'code', 'value', 'raw_value'];
  const QTY_FIELDS = ['count', 'quantity', 'qty', 'amount', 'залишок', 'кількість'];

  let files = [];
  let parsed = false;
  let timer = null;
  let fileSeq = 0;
  let dictionariesLoaded = false;
  let dictionaryLoadPromise = null;
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
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('uk-UA');
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

  async function loadDictionaries() {
    if (dictionariesLoaded) return dictState;
    if (dictionaryLoadPromise) return dictionaryLoadPromise;
    dictionaryLoadPromise = (async () => {
      const units = await fetchTable('dict_units', '*');
      const catalogs = {};
      const catalogIndex = new Map();
      for (const cfg of DICT_CONFIG) {
        const rows = await fetchTable(cfg.table, '*');
        catalogs[cfg.key] = rows;
        rows.forEach(row => {
          const name = rowName(row);
          const norm = normalizeValue(name);
          if (!norm || catalogIndex.has(norm)) return;
          catalogIndex.set(norm, { ...cfg, row, name });
        });
      }
      dictState = { units, catalogs, catalogIndex };
      dictionariesLoaded = true;
      return dictState;
    })();
    return dictionaryLoadPromise;
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
      const hit = dict.catalogIndex.get(normalizeValue(name));
      const record = { index: index + 1, raw: row, name, count: Number.isFinite(count) ? count : 0, match: hit || null };
      if (!Number.isInteger(count)) quantityErrors.push(record);
      if (hit && Number.isInteger(count)) known.push(record);
      else unknown.push(record);
    });
    return { rows: rawRows, known, unknown, quantityErrors, parseError, unitId: '', unitName: '' };
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
      const name = rowName(row) || row.name || row.title || row.code || row.id;
      const value = row.id || name;
      return `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    }).join('')}`;
  }

  function knownRowsHtml(rows) {
    if (!rows.length) return `<div class="upload-result-empty">Відомі значення поки не визначені.</div>`;
    return `<table class="upload-result-table"><thead><tr><th>Назва</th><th>Категорія</th><th>Кількість</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.match?.label || '—')}</td><td>${escapeHtml(r.count)}</td></tr>`).join('')}</tbody></table>`;
  }

  function unknownRowsHtml(rows) {
    if (!rows.length) return `<div class="upload-result-empty is-ok">Невідомих значень немає.</div>`;
    return rows.map(r => `<article class="upload-unknown-row" data-unknown-index="${r.index}">
      <div><strong>${escapeHtml(r.name)}</strong><span>Рядок ${r.index} · к-сть: ${escapeHtml(r.count)}</span></div>
      <div class="upload-unknown-actions"><button type="button" data-upload-ignore-unknown="${r.index}">Ігнорувати</button><button type="button" data-upload-edit-unknown="${r.index}">Розпарсити</button></div>
    </article>`).join('');
  }

  function renderResultsBody(mode = 'review') {
    const totalUnknown = files.reduce((sum, f) => sum + (f.review?.unknown?.length || 0), 0);
    resultsBody.innerHTML = `
      <div class="upload-review-toolbar">
        <button type="button" class="${mode === 'review' ? 'is-active' : ''}" data-review-mode="review">Огляд</button>
        <button type="button" class="${mode === 'parse' ? 'is-active' : ''}" data-review-mode="parse">Режим парсингу <b>${totalUnknown}</b></button>
      </div>
      ${files.map((f, index) => {
        const review = f.review || { rows: [], known: [], unknown: [], quantityErrors: [] };
        return `<article class="upload-result-file" data-result-file-id="${f.id}">
          <div class="upload-result-file-head">
            <div><small>Файл ${String(index + 1).padStart(2, '0')}</small><h3>${escapeHtml(f.name)}</h3></div>
            <label class="upload-unit-select"><span>Підрозділ</span><select data-upload-unit-select="${f.id}">${unitOptions(review.unitId)}</select></label>
          </div>
          <div class="upload-result-stats">
            <span>Рядків <b>${review.rows.length}</b></span>
            <span>Відомих <b>${review.known.length}</b></span>
            <span>Невідомих <b>${review.unknown.length}</b></span>
            <span>Помилок кількості <b>${review.quantityErrors.length}</b></span>
          </div>
          ${review.parseError ? `<div class="upload-result-warning">${escapeHtml(review.parseError)}</div>` : ''}
          ${mode === 'review' ? `<section class="upload-known-block"><h4>Дані, що йдуть у розрахунок</h4>${knownRowsHtml(review.known)}</section>` : ''}
          <section class="upload-unknown-block"><h4>Невідомі значення <b>${review.unknown.length}</b></h4>${unknownRowsHtml(review.unknown)}</section>
        </article>`;
      }).join('')}`;
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
  resetButton.addEventListener('click', resetAll);
  document.querySelectorAll('[data-upload-results-close]').forEach(el => el.addEventListener('click', closeResults));
  resultsBody.addEventListener('click', (event) => {
    const modeBtn = event.target.closest('[data-review-mode]');
    if (modeBtn) renderResultsBody(modeBtn.dataset.reviewMode);
    const ignoreBtn = event.target.closest('[data-upload-ignore-unknown]');
    if (ignoreBtn) {
      const fileCard = ignoreBtn.closest('[data-result-file-id]');
      const file = files.find(f => String(f.id) === String(fileCard?.dataset.resultFileId));
      if (file?.review) {
        const idx = Number(ignoreBtn.dataset.uploadIgnoreUnknown);
        file.review.unknown = file.review.unknown.filter(r => r.index !== idx);
        renderResultsBody('parse');
      }
    }
    const editBtn = event.target.closest('[data-upload-edit-unknown]');
    if (editBtn) {
      editBtn.textContent = 'Редактор довідника — наступний етап';
      editBtn.disabled = true;
    }
  });
  resultsBody.addEventListener('change', (event) => {
    const select = event.target.closest('[data-upload-unit-select]');
    if (!select) return;
    const file = files.find(f => String(f.id) === String(select.dataset.uploadUnitSelect));
    if (file?.review) {
      file.review.unitId = select.value;
      file.review.unitName = select.options[select.selectedIndex]?.textContent || '';
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resultsModal.classList.contains('is-open')) closeResults();
  });

  setPlateFormats();
  renderFiles();
  loadDictionaries();
})();
