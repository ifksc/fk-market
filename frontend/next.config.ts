import type { NextConfig } from 'next';

// Content-Security-Policy в режиме Report-Only — браузер НЕ блокирует
// нарушения, только пишет их в консоль. Так мы собираем реальную картину
// (что грузится со страниц) без риска что-то сломать.
//
// Почему script-src содержит 'unsafe-inline': страницы кэшируются (ISR/SSG),
// поэтому per-request nonce невозможен — он был бы одинаковым на всех копиях
// из кэша. Inline-скрипты нужны Next.js (RSC-гидрация), JSON-LD и счётчику
// Яндекс.Метрики. Внешние домены — tag.js Метрики и вебвизор.
//
// Когда нарушений в консоли не останется — заголовок можно переименовать в
// `Content-Security-Policy` (enforce) отдельной задачей.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://mc.yandex.ru https://mc.webvisor.org https://yastatic.net",
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
          // CSP пока в режиме Report-Only — собираем нарушения, не блокируем.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
