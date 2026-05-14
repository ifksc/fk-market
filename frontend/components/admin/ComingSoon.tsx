import Link from 'next/link';

export function ComingSoon({
  title,
  description,
  list,
}: {
  title: string;
  description?: string;
  list?: string[];
}) {
  return (
    <div>
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sticky top-0 z-30">
        <h1 className="font-bold text-lg">{title}</h1>
      </header>
      <div className="p-6 max-w-2xl">
        <div className="bg-brand-50 dark:bg-slate-900 border border-brand-500/30 rounded-2xl p-6">
          <div className="font-bold mb-2">Скоро здесь появится</div>
          {description && <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{description}</p>}
          {list && list.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <Link href="/admin" className="text-brand-600 hover:underline text-sm">
              ← Дашборд
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
