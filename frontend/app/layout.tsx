import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { SiteShell } from '@/components/SiteShell';
import { ThemeProvider } from '@/components/ThemeProvider';
import { YandexMetrikaHits } from '@/components/YandexMetrikaHits';
import { CartProvider } from '@/lib/cart';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'FK.market — цифровые товары, ключи, пополнения с автовыдачей',
    template: '%s — FK.market',
  },
  description: 'Маркетплейс цифровых товаров: VPN, скины Steam, ключи игр, ChatGPT Plus, Claude Pro, подписки и услуги. Автовыдача 24/7, оплата картой и СБП.',
  metadataBase: new URL('https://fk.market'),
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'FK.market',
    description: 'Цифровые товары с автовыдачей',
    type: 'website',
    locale: 'ru_RU',
    siteName: 'FK.market',
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

        {/* Yandex.Metrika counter (id 109257922) */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=109257922', 'ym');
          ym(109257922, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});`}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/109257922"
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
        <YandexMetrikaHits />
      </body>
    </html>
  );
}
