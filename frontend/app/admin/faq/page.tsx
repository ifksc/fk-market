'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { deleteAdminFaq, listAdminFaq, type AdminFaqItem } from '@/lib/admin';

export default function AdminFaqPage() {
  const [items, setItems] = useState<AdminFaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listAdminFaq());
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

  const handleDelete = async (item: AdminFaqItem) => {
    if (!confirm(`Удалить вопрос «${item.question}»?`)) return;
    try {
      await deleteAdminFaq(item.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-slate-500" />
          <h1 className="font-bold text-lg">FAQ</h1>
          <span className="text-xs text-slate-500">всего: {items.length}</span>
        </div>
        <Link
          href="/admin/faq/new"
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить вопрос
        </Link>
      </header>

      <div className="p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Вопросов пока нет</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Вопрос</th>
                  <th className="px-4 py-3 font-medium">Раздел</th>
                  <th className="px-4 py-3 font-medium">В общем FAQ</th>
                  <th className="px-4 py-3 font-medium text-right">Порядок</th>
                  <th className="px-4 py-3 font-medium">Активен</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/faq/${f.id}`} className="font-medium hover:text-brand-600 line-clamp-1">
                        {f.question}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{f.category ?? '—'}</td>
                    <td className="px-4 py-3">{f.is_general ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-right">{f.sort}</td>
                    <td className="px-4 py-3">
                      {f.is_active ? (
                        <span className="text-emerald-500">●</span>
                      ) : (
                        <span className="text-slate-400">○</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(f)}
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
