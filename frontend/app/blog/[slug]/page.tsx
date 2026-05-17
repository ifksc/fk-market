import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getProduct } from '@/lib/api';
import type { BlogPostFull, ProductDetail } from '@/lib/types';
import { JsonLd } from '@/components/JsonLd';
import { FaqAccordion } from '@/components/FaqAccordion';
import { Markdown } from '@/components/Markdown';
import { ProductCard } from '@/components/ProductCard';
import { BlogCard } from '@/components/BlogCard';

// ISR: статья кэшируется и перегенерируется не чаще раза в 5 минут.
export const revalidate = 300;

// Статьи не пре-рендерятся на сборке, но generateStaticParams переводит
// динамический роут [slug] в режим ISR (кэш при первом запросе).
export async function generateStaticParams() {
  return [];
}

const SITE = 'https://fk.market';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let post;
  try {
    post = await getBlogPost(slug);
  } catch {
    return { title: 'Статья не найдена', robots: { index: false } };
  }

  const description = (post.meta_description || post.excerpt || post.title).slice(0, 200);
  const canonical = `/blog/${post.slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url: canonical,
      images: post.cover_image ? [post.cover_image] : undefined,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  let post;
  try {
    post = await getBlogPost(slug);
  } catch {
    notFound();
  }

  const url = `${SITE}/blog/${post.slug}`;

  // CTA-блок: подтягиваем связанные товары по slug. Несуществующий/удалённый
  // товар молча пропускаем — статья не должна падать из-за него.
  let relatedProducts: ProductDetail[] = [];
  if (post.related_products.length > 0) {
    const fetched = await Promise.all(
      post.related_products.slice(0, 8).map((s) => getProduct(s).catch(() => null)),
    );
    relatedProducts = fetched.filter((p): p is ProductDetail => p !== null);
  }

  // Связанные статьи по slug. getBlogPost отдаёт только опубликованные —
  // несуществующая статья/черновик молча пропускается.
  let relatedPosts: BlogPostFull[] = [];
  if (post.related_posts.length > 0) {
    const fetched = await Promise.all(
      post.related_posts.slice(0, 3).map((s) => getBlogPost(s).catch(() => null)),
    );
    relatedPosts = fetched.filter((p): p is BlogPostFull => p !== null);
  }

  // Микроразметка статьи + хлебных крошек (+ FAQPage при наличии вопросов).
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt || post.title,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: { '@type': 'Person', name: post.author || 'FK.market' },
    publisher: {
      '@type': 'Organization',
      name: 'FK.market',
      logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` },
    },
    mainEntityOfPage: url,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Блог', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  const faqLd =
    post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      {/* Хлебные крошки */}
      <nav className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        <Link href="/" className="hover:text-brand-600">Главная</Link> /{' '}
        <Link href="/blog" className="hover:text-brand-600">Блог</Link>
        {' / '}
        <span>{post.title}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{post.title}</h1>

      <div className="mt-3 flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
        {post.author && <span>{post.author}</span>}
        {post.published_at && <span>· {formatDate(post.published_at)}</span>}
      </div>

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <Link
              key={t}
              href={`/blog?tag=${encodeURIComponent(t)}`}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-brand-600"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {post.cover_image && (
        <div className="relative aspect-[1200/630] w-full mt-6 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Контент статьи (Markdown) */}
      <div className="mt-8">
        <Markdown>{post.content ?? ''}</Markdown>
      </div>

      {/* CTA-блок: товары из статьи */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="font-bold text-xl mb-4">Товары из статьи</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* Частые вопросы */}
      {post.faq.length > 0 && (
        <section className="mt-12">
          <h2 className="font-bold text-xl mb-4">Частые вопросы</h2>
          <FaqAccordion items={post.faq.map((f, i) => ({ id: i, ...f }))} />
        </section>
      )}

      {/* Связанные статьи */}
      {relatedPosts.length > 0 && (
        <section className="mt-12">
          <h2 className="font-bold text-xl mb-4">Читайте также</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPosts.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      {faqLd && <JsonLd data={faqLd} />}
    </article>
  );
}
