---
name: add-visualisation
description: Use when the user wants a new chart, page, visualisation, Three.js, D3, or other view of the HHCD reports. Scaffold a Vite app under apps/ and implement it; do not restyle gallery or overview.
---

# Add a visualisation page

Treat the request as **create a new published page**. Do not modify gallery, overview, theme tokens, or other apps unless the user explicitly says so.

Each page is a **full Vite + React app** in `apps/<id>/` (own `package.json`, `index.html`, `src/`, `vite.config.js`). Shared: `@hhcd/data` (62 reports). Optional: `@hhcd/theme` tokens and `@hhcd/shell` chrome (`<Shell fill>` for full-bleed WebGL). No React Router, no iframe, no shared runtime. Add libs to that app only. Three.js on one page and D3 on another is expected. Static hosting only; keep `base: "./"`. Gallery is the hub. `_starter` stays unpublished.

## Steps

1. Derive a kebab-case id (`methods-network`, `year-timeline`) matching `^[a-z][a-z0-9-]*$`.
2. From repo root: `pnpm install` then `pnpm new-app <id>` then `pnpm install` again. If known: `pnpm new-app -- <id> --title "..." --goal "..." --owner "..."`.
3. Set `apps/manifest.json` for that id: human title, one-sentence goal, owner (user’s name if known, else `claim this`), status `draft`.
4. Implement only in `apps/<id>/`. Replace the starter placeholder in `src/App.jsx`. Import from `@hhcd/data`.
5. Add libraries to **that app only**, e.g. `pnpm --filter @hhcd/<id> add d3` or `three` (optionally `@react-three/fiber @react-three/drei`). Same pattern for Observable Plot, Recharts, MapLibre. Full-bleed WebGL: `<Shell fill>`. Do not add heavy libs at the repo root.
6. Do not edit other visualisation apps, `_starter` (unless asked to improve the template), or `packages/data` unless the CSV/schema must change. Gallery auto-picks up the manifest.
7. `pnpm test` and `pnpm build`. Fix failures.
8. Commit, push, open a PR. Live path is `/<id>/`. Vercel preview is the shareable link.

## Dataset gotchas

- 62 reports via `@hhcd/data`. CSV is `data/hhcd-reports.csv`; regenerate JSON with `python3 scripts/csv-to-json.py`.
- Duplicate CSV columns named `Methods [options]` → JSON `methodsPrimary` / `methodsSecondary`. Do not use `csv.DictReader` on the raw CSV.
- Categories include both `Mobility and Transport` and `Transport`.
