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
  const { nodes } = layoutGraph(graph, {
    width: 1100,
    height: 420,
    margin: { top: 24, right: 16, bottom: 36, left: 28 },
    yearRange,
  });
  assert.equal(nodes.length, 64);
  assert.equal(nodeCollisions(nodes, MIN_GAP).length, 0);
  assert.equal(lineNodeCollisions(nodes, graph.edges, LINE_CLEARANCE).length, 0);
});
