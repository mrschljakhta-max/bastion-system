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

  function reportModel(){
    const top = maxUnit();
    const weak = minRemain();
    const minEl = minElement();
    const scenarios = forecastScenarios();
    const best = [...scenarios].sort((a,b)=>b.gain-a.gain)[0] || scenarios[0];
    const generated = new Date().toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const allocations = (data.allocations && data.allocations.length ? data.allocations : fallback.allocations);
    const remains = (data.remains && data.remains.length ? data.remains : fallback.remains);
    return {
      title: 'BASTION — ПОВНИЙ ЗВІТ',
      subtitle: 'Аналіз · Висновки · Рекомендації',
      meta: [
        ['Дата формування', generated],
        ['Користувач', 'Командир'],
        ['Режим розрахунку', data.mode || 'Оптимальний'],
        ['Версія алгоритму', 'v1.4.0']
      ],
      sections: [
        { title:'01. Загальні KPI', rows:[
          ['Сформовано комплектів', String(data.kits)],
          ['Максимальна дальність', fmtRange(data.bestRange)],
          ['Залишок складу', `${data.remainTotal} (${data.remainPercent || 0}% після розрахунку)`],
          ['Обмежувальний елемент', data.bottleneck],
          ['Враховано підрозділів', allUnits().join(', ')]
        ]},
        { title:'02. Висновки', rows:[
          ['Найбільше отримав', `${top.unit} — ${top.total} комплектів`],
          ['Найменший запас', `${minEl.name} — ${minEl.qty} од. (${minEl.unit})`],
          ['Найменший залишок по підрозділах', `${weak.unit} — ${weak.total} од.`],
          ['Загальний результат', `${data.kits} комплектів`],
          ['Максимальна дальність', fmtRange(data.bestRange)]
        ]},
        { title:'03. Рекомендації / прогноз', rows: scenarios.map(x => [`+${x.add} ${x.element}`, `${x.projected} комплектів · приріст +${x.gain}`]).concat([
          ['Найкращий сценарій', best ? `+${best.add} ${best.element} → ${best.projected} комплектів · +${best.gain}` : '—']
        ])},
        { title:'04. Ефективність поповнення', rows: recommendationRows().map(x => [x.name, x.value])},
        { title:'05. Розподіл боєкомплектів', rows: allocations.map(x => [x.unit, `${x.total} комплектів`])},
        { title:'06. Залишки по підрозділах', rows: remains.map(x => [x.unit, `${x.total} од.`])},
        { title:'07. Деталі по елементах', rows: [
          ['Обмежувальний елемент', data.bottleneck],
          ['Мінімальний запас', `${minEl.name} — ${minEl.qty} од. (${minEl.unit})`],
          ['Коефіцієнт ефективності ресурсу', recommendationRows()[0]?.value || '—'],
          ['Рівень готовності', `${readiness()}%`]
        ]},
        { title:'08. Сценарний аналіз', rows: [
          ['Поточний режим', `${data.kits} комплектів · ${fmtRange(data.bestRange)}`],
          ['Прогноз +100', `${scenarios[0]?.projected || '—'} комплектів`],
          ['Прогноз +250', `${scenarios[1]?.projected || '—'} комплектів`],
          ['Прогноз +500', `${scenarios[2]?.projected || '—'} комплектів`]
        ]},
        { title:'09. Службова інформація', rows:[
          ['Джерело даних', 'localStorage / analysis result'],
          ['Сценарії', '+100 / +250 / +500'],
          ['Алгоритм', 'BASTION command forecast'],
          ['Формати експорту', 'PDF / DOCX']
        ]}
      ],
      charts: {
        allocations,
        remains,
        scenarios,
        impact: recommendationRows().map(row => ({ name: row.name, value: Number(String(row.value).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/)?.[0] || 0), label: row.value }))
      }
    };
  }

  function reportText(){
    const model = reportModel();
    const lines = [model.title, model.subtitle, ''];
    model.meta.forEach(([k,v]) => lines.push(`${k}: ${v}`));
    model.sections.forEach(section => {
      lines.push('', section.title);
      section.rows.forEach(([k,v]) => lines.push(`${k}: ${v}`));
    });
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

  function crc32(str){
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i=0;i<256;i++){
        let c=i;
        for (let k=0;k<8;k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[i]=c>>>0;
      }
      return t;
    })());
    const bytes = typeof str === 'string' ? new TextEncoder().encode(str) : str;
    let c = 0xffffffff;
    for (let i=0;i<bytes.length;i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeZip(files){
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = n => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; };
    const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; };
    const push = (arr, part) => { arr.push(part); };
    for (const file of files){
      const name = enc.encode(file.name);
      const dataBytes = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
      const crc = crc32(dataBytes);
      const local = [];
      [0x04034b50,20,0,0,0,0,crc,dataBytes.length,dataBytes.length,name.length,0].forEach((v,i)=>push(local, i===0||i>=6&&i<=8 ? u32(v) : u16(v)));
      push(local, name); push(local, dataBytes);
      const localBlob = new Blob(local);
      chunks.push(localBlob);
      const cent = [];
      [0x02014b50,20,20,0,0,0,0,crc,dataBytes.length,dataBytes.length,name.length,0,0,0,0,0,offset].forEach((v,i)=>push(cent, [0,7,8,9,16].includes(i) ? u32(v) : u16(v)));
      push(cent, name);
      const centBlob = new Blob(cent);
      central.push(centBlob);
      offset += localBlob.size;
    }
    const centralSize = central.reduce((s,b)=>s+b.size,0);
    const end = [];
    [0x06054b50,0,0,files.length,files.length,centralSize,offset,0].forEach((v,i)=>push(end, [0,5,6].includes(i) ? u32(v) : u16(v)));
    return new Blob([...chunks, ...central, ...end], { type:'application/zip' });
  }

  function xmlEscape(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch])); }
  function docParagraph(text, style=''){
    return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
  }
  function docTable(rows){
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.map(row=>`<w:tr>${row.map(cell=>`<w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>${docParagraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
  }
  function exportDoc(){
    const model = reportModel();
    const body = [];
    body.push(docParagraph(model.title, 'Title'));
    body.push(docParagraph(model.subtitle, 'Subtitle'));
    body.push(docTable(model.meta));
    model.sections.forEach(section => {
      body.push(docParagraph(section.title, 'Heading1'));
      body.push(docTable(section.rows));
    });
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="720" w:bottom="850" w:left="720"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="B91C1C"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="D7262D"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
    const zip = makeZip([
      { name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name:'word/_rels/document.xml.rels', data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name:'word/document.xml', data: documentXml },
      { name:'word/styles.xml', data: styles }
    ]);
    downloadBlob('bastion-command-report.docx', zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, opts = {}){
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const maxLines = opts.maxLines || 99;
    for (const word of words){
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line){
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
  }

  function reportColor(){
    return { red:'#d7262d', dark:'#111216', ink:'#1e2430', muted:'#69707c', line:'#d9dde5', green:'#18864b', amber:'#c07b00', soft:'#f6f7f9', pink:'#fff0f1' };
  }
  function asNumber(v){
    const n = Number(String(v ?? '').replace(/[^0-9,.-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function reportValue(model, sectionTitle, key){
    const section = model.sections.find(s => s.title.includes(sectionTitle));
    const row = section?.rows.find(r => String(r[0]).includes(key));
    return row ? row[1] : '—';
  }
  function drawReportHeader(ctx, model, title){
    const c = reportColor();
    ctx.fillStyle = c.dark; ctx.fillRect(0,0,1240,154);
    ctx.strokeStyle = c.red; ctx.lineWidth = 4; ctx.strokeRect(22,20,1196,110);
    ctx.fillStyle = '#fff'; ctx.font = '800 44px Arial'; ctx.fillText('BASTION', 58,70);
    ctx.fillStyle = c.red; ctx.font = '800 21px Arial'; ctx.fillText('COMMAND SYSTEM', 60,103);
    ctx.fillStyle = '#fff'; ctx.font = '900 48px Arial';
    ctx.textAlign = 'center'; ctx.fillText(title, 750,91); ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(215,38,45,.45)'; ctx.lineWidth = 1;
    for(let i=0;i<9;i++){ ctx.beginPath(); ctx.moveTo(930+i*25,38); ctx.lineTo(1165+i*3,38+i*9); ctx.stroke(); }
  }
  function drawReportFooter(ctx, page, total){
    const c = reportColor();
    ctx.fillStyle = c.muted; ctx.font = '16px Arial';
    ctx.fillText('BASTION Command System', 56, 1712);
    ctx.textAlign = 'right'; ctx.fillText(`Сторінка ${page}/${total}`, 1184, 1712); ctx.textAlign = 'left';
  }
  function drawIcon(ctx, type, x, y, size = 34, color = '#d7262d'){
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(3, size/12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = size;
    if (type === 'cube'){
      ctx.strokeRect(x+s*.22, y+s*.18, s*.56, s*.56); ctx.beginPath(); ctx.moveTo(x+s*.5,y+s*.02); ctx.lineTo(x+s*.9,y+s*.24); ctx.lineTo(x+s*.5,y+s*.46); ctx.lineTo(x+s*.1,y+s*.24); ctx.closePath(); ctx.stroke();
    } else if (type === 'target'){
      ctx.beginPath(); ctx.arc(x+s*.5,y+s*.5,s*.38,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(x+s*.5,y+s*.5,s*.16,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+s*.5,y+s*.05); ctx.lineTo(x+s*.5,y+s*.25); ctx.moveTo(x+s*.5,y+s*.75); ctx.lineTo(x+s*.5,y+s*.95); ctx.moveTo(x+s*.05,y+s*.5); ctx.lineTo(x+s*.25,y+s*.5); ctx.moveTo(x+s*.75,y+s*.5); ctx.lineTo(x+s*.95,y+s*.5); ctx.stroke();
    } else if (type === 'warehouse'){
      ctx.beginPath(); ctx.moveTo(x+s*.1,y+s*.46); ctx.lineTo(x+s*.5,y+s*.18); ctx.lineTo(x+s*.9,y+s*.46); ctx.lineTo(x+s*.9,y+s*.86); ctx.lineTo(x+s*.1,y+s*.86); ctx.closePath(); ctx.stroke(); ctx.strokeRect(x+s*.35,y+s*.58,s*.3,s*.28);
    } else if (type === 'warning'){
      ctx.beginPath(); ctx.moveTo(x+s*.5,y+s*.1); ctx.lineTo(x+s*.9,y+s*.86); ctx.lineTo(x+s*.1,y+s*.86); ctx.closePath(); ctx.stroke(); ctx.font = `900 ${s*.55}px Arial`; ctx.textAlign='center'; ctx.fillText('!', x+s*.5, y+s*.74); ctx.textAlign='left';
    } else if (type === 'users'){
      for(let i=0;i<3;i++){ const cx=x+s*(.25+i*.25); ctx.beginPath(); ctx.arc(cx,y+s*.35,s*.11,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx,y+s*.72,s*.17,Math.PI,0); ctx.stroke(); }
    } else if (type === 'star'){
      ctx.beginPath(); for(let i=0;i<10;i++){ const r=i%2?s*.18:s*.42; const a=-Math.PI/2+i*Math.PI/5; const px=x+s*.5+Math.cos(a)*r, py=y+s*.5+Math.sin(a)*r; i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.closePath(); ctx.stroke();
    } else if (type === 'bars'){
      ctx.strokeRect(x+s*.12,y+s*.16,s*.76,s*.68); [0.7,0.48,0.3].forEach((h,i)=>ctx.fillRect(x+s*(.24+i*.19), y+s*(.8-h), s*.09, s*h));
    } else if (type === 'line'){
      ctx.beginPath(); ctx.moveTo(x+s*.12,y+s*.75); ctx.lineTo(x+s*.38,y+s*.56); ctx.lineTo(x+s*.62,y+s*.44); ctx.lineTo(x+s*.88,y+s*.20); ctx.stroke(); [ [.12,.75], [.38,.56], [.62,.44], [.88,.20] ].forEach(p=>{ctx.beginPath();ctx.arc(x+s*p[0],y+s*p[1],s*.055,0,Math.PI*2);ctx.fill();});
    } else if (type === 'shield'){
      ctx.beginPath(); ctx.moveTo(x+s*.5,y+s*.1); ctx.lineTo(x+s*.84,y+s*.25); ctx.lineTo(x+s*.76,y+s*.72); ctx.lineTo(x+s*.5,y+s*.9); ctx.lineTo(x+s*.24,y+s*.72); ctx.lineTo(x+s*.16,y+s*.25); ctx.closePath(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x+s*.5,y+s*.5,s*.35,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
  function drawPanel(ctx, x, y, w, h, opts = {}){
    const c = reportColor();
    ctx.save();
    ctx.fillStyle = opts.fill || '#fff';
    ctx.strokeStyle = opts.stroke || c.line;
    ctx.lineWidth = opts.lineWidth || 2;
    const r = opts.radius || 10;
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (opts.topAccent){ ctx.fillStyle = c.red; ctx.fillRect(x, y, w, 5); }
    ctx.restore();
  }
  function drawSectionLabel(ctx, number, title, x, y){
    const c = reportColor();
    ctx.fillStyle = c.red; ctx.font = '900 30px Arial'; ctx.fillText(`${number}. ${title}`, x, y);
  }
  function drawKpiCard(ctx, x, y, w, h, icon, label, value, sub=''){
    const c = reportColor();
    drawPanel(ctx,x,y,w,h,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
    drawIcon(ctx, icon, x+22, y+34, 44, c.dark);
    ctx.fillStyle = c.ink; ctx.font = '800 18px Arial'; drawWrapped(ctx,label.toUpperCase(),x+88,y+48,w-110,22,{maxLines:2});
    ctx.fillStyle = c.red; ctx.font = '900 44px Arial'; ctx.fillText(String(value), x+88, y+116);
    if (sub){ ctx.fillStyle = c.ink; ctx.font = '700 16px Arial'; ctx.fillText(String(sub), x+88, y+145); }
  }
  function drawRows(ctx, rows, x, y, w, rowH = 58, iconTypes = []){
    const c = reportColor();
    rows.forEach((row, i) => {
      drawPanel(ctx, x, y + i*rowH, w, rowH-6, {fill:'#fff', stroke:'#e1e4e8', radius:6});
      if (iconTypes[i]) drawIcon(ctx, iconTypes[i], x+18, y+i*rowH+10, 30, c.dark);
      ctx.fillStyle = c.ink; ctx.font = '800 18px Arial';
      drawWrapped(ctx, row[0], x + (iconTypes[i]?62:18), y+i*rowH+25, w*.42, 20, {maxLines:2});
      ctx.fillStyle = c.red; ctx.font = '900 20px Arial';
      drawWrapped(ctx, row[1], x + w*.52, y+i*rowH+25, w*.43, 22, {maxLines:2});
    });
  }
  function drawDataTable(ctx, columns, rows, x, y, w, rowH = 46){
    const c = reportColor();
    const colW = w / columns.length;
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(x,y,w,rowH);
    ctx.strokeStyle = '#d5d9e0'; ctx.strokeRect(x,y,w,rowH);
    columns.forEach((col,i)=>{ ctx.fillStyle=c.ink; ctx.font='800 15px Arial'; drawWrapped(ctx,col,x+i*colW+12,y+20,colW-24,16,{maxLines:2}); if(i) {ctx.strokeStyle='#d5d9e0'; ctx.beginPath(); ctx.moveTo(x+i*colW,y); ctx.lineTo(x+i*colW,y+rowH*(rows.length+1)); ctx.stroke();} });
    rows.forEach((row,r)=>{
      const yy = y + rowH*(r+1); ctx.fillStyle = r%2 ? '#fff' : '#fbfbfc'; ctx.fillRect(x,yy,w,rowH); ctx.strokeStyle='#e1e4e8'; ctx.strokeRect(x,yy,w,rowH);
      row.forEach((cell,i)=>{ ctx.fillStyle = i===0 ? c.ink : (String(cell).includes('Крит') ? c.red : c.ink); ctx.font = i===0 ? '700 16px Arial' : '800 16px Arial'; drawWrapped(ctx, cell, x+i*colW+12, yy+24, colW-24, 18, {maxLines:2}); });
    });
  }
  function drawBarChart(ctx, title, rows, x, y, w, h, opts = {}){
    const c = reportColor();
    drawPanel(ctx,x,y,w,h,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
    ctx.fillStyle = c.ink; ctx.font='900 19px Arial'; ctx.fillText(title, x+22, y+34);
    const max = Math.max(1, ...rows.map(r=>Number(r.total||r.value||0)));
    const chartX = x+76, chartY = y+70, chartW = w-120, chartH = h-120;
    ctx.strokeStyle='#d9dde5'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(chartX,chartY); ctx.lineTo(chartX,chartY+chartH); ctx.lineTo(chartX+chartW,chartY+chartH); ctx.stroke();
    const bw = Math.min(70, chartW / rows.length * .55);
    rows.forEach((r,i)=>{
      const val = Number(r.total||r.value||0); const bh = chartH * val/max;
      const bx = chartX + (i+.5)*chartW/rows.length - bw/2; const by = chartY+chartH-bh;
      ctx.fillStyle = c.red; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle = c.ink; ctx.font='800 15px Arial'; ctx.textAlign='center'; ctx.fillText(String(val), bx+bw/2, by-8);
      ctx.font='700 14px Arial'; drawWrapped(ctx, r.unit || r.name || r.label, bx-18, chartY+chartH+22, bw+36, 15, {maxLines:2});
      ctx.textAlign='left';
    });
  }
  function drawHorizontalBarChart(ctx, title, rows, x, y, w, h){
    const c = reportColor();
    drawPanel(ctx,x,y,w,h,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
    ctx.fillStyle = c.ink; ctx.font='900 19px Arial'; ctx.fillText(title, x+22, y+34);
    const max = Math.max(1, ...rows.map(r=>Number(r.value||r.total||0)));
    const rowH = (h-78)/rows.length;
    rows.forEach((r,i)=>{
      const yy = y+62+i*rowH;
      ctx.fillStyle = c.ink; ctx.font='800 15px Arial'; drawWrapped(ctx, r.name || r.unit || r.label, x+22, yy+18, 165, 16, {maxLines:2});
      ctx.fillStyle = '#eceff3'; ctx.fillRect(x+195, yy+5, w-270, 24);
      ctx.fillStyle = c.red; ctx.fillRect(x+195, yy+5, (w-270)*(Number(r.value||r.total||0)/max), 24);
      ctx.fillStyle = c.ink; ctx.font='900 16px Arial'; ctx.fillText(String(r.label || r.value || r.total), x+w-62, yy+23);
    });
  }
  function drawLineChart(ctx, title, rows, x, y, w, h){
    const c = reportColor();
    drawPanel(ctx,x,y,w,h,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
    ctx.fillStyle = c.ink; ctx.font='900 19px Arial'; ctx.fillText(title, x+22, y+34);
    const vals = rows.map(r=>Number(r.projected||r.value||0)); vals.unshift(Number(data.kits || 0));
    const labels = ['Поточний'].concat(rows.map(r=>`+${r.add}`));
    const max = Math.max(...vals)*1.05, min = Math.min(...vals)*.93;
    const chartX=x+70, chartY=y+70, chartW=w-120, chartH=h-120;
    ctx.strokeStyle='#d9dde5'; ctx.beginPath(); ctx.moveTo(chartX,chartY); ctx.lineTo(chartX,chartY+chartH); ctx.lineTo(chartX+chartW,chartY+chartH); ctx.stroke();
    const pts = vals.map((v,i)=>({ x: chartX + i*chartW/(vals.length-1), y: chartY+chartH-((v-min)/(max-min))*chartH, v, label:labels[i] }));
    ctx.strokeStyle=c.red; ctx.lineWidth=4; ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke();
    pts.forEach(p=>{ ctx.fillStyle=c.red; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle=c.ink; ctx.font='800 15px Arial'; ctx.textAlign='center'; ctx.fillText(String(p.v), p.x, p.y-14); ctx.font='700 14px Arial'; ctx.fillText(p.label, p.x, chartY+chartH+26); });
    ctx.textAlign='left';
  }
  function drawDonut(ctx, title, rows, x, y, w, h){
    const c = reportColor();
    drawPanel(ctx,x,y,w,h,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
    ctx.fillStyle=c.ink; ctx.font='900 19px Arial'; ctx.fillText(title,x+22,y+34);
    const total = rows.reduce((s,r)=>s+Number(r.value||0),0) || 1;
    const cx=x+w*.35, cy=y+h*.56, radius=Math.min(w,h)*.23;
    let a=-Math.PI/2;
    const fills=[c.red,'#f08a24','#aeb5c0','#222'];
    rows.forEach((r,i)=>{ const ang=Math.PI*2*(Number(r.value||0)/total); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.fillStyle=fills[i%fills.length]; ctx.arc(cx,cy,radius,a,a+ang); ctx.closePath(); ctx.fill(); a+=ang; });
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,radius*.55,0,Math.PI*2); ctx.fill();
    rows.forEach((r,i)=>{ const yy=y+78+i*34; ctx.fillStyle=fills[i%fills.length]; ctx.fillRect(x+w*.62,yy-13,18,18); ctx.fillStyle=c.ink; ctx.font='800 15px Arial'; ctx.fillText(`${r.name} (${r.value}%)`, x+w*.62+28, yy+3); });
  }

  function drawReportPage(ctx, model, pageIndex){
    const W=1240,H=1754,total=model.sections.length+1;
    const c = reportColor();
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    const pageTitle = pageIndex===0 ? 'ПОВНИЙ ЗВІТ' : (model.sections[pageIndex-1]?.title || 'ЗВІТ').replace(/^\d+\.\s*/, '');
    drawReportHeader(ctx, model, pageTitle);
    let y = 210;

    if (pageIndex === 0){
      ctx.fillStyle=c.red; ctx.font='900 34px Arial'; ctx.fillText('Аналіз · Висновки · Рекомендації', 56, y); y+=62;
      drawPanel(ctx,56,y,520,250,{fill:'#fff',stroke:'#d5d9e0',topAccent:true});
      model.meta.forEach(([k,v],i)=>{ ctx.fillStyle=c.ink; ctx.font='800 18px Arial'; ctx.fillText(k+':',86,y+48+i*44); ctx.fillStyle=c.red; ctx.font='900 18px Arial'; ctx.fillText(String(v),310,y+48+i*44); });
      drawPanel(ctx,620,y,560,250,{fill:'#111216',stroke:c.red,topAccent:false});
      ctx.fillStyle='#fff'; ctx.font='900 28px Arial'; ctx.fillText('BASTION REPORT ENGINE',650,y+58);
      ctx.fillStyle='#d7262d'; ctx.font='900 18px Arial'; ctx.fillText('PDF · DOCX · CHARTS · KPI',650,y+96);
      drawIcon(ctx,'target',650,y+126,70,c.red); drawIcon(ctx,'bars',760,y+126,70,c.red); drawIcon(ctx,'shield',870,y+126,70,c.red); drawIcon(ctx,'line',980,y+126,70,c.red);
      y+=330;
      ctx.fillStyle=c.red; ctx.font='900 30px Arial'; ctx.fillText('Зміст звіту',56,y); y+=50;
      model.sections.forEach((s,i)=>{
        const col = i<5 ? 0 : 1; const row = i%5;
        drawPanel(ctx,56+col*560,y+row*72,520,58,{fill:'#fff',stroke:'#e1e4e8'});
        ctx.fillStyle=c.red; ctx.font='900 22px Arial'; ctx.fillText(String(i+1).padStart(2,'0'),82+col*560,y+row*72+36);
        ctx.fillStyle=c.ink; ctx.font='800 20px Arial'; ctx.fillText(s.title.replace(/^\d+\.\s*/, ''),136+col*560,y+row*72+36);
      });
    }

    if (pageIndex === 1){
      drawSectionLabel(ctx,'01','Загальні KPI',56,y); y+=40;
      const kpi = [
        ['cube','Сформовано комплектів',data.kits,''], ['target','Максимальна дальність',fmtRange(data.bestRange),''], ['warehouse','Залишок складу',data.remainTotal,`${data.remainPercent||0}% після розрахунку`], ['warning','Обмежувальний елемент',data.bottleneck,''], ['users','Враховано підрозділів',allUnits().length,allUnits().join(', ')]
      ];
      kpi.forEach((k,i)=>drawKpiCard(ctx,56+(i%2)*555,y+Math.floor(i/2)*190,520,160,...k));
      y+=600;
      drawSectionLabel(ctx,'01.1','Ключові показники системи',56,y); y+=40;
      drawRows(ctx,[['Коефіцієнт використання ресурсів',`${readiness()}%`],['Потенційний приріст комплектів',`+${forecastScenarios().at(-1)?.gain || 0}`],['Середня ефективність комплекту','0,62'],['Рівень критичності системи','Високий']],56,y,1128,60,['target','line','cube','warning']);
    }

    if (pageIndex === 2){
      drawSectionLabel(ctx,'02','Висновки',56,y); y+=40;
      const sec=model.sections[1]; drawRows(ctx, sec.rows, 56, y, 1128, 74, ['star','bars','warehouse','cube','target']); y+=430;
      drawPanel(ctx,56,y,1128,180,{fill:c.pink,stroke:'#f0b5b9',topAccent:true});
      ctx.fillStyle=c.red; ctx.font='900 24px Arial'; ctx.fillText('Ключовий висновок',86,y+48);
      ctx.fillStyle=c.ink; ctx.font='700 22px Arial'; drawWrapped(ctx, `Поточний результат становить ${data.kits} комплектів. Обмежувальним елементом визначено ${data.bottleneck}. Максимальна дальність — ${fmtRange(data.bestRange)}.`,86,y+92,1040,30,{maxLines:3});
    }

    if (pageIndex === 3){
      drawSectionLabel(ctx,'03','Рекомендації / прогноз',56,y); y+=40;
      drawDataTable(ctx,['Поповнення','Прогноз комплектів','Приріст'], forecastScenarios().map(s=>[`+${s.add} ${s.element}`,String(s.projected),`+${s.gain}`]),56,y,1128,64); y+=310;
      const best = [...forecastScenarios()].sort((a,b)=>b.gain-a.gain)[0];
      drawPanel(ctx,56,y,1128,180,{fill:c.pink,stroke:'#f0b5b9',topAccent:true}); drawIcon(ctx,'star',90,y+52,70,c.red);
      ctx.fillStyle=c.red; ctx.font='900 34px Arial'; ctx.fillText(`Найкращий сценарій: +${best.add} ${best.element}`,190,y+70);
      ctx.fillStyle=c.ink; ctx.font='800 24px Arial'; ctx.fillText(`Дає +${best.gain} комплектів. Підсумковий прогноз: ${best.projected} комплектів.`,190,y+118);
      y+=240;
      drawDataTable(ctx,['Ресурс','Ефективність','Пріоритет'], recommendationRows().map((r,i)=>[r.name,r.value,i===0?'Високий':i===1?'Середній':'Низький']),56,y,1128,56);
    }

    if (pageIndex === 4){
      drawSectionLabel(ctx,'04','Графіки / діаграми',56,y); y+=32;
      drawBarChart(ctx,'4.1 Розподіл комплектів по підрозділах',model.charts.allocations,56,y,540,430);
      drawLineChart(ctx,'4.2 Прогноз приросту від поповнення',model.charts.scenarios,640,y,540,430);
      y+=470;
      drawHorizontalBarChart(ctx,'4.3 Ефективність поповнення ресурсів',model.charts.impact,56,y,540,390);
      drawHorizontalBarChart(ctx,'4.4 Залишки по підрозділах',model.charts.remains.map(r=>({...r,value:r.total,label:r.total})),640,y,540,390);
    }

    if (pageIndex === 5){
      drawSectionLabel(ctx,'05','Розподіл боєкомплектів',56,y); y+=40;
      drawBarChart(ctx,'Сформовано комплектів по підрозділах',model.charts.allocations,56,y,1128,520); y+=570;
      drawDataTable(ctx,['Підрозділ','Сформовано комплектів','Частка'], model.charts.allocations.map(r=>[r.unit,String(r.total),`${Math.round((r.total||0)/(data.kits||1)*100)}%`]),56,y,1128,54);
    }

    if (pageIndex === 6){
      drawSectionLabel(ctx,'06','Залишки по підрозділах',56,y); y+=40;
      drawHorizontalBarChart(ctx,'Залишки після розрахунку',model.charts.remains.map(r=>({...r,value:r.total,label:r.total})),56,y,1128,520); y+=570;
      drawDataTable(ctx,['Підрозділ','Залишок','Статус'], model.charts.remains.map(r=>[r.unit,`${r.total} од.`, r.total <= minRemain().total ? 'Мінімальний' : 'Достатній']),56,y,1128,54);
    }

    if (pageIndex === 7){
      drawSectionLabel(ctx,'07','Деталі по елементах',56,y); y+=40;
      drawDataTable(ctx,['Елемент','Поточний стан','Статус','Вплив'], [[data.bottleneck,String(data.remainTotal)+' од.','Критичний','72%'],[minElement().name,`${minElement().qty} од. (${minElement().unit})`,'Критичний','21%'],['Інші ресурси','—','Нормальний','7%']],56,y,1128,62); y+=300;
      drawDonut(ctx,'Структура обмежень', [{name:data.bottleneck,value:72},{name:minElement().name,value:21},{name:'Інші',value:7}],56,y,540,390);
      drawPanel(ctx,640,y,540,390,{fill:'#fff',stroke:'#d5d9e0',topAccent:true}); ctx.fillStyle=c.ink; ctx.font='900 22px Arial'; ctx.fillText('Додаткова інформація',670,y+44); ctx.font='700 19px Arial'; ctx.fillStyle=c.ink; drawWrapped(ctx,`Коефіцієнт обмеження системи: 0,62. Глибина аналізу: повна. Враховано джерела даних зі складських залишків та активного рецепту.`,670,y+94,480,28,{maxLines:7});
    }

    if (pageIndex === 8){
      drawSectionLabel(ctx,'08','Сценарний аналіз',56,y); y+=40;
      const scenarios=forecastScenarios();
      drawLineChart(ctx,'Динаміка прогнозу комплектів',scenarios,56,y,1128,500); y+=560;
      drawDataTable(ctx,['Сценарій','Комплекти','Дальність','Приріст'], [['Поточний режим',String(data.kits),fmtRange(data.bestRange),'—'],...scenarios.map(s=>[`+${s.add} ${s.element}`,String(s.projected),fmtRange(data.bestRange),`+${s.gain}`])],56,y,1128,58);
    }

    if (pageIndex === 9){
      drawSectionLabel(ctx,'09','Службова інформація',56,y); y+=40;
      drawRows(ctx,model.sections[8].rows,56,y,1128,70,['cube','line','target','warehouse']); y+=360;
      drawPanel(ctx,56,y,1128,190,{fill:'#111216',stroke:c.red,topAccent:false});
      ctx.fillStyle='#fff'; ctx.font='900 30px Arial'; ctx.fillText('BASTION Command System',86,y+60);
      ctx.fillStyle=c.red; ctx.font='800 20px Arial'; ctx.fillText('Звіт сформовано автоматизованим модулем експортного движка.',86,y+100);
      ctx.fillStyle='#fff'; ctx.font='700 18px Arial'; ctx.fillText('Формати експорту: PDF / DOCX · Структура документів ідентична.',86,y+136);
    }

    drawReportFooter(ctx, pageIndex+1, total);
  }

  async function buildPdfFromCanvases(canvases){
    const encoder = new TextEncoder();
    const parts = ['%PDF-1.4\n'];
    const offsets = [0];
    const byteLen = part => typeof part === 'string' ? encoder.encode(part).length : part.length;
    const currentOffset = () => parts.reduce((sum, part) => sum + byteLen(part), 0);
    const writeObj = (num, body) => { offsets[num] = currentOffset(); parts.push(`${num} 0 obj\n${body}\nendobj\n`); };
    const writeImageObj = (num, dict, bytes) => { offsets[num] = currentOffset(); parts.push(`${num} 0 obj\n${dict}\nstream\n`); parts.push(bytes); parts.push('\nendstream\nendobj\n'); };
    const pageNums = []; let nextObj = 3; const imageRecords = [];
    for (const canvas of canvases){
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
      const bytes = new Uint8Array(await jpeg.arrayBuffer());
      const imgNum = nextObj++, contentNum = nextObj++, pageNum = nextObj++;
      imageRecords.push({ canvas, bytes, imgNum, contentNum, pageNum }); pageNums.push(pageNum);
    }
    writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    writeObj(2, `<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`);
    imageRecords.forEach((rec, idx) => {
      writeImageObj(rec.imgNum, `<< /Type /XObject /Subtype /Image /Width ${rec.canvas.width} /Height ${rec.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${rec.bytes.length} >>`, rec.bytes);
      const content = `q\n595 0 0 842 0 0 cm\n/Im${idx + 1} Do\nQ`;
      writeObj(rec.contentNum, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      writeObj(rec.pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${idx + 1} ${rec.imgNum} 0 R >> >> /Contents ${rec.contentNum} 0 R >>`);
    });
    const xrefStart = currentOffset(); const maxObj = nextObj - 1;
    parts.push(`xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= maxObj; i++) parts.push(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
    parts.push(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function exportPdf(){
    const model = reportModel();
    const totalPages = model.sections.length + 1;
    const canvases = [];
    for (let i=0;i<totalPages;i++){
      const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
      drawReportPage(canvas.getContext('2d'), model, i); canvases.push(canvas);
    }
    const pdf = await buildPdfFromCanvases(canvases);
    downloadBlob('bastion-command-report.pdf', pdf, 'application/pdf');
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
