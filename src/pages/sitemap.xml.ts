import type { APIRoute } from 'astro';
import blogPosts from '../data/blog-posts.json';
import projects from '../data/projects.json';
import { projectSlug } from '../lib/projects';
import { isPublished } from '../lib/content';

/**
 * Hand-rolled sitemap at the conventional `/sitemap.xml` path.
 *
 * - Origin comes from the endpoint context's `site` (mirrors
 *   `astro.config.mjs` `site`) instead of a hard-coded string, so the file has
 *   a single source of truth for the canonical origin. (SEO-3, CQ-12)
 * - Draft blog posts are excluded via the shared `isPublished` gate so unlisted
 *   content never leaks into the sitemap. (SEO-1)
 * - Each URL carries a `<lastmod>` where a meaningful date exists, helping
 *   crawlers prioritise re-crawls. (SEO-3)
 */

interface SitemapEntry {
  /** Path beginning with `/` and ending with `/` (matches trailingSlash). */
  path: string;
  /** ISO date string for `<lastmod>`, when known. */
  lastmod?: string;
}

/** Normalise a date-ish value to a `YYYY-MM-DD` lastmod, or undefined. */
function toLastmod(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

const staticPages: SitemapEntry[] = [
  { path: '/' },
  { path: '/falsafah/' },
  { path: '/projects/' },
  { path: '/blog/' },
  { path: '/forum/' },
  { path: '/contact/' }
];

const blogPages: SitemapEntry[] = blogPosts
  .filter((post) => isPublished(post))
  .map((post) => ({
    path: `/blog/${post.slug}/`,
    lastmod: toLastmod(post.releasedAt) ?? toLastmod(post.date)
  }));

const projectPages: SitemapEntry[] = projects.map((project) => ({
  path: `/projects/${projectSlug(project.fullName)}/`,
  lastmod: toLastmod(project.pushedAt) ?? toLastmod(project.updatedAt)
}));

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://indopensource.org');
  const entries = staticPages.concat(blogPages, projectPages);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    const loc = new URL(entry.path, origin).toString();
    const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
    return `  <url>
    <loc>${loc}</loc>${lastmod}
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
