'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight, Clock, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { AuthError } from '@/lib/auth';
import { listMyOrders, type MyOrderSummary } from '@/lib/account';

export default function MyOrdersPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [orders, setOrders] = useState<MyOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/account/orders');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setOrdersLoading(true);
    listMyOrders({ page })
      .then((p) => {
        setOrders(p.data);
        setLastPage(p.meta.last_page);
      })
      .catch((e) => {
        if (e instanceof AuthError && e.status === 401) logout();
      })
      .finally(() => setOrdersLoading(false));
  }, [user, page, logout]);

  if (loading || !user) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Загрузка…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Мои заказы</h1>
        <Link href="/account" className="text-sm text-gray-500 hover:text-brand-600">← В кабинет</Link>
      </div>

      {ordersLoading ? (
        <div className="text-sm text-gray-500 py-12 text-center">Загружаем…</div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
          <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Заказов пока нет</p>
          <Link href="/catalog" className="inline-block text-sm font-medium text-brand-600 hover:underline">
            Перейти в каталог →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => <OrderRow key={o.public_number} order={o} />)}

          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 disabled:opacity-40 text-sm"
              >
                ← Назад
              </button>
              <span className="text-sm text-gray-500 px-3">{page} / {lastPage}</span>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 disabled:opacity-40 text-sm"
              >
                Вперёд →
              </button>
            </div>
          )}
        </div>
      )}
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
      className="block bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono text-gray-500">{order.public_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>{meta.label}</span>
        </div>
        <div className="text-lg font-semibold">{order.total.toLocaleString('ru-RU')} ₽</div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
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
    case 'completed': return { label: 'Выдан', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' };
    case 'paid':      return { label: 'Оплачен', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' };
    case 'pending':   return { label: 'Ожидает оплаты', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' };
    case 'cancelled': return { label: 'Отменён', bg: 'bg-gray-500/15', text: 'text-gray-600' };
    case 'refunded':  return { label: 'Возврат', bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' };
    default:          return { label: status, bg: 'bg-gray-500/15', text: 'text-gray-600' };
  }
}
