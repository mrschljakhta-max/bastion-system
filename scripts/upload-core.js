(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const MIN_PARSE_TIME = 10000;
  const state = { files: [], results: [], progress: 0, phase: 'idle' };
  const el = {
    drop: $('#uploadDropZone'), input: $('#uploadFileInput'), list: $('#uploadFileList'), count: $('#uploadFileCount'),
    start: $('#uploadStartButton'), result: $('#uploadResultButton'), modal: $('#uploadResultModal'), body: $('#uploadResultBody'),
    reset: $('#uploadResetButton'), badge: $('#uploadBadgeText'), pct: $('#uploadProgressValue'), title: $('#uploadCoreTitle'), hint: $('#uploadCoreHint'),
    sys: $('#uploadSystemState'), session: $('#uploadSessionInfo')
  };
  if (!el.drop) return;

  const validExt = ['xlsx','xls','csv','json'];
  const dictCache = { projectiles: new Set(), charges: new Set(), fuzes: new Set(), primers: new Set() };

  $$('[data-upload-toggle]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const side = btn.dataset.uploadToggle;
    const panel = side === 'left' ? $('.upload-side--left') : $('.upload-side--right');
    panel?.classList.toggle('is-collapsed');
  }));

  function extOf(file){ return (file.name.split('.').pop() || '').toLowerCase(); }
  function fmtBytes(n){ return n < 1024 ? n+' B' : n < 1048576 ? Math.round(n/1024)+' KB' : (n/1048576).toFixed(1)+' MB'; }
  function normalizeName(v){ return String(v ?? '').trim().replace(/\s+/g,' ').toUpperCase(); }
  function validQty(v){ if (v === null || v === undefined || v === '') return false; const n = Number(v); return Number.isInteger(n) && n >= 0; }
  function setPhase(text, pct){ el.badge.textContent = text; el.pct.textContent = `${Math.round(pct)}%`; state.progress = pct; }

  async function loadDictionaries(){
    const supa = window.bastionSupabase || window.supabaseClient || window.supabase;
    const tables = [['dict_projectiles','projectiles'],['dict_charges','charges'],['dict_fuzes','fuzes'],['dict_praymera','primers']];
    if (supa?.from) {
      for (const [table,key] of tables) {
        try { const { data } = await supa.from(table).select('name').eq('is_active', true); (data||[]).forEach(x => dictCache[key].add(normalizeName(x.name))); } catch(e) {}
      }
    }
  }

  function addFiles(files){
    const incoming = [...files].filter(f => validExt.includes(extOf(f)));
    incoming.forEach(file => state.files.push({ id: crypto.randomUUID(), file, status:'ГОТОВИЙ' }));
    renderFiles();
    if (state.files.length) { $('.upload-side--right')?.classList.remove('is-collapsed'); el.start.disabled = false; el.title.textContent = 'ФАЙЛИ ДОДАНО'; el.hint.textContent = 'натисніть СТАРТ для початку парсингу'; el.session.textContent = `У буфері: ${state.files.length} файл(и)`; }
  }

  function renderFiles(){
    el.count.textContent = state.files.length;
    if (!state.files.length) { el.list.innerHTML = '<div class="upload-empty"><b>ФАЙЛИ НЕ ДОДАНО</b><span>Перетягніть файли у центр або натисніть для вибору</span></div>'; return; }
    el.list.innerHTML = state.files.map(x => {
      const ext = extOf(x.file);
      return `<article class="upload-file-card"><div class="upload-file-icon ${ext}">${ext.toUpperCase().slice(0,4)}</div><div><h4>${x.file.name}</h4><p>${fmtBytes(x.file.size)} • ${ext.toUpperCase()}</p><strong>${x.status}</strong></div><button type="button" data-remove-file="${x.id}">×</button></article>`;
    }).join('');
    $$('[data-remove-file]').forEach(b => b.onclick = () => { state.files = state.files.filter(x => x.id !== b.dataset.removeFile); renderFiles(); el.start.disabled = !state.files.length; });
  }

  async function parseFile(item){
    const file = item.file, ext = extOf(file);
    if (ext === 'json') return JSON.parse(await file.text());
    if (ext === 'csv') return parseCSV(await file.text());
    const buf = await file.arrayBuffer();
    if (!window.XLSX) throw new Error('XLSX бібліотека не завантажена');
    const wb = XLSX.read(buf, { type:'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
  }

  function parseCSV(text){
    const rows = text.trim().split(/\r?\n/).map(r => r.split(/;|,/).map(c => c.trim()));
    const head = rows.shift() || [];
    return rows.map(r => Object.fromEntries(head.map((h,i)=>[h,r[i] ?? ''])));
  }

  function classify(name){
    const n = normalizeName(name);
    if (dictCache.projectiles.has(n)) return 'projectile';
    if (dictCache.charges.has(n)) return 'charge';
    if (dictCache.fuzes.has(n)) return 'fuze';
    if (dictCache.primers.has(n)) return 'primer';
    return 'unknown';
  }
  function getName(row){ return row.name ?? row.Name ?? row['найменування'] ?? row['Найменування'] ?? row['назва'] ?? row['Назва'] ?? ''; }
  function getQty(row){ return row.count ?? row.quantity ?? row.qty ?? row['кількість'] ?? row['Кількість'] ?? ''; }
  function processRows(rows, fileName){
    rows = Array.isArray(rows) ? rows : [];
    const parsed = rows.map((row, i) => {
      const rawName = getName(row); const qty = getQty(row); let type = classify(rawName); let status = type === 'unknown' ? 'unknown' : 'matched';
      if (!validQty(qty)) status = 'invalid_quantity';
      return { row:i+1, rawName, quantity:qty, itemType:type, status };
    });
    return { fileName, unit:'', total:parsed.length, matched:parsed.filter(r=>r.status==='matched').length, unknown:parsed.filter(r=>r.status==='unknown').length, invalid:parsed.filter(r=>r.status==='invalid_quantity').length, rows:parsed };
  }

  async function startParsing(){
    if (!state.files.length) return;
    state.phase = 'processing'; el.drop.classList.add('is-processing'); el.start.disabled = true; el.result.disabled = true; el.sys.textContent = 'ПАРСИНГ'; el.title.textContent = 'PROCESSING';
    await loadDictionaries();
    const start = performance.now();
    const phrases = ['СКАНУВАННЯ','ПЕРЕВІРКА','ЗІСТАВЛЕННЯ','НОРМАЛІЗАЦІЯ','ФІКСАЦІЯ'];
    let timer = setInterval(()=>{ const t = Math.min(95, ((performance.now()-start)/MIN_PARSE_TIME)*95); setPhase(phrases[Math.floor(t/20)] || 'ПАРСИНГ', t); },120);
    state.results = [];
    for (const item of state.files) {
      item.status = 'ПАРСИНГ'; renderFiles();
      try { const rows = await parseFile(item); state.results.push(processRows(rows, item.file.name)); item.status = 'ОБРОБЛЕНО'; }
      catch(e){ state.results.push({fileName:item.file.name, unit:'', total:0, matched:0, unknown:0, invalid:1, error:e.message, rows:[]}); item.status = 'ПОМИЛКА'; }
      renderFiles();
    }
    const wait = Math.max(0, MIN_PARSE_TIME - (performance.now()-start));
    setTimeout(()=>{ clearInterval(timer); setPhase('ГОТОВО',100); el.drop.classList.remove('is-processing'); el.result.disabled = false; el.title.textContent = 'ПАРСИНГ ЗАВЕРШЕНО'; el.hint.textContent = 'відкрийте перегляд результату'; el.sys.textContent = 'ГОТОВИЙ'; renderResults(); }, wait);
  }

  function renderResults(){
    el.body.innerHTML = state.results.map((r, idx)=>`<article class="result-file"><h3>${idx+1}. ${r.fileName}</h3>${r.error?`<p class="status-invalid_quantity">${r.error}</p>`:''}<label class="unit-field"><span>Підрозділ:</span><input data-unit-index="${idx}" value="${r.unit||''}" placeholder="Вкажіть підрозділ для цього файлу" /></label><div class="result-grid"><div class="result-pill"><small>Рядків</small><b>${r.total}</b></div><div class="result-pill"><small>Відомих</small><b class="status-matched">${r.matched}</b></div><div class="result-pill"><small>Невідомих</small><b class="status-unknown">${r.unknown}</b></div><div class="result-pill"><small>Помилки кількості</small><b class="status-invalid_quantity">${r.invalid}</b></div><div class="result-pill"><small>Статус</small><b>${r.invalid||r.unknown?'Частково':'OK'}</b></div></div><table class="result-table"><thead><tr><th>#</th><th>Назва</th><th>Тип</th><th>Кількість</th><th>Статус</th></tr></thead><tbody>${r.rows.slice(0,60).map(row=>`<tr><td>${row.row}</td><td>${row.rawName}</td><td>${row.itemType}</td><td>${row.quantity}</td><td class="status-${row.status}">${row.status}</td></tr>`).join('')}</tbody></table></article>`).join('');
    $$('[data-unit-index]').forEach(inp => inp.oninput = () => state.results[+inp.dataset.unitIndex].unit = inp.value);
  }

  function resetAll(){
    if (!confirm('Скинути всі завантажені файли, результати парсингу та проміжні дані?')) return;
    state.files = []; state.results = []; state.phase = 'idle'; renderFiles(); setPhase('ГОТОВИЙ',0); el.title.textContent='DRAG & DROP'; el.hint.textContent='або натисніть для вибору файлів'; el.start.disabled=true; el.result.disabled=true; el.modal.classList.remove('is-open'); el.modal.setAttribute('aria-hidden','true'); el.session.textContent='Очікує файлів'; el.sys.textContent='ГОТОВИЙ'; el.input.value='';
  }

  el.drop.addEventListener('click', () => el.input.click());
  el.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') el.input.click(); });
  el.input.addEventListener('change', e => addFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev => el.drop.addEventListener(ev, e => { e.preventDefault(); el.drop.classList.add('is-dragover'); el.badge.textContent='ВІДПУСТІТЬ'; }));
  ['dragleave','drop'].forEach(ev => el.drop.addEventListener(ev, e => { e.preventDefault(); el.drop.classList.remove('is-dragover'); if(ev==='drop') addFiles(e.dataTransfer.files); else el.badge.textContent=state.progress?'ГОТОВО':'ГОТОВИЙ'; }));
  el.start.addEventListener('click', startParsing);
  el.result.addEventListener('click', () => { renderResults(); el.modal.classList.add('is-open'); el.modal.setAttribute('aria-hidden','false'); });
  $$('[data-upload-close]').forEach(x => x.addEventListener('click', () => { el.modal.classList.remove('is-open'); el.modal.setAttribute('aria-hidden','true'); }));
  el.reset.addEventListener('click', resetAll);
  $('#uploadConfirmButton')?.addEventListener('click', () => alert('Імпорт підтверджено локально. Запис у Supabase підключимо наступним етапом.'));
})();
