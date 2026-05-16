'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  LogOut,
  Mail,
  Package,
  Settings,
  ShoppingBag,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AuthError, logout as apiLogout, resendVerification } from '@/lib/auth';
import { listMyOrders, type MyOrderSummary } from '@/lib/account';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [orders, setOrders] = useState<MyOrderSummary[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    listMyOrders({ page: 1 })
      .then((page) => {
        setOrders(page.data);
        setOrdersTotal(page.meta.total);
      })
      .catch((e) => {
        if (e instanceof AuthError && e.status === 401) logout();
      })
      .finally(() => setOrdersLoading(false));
  }, [user, logout]);

  const handleLogout = async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    logout();
    router.push('/');
  };

  const handleResendVerify = async () => {
    setResending(true);
    setResendNotice(null);
    try {
      await resendVerification();
      setResendNotice('Письмо с кодом отправлено повторно');
    } catch (e) {
      if (e instanceof AuthError) setResendNotice(e.message);
      else setResendNotice('Не удалось отправить письмо');
    } finally {
      setResending(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        Загрузка…
      </div>
    );
  }

  const totalSpent = orders
    .filter((o) => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0);
  const initials = (user.name || user.email || '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Личный кабинет</h1>

      {!user.email_verified && (
        <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-amber-800 dark:text-amber-200">
              {user.email ? 'Подтвердите почту' : 'Укажите email'}
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
              {user.email
                ? 'Без подтверждения вы не сможете сменить email или открыть тикет.'
                : 'Email нужен, чтобы получать ключи и подтверждения после оплаты.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {user.email ? (
                <>
                  <Link href="/verify-email" className="text-sm font-medium text-amber-700 dark:text-amber-200 underline">
                    Ввести код
                  </Link>
                  <button
                    onClick={handleResendVerify}
                    disabled={resending}
                    className="text-sm text-amber-700 dark:text-amber-200 hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Отправляем…' : 'Отправить ещё раз'}
                  </button>
                </>
              ) : (
                <Link href="/account/profile?need=email" className="text-sm font-medium text-amber-700 dark:text-amber-200 underline">
                  Указать email →
                </Link>
              )}
              {resendNotice && <span className="text-sm text-amber-700 dark:text-amber-200">{resendNotice}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-brand-500 text-white text-2xl font-bold flex items-center justify-center mb-3">
              {initials}
            </div>
            <div className="font-semibold">{user.name || 'Без имени'}</div>
            <div className="text-sm text-gray-500 truncate">{user.email}</div>
          </div>

          <nav className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-2 text-sm">
            <Item icon={<ShoppingBag className="w-4 h-4" />} href="/account" label="Обзор" active />
            <Item icon={<Package className="w-4 h-4" />} href="/account/orders" label="Заказы" badge={ordersTotal || undefined} />
            <Item icon={<UserIcon className="w-4 h-4" />} href="/account/profile" label="Профиль" />
            <Item icon={<HelpCircle className="w-4 h-4" />} href="/support" label="Поддержка" />
            <Item icon={<Settings className="w-4 h-4" />} href="/account/settings" label="Настройки" />
            <button
              onClick={handleLogout}
              className="w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Stat label="Всего заказов" value={String(ordersTotal)} />
            <Stat label="Потрачено" value={`${totalSpent.toLocaleString('ru-RU')} ₽`} />
          </div>

          <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Последние заказы</h2>
              {ordersTotal > 5 && (
                <Link href="/account/orders" className="text-sm text-brand-600 hover:underline">
                  Все →
                </Link>
              )}
            </div>

            {ordersLoading ? (
              <div className="text-sm text-gray-500 py-8 text-center">Загружаем…</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-gray-500">Заказов пока нет</p>
                <Link href="/catalog" className="inline-block mt-3 text-sm font-medium text-brand-600 hover:underline">
                  Перейти в каталог →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((o) => (
                  <OrderRow key={o.public_number} order={o} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Item({
  icon, href, label, active, badge,
}: { icon: React.ReactNode; href: string; label: string; active?: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm ${
        active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      {badge !== undefined && (
        <span className="text-xs px-2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600">{badge}</span>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function OrderRow({ order }: { order: MyOrderSummary }) {
  const meta = statusMeta(order.status);
  const date = order.created_at ? new Date(order.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const firstItem = order.items_summary[0];
  const more = order.items_summary.length - 1;
  return (
    <Link
      href={`/account/orders/${order.public_number}`}
      className="block bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl p-4"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-mono">{order.public_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>{meta.label}</span>
        </div>
        <div className="font-semibold">{order.total.toLocaleString('ru-RU')} ₽</div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {firstItem?.product_name ?? '—'}
          {more > 0 && <span className="text-gray-400"> +{more}</span>}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {date}
          <ChevronRight className="w-4 h-4 -mr-1" />
        </div>
      </div>
    </Link>
  );
}

function statusMeta(status: MyOrderSummary['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Выдан', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' };
    case 'paid':
      return { label: 'Оплачен', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' };
    case 'pending':
      return { label: 'Ожидает оплаты', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' };
    case 'cancelled':
      return { label: 'Отменён', bg: 'bg-gray-500/15', text: 'text-gray-600' };
    case 'refunded':
      return { label: 'Возврат', bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' };
    default:
      return { label: status, bg: 'bg-gray-500/15', text: 'text-gray-600' };
  }
}
