import type { NextConfig } from 'next';

// Content-Security-Policy в режиме enforce — браузер блокирует ресурсы,
// не разрешённые политикой.
//
// Почему script-src содержит 'unsafe-inline': страницы кэшируются (ISR/SSG),
// поэтому per-request nonce невозможен — он был бы одинаковым на всех копиях
// из кэша. Inline-скрипты нужны Next.js (RSC-гидрация), JSON-LD и счётчикам
// Яндекс.Метрики и Google Analytics. Внешние домены — Метрика (+вебвизор)
// и Google (googletagmanager + google-analytics).
//
// OAuth (VK / Яндекс / Telegram) работает через top-level redirect
// (window.location → id.vk.com / oauth.yandex.ru / oauth.telegram.org) —
// CSP навигацию не ограничивает, отдельных директив для него не нужно.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://mc.yandex.ru https://mc.webvisor.org https://yastatic.net https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://mc.yandex.ru",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  // Standalone output: Next.js упаковывает только то, что реально нужно для запуска.
  // На выходе получаем .next/standalone/server.js, который запускается одной командой `node server.js`.
  // Это идеально для Docker — итоговый образ ~150MB вместо 1GB.
  output: 'standalone',

  // Картинки: разрешаем загрузку с домена API
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fk.market' },
      // Картинки товаров из синхронизации FKwallet лежат на их CDN.
      { protocol: 'https', hostname: 'cdn.fkwallet.io' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  // Заголовки безопасности.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Отключаем неиспользуемые мощные API браузера + Topics-трекинг.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // CSP в режиме enforce — ресурсы вне политики блокируются.
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
