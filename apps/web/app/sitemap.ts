import type { MetadataRoute } from 'next';

const baseUrl = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://e3lani.com').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/browse',
    '/search',
    '/categories',
    '/cities',
    '/pricing',
    '/enterprise',
    '/faq',
    '/terms',
    '/privacy',
    '/content-policy',
  ];
  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' || route === '/browse' || route === '/search' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : route === '/browse' || route === '/search' ? 0.9 : 0.7,
  }));
}
