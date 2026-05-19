import type { Metadata } from 'next';

// /support — публичная страница, индексируется. Своя страница 'use client',
// мету напрямую не отдаёт — уникальные title/description/canonical задаём
// здесь, в layout (иначе наследуются дефолты корневого layout).
export const metadata: Metadata = {
  title: 'Поддержка покупателей',
  description:
    'Поддержка FK.market: помощь по статусу заказа, оплате, возвратам и '
    + 'выдаче цифровых товаров. Напишите нам — поможем с покупкой ключей, '
    + 'пополнений и подписок.',
  alternates: { canonical: '/support' },
  openGraph: { url: '/support' },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
