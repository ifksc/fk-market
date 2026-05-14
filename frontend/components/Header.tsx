'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Package, Search, ShoppingCart, ShieldCheck, Sun, Moon, User, UserCog } from 'lucide-react';
import { LogoMark } from './Logo';
import { toggleTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { useCart } from '@/lib/cart';
import { getCategories } from '@/lib/api';
import { logout as apiLogout } from '@/lib/auth';
import type { Category } from '@/lib/types';

export function Header() {
  const { count, hydrated } = useCart();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [navCats, setNavCats] = useState<Category[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Закрытие dropdown по клику вне
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await apiLogout();
    } catch {
      /* всё равно очищаем локально */
    }
    logout();
    router.push('/');
  };

  const initials = (user?.name || user?.email || '')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

  useEffect(() => {
    // Тянем категории один раз. Показываем только те, у кого админ
    // включил флажок «показывать в верхнем меню».
    getCategories()
      .then((cats) => setNavCats(cats.filter((c) => c.show_in_header)))
      .catch(() => setNavCats([]));
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-gray-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <LogoMark size={36} />
          <span className="fk-logo text-xl hidden sm:block">FK.market</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link href="/catalog" className="text-gray-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-white">
            Каталог
          </Link>
          {navCats.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-white"
            >
              {cat.name}
              {cat.is_new && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full fk-grad-btn">NEW</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex-1">
          <form action="/catalog" className="relative max-w-md ml-auto">
            <input
              type="search"
              name="q"
              placeholder="Поиск: Steam, VPN, ключи…"
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          </form>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            aria-label="Сменить тему"
            className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <Moon className="w-5 h-5 dark:hidden" />
            <Sun className="w-5 h-5 hidden dark:block" />
          </button>
          <Link
            href="/cart"
            aria-label="Корзина"
            className="relative w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <ShoppingCart className="w-5 h-5" />
            {hydrated && count > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Меню профиля"
                className="ml-1 h-10 px-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <span className="w-8 h-8 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">
                  {initials}
                </span>
                <span className="hidden md:block text-sm max-w-[140px] truncate text-gray-700 dark:text-gray-200">
                  {user.name || user.email}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 text-sm z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="font-medium truncate">{user.name || 'Без имени'}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    {!user.email_verified && (
                      <Link
                        href="/verify-email"
                        onClick={() => setMenuOpen(false)}
                        className="mt-2 inline-block text-xs text-amber-600 hover:underline"
                      >
                        Подтвердить почту →
                      </Link>
                    )}
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <User className="w-4 h-4 text-gray-500" /> Мой кабинет
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <Package className="w-4 h-4 text-gray-500" /> Мои заказы
                  </Link>
                  <Link
                    href="/account/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <UserCog className="w-4 h-4 text-gray-500" /> Профиль
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-brand-600"
                    >
                      <ShieldCheck className="w-4 h-4" /> Админка
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-red-600 border-t border-gray-100 dark:border-slate-800 mt-1"
                  >
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/account"
                aria-label="Профиль"
                className="sm:hidden w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <User className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="hidden sm:inline-flex ml-2 h-10 px-4 items-center rounded-xl fk-grad-btn text-sm font-medium"
              >
                Войти
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
