import type { MetadataRoute } from 'next';

const baseUrl = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://e3lani.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/login', '/ads/new', '/payment'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
