'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  getAdminOrders,
  type AdminOrderListItem,
  type AdminOrdersQuery,
  type Paginated,
} from '@/lib/admin';

const STATUS_LABEL: Record<AdminOrderListItem['status'], string> = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  fulfilling: 'Выдача…',
  completed: 'Готов',
  failed: 'Ошибка',
  refunded: 'Возврат',
  cancelled: 'Отменён',
};

const STATUS_COLOR: Record<AdminOrderListItem['status'], string> = {
  pending: 'bg-yellow-500/15 text-yellow-600',
  paid: 'bg-emerald-500/15 text-emerald-600',
  fulfilling: 'bg-blue-500/15 text-blue-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-red-500/15 text-red-600',
  refunded: 'bg-slate-500/15 text-slate-600',
  cancelled: 'bg-slate-500/15 text-slate-600',
};

export default function AdminOrdersPage() {
  const [page, setPage] = useState<Paginated<AdminOrderListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminOrdersQuery>({ sort: 'created_desc', per_page: 30 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminOrders({ ...filters, q: search || undefined })
      .then((res) => !cancelled && (setPage(res), setError(null)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, search]);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Заказы</h1>
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Номер заказа или email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: (e.target.value || undefined) as AdminOrdersQuery['status'] }))
            }
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && !page ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : !page || page.data.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Заказов нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 text-left bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Номер</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Сумма</th>
                    <th className="px-4 py-3 font-medium">Поз</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {page.data.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono">{o.public_number}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {o.created_at ? new Date(o.created_at).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3">{o.email}</td>
                      <td className="px-4 py-3 font-semibold">
                        {o.total.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                      </td>
                      <td className="px-4 py-3 text-slate-500">{o.items_count}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLOR[o.status]}`}>
                          {STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/orders/${o.id}`} className="text-brand-600 text-xs hover:underline">
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
