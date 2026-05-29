(() => {
  const byId = (id) => document.getElementById(id);

  const linkPresets = {
    distance: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера'],
      rows: [
        { id: 'r1', name: 'SN4 + ZA1 + PID1 + PR2', range: '24 200 м', enabled: true },
        { id: 'r2', name: 'SN7 + ZA8 + PID5 + PR1', range: '27 400 м', enabled: true },
        { id: 'r3', name: 'SN2 + ZA3 + PID2 + PR0', range: '14 500 м', enabled: true },
        { id: 'r4', name: 'SN6 + ZA10 + PID2 + PR1', range: '22 000 м', enabled: true },
        { id: 'r5', name: 'SN5 + ZA4 + PID3 + PR2', range: '18 500 м', enabled: true },
        { id: 'r6', name: 'SN8 + ZA6 + PID4 + PR0', range: '20 800 м', enabled: true }
      ]
    },
    nato155: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера', 'Модулі зарядів', 'Додаткові елементи'],
      rows: [
        { id: 'n1', name: '155 HE + Charge A + Fuse M', range: '23 000 м', enabled: true },
        { id: 'n2', name: '155 ERFB + Charge B + Fuse V', range: '31 000 м', enabled: true },
        { id: 'n3', name: '155 Smoke + Charge A + Fuse T', range: '18 000 м', enabled: true },
        { id: 'n4', name: '155 Illum + Charge C + Fuse T', range: '21 500 м', enabled: true }
      ]
    },
    reserve: {
      components: ['Снаряди', 'Заряди', 'Підривники'],
      rows: [
        { id: 'q1', name: 'Reserve A + Base charge + Fuse 1', range: '12 000 м', enabled: true },
        { id: 'q2', name: 'Reserve B + Base charge + Fuse 2', range: '15 000 м', enabled: true },
        { id: 'q3', name: 'Reserve C + Boost charge + Fuse 2', range: '17 500 м', enabled: true }
      ]
    }
  };

  const unitPresets = [
    { id: 'u1', name: '1 САДн', enabled: true },
    { id: 'u2', name: '2 САДн', enabled: true },
    { id: 'u3', name: '3 САДн', enabled: true },
    { id: 'u4', name: 'Резерв БК', enabled: true }
  ];

  const clampNumber = (value, min = 0, max = 9999) => {
    const parsed = Number.parseInt(String(value ?? '').replace(/\D+/g, ''), 10);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
  };

  const getLimitValue = (id) => {
    const input = byId(id);
    return input ? clampNumber(input.value, Number(input.min || 0), Number(input.max || 9999)) : 0;
  };

  const updateRange = (input, source = 'range') => {
    const out = byId(`${input.id}Out`);
    if (!out) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 9999);
    const next = clampNumber(source === 'number' ? out.value : input.value, min, max);
    input.value = String(next);
    out.value = String(next);
  };

  document.querySelectorAll('.calc-range-row input[type="range"]').forEach((input) => {
    updateRange(input);
    input.addEventListener('input', () => updateRange(input, 'range'));
    const out = byId(`${input.id}Out`);
    if (out instanceof HTMLInputElement) {
      out.addEventListener('input', () => updateRange(input, 'number'));
      out.addEventListener('blur', () => updateRange(input, 'number'));
    }
  });

  document.querySelectorAll('[data-stepper]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = byId(button.dataset.stepper);
      if (!input) return;
      const delta = Number(button.dataset.delta || 0) * 10;
      const next = Math.max(
        Number(input.min || 0),
        Math.min(Number(input.max || 9999), Number(input.value || 0) + delta)
      );
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  const linkSelect = byId('calcLinkSelect');
  const componentsBadge = byId('calcComponentsBadge');
  const componentsCount = byId('calcComponentsCount');
  const popover = byId('calcComponentsPopover');
  const popoverList = byId('calcComponentsPopoverList');
  const linkModal = byId('calcLinkModal');
  const linkRows = byId('calcLinkRows');
  const unitsBadge = byId('calcUnitsBadge');
  const unitsPopover = byId('calcUnitsPopover');
  const unitsPopoverList = byId('calcUnitsPopoverList');
  const matrixButton = byId('calcMatrixButton');
  const matrixModal = byId('calcMatrixModal');
  const unitRows = byId('calcUnitRows');
  const unitCount = byId('calcUnitCount');
  const tuningButton = byId('calcLinkTuningButton');
  const selectAllButton = byId('calcLinkSelectAll');
  const clearAllButton = byId('calcLinkClearAll');
  const unitsSelectAllButton = byId('calcUnitsSelectAll');
  const unitsClearAllButton = byId('calcUnitsClearAll');
  const unitLimitsButton = byId('calcUnitLimitsButton');
  const unitLimitsModal = byId('calcUnitLimitsModal');
  const unitLimitsRows = byId('calcUnitLimitsRows');
  const unitLimitsState = new Map();
  let unitLimitsInitialized = false;

  const currentPreset = () => {
    const key = linkSelect?.value || 'distance';
    return linkPresets[key] || linkPresets.distance;
  };

  if (popover && popover.parentElement !== document.body) {
    document.body.appendChild(popover);
  }
  if (unitsPopover && unitsPopover.parentElement !== document.body) {
    document.body.appendChild(unitsPopover);
  }

  const placePopover = () => {
    if (!popover || !componentsBadge || popover.hidden) return;
    const rect = componentsBadge.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - 32);
    let left = rect.left;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 16) left = 16;

    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;

    const below = rect.bottom + gap;
    const estimatedHeight = Math.min(popover.offsetHeight || 120, 220);
    const canOpenBelow = below + estimatedHeight < window.innerHeight - 16;
    popover.classList.toggle('is-floating-above', !canOpenBelow);
    popover.style.top = canOpenBelow ? `${below}px` : `${Math.max(16, rect.top - estimatedHeight - gap)}px`;
  };

  const placeUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge || unitsPopover.hidden) return;
    const rect = unitsBadge.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - 32);
    let left = rect.left;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 16) left = 16;
    unitsPopover.style.width = `${width}px`;
    unitsPopover.style.left = `${left}px`;
    const below = rect.bottom + gap;
    const estimatedHeight = Math.min(unitsPopover.offsetHeight || 120, 220);
    const canOpenBelow = below + estimatedHeight < window.innerHeight - 16;
    unitsPopover.classList.toggle('is-floating-above', !canOpenBelow);
    unitsPopover.style.top = canOpenBelow ? `${below}px` : `${Math.max(16, rect.top - estimatedHeight - gap)}px`;
  };

  const closePopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = true;
    componentsBadge.setAttribute('aria-expanded', 'false');
  };

  const closeUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge) return;
    unitsPopover.hidden = true;
    unitsBadge.setAttribute('aria-expanded', 'false');
  };

  const openPopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = false;
    componentsBadge.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(placePopover);
  };

  const openUnitsPopover = () => {
    if (!unitsPopover || !unitsBadge) return;
    unitsPopover.hidden = false;
    unitsBadge.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(placeUnitsPopover);
  };

  const renderComponents = () => {
    const preset = currentPreset();
    if (componentsCount) componentsCount.textContent = String(preset.components.length);
    if (popoverList) {
      popoverList.innerHTML = '';
      preset.components.forEach((name) => {
        const item = document.createElement('span');
        item.textContent = name;
        popoverList.appendChild(item);
      });
    }
  };

  const renderUnits = () => {
    if (unitCount) unitCount.textContent = String(unitPresets.length);
    if (unitsPopoverList) {
      unitsPopoverList.innerHTML = '';
      unitPresets.forEach((unit) => {
        const item = document.createElement('span');
        item.textContent = unit.name;
        unitsPopoverList.appendChild(item);
      });
    }
  };

  const renderUnitRows = () => {
    if (!unitRows) return;
    unitRows.innerHTML = '';
    unitPresets.forEach((unit, index) => {
      const label = document.createElement('label');
      label.className = 'calc-link-row calc-unit-row';
      label.innerHTML = `
        <input type="checkbox" ${unit.enabled ? 'checked' : ''} data-unit-row="${unit.id}">
        <span class="calc-link-row__check" aria-hidden="true"></span>
        <span class="calc-link-row__body">
          <strong>${String(index + 1).padStart(2, '0')} · ${unit.name}</strong>
          <em>${unit.enabled ? 'Увімкнено для обміну' : 'Виключено з обміну'}</em>
        </span>
      `;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        unit.enabled = Boolean(input.checked);
        label.classList.toggle('is-disabled', !unit.enabled);
        const hint = label.querySelector('em');
        if (hint) hint.textContent = unit.enabled ? 'Увімкнено для обміну' : 'Виключено з обміну';
      });
      label.classList.toggle('is-disabled', !unit.enabled);
      unitRows.appendChild(label);
    });
  };
 
  const ensureUnitLimitState = () => {
    if (unitLimitsInitialized) return;
    const globalMin = getLimitValue('calcMin');
    const globalMax = getLimitValue('calcMax');
    unitPresets.forEach((unit) => {
      if (!unitLimitsState.has(unit.id)) {
        unitLimitsState.set(unit.id, { min: globalMin, max: globalMax, touched: false });
      }
    });
    unitLimitsInitialized = true;
  };

  const syncUnitLimitControl = (row, type, source = 'range') => {
    const range = row.querySelector(`[data-unit-limit-range="${type}"]`);
    const number = row.querySelector(`[data-unit-limit-number="${type}"]`);
    if (!(range instanceof HTMLInputElement) || !(number instanceof HTMLInputElement)) return;
    const next = clampNumber(source === 'number' ? number.value : range.value, Number(range.min || 0), Number(range.max || 9999));
    range.value = String(next);
    number.value = String(next);
    const unitId = row.dataset.unitId;
    if (!unitId) return;
    const state = unitLimitsState.get(unitId) || { min: getLimitValue('calcMin'), max: getLimitValue('calcMax'), touched: false };
    state[type] = next;
    state.touched = true;
    unitLimitsState.set(unitId, state);
  };

  const renderUnitLimitRows = () => {
    if (!unitLimitsRows) return;
    ensureUnitLimitState();
    unitLimitsRows.innerHTML = '';
    unitPresets.forEach((unit, index) => {
      const state = unitLimitsState.get(unit.id) || { min: getLimitValue('calcMin'), max: getLimitValue('calcMax'), touched: false };
      const row = document.createElement('article');
      row.className = 'calc-unit-limit-row';
      row.dataset.unitId = unit.id;
      row.innerHTML = `
        <div class="calc-unit-limit-row__title">
          <strong>${String(index + 1).padStart(2, '0')} · ${unit.name}</strong>
          <span>Індивідуальні обмеження</span>
        </div>
        <div class="calc-unit-limit-row__controls">
          <div class="calc-unit-limit-control">
            <span>Мінімум</span>
            <button type="button" data-unit-limit-step="min" data-delta="-10">−</button>
            <input type="range" min="0" max="9999" value="${state.min}" data-unit-limit-range="min" />
            <button type="button" data-unit-limit-step="min" data-delta="10">+</button>
            <input type="number" min="0" max="9999" value="${state.min}" inputmode="numeric" data-unit-limit-number="min" aria-label="Мінімум для ${unit.name}" />
          </div>
          <div class="calc-unit-limit-control">
            <span>Максимум</span>
            <button type="button" data-unit-limit-step="max" data-delta="-10">−</button>
            <input type="range" min="0" max="9999" value="${state.max}" data-unit-limit-range="max" />
            <button type="button" data-unit-limit-step="max" data-delta="10">+</button>
            <input type="number" min="0" max="9999" value="${state.max}" inputmode="numeric" data-unit-limit-number="max" aria-label="Максимум для ${unit.name}" />
          </div>
        </div>
      `;
      row.querySelectorAll('[data-unit-limit-range]').forEach((range) => {
        range.addEventListener('input', () => syncUnitLimitControl(row, range.dataset.unitLimitRange, 'range'));
      });
      row.querySelectorAll('[data-unit-limit-number]').forEach((number) => {
        number.addEventListener('input', () => syncUnitLimitControl(row, number.dataset.unitLimitNumber, 'number'));
        number.addEventListener('blur', () => syncUnitLimitControl(row, number.dataset.unitLimitNumber, 'number'));
      });
      row.querySelectorAll('[data-unit-limit-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const type = button.dataset.unitLimitStep;
          const range = row.querySelector(`[data-unit-limit-range="${type}"]`);
          if (!(range instanceof HTMLInputElement)) return;
          const next = clampNumber(Number(range.value || 0) + Number(button.dataset.delta || 0), Number(range.min || 0), Number(range.max || 9999));
          range.value = String(next);
          syncUnitLimitControl(row, type, 'range');
        });
      });
      unitLimitsRows.appendChild(row);
    });
  };

  const renderRows = () => {
    const preset = currentPreset();
    if (!linkRows) return;
    linkRows.innerHTML = '';
    preset.rows.forEach((row, index) => {
      const label = document.createElement('label');
      label.className = 'calc-link-row';
      label.innerHTML = `
        <input type="checkbox" ${row.enabled ? 'checked' : ''} data-link-row="${row.id}">
        <span class="calc-link-row__check" aria-hidden="true"></span>
        <span class="calc-link-row__body">
          <strong>${String(index + 1).padStart(2, '0')} · ${row.name}</strong>
          <em>Дальність: ${row.range}</em>
        </span>
      `;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        row.enabled = Boolean(input.checked);
        label.classList.toggle('is-disabled', !row.enabled);
      });
      label.classList.toggle('is-disabled', !row.enabled);
      linkRows.appendChild(label);
    });
  };

  const openModal = () => {
    if (!linkModal) return;
    closePopover();
    closeUnitsPopover();
    renderRows();
    linkModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = linkModal.querySelector('[data-close-calc-link-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeModal = () => {
    if (!linkModal) return;
    linkModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (tuningButton instanceof HTMLElement) tuningButton.focus({ preventScroll: true });
  };

  const openMatrixModal = () => {
    if (!matrixModal) return;
    closePopover();
    closeUnitsPopover();
    renderUnitRows();
    matrixModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = matrixModal.querySelector('[data-close-calc-matrix-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeMatrixModal = () => {
    if (!matrixModal) return;
    matrixModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (matrixButton instanceof HTMLElement) matrixButton.focus({ preventScroll: true });
  };


  const openUnitLimitsModal = () => {
    if (!unitLimitsModal) return;
    closePopover();
    closeUnitsPopover();
    renderUnitLimitRows();
    unitLimitsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
    const closeButton = unitLimitsModal.querySelector('[data-close-calc-unit-limits-modal]');
    if (closeButton instanceof HTMLElement) closeButton.focus({ preventScroll: true });
  };

  const closeUnitLimitsModal = () => {
    if (!unitLimitsModal) return;
    unitLimitsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
    if (unitLimitsButton instanceof HTMLElement) unitLimitsButton.focus({ preventScroll: true });
  };

  if (componentsBadge) {
    componentsBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      if (popover?.hidden) openPopover();
      else closePopover();
    });
  }

  if (unitsBadge) {
    unitsBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      if (unitsPopover?.hidden) openUnitsPopover();
      else closeUnitsPopover();
    });
  }

  document.addEventListener('click', (event) => {
    if (popover && !popover.hidden) {
      if (!(event.target instanceof Node && (popover.contains(event.target) || componentsBadge?.contains(event.target)))) closePopover();
    }
    if (unitsPopover && !unitsPopover.hidden) {
      if (!(event.target instanceof Node && (unitsPopover.contains(event.target) || unitsBadge?.contains(event.target)))) closeUnitsPopover();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closePopover();
    closeUnitsPopover();
    closeModal();
    closeMatrixModal();
    closeUnitLimitsModal();
  });

  window.addEventListener('resize', () => { placePopover(); placeUnitsPopover(); });
  window.addEventListener('scroll', () => { placePopover(); placeUnitsPopover(); }, true);

  if (linkSelect) {
    linkSelect.addEventListener('change', () => {
      closePopover();
      closeUnitsPopover();
      renderComponents();
    });
    renderComponents();
  }
  renderUnits();

  tuningButton?.addEventListener('click', openModal);
  matrixButton?.addEventListener('click', openMatrixModal);
  unitLimitsButton?.addEventListener('click', openUnitLimitsModal);
  document.querySelectorAll('[data-close-calc-link-modal]').forEach((item) => item.addEventListener('click', closeModal));
  document.querySelectorAll('[data-close-calc-matrix-modal]').forEach((item) => item.addEventListener('click', closeMatrixModal));
  document.querySelectorAll('[data-close-calc-unit-limits-modal]').forEach((item) => item.addEventListener('click', closeUnitLimitsModal));

  selectAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = true);
    renderRows();
  });

  clearAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = false);
    renderRows();
  });

  unitsSelectAllButton?.addEventListener('click', () => {
    unitPresets.forEach((unit) => unit.enabled = true);
    renderUnitRows();
  });

  unitsClearAllButton?.addEventListener('click', () => {
    unitPresets.forEach((unit) => unit.enabled = false);
    renderUnitRows();
  });

  document.querySelectorAll('.calc-mode').forEach((label) => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.calc-mode').forEach((item) => item.classList.remove('is-active'));
      label.classList.add('is-active');
      const input = label.querySelector('input');
      if (input) input.checked = true;
    });
  });

  const runButton = byId('calcRunButton');
  if (runButton) {
    runButton.addEventListener('click', () => {
      runButton.classList.add('is-loading');
      runButton.innerHTML = '<span aria-hidden="true">▣</span> Розрахунок… <span aria-hidden="true">›</span>';
      window.setTimeout(() => {
        window.location.href = './analysis.html';
      }, 650);
    });
  }
})();
