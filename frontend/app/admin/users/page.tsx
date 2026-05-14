'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, MailX, Search, ShieldCheck, Users } from 'lucide-react';
import {
  listAdminUsers,
  type AdminUserListItem,
  type AdminUsersQuery,
  type Paginated,
} from '@/lib/admin';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Покупатель',
  admin: 'Админ',
  seller: 'Продавец',
  moderator: 'Модератор',
};

const ROLE_COLOR: Record<string, string> = {
  customer: 'bg-slate-500/15 text-slate-600',
  admin: 'bg-brand-500/15 text-brand-600',
  seller: 'bg-emerald-500/15 text-emerald-600',
  moderator: 'bg-amber-500/15 text-amber-600',
};

export default function AdminUsersPage() {
  const [page, setPage] = useState<Paginated<AdminUserListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AdminUsersQuery>({ sort: 'created_desc', per_page: 30 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAdminUsers({ ...filters, q: search || undefined })
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
    return () => { cancelled = true; };
  }, [filters, search]);

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-6 sticky top-0 z-30">
        <Users className="w-5 h-5 text-slate-500" />
        <h1 className="font-bold text-lg">Пользователи</h1>
        <div className="ml-auto text-sm text-slate-500">
          {page ? `${page.meta.total.toLocaleString('ru')} всего` : ''}
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Email, имя, телефон…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <select
            value={filters.role ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, role: (e.target.value || undefined) as AdminUsersQuery['role'] }))}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="">Все роли</option>
            <option value="customer">Покупатели</option>
            <option value="admin">Админы</option>
            <option value="seller">Продавцы</option>
            <option value="moderator">Модераторы</option>
          </select>

          <select
            value={filters.sort ?? 'created_desc'}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as AdminUsersQuery['sort'] }))}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          >
            <option value="created_desc">Новые сначала</option>
            <option value="created_asc">Старые сначала</option>
            <option value="email">По email</option>
            <option value="orders_desc">Больше заказов</option>
            <option value="spent_desc">Больше потратили</option>
          </select>
        </div>

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
                    <th className="px-4 py-3 font-medium">Email / Имя</th>
                    <th className="px-4 py-3 font-medium">Роль</th>
                    <SortableTh label="Заказов" sortKey="orders" current={filters.sort ?? 'created_desc'} onSort={(s) => setFilters((f) => ({ ...f, sort: s }))} />
                    <SortableTh label="Потрачено" sortKey="spent" current={filters.sort ?? 'created_desc'} onSort={(s) => setFilters((f) => ({ ...f, sort: s }))} />
                    <SortableTh label="Регистрация" sortKey="created" current={filters.sort ?? 'created_desc'} onSort={(s) => setFilters((f) => ({ ...f, sort: s }))} />
                    <th className="px-4 py-3 font-medium">Последний вход</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {page!.data.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.email}</span>
                          {u.email_verified ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <MailX className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {u.is_blocked && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">блок</span>}
                        </div>
                        {u.name && <div className="text-xs text-slate-500">{u.name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium inline-flex items-center gap-1 ${ROLE_COLOR[u.role]}`}>
                          {u.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{u.orders_count.toLocaleString('ru')}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {u.orders_total_sum > 0 ? `${u.orders_total_sum.toLocaleString('ru')} ₽` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(u.last_login_at) || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/users/${u.id}`} className="text-brand-600 text-xs hover:underline">
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

        {page && page.meta.last_page > 1 && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">{page.data.length} из {page.meta.total.toLocaleString('ru')}</div>
            <div className="flex gap-1 flex-wrap">
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
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

type SortKey = 'created' | 'orders' | 'spent';
type SortValue = AdminUsersQuery['sort'];

function SortableTh({
  label, sortKey, current, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: NonNullable<SortValue>;
  onSort: (s: SortValue) => void;
}) {
  // Маппинг ключа в значения sort
  const desc = sortKey === 'created' ? 'created_desc'
    : sortKey === 'orders'  ? 'orders_desc'
    : 'spent_desc';
  const asc  = sortKey === 'created' ? 'created_asc' : desc;
  const isDesc = current === desc;
  const isAsc  = current === asc && asc !== desc;
  const isActive = isDesc || isAsc;
  const next: SortValue = (isDesc ? asc : desc) as SortValue;
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
        {isActive && isAsc && <ArrowUp className="w-3 h-3" />}
      </button>
    </th>
  );
}
