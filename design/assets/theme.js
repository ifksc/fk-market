// FK.market — общий скрипт: тема, мобильное меню, общие утилиты
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem('fk-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') root.classList.add('dark');

  window.FK = {
    toggleTheme() {
      root.classList.toggle('dark');
      localStorage.setItem('fk-theme', root.classList.contains('dark') ? 'dark' : 'light');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
      el.addEventListener('click', () => window.FK.toggleTheme());
    });
    // Мобильное меню
    document.querySelectorAll('[data-menu-toggle]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = document.getElementById(el.dataset.menuToggle);
        if (target) target.classList.toggle('hidden');
      });
    });
  });
})();
