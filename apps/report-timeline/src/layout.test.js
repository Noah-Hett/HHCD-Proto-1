import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseReports, yearRangeOf } from "./parseReports.js";
import { buildGraph } from "./graph.js";
import {
  FIRST_ROW_OFFSET,
  LINE_CLEARANCE,
  MIN_GAP,
  layoutGraph,
  lineNodeCollisions,
  nodeCollisions,
} from "./layout.js";

const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/reports.csv");
const reports = parseReports(readFileSync(csvPath, "utf8"));

function assertOnGrid(nodes, axisY) {
  for (const node of nodes) {
    const dist = Math.abs(node.y - axisY);
    const row = (dist - FIRST_ROW_OFFSET) / MIN_GAP;
    assert.ok(
      Math.abs(row - Math.round(row)) < 1e-6,
      `${node.id} y=${node.y} is not on the row grid around axis ${axisY}`,
    );
    assert.ok(dist >= FIRST_ROW_OFFSET - 1e-6, `${node.id} overlaps the year axis`);
  }
}

test("places reports on both sides of a centred year axis without overlapping dots or lines", () => {
  const graph = buildGraph(reports);
  const yearRange = yearRangeOf(reports);
  const margin = { top: 36, right: 36, bottom: 36, left: 36 };
  for (const width of [960, 1100, 1400]) {
    const { nodes, height, axisY } = layoutGraph(graph, {
      width,
      margin,
      yearRange,
    });
    assert.equal(nodes.length, 64);
    assert.ok(Number.isFinite(height) && height > 0);
    assert.equal(axisY, height / 2);
    assertOnGrid(nodes, axisY);
    assert.equal(nodeCollisions(nodes, MIN_GAP).length, 0);
    assert.equal(lineNodeCollisions(nodes, graph.edges, LINE_CLEARANCE).length, 0);

    const above = nodes.filter((node) => node.y < axisY);
    const below = nodes.filter((node) => node.y > axisY);
    assert.ok(above.length > 0, "expected reports above the axis");
    assert.ok(below.length > 0, "expected reports below the axis");

    const year2006 = nodes.filter((node) => node.year === 2006).sort((a, b) => a.y - b.y);
    const halls = year2006.filter((node) => node.id === "73" || node.id === "75");
    assert.equal(halls.length, 2);
    assert.equal(Math.sign(halls[0].y - axisY), Math.sign(halls[1].y - axisY));
    const indexA = year2006.findIndex((node) => node.id === "73");
    const indexB = year2006.findIndex((node) => node.id === "75");
    assert.equal(Math.abs(indexA - indexB), 1);

    const byYear = new Map();
    for (const node of nodes) {
      const row = Math.round((Math.abs(node.y - axisY) - FIRST_ROW_OFFSET) / MIN_GAP);
      const side = node.y < axisY ? "above" : "below";
      const key = `${node.year}:${side}`;
      const rows = byYear.get(key) ?? [];
      rows.push(row);
      byYear.set(key, rows);
    }
    const hasCorridor = [...byYear.values()].some((rows) => {
      const max = Math.max(...rows);
      return rows.length < max + 1;
    });
    assert.equal(hasCorridor, true);
  }
});

test("grows equally above and below when the stage is taller than the packed reports", () => {
  const graph = buildGraph(reports);
  const yearRange = yearRangeOf(reports);
  const margin = { top: 36, right: 36, bottom: 36, left: 36 };
  const packed = layoutGraph(graph, { width: 1100, margin, yearRange });
  const tall = layoutGraph(graph, {
    width: 1100,
    height: packed.height + 200,
    margin,
    yearRange,
  });
  assert.equal(tall.height, packed.height + 200);
  assert.equal(tall.axisY, tall.height / 2);
  const packedAbove = packed.nodes.filter((node) => node.y < packed.axisY).length;
  const tallAbove = tall.nodes.filter((node) => node.y < tall.axisY).length;
  assert.equal(tallAbove, packedAbove);
});
