'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FolderTree, Plus, Search, Trash2 } from 'lucide-react';
import {
  deleteAdminCategory,
  listAdminCategories,
  type AdminCategoryFull,
  type AdminCategoryQuery,
} from '@/lib/admin';

const FILTER_LABELS: Record<NonNullable<AdminCategoryQuery['filter']> | 'all', string> = {
  all: 'Все',
  ours: 'Наши',
  providers: 'От провайдеров',
  roots: 'Только корневые',
};

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<AdminCategoryFull[]>([]);
  const [meta, setMeta] = useState<{ total: number; current_page: number; last_page: number } | null>(null);
  const [filter, setFilter] = useState<'all' | NonNullable<AdminCategoryQuery['filter']>>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [byId, setById] = useState<Record<number, AdminCategoryFull>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAdminCategories({
        filter: filter === 'all' ? undefined : filter,
        q: search || undefined,
        page,
        per_page: 50,
      });
      setItems(res.data);
      setMeta({ total: res.meta.total, current_page: res.meta.current_page, last_page: res.meta.last_page });
      setById(Object.fromEntries(res.data.map((c) => [c.id, c])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, page]);

  const handleDelete = async (cat: AdminCategoryFull) => {
    if (!confirm(`Удалить категорию «${cat.name}»? Это действие необратимо.`)) return;
    try {
      await deleteAdminCategory(cat.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <FolderTree className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Категории</h1>
          {meta && (
            <span className="text-xs text-slate-500">
              всего: <b>{meta.total}</b>
            </span>
          )}
        </div>
        <Link
          href="/admin/categories/new"
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать категорию
        </Link>
      </header>

      <div className="p-6 space-y-4">
        {/* Фильтры */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск по имени или slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            {(Object.entries(FILTER_LABELS) as Array<[typeof filter, string]>).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-8 rounded-lg ${
                  filter === f ? 'bg-white dark:bg-slate-900 shadow-sm font-medium' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Ничего не найдено</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Категория</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Родитель</th>
                  <th className="px-4 py-3 font-medium text-right">Товаров</th>
                  <th className="px-4 py-3 font-medium">Источник</th>
                  <th className="px-4 py-3 font-medium">Активна</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((c) => {
                  const parent = c.parent_id ? byId[c.parent_id] : null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/categories/${c.id}`}
                          className="flex items-center gap-3 hover:text-brand-600"
                        >
                          {c.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.image_url}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                              —
                            </div>
                          )}
                          <span className="font-medium">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{parent?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right">{c.products_count}</td>
                      <td className="px-4 py-3">
                        {c.is_from_provider ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                            FK
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            Наша
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.is_active ? (
                          <span className="text-emerald-500">●</span>
                        ) : (
                          <span className="text-slate-400">○</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!c.is_from_provider && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Пагинация */}
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
