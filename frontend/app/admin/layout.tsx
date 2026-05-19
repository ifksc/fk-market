import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';

// Админка — закрываем от индексации. robots.txt Disallow запрещает обход,
// но не гарантирует исключение из индекса; meta noindex — надёжнее.
// layout серверный (ради экспорта metadata); вся клиентская обвязка
// (проверка токена, навигация, logout) — в components/admin/AdminShell.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
