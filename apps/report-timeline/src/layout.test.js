import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseReports, yearRangeOf } from "./parseReports.js";
import { buildGraph } from "./graph.js";
import {
  LINE_CLEARANCE,
  MIN_GAP,
  layoutGraph,
  lineNodeCollisions,
  nodeCollisions,
} from "./layout.js";

const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/reports.csv");
const reports = parseReports(readFileSync(csvPath, "utf8"));

test("places every report without overlapping dots or lines", () => {
  const graph = buildGraph(reports);
  const yearRange = yearRangeOf(reports);
  const margin = { top: 24, right: 16, bottom: 36, left: 28 };
  for (const width of [960, 1100, 1400]) {
    const { nodes } = layoutGraph(graph, {
      width,
      height: 420,
      margin,
      yearRange,
    });
    assert.equal(nodes.length, 64);
    assert.equal(nodeCollisions(nodes, MIN_GAP).length, 0);
    assert.equal(lineNodeCollisions(nodes, graph.edges, LINE_CLEARANCE).length, 0);

    const year2006 = nodes.filter((node) => node.year === 2006).sort((a, b) => a.y - b.y);
    const halls = year2006.filter((node) => node.id === "73" || node.id === "75");
    assert.equal(halls.length, 2);
    const indexA = year2006.findIndex((node) => node.id === "73");
    const indexB = year2006.findIndex((node) => node.id === "75");
    assert.equal(Math.abs(indexA - indexB), 1);
  }
});
