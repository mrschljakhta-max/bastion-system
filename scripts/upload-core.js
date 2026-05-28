
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
  const startButton = document.getElementById('uploadStartButton');
  const resultsButton = document.getElementById('uploadResultsButton');
  const resultsModal = document.getElementById('uploadResultsModal');
  const resultsBody = document.getElementById('uploadResultsBody');
  const resetButton = document.getElementById('uploadResetButton');
  const allowed = new Set(['xlsx', 'csv', 'json']);
  const MIN_PARSE_TIME = 10000;
  let files = [];
  let parsed = false;
  let timer = null;

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

  function renderFiles() {
    fileCount.textContent = String(files.length);
    startButton.disabled = files.length === 0 || parsed;
    resultsButton.disabled = !parsed;
    if (!files.length) {
      filesList.innerHTML = `<div class="upload-empty-state"><img class="upload-empty-icon" src="../assets/upload/icons/files.svg?v=246" alt="" aria-hidden="true" /><strong>Файли не додано</strong><span>Перетягніть файли у центр або натисніть для вибору</span></div>`;
      return;
    }
    filesList.innerHTML = files.map((item) => {
      const ext = extOf(item.name).toUpperCase();
      return `<article class="upload-file-card">
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
    incoming.forEach(file => files.push({ name: file.name, size: file.size, file, status: 'готовий' }));
    parsed = false;
    setPlateFormats();
    renderFiles();
    openPanel('right');
  }

  function startParsing() {
    if (!files.length || timer) return;
    parsed = false;
    startButton.disabled = true;
    resultsButton.disabled = true;
    let start = performance.now();
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
      if (pct >= 100) {
        clearInterval(timer);
        timer = null;
        files.forEach(f => f.status = 'оброблено');
        parsed = true;
        setPlate('Готовий', 100);
        renderFiles();
      }
    }, 90);
  }

  function openResults() {
    if (!parsed) return;
    resultsBody.innerHTML = files.map((f, index) => `<article class="upload-result-file">
      <h3>Файл ${String(index + 1).padStart(2, '0')}: ${escapeHtml(f.name)}</h3>
      <label>Підрозділ: <input type="text" placeholder="Вкажіть підрозділ, якщо не визначено" /></label>
      <div class="upload-result-stats">
        <span>Рядків <b>0</b></span>
        <span>Відомих <b>0</b></span>
        <span>Невідомих <b>0</b></span>
        <span>Помилок кількості <b>0</b></span>
      </div>
    </article>`).join('');
    resultsModal.classList.add('is-open');
    resultsModal.setAttribute('aria-hidden', 'false');
  }

  function closeResults() {
    resultsModal.classList.remove('is-open');
    resultsModal.setAttribute('aria-hidden', 'true');
  }

  function resetAll() {
    if (timer) { clearInterval(timer); timer = null; }
    files = [];
    parsed = false;
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
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, e => { e.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, e => { e.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  startButton.addEventListener('click', startParsing);
  resultsButton.addEventListener('click', openResults);
  resetButton.addEventListener('click', resetAll);
  document.querySelectorAll('[data-upload-results-close]').forEach(el => el.addEventListener('click', closeResults));
  setPlateFormats();
  renderFiles();
})();
