import type { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/api';

const SITE = 'https://fk.market';

// Карта сайта пересобирается раз в час (ISR) — новые товары попадают в неё
// без полного передеплоя.
export const revalidate = 3600;

type SitemapEntry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/guarantees`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/legal/oferta`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  let categories: MetadataRoute.Sitemap = [];
  try {
    const cats = await getCategories();
    categories = cats
      .filter((c) => c.products_count > 0)
      .map((c): SitemapEntry => ({
        url: `${SITE}/catalog?category=${encodeURIComponent(c.slug)}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }));
  } catch {
    categories = [];
  }

  let products: MetadataRoute.Sitemap = [];
  try {
    // 208 товаров на данный момент. Если каталог вырастет за ~1000 — карту
    // нужно будет разбить на несколько через generateSitemaps.
    const page = await getProducts({ per_page: 1000 });
    products = page.data.map((p): SitemapEntry => ({
      url: `${SITE}/products/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    products = [];
  }

  return [...staticPages, ...categories, ...products];
}
