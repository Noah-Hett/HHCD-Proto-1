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
  NODE_RADIUS,
  layoutGraph,
  lineNodeCollisions,
  nodeCollisions,
} from "./layout.js";

const csvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/reports.csv");
const reports = parseReports(readFileSync(csvPath, "utf8"));

const laptopFrame = {
  width: 1280,
  height: 700,
  margin: { top: 28, right: 20, bottom: 40, left: 32 },
};

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

test("fits a laptop-sized frame with years at the bottom", () => {
  const graph = buildGraph(reports);
  const yearRange = yearRangeOf(reports);
  const { nodes, height } = layoutGraph(graph, {
    ...laptopFrame,
    yearRange,
  });
  assert.equal(height, laptopFrame.height);
  const axisY = laptopFrame.height - laptopFrame.margin.bottom;
  const lowest = Math.max(...nodes.map((node) => node.y + NODE_RADIUS));
  assert.ok(lowest <= axisY, `lowest node ${lowest} should stay above the year axis ${axisY}`);
  assert.equal(nodeCollisions(nodes, MIN_GAP).length, 0);
  assert.equal(lineNodeCollisions(nodes, graph.edges, LINE_CLEARANCE).length, 0);
});
