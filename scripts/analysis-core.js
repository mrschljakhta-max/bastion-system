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

  let currentAnalysisData = null;


  function readStoredResult() {
    const keys = [
      'bastion.calculation.result',
      'bastion.analysis.result',
      'bastionCalculatorResult',
      'bastionAnalysisResult'
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
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

  function makeExportData() {
    const kpi = {
      maxKits: document.getElementById('kpiKits')?.textContent?.trim() || '',
      bestRange: document.getElementById('kpiRange')?.textContent?.trim() || '',
      bottleneck: document.getElementById('kpiBottleneck')?.textContent?.trim() || '',
      stockRemain: document.getElementById('kpiRemain')?.textContent?.trim() || ''
    };

    const allocation = currentAnalysisData?.allocations || [];
    const remains = currentAnalysisData?.remains || [];

    return {
      kpi,
      distribution: allocation.flatMap(group => (group.items || []).map(item => ({
        unit: group.unit,
        combination: item.name,
        quantity: Number(item.qty ?? 0)
      }))),
      remains: remains.flatMap(group => (group.items || []).map(item => ({
        unit: group.unit,
        element: item.name,
        used: Number(item.used ?? item.consumed ?? item.spent ?? item.issued ?? 0),
        remain: Number(item.qty ?? 0)
      })))
    };
  }

  function downloadBlob(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(rows, headers) {
    return [
      headers.map(h => csvEscape(h.label)).join(';'),
      ...rows.map(row => headers.map(h => csvEscape(row[h.key])).join(';'))
    ].join('\n');
  }

  function exportJson() {
    downloadBlob('bastion-analysis.json', JSON.stringify(makeExportData(), null, 2), 'application/json;charset=utf-8');
  }

  function exportCsv() {
    const data = makeExportData();
    const parts = [];
    parts.push('KPI');
    parts.push(toCsv([
      { metric: 'Макс. комплектів', value: data.kpi.maxKits },
      { metric: 'Найкраща дальність', value: data.kpi.bestRange },
      { metric: 'Обмежувальний елемент', value: data.kpi.bottleneck },
      { metric: 'Залишок складу', value: data.kpi.stockRemain }
    ], [{ key: 'metric', label: 'Показник' }, { key: 'value', label: 'Значення' }]));
    parts.push('\nРозподіл');
    parts.push(toCsv(data.distribution, [
      { key: 'unit', label: 'Підрозділ' },
      { key: 'combination', label: 'Комбінація' },
      { key: 'quantity', label: 'Кількість' }
    ]));
    parts.push('\nЗалишки');
    parts.push(toCsv(data.remains, [
      { key: 'unit', label: 'Підрозділ' },
      { key: 'element', label: 'Елемент' },
      { key: 'used', label: 'Використано' },
      { key: 'remain', label: 'Залишок' }
    ]));
    downloadBlob('bastion-analysis.csv', '\ufeff' + parts.join('\n\n'), 'text/csv;charset=utf-8');
  }

  function tableHtml(title, rows, headers) {
    const head = headers.map(h => `<th>${escapeHtml(h.label)}</th>`).join('');
    const body = rows.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(row[h.key])}</td>`).join('')}</tr>`).join('');
    return `<h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function makeWorksheetXml(rows, headers) {
    const allRows = [headers.map(h => h.label), ...rows.map(row => headers.map(h => row[h.key]))];
    const widths = headers.map((header, index) => {
      const maxLen = Math.max(
        String(header.label || '').length,
        ...rows.map(row => String(row[header.key] ?? '').length)
      );
      return Math.min(Math.max(maxLen + 4, 12), 42);
    });
    const cols = widths.map((width, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`).join('');
    const rowXml = allRows.map((cells, rowIndex) => {
      const style = rowIndex === 0 ? ' s="1"' : '';
      const height = rowIndex === 0 ? ' ht="22" customHeight="1"' : ' ht="20" customHeight="1"';
      const cellsXml = cells.map(cell => {
        const value = cell ?? '';
        if (typeof value === 'number' && Number.isFinite(value)) return `<c${style}><v>${value}</v></c>`;
        const numeric = String(value).trim().replace(',', '.');
        if (numeric && /^-?\d+(\.\d+)?$/.test(numeric)) return `<c${style}><v>${numeric}</v></c>`;
        return `<c t="inlineStr"${style}><is><t>${xmlEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}"${height}>${cellsXml}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
  }

  function crc32(input) {
    const table = crc32.table || (crc32.table = (() => {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
      }
      return table;
    })());
    let c = 0xffffffff;
    for (let i = 0; i < input.length; i++) c = table[(c ^ input[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

  function createZip(entries) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    const push = bytes => { chunks.push(Uint8Array.from(bytes)); offset += bytes.length; };
    const pushBytes = bytes => { chunks.push(bytes); offset += bytes.length; };

    entries.forEach(entry => {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
      const crc = crc32(dataBytes);
      const localOffset = offset;
      push([0x50,0x4b,0x03,0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(dataBytes.length), ...u32(dataBytes.length), ...u16(nameBytes.length), ...u16(0)]);
      pushBytes(nameBytes);
      pushBytes(dataBytes);
      central.push({ nameBytes, crc, size: dataBytes.length, offset: localOffset });
    });

    const centralStart = offset;
    central.forEach(entry => {
      push([0x50,0x4b,0x01,0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(entry.crc), ...u32(entry.size), ...u32(entry.size), ...u16(entry.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(entry.offset)]);
      pushBytes(entry.nameBytes);
    });
    const centralSize = offset - centralStart;
    push([0x50,0x4b,0x05,0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(centralSize), ...u32(centralStart), ...u16(0)]);
    return new Blob(chunks, { type: 'application/zip' });
  }

  function exportExcel() {
    const data = makeExportData();
    const sheets = [
      {
        name: 'KPI',
        rows: [
          { metric: 'Макс. комплектів', value: data.kpi.maxKits },
          { metric: 'Найкраща дальність', value: data.kpi.bestRange },
          { metric: 'Обмежувальний елемент', value: data.kpi.bottleneck },
          { metric: 'Залишок складу', value: data.kpi.stockRemain }
        ],
        headers: [{ key: 'metric', label: 'Показник' }, { key: 'value', label: 'Значення' }]
      },
      {
        name: 'Distribution',
        rows: data.distribution,
        headers: [
          { key: 'unit', label: 'Підрозділ' },
          { key: 'combination', label: 'Комбінація' },
          { key: 'quantity', label: 'Кількість' }
        ]
      },
      {
        name: 'Remains',
        rows: data.remains,
        headers: [
          { key: 'unit', label: 'Підрозділ' },
          { key: 'element', label: 'Елемент' },
          { key: 'used', label: 'Використано' },
          { key: 'remain', label: 'Залишок' }
        ]
      }
    ];

    const workbookSheets = sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
    const workbookRels = sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    const overrides = sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');

    const entries = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFF4F55"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>` }
    ];
    sheets.forEach((sheet, index) => entries.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: makeWorksheetXml(sheet.rows, sheet.headers) }));
    downloadBlob('bastion-analysis.xlsx', createZip(entries), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  function splitTextForCanvas(ctx, text, maxWidth) {
    const words = String(text ?? '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function renderPdfPages(data) {
    const pageW = 1240;
    const pageH = 1754;
    const marginX = 58;
    const topY = 54;
    const bottomY = pageH - 78;
    const contentW = pageW - marginX * 2;
    const pages = [];
    let canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    let ctx = canvas.getContext('2d');
    let y = 0;
    let pageNo = 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString('uk-UA');
    const timeStr = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    function text(value) {
      return String(value ?? '').trim();
    }

    function groupRows(rows, key) {
      const map = new Map();
      (rows || []).forEach(row => {
        const unit = text(row[key]) || 'Без підрозділу';
        if (!map.has(unit)) map.set(unit, []);
        map.get(unit).push(row);
      });
      return [...map.entries()].map(([unit, items]) => ({ unit, items }));
    }

    function sum(rows, field) {
      return (rows || []).reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
    }

    function drawRoundRect(x, y0, w, h, r = 14, fill = true, stroke = true) {
      ctx.beginPath();
      ctx.moveTo(x + r, y0);
      ctx.lineTo(x + w - r, y0);
      ctx.quadraticCurveTo(x + w, y0, x + w, y0 + r);
      ctx.lineTo(x + w, y0 + h - r);
      ctx.quadraticCurveTo(x + w, y0 + h, x + w - r, y0 + h);
      ctx.lineTo(x + r, y0 + h);
      ctx.quadraticCurveTo(x, y0 + h, x, y0 + h - r);
      ctx.lineTo(x, y0 + r);
      ctx.quadraticCurveTo(x, y0, x + r, y0);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }

    function drawHeader() {
      pageNo += 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageW, pageH);

      ctx.fillStyle = '#f5f6f8';
      ctx.fillRect(0, 0, pageW, 112);

      ctx.fillStyle = '#d8232f';
      ctx.fillRect(marginX, 96, contentW, 3);

      ctx.fillStyle = '#d8232f';
      ctx.font = '700 42px Arial';
      ctx.fillText('BASTION', marginX, 58);

      ctx.fillStyle = '#111923';
      ctx.font = '700 24px Arial';
      ctx.fillText('АНАЛІТИЧНИЙ ЗВІТ', marginX + 220, 58);

      ctx.fillStyle = '#111923';
      ctx.font = '700 34px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('АНАЛІЗ РОЗРАХУНКУ', pageW - marginX, 58);
      ctx.textAlign = 'left';

      ctx.globalAlpha = 0.035;
      ctx.fillStyle = '#d8232f';
      ctx.font = '900 150px Arial';
      ctx.fillText('BASTION', 170, 930);
      ctx.globalAlpha = 1;

      y = 142;
    }

    function drawFooter() {
      ctx.strokeStyle = '#d8232f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, pageH - 58);
      ctx.lineTo(pageW - marginX, pageH - 58);
      ctx.stroke();

      ctx.fillStyle = '#111923';
      ctx.font = '16px Arial';
      ctx.fillText('bastion-system.com', marginX, pageH - 30);
      ctx.fillText(`Дата: ${dateStr}`, marginX + 260, pageH - 30);
      ctx.fillText(`Час: ${timeStr}`, marginX + 455, pageH - 30);
      ctx.fillText('BASTION SYSTEM', pageW - marginX - 210, pageH - 30);

      ctx.textAlign = 'center';
      ctx.fillText(`Сторінка ${pageNo}`, pageW / 2, pageH - 30);
      ctx.textAlign = 'left';
    }

    function pushPage() {
      drawFooter();
      pages.push(canvas.toDataURL('image/jpeg', 0.94));
      canvas = document.createElement('canvas');
      canvas.width = pageW;
      canvas.height = pageH;
      ctx = canvas.getContext('2d');
      drawHeader();
    }

    function ensure(height) {
      if (y + height > bottomY) pushPage();
    }

    function sectionTitle(label, title) {
      ensure(78);
      ctx.fillStyle = '#d8232f';
      ctx.font = '700 18px Arial';
      ctx.fillText(label.toUpperCase(), marginX, y);
      y += 30;

      ctx.fillStyle = '#111923';
      ctx.font = '900 38px Arial';
      ctx.fillText(title.toUpperCase(), marginX, y);
      y += 28;

      ctx.strokeStyle = '#e3e5e8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(pageW - marginX, y);
      ctx.stroke();
      y += 26;
    }

    function drawKpiCards() {
      const cards = [
        ['МАКС. КОМПЛЕКТІВ', data.kpi.maxKits, 'згенеровано комплектів'],
        ['НАЙКРАЩА ДАЛЬНІСТЬ', data.kpi.bestRange, 'активний рецепт'],
        ['ОБМЕЖУВАЛЬНИЙ ЕЛЕМЕНТ', data.kpi.bottleneck, 'вузьке місце'],
        ['ЗАЛИШОК СКЛАДУ', data.kpi.stockRemain, 'після розрахунку']
      ];

      const gap = 18;
      const w = (contentW - gap * 3) / 4;
      const h = 128;
      ensure(h + 28);

      cards.forEach((card, idx) => {
        const x = marginX + idx * (w + gap);

        ctx.fillStyle = '#111923';
        ctx.strokeStyle = '#d8232f';
        ctx.lineWidth = 2;
        drawRoundRect(x, y, w, h, 16, true, true);

        ctx.fillStyle = '#d8232f';
        ctx.font = '700 17px Arial';
        ctx.fillText(card[0], x + 20, y + 32);

        ctx.fillStyle = idx === 2 ? '#f2bb4f' : '#ffffff';
        ctx.font = '900 42px Arial';
        ctx.fillText(text(card[1]) || '—', x + 20, y + 78);

        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.font = '700 15px Arial';
        ctx.fillText(card[2], x + 20, y + 104);
      });

      y += h + 34;
    }

    function tableHeader(cols, widths) {
      ensure(42);
      let x = marginX;
      ctx.fillStyle = '#111923';
      ctx.strokeStyle = '#cfd4da';
      ctx.lineWidth = 1.2;
      ctx.fillRect(marginX, y, contentW, 42);
      cols.forEach((c, i) => {
        ctx.strokeRect(x, y, widths[i], 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 16px Arial';
        ctx.fillText(c, x + 12, y + 27);
        x += widths[i];
      });
      y += 42;
    }

    function wrapLines(str, width, font = '18px Arial') {
      ctx.font = font;
      return splitTextForCanvas(ctx, text(str), width);
    }

    function tableRow(cols, widths, opts = {}) {
      const lineH = 24;
      const font = opts.bold ? '700 18px Arial' : '18px Arial';
      const wrapped = cols.map((c, i) => wrapLines(c, widths[i] - 22, font));
      const h = Math.max(36, Math.max(...wrapped.map(v => v.length)) * lineH + 16);
      ensure(h);
      let x = marginX;
      ctx.fillStyle = opts.fill || '#ffffff';
      ctx.strokeStyle = '#dfe2e6';
      ctx.lineWidth = 1;
      ctx.fillRect(marginX, y, contentW, h);
      cols.forEach((c, i) => {
        ctx.strokeRect(x, y, widths[i], h);
        ctx.fillStyle = opts.color || '#111923';
        ctx.font = font;
        wrapped[i].forEach((line, idx) => ctx.fillText(line, x + 12, y + 24 + idx * lineH));
        x += widths[i];
      });
      y += h;
    }

    function groupTitle(name, total, label = 'усього') {
      ensure(62);
      ctx.fillStyle = '#f7f7f8';
      ctx.strokeStyle = '#d8232f';
      ctx.lineWidth = 1.8;
      drawRoundRect(marginX, y, contentW, 52, 10, true, true);

      ctx.fillStyle = '#d8232f';
      ctx.font = '700 14px Arial';
      ctx.fillText(label.toUpperCase(), marginX + 16, y + 20);

      ctx.fillStyle = '#111923';
      ctx.font = '900 24px Arial';
      ctx.fillText(name, marginX + 16, y + 43);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#111923';
      ctx.font = '900 28px Arial';
      ctx.fillText(String(total ?? 0), pageW - marginX - 18, y + 36);
      ctx.textAlign = 'left';

      y += 66;
    }

    function drawDistribution() {
      sectionTitle('distribution', 'Хто що отримує');
      const groups = groupRows(data.distribution, 'unit');
      groups.forEach(group => {
        const total = sum(group.items, 'quantity');
        groupTitle(group.unit, total, 'Підрозділ');
        tableHeader(['Комбінація', 'Кількість'], [contentW - 190, 190]);
        group.items.forEach((row, index) => {
          tableRow([row.combination, row.quantity], [contentW - 190, 190], {
            fill: index % 2 ? '#ffffff' : '#fafafa'
          });
        });
        y += 18;
      });
    }

    function drawRemains() {
      sectionTitle('remain', 'Залишки');
      const groups = groupRows(data.remains, 'unit');
      groups.forEach(group => {
        const total = sum(group.items, 'remain');
        groupTitle(group.unit, total, 'Залишки');
        tableHeader(['Елемент', 'Використано', 'Залишок'], [contentW - 380, 190, 190]);
        group.items.forEach((row, index) => {
          const remain = Number(row.remain || 0);
          const fill = remain <= 10 ? '#fff2f2' : (index % 2 ? '#ffffff' : '#fafafa');
          tableRow([row.element, row.used, row.remain], [contentW - 380, 190, 190], { fill });
        });
        y += 18;
      });
    }

    drawHeader();
    drawKpiCards();
    drawDistribution();
    drawRemains();

    drawFooter();
    pages.push(canvas.toDataURL('image/jpeg', 0.94));
    return pages;
  }
  function makePdfFromJpegs(dataUrls) {
    const enc = new TextEncoder();
    const objects = [];
    const pageKids = [];
    const images = dataUrls.map(url => Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0)));
    let objId = 3;
    images.forEach((img, idx) => {
      const pageId = objId++;
      const imageId = objId++;
      const contentId = objId++;
      pageKids.push(`${pageId} 0 R`);
      objects[pageId] = enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${idx} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      const imgHeader = enc.encode(`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);
      const imgFooter = enc.encode(`\nendstream`);
      const imgObj = new Uint8Array(imgHeader.length + img.length + imgFooter.length);
      imgObj.set(imgHeader, 0); imgObj.set(img, imgHeader.length); imgObj.set(imgFooter, imgHeader.length + img.length);
      objects[imageId] = imgObj;
      const content = `q\n595 0 0 842 0 0 cm\n/Im${idx} Do\nQ`;
      objects[contentId] = enc.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    objects[1] = enc.encode('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2] = enc.encode(`<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${images.length} >>`);

    const chunks = [enc.encode('%PDF-1.4\n')];
    const offsets = [0];
    let pos = chunks[0].length;
    for (let i = 1; i < objects.length; i++) {
      if (!objects[i]) continue;
      offsets[i] = pos;
      const head = enc.encode(`${i} 0 obj\n`);
      const foot = enc.encode('\nendobj\n');
      chunks.push(head, objects[i], foot);
      pos += head.length + objects[i].length + foot.length;
    }
    const xrefStart = pos;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++) xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    chunks.push(enc.encode(xref));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function exportPdf() {
    const data = makeExportData();
    const pages = renderPdfPages(data);
    const pdf = makePdfFromJpegs(pages);
    downloadBlob('bastion-analysis.pdf', pdf, 'application/pdf');
  }

  function openExportModal() {
    const modal = document.getElementById('analysisExportModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeExportModal() {
    const modal = document.getElementById('analysisExportModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindActions() {
    const exportBtn = document.getElementById('analysisExport');
    if (exportBtn) exportBtn.addEventListener('click', openExportModal);

    document.querySelectorAll('[data-close-export]').forEach(btn => btn.addEventListener('click', closeExportModal));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeExportModal();
    });

    document.querySelectorAll('[data-export-format]').forEach(button => {
      button.addEventListener('click', () => {
        const format = button.dataset.exportFormat;
        if (format === 'json') exportJson();
        if (format === 'csv') exportCsv();
        if (format === 'xlsx') exportExcel();
        if (format === 'pdf') exportPdf();
        closeExportModal();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const data = readStoredResult();
    currentAnalysisData = data;
    renderKpis(data);
    renderGroupedBlocks('allocationBlocks', data.allocations, { unitLabel: 'Підрозділ', rowName: 'Комбінація', rowQty: 'Кількість' });
    renderGroupedBlocks('remainBlocks', data.remains, { type: 'remain', unitLabel: 'Залишки', rowName: 'Елемент', rowUsed: 'Викор.', rowQty: 'Залишок' });
    initStyledScrollbars();
    initTilt();
    bindActions();
  });
})();
