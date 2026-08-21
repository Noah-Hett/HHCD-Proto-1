# AGENTS.md

## When the user describes a visualisation they want

Treat that message as a request to **create a new published page**, not to modify gallery/overview unless they explicitly say so.

Each visualisation is a **full, independent Vite + React app** in `apps/<id>/` with its own `package.json`, `index.html`, `src/`, and `vite.config.js`. `scripts/build-site.mjs` compiles them into one static site (`dist/` + `dist/<id>/`) hosted on one Vercel project. Shared pieces: `@hhcd/data` (the 62-report JSON catalogue), optional `@hhcd/theme` tokens, and optional `@hhcd/shell` page chrome (`<Shell fill>` for full-bleed WebGL). There is no React Router, no shared runtime, and no iframe. Failure in one app does not take down others at runtime; `pnpm build` still builds every published app.

How close to an individual React app? It *is* one that lives in this monorepo and shares a dataset. Add any npm library to that app only. How detailed? As detailed as a static Vite SPA. Three.js / R3F on one page and D3 on another is expected. Limits: static hosting (no server/API unless you add one — there is none today), relative `base: "./"`, do not edit other apps, keep `apps/gallery` as the hub, keep `_starter` unpublished.

1. Derive a short kebab-case id from the idea (`methods-network`, `year-timeline`). Must match `^[a-z][a-z0-9-]*$`.
2. From repo root: `pnpm install` then `pnpm new-app <id>` then `pnpm install` again (workspace protocol). If title/goal/owner are known: `pnpm new-app -- <id> --title "..." --goal "..." --owner "..."`.
3. Update `apps/manifest.json` for that id: human title, one-sentence goal, owner (user’s name if known, else “claim this”), status `draft`.
4. Implement only in `apps/<id>/`. Replace the starter placeholder. Import data from `@hhcd/data`. Add libraries to **that app’s** package.json only.
5. Do not edit other visualisation apps, `_starter` (except if improving the template itself was requested), `packages/data` unless the CSV/schema must change, or gallery except it auto-picks up the manifest.
6. `pnpm test` and `pnpm build`. Fix failures.
7. Commit, push, open a PR. Production URL will be `/<id>/`. Vercel preview is the shareable link.

### Choosing a stack

- Default: React + SVG/HTML/CSS in the starter
- D3: `pnpm --filter @hhcd/<id> add d3`
- Three.js: `pnpm --filter @hhcd/<id> add three` and optionally `@react-three/fiber @react-three/drei`
- Observable Plot, Recharts, MapLibre, etc. same pattern (`pnpm --filter @hhcd/<id> add <pkg>`)
- Use full-bleed canvas (`<Shell fill>`) for WebGL
- Do not add heavy libs to the repo root

### Prompt teammates can paste

```
Add a new visualisation page to this HHCD platform.

What I want: <describe the view, interactions, and question it answers>

Follow AGENTS.md: run pnpm new-app with a kebab-case id, implement only in that app folder, update apps/manifest.json, add any libraries (d3, three, etc.) to that app only, then open a PR.
```

## Dataset

- Source CSV: `data/hhcd-reports.csv` (the filename used to contain spaces; always quote paths or glob).
- Apps import `packages/data/src/reports.json` via `@hhcd/data`. After CSV edits run `python3 scripts/csv-to-json.py`.
- Fields are quoted and contain embedded commas/newlines, so `wc -l` is **not** the row count. Use a real CSV parser. There are 62 report rows.
- The CSV has one `Methods [options]` column; JSON uses `methodsPrimary`.
- Category values include both `Mobility and Transport` and a separate `Transport`.

## Toolchain

The base image already has Python 3.12, Node 22, npm 10, and pnpm 10. From the repo root:

```bash
pnpm install
pnpm test
pnpm build
```

`pnpm build` writes static files to `dist/` (gallery at `/`, other apps at `/<id>/`). `vercel.json` points Vercel at that output. Do not invent a different stack when asked to run the project.

Public previews are Vercel, not localhost or GitHub Pages. Production is `https://<project>.vercel.app/` plus `/<app-id>/`. Each pull request gets its own preview URL. `.github/workflows/ci.yml` runs `pnpm test` and `pnpm build` only. Deploy is Vercel’s Git integration via `vercel.json`.

Root `package.json` exists, so the cloud update script should `pnpm install`. If a different stack is added later, revisit that install so new dependencies are actually installed.
