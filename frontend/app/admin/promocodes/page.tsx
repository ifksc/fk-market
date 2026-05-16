'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Search, Tag, Trash2 } from 'lucide-react';
import { deleteAdminPromocode, listAdminPromocodes, type AdminPromocode } from '@/lib/admin';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ru') : '—';
}

export default function AdminPromocodesPage() {
  const [items, setItems] = useState<AdminPromocode[]>([]);
  const [meta, setMeta] = useState<{ total: number; current_page: number; last_page: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAdminPromocodes({ q: search || undefined, page, per_page: 50 });
      setItems(res.data);
      setMeta({ total: res.meta.total, current_page: res.meta.current_page, last_page: res.meta.last_page });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const handleDelete = async (promo: AdminPromocode) => {
    if (!confirm(`Удалить промокод «${promo.code}»? Это действие необратимо.`)) return;
    try {
      await deleteAdminPromocode(promo.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Промокоды</h1>
          {meta && (
            <span className="text-xs text-slate-500">
              всего: <b>{meta.total}</b>
            </span>
          )}
        </div>
        <Link
          href="/admin/promocodes/new"
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать промокод
        </Link>
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск по коду…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Промокодов пока нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium">Скидка</th>
                  <th className="px-4 py-3 font-medium">Условия</th>
                  <th className="px-4 py-3 font-medium text-right">Использован</th>
                  <th className="px-4 py-3 font-medium">Срок</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/promocodes/${p.id}`}
                        className="font-mono font-semibold hover:text-brand-600"
                      >
                        {p.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.type === 'percent'
                        ? `${p.value}%`
                        : `${p.value.toLocaleString('ru')} ₽`}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.min_total ? `от ${p.min_total.toLocaleString('ru')} ₽` : '—'}
                      {p.limit_per_user ? ` · ${p.limit_per_user}/чел` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.used_count}
                      {p.limit_total ? ` / ${p.limit_total}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {fmtDate(p.valid_from)} — {fmtDate(p.valid_until)}
                    </td>
                    <td className="px-4 py-3">
                      {p.is_valid ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          активен
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-500/15 text-slate-500">
                          неактивен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {meta && meta.last_page > 1 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Страница <b>{meta.current_page}</b> из <b>{meta.last_page}</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || meta.current_page <= 1}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40"
              >
                ← Назад
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || meta.current_page >= meta.last_page}
                className="h-9 px-3 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-40"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
