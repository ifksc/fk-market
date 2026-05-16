'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { createAdminFaq, updateAdminFaq, type AdminFaqInput, type AdminFaqItem } from '@/lib/admin';

export function FaqForm({ initial }: { initial: AdminFaqItem | null }) {
  const router = useRouter();
  const isEdit = !!initial;

  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [isGeneral, setIsGeneral] = useState(initial?.is_general ?? true);
  const [sort, setSort] = useState(String(initial?.sort ?? 100));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError('Заполните вопрос и ответ');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: AdminFaqInput = {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim() || null,
        is_general: isGeneral,
        sort: Number(sort) || 100,
        is_active: isActive,
      };
      if (isEdit && initial) {
        await updateAdminFaq(initial.id, payload);
      } else {
        await createAdminFaq(payload);
      }
      router.push('/admin/faq');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm';
  const labelCls = 'text-xs text-slate-500 mb-1 block';

  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/admin/faq" className="text-slate-500 hover:text-brand-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-lg">{isEdit ? 'Вопрос FAQ' : 'Новый вопрос FAQ'}</h1>
        </div>
        <button
          type="submit"
          form="faq-form"
          disabled={submitting}
          className="h-10 px-4 rounded-xl fk-grad-btn text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </header>

      <form id="faq-form" onSubmit={onSubmit} className="p-6 max-w-2xl space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelCls}>Вопрос *</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ответ *</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={5000}
              className="w-full h-40 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm resize-y"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Раздел (для общего FAQ)</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Например: Оплата"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Порядок (sort)</label>
              <input
                type="number"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isGeneral}
              onChange={(e) => setIsGeneral(e.target.checked)}
              className="accent-brand-500"
            />
            Показывать в общем FAQ (/faq)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-brand-500"
            />
            Активен
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
