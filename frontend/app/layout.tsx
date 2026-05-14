import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { SiteShell } from '@/components/SiteShell';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CartProvider } from '@/lib/cart';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FK.market — цифровые товары, VPN, ИИ-аккаунты, ключи',
  description: 'Маркетплейс цифровых товаров: VPN, скины Steam, ключи игр, ChatGPT Plus, Claude Pro, подписки и услуги. Автовыдача 24/7, оплата картой и СБП.',
  metadataBase: new URL('https://fk.market'),
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'FK.market',
    description: 'Цифровые товары с автовыдачей',
    type: 'website',
    locale: 'ru_RU',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider />
        <AuthProvider>
          <CartProvider>
            <SiteShell>{children}</SiteShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
