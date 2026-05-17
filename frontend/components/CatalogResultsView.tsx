import Link from 'next/link';
import { CatalogFilters, SortSelect, type CatalogParams } from '@/components/CatalogFilters';
import { ProductCard } from '@/components/ProductCard';
import type { Paginated, Product } from '@/lib/types';

/** Номера страниц для пагинации: 1, текущая ±2, последняя; разрывы — '…'. */
function pageWindow(current: number, last: number): (number | '…')[] {
  const wanted = new Set<number>([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

type Props = {
  data: Paginated<Product>;
  /** Базовый путь страницы — /catalog или /catalog/<slug>. */
  basePath: string;
  /** Текущие query-параметры (q/sort/page/min_price/max_price/min_rating). */
  params: CatalogParams;
  /** Идёт ли клиентская догрузка отфильтрованного списка. */
  loading?: boolean;
};

/**
 * Презентационная часть каталога: счётчик + сортировка + сайдбар фильтров +
 * сетка товаров + пагинация. Без хуков и async — поэтому рендерится одинаково
 * и на сервере (как статичный fallback <Suspense> с дефолтным списком),
 * и на клиенте (внутри CatalogResults — с догруженным отфильтрованным).
 */
export function CatalogResultsView({ data, basePath, params, loading = false }: Props) {
  const currentSort = params.sort ?? 'popular';

  // Ссылка на страницу пагинации — текущий путь + сохранённые query.
  const pageUrl = (page: number) => {
    const sp = new URLSearchParams();
    for (const k of ['q', 'sort', 'min_price', 'max_price', 'min_rating'] as const) {
      if (params[k]) sp.set(k, params[k] as string);
    }
    if (page > 1) sp.set('page', String(page));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // key для CatalogFilters — пере-инициализация локального состояния при
  // изменении фильтров извне (кнопка «назад» и т.п.).
  const filterKey = `${params.min_price ?? ''}|${params.max_price ?? ''}|${params.min_rating ?? ''}`;

  return (
    <>
      {/* Счётчик найденного + сортировка */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {data.meta.total.toLocaleString('ru')} товаров
          {params.q ? ` · поиск «${params.q}»` : ''}
        </p>
        <SortSelect params={params} current={currentSort} />
      </div>

      {/* Двухколоночный layout: фильтры + сетка */}
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <CatalogFilters key={filterKey} params={params} />

        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.data.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              По вашему запросу ничего не найдено.{' '}
              <Link href={basePath} className="text-brand-600 hover:underline">
                Сбросить фильтры
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.data.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Пагинация */}
          {data.meta.last_page > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Страница {data.meta.current_page} из {data.meta.last_page}
              </div>
              <div className="flex items-center gap-1">
                {data.meta.current_page > 1 && (
                  <Link
                    href={pageUrl(data.meta.current_page - 1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                  >
                    ‹
                  </Link>
                )}
                {pageWindow(data.meta.current_page, data.meta.last_page).map((page, idx) =>
                  page === '…' ? (
                    <span key={`gap-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400">
                      …
                    </span>
                  ) : (
                    <Link
                      key={page}
                      href={pageUrl(page)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg ${
                        page === data.meta.current_page
                          ? 'fk-grad-btn'
                          : 'border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                      }`}
                    >
                      {page}
                    </Link>
                  ),
                )}
                {data.meta.current_page < data.meta.last_page && (
                  <Link
                    href={pageUrl(data.meta.current_page + 1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                  >
                    ›
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
