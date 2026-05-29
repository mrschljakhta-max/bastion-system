(() => {
  const byId = (id) => document.getElementById(id);

  const linkPresets = {
    distance: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера']
    },
    nato155: {
      components: ['Снаряди', 'Заряди', 'Підривники', 'Праймера', 'Модулі зарядів', 'Додаткові елементи']
    },
    reserve: {
      components: ['Снаряди', 'Заряди', 'Підривники']
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

  const usedBlock = byId('calcUsedBlock');
  const usedToggle = byId('calcUsedToggle');
  const usedComponents = byId('calcUsedComponents');

  const renderUsedComponents = (items) => {
    if (!usedComponents) return;
    usedComponents.innerHTML = '';
    items.forEach((name) => {
      const item = document.createElement('span');
      item.innerHTML = '<i aria-hidden="true">◆</i> ';
      item.append(document.createTextNode(name));
      usedComponents.appendChild(item);
    });
  };

  if (usedToggle && usedBlock) {
    usedToggle.addEventListener('click', () => {
      const expanded = usedBlock.classList.toggle('is-expanded');
      usedToggle.setAttribute('aria-expanded', String(expanded));
    });
  }

  const linkSelect = byId('calcLinkSelect');
  if (linkSelect) {
    const syncLink = () => {
      const preset = linkPresets[linkSelect.value] || linkPresets.distance;
      renderUsedComponents(preset.components);
      if (usedBlock && usedToggle) {
        usedBlock.classList.remove('is-expanded');
        usedToggle.setAttribute('aria-expanded', 'false');
      }
    };
    linkSelect.addEventListener('change', syncLink);
    syncLink();
  }

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
