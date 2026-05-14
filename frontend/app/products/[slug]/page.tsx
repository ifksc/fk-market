import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getProduct } from '@/lib/api';
import { ProductBuyBox } from '@/components/ProductBuyBox';
import { ProductGallery } from '@/components/ProductGallery';

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

          {/* Описание */}
          <div className="border-b border-gray-200 dark:border-slate-800 mb-6 mt-8">
            <div className="flex gap-6 text-sm">
              <div className="py-3 border-b-2 border-brand-500 font-medium">Описание</div>
              <div className="py-3 border-b-2 border-transparent text-gray-500">
                Отзывы ({product.reviews_count.toLocaleString('ru')})
              </div>
              <div className="py-3 border-b-2 border-transparent text-gray-500">Гарантии</div>
            </div>
          </div>

          <article className="text-sm text-gray-700 dark:text-slate-300 max-w-none">
            <p className="text-base whitespace-pre-line">{product.short_description}</p>
            {product.description && product.description !== product.short_description && (
              <p className="mt-4 whitespace-pre-line">{product.description}</p>
            )}
          </article>

          {/* Отзывы preview */}
          {product.reviews.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Отзывы покупателей</h3>
                <Link href="#" className="text-sm text-brand-600 hover:underline">
                  Все {product.reviews_count.toLocaleString('ru')} →
                </Link>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {product.reviews.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500" />
                      <div>
                        <div className="font-medium text-sm">{r.author}</div>
                        {r.created_at && (
                          <div className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleDateString('ru')}
                          </div>
                        )}
                      </div>
                      <div className="ml-auto text-yellow-400 text-sm">
                        {'★'.repeat(r.rating)}
                        {'☆'.repeat(5 - r.rating)}
                      </div>
                    </div>
                    {r.text && <p className="text-sm text-gray-600 dark:text-slate-300">{r.text}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка: блок покупки (client component) */}
        <ProductBuyBox product={product} />
      </div>
    </div>
  );
}
