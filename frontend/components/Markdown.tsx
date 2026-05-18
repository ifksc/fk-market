import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Рендер контента статьи → React. Поддерживает и Markdown, и обычный HTML
 * (картинки, ссылки, заголовки, списки) — журналист может писать как угодно.
 *
 * rehype-raw разбирает встроенный HTML, rehype-sanitize чистит его по
 * безопасному списку тегов/атрибутов: вырезаются <script>, обработчики
 * событий (onclick…) и javascript:-ссылки — XSS-безопасно даже для
 * контента из админки. Порядок плагинов важен: сначала raw, потом sanitize.
 *
 * Общий компонент: страница статьи /blog/[slug] и живое превью в редакторе.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="blog-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
