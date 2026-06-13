# Contributing

Thanks for helping improve IndopenSource.org.

## Development

```bash
npm install
npm run sync:projects
npm run dev
```

Before opening a pull request:

```bash
npm run build
```

## Project Directory Data

The Projects page is generated from `src/data/projects.json`.

To refresh it from `IndopenSource/awesome-indonesia`:

```bash
GITHUB_TOKEN=your-token npm run sync:projects
```

Use `GITHUB_TOKEN` or `GH_TOKEN` to avoid low GitHub API rate limits.

## Pull Request Guidelines

- Keep changes focused.
- Prefer Astro components in `src/components` over large page-only markup.
- Keep internal links compatible with GitHub Pages base paths by using `withBase()`.
- Run `npm run build` and include the result in the PR description.
- For content or roadmap changes, link the relevant issue or discussion.
