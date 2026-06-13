import blogPosts from '../data/blog-posts.json';

const pages = [
  '/',
  '/falsafah/',
  '/projects/',
  '/blog/',
  '/forum/',
  '/contact/'
];

const blogPages = blogPosts.map((post) => `/blog/${post.slug}/`);

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .concat(blogPages)
  .map((page) => `  <url>
    <loc>${new URL(page, 'https://indopensource.org').toString()}</loc>
  </url>`)
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}
