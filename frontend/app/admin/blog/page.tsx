'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Newspaper, Plus, Trash2 } from 'lucide-react';
import { deleteAdminBlogPost, listAdminBlog, type AdminBlogPost } from '@/lib/admin';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminBlogPage() {
  const [items, setItems] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAdminBlog());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (item: AdminBlogPost) => {
    if (!confirm(`Удалить статью «${item.title}»?`)) return;
    try {
      await deleteAdminBlogPost(item.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">Блог</h1>
          <span className="text-xs text-slate-500">всего: {items.length}</span>
        </div>
        <Link
          href="/admin/blog/new"
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Новая статья
        </Link>
      </header>

      <div className="p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Статей пока нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Заголовок</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Дата публикации</th>
                  <th className="px-4 py-3 font-medium">Теги</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/blog/${p.id}`}
                        className="font-medium hover:text-brand-600 line-clamp-1"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'published' ? (
                        <span className="text-emerald-500">● опубликовано</span>
                      ) : (
                        <span className="text-slate-400">○ черновик</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.published_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.tags.length > 0 ? p.tags.join(', ') : '—'}
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
      </div>
    </div>
  );
}
