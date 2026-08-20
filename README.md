# HHCD Report Atlas

A small **pnpm workspace** for three people to ship different React visualisations of the same Helen Hamlyn Centre for Design report catalogue — with **public Vercel URLs**, not localhost.

One Vercel project hosts the hub plus every visualisation. Pull requests get their own preview URL automatically, so people who cannot run a local server can still open the work in a browser.

## Why this shape

| Need | Choice |
| --- | --- |
| Three different visualisations, different goals | One repo, one app per folder under `apps/` |
| Same dataset for everyone | Shared `@hhcd/data` package (CSV + JSON) |
| Teammates who cannot run a local server | Vercel production + PR preview URLs |
| Avoid stepping on each other’s work | Edit only your app folder; shared code lives in `packages/` |

Do **not** put three sites in one React app. Independent Vite apps can look completely different, fail independently, and still share data.

```
apps/
  gallery/        Hub page (the Vercel homepage)
  overview/       Shared example visualisation — live at /overview/
  _starter/       Copy this; not published
  your-app/       Added with `pnpm new-app your-app`
packages/
  data/           JSON catalogue imported as `@hhcd/data`
  theme/          Shared paper/ink CSS tokens
data/
  hhcd-reports.csv
```

Name apps after the **question they answer**, not after a person. People move; the visualisation is the unit of work.

## One-time: connect Vercel

Someone with access to this GitHub repo does this once. Teammates do **not** need Vercel accounts to *open* preview links.

1. Go to [vercel.com/new](https://vercel.com/new) and import `Noah-Hett/HHCD-Proto-1`
2. Keep **Root Directory** as the repo root (`.`)
3. Leave build settings alone — `vercel.json` already sets:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm build`
   - Output: `dist`
4. Deploy

After that:

- **Production** (`main`): `https://<project-name>.vercel.app/` and `/overview/`
- **Every pull request**: Vercel comments a unique preview URL on the PR

If the import wizard tries to treat this as a single Vite app, switch the framework to **Other** and keep the commands above. This repo is a workspace that builds several apps into one `dist/` folder.

## Add a visualisation

```bash
pnpm install
pnpm new-app journey-map
pnpm install
pnpm --filter @hhcd/journey-map dev
```

`new-app` copies `apps/_starter`, sets the package name, and adds a card to `apps/manifest.json` (title, goal, owner, status). Edit that JSON so the hub describes what you are actually making.

If you cannot run Vite locally, skip `dev`: change the files, open a pull request, and use the Vercel preview link.

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
- Open a pull request for each visualisation change. Vercel builds a preview; GitHub Actions also runs `pnpm test` and `pnpm build`.
- If two people must change `@hhcd/data` or `@hhcd/theme`, talk first — those packages affect every visualisation.
