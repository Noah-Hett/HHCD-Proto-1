#!/usr/bin/env python3
"""Regenerate packages/data/src/reports.json from data/hhcd-reports.csv."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "hhcd-reports.csv"
OUT = ROOT / "packages" / "data" / "src" / "reports.json"


def split_opts(value: str) -> list[str]:
    if not value or not value.strip():
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def main() -> None:
    with SRC.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    data = rows[1:]
    reports = []
    for row in data:
        while len(row) < 17:
            row.append("")
        year_raw = clean(row[4])
        try:
            year = int(year_raw) if year_raw else None
        except ValueError:
            year = year_raw
        reports.append(
            {
                "reportNo": clean(row[0]),
                "category": clean(row[1]),
                "title": clean(row[2]),
                "author": clean(row[3]),
                "year": year,
                "description": clean(row[5]),
                "projectType": clean(row[6]),
                "targetedUser": clean(row[7]),
                "findings": clean(row[8]),
                "outputs": clean(row[9]),
                "challenges": clean(row[10]),
                "budget": clean(row[11]),
                "methodsPrimary": split_opts(row[12]),
                "website": clean(row[13]),
                "partner": clean(row[14]),
                "connections": clean(row[15]),
                "contact": clean(row[16]),
            }
        )
    OUT.write_text(json.dumps(reports, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(reports)} reports to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
