import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { CatalogView } from '@/components/CatalogView';
import { getCategories } from '@/lib/api';

// ISR: страница категории кэшируется и перегенерируется не чаще раза в 2 минуты.
// Фильтры/сортировка/пагинация живут в URL и применяются на клиенте
// (см. CatalogResults), поэтому searchParams здесь не читаются — это и
// позволяет роуту быть статическим.
export const revalidate = 120;

// Пустой список: категории не пре-рендерятся на сборке, но наличие
// generateStaticParams переводит динамический роут [slug] в режим ISR —
// страница кэшируется при первом запросе. Без этого revalidate не действует.
export async function generateStaticParams() {
  return [];
}

type Props = {
  params: Promise<{ slug: string }>;
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

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const categories = await getCategories();
  const bySlug = categories.find((c) => c.slug === slug);

  // Запрос пришёл по старому slug (fk-11) — 301 на новый ЧПУ.
  // permanentRedirect бросает исключение, поэтому вызываем вне try/catch.
  if (!bySlug) {
    const byLegacy = categories.find((c) => c.legacy_slug === slug);
    if (byLegacy) {
      permanentRedirect(`/catalog/${byLegacy.slug}`);
    }
    notFound();
  }

  return <CatalogView category={slug} />;
}
