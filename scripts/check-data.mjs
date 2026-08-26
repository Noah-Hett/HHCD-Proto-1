import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const reports = (
  await import(pathToFileURL(resolve(root, "packages/data/src/reports.json")).href, {
    with: { type: "json" },
  })
).default;
const csv = await readFile(resolve(root, "data/hhcd-reports.csv"), "utf8");

const required = [
  "reportNo",
  "category",
  "title",
  "author",
  "year",
  "methodsPrimary",
];

if (reports.length < 62) {
  throw new Error(`expected at least 62 reports, got ${reports.length}`);
}

for (const [index, report] of reports.entries()) {
  for (const key of required) {
    if (!(key in report)) {
      throw new Error(`report ${index} is missing ${key}`);
    }
  }
  if (!Array.isArray(report.methodsPrimary)) {
    throw new Error(`report ${report.reportNo} methodsPrimary must be an array`);
  }
}

const categories = new Set(reports.map((report) => report.category));
if (!categories.has("Mobility and Transport") || !categories.has("Transport")) {
  throw new Error("expected both Mobility and Transport and Transport categories");
}

if (!csv.includes("Methods [options]")) {
  throw new Error("source CSV should contain a Methods [options] column");
}

console.log(`ok: ${reports.length} reports, ${categories.size} categories`);
