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

  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight){
    const words = String(text).split(/\s+/);
    let line = '';
    for (const word of words){
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line){ ctx.fillText(line, x, y); y += lineHeight; line = word; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lineHeight; }
    return y;
  }
  function drawReportPage(ctx, model, pageIndex){
    const W=1240,H=1754;
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#111'; ctx.fillRect(0,0,W,150);
    ctx.strokeStyle='#d7262d'; ctx.lineWidth=4; ctx.strokeRect(18,18,W-36,114);
    ctx.fillStyle='#fff'; ctx.font='700 42px Arial'; ctx.fillText('BASTION', 56,70);
    ctx.fillStyle='#d7262d'; ctx.font='700 22px Arial'; ctx.fillText('COMMAND SYSTEM', 58,103);
    ctx.fillStyle='#fff'; ctx.font='800 48px Arial'; ctx.fillText(pageIndex===0?'ПОВНИЙ ЗВІТ':model.sections[pageIndex-1]?.title || 'ЗВІТ', 380,92);
    ctx.fillStyle='#222'; ctx.font='700 26px Arial';
    let y=205;
    if (pageIndex===0){
      ctx.fillStyle='#d7262d'; ctx.font='800 34px Arial'; ctx.fillText('Аналіз · Висновки · Рекомендації', 56,220);
      ctx.fillStyle='#222'; ctx.font='20px Arial'; y=285;
      model.meta.forEach(([k,v])=>{ ctx.font='700 20px Arial'; ctx.fillText(k+':',56,y); ctx.font='20px Arial'; ctx.fillText(String(v),300,y); y+=42; });
      ctx.fillStyle='#d7262d'; ctx.font='800 30px Arial'; ctx.fillText('Зміст звіту',56,y+38); y+=86;
      model.sections.forEach((s,i)=>{ ctx.fillStyle='#222'; ctx.font='700 22px Arial'; ctx.fillText(`${String(i+1).padStart(2,'0')}. ${s.title.replace(/^\d+\.\s*/, '')}`,72,y); y+=40; });
    } else {
      const section = model.sections[pageIndex-1];
      if (!section) return;
      ctx.fillStyle='#d7262d'; ctx.font='800 30px Arial'; ctx.fillText(section.title,56,y); y+=50;
      const isChartPage = section.title.includes('Розподіл') || section.title.includes('Залишки');
      ctx.font='20px Arial';
      section.rows.forEach(([k,v])=>{
        ctx.strokeStyle='#ddd'; ctx.lineWidth=1; ctx.strokeRect(56,y-30,W-112,58);
        ctx.fillStyle='#222'; ctx.font='700 20px Arial'; ctx.fillText(String(k),76,y);
        ctx.fillStyle='#b91c1c'; ctx.font='700 24px Arial'; drawWrapped(ctx,String(v),520,y,600,28);
        y+=70;
      });
    }
    ctx.fillStyle='#333'; ctx.font='16px Arial'; ctx.fillText('BASTION Command System',56,H-44); ctx.fillText(`Сторінка ${pageIndex+1}/${model.sections.length+1}`,W-190,H-44);
  }
  async function buildPdfFromCanvases(canvases){
    const encoder = new TextEncoder();
    const parts = ['%PDF-1.4\n'];
    const offsets = [0];
    const byteLen = part => typeof part === 'string' ? encoder.encode(part).length : part.length;
    const currentOffset = () => parts.reduce((sum, part) => sum + byteLen(part), 0);
    const writeObj = (num, body) => {
      offsets[num] = currentOffset();
      parts.push(`${num} 0 obj\n${body}\nendobj\n`);
    };
    const writeImageObj = (num, dict, bytes) => {
      offsets[num] = currentOffset();
      parts.push(`${num} 0 obj\n${dict}\nstream\n`);
      parts.push(bytes);
      parts.push('\nendstream\nendobj\n');
    };

    const pageNums = [];
    let nextObj = 3;
    const imageRecords = [];
    for (const canvas of canvases){
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
      const bytes = new Uint8Array(await jpeg.arrayBuffer());
      const imgNum = nextObj++;
      const contentNum = nextObj++;
      const pageNum = nextObj++;
      imageRecords.push({ canvas, bytes, imgNum, contentNum, pageNum });
      pageNums.push(pageNum);
    }

    writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    writeObj(2, `<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`);
    imageRecords.forEach((rec, idx) => {
      writeImageObj(
        rec.imgNum,
        `<< /Type /XObject /Subtype /Image /Width ${rec.canvas.width} /Height ${rec.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${rec.bytes.length} >>`,
        rec.bytes
      );
      const content = `q\n595 0 0 842 0 0 cm\n/Im${idx + 1} Do\nQ`;
      writeObj(rec.contentNum, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      writeObj(rec.pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${idx + 1} ${rec.imgNum} 0 R >> >> /Contents ${rec.contentNum} 0 R >>`);
    });

    const xrefStart = currentOffset();
    const maxObj = nextObj - 1;
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
      const canvas = document.createElement('canvas');
      canvas.width = 1240; canvas.height = 1754;
      drawReportPage(canvas.getContext('2d'), model, i);
      canvases.push(canvas);
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
