import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CatalogFilters, SortSelect } from '@/components/CatalogFilters';
import { getCategories, getProducts, type ProductsQuery } from '@/lib/api';

const SITE = 'https://fk.market';

export type CatalogViewProps = {
  /** slug категории; undefined — общий каталог / поиск */
  category?: string;
  q?: string;
  sort?: string;
  page?: string;
  min_price?: string;
  max_price?: string;
  min_rating?: string;
};

/**
 * Содержимое каталога. Используется и страницей /catalog (общий каталог,
 * поиск), и страницей /catalog/[slug] (категория с ЧПУ). Категория приходит
 * пропом из пути, фильтры — query-параметрами.
 */
export async function CatalogView(props: CatalogViewProps) {
  const { category, q, min_price, max_price, min_rating } = props;
  const currentSort = props.sort ?? 'popular';
  const currentPage = Number(props.page ?? 1);
  const basePath = category ? `/catalog/${category}` : '/catalog';

  const [categories, productsPage] = await Promise.all([
    getCategories(),
    getProducts({
      category,
      q,
      sort: currentSort as ProductsQuery['sort'],
      min_price: min_price ? Number(min_price) : undefined,
      max_price: max_price ? Number(max_price) : undefined,
      min_rating: min_rating ? Number(min_rating) : undefined,
      page: currentPage,
      per_page: 24,
    }),
  ]);

  const activeCat = categories.find((c) => c.slug === category);

  // Какие категории показывать в чипсах:
  //   нет выбранной — корневые; есть — её дети; у листа — соседи.
  const visibleCats = (() => {
    if (!activeCat) return categories.filter((c) => c.parent_id === null);
    const children = categories.filter((c) => c.parent_id === activeCat.id);
    if (children.length > 0) return children;
    return categories.filter((c) => c.parent_id === activeCat.parent_id);
  })();

  // Цепочка предков активной категории.
  const ancestors: typeof categories = [];
  if (activeCat) {
    let curParent = activeCat.parent_id;
    while (curParent) {
      const p = categories.find((c) => c.id === curParent);
      if (!p) break;
      ancestors.unshift(p);
      curParent = p.parent_id;
    }
  }

  // query-параметры для клиентских компонентов фильтров (без категории — она в пути).
  const queryParams: Record<string, string | undefined> = {
    q,
    sort: props.sort,
    page: props.page,
    min_price,
    max_price,
    min_rating,
  };

  // Ссылка на категорию (или весь каталог) — ЧПУ-путь + перенос сортировки/фильтров.
  const categoryUrl = (slug: string | null) => {
    const base = slug ? `/catalog/${slug}` : '/catalog';
    const sp = new URLSearchParams();
    if (props.sort) sp.set('sort', props.sort);
    if (min_price) sp.set('min_price', min_price);
    if (max_price) sp.set('max_price', max_price);
    if (min_rating) sp.set('min_rating', min_rating);
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };

  // Ссылка на страницу пагинации — текущий путь + query.
  const pageUrl = (page: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (props.sort) sp.set('sort', props.sort);
    if (min_price) sp.set('min_price', min_price);
    if (max_price) sp.set('max_price', max_price);
    if (min_rating) sp.set('min_rating', min_rating);
    if (page > 1) sp.set('page', String(page));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // key для CatalogFilters — пере-инициализация локального состояния при
  // изменении фильтров извне (кнопка «назад» и т.п.).
  const filterKey = `${min_price ?? ''}|${max_price ?? ''}|${min_rating ?? ''}`;

  // Микроразметка хлебных крошек — только на странице конкретной категории.
  const breadcrumbLd = activeCat
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Каталог', item: `${SITE}/catalog` },
          ...ancestors.map((a, i) => ({
            '@type': 'ListItem',
            position: i + 3,
            name: a.name,
            item: `${SITE}/catalog/${a.slug}`,
          })),
          {
            '@type': 'ListItem',
            position: ancestors.length + 3,
            name: activeCat.name,
            item: `${SITE}/catalog/${activeCat.slug}`,
          },
        ],
      }
    : null;

  // Микроразметка списка товаров категории.
  const collectionLd = activeCat
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: activeCat.name,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: productsPage.data.length,
          itemListElement: productsPage.data.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/products/${p.slug}`,
            name: p.name,
          })),
        },
      }
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Хлебные крошки */}
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        <Link href="/" className="hover:text-brand-600">
          Главная
        </Link>{' '}
        /{' '}
        <Link href="/catalog" className="hover:text-brand-600">
          Каталог
        </Link>
        {ancestors.map((a) => (
          <span key={a.id}>
            {' / '}
            <Link href={categoryUrl(a.slug)} className="hover:text-brand-600">
              {a.name}
            </Link>
          </span>
        ))}
        {activeCat && <span> / {activeCat.name}</span>}
      </nav>

      {/* Заголовок и сортировка */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{activeCat?.name ?? 'Каталог'}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {productsPage.meta.total.toLocaleString('ru')} товаров
            {q ? ` · поиск «${q}»` : ''}
          </p>
        </div>
        <SortSelect params={queryParams} current={currentSort} />
      </div>

      {/* SEO-описание категории — заполняется в админке */}
      {activeCat?.description && (
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 max-w-3xl whitespace-pre-line">
          {activeCat.description}
        </p>
      )}

      {/* Чипсы категорий */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
        <Link
          href={categoryUrl(null)}
          className={`px-4 h-9 flex items-center rounded-full text-sm whitespace-nowrap transition ${
            !category
              ? 'fk-grad-btn'
              : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800'
          }`}
        >
          Все
        </Link>
        {activeCat && ancestors.length > 0 && (
          <Link
            href={categoryUrl(ancestors[ancestors.length - 1].slug)}
            className="px-4 h-9 flex items-center rounded-full text-sm whitespace-nowrap bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
          >
            ↑ {ancestors[ancestors.length - 1].name}
          </Link>
        )}
        {visibleCats.map((cat) => (
          <Link
            key={cat.id}
            href={categoryUrl(cat.slug)}
            className={`px-4 h-9 flex items-center gap-1.5 rounded-full text-sm whitespace-nowrap transition ${
              category === cat.slug
                ? 'fk-grad-btn'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800'
            }`}
          >
            {cat.name}
            {cat.slug === 'ai' && category !== 'ai' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full fk-grad-btn">NEW</span>
            )}
          </Link>
        ))}
      </div>

      {/* Двухколоночный layout: фильтры + сетка */}
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <CatalogFilters key={filterKey} params={queryParams} />

        <div>
          {productsPage.data.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              По вашему запросу ничего не найдено.{' '}
              <Link href={categoryUrl(category ?? null)} className="text-brand-600 hover:underline">
                Сбросить фильтры
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {productsPage.data.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Пагинация */}
          {productsPage.meta.last_page > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Страница {productsPage.meta.current_page} из {productsPage.meta.last_page}
              </div>
              <div className="flex items-center gap-1">
                {productsPage.meta.current_page > 1 && (
                  <Link
                    href={pageUrl(productsPage.meta.current_page - 1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                  >
                    ‹
                  </Link>
                )}
                {Array.from({ length: productsPage.meta.last_page }, (_, i) => i + 1).map((page) => (
                  <Link
                    key={page}
                    href={pageUrl(page)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg ${
                      page === productsPage.meta.current_page
                        ? 'fk-grad-btn'
                        : 'border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                    }`}
                  >
                    {page}
                  </Link>
                ))}
                {productsPage.meta.current_page < productsPage.meta.last_page && (
                  <Link
                    href={pageUrl(productsPage.meta.current_page + 1)}
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

      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
      )}
      {collectionLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
        />
      )}
    </div>
  );
}
