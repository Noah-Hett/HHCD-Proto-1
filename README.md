# HHCD visualisation workspace

A **pnpm workspace** of independent Vite + React pages over the Helen Hamlyn Centre for Design graduate/associate report catalogue (62 reports). One Vercel project hosts the hub plus every visualisation. Pull requests get a preview URL automatically.

## Shape

The hub is `apps/gallery` (`/`). Every other visualisation is **its own React app** in `apps/<id>/`, live at `/<id>/`. That is the point: one page can be Three.js, another D3, another plain SVG. They share a dataset, not a runtime.

```
apps/
  gallery/        Hub (Vercel homepage)
  overview/       Example visualisation — /overview/
  _starter/       Template; not published
  your-app/       Added with `pnpm new-app your-app`
packages/
  data/           JSON catalogue imported as `@hhcd/data`
  theme/          Optional shared CSS tokens
  shell/          Optional page chrome (`<Shell fill>` for full-bleed)
data/
  hhcd-reports.csv
```

Name apps after the **question they answer**, not after a person.

## Add a visualisation (or ask an agent)

From the repo root:

```bash
pnpm install
pnpm new-app journey-map
pnpm install
pnpm --filter @hhcd/journey-map dev
```

`new-app` copies `apps/_starter` and adds a row to `apps/manifest.json`. Optional flags: `--title`, `--goal`, `--owner`. Both `pnpm new-app journey-map --title "..."` and `pnpm new-app -- journey-map --title "..."` work.

If you cannot run Vite locally, skip `dev`: change the files, open a pull request, and use the Vercel preview.

Teammates using a Cursor cloud agent can paste:

```
Add a new visualisation page to this HHCD platform.

What I want: <describe the view, interactions, and question it answers>

Follow AGENTS.md: run pnpm new-app with a kebab-case id, implement only in that app folder, update apps/manifest.json, add any libraries (d3, three, etc.) to that app only, then open a PR.
```

Longer notes: `docs/add-a-visualisation.md`.

## One-time: connect Vercel

Someone with access to this GitHub repo does this once. Teammates do **not** need Vercel accounts to open preview links.

1. Import `Noah-Hett/HHCD-Proto-1` at [vercel.com/new](https://vercel.com/new)
2. Root Directory: repo root (`.`)
3. Leave build settings — `vercel.json` already sets install `pnpm install --frozen-lockfile`, build `pnpm build`, output `dist`
4. Deploy

Production is `https://<project>.vercel.app/` plus `/<app-id>/`. Each pull request gets a preview URL. If the wizard treats this as a single Vite app, set the framework to **Other**.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspace packages |
| `pnpm new-app <id>` | Scaffold a new app from `_starter` |
| `pnpm --filter @hhcd/<id> dev` | Local one app |
| `pnpm --filter @hhcd/<id> add <pkg>` | Add a library to one app only |
| `pnpm test` | Check the JSON catalogue still has 62 reports |
| `pnpm build` | Build every published app into `dist/` |
| `python3 scripts/csv-to-json.py` | Rebuild JSON after CSV edits |

## Data

Import from `@hhcd/data`, not the CSV in the browser. The CSV has **two columns both named `Methods [options]`**; JSON uses `methodsPrimary` and `methodsSecondary`. Categories include both `Mobility and Transport` and `Transport`.

## Working together

- Edit only your app folder. Shared code lives in `packages/`.
- Open a pull request per visualisation. Vercel builds a preview; GitHub Actions runs `pnpm test` and `pnpm build`.
- If two people must change `@hhcd/data`, `@hhcd/theme`, or `@hhcd/shell`, talk first.
