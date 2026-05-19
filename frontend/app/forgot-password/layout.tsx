import type { Metadata } from 'next';

// Служебная страница (восстановление пароля) — закрываем от индексации.
// robots.txt Disallow запрещает обход, но не гарантирует исключение из
// индекса; meta noindex — надёжнее.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
