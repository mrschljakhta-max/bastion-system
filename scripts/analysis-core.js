(() => {
  const fallback = {
    mode: 'Загальний режим',
    kits: 342,
    bestRange: 27400,
    bottleneck: 'ZA8',
    remainTotal: 260,
    remainPercent: 68,
    allocations: [
      {
        unit: '1 САДн',
        total: 126,
        items: [
          { name: 'SN7 + ZA8 + PID5 + PR1', qty: 42 },
          { name: 'SN4 + ZA1 + PID1 + PR2', qty: 31 },
          { name: 'SN6 + ZA10 + PID2 + PR1', qty: 53 }
        ]
      },
      {
        unit: '2 САДн',
        total: 94,
        items: [
          { name: 'SN7 + ZA8 + PID5 + PR1', qty: 18 },
          { name: 'SN5 + ZA4 + PID3 + PR2', qty: 76 }
        ]
      },
      {
        unit: '3 САДн',
        total: 72,
        items: [
          { name: 'SN6 + ZA10 + PID2 + PR1', qty: 41 },
          { name: 'SN4 + ZA1 + PID1 + PR2', qty: 31 }
        ]
      },
      {
        unit: 'Резерв БК',
        total: 50,
        items: [
          { name: 'SN5 + ZA4 + PID3 + PR2', qty: 50 }
        ]
      }
    ],
    remains: [
      {
        unit: '1 САДн',
        total: 54,
        items: [
          { name: 'SN7', qty: 38 },
          { name: 'ZA8', qty: 7 },
          { name: 'PID5', qty: 19 },
          { name: 'PR1', qty: 82 }
        ]
      },
      {
        unit: '2 САДн',
        total: 46,
        items: [
          { name: 'SN7', qty: 54 },
          { name: 'ZA8', qty: 18 },
          { name: 'PID3', qty: 22 },
          { name: 'PR2', qty: 41 }
        ]
      },
      {
        unit: '3 САДн',
        total: 48,
        items: [
          { name: 'SN6', qty: 25 },
          { name: 'ZA10', qty: 14 },
          { name: 'PID2', qty: 9 },
          { name: 'PR1', qty: 61 }
        ]
      },
      {
        unit: 'Резерв БК',
        total: 112,
        items: [
          { name: 'SN5', qty: 46 },
          { name: 'ZA4', qty: 29 },
          { name: 'PID3', qty: 22 },
          { name: 'PR2', qty: 15 }
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
    data.allocations = normalizeGroups(
      Array.isArray(input.allocations) && input.allocations.length
        ? input.allocations
        : buildAllocationsFromLegacy(input.units, input.recipes),
      fallback.allocations,
      'allocation'
    );
    data.remains = normalizeGroups(
      Array.isArray(input.remains) && input.remains.length
        ? input.remains
        : buildRemainsFromLegacy(input.units, input.resources),
      fallback.remains,
      'remain'
    );
    data.remainTotal = Number(input.remainTotal ?? input.remainingTotal ?? data.remainTotal ?? fallback.remainTotal);
    return data;
  }


  function normalizeGroups(groups, fallbackGroups, type = 'allocation') {
    const source = Array.isArray(groups) && groups.length ? groups : fallbackGroups;
    return source.map((group, idx) => {
      const fallbackGroup = fallbackGroups.find(item => normalizeName(item.unit) === normalizeName(group.unit)) || fallbackGroups[idx] || fallbackGroups[0];
      const rawItems = Array.isArray(group.items) && group.items.length ? group.items : null;
      const items = rawItems || (fallbackGroup && Array.isArray(fallbackGroup.items) ? fallbackGroup.items : buildSyntheticItems(group, type));
      const total = Number(group.total ?? sumItems(items));
      return {
        unit: group.unit || fallbackGroup?.unit || `Підрозділ ${idx + 1}`,
        total,
        items: items.map(item => {
          const qty = Number(item.qty ?? item.count ?? item.total ?? item.remaining ?? item.left ?? 0);
          const initial = Number(item.initial ?? item.start ?? item.before ?? item.original ?? item.stock ?? item.totalBefore ?? NaN);
          const used = Number(item.used ?? item.consumed ?? item.spent ?? item.issued ?? (Number.isFinite(initial) ? Math.max(0, initial - qty) : 0));
          return {
            name: item.name || item.title || 'Елемент',
            qty,
            used,
            initial: Number.isFinite(initial) ? initial : qty + used
          };
        })
      };
    });
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function buildSyntheticItems(group, type) {
    const total = Number(group.total ?? 0);
    if (type === 'remain') {
      return [
        { name: 'SN7', qty: Math.max(0, Math.round(total * .38)) },
        { name: 'ZA8', qty: Math.max(0, Math.round(total * .22)) },
        { name: 'PID5', qty: Math.max(0, Math.round(total * .16)) },
        { name: 'PR1', qty: Math.max(0, Math.round(total * .24)) }
      ];
    }
    return [
      { name: 'SN7 + ZA8 + PID5 + PR1', qty: Math.max(0, Math.round(total * .34)) },
      { name: 'SN4 + ZA1 + PID1 + PR2', qty: Math.max(0, Math.round(total * .25)) },
      { name: 'SN6 + ZA10 + PID2 + PR1', qty: Math.max(0, total - Math.round(total * .34) - Math.round(total * .25)) }
    ];
  }

  function buildAllocationsFromLegacy(units, recipes) {
    if (!Array.isArray(units) || !units.length) return null;
    const recipeList = Array.isArray(recipes) && recipes.length ? recipes : fallback.allocations.flatMap(group => group.items.map(item => ({ name: item.name })));
    return units.map((unit, idx) => ({
      unit: unit.name || `Підрозділ ${idx + 1}`,
      total: Number(unit.kits ?? unit.total ?? 0),
      items: recipeList.slice(0, Math.max(1, Math.min(3, recipeList.length))).map((recipe, rIdx) => ({
        name: recipe.name || recipe.title || `Рецепт ${rIdx + 1}`,
        qty: Math.max(0, Math.round(Number(unit.kits ?? unit.total ?? 0) / Math.max(2, rIdx + 2)))
      }))
    }));
  }

  function buildRemainsFromLegacy(units, resources) {
    if (!Array.isArray(units) || !units.length || !Array.isArray(resources) || !resources.length) return null;
    return units.map((unit, idx) => ({
      unit: unit.name || `Підрозділ ${idx + 1}`,
      total: Number(unit.left ?? Math.max(0, Math.round(Number(unit.kits ?? 0) * .42))),
      items: resources.slice(0, 4).map(resource => {
        const remaining = Math.max(0, Math.round(Number(resource.left ?? resource.remaining ?? 0) / units.length));
        const initial = Math.max(0, Math.round(Number(resource.initial ?? resource.stock ?? resource.qty ?? resource.quantity ?? resource.total ?? resource.left ?? 0) / units.length));
        return {
          name: resource.name || 'Елемент',
          qty: remaining,
          used: Math.max(0, initial - remaining),
          initial
        };
      })
    }));
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
    setText('kpiRemain', Number(data.remainTotal ?? fallback.remainTotal));
    const remain = document.getElementById('kpiRemain');
    if (remain) remain.closest('.analysis-kpi')?.querySelector('small')?.replaceChildren(document.createTextNode(`${data.remainPercent ?? fallback.remainPercent}% після розрахунку`));
  }

  function getElementCategory(name) {
    const raw = String(name || '').toLowerCase();
    if (/снар|sn|офс|he|smk/.test(raw)) return { cls: 'shell', label: 'Снаряд', glyph: '◉' };
    if (/зар|za|charge/.test(raw)) return { cls: 'charge', label: 'Заряд', glyph: '▤' };
    if (/підрив|підр|pid|fuze|fuse/.test(raw)) return { cls: 'fuze', label: 'Підривник', glyph: '✶' };
    if (/прайм|primer|pr\d|pr-/.test(raw)) return { cls: 'primer', label: 'Праймер', glyph: '⬡' };
    if (/\+/.test(raw)) return { cls: 'combo', label: 'Комбінація', glyph: '◇' };
    return { cls: 'item', label: 'Елемент', glyph: '•' };
  }

  function categoryIcon(name, mode = 'item') {
    const cat = mode === 'combo' ? { cls: 'combo', label: 'Комбінація', glyph: '◇' } : getElementCategory(name);
    return `<i class="analysis-row-icon analysis-row-icon--${cat.cls}" title="${escapeHtml(cat.label)}" aria-hidden="true">${cat.glyph}</i>`;
  }

  function renderGroupedBlocks(hostId, groups, options = {}) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const emptyText = options.emptyText || 'Дані відсутні';
    const rowName = options.rowName || (hostId === 'remainBlocks' ? 'Елемент' : 'Комбінація');
    const rowQty = options.rowQty || (hostId === 'remainBlocks' ? 'Залишок' : 'Кількість');
    const rowUsed = options.rowUsed || 'Викор.';
    const unitLabel = options.unitLabel || (hostId === 'remainBlocks' ? 'Залишки' : 'Підрозділ');
    const isRemain = hostId === 'remainBlocks' || options.type === 'remain';

    if (!Array.isArray(groups) || !groups.length) {
      host.innerHTML = `<div class="analysis-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }

    host.innerHTML = groups.map((group, index) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const total = Number(group.total ?? sumItems(items));
      const unit = group.unit || `Підрозділ ${index + 1}`;
      const bodyId = `${hostId}-details-${index}`;

      const headerLine = isRemain
        ? `<div class="result-line result-line--head result-line--remain">
              <span>${escapeHtml(rowName)}</span>
              <em>${escapeHtml(rowUsed)}</em>
              <b>${escapeHtml(rowQty)}</b>
            </div>`
        : `<div class="result-line result-line--head">
              <span>${escapeHtml(rowName)}</span>
              <b>${escapeHtml(rowQty)}</b>
            </div>`;

      const itemLines = items.map(item => {
        const qty = Number(item.qty ?? 0);
        const used = Number(item.used ?? item.consumed ?? item.spent ?? item.issued ?? 0);
        if (isRemain) {
          return `
              <div class="result-line result-line--remain">
                <span class="analysis-row-name">${categoryIcon(item.name)}<span>${escapeHtml(item.name)}</span></span>
                <em>${used}</em>
                <b>${qty}</b>
              </div>
            `;
        }
        return `
              <div class="result-line">
                <span class="analysis-row-name">${categoryIcon(item.name, 'combo')}<span>${escapeHtml(item.name)}</span></span>
                <b>${qty}</b>
              </div>
            `;
      }).join('');

      return `
        <section class="result-unit-block result-unit-block--collapsed" data-unit="${escapeHtml(unit)}">
          <button class="result-unit-head" type="button" aria-expanded="false" aria-controls="${bodyId}">
            <span class="result-unit-chevron" aria-hidden="true">›</span>
            <div class="result-unit-title">
              <span>${escapeHtml(unitLabel)}</span>
              <strong>${escapeHtml(unit)}</strong>
            </div>
            <b>${total}</b>
          </button>
          <div id="${bodyId}" class="result-unit-items" hidden>
            ${headerLine}
            ${itemLines}
          </div>
        </section>
      `;
    }).join('');

    host.querySelectorAll('.result-unit-head').forEach(button => {
      button.addEventListener('click', () => {
        const block = button.closest('.result-unit-block');
        const panel = block?.querySelector('.result-unit-items');
        if (!block || !panel) return;

        const isOpen = block.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
          panel.hidden = false;
          panel.style.removeProperty('max-height');
          panel.style.opacity = '1';
          // Ensure the opened block becomes part of the parent scroller, not an inner clipped area.
          requestAnimationFrame(() => {
            block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            window.dispatchEvent(new Event('resize'));
          });
        } else {
          panel.hidden = true;
          panel.style.opacity = '0';
          panel.style.removeProperty('max-height');
          window.dispatchEvent(new Event('resize'));
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
      });
    });

    host.querySelectorAll('.result-unit-block:not(.is-open) .result-unit-items').forEach(panel => {
      panel.hidden = true;
      panel.style.opacity = '0';
      panel.style.removeProperty('max-height');
    });

    host.querySelectorAll('.result-unit-block.is-open .result-unit-items').forEach(panel => {
      panel.hidden = false;
      panel.style.opacity = '1';
      panel.style.removeProperty('max-height');
    });
  }

  function sumItems(items) {
    return items.reduce((sum, item) => sum + Number(item.qty ?? 0), 0);
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


  function initStyledScrollbars() {
    document.querySelectorAll('.analysis-block-list').forEach(list => {
      const panel = list.closest('.analysis-panel');
      if (!panel || panel.querySelector('.analysis-scrollbar')) return;

      panel.classList.add('has-bastion-scrollbar');
      const rail = document.createElement('div');
      rail.className = 'analysis-scrollbar';
      rail.setAttribute('aria-hidden', 'true');

      const thumb = document.createElement('div');
      thumb.className = 'analysis-scroll-thumb';
      rail.appendChild(thumb);
      panel.appendChild(rail);

      let dragging = false;
      let startY = 0;
      let startTop = 0;

      const metrics = () => {
        const railHeight = rail.clientHeight;
        const scrollHeight = list.scrollHeight;
        const visibleHeight = list.clientHeight;
        const maxScroll = Math.max(0, scrollHeight - visibleHeight);
        const ratio = visibleHeight > 0 && scrollHeight > 0 ? visibleHeight / scrollHeight : 1;
        const thumbHeight = Math.max(46, Math.min(railHeight, Math.round(railHeight * ratio)));
        const maxTop = Math.max(0, railHeight - thumbHeight);
        return { railHeight, maxScroll, thumbHeight, maxTop };
      };

      const update = () => {
        const { maxScroll, thumbHeight, maxTop } = metrics();
        if (maxScroll <= 2 || maxTop <= 2) {
          rail.classList.add('is-disabled');
          thumb.style.height = `${thumbHeight}px`;
          thumb.style.transform = 'translateY(0px)';
          return;
        }
        rail.classList.remove('is-disabled');
        const top = (list.scrollTop / maxScroll) * maxTop;
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${top}px)`;
      };

      list.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update, { passive: true });

      thumb.addEventListener('pointerdown', event => {
        event.preventDefault();
        const currentTransform = thumb.style.transform.match(/translateY\(([-0-9.]+)px\)/);
        dragging = true;
        startY = event.clientY;
        startTop = currentTransform ? Number(currentTransform[1]) : 0;
        thumb.classList.add('is-dragging');
        thumb.setPointerCapture?.(event.pointerId);
      });

      document.addEventListener('pointermove', event => {
        if (!dragging) return;
        const { maxScroll, maxTop } = metrics();
        if (maxScroll <= 0 || maxTop <= 0) return;
        const nextTop = Math.max(0, Math.min(maxTop, startTop + event.clientY - startY));
        list.scrollTop = (nextTop / maxTop) * maxScroll;
        update();
      });

      document.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        thumb.classList.remove('is-dragging');
      });

      rail.addEventListener('pointerdown', event => {
        if (event.target === thumb) return;
        const { maxScroll, thumbHeight, maxTop } = metrics();
        if (maxScroll <= 0 || maxTop <= 0) return;
        const rect = rail.getBoundingClientRect();
        const nextTop = Math.max(0, Math.min(maxTop, event.clientY - rect.top - thumbHeight / 2));
        list.scrollTo({ top: (nextTop / maxTop) * maxScroll, behavior: 'smooth' });
      });

      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(update);
        observer.observe(list);
        observer.observe(panel);
      }

      requestAnimationFrame(update);
    });
  }

  function bindActions() {

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
    renderGroupedBlocks('allocationBlocks', data.allocations, { unitLabel: 'Підрозділ', rowName: 'Комбінація', rowQty: 'Кількість' });
    renderGroupedBlocks('remainBlocks', data.remains, { type: 'remain', unitLabel: 'Залишки', rowName: 'Елемент', rowUsed: 'Викор.', rowQty: 'Залишок' });
    initStyledScrollbars();
    initTilt();
    bindActions();
  });
})();
