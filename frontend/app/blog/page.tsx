import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/api';
import type { BlogPostCard } from '@/lib/types';

// ISR: список блога кэшируется и перегенерируется не чаще раза в 5 минут.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Блог',
  description:
    'Блог FK.market: гайды по пополнению Steam, играм, подпискам и цифровым товарам.',
  alternates: { canonical: '/blog' },
  openGraph: { url: '/blog' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogListPage() {
  let posts: BlogPostCard[] = [];
  try {
    const page = await getBlogPosts();
    posts = page.data;
  } catch {
    posts = [];
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        <Link href="/" className="hover:text-brand-600">Главная</Link> / <span>Блог</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Блог</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
        Гайды и статьи о цифровых товарах
      </p>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Статей пока нет</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="fk-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col"
            >
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
              <div className="p-4 flex flex-col flex-1">
                <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                  {formatDate(p.published_at)}
                </div>
                <h2 className="font-semibold line-clamp-2 mb-1">{p.title}</h2>
                {p.excerpt && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-3">
                    {p.excerpt}
                  </p>
                )}
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
