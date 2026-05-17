import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { CatalogView } from '@/components/CatalogView';
import { getCategories } from '@/lib/api';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
    min_price?: string;
    max_price?: string;
    min_rating?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cats = await getCategories();
    const cat = cats.find((c) => c.slug === slug);
    if (cat) {
      const ownDesc = (cat.description ?? '').replace(/\s+/g, ' ').trim();
      const description = ownDesc
        ? ownDesc.length > 160
          ? `${ownDesc.slice(0, 157).trimEnd()}…`
          : ownDesc
        : `${cat.name} в каталоге FK.market: цифровые товары с автоматической выдачей сразу после оплаты.`;
      const canonical = `/catalog/${slug}`;
      return {
        title: `${cat.name} — купить с моментальной выдачей`,
        description,
        alternates: { canonical },
        openGraph: { url: canonical },
      };
    }
  } catch {
    /* категории недоступны — отдадим минимальные метаданные */
  }
  return { title: 'Категория', robots: { index: false } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const categories = await getCategories();
  const bySlug = categories.find((c) => c.slug === slug);

  // Запрос пришёл по старому slug (fk-11) — 301 на новый ЧПУ.
  if (!bySlug) {
    const byLegacy = categories.find((c) => c.legacy_slug === slug);
    if (byLegacy) {
      const qs = new URLSearchParams(
        Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1])),
      ).toString();
      permanentRedirect(`/catalog/${byLegacy.slug}${qs ? `?${qs}` : ''}`);
    }
    notFound();
  }

  return (
    <CatalogView
      category={slug}
      sort={sp.sort}
      page={sp.page}
      min_price={sp.min_price}
      max_price={sp.max_price}
      min_rating={sp.min_rating}
    />
  );
}
