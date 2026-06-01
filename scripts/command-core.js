(() => {
  const fallback = {
    mode: 'Загальний режим', kits: 1694, bestRange: 27400, bottleneck: 'Заряд-1', remainTotal: 1008, remainPercent: 37,
    allocations: [{ unit: '1 САДн', total: 1020 }, { unit: '2 САДн', total: 337 }, { unit: '1 АДн', total: 168 }, { unit: '2 АДн', total: 169 }, { unit: 'РЕАБАТР', total: 0 }],
    remains: [{ unit: '1 САДн', total: 504 }, { unit: '2 САДн', total: 620 }, { unit: '1 АДн', total: 580 }, { unit: '2 АДн', total: 504 }, { unit: 'РЕАБАТР', total: 1008 }]
  };

  function readResult(){
    const keys = ['bastion.analysis.result','bastion.calculation.result','bastionCalculatorResult','bastionAnalysisResult'];
    for (const key of keys){
      try{
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return normalize(parsed);
      } catch(_) {}
    }
    return fallback;
  }

  function normalize(input){
    const data = { ...fallback, ...input };
    data.kits = Number(input.kits ?? input.maxKits ?? input.totalKits ?? fallback.kits);
    data.bestRange = Number(input.bestRange ?? input.range ?? fallback.bestRange);
    data.bottleneck = input.bottleneck || input.limitElement || fallback.bottleneck;
    data.remainTotal = Number(input.remainTotal ?? input.remainingTotal ?? fallback.remainTotal);
    data.remainPercent = Number(input.remainPercent ?? fallback.remainPercent);
    data.allocations = normalizeGroups(input.allocations || input.distribution || fallback.allocations);
    data.remains = normalizeGroups(input.remains || input.remaining || fallback.remains);
    return data;
  }

  function normalizeGroups(groups){
    return (Array.isArray(groups) ? groups : []).map((g, idx) => {
      const items = Array.isArray(g.items) ? g.items : [];
      const total = Number(g.total ?? g.qty ?? g.count ?? items.reduce((s,i)=>s+Number(i.qty||i.count||i.total||i.remaining||0),0));
      return { unit: g.unit || g.name || `Підрозділ ${idx+1}`, total, items };
    });
  }

  const data = readResult();
  const el = (id) => document.getElementById(id);
  const content = el('commandContent');

  function fmtRange(m){
    const n = Number(m || 0);
    if (!n) return '—';
    return n >= 1000 ? `${String((n/1000).toFixed(1)).replace('.', ',')} км` : `${n} м`;
  }

  function maxUnit(){
    return [...data.allocations].sort((a,b)=>(b.total||0)-(a.total||0))[0] || { unit:'—', total:0 };
  }
  function minRemain(){
    return [...data.remains].sort((a,b)=>(a.total||0)-(b.total||0))[0] || { unit:'—', total:0 };
  }

  function allUnits(){
    const defaultUnits = ['1 САДн','2 САДн','1 АДн','2 АДн','РЕАБАТР'];
    const fromData = [...data.allocations, ...data.remains]
      .map(g => g.unit)
      .filter(Boolean);
    const unique = [...new Set(fromData)];
    return unique.length >= 3 ? unique : defaultUnits;
  }

  function minElement(){
    const candidates = [];
    [...data.allocations, ...data.remains].forEach(group => {
      (group.items || []).forEach(item => {
        const name = item.name || item.element || item.resource || item.title || item.type;
        const qty = Number(item.remaining ?? item.remain ?? item.qty ?? item.count ?? item.total);
        if (name && Number.isFinite(qty)) candidates.push({ name, qty, unit: group.unit });
      });
    });
    if (candidates.length) return candidates.sort((a,b)=>a.qty-b.qty)[0];
    const weak = minRemain();
    return { name: data.bottleneck || '—', qty: weak.total || data.remainTotal || 0, unit: weak.unit || '—' };
  }

  function unitsChips(){
    return allUnits().map(unit => `<span class="command-unit-chip">${escapeHtml(unit)}</span>`).join('');
  }
  function readiness(){
    const kits = Math.max(0, Number(data.kits || 0));
    const remain = Math.max(0, Number(data.remainTotal || 0));
    const total = kits + remain;
    return total ? Math.round((kits / total) * 100) : 0;
  }

  function conclusionsView(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    content.innerHTML = `
      <div class="command-final-layout">
        <section class="command-final-left" aria-label="Загальні показники">
          <article class="command-final-card command-final-card--hero">
            <span class="command-final-card__label">Сформовано комплектів</span>
            <strong class="command-final-card__main">${data.kits}</strong>
          </article>

          <div class="command-final-left__bottom">
            <article class="command-final-card command-final-card--range">
              <span class="command-final-card__label">Максимальна дальність</span>
              <strong>${fmtRange(data.bestRange)}</strong>
            </article>
            <article class="command-final-card command-final-card--remain">
              <span class="command-final-card__label">Залишок складу</span>
              <strong>${data.remainTotal}</strong>
              <small>${data.remainPercent || 0}% після розрахунку</small>
            </article>
          </div>
        </section>

        <section class="command-final-right" aria-label="Деталізація результату">
          <article class="command-final-card command-final-card--bottleneck">
            <span class="command-final-card__label">Обмежувальний елемент</span>
            <strong>${data.bottleneck}</strong>
            <small>вузьке місце</small>
          </article>
          <article class="command-final-card">
            <span class="command-final-card__label">Найменший запас</span>
            <strong>${minEl.name}</strong>
            <small>${minEl.unit} · ${minEl.qty} од.</small>
          </article>
          <article class="command-final-card">
            <span class="command-final-card__label">Найбільше отримав</span>
            <strong>${top.unit}</strong>
            <small>${top.total} комплектів</small>
          </article>
          <article class="command-final-card command-final-card--units">
            <span class="command-final-card__label">Враховано підрозділів</span>
            <div class="command-unit-chip-grid">${unitsChips()}</div>
          </article>
        </section>
      </div>`;
  }


  function recommendationsView(){
    const weak = minRemain();
    const ready = readiness();
    const priority = ready >= 75 ? 'Підтримувати поточний темп контролю та не допустити просідання критичного ресурсу.' : ready >= 55 ? 'Першочергово вирівняти залишки та перевірити ресурс, який обмежує формування комплектів.' : 'Негайно зосередити поповнення на критичному елементі та повторити розрахунок після оновлення даних.';
    content.innerHTML = `
      <div class="command-recommendation-stack">
        <article class="command-brief-card command-recommendation-card command-recommendation-card--main">
          <h3>Пріоритет дій</h3>
          <span class="command-big-number">${data.bottleneck}</span>
          <p>${priority}</p>
        </article>
        <article class="command-brief-card command-recommendation-card">
          <h3>Контроль залишків</h3>
          <p>Найнижчий залишок: <strong>${weak.unit}</strong> — ${weak.total}. Доцільно перевірити фактичну наявність і підтвердити дані перед наступним циклом планування.</p>
        </article>
        <article class="command-brief-card command-recommendation-card">
          <h3>Наступний крок</h3>
          <ul>
            <li>Оновити вихідні дані по підрозділах.</li>
            <li>Повторити аналіз після коригування критичного ресурсу.</li>
            <li>Після підтвердження — сформувати повний звіт або експорт.</li>
          </ul>
        </article>
      </div>`;
  }

  function reportView(){
    const totalUnits = data.allocations.length || data.remains.length || 0;
    const remainUnits = data.remains.map(g => `${g.unit}: ${g.total}`).join(' · ');
    content.innerHTML = `
      <div class="command-report-list">
        <div class="command-report-card"><span>KPI</span><strong>${data.kits}</strong><small>згенеровано комплектів</small></div>
        <div class="command-report-card"><span>ДАЛЬНІСТЬ</span><strong>${fmtRange(data.bestRange)}</strong><small>найкращий активний рецепт</small></div>
        <div class="command-report-card"><span>ОБМЕЖЕННЯ</span><strong>${data.bottleneck}</strong><small>критичний ресурс</small></div>
        <div class="command-report-card"><span>ПІДРОЗДІЛИ</span><strong>${totalUnits}</strong><small>враховано у звіті</small></div>
        <div class="command-report-card"><span>ЗАЛИШОК</span><strong>${data.remainTotal}</strong><small>${data.remainPercent || 0}% після розрахунку</small></div>
        <div class="command-report-card"><span>ДЕТАЛІ</span><strong>ANALYSIS</strong><small>${remainUnits || 'дані доступні на сторінці аналізу'}</small></div>
      </div>`;
  }

  function setView(view){
    document.querySelectorAll('[data-command-view]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.commandView === view));
    if (view === 'report') reportView();
    else if (view === 'recommendations') recommendationsView();
    else conclusionsView();
  }

  function reportText(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const lines = [];
    lines.push('BASTION — ВИСНОВКИ');
    lines.push('');
    lines.push(`Сформовано комплектів: ${data.kits}`);
    lines.push(`Максимальна дальність: ${fmtRange(data.bestRange)}`);
    lines.push(`Залишок складу: ${data.remainTotal} (${data.remainPercent || 0}% після розрахунку)`);
    lines.push(`Обмежувальний елемент: ${data.bottleneck}`);
    lines.push(`Найбільше отримав: ${top.unit} — ${top.total} комплектів`);
    lines.push(`Найменший запас: ${minEl.name} — ${minEl.qty} од. (${minEl.unit})`);
    lines.push(`Найменший залишок по підрозділах: ${weak.unit} — ${weak.total} од.`);
    lines.push(`Враховано підрозділів: ${allUnits().join(', ')}`);
    return lines.join('\n');
  }


  function downloadBlob(name, content, type){
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function exportDoc(){
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>BASTION — Висновки</title></head><body><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14pt;line-height:1.45">${escapeHtml(reportText())}</pre></body></html>`;
    downloadBlob('bastion-command-report.doc', html, 'application/msword;charset=utf-8');
  }
  function exportPdf(){
    const text = reportText();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>BASTION — Висновки</title><style>body{font-family:Arial,sans-serif;padding:42px;color:#121923}h1{color:#d7262d;letter-spacing:2px}.box{border-top:3px solid #d7262d;padding-top:20px;white-space:pre-wrap;font-size:14px;line-height:1.45}</style></head><body><h1>BASTION — ВИСНОВКИ</h1><div class="box">${escapeHtml(text)}</div><script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`;
    // Browser-safe fallback: downloadable HTML report with print-ready PDF layout.
    downloadBlob('bastion-command-report-pdf.html', html, 'text/html;charset=utf-8');
  }
  function escapeHtml(str){ return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }

  function openModal(){ const modal = el('commandExportModal'); if (modal) { modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false'); } }
  function closeModal(){ const modal = el('commandExportModal'); if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); } }

  document.querySelectorAll('[data-command-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.commandView)));
  document.querySelectorAll('[data-command-export-open]').forEach(btn => btn.addEventListener('click', openModal));
  document.querySelectorAll('[data-command-export-close]').forEach(btn => btn.addEventListener('click', closeModal));
  document.querySelectorAll('[data-command-export]').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.commandExport === 'docx') exportDoc();
    if (btn.dataset.commandExport === 'pdf') exportPdf();
    closeModal();
  }));
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

  conclusionsView();
})();
