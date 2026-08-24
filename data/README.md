# Shared HHCD report data

`hhcd-reports.csv` is the source catalogue (~62 graduate/associate reports) used by `@hhcd/data`.

`packages/data/src/reports.json` is the version most React apps import. If you edit `hhcd-reports.csv`, regenerate JSON:

```bash
python3 scripts/csv-to-json.py
```

`reports.csv` is a 15-column catalogue with a single `Methods [options]` column. The year × project type scatter (`apps/year-type-scatter`) reads this file directly.

Column notes:

- Two CSV columns in `hhcd-reports.csv` are both named `Methods [options]`. They become `methodsPrimary` and `methodsSecondary` in JSON.
- Category values include both `Mobility and Transport` and `Transport`.
