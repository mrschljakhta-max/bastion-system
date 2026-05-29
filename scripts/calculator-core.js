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

  const updateRange = (input) => {
    const out = byId(`${input.id}Out`);
    if (out) out.value = input.value;
  };

  document.querySelectorAll('.calc-range-row input[type="range"]').forEach((input) => {
    updateRange(input);
    input.addEventListener('input', () => updateRange(input));
  });

  document.querySelectorAll('[data-stepper]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = byId(button.dataset.stepper);
      if (!input) return;
      const delta = Number(button.dataset.delta || 0) * 10;
      const next = Math.max(
        Number(input.min || 0),
        Math.min(Number(input.max || 1000), Number(input.value || 0) + delta)
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
  const tuningButton = byId('calcLinkTuningButton');
  const selectAllButton = byId('calcLinkSelectAll');
  const clearAllButton = byId('calcLinkClearAll');

  const currentPreset = () => {
    const key = linkSelect?.value || 'distance';
    return linkPresets[key] || linkPresets.distance;
  };

  const closePopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = true;
    componentsBadge.setAttribute('aria-expanded', 'false');
  };

  const openPopover = () => {
    if (!popover || !componentsBadge) return;
    popover.hidden = false;
    componentsBadge.setAttribute('aria-expanded', 'true');
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
    renderRows();
    linkModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('calc-modal-open');
  };

  const closeModal = () => {
    if (!linkModal) return;
    linkModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('calc-modal-open');
  };

  if (componentsBadge) {
    componentsBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      if (popover?.hidden) openPopover();
      else closePopover();
    });
  }

  document.addEventListener('click', (event) => {
    if (!popover || popover.hidden) return;
    if (event.target instanceof Node && (popover.contains(event.target) || componentsBadge?.contains(event.target))) return;
    closePopover();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closePopover();
    closeModal();
  });

  if (linkSelect) {
    linkSelect.addEventListener('change', () => {
      closePopover();
      renderComponents();
    });
    renderComponents();
  }

  tuningButton?.addEventListener('click', openModal);
  document.querySelectorAll('[data-close-calc-link-modal]').forEach((item) => item.addEventListener('click', closeModal));

  selectAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = true);
    renderRows();
  });

  clearAllButton?.addEventListener('click', () => {
    currentPreset().rows.forEach((row) => row.enabled = false);
    renderRows();
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
