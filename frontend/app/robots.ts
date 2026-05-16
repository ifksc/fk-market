import type { MetadataRoute } from 'next';

// robots.txt: открываем каталог и товары, закрываем личные и служебные разделы.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/admin',
        '/cart',
        '/checkout',
        '/oauth',
        '/login',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: 'https://fk.market/sitemap.xml',
  };
}
