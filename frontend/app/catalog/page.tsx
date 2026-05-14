import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { getCategories, getProducts, type ProductsQuery } from '@/lib/api';

const SORT_LABELS: Record<NonNullable<ProductsQuery['sort']>, string> = {
  popular: 'По популярности',
  price_asc: 'По цене ↑',
  price_desc: 'По цене ↓',
  new: 'Сначала новые',
  rating: 'По рейтингу',
};

type SearchParams = {
  category?: string;
  q?: string;
  sort?: ProductsQuery['sort'];
  page?: string;
};

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
      sort: currentSort,
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

        <form className="flex items-center gap-2 text-sm">
          <input type="hidden" name="category" value={currentCategory ?? ''} />
          {params.q && <input type="hidden" name="q" value={params.q} />}
          <label className="text-gray-500">Сортировка:</label>
          <select
            name="sort"
            defaultValue={currentSort}
            // отправляем форму при изменении (без JS — через стандартный submit на change через нативный hack: <select onchange="this.form.submit()">)
            // в server component нельзя инлайн-onchange, поэтому — ниже отдельный client component, либо просто <button>
            className="h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 px-4 rounded-xl border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Применить
          </button>
        </form>
      </div>

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

      {/* Сетка товаров */}
      {productsPage.data.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          По вашему запросу ничего не найдено.{' '}
          <Link href="/catalog" className="text-brand-600 hover:underline">
            Сбросить фильтры
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
  );
}
