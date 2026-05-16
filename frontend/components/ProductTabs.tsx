'use client';

import Link from 'next/link';
import { useState } from 'react';

type Review = {
  id: number;
  rating: number;
  text: string | null;
  author: string;
  created_at: string | null;
};

type TabKey = 'desc' | 'reviews' | 'warranty';

/**
 * Табы карточки товара: Описание / Отзывы / Гарантии.
 * Client component — переключение контента на клике.
 */
export function ProductTabs({
  shortDescription,
  description,
  reviews,
  reviewsCount,
}: {
  shortDescription: string | null;
  description: string | null;
  reviews: Review[];
  reviewsCount: number;
}) {
  const [tab, setTab] = useState<TabKey>('desc');

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'desc', label: 'Описание' },
    { key: 'reviews', label: `Отзывы (${reviewsCount.toLocaleString('ru')})` },
    { key: 'warranty', label: 'Гарантии' },
  ];

  return (
    <div className="mt-8">
      <div className="border-b border-gray-200 dark:border-slate-800 mb-6">
        <div className="flex gap-6 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`py-3 -mb-px border-b-2 transition ${
                tab === t.key
                  ? 'border-brand-500 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'desc' && (
        <article className="text-sm text-gray-700 dark:text-slate-300 max-w-none">
          {/* Показываем только полное описание. short_description у товаров из
              синхронизации — обрезанная копия начала description, поэтому
              рендер обоих полей давал дублирование текста. */}
          {description || shortDescription ? (
            <p className="text-base whitespace-pre-line">{description || shortDescription}</p>
          ) : (
            <p className="text-gray-400">Описание не заполнено.</p>
          )}
        </article>
      )}

      {tab === 'reviews' &&
        (reviews.length === 0 ? (
          <p className="text-sm text-gray-400">
            Отзывов пока нет. Оставить отзыв можно после покупки — в личном кабинете.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500" />
                  <div>
                    <div className="font-medium text-sm">{r.author}</div>
                    {r.created_at && (
                      <div className="text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleDateString('ru')}
                      </div>
                    )}
                  </div>
                  <div className="ml-auto text-yellow-400 text-sm">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </div>
                </div>
                {r.text && <p className="text-sm text-gray-600 dark:text-slate-300">{r.text}</p>}
              </div>
            ))}
          </div>
        ))}

      {tab === 'warranty' && (
        <div className="text-sm text-gray-700 dark:text-slate-300 space-y-3 max-w-2xl">
          <p>Покупая на FK.market, вы получаете:</p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-accent-500">✓</span>
              Мгновенную выдачу — код приходит сразу после оплаты, в личный кабинет и на email.
            </li>
            <li className="flex gap-2">
              <span className="text-accent-500">✓</span>
              Замену в течение 14 дней, если товар оказался нерабочим.
            </li>
            <li className="flex gap-2">
              <span className="text-accent-500">✓</span>
              Повторный доступ к купленным кодам в любой момент в личном кабинете.
            </li>
            <li className="flex gap-2">
              <span className="text-accent-500">✓</span>
              Поддержку по любым вопросам, связанным с заказом.
            </li>
          </ul>
          <p className="text-gray-500">
            Подробнее — на странице{' '}
            <Link href="/guarantees" className="text-brand-600 hover:underline">
              Гарантии
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
