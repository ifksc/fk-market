'use client';

import { useState } from 'react';
import { AuthError } from '@/lib/auth';
import { submitReview } from '@/lib/account';

/**
 * Форма отзыва на купленный товар (на странице заказа в ЛК).
 * Премодерация: после отправки отзыв уходит на проверку админу.
 */
export function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitReview({ product_id: productId, rating, text: text.trim() || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Не удалось отправить отзыв');
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-slate-800 pt-3">
      <div className="text-xs text-gray-500 mb-1.5">Ваша оценка</div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className={`text-2xl leading-none transition ${
              (hover || rating) >= s ? 'text-amber-400' : 'text-gray-300 dark:text-slate-600'
            }`}
            aria-label={`Оценка ${s}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Поделитесь впечатлением о товаре… (необязательно)"
        maxLength={2000}
        className="w-full h-20 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm resize-none"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-2 h-10 px-4 rounded-xl fk-grad-btn text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? 'Отправляем…' : 'Отправить отзыв'}
      </button>
    </div>
  );
}
