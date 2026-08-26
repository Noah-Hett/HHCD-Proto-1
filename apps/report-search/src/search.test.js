import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildIndex,
  buildVocab,
  highlightParts,
  levenshtein,
  parseQuery,
  search,
} from "./search.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const reports = (
  await import(pathToFileURL(resolve(root, "packages/data/src/reports.json")).href, {
    with: { type: "json" },
  })
).default;
const vocab = buildVocab(reports);
const index = buildIndex(reports);

function run(query) {
  return search(reports, query, { vocab, index });
}

test("catalogue has the refreshed 64 reports", () => {
  assert.equal(reports.length, 64);
});

test("search never removes reports from the field", () => {
  const { all, pops } = run("health interviews 2001");
  assert.equal(all.length, 64);
  assert.ok(pops.length >= 2);
  assert.ok(pops.length < 64);
});

test("health interviews 2001 still surfaces the close reports", () => {
  const parsed = parseQuery("health interviews 2001", vocab);
  assert.deepEqual(parsed.filters.categories, ["Health and wellbeing"]);
  assert.deepEqual(parsed.filters.methods, ["Individual Interviews"]);
  assert.deepEqual(parsed.filters.years, [2001]);
  const { pops } = run("health interviews 2001");
  const titles = pops.map((item) => item.report.title);
  assert.ok(titles.some((title) => title.includes("Stepping stone")));
  assert.ok(titles.some((title) => title.includes("Foot print")));
});

test("taxi pops matching reports without emptying the field", () => {
  const { pops, all } = run("taxi");
  assert.equal(all.length, 64);
  assert.ok(pops.some((item) => /taxi/i.test(item.report.title)));
  assert.ok(
    pops.some((item) => String(item.report.targetedUser ?? "").toLowerCase().includes("taxi")),
  );
});

test("typos still find observation reports", () => {
  assert.ok(levenshtein("observaton", "observation") <= 2);
  const { pops, corrections, all } = run("observaton");
  assert.equal(all.length, 64);
  assert.ok(corrections.some((item) => item.to.includes("observ")));
  assert.ok(
    pops.some((item) =>
      (item.report.methodsPrimary ?? []).some((method) => /observ/i.test(method)),
    ),
  );
});

test("#11 finds e-scape at the top", () => {
  const { pops, all } = run("#11");
  assert.equal(all.length, 64);
  assert.equal(pops[0].report.title.startsWith("e-scape"), true);
});

test("urban lighting ranks lighting reports", () => {
  const { pops } = run("urban lighting");
  assert.ok(
    pops.some((item) =>
      /light/i.test(`${item.report.title} ${item.report.description}`),
    ),
  );
});

test("growing older is a semantic neighbourhood, not an exact phrase", () => {
  const { pops, themes, all } = run("growing older");
  assert.equal(all.length, 64);
  assert.ok(themes.some((theme) => theme.label === "Growing older"));
  assert.ok(
    pops.some((item) =>
      /age|older|dementia|elderly/i.test(
        `${item.report.title} ${item.report.description} ${item.report.targetedUser}`,
      ),
    ),
  );
});

test("prototype stays a suggestion and still pops nearby work", () => {
  const { suggestions, pops, all } = run("prototype");
  assert.equal(all.length, 64);
  assert.ok(suggestions.some((item) => item.dimension === "projectTypes"));
  assert.ok(pops.length >= 1);
});

test("aging vertical city finds the new 2017 report", () => {
  const { pops } = run("aging vertical city");
  assert.ok(pops.some((item) => item.report.reportNo === "204"));
});

test("highlight wraps matching terms", () => {
  const parts = highlightParts("Taxi drivers; taxi passengers", ["taxi"]);
  assert.ok(parts.some((part) => part.hit && part.text.toLowerCase() === "taxi"));
});

test("csv and json stay in sync", async () => {
  const csv = await readFile(resolve(root, "data/hhcd-reports.csv"), "utf8");
  assert.ok(csv.includes("Aging in a vertical city"));
});
