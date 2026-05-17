import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCategories, getProduct } from '@/lib/api';
import { ProductBuyBox } from '@/components/ProductBuyBox';
import { ProductCard } from '@/components/ProductCard';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductTabs } from '@/components/ProductTabs';
import { FaqAccordion } from '@/components/FaqAccordion';

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: 'from-brand-500 via-fuchsia-500 to-pink-500',
  vpn: 'from-indigo-500 to-blue-600',
  skins: 'from-orange-500 to-rose-600',
  keys: 'from-fuchsia-500 to-purple-700',
  subs: 'from-emerald-500 to-teal-600',
  accounts: 'from-yellow-500 to-orange-500',
  services: 'from-violet-500 to-fuchsia-500',
};

// Готовит мета-описание: схлопывает пробелы/переносы и обрезает до ~160 символов.
function metaDescription(text: string | null | undefined, fallback: string): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch {
    return { title: 'Товар не найден', robots: { index: false } };
  }

  const priceText = product.price.toLocaleString('ru-RU');
  const title = `${product.name} — купить за ${priceText} ₽`;
  const description = metaDescription(
    product.description || product.short_description,
    `${product.name} — цифровой товар с моментальной выдачей на FK.market.`,
  );

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: product.image ? [product.image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let product;
  let allCategories;
  try {
    [product, allCategories] = await Promise.all([getProduct(slug), getCategories()]);
  } catch {
    notFound();
  }

  // Запрос пришёл по старому slug (до перехода на читаемые) — 301 на новый URL.
  // permanentRedirect бросает исключение, поэтому вызываем вне try/catch.
  if (product.slug !== slug) {
    permanentRedirect(`/products/${product.slug}`);
  }

  const grad = CATEGORY_GRADIENTS[product.category?.slug ?? ''] ?? 'from-slate-500 to-slate-700';

  // Строим путь от корня до листа: ищем нашу категорию по slug, поднимаемся по parent_id.
  const breadcrumbs: Array<{ slug: string; name: string }> = [];
  if (product.category) {
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
    let cur = bySlug.get(product.category.slug);
    while (cur) {
      breadcrumbs.unshift({ slug: cur.slug, name: cur.name });
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
  }

  // Если имя товара совпадает с именем последней категории (как у group-Product'а) —
  // не дублируем имя товара в крошках. Иначе показываем как финальный сегмент.
  const lastCat = breadcrumbs[breadcrumbs.length - 1];
  const showProductInBreadcrumbs = !lastCat || lastCat.name !== product.name;

  // Микроразметка Schema.org — Яндекс/Google могут показать цену, наличие
  // и рейтинг прямо в выдаче.
  const baseUrl = 'https://fk.market';
  const productUrl = `${baseUrl}/products/${product.slug}`;
  const outOfStock = product.fulfillment_mode === 'stock' && product.stock_available === 0;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: metaDescription(product.description || product.short_description, product.name),
    image: product.images?.length ? product.images : product.image ? [product.image] : undefined,
    category: product.category?.name,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'RUB',
      availability: outOfStock
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: productUrl,
    },
    // Рейтинг отдаём только при наличии отзывов — иначе разметка невалидна.
    ...(product.reviews_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviews_count,
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Каталог', item: `${baseUrl}/catalog` },
      ...breadcrumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 3,
        name: c.name,
        item: `${baseUrl}/catalog?category=${encodeURIComponent(c.slug)}`,
      })),
      ...(showProductInBreadcrumbs
        ? [
            {
              '@type': 'ListItem',
              position: breadcrumbs.length + 3,
              name: product.name,
              item: productUrl,
            },
          ]
        : []),
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Хлебные крошки */}
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        <Link href="/" className="hover:text-brand-600">Главная</Link> /{' '}
        <Link href="/catalog" className="hover:text-brand-600">Каталог</Link>
        {breadcrumbs.map((c, idx) => (
          <span key={c.slug}>
            {' / '}
            {idx === breadcrumbs.length - 1 && !showProductInBreadcrumbs ? (
              <span>{c.name}</span>
            ) : (
              <Link href={`/catalog?category=${c.slug}`} className="hover:text-brand-600">
                {c.name}
              </Link>
            )}
          </span>
        ))}
        {showProductInBreadcrumbs && <span> / {product.name}</span>}
      </nav>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        {/* Левая колонка: галерея + описание */}
        <div>
          <ProductGallery
            images={product.images && product.images.length > 0
              ? product.images
              : product.image ? [product.image] : []}
            fallbackGradient={grad}
            fallbackLabel={product.category?.name ?? undefined}
            discountPct={product.discount_pct}
            productName={product.name}
          />

          {/* Табы: Описание / Отзывы / Гарантии */}
          <ProductTabs
            shortDescription={product.short_description}
            description={product.description}
            reviews={product.reviews}
            reviewsCount={product.reviews_count}
          />

          {/* Частые вопросы о товаре */}
          {product.faq.length > 0 && (
            <section className="mt-10">
              <h2 className="font-bold text-lg mb-4">Частые вопросы о товаре</h2>
              <FaqAccordion items={product.faq} />
            </section>
          )}
        </div>

        {/* Правая колонка: блок покупки (client component) */}
        <ProductBuyBox product={product} />
      </div>

      {/* Похожие товары — внутренняя перелинковка */}
      {product.related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Похожие товары</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {product.related.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </div>
  );
}
