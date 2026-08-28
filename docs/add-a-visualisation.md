# Add a visualisation

This is the human copy of the agent playbook in `AGENTS.md`. Each visualisation is a **full Vite + React app** in `apps/<id>/`, compiled into one static Vercel site. There is no React Router and no iframe. Pages can look completely different — Three.js on one, D3 on another — because they do not share a runtime, only `@hhcd/data` (and optional theme/shell packages).

## Scaffold

From the repo root:

```bash
pnpm install
pnpm new-app methods-network
pnpm install
```

Optional metadata:

```bash
pnpm new-app methods-network --title "Methods network" --goal "See which research methods cluster together across the 64 reports." --owner "Ada"
# equivalent:
pnpm new-app -- methods-network --title "Methods network" --goal "..." --owner "Ada"
```

That copies `apps/_starter` → `apps/methods-network`, sets the package name to `@hhcd/methods-network`, and adds a `draft` row in `apps/manifest.json`. Gallery reads the manifest and links to `/methods-network/`. `_starter` itself is never published.

Then implement in `apps/<id>/src/App.jsx` (and whatever else that app needs). Import reports from `@hhcd/data`. Do not edit other apps.

## Choosing a stack

Default is React plus SVG/HTML/CSS. Add libraries to **that app only**:

```bash
pnpm --filter @hhcd/methods-network add d3
pnpm --filter @hhcd/globe add three @react-three/fiber @react-three/drei
```

Same pattern for Observable Plot, Recharts, MapLibre, and so on. Full-bleed WebGL: wrap the canvas in `<Shell fill>` from `@hhcd/shell`. Do not put heavy libraries on the repo root.

Limits: static hosting (no API in this repo today), `base: "./"` in `vite.config.js`, keep gallery as the hub, leave `_starter` unpublished.

## Ship it

```bash
pnpm test
pnpm build
```

Open a pull request. Vercel posts a preview URL. On production the page is `/<id>/`.

## Dataset gotchas

- 64 reports. CSV path: `data/hhcd-reports.csv`. After CSV edits: `python3 scripts/csv-to-json.py`.
- The CSV has one `Methods [options]` column; JSON uses `methodsPrimary`.
- Categories include both `Mobility and Transport` and `Transport`.

## Prompt for a Cursor cloud agent

```
Add a new visualisation page to this HHCD platform.

What I want: <describe the view, interactions, and question it answers>

Follow AGENTS.md: run pnpm new-app with a kebab-case id, implement only in that app folder, update apps/manifest.json, add any libraries (d3, three, etc.) to that app only, then open a PR.
```
