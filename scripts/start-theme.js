(function () {
  const LEGACY_KEY = 'bastion:start-theme';
  const STORAGE_KEY = 'bastion_theme';
  const root = document.documentElement;
  const toggle = document.getElementById('startThemeToggle');
  const brandMark = document.querySelector('.brand-mark');

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function readTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'dark');
    } catch (error) {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(LEGACY_KEY, theme);
    } catch (error) {}
  }

  function updateBrandMark(theme) {
    if (!brandMark) return;
    const src = theme === 'light' ? brandMark.dataset.lightSrc : brandMark.dataset.darkSrc;
    if (src && brandMark.getAttribute('src') !== src) {
      brandMark.setAttribute('src', src);
    }
  }

  function applyTheme(theme) {
    theme = normalizeTheme(theme);
    root.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    saveTheme(theme);
    updateBrandMark(theme);

    if (toggle) {
      toggle.dataset.theme = theme;
      toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      toggle.setAttribute('aria-label', theme === 'light' ? 'Увімкнена світла тема. Натисніть для темної.' : 'Увімкнена темна тема. Натисніть для світлої.');
      const label = toggle.querySelector('[data-theme-label]');
      if (label) label.textContent = theme === 'light' ? 'СВІТЛА ТЕМА' : 'ТЕМНА ТЕМА';
    }
  }

  applyTheme(readTheme());

  if (toggle) {
    toggle.addEventListener('click', function () {
      const nextTheme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
  }
})();
