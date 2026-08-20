# HHCD Report Atlas

A small **pnpm workspace** for three people to ship different React visualisations of the same Helen Hamlyn Centre for Design report catalogue — with **public URLs**, not localhost.

After GitHub Pages is switched on (one-time, below), the live hub is:

**https://noah-hett.github.io/HHCD-Proto-1/**

Each visualisation is its own app and its own URL, for example `…/overview/`.

## Why this shape

| Need | Choice |
| --- | --- |
| Three different visualisations, different goals | One repo, one app per folder under `apps/` |
| Same dataset for everyone | Shared `@hhcd/data` package (CSV + JSON) |
| Teammates who cannot run a local server | GitHub Pages builds on every push to `main` |
| Avoid stepping on each other’s work | Edit only your app folder; shared code lives in `packages/` |

Do **not** put three sites in one React app. Independent Vite apps can look completely different, fail independently, and still share data.

```
apps/
  gallery/        Hub page (the GitHub Pages homepage)
  overview/       Shared example visualisation — live at /overview/
  _starter/       Copy this; not published
  your-app/       Added with `pnpm new-app your-app`
packages/
  data/           Typed JSON catalogue imported as `@hhcd/data`
  theme/          Shared paper/ink CSS tokens
data/
  hhcd-reports.csv
```

Name apps after the **question they answer**, not after a person. People move; the visualisation is the unit of work.

## One-time: turn on GitHub Pages

The workflow is already in `.github/workflows/pages.yml`. Someone with repo Settings access needs to do this once:

1. Open [repository Settings → Pages](https://github.com/Noah-Hett/HHCD-Proto-1/settings/pages)
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Merge this setup to `main` (or re-run the **Deploy GitHub Pages** workflow)

Then wait for the green check on `main`. Share the hub URL above. No extra accounts (Vercel, Netlify) required.

## Add a visualisation

```bash
pnpm install
pnpm new-app journey-map
pnpm install
pnpm --filter @hhcd/journey-map dev
```

`new-app` copies `apps/_starter`, sets the package name, and adds a card to `apps/manifest.json` (title, goal, owner, status). Edit that JSON so the hub describes what you are actually making.

Push to `main`. The new site appears at:

`https://noah-hett.github.io/HHCD-Proto-1/journey-map/`

If you cannot run Vite locally, skip the `dev` command: change the files, push, and review the hosted URL.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspace packages |
| `pnpm dev:gallery` | Local hub (only if you *can* use localhost) |
| `pnpm dev:overview` | Local example visualisation |
| `pnpm --filter @hhcd/<app> dev` | Local one app |
| `pnpm new-app <name>` | Scaffold a new app from `_starter` |
| `pnpm test` | Check the JSON catalogue still has 62 reports |
| `pnpm build` | Build every published app into `dist/` |
| `python3 scripts/csv-to-json.py` | Rebuild JSON after CSV edits |

## Data

React apps should import from `@hhcd/data`, not parse the CSV in the browser.

The CSV has **two columns both named `Methods [options]`**. In JSON they are `methodsPrimary` and `methodsSecondary`. Categories include both `Mobility and Transport` and `Transport`.

## Working together

- Keep unrelated experiments in separate app folders.
- Short-lived pull requests are fine; GitHub Actions still **builds** PRs so a broken app is caught before merge. Only `main` is published.
- If two people must change `@hhcd/data` or `@hhcd/theme`, talk first — those packages affect every visualisation.
