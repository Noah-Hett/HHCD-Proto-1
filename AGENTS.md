# AGENTS.md

## Cursor Cloud specific instructions

### Repository state

This repository (`hhcd-proto-1`) is a **pnpm workspace** of small Vite + React visualisations over one HHCD report catalogue. There is no single “the app”: GitHub Pages hosts a gallery plus one site per folder in `apps/` (except `_starter`).

### Toolchain

The base image already has Python 3.12, Node 22, npm 10, and pnpm 10. From the repo root:

```bash
pnpm install
pnpm test
pnpm build
```

`pnpm build` writes static files to `dist/` (gallery at the root, other apps in subfolders). Do not invent a different stack when asked to run the project.

### Dataset

- Source CSV: `data/hhcd-reports.csv` (filename used to contain spaces; always quote paths or glob).
- Apps import `packages/data/src/reports.json` via `@hhcd/data`. After CSV edits run `python3 scripts/csv-to-json.py`.
- Fields are quoted and contain embedded commas/newlines, so `wc -l` is **not** the row count. Use a real CSV parser. There are 62 report rows.
- The header has **two columns literally named `Methods [options]`**. `csv.DictReader` keeps only the last one; JSON uses `methodsPrimary` and `methodsSecondary`.
- Category values include both `Mobility and Transport` and a separate `Transport`.

### Apps and hosting

- Add a visualisation with `pnpm new-app <kebab-name>` (updates `apps/manifest.json`).
- Public previews are GitHub Pages, not localhost: `https://noah-hett.github.io/HHCD-Proto-1/` and `/<app-id>/`.
- Pages deploys from `.github/workflows/pages.yml` on push to `main`. Source must be set to GitHub Actions in repo Settings → Pages.

### Environment install

Root `package.json` exists, so the cloud update script should `pnpm install`. If a different stack is added later, revisit that install so new dependencies are actually installed.
