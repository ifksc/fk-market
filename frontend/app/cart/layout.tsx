import type { Metadata } from 'next';

// Приватная страница (корзина) — закрываем от индексации.
// robots.txt Disallow запрещает обход, но не гарантирует исключение из
// индекса; meta noindex — надёжнее.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
