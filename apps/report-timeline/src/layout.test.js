import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseReports, yearRangeOf } from "./parseReports.js";
import { buildGraph } from "./graph.js";
import {
  AXIS_BOTTOM,
  LINE_CLEARANCE,
  MIN_GAP,
  NODE_RADIUS,
  layoutGraph,
  lineNodeCollisions,
  nodeCollisions,
} from "./layout.js";

const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/reports.csv");
const reports = parseReports(readFileSync(csvPath, "utf8"));

function assertOnGrid(nodes, margin) {
  const yMin = margin.top + NODE_RADIUS;
  for (const node of nodes) {
    const row = (node.y - yMin) / MIN_GAP;
    assert.ok(
      Math.abs(row - Math.round(row)) < 1e-6,
      `${node.id} y=${node.y} is not on the row grid`,
    );
  }
}

test("places every report on a regular grid without overlapping dots or lines", () => {
  const graph = buildGraph(reports);
  const yearRange = yearRangeOf(reports);
  const margin = { top: 36, right: 36, bottom: AXIS_BOTTOM, left: 36 };
  for (const width of [960, 1100, 1400]) {
    const { nodes } = layoutGraph(graph, {
      width,
      height: 420,
      margin,
      yearRange,
    });
    assert.equal(nodes.length, 64);
    assertOnGrid(nodes, margin);
    assert.equal(nodeCollisions(nodes, MIN_GAP).length, 0);
    assert.equal(lineNodeCollisions(nodes, graph.edges, LINE_CLEARANCE).length, 0);

    const year2006 = nodes.filter((node) => node.year === 2006).sort((a, b) => a.y - b.y);
    const halls = year2006.filter((node) => node.id === "73" || node.id === "75");
    assert.equal(halls.length, 2);
    const indexA = year2006.findIndex((node) => node.id === "73");
    const indexB = year2006.findIndex((node) => node.id === "75");
    assert.equal(Math.abs(indexA - indexB), 1);

    const yMin = margin.top + NODE_RADIUS;
    const byYear = new Map();
    for (const node of nodes) {
      const row = Math.round((node.y - yMin) / MIN_GAP);
      const rows = byYear.get(node.year) ?? [];
      rows.push(row);
      byYear.set(node.year, rows);
    }
    const hasCorridor = [...byYear.values()].some((rows) => {
      const max = Math.max(...rows);
      return rows.length < max + 1;
    });
    assert.equal(hasCorridor, true);
  }
});
