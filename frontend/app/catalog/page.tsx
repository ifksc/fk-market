import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { CatalogView } from '@/components/CatalogView';

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

  return {
    title: 'Каталог цифровых товаров',
    description:
      'Каталог FK.market: игровые ключи, пополнения Steam, PSN, Xbox, подписки и коды с моментальной выдачей.',
    alternates: { canonical: '/catalog' },
    openGraph: { url: '/catalog' },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Старый URL вида /catalog?category=X — 301 на ЧПУ /catalog/X.
  if (params.category) {
    const sp = new URLSearchParams();
    (['sort', 'page', 'min_price', 'max_price', 'min_rating'] as const).forEach((k) => {
      if (params[k]) sp.set(k, params[k] as string);
    });
    const qs = sp.toString();
    permanentRedirect(`/catalog/${encodeURIComponent(params.category)}${qs ? `?${qs}` : ''}`);
  }

  return <CatalogView />;
}
