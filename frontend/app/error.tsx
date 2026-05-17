'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Граница ошибок: ловит сбои рендера/загрузки данных в роутах и показывает
// дружелюбный fallback вместо «голого» экрана ошибки Next.js.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Что-то пошло не так</h1>
      <p className="text-gray-500 dark:text-slate-400 mb-8">
        Произошла ошибка при загрузке страницы. Попробуйте ещё раз или вернитесь позже.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="h-12 px-6 rounded-xl fk-grad-btn font-medium"
        >
          Попробовать снова
        </button>
        <Link
          href="/"
          className="h-12 px-6 rounded-xl border border-gray-300 dark:border-slate-700 font-medium flex items-center hover:bg-white dark:hover:bg-slate-900"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
