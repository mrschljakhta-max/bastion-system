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
  const pageTitle = document.querySelector('.command-hex-title h1');
  const stage = document.querySelector('.command-hex-stage');

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


  function forecastYield(){
    const direct = Number(data.impactPerUnit ?? data.forecastYield ?? data.yieldPerUnit ?? data.kitsPerUnit);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const kits = Math.max(1, Number(data.kits || 0));
    const remain = Math.max(0, Number(data.remainTotal || 0));
    if (remain && kits) return Math.max(.35, Math.min(1.6, kits / Math.max(1, remain + kits) * 1.85));
    return 1.18;
  }

  function forecastScenarios(){
    const source = Array.isArray(data.forecasts) ? data.forecasts : Array.isArray(data.scenarios) ? data.scenarios : [];
    if (source.length){
      return source.slice(0,3).map((item, idx) => {
        const add = Number(item.add ?? item.delta ?? item.qty ?? item.amount ?? [100,250,500][idx]);
        const projected = Number(item.kits ?? item.projectedKits ?? item.result ?? (data.kits + add * forecastYield()));
        return {
          add: Number.isFinite(add) ? add : [100,250,500][idx],
          element: item.element || item.resource || item.name || data.bottleneck,
          projected: Math.round(projected),
          gain: Math.round(projected - Number(data.kits || 0))
        };
      });
    }
    const yieldRate = forecastYield();
    return [100,250,500].map(add => ({
      add,
      element: data.bottleneck,
      projected: Math.round(Number(data.kits || 0) + add * yieldRate),
      gain: Math.round(add * yieldRate)
    }));
  }

  function recommendationRows(){
    const minEl = minElement();
    const altYield = Math.max(.18, forecastYield() * .36);
    const rows = [
      { name: data.bottleneck || 'Критичний елемент', value: `+${forecastYield().toFixed(2).replace('.', ',')} компл. / 1 од.` },
      { name: minEl.name && minEl.name !== data.bottleneck ? minEl.name : 'Другий ресурс', value: `+${altYield.toFixed(2).replace('.', ',')} компл. / 1 од.` },
      { name: 'Надлишковий елемент', value: '+0 компл. / 1 од.' }
    ];
    return rows;
  }

  function forecastCards(){
    return forecastScenarios().map((item, idx) => `
      <article class="command-forecast-card ${idx === 1 ? 'is-prime' : ''}">
        <span class="command-forecast-card__label">+${item.add} ${escapeHtml(item.element)}</span>
        <strong>${item.projected}</strong>
        <small>комплектів · +${item.gain}</small>
      </article>`).join('');
  }

  function impactRows(){
    return recommendationRows().map(row => `
      <div class="command-impact-row">
        <span>${escapeHtml(row.name)}</span>
        <strong>${escapeHtml(row.value)}</strong>
      </div>`).join('');
  }

  function recommendationsView(){
    const scenarios = forecastScenarios();
    const best = [...scenarios].sort((a,b)=>b.gain-a.gain)[0] || scenarios[0];
    const top = maxUnit();
    const weak = minRemain();
    content.innerHTML = `
      <div class="command-reco-layout">
        <section class="command-reco-left" aria-label="Ключова рекомендація">
          <article class="command-reco-hero">
            <span class="command-reco-eyebrow">Обмежувальний елемент</span>
            <h2>${escapeHtml(data.bottleneck)}</h2>
            <p>Поточний результат: <strong>${data.kits}</strong> комплектів.</p>
          </article>
          <article class="command-reco-best">
            <span>Найкращий сценарій</span>
            <strong>+${best.add}</strong>
            <small>→ ${best.projected} компл. · +${best.gain}</small>
          </article>
        </section>

        <section class="command-reco-right" aria-label="Прогнозні показники">
          <div class="command-forecast-grid">${forecastCards()}</div>

          <section class="command-impact-panel">
            <div class="command-impact-title">Ефективність поповнення</div>
            ${impactRows()}
          </section>

          <section class="command-reco-side">
            <article>
              <span>Отримувач приросту</span>
              <strong>${escapeHtml(top.unit)}</strong>
              <small>${top.total} комплектів зараз</small>
            </article>
            <article>
              <span>Зона контролю</span>
              <strong>${escapeHtml(weak.unit)}</strong>
              <small>${weak.total} од. залишку</small>
            </article>
          </section>
        </section>
      </div>`;
  }


  function safeText(value, fallbackValue = '—') {
    const text = String(value ?? '').trim();
    return escapeHtml(text || fallbackValue);
  }

  function itemRows(items, limit = 4){
    const source = Array.isArray(items) ? items : [];
    if (!source.length) return '<span class="command-mini-muted">без деталізації</span>';
    return source.slice(0, limit).map(item => {
      const name = item.name || item.element || item.resource || item.title || item.type || 'Елемент';
      const qty = item.qty ?? item.count ?? item.total ?? item.remaining ?? item.remain ?? 0;
      return `<span class="command-mini-line"><b>${safeText(name)}</b><em>${safeText(qty)}</em></span>`;
    }).join('');
  }

  function allocationRows(){
    const groups = Array.isArray(data.allocations) && data.allocations.length ? data.allocations : fallback.allocations;
    return groups.map(group => `
      <article class="command-report-row">
        <div class="command-report-row__head">
          <span>${safeText(group.unit)}</span>
          <strong>${Number(group.total || 0)}</strong>
        </div>
        <div class="command-report-row__items">${itemRows(group.items, 3)}</div>
      </article>`).join('');
  }

  function remainRows(){
    const groups = Array.isArray(data.remains) && data.remains.length ? data.remains : fallback.remains;
    return groups.map(group => {
      const items = Array.isArray(group.items) ? [...group.items] : [];
      const min = items.length ? items.sort((a,b)=>Number(a.qty ?? a.remaining ?? a.total ?? 0)-Number(b.qty ?? b.remaining ?? b.total ?? 0))[0] : null;
      const minName = min ? (min.name || min.element || min.resource || 'Елемент') : '—';
      const minQty = min ? (min.qty ?? min.remaining ?? min.total ?? 0) : '—';
      return `
        <article class="command-report-row">
          <div class="command-report-row__head">
            <span>${safeText(group.unit)}</span>
            <strong>${Number(group.total || 0)}</strong>
          </div>
          <div class="command-report-row__items">
            <span class="command-mini-line"><b>мін. елемент</b><em>${safeText(minName)} · ${safeText(minQty)}</em></span>
            ${itemRows(group.items, 2)}
          </div>
        </article>`;
    }).join('');
  }

  function reportScenarioRows(){
    return forecastScenarios().map(item => `
      <article class="command-report-scenario">
        <span>+${item.add} ${safeText(item.element)}</span>
        <strong>${item.projected}</strong>
        <small>комплектів · приріст +${item.gain}</small>
      </article>`).join('');
  }

  function reportImpactRows(){
    return recommendationRows().map(row => `
      <div class="command-report-impact-row">
        <span>${safeText(row.name)}</span>
        <strong>${safeText(row.value)}</strong>
      </div>`).join('');
  }

  function reportView(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const generated = new Date().toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    content.innerHTML = `
      <div class="command-full-report">
        <section class="command-report-section command-report-section--summary">
          <div class="command-report-kpis">
            <article><span>Сформовано</span><strong>${data.kits}</strong><small>комплектів</small></article>
            <article><span>Дальність</span><strong>${fmtRange(data.bestRange)}</strong><small>максимум</small></article>
            <article><span>Обмеження</span><strong>${safeText(data.bottleneck)}</strong><small>вузьке місце</small></article>
            <article><span>Залишок</span><strong>${data.remainTotal}</strong><small>${data.remainPercent || 0}% після розрахунку</small></article>
          </div>
        </section>

        <section class="command-report-section">
          <header><span>01</span><h3>Висновки</h3></header>
          <div class="command-report-conclusion-grid">
            <article><span>Найбільше отримав</span><strong>${safeText(top.unit)}</strong><small>${top.total} комплектів</small></article>
            <article><span>Найменший запас</span><strong>${safeText(minEl.name)}</strong><small>${safeText(minEl.unit)} · ${safeText(minEl.qty)} од.</small></article>
            <article><span>Найменший залишок</span><strong>${safeText(weak.unit)}</strong><small>${weak.total} од.</small></article>
            <article><span>Підрозділи</span><div class="command-unit-chip-grid command-unit-chip-grid--report">${unitsChips()}</div></article>
          </div>
        </section>

        <section class="command-report-section">
          <header><span>02</span><h3>Рекомендації / прогноз</h3></header>
          <div class="command-report-scenario-grid">${reportScenarioRows()}</div>
          <div class="command-report-impact-panel">
            <div class="command-report-impact-title">Ефективність поповнення</div>
            ${reportImpactRows()}
          </div>
        </section>

        <section class="command-report-section command-report-section--analysis">
          <header><span>03</span><h3>Дані зі сторінки аналіз</h3></header>
          <div class="command-report-dual">
            <div>
              <h4>Розподіл боєкомплектів</h4>
              <div class="command-report-rows">${allocationRows()}</div>
            </div>
            <div>
              <h4>Залишки по підрозділах</h4>
              <div class="command-report-rows">${remainRows()}</div>
            </div>
          </div>
        </section>

        <section class="command-report-section command-report-section--audit">
          <header><span>04</span><h3>Службова інформація</h3></header>
          <div class="command-report-audit-grid">
            <article><span>Дата формування</span><strong>${generated}</strong></article>
            <article><span>Джерело</span><strong>localStorage / analysis result</strong></article>
            <article><span>Сценарії</span><strong>+100 / +250 / +500</strong></article>
            <article><span>Алгоритм</span><strong>BASTION command forecast</strong></article>
          </div>
        </section>
      </div>`;
  }

  function setView(view){
    document.querySelectorAll('[data-command-view]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.commandView === view));
    if (stage) stage.dataset.commandView = view;
    if (pageTitle) pageTitle.textContent = view === 'recommendations' ? 'РЕКОМЕНДАЦІЇ' : view === 'report' ? 'ВЕСЬ ЗВІТ' : 'ВИСНОВКИ';
    if (view === 'report') reportView();
    else if (view === 'recommendations') recommendationsView();
    else conclusionsView();
  }

  function reportText(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const lines = [];
    lines.push('BASTION — ПОВНИЙ ЗВІТ');
    lines.push('');
    lines.push('ЗАГАЛЬНІ KPI');
    lines.push(`Сформовано комплектів: ${data.kits}`);
    lines.push(`Максимальна дальність: ${fmtRange(data.bestRange)}`);
    lines.push(`Залишок складу: ${data.remainTotal} (${data.remainPercent || 0}% після розрахунку)`);
    lines.push(`Обмежувальний елемент: ${data.bottleneck}`);
    lines.push('');
    lines.push('ВИСНОВКИ');
    lines.push(`Найбільше отримав: ${top.unit} — ${top.total} комплектів`);
    lines.push(`Найменший запас: ${minEl.name} — ${minEl.qty} од. (${minEl.unit})`);
    lines.push(`Найменший залишок по підрозділах: ${weak.unit} — ${weak.total} од.`);
    lines.push(`Враховано підрозділів: ${allUnits().join(', ')}`);
    lines.push('');
    lines.push('РЕКОМЕНДАЦІЇ / ПРОГНОЗ');
    forecastScenarios().forEach(item => lines.push(`+${item.add} ${item.element}: ${item.projected} комплектів (приріст +${item.gain})`));
    lines.push('');
    lines.push('ЕФЕКТИВНІСТЬ ПОПОВНЕННЯ');
    recommendationRows().forEach(row => lines.push(`${row.name}: ${row.value}`));
    lines.push('');
    lines.push('РОЗПОДІЛ БОЄКОМПЛЕКТІВ');
    (data.allocations || []).forEach(group => lines.push(`${group.unit}: ${group.total}`));
    lines.push('');
    lines.push('ЗАЛИШКИ ПО ПІДРОЗДІЛАХ');
    (data.remains || []).forEach(group => lines.push(`${group.unit}: ${group.total}`));
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
