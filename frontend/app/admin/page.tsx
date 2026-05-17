'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDashboardStats, type DashboardStats } from '@/lib/admin';

const PERIODS: Array<{ value: string; label: string }> = [
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает оплаты', color: '#f59e0b' },
  paid: { label: 'Оплачен', color: '#6366f1' },
  fulfilling: { label: 'Выдаётся', color: '#3b82f6' },
  completed: { label: 'Завершён', color: '#10b981' },
  failed: { label: 'Ошибка', color: '#ef4444' },
  refunded: { label: 'Возврат', color: '#94a3b8' },
  cancelled: { label: 'Отменён', color: '#94a3b8' },
};

function money(n: number): string {
  return `${n.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽`;
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Выбранный столбик графика — показываем по нему выручку и кол-во продаж.
  const [selectedDay, setSelectedDay] = useState<DashboardStats['chart'][number] | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardStats(period)
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [period]);

  const chartMax = stats ? Math.max(...stats.chart.map((c) => c.revenue), 1) : 1;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';

  const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">Дашборд</h1>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 h-8 rounded-lg ${
                period === p.value
                  ? 'bg-white dark:bg-slate-900 shadow-sm font-medium'
                  : 'text-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* KPI */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: `Выручка · ${periodLabel}`, value: stats ? money(stats.revenue) : '—', sub: stats ? `сегодня: ${money(stats.revenue_today)}` : '' },
            { label: 'Заказов', value: stats ? stats.orders.toLocaleString('ru') : '—', sub: stats ? `сегодня: ${stats.orders_today}` : '' },
            { label: 'Средний чек', value: stats ? money(stats.avg_check) : '—', sub: 'выручка / заказы' },
            { label: 'Маржа', value: stats ? money(stats.margin) : '—', sub: 'выручка − закупка' },
          ].map((k) => (
            <div key={k.label} className={`${card} p-5`}>
              <div className="text-xs text-slate-500 mb-2">{k.label}</div>
              <div className="text-2xl font-extrabold">{loading ? '…' : k.value}</div>
              <div className="text-xs text-slate-500 mt-2">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* График + статусы */}
        <section className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className={`${card} p-5`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="font-bold text-sm">Выручка по дням — 30 дней</span>
              {selectedDay ? (
                <span className="text-xs text-slate-400">
                  {selectedDay.date}:{' '}
                  <b className="text-fuchsia-400">{money(selectedDay.revenue)}</b>
                  {' · '}
                  {selectedDay.orders} продаж
                </span>
              ) : (
                <span className="text-xs text-slate-500">Кликните по столбику</span>
              )}
            </div>
            {stats && (
              <>
                <div className="flex items-end gap-1 h-40">
                  {stats.chart.map((c) => (
                    <button
                      key={c.date}
                      type="button"
                      onClick={() => setSelectedDay(c)}
                      className={`flex-1 p-0 rounded-t bg-gradient-to-b from-fuchsia-500 to-brand-600 min-h-[3px] cursor-pointer hover:opacity-80 ${
                        selectedDay?.date === c.date ? 'ring-2 ring-fuchsia-300' : ''
                      }`}
                      style={{ height: `${(c.revenue / chartMax) * 100}%` }}
                      title={`${c.date}: ${money(c.revenue)} · ${c.orders} продаж`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                  <span>{stats.chart[0]?.date}</span>
                  <span>{stats.chart[stats.chart.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          <div className={`${card} p-5`}>
            <div className="font-bold text-sm mb-4">Заказы по статусам</div>
            {stats && Object.keys(stats.by_status).length === 0 && (
              <div className="text-sm text-slate-500">Нет заказов за период</div>
            )}
            {stats &&
              Object.entries(stats.by_status).map(([status, count]) => {
                const meta = STATUS_META[status] ?? { label: status, color: '#94a3b8' };
                return (
                  <div
                    key={status}
                    className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    <b>{count}</b>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Способы оплаты + топ товаров */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} p-5`}>
            <div className="font-bold text-sm mb-4">Выручка по способам оплаты</div>
            {stats && stats.payment_methods.length === 0 ? (
              <div className="text-sm text-slate-500">Нет оплаченных заказов за период</div>
            ) : (
              stats?.payment_methods.map((m) => (
                <div
                  key={m.method}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <span>{m.method}</span>
                  <span>
                    <b>{money(m.revenue)}</b>{' '}
                    <span className="text-xs text-slate-500">· {m.orders} зак.</span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className={`${card} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-sm">Топ-5 товаров по продажам</div>
              <Link href="/admin/products" className="text-xs text-brand-600 hover:underline">
                Все →
              </Link>
            </div>
            {stats && stats.top_products.length === 0 ? (
              <div className="text-sm text-slate-500">Нет данных</div>
            ) : (
              stats?.top_products.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:text-brand-600"
                >
                  <span className="line-clamp-1 pr-3">{p.name}</span>
                  <span className="shrink-0">
                    <b>{p.sales_count.toLocaleString('ru')}</b>{' '}
                    <span className="text-xs text-slate-500">продаж</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Низкий остаток */}
        <section
          className={`rounded-2xl border p-5 ${
            stats && stats.low_stock.length > 0
              ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-500/10'
              : card
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm">⚠ Низкий остаток (≤ 5)</div>
            <Link href="/admin/stock" className="text-xs text-brand-600 hover:underline">
              Склад ключей →
            </Link>
          </div>
          {stats && stats.low_stock.length === 0 ? (
            <div className="text-sm text-slate-500">Всё в порядке — товаров с низким остатком нет.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6">
              {stats?.low_stock.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}/stock`}
                  className="flex items-center justify-between text-sm py-1.5 hover:text-brand-600"
                >
                  <span className="line-clamp-1 pr-3">{p.name}</span>
                  <span
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md ${
                      p.stock === 0
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {p.stock} шт
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          «Выручка» — оплаченные заказы (без возвратов). Маржа — выручка позиций минус закупочная цена.
        </p>
      </div>
    </div>
  );
}
