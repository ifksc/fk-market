'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Boxes,
  CreditCard,
  FolderTree,
  Layout as LayoutIcon,
  ListOrdered,
  LogOut,
  Mail,
  Package,
  Plug,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  BadgePercent,
  Users,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import {
  adminLogout,
  adminMe,
  AdminUnauthorizedError,
  clearAdminToken,
  getAdminToken,
  type AdminUser,
} from '@/lib/admin';

const NAV: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }>; counter?: string }> = [
  { href: '/admin', label: 'Дашборд', icon: LayoutIcon },
  { href: '/admin/products', label: 'Товары', icon: Package },
  { href: '/admin/categories', label: 'Категории', icon: FolderTree },
  { href: '/admin/stock', label: 'Склад ключей', icon: Boxes },
  { href: '/admin/orders', label: 'Заказы', icon: ListOrdered },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/queue', label: 'Очередь выдачи', icon: ShieldCheck },
  { href: '/admin/reviews', label: 'Отзывы', icon: Star },
  { href: '/admin/support', label: 'Поддержка', icon: Mail },
  { href: '/admin/providers', label: 'Поставщики', icon: Plug },
  { href: '/admin/pricing', label: 'Наценки', icon: Tag },
  { href: '/admin/promocodes', label: 'Промокоды', icon: BadgePercent },
  { href: '/admin/payment-methods', label: 'Способы оплаты', icon: CreditCard },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(!isLoginPage);

  // Проверяем токен и подтягиваем профиль
  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    const token = getAdminToken();
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    adminMe()
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof AdminUnauthorizedError) {
          clearAdminToken();
          router.replace('/admin/login');
        } else {
          // оставим юзера в проблеме — пусть жмёт логин
          clearAdminToken();
          router.replace('/admin/login');
        }
      });
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    await adminLogout();
    router.replace('/admin/login');
  };

  // Страница логина рендерим целиком без обвязки (свой layout внутри)
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Загрузка админки…</div>
      </div>
    );
  }

  if (!user) {
    return null; // редирект уже инициирован
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 hidden lg:flex">
        <Link href="/admin" className="flex items-center gap-2 h-16 px-5 border-b border-slate-200 dark:border-slate-800">
          <LogoMark size={32} />
          <span className="fk-logo font-bold">FK.market</span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-700/20 text-brand-700 dark:text-brand-500 font-semibold">
            admin
          </span>
        </Link>

        <nav className="p-3 text-sm space-y-0.5 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  active
                    ? 'fk-grad-btn font-medium'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ← Перейти на сайт
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Выйти ({user.email})
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
