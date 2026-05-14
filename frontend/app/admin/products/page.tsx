'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import {
  getAdminProducts,
  type AdminProductListItem,
  type AdminProductsQuery,
  type Paginated,
} from '@/lib/admin';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активен',
  draft: 'Черновик',
  archived: 'Архив',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600',
  draft: 'bg-slate-500/15 text-slate-500',
  archived: 'bg-red-500/15 text-red-500',
};

const MODE_LABEL: Record<string, string> = {
  stock: 'Склад',
  api: 'API',
  manual: 'Ручная',
};

const MODE_COLOR: Record<string, string> = {
  stock: 'bg-indigo-500/15 text-indigo-500',
  api: 'bg-blue-500/15 text-blue-500',
  manual: 'bg-purple-500/15 text-purple-500',
};

export default function AdminProductsPage() {
  const [page, setPage] = useState<Paginated<AdminProductListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры (хранятся в state, без URL пока)
  const [filters, setFilters] = useState<AdminProductsQuery>({ sort: 'updated_desc', per_page: 30 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminProducts({ ...filters, q: search || undefined })
      .then((res) => {
        if (!cancelled) {
          setPage(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, search]);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 gap-4">
        <h1 className="font-bold text-lg">Товары</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/products/new"
            className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center"
          >
            + Добавить товар
          </Link>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Фильтры */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск по названию или slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: (e.target.value || undefined) as AdminProductsQuery['status'] }))
            }
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="draft">Черновики</option>
            <option value="archived">Архив</option>
          </select>

          <select
            value={filters.mode ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, mode: (e.target.value || undefined) as AdminProductsQuery['mode'] }))
            }
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="">Все режимы</option>
            <option value="stock">Склад</option>
            <option value="api">API</option>
            <option value="manual">Ручная</option>
          </select>

          <select
            value={filters.sort ?? 'updated_desc'}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sort: e.target.value as AdminProductsQuery['sort'] }))
            }
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="updated_desc">Сначала свежие</option>
            <option value="name">По имени</option>
            <option value="price_asc">Цена ↑</option>
            <option value="price_desc">Цена ↓</option>
            <option value="sales">По продажам</option>
          </select>
        </div>

        {/* Таблица */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && !page ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : page && page.data.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Ничего не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 text-left bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Товар</th>
                    <th className="px-4 py-3 font-medium">Категория</th>
                    <th className="px-4 py-3 font-medium">Режим</th>
                    <th className="px-4 py-3 font-medium">Цена</th>
                    <th className="px-4 py-3 font-medium">Наценка</th>
                    <th className="px-4 py-3 font-medium">Остаток</th>
                    <th className="px-4 py-3 font-medium">Продаж</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <SortableTh
                      label="Добавлен"
                      sortKey="created"
                      current={filters.sort ?? 'updated_desc'}
                      onSort={(s) => setFilters((f) => ({ ...f, sort: s }))}
                    />
                    <SortableTh
                      label="Обновлён"
                      sortKey="updated"
                      current={filters.sort ?? 'updated_desc'}
                      onSort={(s) => setFilters((f) => ({ ...f, sort: s }))}
                    />
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {page!.data.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${MODE_COLOR[p.fulfillment_mode]}`}>
                          {MODE_LABEL[p.fulfillment_mode]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {p.price_final.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.markup_pct !== null ? `+${p.markup_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {p.stock_available === null ? (
                          <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-600">∞</span>
                        ) : (
                          <span
                            className={`text-xs px-2 py-1 rounded-md ${
                              p.stock_available <= 5
                                ? 'bg-red-500/15 text-red-600'
                                : p.stock_available <= 20
                                ? 'bg-yellow-500/15 text-yellow-600'
                                : 'bg-emerald-500/15 text-emerald-600'
                            }`}
                          >
                            {p.stock_available} шт
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.sales_count.toLocaleString('ru')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COLOR[p.status]}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(p.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-brand-600 text-xs hover:underline"
                        >
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

        {/* Пагинация */}
        {page && page.meta.last_page > 1 && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              {page.data.length} из {page.meta.total.toLocaleString('ru')}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: page.meta.last_page }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setFilters((f) => ({ ...f, page: n }))}
                  className={`w-8 h-8 rounded-lg ${
                    n === page.meta.current_page
                      ? 'fk-grad-btn'
                      : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type SortKey = 'created' | 'updated';
type SortValue = AdminProductsQuery['sort'];

function SortableTh({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: NonNullable<SortValue>;
  onSort: (s: SortValue) => void;
}) {
  const isActive = current === `${sortKey}_asc` || current === `${sortKey}_desc`;
  const isDesc = current === `${sortKey}_desc`;
  const next: SortValue = isActive
    ? (isDesc ? `${sortKey}_asc` : `${sortKey}_desc`) as SortValue
    : `${sortKey}_desc` as SortValue;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(next)}
        className={`inline-flex items-center gap-1 hover:text-brand-600 ${isActive ? 'text-brand-600' : ''}`}
      >
        {label}
        {!isActive && <ArrowUpDown className="w-3 h-3 opacity-60" />}
        {isActive && isDesc && <ArrowDown className="w-3 h-3" />}
        {isActive && !isDesc && <ArrowUp className="w-3 h-3" />}
      </button>
    </th>
  );
}
