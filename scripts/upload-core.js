
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
  const calculateButton = document.getElementById('uploadCalculateButton');
  const resolveModeButton = document.getElementById('uploadResolveModeButton');
  const allowed = new Set(['xlsx', 'csv', 'json']);
  const MIN_PARSE_TIME = 10000;
  const RIGHT_PANEL = document.getElementById('uploadRightPanel');
  let files = [];
  let parsed = false;
  let timer = null;
  let fileSeq = 0;
  let resultsMode = 'review';
  const demoUnits = ['45 ОАБр', '1 дивізіон', '2 батарея', 'Взвод забезпечення', 'Резерв БК'];
  const dictCategories = ['Заряди', 'Снаряди', 'Підривники', 'Праймери'];

  const fmtSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

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
    incoming.forEach(file => files.push({ id: ++fileSeq, name: file.name, size: file.size, file, status: 'готовий', analysis: null }));
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

  function startParsing() {
    if (!files.length || timer) return;
    parsed = false;
    page.classList.remove('is-complete');
    page.classList.add('is-parsing');
    syncActionButtons();
    let start = performance.now();
    let lastWordPct = -20;
    files.forEach(f => f.status = 'парсинг');
    renderFiles();
    const stages = [
      [0, 'Сканування'],
      [25, 'Перевірка'],
      [55, 'Парсинг'],
      [80, 'Зіставлення'],
      [96, 'Готовий']
    ];
    timer = setInterval(() => {
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
        page.classList.remove('is-parsing');
        page.classList.add('is-complete');
        window.setTimeout(() => page.classList.remove('is-complete'), 1800);
        files.forEach(f => {
          f.status = 'оброблено';
          prepareFileAnalysis(f).then(() => {
            if (resultsModal?.classList.contains('is-open')) renderResults();
          });
        });
        parsed = true;
        setPlate('Готовий', 100);
        renderFiles();
      }
    }, 90);
  }

  function normalizeRows(rows, fileName = '') {
    const known = [];
    const unknown = [];
    const nameKeys = ['name', 'title', 'element', 'item', 'marking', 'назва', 'найменування', 'маркування', 'боєприпас'];
    const qtyKeys = ['qty', 'quantity', 'count', 'amount', 'кількість', 'залишок', 'залишки'];

    const getValue = (row, keys) => {
      if (!row || typeof row !== 'object') return '';
      const entries = Object.entries(row);
      for (const key of keys) {
        const found = entries.find(([k]) => String(k).trim().toLowerCase() === key);
        if (found) return found[1];
      }
      return entries[0]?.[1] ?? '';
    };

    const getQty = (row) => {
      const raw = getValue(row, qtyKeys);
      const value = Number(String(raw).replace(',', '.').trim());
      return Number.isInteger(value) ? value : null;
    };

    const classify = (value) => {
      const v = String(value).toLowerCase();
      if (v.includes('зар') || v.includes('charge')) return 'Заряди';
      if (v.includes('снар') || v.includes('shell')) return 'Снаряди';
      if (v.includes('підр') || v.includes('fuze') || v.includes('fuse')) return 'Підривники';
      if (v.includes('прай') || v.includes('primer')) return 'Праймери';
      return 'Елемент';
    };

    rows.forEach((row, idx) => {
      const rawName = getValue(row, nameKeys);
      const name = String(rawName || '').trim();
      const qty = getQty(row);
      const validMark = /^[\p{L}\d_\- .\/]+$/u.test(name) && name.length > 0;
      const badHint = /unknown|невідом|\?|xxx/i.test(name);
      const payload = {
        id: `r-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
        name: name || `Рядок ${idx + 1}`,
        qty: qty ?? '—',
        category: classify(name),
        status: 'known',
        source: fileName
      };
      if (!validMark || badHint || qty === null) {
        payload.status = 'unknown';
        payload.reason = qty === null ? 'помилка кількості' : 'немає збігу в довідниках';
        unknown.push(payload);
      } else {
        known.push(payload);
      }
    });
    return { known, unknown };
  }

  function extractRowsFromJson(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const arrayValue = Object.values(data).find(Array.isArray);
      if (arrayValue) return arrayValue;
      return [data];
    }
    return [];
  }

  function parseCsvText(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    return lines.slice(1).map(line => {
      const cells = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h || `col_${i + 1}`, cells[i] ?? '']));
    });
  }

  function fallbackAnalysis(item) {
    const base = item.name.replace(/\.[^.]+$/, '');
    const safe = /^[\p{L}\d_\- .]+$/u.test(base);
    return {
      fileName: item.name,
      unit: '',
      known: safe ? [{ id:`k-${item.id}-1`, name: base, qty: 0, category: 'Елемент', status: 'known', source: item.name }] : [],
      unknown: safe ? [] : [{ id:`u-${item.id}-1`, name: base || item.name, qty: '—', category: 'Невідомо', status: 'unknown', reason: 'непрочитаний формат', source: item.name }],
      ignored: []
    };
  }

  async function prepareFileAnalysis(item) {
    if (item.analysis) return item.analysis;
    let analysis = fallbackAnalysis(item);
    try {
      const ext = extOf(item.name);
      if (ext === 'json' || ext === 'csv') {
        const text = await item.file.text();
        const rows = ext === 'json' ? extractRowsFromJson(JSON.parse(text)) : parseCsvText(text);
        const normalized = normalizeRows(rows, item.name);
        analysis = {
          fileName: item.name,
          unit: '',
          known: normalized.known,
          unknown: normalized.unknown,
          ignored: []
        };
      }
    } catch (err) {
      analysis = fallbackAnalysis(item);
      analysis.unknown.push({ id:`err-${item.id}`, name:'Помилка читання файлу', qty:'—', category:'Система', status:'unknown', reason: err.message || 'помилка парсингу', source:item.name });
    }
    item.analysis = analysis;
    return analysis;
  }

  function analysisFor(item) {
    return item.analysis || fallbackAnalysis(item);
  }

  function resultSummary(item) {
    const a = analysisFor(item);
    const errors = [...a.known, ...a.unknown].filter(r => r.qty === '—' || r.reason === 'помилка кількості').length;
    return { rows: a.known.length + a.unknown.length + a.ignored.length, known: a.known.length, unknown: a.unknown.length, errors };
  }

  function unitSelectorHtml(fileId, current = '') {
    const options = [''].concat(demoUnits).map(v => `<option value="${escapeHtml(v)}" ${v === current ? 'selected' : ''}>${v || 'Обрати підрозділ із довідника'}</option>`).join('');
    return `<select class="upload-unit-select" data-upload-unit-select="${fileId}">${options}</select>`;
  }

  function renderKnownRows(rows) {
    if (!rows.length) return `<div class="upload-result-empty-line">Відомі значення поки не визначені.</div>`;
    return `<div class="upload-result-table"><div class="upload-result-table__head"><span>Категорія</span><span>Назва</span><span>Кількість</span></div>${rows.map(r => `<div class="upload-result-row"><span>${escapeHtml(r.category)}</span><strong>${escapeHtml(r.name)}</strong><b>${escapeHtml(r.qty)}</b></div>`).join('')}</div>`;
  }

  function renderUnknownBlock(rows, fileId, compact = false) {
    if (!rows.length) return `<div class="upload-result-empty-line is-ok">Невідомих значень немає.</div>`;
    return `<section class="upload-unknown-block"><h4>Невідомі значення <em>${rows.length}</em></h4><div class="upload-unknown-list">${rows.map(r => `<article class="upload-unknown-row" data-unknown-id="${escapeHtml(r.id)}" data-file-id="${fileId}"><div><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.reason || 'немає збігу в довідниках')} · к-сть: ${escapeHtml(r.qty)}</span></div>${compact ? '' : `<div class="upload-unknown-actions"><button type="button" data-unknown-edit="${escapeHtml(r.id)}" data-file-id="${fileId}">Редагувати</button><button type="button" data-unknown-ignore="${escapeHtml(r.id)}" data-file-id="${fileId}">Ігнорувати</button></div>`}</article>`).join('')}</div></section>`;
  }

  function renderReviewResults() {
    resultsMode = 'review';
    resultsModal?.setAttribute('data-results-mode', 'review');
    resultsBody.innerHTML = files.map((f, index) => {
      const a = analysisFor(f);
      const s = resultSummary(f);
      return `<article class="upload-result-file upload-result-file--review" data-file-id="${f.id}">
        <header class="upload-result-file-head"><div><small>Файл ${String(index + 1).padStart(2, '0')}</small><h3>${escapeHtml(f.name)}</h3></div><label>Підрозділ ${unitSelectorHtml(f.id, a.unit)}</label></header>
        <div class="upload-result-stats"><span>Рядків <b>${s.rows}</b></span><span>Відомих <b>${s.known}</b></span><span>Невідомих <b>${s.unknown}</b></span><span>Помилок кількості <b>${s.errors}</b></span></div>
        <section class="upload-known-block"><h4>Дані, що йдуть у розрахунок</h4>${renderKnownRows(a.known)}</section>
        ${renderUnknownBlock(a.unknown, f.id, true)}
      </article>`;
    }).join('') || '<div class="upload-result-empty-line">Немає файлів для перегляду.</div>';
    if (resolveModeButton) resolveModeButton.textContent = totalUnknown() ? 'Режим парсингу' : 'Немає невідомих';
    if (resolveModeButton) resolveModeButton.disabled = !totalUnknown();
    if (calculateButton) calculateButton.textContent = totalUnknown() ? 'Перерахувати без невідомих' : 'Приступити до розрахунку';
  }

  function renderResolveResults() {
    resultsMode = 'resolve';
    resultsModal?.setAttribute('data-results-mode', 'resolve');
    const blocks = files.map((f, index) => {
      const a = analysisFor(f);
      return `<article class="upload-result-file upload-result-file--resolve" data-file-id="${f.id}">
        <header class="upload-result-file-head"><div><small>Режим парсингу · файл ${String(index + 1).padStart(2, '0')}</small><h3>${escapeHtml(f.name)}</h3></div></header>
        ${renderUnknownBlock(a.unknown, f.id, false)}
      </article>`;
    }).join('');
    resultsBody.innerHTML = blocks || '<div class="upload-result-empty-line">Немає невідомих значень.</div>';
    if (resolveModeButton) resolveModeButton.textContent = 'Повернутись до результатів';
    if (resolveModeButton) resolveModeButton.disabled = false;
    if (calculateButton) calculateButton.textContent = 'Ігнорувати решту і перейти до розрахунку';
  }

  function renderEditUnknown(fileId, unknownId) {
    const item = files.find(f => String(f.id) === String(fileId));
    if (!item) return;
    const a = analysisFor(item);
    const row = a.unknown.find(r => String(r.id) === String(unknownId));
    if (!row) return;
    resultsMode = 'edit';
    resultsModal?.setAttribute('data-results-mode', 'edit');
    resultsBody.innerHTML = `<article class="upload-result-file upload-result-file--editor" data-file-id="${item.id}" data-unknown-id="${escapeHtml(row.id)}">
      <header class="upload-result-file-head"><div><small>Розпарсити значення</small><h3>${escapeHtml(row.name)}</h3></div></header>
      <div class="upload-editor-grid">
        <label>Категорія
          <select id="uploadUnknownCategory">${dictCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
        </label>
        <label>Назва нового запису <input id="uploadUnknownName" type="text" value="${escapeHtml(row.name)}" /></label>
        <label>Кількість <input id="uploadUnknownQty" type="number" step="1" value="${Number.isInteger(Number(row.qty)) ? escapeHtml(row.qty) : ''}" placeholder="ціле число" /></label>
        <label>Активність
          <select id="uploadUnknownActive"><option value="active">Активний</option><option value="inactive">Неактивний</option></select>
        </label>
        <label class="wide">Примітка / службове поле <input id="uploadUnknownNote" type="text" placeholder="додаткові дані довідника" /></label>
      </div>
      <p class="upload-editor-note">Після додавання значення потрапить у відповідний довідник, буде вилучене з невідомих і дозаповнить розпарсений файл.</p>
      <div class="upload-editor-actions"><button type="button" data-save-unknown="${escapeHtml(row.id)}" data-file-id="${item.id}">Додати до довідника</button><button type="button" data-back-to-resolve>Назад</button></div>
    </article>`;
    if (resolveModeButton) resolveModeButton.textContent = 'Повернутись до списку';
    if (calculateButton) calculateButton.textContent = 'Ігнорувати решту';
  }

  function totalUnknown() {
    return files.reduce((acc, f) => acc + analysisFor(f).unknown.length, 0);
  }

  function renderResults() {
    if (resultsMode === 'resolve') renderResolveResults();
    else if (resultsMode === 'review') renderReviewResults();
  }

  function openResults() {
    if (!parsed) return;
    files.forEach(f => prepareFileAnalysis(f).then(() => {
      if (resultsModal?.classList.contains('is-open')) renderResults();
    }));
    renderReviewResults();
    document.body.classList.add('upload-results-open');
    resultsModal.classList.add('is-open');
    resultsModal.setAttribute('aria-hidden', 'false');
  }

  function closeResults() {
    resultsModal.classList.remove('is-open');
    resultsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('upload-results-open');
    resultsMode = 'review';
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
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
  resolveModeButton?.addEventListener('click', () => {
    if (resultsMode === 'review') renderResolveResults();
    else if (resultsMode === 'edit') renderResolveResults();
    else renderReviewResults();
  });
  calculateButton?.addEventListener('click', () => {
    files.forEach(f => {
      const a = analysisFor(f);
      a.ignored.push(...a.unknown.map(r => ({ ...r, status: 'ignored' })));
      a.unknown = [];
      f.analysis = a;
    });
    renderReviewResults();
  });
  resultsBody?.addEventListener('change', (event) => {
    const select = event.target.closest('[data-upload-unit-select]');
    if (!select) return;
    const item = files.find(f => String(f.id) === String(select.dataset.uploadUnitSelect));
    if (item) analysisFor(item).unit = select.value;
  });
  resultsBody?.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-unknown-edit]');
    const ignore = event.target.closest('[data-unknown-ignore]');
    const save = event.target.closest('[data-save-unknown]');
    const back = event.target.closest('[data-back-to-resolve]');
    if (edit) return renderEditUnknown(edit.dataset.fileId, edit.dataset.unknownEdit);
    if (back) return renderResolveResults();
    if (ignore) {
      const item = files.find(f => String(f.id) === String(ignore.dataset.fileId));
      const a = item && analysisFor(item);
      if (a) {
        const idx = a.unknown.findIndex(r => String(r.id) === String(ignore.dataset.unknownIgnore));
        if (idx >= 0) a.ignored.push({ ...a.unknown.splice(idx, 1)[0], status: 'ignored' });
      }
      return renderResolveResults();
    }
    if (save) {
      const item = files.find(f => String(f.id) === String(save.dataset.fileId));
      const a = item && analysisFor(item);
      if (a) {
        const idx = a.unknown.findIndex(r => String(r.id) === String(save.dataset.saveUnknown));
        const oldRow = idx >= 0 ? a.unknown.splice(idx, 1)[0] : null;
        const newRow = {
          ...(oldRow || {}),
          id: `resolved-${Date.now()}`,
          name: document.getElementById('uploadUnknownName')?.value?.trim() || oldRow?.name || 'Нове значення',
          qty: Number(document.getElementById('uploadUnknownQty')?.value || 0),
          category: document.getElementById('uploadUnknownCategory')?.value || 'Елемент',
          status: 'known',
          reason: ''
        };
        a.known.push(newRow);
      }
      return renderResolveResults();
    }
  });
  document.querySelectorAll('[data-upload-results-close]').forEach(el => el.addEventListener('click', closeResults));
  setPlateFormats();
  renderFiles();
})();
