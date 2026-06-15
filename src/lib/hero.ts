import type { ImageMetadata } from 'astro';
import heroSource from '../assets/brand/indopensource-hero.jpg';

/**
 * Single source of truth for the homepage hero (the LCP image).
 *
 * `HomeHero.astro` renders an optimised `<Image>` from this, and `index.astro`
 * runs `getImage()` over the SAME source + transform parameters to emit a
 * high-priority `<link rel="preload" as="image">` in `<head>`. Keeping both
 * paths pointed at this module guarantees the preloaded AVIF is byte-identical
 * to one of the `<Image>`'s `srcset` candidates, so the browser reuses the
 * preloaded download for the actual LCP paint instead of fetching twice.
 */
export const heroImage: ImageMetadata = heroSource;

/**
 * Largest emitted width — the `<Picture>` `widths` top stop and the preload
 * size. Set to the source's intrinsic width (1536px) so astro:assets never
 * upscales and so the preload transform clamps to the SAME dimensions as the
 * top `srcset` candidate, letting the browser reuse one download for the LCP.
 */
export const HERO_PRELOAD_WIDTH = 1536;

/** Compression quality shared by the `<Image>` and the preload transform. */
export const HERO_QUALITY = 60;
