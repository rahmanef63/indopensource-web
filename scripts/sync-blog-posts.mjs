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
    content,
    sourceUrl: file.html_url,
    releasedAt: commitMeta.releasedAt,
    author: commitMeta.author
  });
}

posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(posts, null, 2)}\n`);

console.log(`Synced ${posts.length} blog posts to ${OUT_FILE.pathname}`);
