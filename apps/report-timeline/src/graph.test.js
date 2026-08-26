import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseReports } from "./parseReports.js";
import { buildGraph, normalizeAuthorName } from "./graph.js";

const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/reports.csv");
const reports = parseReports(readFileSync(csvPath, "utf8"));

test("parses every row of the current data/reports.csv", () => {
  assert.equal(reports.length, 64);
  assert.ok(reports.every((report) => report.title && report.year && report.uid));
});

test("uses report numbers from the CSV, not file order", () => {
  const byTitle = new Map(reports.map((report) => [report.title, report]));
  assert.equal(byTitle.get("Design bugs out: improving patient safety on hospital wards")?.reportNo, "109");
  assert.equal(byTitle.get("Urban moving 2030 transport typologies for the future")?.reportNo, "12");
  assert.equal(
    reports.find(
      (report) =>
        report.title.startsWith("Process to pleasure: instinctive wayfinding") &&
        report.year === 2000,
    )?.reportNo,
    "1",
  );
  assert.equal(byTitle.get("Playground: inclusive design for disabled homeworkers")?.reportNo, "9");
});

test("keeps partner names out of the connections field", () => {
  const aging = reports.find((report) => report.reportNo === "204");
  const lighting = reports.find((report) => report.reportNo === "63");
  assert.equal(aging.partner, "Hong Kong Polytechnic University");
  assert.equal(aging.connections, null);
  assert.equal(lighting.partner, "Thorn Lighting");
  assert.equal(lighting.connections, null);
});

test("normalises inverted names and et al for author matching", () => {
  assert.equal(normalizeAuthorName("Gheerawo, Rama"), "rama gheerawo");
  assert.equal(normalizeAuthorName("Rama et al Gheerawo"), "rama gheerawo");
});

test("builds project edges only for report numbers that exist", () => {
  const { edges, skippedConnections } = buildGraph(reports);
  const project = edges.filter((edge) => edge.kind === "project");
  const pairs = new Set(project.map((edge) => [edge.source, edge.target].sort().join("::")));
  assert.ok(pairs.has("11::15"));
  assert.ok(pairs.has("194::195"));
  assert.ok(pairs.has("1::21"));
  assert.ok(pairs.has("21::26"));
  assert.ok(pairs.has("13::19"));
  assert.equal(
    project.some((edge) => edge.source === "36" || edge.target === "36"),
    false,
  );
  assert.equal(
    project.some((edge) => edge.source === "166" || edge.target === "166"),
    false,
  );
  assert.ok(skippedConnections.some((item) => item.to === "36"));
  assert.ok(skippedConnections.some((item) => item.to === "166"));
});

test("draws a dotted line between every pair of reports that share an author", () => {
  const { edges } = buildGraph(reports);
  const author = edges.filter((edge) => edge.kind === "author");
  const pairs = new Set(author.map((edge) => [edge.source, edge.target].sort().join("::")));
  assert.ok(pairs.has("1::21"));
  assert.ok(pairs.has("194::195"));
  assert.ok(pairs.has("167::204"));
  assert.ok(pairs.has("112::195"));
  assert.ok(pairs.has("73::75"));
});

test("curves both lines when a pair has project and author links", () => {
  const { edges } = buildGraph(reports);
  const dual = edges.filter(
    (edge) =>
      [edge.source, edge.target].sort().join("::") === "194::195" ||
      [edge.source, edge.target].sort().join("::") === "1::21",
  );
  assert.equal(dual.length, 4);
  assert.ok(dual.every((edge) => edge.curve === 1 || edge.curve === -1));
});
