import { Suspense } from 'react';
import Link from 'next/link';
import { CatalogResults } from '@/components/CatalogResults';
import { CatalogResultsView } from '@/components/CatalogResultsView';
import { JsonLd } from '@/components/JsonLd';
import { getCategories, getProducts } from '@/lib/api';

const SITE = 'https://fk.market';

export type CatalogViewProps = {
  /** slug категории; undefined — общий каталог / поиск */
  category?: string;
};

/**
 * Каркас страницы каталога. Используется и /catalog, и /catalog/[slug].
 *
 * Шапка (крошки, h1, описание, чипсы категорий) и JSON-LD рендерятся на
 * сервере — они зависят только от slug категории, поэтому страница остаётся
 * статической и кэшируется (ISR). Список товаров с фильтрами/сортировкой/
 * пагинацией вынесен в клиентский <CatalogResults> за <Suspense>: фильтры
 * живут в URL и применяются на клиенте, не дёргая SSR на каждый запрос.
 *
 * Дефолтный список (популярные, стр. 1, без фильтров) рендерится сервером
 * дважды: как fallback <Suspense> (попадает в статичный HTML — нужно для SEO
 * и мгновенной отдачи) и как `initial` для клиентского компонента.
 */
export async function CatalogView({ category }: CatalogViewProps) {
  const basePath = category ? `/catalog/${category}` : '/catalog';

  const [categories, defaultPage] = await Promise.all([
    getCategories(),
    getProducts({ category, sort: 'popular', page: 1, per_page: 24 }),
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
        // description + url — для корректного CollectionPage в rich snippets.
        description:
          (activeCat.description ?? '').replace(/\s+/g, ' ').trim() ||
          `${activeCat.name} в каталоге FK.market: цифровые товары с автоматической выдачей сразу после оплаты.`,
        url: `${SITE}/catalog/${activeCat.slug}`,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: defaultPage.data.length,
          itemListElement: defaultPage.data.map((p, i) => ({
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
            <Link href={`/catalog/${a.slug}`} className="hover:text-brand-600">
              {a.name}
            </Link>
          </span>
        ))}
        {activeCat && <span> / {activeCat.name}</span>}
      </nav>

      {/* Заголовок */}
      <h1 className="text-3xl font-bold mb-1">{activeCat?.name ?? 'Каталог'}</h1>

      {/* SEO-описание категории — заполняется в админке */}
      {activeCat?.description && (
        <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 mb-6 max-w-3xl whitespace-pre-line">
          {activeCat.description}
        </p>
      )}

      {/* Чипсы категорий */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mt-4 mb-6">
        <Link
          href="/catalog"
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
            href={`/catalog/${ancestors[ancestors.length - 1].slug}`}
            className="px-4 h-9 flex items-center rounded-full text-sm whitespace-nowrap bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
          >
            ↑ {ancestors[ancestors.length - 1].name}
          </Link>
        )}
        {visibleCats.map((cat) => (
          <Link
            key={cat.id}
            href={`/catalog/${cat.slug}`}
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

      {/* Список товаров: фильтры/сортировка/пагинация — на клиенте.
          fallback <Suspense> = серверный дефолтный список → попадает в
          статичный HTML (SEO + мгновенная отдача из ISR-кэша). */}
      <Suspense
        fallback={
          <CatalogResultsView data={defaultPage} basePath={basePath} params={{}} />
        }
      >
        <CatalogResults category={category} basePath={basePath} initial={defaultPage} />
      </Suspense>

      {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
      {collectionLd && <JsonLd data={collectionLd} />}
    </div>
  );
}
