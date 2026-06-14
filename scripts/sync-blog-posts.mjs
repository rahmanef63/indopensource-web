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

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data = {};
  const lines = match[1].split('\n');
  let activeArray = null;

  for (const line of lines) {
    const arrayItem = line.match(/^\s+-\s+(.*)$/);
    if (arrayItem && activeArray) {
      const value = arrayItem[1].trim();
      if (value.includes(':')) {
        const item = {};
        const [key, ...rest] = value.split(':');
        item[key.trim()] = rest.join(':').trim().replace(/^"|"$/g, '');
        data[activeArray].push(item);
      } else {
        data[activeArray].push(value.replace(/^"|"$/g, ''));
      }
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    if (!rawValue) {
      data[key] = [];
      activeArray = key;
      continue;
    }

    activeArray = null;
    data[key] = rawValue.trim().replace(/^"|"$/g, '');
  }

  return { data, content: match[2].trim() };
}

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

function resolveThumbnail(value, articlePath) {
  if (!value || /^https?:\/\//.test(value) || value.startsWith('/')) return value || '';

  const articleDirectory = articlePath.split('/').slice(0, -1).join('/');
  return new URL(value, `https://raw.githubusercontent.com/${BLOG_REPO}/main/${articleDirectory}/`).toString();
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
    releasedAt: latestCommit?.commit?.committer?.date || latestCommit?.commit?.author?.date || ''
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

const tree = await requestJson(`https://api.github.com/repos/${BLOG_REPO}/git/trees/main?recursive=1`);
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

  posts.push({
    slug: slugFromPath(path),
    path,
    year,
    month,
    title: data.title || slugFromPath(path),
    description: data.description || '',
    date: data.date || '',
    tags: data.tags || [],
    status: data.status || 'draft',
    thumbnail: resolveThumbnail(data.thumbnail || data.image || data.cover || '', path),
    content,
    sourceUrl: file.html_url,
    releasedAt: commitMeta.releasedAt,
    author: frontmatterAuthor || commitMeta.author,
    authorFromFrontmatter: Boolean(frontmatterAuthor)
  });
}

posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(posts, null, 2)}\n`);

console.log(`Synced ${posts.length} blog posts to ${OUT_FILE.pathname}`);
