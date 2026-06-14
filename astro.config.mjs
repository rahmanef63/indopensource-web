import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Canonical production origin. Must stay the upstream domain so generated
  // canonical URLs, the sitemap, robots.txt, and Open Graph tags all point at
  // the real site regardless of where a fork is hosted.
  site: 'https://indopensource.org',
  base: process.env.ASTRO_BASE || '/',
  // Emit a single, consistent URL shape for every route. Without this, Astro's
  // default ('ignore') lets both `/blog` and `/blog/` resolve, which splits
  // canonical signals and PageRank across two URLs. Forcing trailing slashes
  // matches the directory-style output of the static build and the URLs the
  // sitemap advertises, avoiding duplicate-content and 301 hops. (SEO-5)
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  }
});
