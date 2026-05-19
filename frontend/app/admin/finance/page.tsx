'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  getAdminFinance,
  type FinanceItem,
  type FinanceQuery,
  type FinanceSummary,
} from '@/lib/admin';

const PERIODS: { value: NonNullable<FinanceQuery['period']>; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: 'all', label: 'Всё время' },
];

const SORTS: { value: NonNullable<FinanceQuery['sort']>; label: string }[] = [
  { value: 'date_desc', label: 'Сначала новые' },
  { value: 'date_asc', label: 'Сначала старые' },
  { value: 'margin_desc', label: 'Маржа ↓' },
  { value: 'margin_asc', label: 'Маржа ↑' },
];

function money(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const card =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';

export default function AdminFinancePage() {
  const searchParams = useSearchParams();
  // Период из ?period=... (например, при переходе с плитки «Маржа» дашборда).
  const initialPeriod = (searchParams.get('period') as FinanceQuery['period']) ?? '30d';

  const [period, setPeriod] = useState<NonNullable<FinanceQuery['period']>>(
    PERIODS.find((p) => p.value === initialPeriod)?.value ?? '30d',
  );
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<NonNullable<FinanceQuery['sort']>>('date_desc');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<FinanceItem[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [meta, setMeta] = useState<{ total: number; per_page: number; current_page: number; last_page: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminFinance({ period, q: q.trim() || undefined, sort, page, per_page: 30 });
      setItems(res.data);
      setMeta(res.meta);
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [period, q, sort, page]);

  // При смене фильтров сбрасываем страницу на первую.
  useEffect(() => {
    setPage(1);
  }, [period, q, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const marginPctLabel = useMemo(
    () => (summary ? `${summary.margin_pct.toFixed(1)}%` : '—'),
    [summary],
  );

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Финансы — маржа по операциям</h1>
        </div>
        <div className="flex gap-1 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 h-8 rounded-lg ${
                period === p.value
                  ? 'fk-grad-btn font-medium'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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

        {/* Сводка */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Выручка', value: summary ? money(summary.revenue) : '—' },
            { label: 'Закупка', value: summary ? money(summary.cost) : '—' },
            { label: 'Маржа', value: summary ? money(summary.margin) : '—' },
            { label: 'Маржа %', value: marginPctLabel },
            { label: 'Операций', value: summary ? summary.items_count.toLocaleString('ru') : '—' },
          ].map((k) => (
            <div key={k.label} className={`${card} p-4`}>
              <div className="text-xs text-slate-500 mb-1">{k.label}</div>
              <div className="text-xl font-extrabold">{loading && !summary ? '…' : k.value}</div>
            </div>
          ))}
        </section>

        {/* Фильтры */}
        <section className={`${card} p-4 flex flex-wrap items-center gap-3`}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по номеру заказа или товару"
            className="flex-1 min-w-[260px] h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as NonNullable<FinanceQuery['sort']>)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </section>

        {/* Таблица */}
        <section className={`${card} overflow-hidden`}>
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Операций за период нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-left">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">Заказ</th>
                    <th className="px-4 py-3 font-medium">Дата оплаты</th>
                    <th className="px-4 py-3 font-medium">Товар</th>
                    <th className="px-4 py-3 font-medium text-right">Кол-во</th>
                    <th className="px-4 py-3 font-medium text-right">Продажа</th>
                    <th className="px-4 py-3 font-medium text-right">Закупка</th>
                    <th className="px-4 py-3 font-medium text-right">Маржа</th>
                    <th className="px-4 py-3 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it, idx) => {
                    const negative = it.margin < 0;
                    return (
                      <tr
                        key={`${it.order_id}-${idx}`}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${it.order_id}`}
                            className="font-mono text-xs hover:text-brand-600"
                          >
                            {it.order_public_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDateTime(it.paid_at)}
                        </td>
                        <td className="px-4 py-3">
                          {it.product.slug ? (
                            <Link
                              href={`/admin/products/${it.product.id}`}
                              className="font-medium hover:text-brand-600 line-clamp-1"
                            >
                              {it.product.name ?? '—'}
                            </Link>
                          ) : (
                            <span className="line-clamp-1">{it.product.name ?? '—'}</span>
                          )}
                          {it.variant_label && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              вариант: {it.variant_label}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{it.qty}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{money(it.total)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500">
                          {money(it.cost)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                            negative ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {money(it.margin)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-xs ${
                            negative ? 'text-red-500' : 'text-slate-500'
                          }`}
                        >
                          {it.margin_pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Пагинация */}
        {meta && meta.last_page > 1 && (
          <section className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              Стр. {meta.current_page} из {meta.last_page} · всего {meta.total}
            </div>
            <div className="flex gap-2">
              <button
                disabled={meta.current_page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-sm disabled:opacity-40"
              >
                ←
              </button>
              <button
                disabled={meta.current_page >= meta.last_page || loading}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-sm disabled:opacity-40"
              >
                →
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
