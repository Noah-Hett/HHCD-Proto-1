# Shared HHCD report data

`hhcd-reports.csv` is the source catalogue (~62 graduate/associate reports).

`packages/data/src/reports.json` is the version React apps import. If you edit the CSV, regenerate JSON:

```bash
python3 scripts/csv-to-json.py
```

Column notes:

- Two CSV columns are both named `Methods [options]`. They become `methodsPrimary` and `methodsSecondary` in JSON.
- Category values include both `Mobility and Transport` and `Transport`.
