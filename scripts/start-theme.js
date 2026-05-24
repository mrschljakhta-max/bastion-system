(function () {
  const STORAGE_KEY = 'bastion:start-theme';
  const root = document.documentElement;
  const toggle = document.getElementById('startThemeToggle');

  function forceDarkTheme() {
    root.setAttribute('data-theme', 'dark');
    if (document.body) document.body.setAttribute('data-theme', 'dark');
    try { localStorage.setItem(STORAGE_KEY, 'dark'); } catch (error) {}
  }

  function showThemeNotice() {
    let toast = document.querySelector('.start-theme-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'start-theme-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = 'Поки доступна тільки темна тема. Світла тема буде підключена після підготовки окремих елементів.';
    toast.classList.add('is-visible');
    window.clearTimeout(showThemeNotice._timer);
    showThemeNotice._timer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  forceDarkTheme();

  if (toggle) {
    toggle.setAttribute('aria-pressed', 'false');
    toggle.dataset.theme = 'dark';
    toggle.setAttribute('aria-label', 'Інформація про теми');

    const label = toggle.querySelector('[data-theme-label]');
    if (label) label.textContent = 'ТЕМНА ТЕМА';

    toggle.addEventListener('click', function () {
      forceDarkTheme();
      showThemeNotice();
    });
  }
})();
