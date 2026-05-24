(function () {
  const STORAGE_KEY = 'bastion:start-theme';
  const SITE_STORAGE_KEY = 'bastion_theme';
  const root = document.documentElement;
  const toggle = document.getElementById('startThemeToggle');
  const mark = document.querySelector('.brand-mark');

  const assets = {
    dark: {
      label: 'ТЕМНА ТЕМА',
      mark: './assets/logo/bastion-mark.svg'
    },
    light: {
      label: 'СВІТЛА ТЕМА',
      mark: './assets/logo/bastion-mark-light.png'
    }
  };

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function getSavedTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(SITE_STORAGE_KEY) || 'dark');
    } catch (error) {
      return 'dark';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(SITE_STORAGE_KEY, theme);
    } catch (error) {}
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    root.setAttribute('data-theme', nextTheme);
    if (document.body) document.body.setAttribute('data-theme', nextTheme);
    saveTheme(nextTheme);

    if (toggle) {
      toggle.dataset.theme = nextTheme;
      toggle.setAttribute('aria-pressed', String(nextTheme === 'light'));
      toggle.setAttribute('aria-label', nextTheme === 'light' ? 'Увімкнена світла тема' : 'Увімкнена темна тема');

      const label = toggle.querySelector('[data-theme-label]');
      if (label) label.textContent = assets[nextTheme].label;
    }

    if (mark && assets[nextTheme].mark) {
      mark.setAttribute('src', assets[nextTheme].mark);
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
