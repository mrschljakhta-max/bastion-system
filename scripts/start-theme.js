(function () {
  const STORAGE_KEY = 'bastion:start-theme';
  const root = document.documentElement;
  const toggle = document.getElementById('startThemeToggle');

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function getSavedTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // localStorage may be blocked; visual switching should still work.
    }
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    root.setAttribute('data-theme', nextTheme);
    document.body && document.body.setAttribute('data-theme', nextTheme);

    if (toggle) {
      const isLight = nextTheme === 'light';
      toggle.setAttribute('aria-pressed', String(isLight));
      toggle.dataset.theme = nextTheme;

      const label = toggle.querySelector('[data-theme-label]');
      if (label) {
        label.textContent = isLight ? 'СВІТЛА ТЕМА' : 'ТЕМНА ТЕМА';
      }
    }
  }

  const initialTheme = getSavedTheme();
  applyTheme(initialTheme);

  if (toggle) {
    toggle.addEventListener('click', function () {
      const current = normalizeTheme(root.getAttribute('data-theme'));
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      saveTheme(next);
    });
  }
})();
