import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const siteUrl = 'https://beausejourvoyage.com';
  
  // Static pages
  const staticPages = [
    '',
    '/hajj-omra',
    '/voyages-organises',
    '/blog',
    '/gallery',
    '/contact',
    '/guides',
    '/omra',
    '/ar',
    '/ar/omra',
  ];

  // Dynamic collections
  const omraPrograms = await getCollection('omra');
  const voyagesPrograms = await getCollection('voyages');
  const blogPosts = await getCollection('blog');

  const omraUrls = omraPrograms.map(p => `/omra/${p.slug}`);
  const omraArUrls = omraPrograms.map(p => `/ar/omra/${p.slug}`);
  const blogUrls = blogPosts.map(p => `/blog/${p.slug}`);

  const allPaths = [
    ...staticPages,
    ...omraUrls,
    ...omraArUrls,
    ...blogUrls
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allPaths.map(path => `
  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${path === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${path === '' ? '1.0' : path.includes('/omra') ? '0.9' : '0.7'}</priority>
  </url>`).join('').trim()}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
