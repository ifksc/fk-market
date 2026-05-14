// FK.market — общий layout: шапка и футер
(function () {
  function logoMark() {
    return `<a href="index.html" class="flex items-center gap-2 shrink-0">
      <img src="assets/logo-a.svg" alt="FK.market" class="w-9 h-9" />
      <span class="fk-logo text-xl hidden sm:block">FK.market</span>
    </a>`;
  }

  function header(active) {
    const link = (href, label, key) => {
      const cls = active === key
        ? 'text-brand-600 dark:text-white font-medium'
        : 'text-gray-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-white';
      return `<a href="${href}" class="${cls}">${label}</a>`;
    };
    return `
<header class="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-gray-200 dark:border-slate-800">
  <div class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
    ${logoMark()}
    <nav class="hidden md:flex items-center gap-5 text-sm">
      ${link('catalog.html','Каталог','catalog')}
      <a href="catalog.html#ai" class="flex items-center gap-1.5 ${active==='ai'?'text-brand-600 dark:text-white font-medium':'text-gray-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-white'}">ИИ <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full fk-grad-btn text-white">NEW</span></a>
      ${link('catalog.html#vpn','VPN','vpn')}
      ${link('catalog.html#skins','Скины','skins')}
      ${link('catalog.html#keys','Ключи','keys')}
      ${link('catalog.html#subs','Подписки','subs')}
    </nav>
    <div class="flex-1">
      <div class="relative max-w-md ml-auto">
        <input type="search" placeholder="Поиск: Steam, VPN, ключи…"
          class="w-full h-10 pl-10 pr-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
    </div>
    <div class="flex items-center gap-1">
      <button data-theme-toggle class="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Тема">
        <svg class="w-5 h-5 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
        <svg class="w-5 h-5 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>
      <a href="cart.html" class="relative w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Корзина">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
        <span class="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">2</span>
      </a>
      <a href="account.html" class="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Профиль">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
      </a>
      <a href="login.html" class="hidden sm:inline-flex ml-2 h-10 px-4 items-center rounded-xl fk-grad-btn text-white text-sm font-medium">Войти</a>
    </div>
  </div>
</header>`;
  }

  function footer() {
    return `
<footer class="border-t border-gray-200 dark:border-slate-800 mt-12">
  <div class="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
    <div>
      <div class="flex items-center gap-2 mb-3">
        <img src="assets/logo-a.svg" alt="" class="w-8 h-8" />
        <span class="fk-logo font-bold">FK.market</span>
      </div>
      <p class="text-gray-500 dark:text-slate-400">Цифровые товары с автовыдачей. Платежи через FKwallet.</p>
    </div>
    <div>
      <div class="font-semibold mb-3">Магазин</div>
      <ul class="space-y-2 text-gray-500 dark:text-slate-400">
        <li><a href="catalog.html" class="hover:text-brand-600">Каталог</a></li>
        <li><a href="#" class="hover:text-brand-600">Акции</a></li>
        <li><a href="#" class="hover:text-brand-600">Новинки</a></li>
        <li><a href="logo.html" class="hover:text-brand-600">Бренд-бук</a></li>
      </ul>
    </div>
    <div>
      <div class="font-semibold mb-3">Помощь</div>
      <ul class="space-y-2 text-gray-500 dark:text-slate-400">
        <li><a href="#" class="hover:text-brand-600">FAQ</a></li>
        <li><a href="#" class="hover:text-brand-600">Гарантии</a></li>
        <li><a href="#" class="hover:text-brand-600">Поддержка</a></li>
        <li><a href="admin.html" class="hover:text-brand-600">Админка</a></li>
      </ul>
    </div>
    <div>
      <div class="font-semibold mb-3">Документы</div>
      <ul class="space-y-2 text-gray-500 dark:text-slate-400">
        <li><a href="#" class="hover:text-brand-600">Оферта</a></li>
        <li><a href="#" class="hover:text-brand-600">Политика конфиденциальности</a></li>
        <li><a href="#" class="hover:text-brand-600">Согласие на ПДн</a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-gray-200 dark:border-slate-800">
    <div class="max-w-7xl mx-auto px-4 py-4 text-xs text-gray-400 flex items-center justify-between">
      <div>© 2026 FK.market</div>
      <div>Платежи: FKwallet</div>
    </div>
  </div>
</footer>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const h = document.querySelector('[data-fk-header]');
    if (h) h.outerHTML = header(h.dataset.fkHeader || '');
    const f = document.querySelector('[data-fk-footer]');
    if (f) f.outerHTML = footer();

    // После вставки шапки/футера — активируем кнопки темы и меню
    document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
      el.addEventListener('click', () => window.FK.toggleTheme());
    });
  });
})();
