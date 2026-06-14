import type { APIRoute } from 'astro';

/**
 * robots.txt. The `Sitemap:` line must be an absolute URL and is built from the
 * endpoint context's `site` (the canonical origin from `astro.config.mjs`), so
 * there is one source of truth and the path tracks the renamed sitemap
 * endpoint at `/sitemap.xml`. (SEO-1)
 */
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://indopensource.org');
  const sitemapUrl = new URL('/sitemap.xml', origin).toString();

  return new Response(`User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
