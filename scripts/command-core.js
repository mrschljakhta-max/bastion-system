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


  function chartRows(groups, valueKey = 'total'){
    const source = (Array.isArray(groups) && groups.length ? groups : []).map(g => ({
      label: g.unit || g.name || '—',
      value: Number(g[valueKey] ?? g.total ?? g.qty ?? g.count ?? 0)
    }));
    const max = Math.max(1, ...source.map(x => x.value));
    return source.map(row => {
      const width = Math.max(4, Math.round((row.value / max) * 100));
      return `<div class="command-chart-row">
        <span class="command-chart-row__name">${safeText(row.label)}</span>
        <div class="command-chart-row__track"><i style="width:${width}%"></i></div>
        <strong>${row.value}</strong>
      </div>`;
    }).join('') || '<span class="command-mini-muted">немає даних</span>';
  }

  function forecastLineChart(){
    const points = [{ label:'Поточний', value:Number(data.kits||0) }, ...forecastScenarios().map(x => ({ label:`+${x.add}`, value:x.projected }))];
    const max = Math.max(...points.map(p=>p.value), 1);
    const min = Math.min(...points.map(p=>p.value), 0);
    const span = Math.max(1, max - min);
    const coords = points.map((p, idx) => {
      const x = 8 + idx * (84 / Math.max(1, points.length - 1));
      const y = 86 - ((p.value - min) / span) * 68;
      return { ...p, x, y };
    });
    const poly = coords.map(p => `${p.x},${p.y}`).join(' ');
    return `<div class="command-line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 86 H96 M8 18 H96 M8 52 H96" class="grid"></path>
        <polyline points="${poly}" class="line"></polyline>
        ${coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2.5" class="dot"></circle>`).join('')}
      </svg>
      <div class="command-line-chart__labels">${coords.map(p=>`<span>${safeText(p.label)}<b>${p.value}</b></span>`).join('')}</div>
    </div>`;
  }

  function impactChartRows(){
    const rows = recommendationRows().map(row => {
      const number = Number(String(row.value).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/)?.[0] || 0);
      return { name: row.name, value: number, label: row.value };
    });
    const max = Math.max(1, ...rows.map(r=>r.value));
    return rows.map(row => {
      const width = Math.max(3, Math.round((row.value / max) * 100));
      return `<div class="command-chart-row command-chart-row--impact">
        <span class="command-chart-row__name">${safeText(row.name)}</span>
        <div class="command-chart-row__track"><i style="width:${width}%"></i></div>
        <strong>${safeText(row.label)}</strong>
      </div>`;
    }).join('');
  }

  function reportCharts(){
    return `
      <section class="command-report-section command-report-section--charts">
        <header><span>03</span><h3>Графіки та діаграми</h3></header>
        <div class="command-report-chart-grid">
          <article class="command-chart-card command-chart-card--wide">
            <h4>Розподіл боєкомплектів</h4>
            <div class="command-chart-bars">${chartRows(data.allocations || fallback.allocations)}</div>
          </article>
          <article class="command-chart-card command-chart-card--wide">
            <h4>Залишки по підрозділах</h4>
            <div class="command-chart-bars">${chartRows(data.remains || fallback.remains)}</div>
          </article>
          <article class="command-chart-card">
            <h4>Прогноз приросту</h4>
            ${forecastLineChart()}
          </article>
          <article class="command-chart-card">
            <h4>Ефективність поповнення</h4>
            <div class="command-chart-bars command-chart-bars--compact">${impactChartRows()}</div>
          </article>
        </div>
      </section>`;
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

        ${reportCharts()}

        <section class="command-report-section command-report-section--analysis">
          <header><span>04</span><h3>Дані зі сторінки аналіз</h3></header>
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
          <header><span>05</span><h3>Службова інформація</h3></header>
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
    lines.push('ГРАФІКИ / ДІАГРАМИ');
    lines.push('1. Розподіл боєкомплектів по підрозділах');
    lines.push('2. Прогноз приросту від поповнення');
    lines.push('3. Ефективність поповнення ресурсів');
    lines.push('4. Залишки по підрозділах');
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

  function reportMeta(){
    return {
      generated: new Date().toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }),
      user: document.getElementById('operatorName')?.textContent?.trim() || 'Командир',
      mode: data.mode || 'Загальний розрахунок',
      version: 'v1.4.0'
    };
  }

  function clampNumber(n, fallbackValue = 0){
    const num = Number(n);
    return Number.isFinite(num) ? num : fallbackValue;
  }

  function reportLogoSvg(){
    return `<svg class="report-logo-mark" viewBox="0 0 120 120" role="img" aria-label="BASTION">
      <defs><linearGradient id="bastionMarkGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff1717"/><stop offset="1" stop-color="#980000"/></linearGradient></defs>
      <path fill="url(#bastionMarkGrad)" d="M60 7 104 32 79 46 60 36 41 46 16 32 60 7Zm44 41v28L60 102 16 76V48l44 26 19-11-44-26 25-14 44 25ZM16 88l44 25 44-25V77L60 103 16 77v11Z"/>
    </svg>`;
  }

  function reportIcon(name){
    const icons = {
      kpi: '<path d="M12 4v16M5 11l7-7 7 7M7 20h10"/>',
      conclusion: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Zm-2 2H3a3 3 0 0 0 3 3m12-3h2a3 3 0 0 1-3 3"/>',
      forecast: '<path d="M4 18 9 9l4 5 7-10M4 20h16"/>',
      chart: '<path d="M4 20V4m0 16h16M8 17V9m5 8V5m5 12v-6"/>',
      ammo: '<path d="M8 4h8l2 4v10l-2 2H8l-2-2V8l2-4Zm0 4h10"/>',
      stock: '<path d="M4 7 12 3l8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4"/>',
      element: '<path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4Zm0 6v7"/>',
      scenario: '<path d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 3h6m-3-3v6"/>',
      service: '<path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>'
    };
    return `<svg class="report-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.kpi}</svg>`;
  }

  function tocRow(icon, title, page){
    return `<div class="report-toc-row">${reportIcon(icon)}<span>${escapeHtml(title)}</span><b>${page}</b></div>`;
  }

  function tableRows(rows){
    return rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
  }

  function kpiCard(icon, label, value, sub = ''){
    return `<article class="report-kpi-card">${reportIcon(icon)}<div><span>${escapeHtml(label)}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div></article>`;
  }

  function barsChart(title, groups, xLabel, yLabel, horizontal = False){
    return '';
  }

  function reportBarChart(title, rows, xLabel, yLabel, opts = {}){
    const max = Math.max(1, ...rows.map(r => clampNumber(r.value)));
    const isHorizontal = !!opts.horizontal;
    const bars = rows.map(row => {
      const value = clampNumber(row.value);
      const pct = Math.max(2, Math.round((value / max) * 100));
      if (isHorizontal){
        return `<div class="report-hbar-row"><span>${escapeHtml(row.label)}</span><i><b style="width:${pct}%"></b></i><strong>${value}</strong></div>`;
      }
      return `<div class="report-vbar"><strong>${value}</strong><i style="height:${pct}%"></i><span>${escapeHtml(row.label)}</span></div>`;
    }).join('');
    return `<article class="report-chart-card ${isHorizontal ? 'is-horizontal' : ''}">
      <h4>${escapeHtml(title)}</h4>
      <div class="report-axis-y">Вісь Y: ${escapeHtml(yLabel)}</div>
      <div class="${isHorizontal ? 'report-hbar-chart' : 'report-vbar-chart'}">${bars}</div>
      <div class="report-axis-x">Вісь X: ${escapeHtml(xLabel)}</div>
    </article>`;
  }

  function reportLineChart(title, points, xLabel, yLabel){
    const max = Math.max(...points.map(p => clampNumber(p.value)), 1);
    const min = Math.min(...points.map(p => clampNumber(p.value)), 0);
    const span = Math.max(1, max - min);
    const coords = points.map((p, idx) => {
      const x = 8 + idx * (84 / Math.max(1, points.length - 1));
      const y = 84 - ((clampNumber(p.value) - min) / span) * 66;
      return { ...p, x, y };
    });
    const poly = coords.map(p => `${p.x},${p.y}`).join(' ');
    return `<article class="report-chart-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="report-axis-y">Вісь Y: ${escapeHtml(yLabel)}</div>
      <svg class="report-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M8 84 H96 M8 51 H96 M8 18 H96" class="grid"/>
        <polyline points="${poly}" class="line"/>
        ${coords.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.3" class="dot"/>`).join('')}
      </svg>
      <div class="report-line-labels">${coords.map(p => `<span>${escapeHtml(p.label)}<b>${p.value}</b></span>`).join('')}</div>
      <div class="report-axis-x">Вісь X: ${escapeHtml(xLabel)}</div>
    </article>`;
  }

  function reportDonutChart(title, rows){
    const total = Math.max(1, rows.reduce((s,r)=>s+clampNumber(r.value),0));
    let acc = 0;
    const segments = rows.map((r, idx) => {
      const v = clampNumber(r.value);
      const start = acc / total * 100;
      acc += v;
      const end = acc / total * 100;
      return `${idx % 2 ? '#ff7b7b' : '#d71920'} ${start}% ${end}%`;
    }).join(', ');
    return `<article class="report-chart-card report-donut-card"><h4>${escapeHtml(title)}</h4>
      <div class="report-donut" style="background: conic-gradient(${segments});"><span>${total}</span></div>
      <div class="report-legend">${rows.map(r => `<span><i></i>${escapeHtml(r.label)} — ${r.value}</span>`).join('')}</div>
    </article>`;
  }

  function reportChartBlocks(){
    const allocations = (data.allocations || fallback.allocations).map(g => ({ label:g.unit, value:g.total }));
    const remainsRows = (data.remains || fallback.remains).map(g => ({ label:g.unit, value:g.total }));
    const forecastPoints = [{label:'Поточний', value:data.kits}, ...forecastScenarios().map(x => ({ label:`+${x.add}`, value:x.projected }))];
    const impactRows = recommendationRows().map(row => {
      const value = Number(String(row.value).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/)?.[0] || 0);
      return { label: row.name, value };
    });
    return `
      <section class="report-section page-break">
        <h2>04. Графіки / діаграми</h2>
        <div class="report-chart-grid">
          ${reportBarChart('4.1 Розподіл комплектів по підрозділах', allocations, 'Підрозділи', 'Комплекти (од.)')}
          ${reportLineChart('4.2 Прогноз приросту від поповнення', forecastPoints, 'Поповнення (од.)', 'Комплекти (од.)')}
          ${reportBarChart('4.3 Ефективність поповнення ресурсів', impactRows, 'Комплекти на 1 одиницю ресурсу', 'Ресурси', { horizontal:true })}
          ${reportBarChart('4.4 Залишки по підрозділах', remainsRows, 'Залишок (од.)', 'Підрозділи', { horizontal:true })}
        </div>
      </section>`;
  }

  function buildRichReportHtml({ forDocx = false } = {}){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const meta = reportMeta();
    const forecasts = forecastScenarios();
    const best = [...forecasts].sort((a,b)=>b.gain-a.gain)[0] || forecasts[0];
    const allocations = data.allocations || fallback.allocations;
    const remains = data.remains || fallback.remains;
    const unitRows = allocations.map(group => {
      const share = data.kits ? Math.round((Number(group.total || 0) / Number(data.kits || 1)) * 1000) / 10 : 0;
      const remain = remains.find(r => r.unit === group.unit)?.total ?? '—';
      return [escapeHtml(group.unit), Number(group.total||0), `${share}%`, remain];
    });
    const elements = [
      [escapeHtml(data.bottleneck), data.remainTotal, 'Критичний'],
      [escapeHtml(minEl.name), minEl.qty, 'Критичний'],
      ['Інші ресурси', '—', 'Контроль']
    ];
    return `<!doctype html><html><head><meta charset="utf-8"><title>BASTION — Висновки</title>${reportCss(forDocx)}</head><body>
      <header class="report-header">
        <div class="report-brand">${reportLogoSvg()}<div><strong>BASTION</strong><span>ВИСНОВКИ</span></div></div>
        <div class="report-header-meta"><span>Дата формування: ${escapeHtml(meta.generated)}</span><span>Користувач: ${escapeHtml(meta.user)}</span></div>
      </header>

      <section class="report-page report-cover">
        <h1>Зміст звіту</h1>
        <div class="report-toc">
          ${tocRow('kpi','01. Загальні KPI',2)}
          ${tocRow('conclusion','02. Висновки',3)}
          ${tocRow('forecast','03. Рекомендації / прогноз',4)}
          ${tocRow('chart','04. Графіки / діаграми',5)}
          ${tocRow('ammo','05. Розподіл боєкомплектів',6)}
          ${tocRow('stock','06. Залишки по підрозділах',7)}
          ${tocRow('element','07. Деталі по елементах',8)}
          ${tocRow('scenario','08. Сценарний аналіз',9)}
          ${tocRow('service','09. Службова інформація',10)}
        </div>
        <footer>BASTION Command System · ${escapeHtml(meta.mode)} · ${escapeHtml(meta.version)}</footer>
      </section>

      <section class="report-section page-break">
        <h2>01. Загальні KPI</h2>
        <div class="report-kpi-grid">
          ${kpiCard('ammo','Сформовано комплектів', data.kits)}
          ${kpiCard('forecast','Максимальна дальність', fmtRange(data.bestRange))}
          ${kpiCard('stock','Залишок складу', data.remainTotal, `${data.remainPercent || 0}% після розрахунку`)}
          ${kpiCard('element','Обмежувальний ресурс', safeText(data.bottleneck))}
          ${kpiCard('service','Враховано підрозділів', allUnits().length)}
        </div>
      </section>

      <section class="report-section page-break">
        <h2>02. Висновки</h2>
        <table class="report-table report-table--icon"><tbody>
          ${tableRows([
            [`${reportIcon('conclusion')} Найбільше отримав`, `<b>${safeText(top.unit)} — ${top.total} комплектів</b>`],
            [`${reportIcon('element')} Найменший запас`, `<b>${safeText(minEl.name)} — ${safeText(minEl.qty)} од. (${safeText(minEl.unit)})</b>`],
            [`${reportIcon('stock')} Найменший залишок по підрозділах`, `<b>${safeText(weak.unit)} — ${weak.total} од.</b>`],
            [`${reportIcon('element')} Обмежувальний ресурс`, `<b>${safeText(data.bottleneck)} (критичний)</b>`],
            [`${reportIcon('forecast')} Максимальна дальність`, `<b>${fmtRange(data.bestRange)}</b>`],
            [`${reportIcon('kpi')} Загальний результат`, `<b>${data.kits} комплектів</b>`]
          ])}
        </tbody></table>
      </section>

      <section class="report-section page-break">
        <h2>03. Рекомендації / прогноз</h2>
        <table class="report-table"><thead><tr><th>Поповнення ${safeText(data.bottleneck)}</th><th>Прогноз комплектів</th><th>Приріст</th><th>Приріст %</th></tr></thead><tbody>
          ${forecasts.map(x => `<tr><td>+${x.add} од.</td><td><b>${x.projected}</b></td><td class="good">+${x.gain}</td><td class="good">+${data.kits ? Math.round((x.gain / data.kits) * 10000)/100 : 0}%</td></tr>`).join('')}
        </tbody></table>
        <div class="report-callout">${reportIcon('forecast')}<div><span>Найкращий сценарій</span><strong>+${best.add} ${safeText(best.element)}</strong><p>Дає +${best.gain} комплектів при прогнозному результаті ${best.projected}.</p></div></div>
      </section>

      ${reportChartBlocks()}

      <section class="report-section page-break"><h2>05. Розподіл боєкомплектів</h2><table class="report-table"><thead><tr><th>Підрозділ</th><th>Сформовано</th><th>Частка</th><th>Залишок</th></tr></thead><tbody>${tableRows(unitRows)}</tbody></table>${reportDonutChart('Структура розподілу комплектів', allocations.map(g=>({label:g.unit,value:g.total})))}</section>
      <section class="report-section page-break"><h2>06. Залишки по підрозділах</h2><table class="report-table"><thead><tr><th>Підрозділ</th><th>Залишок</th><th>Оцінка</th></tr></thead><tbody>${tableRows(remains.map(g=>[safeText(g.unit), g.total, Number(g.total) <= 300 ? '<b class="bad">Низький</b>' : '<b>Контроль</b>']))}</tbody></table></section>
      <section class="report-section page-break"><h2>07. Деталі по елементах</h2><table class="report-table"><thead><tr><th>Елемент</th><th>Залишок</th><th>Статус</th></tr></thead><tbody>${tableRows(elements.map(r=>[r[0],r[1],`<b class="${r[2] === 'Критичний' ? 'bad' : ''}">${r[2]}</b>`]))}</tbody></table></section>
      <section class="report-section page-break"><h2>08. Сценарний аналіз</h2><table class="report-table"><thead><tr><th>Сценарій</th><th>Комплекти</th><th>Дальність</th><th>Коментар</th></tr></thead><tbody>${tableRows(forecasts.map(x=>[`+${x.add} ${safeText(x.element)}`, x.projected, fmtRange(data.bestRange), `Приріст +${x.gain}`]))}</tbody></table></section>
      <section class="report-section page-break"><h2>09. Службова інформація</h2><table class="report-table"><tbody>${tableRows([['Дата формування', escapeHtml(meta.generated)], ['Користувач', escapeHtml(meta.user)], ['Режим розрахунку', escapeHtml(meta.mode)], ['Версія алгоритму', escapeHtml(meta.version)], ['Джерело даних', 'localStorage / analysis result'], ['Формати експорту', 'PDF / DOCX']])}</tbody></table></section>
      <script>${forDocx ? '' : 'window.onload=()=>setTimeout(()=>window.print(),350);'}<\/script>
    </body></html>`;
  }

  function reportCss(forDocx){
    return `<style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#151515;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.35}.report-header{height:84px;background:#0b0d12;color:#fff;border:2px solid #d71920;margin:0 0 18px 0;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid}.report-brand{display:flex;align-items:center;gap:16px}.report-logo-mark{width:48px;height:48px}.report-brand strong{display:block;font-size:30px;letter-spacing:2px}.report-brand span{display:block;color:#ed1c24;font-size:20px;font-weight:900;letter-spacing:1px}.report-header-meta{display:flex;flex-direction:column;gap:4px;color:#e8e8e8;font-size:11px}.report-page,.report-section{padding:0 8px 14px 8px;page-break-inside:avoid}.page-break{break-before:page;page-break-before:always}h1,h2{color:#d71920;text-transform:uppercase;letter-spacing:.6px;margin:0 0 16px 0}h1{font-size:26px}h2{font-size:22px}.report-toc{display:grid;gap:12px;max-width:520px;margin-top:22px}.report-toc-row{display:grid;grid-template-columns:30px 1fr 28px;align-items:center;gap:12px;padding:9px 10px;border-bottom:1px solid #e5e5e5}.report-toc-row b{color:#d71920}.report-icon{width:22px;height:22px;color:#111}.report-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.report-kpi-card{border:1px solid #d8d8d8;border-radius:8px;padding:15px;display:flex;gap:14px;align-items:center;min-height:92px}.report-kpi-card .report-icon{width:34px;height:34px}.report-kpi-card span{display:block;font-size:11px;font-weight:900;text-transform:uppercase}.report-kpi-card strong{display:block;color:#d71920;font-size:28px;margin-top:4px}.report-kpi-card small{display:block;font-weight:700}.report-table{width:100%;border-collapse:collapse;margin:6px 0 16px 0}.report-table th,.report-table td{border:1px solid #ddd;padding:10px 12px;vertical-align:middle}.report-table th{background:#f3f3f3;text-transform:uppercase;font-size:11px}.report-table b{color:#b71920}.report-table--icon td:first-child{width:48%;font-weight:800}.good{color:#168338!important;font-weight:900}.bad{color:#d71920!important}.report-callout{border:1px solid #f0a0a0;background:#fff4f4;border-radius:8px;padding:16px;display:flex;gap:14px;align-items:center;margin-top:16px}.report-callout .report-icon{width:42px;height:42px;color:#d71920}.report-callout span{display:block;text-transform:uppercase;font-size:11px;font-weight:900;color:#d71920}.report-callout strong{display:block;font-size:24px;color:#d71920}.report-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.report-chart-card{border:1px solid #d7d7d7;border-radius:8px;padding:12px;min-height:245px;page-break-inside:avoid}.report-chart-card h4{margin:0 0 8px 0;font-size:13px}.report-axis-y,.report-axis-x{font-size:10px;font-weight:800;color:#444}.report-axis-x{text-align:center;margin-top:6px}.report-vbar-chart{height:170px;display:flex;align-items:end;gap:22px;border-left:1px solid #bbb;border-bottom:1px solid #bbb;padding:8px 12px 0 18px}.report-vbar{height:100%;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:4px}.report-vbar i{display:block;width:28px;background:linear-gradient(#ed1c24,#ba1118);min-height:4px}.report-vbar strong{font-size:11px}.report-vbar span{font-size:10px;text-align:center}.report-hbar-chart{display:grid;gap:14px;margin-top:16px}.report-hbar-row{display:grid;grid-template-columns:120px 1fr 90px;align-items:center;gap:10px;font-size:11px;font-weight:800}.report-hbar-row i{height:18px;background:#edf0f3;display:block}.report-hbar-row i b{height:100%;background:linear-gradient(90deg,#ed1c24,#b60f16);display:block}.report-line-svg{width:100%;height:155px;border-left:1px solid #bbb;border-bottom:1px solid #bbb}.report-line-svg .grid{stroke:#eee;stroke-width:.8}.report-line-svg .line{fill:none;stroke:#d71920;stroke-width:2.2}.report-line-svg .dot{fill:#d71920}.report-line-labels{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:10px;text-align:center}.report-line-labels b{display:block;color:#d71920}.report-donut-card{max-width:420px;margin-top:16px}.report-donut{width:150px;height:150px;border-radius:50%;margin:12px auto;display:flex;align-items:center;justify-content:center}.report-donut:after{content:"";position:absolute}.report-donut span{background:#fff;border-radius:50%;width:78px;height:78px;display:flex;align-items:center;justify-content:center;font-weight:900}.report-legend{display:grid;gap:6px}.report-legend span{font-size:11px}.report-legend i{display:inline-block;width:10px;height:10px;background:#d71920;margin-right:6px}.report-cover footer{margin-top:320px;color:#555;font-size:11px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.report-header{position:relative}.page-break{break-before:page;page-break-before:always}}${forDocx ? 'svg{display:none}.report-header{background:#111;color:#fff}.page-break{page-break-before:always}' : ''}
    </style>`;
  }

  function exportDoc(){
    const html = buildRichReportHtml({ forDocx:true });
    downloadBlob('bastion-command-report.docx', html, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8');
  }
  function exportPdf(){
    const html = buildRichReportHtml({ forDocx:false });
    const win = window.open('', '_blank');
    if (win){
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      downloadBlob('bastion-command-report.pdf.html', html, 'text/html;charset=utf-8');
    }
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
