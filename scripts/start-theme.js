(function () {
  const STORAGE_KEY = 'bastion:start-theme';
  const GLOBAL_KEY = 'bastion_theme';
  const root = document.documentElement;
  const toggle = document.getElementById('startThemeToggle');

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function getSavedTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(GLOBAL_KEY) || 'dark');
    } catch (error) {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(GLOBAL_KEY, theme);
    } catch (error) {}
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    root.setAttribute('data-theme', nextTheme);
    if (document.body) document.body.setAttribute('data-theme', nextTheme);
    saveTheme(nextTheme);

    if (toggle) {
      toggle.dataset.theme = nextTheme;
      toggle.setAttribute('aria-pressed', nextTheme === 'light' ? 'true' : 'false');
      toggle.setAttribute('aria-label', nextTheme === 'light' ? 'Увімкнена світла тема' : 'Увімкнена темна тема');

      const label = toggle.querySelector('[data-theme-label]');
      if (label) label.textContent = nextTheme === 'light' ? 'СВІТЛА ТЕМА' : 'ТЕМНА ТЕМА';
    }
  }

  applyTheme(getSavedTheme());

  if (toggle) {
    toggle.addEventListener('click', function () {
      const current = normalizeTheme(root.getAttribute('data-theme'));
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }
})();
