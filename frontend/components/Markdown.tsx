import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Рендер Markdown → React. react-markdown по умолчанию НЕ рендерит сырой HTML
 * из текста — это XSS-безопасно даже для контента, написанного в админке.
 * Общий компонент: страница статьи /blog/[slug] и живое превью в редакторе.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="blog-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
