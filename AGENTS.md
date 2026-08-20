# AGENTS.md

## Cursor Cloud specific instructions

### Repository state

This repository (`hhcd-proto-1`) is currently a **data-only prototype seed**. There is no application code, package manifest, build system, lint config, or automated tests yet. The entire tracked content is a single dataset:

- `Cleaned HHCD Grad Associate Reports Data - Cleaned HHCD Grad Associate Reports Data.csv` — a catalog of ~60 Helen Hamlyn Centre for Design (HHCD) graduate/associate research reports.

Because there is no product yet, there is nothing to lint, build, run, or unit-test. Do not fabricate an application when asked to "run the app"; instead, confirm scope with the actual task.

### Toolchain available (no install needed)

The base image already provides everything needed to work with the data: Python 3.12, Node 22, npm 10, and pnpm 10. There are no declared dependencies, so the startup update script is a no-op until a manifest is added.

### Working with the dataset

- The CSV filename contains spaces — always quote it or glob it (e.g. `glob.glob("/workspace/*.csv")`).
- Fields are quoted and contain embedded commas/newlines, so line count (`wc -l`) is **not** the row count. Use a real CSV parser (Python `csv`, pandas, etc.). There are ~60 report rows.
- Gotcha: the header has **two columns literally named `Methods [options]`** (duplicate). `csv.DictReader` will silently keep only the last one; use `csv.reader` and index by position if you need both.
- Category values include both `Mobility and Transport` and a separate `Transport`, and column names carry type hints in brackets (e.g. `Title [text]`, `Website / Links to videos [link]`).

### If/when a product is scaffolded

The update script (`SetupVmEnvironment`) installs Node dependencies only if a `package.json` appears, and is otherwise a no-op. If a different stack is added (e.g. a Python data app), revisit the environment setup so the update script installs the new dependencies.
