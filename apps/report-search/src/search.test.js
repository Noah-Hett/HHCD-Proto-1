import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildVocab,
  parseQuery,
  search,
  highlightParts,
} from "./search.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const reports = (
  await import(pathToFileURL(resolve(root, "packages/data/src/reports.json")).href, {
    with: { type: "json" },
  })
).default;
const vocab = buildVocab(reports);

test("catalogue has the refreshed 64 reports", () => {
  assert.equal(reports.length, 64);
  assert.ok(reports.some((report) => report.title.includes("Aging in a vertical city")));
  assert.ok(reports.some((report) => report.title.startsWith("Working Light")));
});

test("health interviews 2001 extracts category, method, and year", () => {
  const parsed = parseQuery("health interviews 2001", vocab);
  assert.deepEqual(parsed.filters.categories, ["Health and wellbeing"]);
  assert.deepEqual(parsed.filters.methods, ["Individual Interviews"]);
  assert.deepEqual(parsed.filters.years, [2001]);
  assert.equal(parsed.remainderTerms.length, 0);

  const { results, chips } = search(reports, "health interviews 2001", { vocab });
  assert.ok(chips.some((chip) => chip.label === "Method: Individual Interviews"));
  assert.ok(chips.some((chip) => chip.label === "Year: 2001"));
  assert.ok(results.length >= 2);
  assert.ok(results.every((item) => item.report.year === 2001));
  assert.ok(
    results.every((item) => item.report.category === "Health and wellbeing"),
  );
  const titles = results.map((item) => item.report.title);
  assert.ok(titles.some((title) => title.includes("Stepping stone")));
  assert.ok(titles.some((title) => title.includes("Foot print")));
});

test("taxi matches targeted-user text without needing a method name", () => {
  const parsed = parseQuery("taxi", vocab);
  assert.equal(parsed.filters.methods.length, 0);
  assert.deepEqual(parsed.remainderTerms, ["taxi"]);

  const { results } = search(reports, "taxi", { vocab });
  assert.ok(results.length >= 2);
  assert.ok(
    results.every((item) =>
      String(item.report.targetedUser ?? "").toLowerCase().includes("taxi"),
    ),
  );
});

test("observation becomes a method filter", () => {
  const parsed = parseQuery("observation", vocab);
  assert.deepEqual(parsed.filters.methods, ["Observation"]);
  const { results } = search(reports, "observation", { vocab });
  assert.ok(results.length >= 20);
  assert.ok(
    results.every((item) =>
      (item.report.methodsPrimary ?? []).some(
        (method) => method.toLowerCase() === "observation",
      ),
    ),
  );
});

test("#11 and report 11 find e-scape", () => {
  for (const query of ["#11", "report 11"]) {
    const { results, chips } = search(reports, query, { vocab });
    assert.deepEqual(
      chips.map((chip) => chip.label),
      ["Report 11"],
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].report.title.startsWith("e-scape"), true);
  }
});

test("leftover words still match descriptions", () => {
  const parsed = parseQuery("urban lighting", vocab);
  assert.ok(parsed.filters.categories.includes("City and community"));
  assert.deepEqual(parsed.remainderTerms, ["lighting"]);
  const { results } = search(reports, "urban lighting", { vocab });
  assert.ok(results.length >= 1);
  assert.ok(
    results.some((item) =>
      /light/i.test(
        `${item.report.title} ${item.report.description} ${item.report.findings}`,
      ),
    ),
  );
});

test("year ranges restrict results", () => {
  const parsed = parseQuery("workshops 2004-2006", vocab);
  assert.deepEqual(parsed.filters.methods, ["Workshops"]);
  assert.equal(parsed.filters.yearRanges.length, 1);
  assert.deepEqual(parsed.filters.yearRanges[0], { from: 2004, to: 2006 });
  const { results } = search(reports, "workshops 2004-2006", { vocab });
  assert.ok(results.length >= 1);
  assert.ok(results.every((item) => item.report.year >= 2004 && item.report.year <= 2006));
});

test("prototype stays a suggestion rather than an auto-filter", () => {
  const { chips, suggestions, parsed } = search(reports, "prototype", { vocab });
  assert.equal(chips.length, 0);
  assert.ok(suggestions.some((item) => item.dimension === "projectTypes"));
  assert.ok(suggestions.some((item) => item.dimension === "methods"));
  assert.ok(parsed.remainderTerms.includes("prototype"));
});

test("aging vertical city finds the new 2017 report", () => {
  const { results } = search(reports, "aging vertical city", { vocab });
  assert.ok(results.some((item) => item.report.reportNo === "204"));
});

test("highlight wraps matching terms", () => {
  const parts = highlightParts("Taxi drivers; taxi passengers", ["taxi"]);
  assert.ok(parts.some((part) => part.hit && part.text.toLowerCase() === "taxi"));
});

test("csv and json stay in sync", async () => {
  const csv = await readFile(resolve(root, "data/hhcd-reports.csv"), "utf8");
  assert.ok(csv.includes("Aging in a vertical city"));
  assert.ok(csv.includes("Working Light"));
});
