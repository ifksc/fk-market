import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CatalogFilters, SortSelect } from '@/components/CatalogFilters';
import { getCategories, getProducts, type ProductsQuery } from '@/lib/api';

type SearchParams = {
  category?: string;
  q?: string;
  sort?: string;
  page?: string;
  min_price?: string;
  max_price?: string;
  min_rating?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;

  // Страницы поиска не индексируем — это бесконечное пространство URL.
  if (params.q) {
    const q = params.q.trim();
    return {
      title: `Поиск: ${q}`,
      description: `Результаты поиска «${q}» в каталоге цифровых товаров FK.market.`,
      alternates: { canonical: '/catalog' },
      robots: { index: false },
    };
  }

  if (params.category) {
    try {
      const cats = await getCategories();
      const cat = cats.find((c) => c.slug === params.category);
      if (cat) {
        // Если у категории заполнено описание — берём его (обрезав) в meta,
        // иначе генерим типовое.
        const ownDesc = (cat.description ?? '').replace(/\s+/g, ' ').trim();
        const description = ownDesc
          ? (ownDesc.length > 160 ? `${ownDesc.slice(0, 157).trimEnd()}…` : ownDesc)
          : `${cat.name} в каталоге FK.market: цифровые товары с автоматической выдачей сразу после оплаты.`;
        return {
          title: `${cat.name} — купить с моментальной выдачей`,
          description,
          alternates: { canonical: `/catalog?category=${encodeURIComponent(cat.slug)}` },
        };
      }
    } catch {
      /* категории недоступны — отдадим общий тайтл ниже */
    }
  }

  return {
    title: 'Каталог цифровых товаров',
    description:
      'Каталог FK.market: игровые ключи, пополнения Steam, PSN, Xbox, подписки и коды с моментальной выдачей.',
    alternates: { canonical: '/catalog' },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const currentCategory = params.category;
  const currentSort = params.sort ?? 'popular';
  const currentPage = Number(params.page ?? 1);

  const [categories, productsPage] = await Promise.all([
    getCategories(),
    getProducts({
      category: currentCategory,
      q: params.q,
      sort: currentSort as ProductsQuery['sort'],
      min_price: params.min_price ? Number(params.min_price) : undefined,
      max_price: params.max_price ? Number(params.max_price) : undefined,
      min_rating: params.min_rating ? Number(params.min_rating) : undefined,
      page: currentPage,
      per_page: 24,
    }),
  ]);

  const activeCat = categories.find((c) => c.slug === currentCategory);

  // Какие категории показывать в чипсах:
  //   нет выбранной — корневые (parent_id IS NULL)
  //   есть выбранная — её дочерние + она сама (как «текущая»)
  //   если у активной нет детей — её сиблинги (соседи в дереве)
  const visibleCats = (() => {
    if (!activeCat) return categories.filter((c) => c.parent_id === null);
    const children = categories.filter((c) => c.parent_id === activeCat.id);
    if (children.length > 0) return children;
    // лист — показываем сиблингов
    return categories.filter((c) => c.parent_id === activeCat.parent_id);
  })();

  // Хлебная цепочка предков активной категории — для крошек и кнопки «Назад в раздел»
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

  const buildUrl = (override: Partial<SearchParams>) => {
    const next = { ...params, ...override };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, String(v));
    });
    const qs = sp.toString();
    return `/catalog${qs ? `?${qs}` : ''}`;
  };

  // key для CatalogFilters — чтобы локальное состояние компонента
  // пере-инициализировалось, если фильтры поменялись извне (кнопка «назад» и т.п.)
  const filterKey = `${params.min_price ?? ''}|${params.max_price ?? ''}|${params.min_rating ?? ''}`;

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
            <Link href={buildUrl({ category: a.slug, page: undefined })} className="hover:text-brand-600">
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
            {params.q ? ` · поиск «${params.q}»` : ''}
          </p>
        </div>
        <SortSelect params={params} current={currentSort} />
      </div>

      {/* SEO-описание категории — заполняется в админке */}
      {activeCat?.description && (
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 max-w-3xl whitespace-pre-line">
          {activeCat.description}
        </p>
      )}

      {/* Чипсы категорий: контекстные (родительская группа или дети текущей) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
        <Link
          href={buildUrl({ category: undefined, page: undefined })}
          className={`px-4 h-9 flex items-center rounded-full text-sm whitespace-nowrap transition ${
            !currentCategory
              ? 'fk-grad-btn'
              : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800'
          }`}
        >
          Все
        </Link>
        {activeCat && ancestors.length > 0 && (
          <Link
            href={buildUrl({ category: ancestors[ancestors.length - 1].slug, page: undefined })}
            className="px-4 h-9 flex items-center rounded-full text-sm whitespace-nowrap bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
          >
            ↑ {ancestors[ancestors.length - 1].name}
          </Link>
        )}
        {visibleCats.map((cat) => (
          <Link
            key={cat.id}
            href={buildUrl({ category: cat.slug, page: undefined })}
            className={`px-4 h-9 flex items-center gap-1.5 rounded-full text-sm whitespace-nowrap transition ${
              currentCategory === cat.slug
                ? 'fk-grad-btn'
                : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800'
            }`}
          >
            {cat.name}
            {cat.slug === 'ai' && currentCategory !== 'ai' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full fk-grad-btn">NEW</span>
            )}
          </Link>
        ))}
      </div>

      {/* Двухколоночный layout: фильтры + сетка */}
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <CatalogFilters key={filterKey} params={params} />

        <div>
          {/* Сетка товаров */}
          {productsPage.data.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              По вашему запросу ничего не найдено.{' '}
              <Link href="/catalog" className="text-brand-600 hover:underline">
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
                    href={buildUrl({ page: String(productsPage.meta.current_page - 1) })}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                  >
                    ‹
                  </Link>
                )}
                {Array.from({ length: productsPage.meta.last_page }, (_, i) => i + 1).map((page) => (
                  <Link
                    key={page}
                    href={buildUrl({ page: page === 1 ? undefined : String(page) })}
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
                    href={buildUrl({ page: String(productsPage.meta.current_page + 1) })}
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
    </div>
  );
}
