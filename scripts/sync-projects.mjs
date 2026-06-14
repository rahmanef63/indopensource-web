import { mkdir, writeFile } from 'node:fs/promises';

import { renderArticle } from '../src/lib/content.ts';

const AWESOME_REPOS_URL =
  'https://raw.githubusercontent.com/IndopenSource/awesome-indonesia/main/repos.json';
const OUT_FILE = new URL('../src/data/projects.json', import.meta.url);

/**
 * Length budget for `metaDescription` (SEO-6). ~155 chars is the common
 * truncation point for search-result snippets; clamping here keeps generated
 * `<meta name="description">` / Open Graph text from being cut mid-word.
 */
const META_DESCRIPTION_MAX = 155;

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

function parseRepo(fullName) {
  const [owner, name] = fullName.split('/');
  return { owner, name };
}

/**
 * Clamp plain text to a snippet-friendly length on a word boundary (SEO-6).
 * Collapses whitespace, then cuts to `max` chars and trims a dangling partial
 * word so the description never ends mid-token.
 */
function clampMetaDescription(text, max = META_DESCRIPTION_MAX) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;

  const slice = normalized.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s.,;:!?-]+$/, '');
  return `${trimmed}…`;
}

/**
 * Resolve relative `href`/`src` targets in the (already sanitized) README HTML
 * against the repository so links and images work on our own origin. Values
 * that are absolute, anchors, or fail to resolve to http/https are left as-is
 * or dropped. Operates on the sanitized string, so no unsafe scheme can be
 * (re)introduced here.
 */
function absolutizeReadmeHtml(html, linkBase, assetBase) {
  if (!html) return html;

  const resolve = (value, base) => {
    if (!value || value.startsWith('#') || /^(https?:|mailto:)/i.test(value)) return value;
    try {
      const url = new URL(value, base);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : value;
    } catch {
      return value;
    }
  };

  return html
    .replace(/(\shref=")([^"]*)(")/g, (_match, pre, value, post) => `${pre}${resolve(value, linkBase)}${post}`)
    .replace(/(\ssrc=")([^"]*)(")/g, (_match, pre, value, post) => `${pre}${resolve(value, assetBase)}${post}`);
}

/**
 * Fetch and pre-render the repo README to sanitized HTML at build time (PERF-1).
 *
 * Doing this during sync means the detail page ships static, XSS-safe HTML and
 * the browser no longer fetches GitHub or parses Markdown at runtime. Markdown
 * is rendered through the shared `renderArticle()` allowlist so README HTML
 * goes through exactly the same audited sanitiser as blog content.
 */
async function getReadmeHtml(fullName) {
  try {
    const data = await requestJson(`https://api.github.com/repos/${fullName}/readme`);
    if (!data?.content) return '';

    const markdown = Buffer.from(data.content, 'base64').toString('utf8');
    const html = renderArticle(markdown);
    // `html_url` is the rendered-file URL (base for relative links); the raw
    // `download_url` is the base for relative asset (image) paths.
    return absolutizeReadmeHtml(html, data.html_url || '', data.download_url || '');
  } catch (error) {
    if (error.message.startsWith('RATE_LIMITED:')) {
      throw error;
    }

    console.warn(`No README for ${fullName}: ${error.message}`);
    return '';
  }
}

function fallbackProject(fullName) {
  const { owner, name } = parseRepo(fullName);
  const description = 'Proyek dari daftar awesome-indonesia.';
  return {
    fullName,
    name,
    owner,
    ownerAvatarUrl: '',
    description,
    metaDescription: clampMetaDescription(description),
    url: `https://github.com/${fullName}`,
    homepage: '',
    language: '',
    stars: 0,
    forks: 0,
    topics: [],
    updatedAt: '',
    pushedAt: '',
    latestRelease: null,
    archived: false,
    readmeHtml: ''
  };
}

async function getLatestRelease(fullName) {
  try {
    const release = await requestJson(`https://api.github.com/repos/${fullName}/releases/latest`);
    return {
      name: release.name || release.tag_name,
      tagName: release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at
    };
  } catch (error) {
    if (error.message.startsWith('RATE_LIMITED:')) {
      throw error;
    }

    return null;
  }
}

async function getRepo(fullName) {
  try {
    const repo = await requestJson(`https://api.github.com/repos/${fullName}`);
    const latestRelease = await getLatestRelease(fullName);
    const readmeHtml = await getReadmeHtml(fullName);
    const description = repo.description || 'Proyek dari daftar awesome-indonesia.';

    return {
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login,
      ownerAvatarUrl: repo.owner?.avatar_url || '',
      description,
      metaDescription: clampMetaDescription(description),
      url: repo.html_url,
      homepage: repo.homepage || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      topics: repo.topics || [],
      updatedAt: repo.updated_at || '',
      pushedAt: repo.pushed_at || '',
      latestRelease,
      archived: Boolean(repo.archived),
      readmeHtml
    };
  } catch (error) {
    if (error.message.startsWith('RATE_LIMITED:')) {
      throw error;
    }

    console.warn(`Using fallback for ${fullName}: ${error.message}`);
    return fallbackProject(fullName);
  }
}

const repoNames = await requestJson(AWESOME_REPOS_URL);
const projects = [];

for (const fullName of repoNames) {
  projects.push(await getRepo(fullName));
}

projects.sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName));

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(projects, null, 2)}\n`);

console.log(`Synced ${projects.length} projects to ${OUT_FILE.pathname}`);
