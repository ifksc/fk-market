import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-7xl md:text-8xl font-extrabold fk-logo leading-none">404</div>
      <h1 className="text-2xl font-bold mt-4">Страница не найдена</h1>
      <p className="text-gray-500 dark:text-slate-400 mt-2">
        Возможно, ссылка устарела или товар больше не доступен.
      </p>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="h-12 px-6 rounded-xl fk-grad-btn font-medium flex items-center"
        >
          На главную
        </Link>
        <Link
          href="/catalog"
          className="h-12 px-6 rounded-xl border border-gray-300 dark:border-slate-700 font-medium flex items-center hover:bg-white dark:hover:bg-slate-900"
        >
          В каталог
        </Link>
      </div>

      <p className="text-sm text-gray-400 mt-8">
        Не нашли нужное?{' '}
        <Link href="/support" className="text-brand-600 hover:underline">
          Напишите в поддержку
        </Link>
      </p>
    </div>
  );
}
