import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Single source of truth for content gating and safe HTML rendering.
 *
 * Markdown is rendered with `marked` and then run through `sanitize-html`
 * using a conservative allowlist. The same allowlist is reused for any
 * untrusted Markdown rendered elsewhere in the site (e.g. project READMEs),
 * so there is exactly one place to audit for HTML-injection safety.
 */

/** Author reference as it can appear in article frontmatter `authors[]`. */
export interface FrontmatterAuthor {
  name: string;
  url?: string;
  avatarUrl?: string;
}

/** Resolved author shown on a rendered article. */
export interface PostAuthor {
  name: string;
  url?: string;
  avatarUrl?: string;
  /** ISO date of the first commit that introduced the article file. */
  committedAt?: string;
}

/** A blog post as stored in `src/data/blog-posts.json`. */
export interface BlogPost {
  slug: string;
  path: string;
  year: string;
  month: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  /** Publication state. Anything other than `"draft"` is considered published. */
  status: string;
  thumbnail: string;
  content: string;
  sourceUrl: string;
  /** Editorial publication date (frontmatter `date`), falling back to commit metadata. */
  releasedAt: string;
  /** ISO timestamp of the most recent edit commit; distinct from `releasedAt`. */
  lastModifiedAt?: string;
  author: PostAuthor;
  /**
   * Whether `author` was taken from frontmatter `authors[]` (true) or
   * derived from git commit metadata (false/undefined). Lets the UI label
   * the author provenance correctly.
   */
  authorFromFrontmatter?: boolean;
}

/**
 * Returns true when a post should be publicly listed/rendered.
 * Posts default to `"draft"`; only a non-draft status is published.
 */
export function isPublished(post: Pick<BlogPost, 'status'>): boolean {
  return post.status !== 'draft';
}

/**
 * Reusable sanitize-html allowlist for untrusted Markdown-derived HTML.
 *
 * Standard article tags are allowed (headings, lists, blockquotes, code,
 * tables, links, images). Active-content tags (`script`, `style`, `iframe`,
 * `object`, `embed`, `form`) are dropped, as are every `on*` event-handler
 * attribute plus `style` and `srcdoc`. Links and images are restricted to
 * http/https/mailto schemes to block `javascript:`/`data:` payloads.
 *
 * Exported so other modules (e.g. project README rendering) can share a
 * single audited configuration instead of redefining their own.
 */
export const articleSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'blockquote',
    'pre',
    'code',
    'span',
    'div',
    'strong',
    'em',
    'b',
    'i',
    'del',
    's',
    'sub',
    'sup',
    'mark',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col'
  ],
  // Explicitly drop active-content tags (defence in depth: they are also
  // absent from allowedTags above).
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    a: ['href', 'name', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'loading', 'width', 'height'],
    th: ['colspan', 'rowspan', 'scope', 'align'],
    td: ['colspan', 'rowspan', 'align'],
    col: ['span'],
    colgroup: ['span'],
    code: ['class'],
    span: ['class'],
    div: ['class']
  },
  // Restrict link/image schemes to safe protocols only; this blocks
  // `javascript:`, `data:`, `vbscript:`, etc.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https']
  },
  allowProtocolRelative: false,
  // Force a safe `rel` on every anchor so a `target="_blank"` link in
  // user-authored Markdown cannot reach `window.opener` (reverse tabnabbing).
  //
  // Demote any `h1` in the body to `h2` (A11Y-6): the page template already
  // renders the single page-level `<h1>` (repo name / article title), so a
  // README or article body that opens with `# Title` would otherwise inject a
  // second `<h1>`, breaking heading order (WCAG 1.3.1). Renaming to `h2` keeps
  // exactly one page-level h1 while preserving the relative heading structure.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    h1: 'h2'
  },
  // Never allow inline styles, event handlers (on*), or iframe srcdoc.
  // `allowedAttributes` already omits `style`/`srcdoc`/`on*`, but we also
  // ensure no vendored defaults reintroduce them.
  allowedStyles: {},
  enforceHtmlBoundary: true
};

/**
 * Tags that are explicitly never allowed, kept as a named export so tests and
 * downstream consumers can assert the security posture without duplicating it.
 */
export const forbiddenTags = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form'
] as const;

/**
 * Render trusted-but-user-authored Markdown into sanitized, safe HTML.
 * Use for blog article bodies and any other Markdown that ends up in
 * `set:html`. Returns an empty string for empty/falsy input.
 */
export function renderArticle(markdown: string): string {
  if (!markdown) return '';
  // marked.parse is synchronous (returns a string) unless async is enabled.
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rawHtml, articleSanitizeOptions);
}
