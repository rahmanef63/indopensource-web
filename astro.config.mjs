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
  build: {
    // Never inline the scroll-reveal `<script>` (or any other) into the HTML.
    // A strict `script-src 'self'` CSP (no nonce, no 'unsafe-inline') would block
    // an inline code-bearing <script>; forcing Astro to emit it as an external
    // /_astro/*.js entry referenced via `<script src>` keeps it covered by 'self'.
    // (SEC-02 / MOTION)
    inlineStylesheets: 'never'
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Disable Vite's chunk/asset inlining so the bundled module script is
      // written to a file under dist/_astro instead of being base64/inlined,
      // which is what allows `script-src 'self'` to authorise it.
      assetsInlineLimit: 0
    }
  }
});
