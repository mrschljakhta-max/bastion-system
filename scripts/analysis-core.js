
(() => {
  const fallback = {
    mode: 'Загальний режим',
    kits: 342,
    bestRange: 27400,
    bottleneck: 'ZA8',
    remainPercent: 68,
    units: [
      { name: '1 САДн', kits: 126, load: 78 },
      { name: '2 САДн', kits: 94, load: 64 },
      { name: '3 САДн', kits: 72, load: 56 },
      { name: 'Резерв БК', kits: 50, load: 42 }
    ],
    recipes: [
      { name: 'SN7 + ZA8 + PID5 + PR1', range: 27400, kits: 14, status: 'Використано' },
      { name: 'SN4 + ZA1 + PID1 + PR2', range: 24200, kits: 31, status: 'Використано' },
      { name: 'SN6 + ZA10 + PID2 + PR1', range: 22000, kits: 41, status: 'Використано' },
      { name: 'SN5 + ZA4 + PID3 + PR2', range: 18500, kits: 68, status: 'Використано' },
      { name: 'SN2 + ZA3 + PID2 + PR0', range: 14500, kits: 0, status: 'Обмежено' }
    ],
    bottlenecks: [
      { name: 'ZA8', usage: 92 },
      { name: 'PID3', usage: 81 },
      { name: 'SN4', usage: 74 },
      { name: 'PR2', usage: 66 }
    ],
    resources: [
      { name: 'Снаряди', start: 480, used: 352, left: 128 },
      { name: 'Заряди', start: 300, used: 271, left: 29 },
      { name: 'Підривники', start: 140, used: 81, left: 59 },
      { name: 'Праймера', start: 220, used: 176, left: 44 }
    ]
  };

  function readStoredResult() {
    const keys = [
      'bastion.analysis.result',
      'bastion.calculation.result',
      'bastionCalculatorResult',
      'bastionAnalysisResult'
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return normalizeResult(parsed);
      } catch (_) {}
    }

    return fallback;
  }

  function normalizeResult(input) {
    const data = { ...fallback, ...input };
    data.units = Array.isArray(input.units) && input.units.length ? input.units : fallback.units;
    data.recipes = Array.isArray(input.recipes) && input.recipes.length ? input.recipes : fallback.recipes;
    data.bottlenecks = Array.isArray(input.bottlenecks) && input.bottlenecks.length ? input.bottlenecks : fallback.bottlenecks;
    data.resources = Array.isArray(input.resources) && input.resources.length ? input.resources : fallback.resources;
    return data;
  }

  function formatRange(value) {
    const meters = Number(value) || 0;
    if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
    return `${meters} м`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderKpis(data) {
    setText('kpiKits', data.kits ?? fallback.kits);
    setText('kpiRange', formatRange(data.bestRange ?? fallback.bestRange));
    setText('kpiBottleneck', data.bottleneck ?? fallback.bottleneck);
    setText('kpiRemain', `${data.remainPercent ?? fallback.remainPercent}%`);
    setText('recipeModeChip', data.mode || fallback.mode);
  }

  function renderUnits(units) {
    const host = document.getElementById('unitDistribution');
    if (!host) return;
    host.innerHTML = units.map(unit => `
      <div class="unit-tile">
        <div>
          <strong>${escapeHtml(unit.name)}</strong>
          <span>навантаження ${Number(unit.load ?? 0)}%</span>
        </div>
        <b>${Number(unit.kits ?? 0)}</b>
      </div>
    `).join('');
  }

  function renderRecipes(recipes) {
    const host = document.getElementById('resultRows');
    if (!host) return;
    host.innerHTML = recipes.map(recipe => {
      const limited = String(recipe.status || '').toLowerCase().includes('обмеж') || Number(recipe.kits) === 0;
      return `
        <tr>
          <td>${escapeHtml(recipe.name)}</td>
          <td>${formatRange(recipe.range)}</td>
          <td>${Number(recipe.kits ?? 0)}</td>
          <td><span class="${limited ? 'status-limit' : 'status-used'}">${limited ? 'LIMIT' : 'ACTIVE'}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderBottlenecks(items) {
    const host = document.getElementById('bottleneckBars');
    if (!host) return;
    host.innerHTML = items.map(item => {
      const usage = Math.max(0, Math.min(100, Number(item.usage ?? 0)));
      return `
        <div class="bottle-item">
          <div class="bottle-row">
            <span>${escapeHtml(item.name)}</span>
            <span>${usage}%</span>
          </div>
          <div class="bottle-track"><span class="bottle-fill" style="--w:${usage}%"></span></div>
        </div>
      `;
    }).join('');
  }

  function renderResources(resources) {
    const host = document.getElementById('resourceCards');
    if (!host) return;
    host.innerHTML = resources.map(item => {
      const start = Number(item.start ?? 0);
      const used = Number(item.used ?? 0);
      const left = Number(item.left ?? Math.max(0, start - used));
      const pct = start > 0 ? Math.max(0, Math.min(100, Math.round((used / start) * 100))) : 0;
      return `
        <article class="resource-card">
          <h3>${escapeHtml(item.name)}</h3>
          <div class="resource-stat"><span>Було</span><b>${start}</b></div>
          <div class="resource-stat"><span>Використано</span><b>${used}</b></div>
          <div class="resource-stat"><span>Залишилось</span><b>${left}</b></div>
          <div class="resource-gauge" aria-hidden="true"><span style="--w:${pct}%"></span></div>
        </article>
      `;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch]));
  }

  function initTilt() {
    const cards = document.querySelectorAll('.analysis-tilt');
    cards.forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 5;
        const ry = (x - 0.5) * 7;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        card.classList.add('is-tilting');
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
        card.classList.remove('is-tilting');
      });
    });
  }

  function bindActions() {
    const recalc = document.getElementById('analysisRecalculate');
    if (recalc) {
      recalc.addEventListener('click', () => {
        window.location.href = './calculator.html';
      });
    }

    const exportBtn = document.getElementById('analysisExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportBtn.textContent = 'Експорт підготовлено';
        setTimeout(() => { exportBtn.textContent = 'Експорт XLSX'; }, 1400);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const data = readStoredResult();
    renderKpis(data);
    renderUnits(data.units);
    renderRecipes(data.recipes);
    renderBottlenecks(data.bottlenecks);
    renderResources(data.resources);
    initTilt();
    bindActions();
  });
})();
