import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getProduct } from '@/lib/api';
import { ProductBuyBox } from '@/components/ProductBuyBox';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductTabs } from '@/components/ProductTabs';

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: 'from-brand-500 via-fuchsia-500 to-pink-500',
  vpn: 'from-indigo-500 to-blue-600',
  skins: 'from-orange-500 to-rose-600',
  keys: 'from-fuchsia-500 to-purple-700',
  subs: 'from-emerald-500 to-teal-600',
  accounts: 'from-yellow-500 to-orange-500',
  services: 'from-violet-500 to-fuchsia-500',
};

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
        </div>

        {/* Правая колонка: блок покупки (client component) */}
        <ProductBuyBox product={product} />
      </div>
    </div>
  );
}
