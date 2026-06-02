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

  function reportPayload(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const scenarios = forecastScenarios();
    const best = [...scenarios].sort((a,b)=>b.gain-a.gain)[0] || scenarios[0];
    const generated = new Date().toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return { top, weak, minEl, scenarios, best, generated };
  }

  function logoSvg(){
    return `<svg class="report-logo" viewBox="0 0 120 120" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bastionLogoGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff2a2a"/><stop offset="1" stop-color="#b30000"/></linearGradient></defs>
      <path fill="url(#bastionLogoGrad)" d="M21 17 60 39l39-22v23L60 62 21 40V17Zm0 40 39 22 39-22v23l-39 22-39-22V57Zm39-2 39-22v18L60 73 21 51V33l39 22Z"/>
    </svg>`;
  }

  function reportIcon(name){
    const icons = {
      kpi:'M12 3l8 4v10l-8 4-8-4V7l8-4Zm0 3.2L7 8.7v6.6l5 2.5 5-2.5V8.7l-5-2.5Z',
      target:'M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2Zm7.1 1.5-4.3 4.3V11H11v2h5.7l4.3-4.3-2.2-.4.3-4.8Z',
      box:'M4 7l8-4 8 4v10l-8 4-8-4V7Zm8-1.8L7.2 7.6 12 10l4.8-2.4L12 5.2ZM6 9.2v6.5l5 2.5v-6.5L6 9.2Zm12 0-5 2.5v6.5l5-2.5V9.2Z',
      warn:'M12 3 2 21h20L12 3Zm0 5 5.8 11H6.2L12 8Zm-1 3h2v4h-2v-4Zm0 5h2v2h-2v-2Z',
      people:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c.5-4 3-6 5-6s4.5 2 5 6H3Zm8 0c.3-2.5 1.4-4.3 3-5.2.6-.4 1.3-.8 2-.8 2 0 4.5 2 5 6H11Z',
      chart:'M4 19h17v2H2V4h2v15Zm2-2V9h3v8H6Zm5 0V5h3v12h-3Zm5 0v-6h3v6h-3Z',
      star:'M12 2l2.8 6 6.5.8-4.8 4.5 1.3 6.4L12 16.4 6.2 19.7l1.3-6.4-4.8-4.5 6.5-.8L12 2Z',
      table:'M4 4h16v16H4V4Zm2 2v3h12V6H6Zm0 5v3h5v-3H6Zm7 0v3h5v-3h-5Zm-7 5v2h5v-2H6Zm7 0v2h5v-2h-5Z'
    };
    return `<svg class="r-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name] || icons.kpi}"/></svg>`;
  }

  function reportTable(rows, className = ''){
    return `<div class="report-table ${className}">${rows.map(row => `<div class="report-tr">${row.map(cell => `<div class="report-td">${cell}</div>`).join('')}</div>`).join('')}</div>`;
  }

  function reportBarChart(title, rows, xLabel, yLabel){
    const max = Math.max(1, ...rows.map(r=>Number(r.value||0)));
    return `<section class="chart-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="axis-label axis-label--y">Вісь Y: ${escapeHtml(yLabel)}</div>
      <div class="bar-chart">
        ${rows.map(r => {
          const h = Math.max(8, Math.round((Number(r.value||0)/max)*100));
          return `<div class="bar-col"><span class="bar-value">${escapeHtml(r.value)}</span><i style="height:${h}%"></i><b>${escapeHtml(r.label)}</b></div>`;
        }).join('')}
      </div>
      <div class="axis-label axis-label--x">Вісь X: ${escapeHtml(xLabel)}</div>
    </section>`;
  }

  function reportHBarChart(title, rows, xLabel, yLabel){
    const max = Math.max(1, ...rows.map(r=>Number(r.value||0)));
    return `<section class="chart-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="axis-label axis-label--y">Вісь Y: ${escapeHtml(yLabel)}</div>
      <div class="hbar-chart">
        ${rows.map(r => {
          const w = Math.max(4, Math.round((Number(r.value||0)/max)*100));
          return `<div class="hbar-row"><b>${escapeHtml(r.label)}</b><span><i style="width:${w}%"></i></span><em>${escapeHtml(r.display ?? r.value)}</em></div>`;
        }).join('')}
      </div>
      <div class="axis-label axis-label--x">Вісь X: ${escapeHtml(xLabel)}</div>
    </section>`;
  }

  function reportLineChart(title, points, xLabel, yLabel){
    const values = points.map(p=>Number(p.value||0));
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(1, max-min);
    const coords = points.map((p, idx)=>{
      const x = 8 + idx * (84 / Math.max(1, points.length - 1));
      const y = 82 - ((Number(p.value||0)-min)/span)*62;
      return { ...p, x, y };
    });
    return `<section class="chart-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="axis-label axis-label--y">Вісь Y: ${escapeHtml(yLabel)}</div>
      <svg class="report-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M8 82H96 M8 51H96 M8 20H96" class="grid"/>
        <polyline points="${coords.map(p=>`${p.x},${p.y}`).join(' ')}" class="line"/>
        ${coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2.3" class="dot"/>`).join('')}
      </svg>
      <div class="line-labels">${coords.map(p=>`<span>${escapeHtml(p.label)}<b>${escapeHtml(p.value)}</b></span>`).join('')}</div>
      <div class="axis-label axis-label--x">Вісь X: ${escapeHtml(xLabel)}</div>
    </section>`;
  }

  function buildRichReportHtml(){
    const payload = reportPayload();
    const units = allUnits();
    const allocations = data.allocations && data.allocations.length ? data.allocations : fallback.allocations;
    const remains = data.remains && data.remains.length ? data.remains : fallback.remains;
    const impact = recommendationRows().map(row => {
      const value = Number(String(row.value).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/)?.[0] || 0);
      return { label: row.name, value, display: row.value };
    });
    const forecastPoints = [{ label:'Поточний', value:data.kits }, ...payload.scenarios.map(x=>({ label:`+${x.add}`, value:x.projected }))];
    const reportCss = `
      @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9e9e9;font-family:Arial,Helvetica,sans-serif;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:210mm;min-height:297mm;margin:0 auto 10mm;background:#fff;padding:0 14mm 12mm;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}.report-header{height:31mm;margin:0 -14mm 8mm;padding:0 14mm;background:#08090d;color:#fff;border-bottom:3px solid #d71920;display:flex;align-items:center;gap:14px;position:relative}.report-header:after{content:"";position:absolute;right:0;top:0;width:48mm;height:31mm;background:repeating-linear-gradient(150deg,rgba(215,25,32,.38) 0 1px,transparent 1px 7px);clip-path:polygon(25% 0,100% 0,100% 100%,0 100%);opacity:.45}.report-logo{width:18mm;height:18mm;flex:0 0 auto}.report-brand{display:flex;flex-direction:column;line-height:.95}.report-brand strong{font-size:22pt;letter-spacing:1px}.report-brand span{font-size:11pt;color:#ff2028;font-weight:900;letter-spacing:.8px}.report-title{margin-left:auto;margin-right:55mm;font-size:24pt;font-weight:900;letter-spacing:1px;text-transform:uppercase}.cover .report-title{font-size:28pt}.section-title{display:flex;align-items:center;gap:8px;color:#d71920;font-size:17pt;margin:0 0 6mm;font-weight:900;text-transform:uppercase}.r-icon{width:20px;height:20px;fill:currentColor;flex:0 0 auto}.toc-row{display:grid;grid-template-columns:26px 1fr 24px;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:800}.toc-row svg{color:#111}.toc-row em{font-style:normal;color:#d71920;text-align:right}.meta-grid{display:grid;grid-template-columns:35mm 1fr;gap:6px 12px;margin:10mm 0 8mm;font-weight:700}.meta-grid b{color:#6b7280}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.kpi-card{border:1px solid #d9dce2;border-radius:8px;padding:6mm;background:linear-gradient(180deg,#fff,#fafafa);min-height:33mm}.kpi-card .r-icon{width:24px;height:24px;margin-bottom:4mm;color:#111}.kpi-card span{display:block;font-size:9pt;text-transform:uppercase;font-weight:900}.kpi-card strong{display:block;font-size:23pt;color:#d71920;margin-top:2mm}.kpi-card small{display:block;font-weight:800;color:#3b3f46}.info-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:6mm}.list-card,.accent-card,.chart-card,.report-table{border:1px solid #d9dce2;border-radius:8px;background:#fff;overflow:hidden}.list-row{display:grid;grid-template-columns:26px 1fr 1.15fr;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:800}.list-row:last-child{border-bottom:0}.list-row strong{color:#d71920;font-size:12pt}.accent-card{padding:6mm;border-color:#ffb7b7;background:#fff7f7}.accent-card h3{margin:0 0 4mm;color:#d71920;font-size:12pt}.accent-card p{margin:0 0 4mm;line-height:1.4}.accent-card strong{color:#d71920;font-size:18pt}.forecast-table .report-tr{grid-template-columns:1fr 1fr .8fr .8fr}.report-tr{display:grid;grid-template-columns:1fr 1.1fr;border-bottom:1px solid #e5e7eb}.report-tr:first-child{background:#f5f6f8;font-weight:900}.report-tr:last-child{border-bottom:0}.report-td{padding:10px 12px;border-right:1px solid #e5e7eb;font-weight:700}.report-td:last-child{border-right:0}.report-td strong,.green{color:#168a3a}.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.chart-card{padding:5mm;min-height:84mm}.chart-card h4{margin:0 0 4mm;font-size:10pt}.axis-label{font-size:8pt;color:#6b7280;font-weight:800;margin:2mm 0}.bar-chart{height:45mm;display:flex;align-items:flex-end;gap:12px;border-left:1px solid #c9ced6;border-bottom:1px solid #c9ced6;padding:5mm 5mm 0}.bar-col{flex:1;text-align:center;position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end}.bar-col i{display:block;background:#d71920;border-radius:2px 2px 0 0}.bar-col b{font-size:7.5pt;margin-top:4px}.bar-value{font-size:8pt;font-weight:900;margin-bottom:2px}.hbar-chart{display:flex;flex-direction:column;gap:9px;margin-top:4mm}.hbar-row{display:grid;grid-template-columns:28mm 1fr 28mm;gap:8px;align-items:center;font-size:8pt}.hbar-row span{height:10px;background:#eceff3;display:block}.hbar-row i{height:100%;display:block;background:#d71920}.hbar-row em{font-style:normal;font-weight:900;text-align:right}.report-line{width:100%;height:48mm;border-left:1px solid #c9ced6;border-bottom:1px solid #c9ced6}.report-line .grid{stroke:#e5e7eb;stroke-width:.5}.report-line .line{fill:none;stroke:#d71920;stroke-width:2.4;vector-effect:non-scaling-stroke}.report-line .dot{fill:#d71920}.line-labels{display:flex;justify-content:space-between;font-size:8pt;font-weight:800}.line-labels b{display:block;color:#d71920;text-align:center}.footer{position:absolute;left:14mm;right:14mm;bottom:5mm;display:flex;justify-content:space-between;font-size:8pt;color:#4b5563}.chip-wrap{display:flex;flex-wrap:wrap;gap:5px}.chip{border:1px solid #d71920;color:#d71920;border-radius:999px;padding:4px 8px;font-size:8pt;font-weight:900}.summary-box{border:1px solid #ffb7b7;border-radius:8px;background:#fff7f7;padding:6mm;margin-top:6mm}.summary-box h3{margin:0 0 3mm;color:#d71920}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.note{font-size:9pt;line-height:1.45;color:#374151}.page-break{break-before:page}`;

    const header = (title) => `<header class="report-header">${logoSvg()}<div class="report-brand"><strong>BASTION</strong><span>ВИСНОВКИ</span></div><div class="report-title">${escapeHtml(title)}</div></header>`;
    const footer = (n, total=8) => `<footer class="footer"><span>BASTION Command System</span><span>Дата формування: ${escapeHtml(payload.generated)}</span><span>Сторінка ${n} з ${total}</span></footer>`;
    const toc = [
      ['kpi','01. Загальні KPI','2'],['target','02. Висновки','3'],['star','03. Рекомендації / прогноз','4'],['chart','04. Графіки / діаграми','5'],['table','05. Розподіл боєкомплектів','6'],['people','06. Залишки по підрозділах','6'],['box','07. Деталі по елементах','7'],['target','08. Сценарний аналіз','8']
    ].map(([ic, label, n]) => `<div class="toc-row">${reportIcon(ic)}<span>${label}</span><em>${n}</em></div>`).join('');

    const kpis = [
      ['kpi','Сформовано комплектів', data.kits, 'загальний результат'],
      ['target','Максимальна дальність', fmtRange(data.bestRange), 'активний рецепт'],
      ['box','Залишок складу', data.remainTotal, `${data.remainPercent || 0}% після розрахунку`],
      ['warn','Обмежувальний елемент', data.bottleneck, 'критичний ресурс'],
      ['people','Враховано підрозділів', units.length, units.join(', ')],
      ['chart','Готовність', `${readiness()}%`, 'розрахункова оцінка']
    ].map(([ic,l,v,s])=>`<article class="kpi-card">${reportIcon(ic)}<span>${escapeHtml(l)}</span><strong>${escapeHtml(v)}</strong><small>${escapeHtml(s)}</small></article>`).join('');

    const conclusionRows = [
      ['target','Найбільше отримав', `${payload.top.unit} — ${payload.top.total} комплектів`],
      ['box','Найменший запас', `${payload.minEl.name} — ${payload.minEl.qty} од. (${payload.minEl.unit})`],
      ['people','Найменший залишок по підрозділах', `${payload.weak.unit} — ${payload.weak.total} од.`],
      ['warn','Обмежувальний ресурс', `${data.bottleneck} (критичний)`],
      ['target','Максимальна дальність', fmtRange(data.bestRange)],
      ['kpi','Загальний результат', `${data.kits} комплектів`]
    ].map(([ic,l,v])=>`<div class="list-row">${reportIcon(ic)}<span>${escapeHtml(l)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');

    const forecastRows = [['Поповнення','Прогноз комплектів','Приріст','Приріст %'], ...payload.scenarios.map(x=>[
      `+${x.add} ${x.element}`, String(x.projected), `<strong>+${x.gain}</strong>`, `<strong>+${((x.gain/Math.max(1,data.kits))*100).toFixed(2).replace('.', ',')}%</strong>`
    ])];

    const allocationRows = [['Підрозділ','Сформовано комплектів','Частка'], ...allocations.map(g=>[
      safeText(g.unit), String(g.total), `${((Number(g.total||0)/Math.max(1,data.kits))*100).toFixed(1).replace('.', ',')}%`
    ])];
    const remainTable = [['Підрозділ','Залишок','Оцінка'], ...remains.map(g=>[safeText(g.unit), String(g.total), Number(g.total) <= payload.weak.total ? 'Контроль' : 'Норма'])];
    const elementTable = [['Елемент','Залишок','Статус'], [safeText(data.bottleneck), String(data.remainTotal), 'Критичний'], [safeText(payload.minEl.name), String(payload.minEl.qty), 'Критичний'], ['Інші ресурси','—','Контроль']];
    const scenarioTable = [['Сценарій','Комплекти','Дальність','Коментар'], ...payload.scenarios.map(x=>[`+${x.add} ${x.element}`, String(x.projected), fmtRange(data.bestRange), `Приріст +${x.gain}`])];

    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>BASTION — Висновки</title><style>${reportCss}</style></head><body>
      <section class="page cover">${header('ВИСНОВКИ')}
        <div class="meta-grid"><b>Дата формування:</b><span>${escapeHtml(payload.generated)}</span><b>Користувач:</b><span>${escapeHtml(localStorage.getItem('bastion.login') || 'Командир')}</span><b>Режим розрахунку:</b><span>${escapeHtml(data.mode || 'Загальний розрахунок')}</span><b>Версія алгоритму:</b><span>v1.4.0</span></div>
        <h2 class="section-title">Зміст звіту</h2>${toc}${footer(1)}</section>
      <section class="page">${header('01. Загальні KPI')}<h2 class="section-title">${reportIcon('kpi')}01. Загальні KPI</h2><div class="kpi-grid">${kpis}</div>${footer(2)}</section>
      <section class="page">${header('02. Висновки')}<h2 class="section-title">${reportIcon('target')}02. Висновки</h2><div class="info-grid"><div class="list-card">${conclusionRows}</div><aside class="accent-card"><h3>Ключовий висновок</h3><p>Поточний результат обмежується критичним дефіцитом <b>${escapeHtml(data.bottleneck)}</b>. Найбільший прогнозований приріст дає поповнення обмежувального елемента.</p><hr><p>${reportIcon('star')} <strong>+${payload.best.add} ${escapeHtml(payload.best.element)}</strong><br>дає +${payload.best.gain} комплектів.</p></aside></div>${footer(3)}</section>
      <section class="page">${header('03. Рекомендації / прогноз')}<h2 class="section-title">${reportIcon('star')}03. Рекомендації / прогноз</h2>${reportTable(forecastRows,'forecast-table')}<div class="summary-box"><h3>Найкращий сценарій</h3><p><strong>+${payload.best.add} ${escapeHtml(payload.best.element)}</strong> → ${payload.best.projected} комплектів · приріст +${payload.best.gain}</p></div><h3 class="section-title" style="font-size:12pt;margin-top:8mm">Ефективність поповнення ресурсів</h3>${reportTable([['Ресурс','Ефективність'], ...recommendationRows().map(r=>[safeText(r.name), safeText(r.value)])])}${footer(4)}</section>
      <section class="page">${header('04. Графіки / діаграми')}<h2 class="section-title">${reportIcon('chart')}04. Графіки / діаграми</h2><div class="chart-grid">${reportBarChart('4.1 Розподіл комплектів по підрозділах', allocations.map(g=>({label:g.unit,value:g.total})), 'Підрозділи', 'Комплекти (од.)')}${reportLineChart('4.2 Прогноз приросту від поповнення', forecastPoints, 'Поповнення (од.)', 'Комплекти (од.)')}${reportHBarChart('4.3 Ефективність поповнення ресурсів', impact, 'Комплекти на 1 одиницю ресурсу', 'Ресурси')}${reportHBarChart('4.4 Залишки по підрозділах', remains.map(g=>({label:g.unit,value:g.total})), 'Залишок (од.)', 'Підрозділи')}</div>${footer(5)}</section>
      <section class="page">${header('05–06. Розподіл і залишки')}<div class="two-col"><div><h2 class="section-title">${reportIcon('table')}05. Розподіл боєкомплектів</h2>${reportTable(allocationRows)}</div><div><h2 class="section-title">${reportIcon('people')}06. Залишки по підрозділах</h2>${reportTable(remainTable)}<div class="summary-box"><h3>Враховано підрозділів</h3><div class="chip-wrap">${units.map(u=>`<span class="chip">${escapeHtml(u)}</span>`).join('')}</div></div></div></div>${footer(6)}</section>
      <section class="page">${header('07. Деталі по елементах')}<h2 class="section-title">${reportIcon('box')}07. Деталі по елементах</h2>${reportTable(elementTable)}<div class="summary-box"><h3>Структура контролю</h3><p class="note">Обмежувальний ресурс і найменший запас винесені окремо, оскільки саме вони формують головну зону контролю після розрахунку.</p></div>${footer(7)}</section>
      <section class="page">${header('08. Сценарний аналіз')}<h2 class="section-title">${reportIcon('target')}08. Сценарний аналіз</h2>${reportTable(scenarioTable)}<div class="summary-box"><h3>Підсумок</h3><p class="note">Поточний режим забезпечує ${data.kits} комплектів при максимальній дальності ${fmtRange(data.bestRange)}. Для різкого збільшення комплектів найбільший прогнозований ефект дає поповнення ${escapeHtml(data.bottleneck)}.</p></div><h2 class="section-title" style="margin-top:8mm">09. Службова інформація</h2>${reportTable([['Параметр','Значення'],['Дата формування', payload.generated],['Джерело даних','localStorage / analysis result'],['Алгоритм','BASTION command forecast'],['Формати експорту','PDF / DOCX']])}${footer(8)}</section>
    </body></html>`;
  }

  function printHtmlReport(html){
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    frame.onload = () => {
      setTimeout(() => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        finally { setTimeout(() => frame.remove(), 1200); }
      }, 350);
    };
    frame.srcdoc = html;
  }

  function exportDoc(){
    const html = buildRichReportHtml();
    downloadBlob('bastion-command-report.docx', html, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8');
  }
  function exportPdf(){
    const html = buildRichReportHtml();
    printHtmlReport(html);
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
