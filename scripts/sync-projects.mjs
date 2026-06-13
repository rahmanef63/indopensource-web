import { mkdir, writeFile } from 'node:fs/promises';

const AWESOME_REPOS_URL =
  'https://raw.githubusercontent.com/IndopenSource/awesome-indonesia/main/repos.json';
const OUT_FILE = new URL('../src/data/projects.json', import.meta.url);

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

function fallbackProject(fullName) {
  const { owner, name } = parseRepo(fullName);
  return {
    fullName,
    name,
    owner,
    ownerAvatarUrl: '',
    description: 'Proyek dari daftar awesome-indonesia.',
    url: `https://github.com/${fullName}`,
    homepage: '',
    language: '',
    stars: 0,
    forks: 0,
    topics: [],
    updatedAt: '',
    pushedAt: '',
    latestRelease: null,
    archived: false
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

    return {
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login,
      ownerAvatarUrl: repo.owner?.avatar_url || '',
      description: repo.description || 'Proyek dari daftar awesome-indonesia.',
      url: repo.html_url,
      homepage: repo.homepage || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      topics: repo.topics || [],
      updatedAt: repo.updated_at || '',
      pushedAt: repo.pushed_at || '',
      latestRelease,
      archived: Boolean(repo.archived)
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
