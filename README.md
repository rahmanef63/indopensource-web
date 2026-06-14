# IndopenSource.org

[![Deploy to GitHub Pages](https://github.com/IndopenSource/indopensource.org/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/IndopenSource/indopensource.org/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Website roadmap untuk `https://indopensource.org`.

## Tech Stack

- Astro
- Tailwind CSS
- TypeScript
- GitHub Pages
- GitHub Actions

## Pages

- Home: ringkasan roadmap dan arah website.
- Falsafah: prinsip komunitas dan kurasi open source Indonesia.
- Projects: direktori dari `IndopenSource/awesome-indonesia`.
- Blog: placeholder untuk repo khusus `IndopenSource/Blog-IndopenSource`.
- Forum: rencana integrasi `https://github.com/orgs/IndopenSource/discussions`.
- Contact: kanal GitHub organization, projects, dan discussions.

## Development

```bash
npm install
npm run sync:projects
npm run dev
```

## Project Structure

```txt
src/
  components/   Reusable Astro UI components
  data/         Synced project directory data
  layouts/      Shared page layout
  lib/          Small shared helpers
  pages/        Route files
  styles/       Tailwind entrypoint and theme tokens
```

## Checks

```bash
npm run check
npm run build
```

## MVP Pre-release

MVP awal berfokus pada homepage sebagai pintu masuk roadmap IndopenSource:

- Home menjelaskan posisi `indopensource.org`.
- Projects sudah punya data awal dari `awesome-indonesia`.
- Falsafah, Blog, Forum, dan Contact tersedia sebagai halaman roadmap.
- Deployment memakai GitHub Pages bawaan repo lewat GitHub Actions.

Rilis pre-release bisa dibuat dari tag `v0.1.0-mvp` setelah workflow Pages hijau.
URL produksi setelah custom domain aktif adalah `https://indopensource.org/`.

## Deployment

GitHub Pages memakai workflow `.github/workflows/deploy-pages.yml`.

- Build command: `npm run build`
- Output directory: `dist`
- Source: GitHub Actions
- Custom domain: `indopensource.org`
- Pages base path: `/`

Aktifkan Pages di repository settings dengan source `GitHub Actions`, lalu push ke
`main` atau jalankan workflow `Deploy to GitHub Pages` secara manual.

## Project Sync

`npm run sync:projects` membaca `repos.json` dari `IndopenSource/awesome-indonesia`,
lalu mengambil metadata repo dari GitHub API dan menulis hasilnya ke
`src/data/projects.json`.

Gunakan `GITHUB_TOKEN` atau `GH_TOKEN` untuk rate limit yang lebih lega.

## Blog Sync

`npm run sync:blog` membaca artikel Markdown dari
`IndopenSource/Blog-IndopenSource` dan menulis hasilnya ke
`src/data/blog-posts.json`. Tanggal rilis/perubahan diambil dari riwayat commit
artikel. Atribusi penulis memakai field frontmatter `authors`/`author` saat
tersedia, dan baru jatuh ke metadata commit sebagai cadangan bila frontmatter
tidak mencantumkan penulis.

## Auto Sync

Workflow `.github/workflows/sync-content.yml` memperbarui data secara otomatis.

- Manual: jalankan workflow `Sync content data`.
- Schedule: berjalan setiap 6 jam.
- Dispatch dari repo lain:
  - `sync-projects`
  - `sync-blog`
  - `sync-content`

Jika data berubah, workflow membuat commit `Sync content data` dan berhenti di
situ. Workflow sync tidak melakukan deploy sendiri: penerbitan dimiliki
sepenuhnya oleh workflow `Deploy to GitHub Pages` (satu-satunya jalur deploy).
Pada upstream yang masih memakai trigger `push: main`, commit dari sync itulah
yang memicu deploy tersebut, sehingga tidak ada dua deploy yang berjalan
bersamaan.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
