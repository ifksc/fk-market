import type { Metadata } from 'next';

// Приватный раздел (личный кабинет) — закрываем от индексации.
// robots.txt Disallow запрещает обход, но не гарантирует исключение из
// индекса; meta noindex — надёжнее. Страницы раздела — 'use client',
// мету напрямую не отдают, поэтому метатег задаётся здесь, в layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
