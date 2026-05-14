import type { NextConfig } from 'next';

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
};

export default nextConfig;
