import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/api';
import type { BlogPostCard } from '@/lib/types';

type SearchParams = { page?: string; tag?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const tag = sp.tag?.trim();

  if (tag) {
    return {
      title: `Статьи по тегу «${tag}»`,
      description: `Статьи блога FK.market по теме «${tag}» — гайды по цифровым товарам.`,
      // Канонический — без номера страницы: пагинация не плодит дубли.
      alternates: { canonical: `/blog?tag=${encodeURIComponent(tag)}` },
    };
  }

  return {
    title: 'Блог',
    description:
      'Блог FK.market: гайды по пополнению Steam, играм, подпискам и цифровым товарам.',
    alternates: { canonical: '/blog' },
    openGraph: { url: '/blog' },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tag = sp.tag?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  let posts: BlogPostCard[] = [];
  let lastPage = 1;
  try {
    const res = await getBlogPosts({ tag, page });
    posts = res.data;
    lastPage = res.meta.last_page;
  } catch {
    posts = [];
  }

  // Ссылка на страницу пагинации с сохранением тега.
  const pageUrl = (p: number) => {
    const q = new URLSearchParams();
    if (tag) q.set('tag', tag);
    if (p > 1) q.set('page', String(p));
    const qs = q.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        <Link href="/" className="hover:text-brand-600">Главная</Link>
        {' / '}
        {tag ? (
          <>
            <Link href="/blog" className="hover:text-brand-600">Блог</Link>
            {' / '}
            <span>тег «{tag}»</span>
          </>
        ) : (
          <span>Блог</span>
        )}
      </nav>

      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
        {tag ? `Статьи по тегу «${tag}»` : 'Блог'}
      </h1>
      {tag ? (
        <Link href="/blog" className="inline-block text-sm text-brand-600 hover:underline mb-8">
          ← Все статьи
        </Link>
      ) : (
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
          Гайды и статьи о цифровых товарах
        </p>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {tag ? `По тегу «${tag}» статей пока нет` : 'Статей пока нет'}
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <article
                key={p.id}
                className="fk-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col"
              >
                <Link href={`/blog/${p.slug}`} className="flex flex-col flex-1">
                  <div className="relative aspect-[1200/630] bg-slate-100 dark:bg-slate-800">
                    {p.cover_image && (
                      <Image
                        src={p.cover_image}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4 pb-2 flex flex-col flex-1">
                    <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                      {formatDate(p.published_at)}
                    </div>
                    <h2 className="font-semibold line-clamp-2 mb-1">{p.title}</h2>
                    {p.excerpt && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-3">
                        {p.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
                {p.tags.length > 0 && (
                  <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <Link
                        key={t}
                        href={`/blog?tag=${encodeURIComponent(t)}`}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700 transition"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Пагинация */}
          {lastPage > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageUrl(page - 1)}
                  className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center"
                >
                  ← Назад
                </Link>
              ) : (
                <span className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 text-sm opacity-40 flex items-center">
                  ← Назад
                </span>
              )}
              <span className="text-sm text-gray-500 px-3">
                Страница {page} из {lastPage}
              </span>
              {page < lastPage ? (
                <Link
                  href={pageUrl(page + 1)}
                  className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center"
                >
                  Вперёд →
                </Link>
              ) : (
                <span className="h-9 px-4 rounded-lg border border-gray-200 dark:border-slate-800 text-sm opacity-40 flex items-center">
                  Вперёд →
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
