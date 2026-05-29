
(() => {
  const byId = (id) => document.getElementById(id);

  const linkStats = {
    distance: { rows: 148, cats: 4, components: 23, recipes: 612 },
    nato155: { rows: 96, cats: 4, components: 18, recipes: 384 },
    reserve: { rows: 42, cats: 3, components: 11, recipes: 128 }
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
      const next = Math.max(Number(input.min || 0), Math.min(Number(input.max || 1000), Number(input.value || 0) + delta));
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  const linkSelect = byId('calcLinkSelect');
  if (linkSelect) {
    linkSelect.addEventListener('change', () => {
      const stats = linkStats[linkSelect.value] || linkStats.distance;
      byId('calcRows').textContent = stats.rows;
      byId('calcCats').textContent = stats.cats;
      byId('calcComponents').textContent = stats.components;
      byId('calcRecipes').textContent = stats.recipes;
    });
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
