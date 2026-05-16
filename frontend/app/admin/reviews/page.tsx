'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import {
  approveAdminReview,
  deleteAdminReview,
  listAdminReviews,
  unapproveAdminReview,
  type AdminReview,
} from '@/lib/admin';

const FILTERS: Array<{ value: 'pending' | 'approved' | 'all'; label: string }> = [
  { value: 'pending', label: 'На модерации' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'all', label: 'Все' },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400 text-sm whitespace-nowrap">
      {'★'.repeat(n)}
      <span className="text-slate-300 dark:text-slate-600">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function AdminReviewsPage() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [meta, setMeta] = useState<{ total: number; current_page: number; last_page: number; pending_total?: number } | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAdminReviews({ status: filter, page, per_page: 50 });
      setItems(res.data);
      setMeta(res.meta);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  const act = async (id: number, fn: (id: number) => Promise<void>) => {
    setBusy(id);
    try {
      await fn(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = (r: AdminReview) => {
    if (!confirm('Удалить отзыв? Это действие необратимо.')) return;
    act(r.id, deleteAdminReview);
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Отзывы</h1>
          {meta?.pending_total != null && meta.pending_total > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
              на модерации: {meta.pending_total}
            </span>
          )}
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 h-8 rounded-lg ${
                  filter === f.value ? 'bg-white dark:bg-slate-900 shadow-sm font-medium' : 'text-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Отзывов нет</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((r) => (
                <div key={r.id} className="p-4 flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Stars n={r.rating} />
                      {r.product ? (
                        <Link
                          href={`/products/${r.product.slug}`}
                          className="font-medium text-sm hover:text-brand-600"
                        >
                          {r.product.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">товар удалён</span>
                      )}
                      {r.is_approved ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          опубликован
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          на модерации
                        </span>
                      )}
                    </div>
                    {r.text && <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{r.text}</p>}
                    <div className="text-xs text-slate-400">
                      {r.author}
                      {r.author_email ? ` · ${r.author_email}` : ''}
                      {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString('ru')}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.is_approved ? (
                      <button
                        onClick={() => act(r.id, unapproveAdminReview)}
                        disabled={busy === r.id}
                        className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
                      >
                        Скрыть
                      </button>
                    ) : (
                      <button
                        onClick={() => act(r.id, approveAdminReview)}
                        disabled={busy === r.id}
                        className="h-9 px-3 rounded-lg fk-grad-btn text-sm font-medium disabled:opacity-50"
                      >
                        Одобрить
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={busy === r.id}
                      className="text-red-500 hover:text-red-700 p-2 disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
