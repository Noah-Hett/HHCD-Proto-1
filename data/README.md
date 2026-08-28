# Shared HHCD report data

`hhcd-reports.csv` is the source catalogue (64 graduate/associate reports).

`packages/data/src/reports.json` is the version React apps import. If you edit the CSV, regenerate JSON:

```bash
python3 scripts/csv-to-json.py
```

Column notes:

- The CSV has one `Methods [options]` column; JSON uses `methodsPrimary`.
- Category values include both `Mobility and Transport` and `Transport`.
