import Image from 'next/image';
import Link from 'next/link';
import type { BlogPostCard as BlogPostCardType } from '@/lib/types';

/** Дата публикации в формате «17 мая 2026». */
function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Компактная карточка статьи блога (обложка + дата + заголовок + excerpt).
 * Используется в блоке «Читайте также» на странице статьи и в секции блога
 * на главной. Список /blog рендерит свою карточку — там теги кликабельны.
 */
export function BlogCard({ post }: { post: BlogPostCardType }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="fk-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[1200/630] bg-slate-100 dark:bg-slate-800">
        {post.cover_image && (
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-gray-400 dark:text-slate-500 mb-1">
          {formatDate(post.published_at)}
        </div>
        <h3 className="font-semibold line-clamp-2 mb-1">{post.title}</h3>
        {post.excerpt && (
          <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{post.excerpt}</p>
        )}
      </div>
    </Link>
  );
}
