import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function CheckoutFailedPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-10 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mb-6">
          <XCircle className="w-10 h-10" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-bold mb-2">Оплата не прошла</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8">
          Заказ не был оплачен. Деньги не списаны. Можно попробовать ещё раз —
          корзина сохранена.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/cart"
            className="h-11 px-5 rounded-xl fk-grad-btn font-medium flex items-center"
          >
            Вернуться в корзину
          </Link>
          <Link
            href="/catalog"
            className="h-11 px-5 rounded-xl border border-gray-300 dark:border-slate-700 font-medium flex items-center hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            В каталог
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-8">
          Если проблема повторяется — напишите в поддержку, разберёмся.
        </p>
      </div>
    </div>
  );
}
