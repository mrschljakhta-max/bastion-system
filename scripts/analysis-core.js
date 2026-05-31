(() => {
  const fallback = {
    mode: 'Загальний режим',
    kits: 342,
    bestRange: 27400,
    bottleneck: 'ZA8',
    remainTotal: 260,
    remainPercent: 68,
    issueByUnit: [
      {
        unit: '1 САДн',
        total: 126,
        rows: [
          { name: 'SN7 + ZA8 + PID5 + PR1', qty: 42 },
          { name: 'SN4 + ZA1 + PID1 + PR2', qty: 31 },
          { name: 'SN6 + ZA10 + PID2 + PR1', qty: 53 }
        ]
      },
      {
        unit: '2 САДн',
        total: 94,
        rows: [
          { name: 'SN7 + ZA8 + PID5 + PR1', qty: 28 },
          { name: 'SN5 + ZA4 + PID3 + PR2', qty: 48 },
          { name: 'SN2 + ZA3 + PID2 + PR0', qty: 18 }
        ]
      },
      {
        unit: '3 САДн',
        total: 72,
        rows: [
          { name: 'SN6 + ZA10 + PID2 + PR1', qty: 41 },
          { name: 'SN4 + ZA1 + PID1 + PR2', qty: 31 }
        ]
      },
      {
        unit: 'Резерв БК',
        total: 50,
        rows: [
          { name: 'SN5 + ZA4 + PID3 + PR2', qty: 50 }
        ]
      }
    ],
    remainByUnit: [
      {
        unit: '1 САДн',
        total: 54,
        rows: [
          { name: 'SN7', qty: 38 },
          { name: 'ZA8', qty: 7 },
          { name: 'PID5', qty: 19 },
          { name: 'PR1', qty: 82 }
        ]
      },
      {
        unit: '2 САДн',
        total: 46,
        rows: [
          { name: 'SN7', qty: 54 },
          { name: 'ZA8', qty: 18 },
          { name: 'PID3', qty: 22 },
          { name: 'PR2', qty: 36 }
        ]
      },
      {
        unit: '3 САДн',
        total: 48,
        rows: [
          { name: 'SN5', qty: 46 },
          { name: 'ZA4', qty: 29 },
          { name: 'PID2', qty: 14 },
          { name: 'PR0', qty: 20 }
        ]
      },
      {
        unit: 'Резерв БК',
        total: 112,
        rows: [
          { name: 'SN4', qty: 28 },
          { name: 'ZA1', qty: 34 },
          { name: 'PID1', qty: 21 },
          { name: 'PR2', qty: 29 }
        ]
      }
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
    data.issueByUnit = normalizeIssueByUnit(input.issueByUnit || input.distributionByUnit || input.allocations || input.units);
    data.remainByUnit = normalizeRemainByUnit(input.remainByUnit || input.leftoversByUnit || input.remainingByUnit || input.unitRemainders);
    data.remainTotal = input.remainTotal ?? input.remainingTotal ?? input.leftTotal ?? fallback.remainTotal;
    return data;
  }

  function normalizeIssueByUnit(source) {
    if (!Array.isArray(source) || !source.length) return fallback.issueByUnit;

    return source.map((unit, index) => {
      const rows = Array.isArray(unit.rows) ? unit.rows
        : Array.isArray(unit.items) ? unit.items
        : Array.isArray(unit.recipes) ? unit.recipes
        : [];
      return {
        unit: unit.unit || unit.name || `Підрозділ ${index + 1}`,
        total: unit.total ?? unit.kits ?? rows.reduce((sum, row) => sum + Number(row.qty ?? row.kits ?? row.count ?? 0), 0),
        rows: rows.map(row => ({
          name: row.name || row.recipe || row.item || row.label || 'Елемент',
          qty: row.qty ?? row.kits ?? row.count ?? row.value ?? 0
        }))
      };
    });
  }

  function normalizeRemainByUnit(source) {
    if (!Array.isArray(source) || !source.length) return fallback.remainByUnit;

    return source.map((unit, index) => {
      const rows = Array.isArray(unit.rows) ? unit.rows
        : Array.isArray(unit.items) ? unit.items
        : Array.isArray(unit.resources) ? unit.resources
        : [];
      return {
        unit: unit.unit || unit.name || `Підрозділ ${index + 1}`,
        total: unit.total ?? unit.left ?? unit.remaining ?? rows.reduce((sum, row) => sum + Number(row.qty ?? row.left ?? row.remaining ?? row.count ?? 0), 0),
        rows: rows.map(row => ({
          name: row.name || row.item || row.resource || row.label || 'Елемент',
          qty: row.qty ?? row.left ?? row.remaining ?? row.count ?? row.value ?? 0
        }))
      };
    });
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
    setText('kpiRemain', data.remainTotal ?? fallback.remainTotal);

    const remainCard = document.getElementById('kpiRemain')?.closest('.analysis-kpi');
    if (remainCard) {
      const small = remainCard.querySelector('small');
      if (small) small.textContent = `${data.remainPercent ?? fallback.remainPercent}% після розрахунку`;
      remainCard.title = `Залишок складу: ${data.remainTotal ?? fallback.remainTotal} од. / ${data.remainPercent ?? fallback.remainPercent}%`;
    }
  }

  function renderUnitBlocks(hostId, units, mode) {
    const host = document.getElementById(hostId);
    if (!host) return;

    host.innerHTML = units.map(unit => `
      <section class="unit-result-block" tabindex="0">
        <header class="unit-result-block__head">
          <div>
            <span>${mode === 'issue' ? 'підрозділ' : 'залишки'}</span>
            <strong>${escapeHtml(unit.unit)}</strong>
          </div>
          <b>${Number(unit.total ?? 0)}</b>
        </header>
        <div class="unit-result-block__rows">
          ${(unit.rows || []).map(row => `
            <div class="unit-result-row">
              <span>${escapeHtml(row.name)}</span>
              <b>${Number(row.qty ?? 0)}</b>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');
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
        const rx = (0.5 - y) * 4;
        const ry = (x - 0.5) * 5;
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
    renderUnitBlocks('issueTable', data.issueByUnit, 'issue');
    renderUnitBlocks('remainTable', data.remainByUnit, 'remain');
    initTilt();
    bindActions();
  });
})();
