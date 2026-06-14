import { mkdir, writeFile } from 'node:fs/promises';

const BLOG_REPO = 'IndopenSource/Blog-IndopenSource';
const OUT_FILE = new URL('../src/data/blog-posts.json', import.meta.url);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error(`RATE_LIMITED: GitHub API rate limit exhausted for ${url}`);
    }

    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.json();
}

/**
 * Strip a scalar value: handle single- OR double-quoted strings (only when the
 * quotes are balanced) and an unquoted inline `# comment`. Returns the cleaned
 * string. Values stay strings on purpose — numbers/booleans are NOT coerced, so
 * `featured: true` and `order: 3` survive as "true"/"3" without surprising a
 * downstream consumer that expects a string. The caller owns any type coercion.
 */
function unquoteScalar(rawValue) {
  let value = rawValue.trim();

  // Balanced single or double quotes: take the inner text verbatim (an inner
  // `#` is part of the quoted string, never a comment). Unbalanced quotes are
  // left untouched so we never mangle e.g. a lone `"value`.
  const quoted = value.match(/^(["'])([\s\S]*)\1$/);
  if (quoted) return quoted[2];

  // Unquoted value: a `#` at the start, or preceded by whitespace, begins a
  // comment and is dropped (YAML semantics). A `#` glued mid-token (e.g.
  // `red#5`) is kept. Note: a value that is meant to start with `#` (a hex
  // color, a `#tag`) MUST be quoted — unquoted `key: #fff` is an empty value.
  const comment = value.search(/(^|\s)#/);
  if (comment !== -1) value = value.slice(0, comment);

  return value.trim();
}

/**
 * Minimal, dependency-free frontmatter parser for the documented subset.
 *
 * Supported:
 *  - CRLF or LF line endings (input is normalized to LF before matching).
 *  - A frontmatter-only file with no body and no trailing newline after the
 *    closing `---` (the body group is optional).
 *  - `key: value` scalars; values may be single- or double-quoted.
 *  - Inline `# comments` after an unquoted value, and whole-line `# comments`.
 *  - Leading/trailing whitespace around keys and values.
 *  - Block sequences (`key:` then `  - item`), where items are plain scalars or
 *    a single inline `name: value` object (used by `authors[]`).
 *  - Duplicate keys: last value wins (a warning is emitted so it is not silent).
 *
 * NOT supported (out of scope, kept dependency-free): nested mappings beyond the
 * one-line `- key: value` form, flow collections (`[a, b]`/`{a: b}`), folded or
 * literal block scalars (`>`/`|`), and anchors/aliases. Values are never coerced
 * to numbers/booleans — every scalar is returned as a string.
 */
function parseFrontmatter(raw) {
  // Normalize CRLF -> LF first so the closing-delimiter boundary always matches
  // on Windows-authored / GitHub-web-edited files. The closing `---` may sit at
  // EOF, so the body group is optional.
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/);
  if (!match) return { data: {}, content: raw };

  const data = {};
  const lines = match[1].split('\n');
  let activeArray = null;

  for (const line of lines) {
    // Whole-line comment or blank line: ignore (does not close an active array).
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;

    const arrayItem = line.match(/^\s+-\s+(.*)$/);
    if (arrayItem && activeArray) {
      const value = arrayItem[1].trim();
      if (value.includes(':')) {
        const item = {};
        const [key, ...rest] = value.split(':');
        item[key.trim()] = unquoteScalar(rest.join(':'));
        data[activeArray].push(item);
      } else {
        data[activeArray].push(unquoteScalar(value));
      }
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;

    const [, key, rawValue] = pair;

    // Surface duplicate keys instead of silently corrupting (last-wins).
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      console.warn(`Duplicate frontmatter key "${key}" — keeping the last value.`);
    }

    if (!rawValue.trim()) {
      data[key] = [];
      activeArray = key;
      continue;
    }

    activeArray = null;
    data[key] = unquoteScalar(rawValue);
  }

  return { data, content: (match[2] || '').trim() };
}

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

// Resolve the blog repo's actual default branch once (CC-6). A literal "main"
// silently rots every relative thumbnail/source link after a default-branch
// rename, so we read repos/{repo}.default_branch and cache it for the run,
// falling back to "main" only when the lookup fails.
let defaultBranchPromise = null;
function getDefaultBranch() {
  if (!defaultBranchPromise) {
    defaultBranchPromise = requestJson(`https://api.github.com/repos/${BLOG_REPO}`)
      .then((repo) => repo.default_branch || 'main')
      .catch((error) => {
        console.warn(`Could not resolve default branch for ${BLOG_REPO}; falling back to "main". ${error.message}`);
        return 'main';
      });
  }

  return defaultBranchPromise;
}

function resolveThumbnail(value, articlePath, branch) {
  if (!value || /^https?:\/\//.test(value) || value.startsWith('/')) return value || '';

  const articleDirectory = articlePath.split('/').slice(0, -1).join('/');
  return new URL(value, `https://raw.githubusercontent.com/${BLOG_REPO}/${branch}/${articleDirectory}/`).toString();
}

async function getCommitMeta(path) {
  const commits = await requestJson(`https://api.github.com/repos/${BLOG_REPO}/commits?path=${encodeURIComponent(path)}&per_page=100`);
  const firstCommit = commits.at(-1);
  const latestCommit = commits.at(0);
  const author = firstCommit?.author;

  return {
    author: {
      name: author?.login || firstCommit?.commit?.author?.name || 'IndopenSource Maintainers',
      avatarUrl: author?.avatar_url || '',
      url: author?.html_url || firstCommit?.html_url || `https://github.com/${BLOG_REPO}`,
      committedAt: firstCommit?.commit?.author?.date || ''
    },
    // The latest commit timestamp is the date of the most recent EDIT, not a
    // publication/release event (CC-9). Name it honestly as "last modified" so
    // the rendered label can stop calling an edit timestamp a release date.
    lastModifiedAt: latestCommit?.commit?.committer?.date || latestCommit?.commit?.author?.date || ''
  };
}

/**
 * Prefer the author declared in frontmatter `authors[]` over git committer
 * metadata (CQ-6). Items may be plain strings (the author name) or objects
 * like `{ name, url, avatarUrl }`. Returns `null` when no usable frontmatter
 * author is present, so callers fall back to commit metadata.
 */
function authorFromFrontmatter(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return null;

  const first = authors[0];
  if (typeof first === 'string') {
    const name = first.trim();
    return name ? { name, avatarUrl: '', url: '', committedAt: '' } : null;
  }

  if (first && typeof first === 'object') {
    const name = (first.name || '').trim();
    if (!name) return null;
    return {
      name,
      avatarUrl: (first.avatarUrl || first.avatar || '').trim(),
      url: (first.url || '').trim(),
      committedAt: ''
    };
  }

  return null;
}

const defaultBranch = await getDefaultBranch();

const tree = await requestJson(`https://api.github.com/repos/${BLOG_REPO}/git/trees/${defaultBranch}?recursive=1`);
const articleFiles = tree.tree
  .filter((item) => item.type === 'blob' && /^content\/\d{4}\/\d{2}\/.+\.md$/.test(item.path))
  .map((item) => item.path);

const posts = [];

for (const path of articleFiles) {
  const file = await requestJson(`https://api.github.com/repos/${BLOG_REPO}/contents/${path}`);
  const raw = Buffer.from(file.content, 'base64').toString('utf8');
  const { data, content } = parseFrontmatter(raw);
  const [year, month] = path.split('/').slice(1, 3);
  const commitMeta = await getCommitMeta(path);
  const frontmatterAuthor = authorFromFrontmatter(data.authors);
  const editorialDate = (data.date || '').trim();

  posts.push({
    slug: slugFromPath(path),
    path,
    year,
    month,
    title: data.title || slugFromPath(path),
    description: data.description || '',
    date: editorialDate,
    tags: data.tags || [],
    status: data.status || 'draft',
    thumbnail: resolveThumbnail(data.thumbnail || data.image || data.cover || '', path, defaultBranch),
    content,
    sourceUrl: file.html_url,
    // The visible "release" date is the editorial frontmatter `date` (the date
    // the author intended), falling back to the first commit only when absent.
    // It never moves on a typo fix. `lastModifiedAt` carries the most-recent
    // edit timestamp separately for provenance (CC-9).
    releasedAt: editorialDate || commitMeta.author.committedAt || commitMeta.lastModifiedAt,
    lastModifiedAt: commitMeta.lastModifiedAt,
    author: frontmatterAuthor || commitMeta.author,
    authorFromFrontmatter: Boolean(frontmatterAuthor)
  });
}

// Deterministic, stable ordering (CC-4): newest editorial date first, with
// undated/unparseable-date posts pushed to the end, and a stable slug
// tiebreaker so the featured pick (blogPosts.filter(isPublished)[0] on the
// page) never flips between runs.
function dateMillis(value) {
  const trimmed = (value || '').trim();
  // Only trust strict ISO 8601 dates (`YYYY-MM-DD`, optionally with a time) so
  // ordering is deterministic across machines/locales. `Date.parse` is lenient
  // and locale-dependent (e.g. it silently accepts "14 Juni 2026"), which would
  // reintroduce the nondeterministic ordering CC-4 is about. Anything that is
  // not strict ISO is treated as "no usable date" and pushed to the end.
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    if (trimmed) console.warn(`Non-ISO blog date "${value}" — sorting this post last (use YYYY-MM-DD).`);
    return null;
  }
  const time = Date.parse(trimmed);
  if (Number.isNaN(time)) {
    console.warn(`Invalid blog date "${value}" — sorting this post last.`);
    return null;
  }
  return time;
}

posts.sort((a, b) => {
  const aTime = dateMillis(a.date);
  const bTime = dateMillis(b.date);

  // Posts without a usable date always sort after dated posts.
  if (aTime === null && bTime !== null) return 1;
  if (aTime !== null && bTime === null) return -1;

  // Both dated: newest first. Both undated: fall through to the tiebreaker.
  if (aTime !== null && bTime !== null && aTime !== bTime) return bTime - aTime;

  // Equal dates (or both undated): deterministic slug tiebreaker (ascending).
  return a.slug.localeCompare(b.slug);
});

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(posts, null, 2)}\n`);

console.log(`Synced ${posts.length} blog posts to ${OUT_FILE.pathname}`);
