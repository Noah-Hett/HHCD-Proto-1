export const NODE_RADIUS = 7;
export const MIN_GAP = NODE_RADIUS * 2 + 12;
export const LINE_CLEARANCE = NODE_RADIUS + 6;
export const CURVE_OFFSET = 12;
/** Horizontal inset for the year-axis arrow. */
export const AXIS_PAD = 16;
export const YEAR_FONT_SIZE = 11;
export const AXIS_LABEL_GAP = 8;
/** Half the vertical band reserved for the centred year spine and labels. */
export const AXIS_HALF_BAND = YEAR_FONT_SIZE / 2 + AXIS_LABEL_GAP;
/** Distance from the axis to the first report-row centre. */
export const FIRST_ROW_OFFSET = AXIS_HALF_BAND + NODE_RADIUS;

export function yearX(year, width, margin, yearRange) {
  const span = yearRange.max - yearRange.min || 1;
  const inner = Math.max(width - margin.left - margin.right, 1);
  return margin.left + ((year - yearRange.min) / span) * inner;
}

export function yearTicks(min, max, width) {
  const years = [];
  for (let year = min; year <= max; year += 1) years.push(year);
  if (width < 760) {
    return years.filter((year) => year === min || year === max || year % 2 === 0);
  }
  return years;
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function controlPoint(a, b, sign, offset = CURVE_OFFSET) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: mx + (-dy / len) * offset * sign,
    y: my + (dx / len) * offset * sign,
  };
}

function bezierPoint(a, b, sign, t) {
  const c = controlPoint(a, b, sign);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

function distPointToEdge(node, a, b, curve) {
  if (!curve) return distPointToSegment(node.x, node.y, a.x, a.y, b.x, b.y);
  let min = Infinity;
  for (let i = 0; i <= 24; i += 1) {
    const p = bezierPoint(a, b, curve, i / 24);
    min = Math.min(min, Math.hypot(node.x - p.x, node.y - p.y));
  }
  return min;
}

function yOnChord(nodeX, a, b) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 0.5) return (a.y + b.y) / 2;
  const t = (nodeX - a.x) / dx;
  return a.y + t * (b.y - a.y);
}

function sameYearAdj(nodes, edges) {
  const ids = new Set(nodes.map((node) => node.id));
  const adj = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adj.get(edge.source).push(edge.target);
    adj.get(edge.target).push(edge.source);
  }
  return adj;
}

function connectedBlocks(nodes, edges) {
  const adj = sameYearAdj(nodes, edges);
  const seen = new Set();
  const blocks = [];

  function walk(startId) {
    const stack = [startId];
    const ids = [];
    seen.add(startId);
    while (stack.length) {
      const id = stack.pop();
      ids.push(id);
      for (const next of adj.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    const block = ids.map((id) => nodes.find((node) => node.id === id));
    const start =
      block.find((node) => (adj.get(node.id) ?? []).length <= 1) ?? block[0];
    const ordered = [];
    const visited = new Set();
    function dfs(id) {
      visited.add(id);
      ordered.push(block.find((node) => node.id === id));
      for (const next of adj.get(id) ?? []) {
        if (!visited.has(next)) dfs(next);
      }
    }
    dfs(start.id);
    for (const node of block) {
      if (!visited.has(node.id)) ordered.push(node);
    }
    return ordered;
  }

  const sorted = [...nodes].sort((a, b) =>
    String(a.report.title).localeCompare(String(b.report.title)),
  );
  for (const node of sorted) {
    if (seen.has(node.id)) continue;
    blocks.push(walk(node.id));
  }
  return blocks;
}

function neighborMap(edges) {
  const map = new Map();
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, []);
    if (!map.has(edge.target)) map.set(edge.target, []);
    map.get(edge.source).push(edge.target);
    map.get(edge.target).push(edge.source);
  }
  return map;
}

function sideY(row, axisY, side, gap, offset = FIRST_ROW_OFFSET) {
  return axisY + side * (offset + row * gap);
}

function rowHitsReservation(row, axisY, side, gap, reservations) {
  const y = sideY(row, axisY, side, gap);
  return reservations.some((res) => y > res.lo && y < res.hi);
}

function placeBlocksOutward(blocks, axisY, side, gap, reservations = []) {
  let row = 0;
  for (const block of blocks) {
    for (let step = 0; step < 200; step += 1) {
      let blocked = false;
      for (let i = 0; i < block.length; i += 1) {
        if (rowHitsReservation(row + i, axisY, side, gap, reservations)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) break;
      row += 1;
    }
    for (const node of block) {
      node.y = sideY(row, axisY, side, gap);
      node.side = side;
      row += 1;
    }
  }
}

function blockBary(block, neighbors, byId) {
  const values = [];
  for (const node of block) {
    for (const id of neighbors.get(node.id) ?? []) {
      const other = byId.get(id);
      if (other && other.year !== node.year && other.y != null) values.push(other.y);
    }
  }
  if (!values.length) {
    return block.reduce((sum, node) => sum + (node.y ?? 0), 0) / block.length;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortBlocks(blocks, side, neighbors, byId) {
  blocks.sort(
    (left, right) => side * (blockBary(left, neighbors, byId) - blockBary(right, neighbors, byId)),
  );
}

function assignSides(columns, years) {
  const sides = new Map();
  let globalAbove = 0;
  let globalBelow = 0;
  for (const year of years) {
    const above = [];
    const below = [];
    let localAbove = 0;
    let localBelow = 0;
    for (const block of columns.get(year)) {
      if (globalAbove + localAbove <= globalBelow + localBelow) {
        above.push(block);
        localAbove += block.length;
      } else {
        below.push(block);
        localBelow += block.length;
      }
    }
    globalAbove += localAbove;
    globalBelow += localBelow;
    sides.set(year, { above, below });
  }
  return sides;
}

function axisReservation(axisY) {
  return { lo: axisY - AXIS_HALF_BAND, hi: axisY + AXIS_HALF_BAND };
}

function yAtX(a, b, curve, x) {
  if (!curve) return yOnChord(x, a, b);
  let best = a.y;
  let bestDx = Infinity;
  for (let i = 0; i <= 40; i += 1) {
    const point = bezierPoint(a, b, curve, i / 40);
    const dx = Math.abs(point.x - x);
    if (dx < bestDx) {
      bestDx = dx;
      best = point.y;
    }
  }
  return best;
}

function reservationsForYear(year, x, edges, byId) {
  const bands = [];
  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const loYear = Math.min(a.year, b.year);
    const hiYear = Math.max(a.year, b.year);
    if (year < loYear || year > hiYear) continue;
    const y = yAtX(a, b, edge.curve, x);
    if (year === loYear || year === hiYear) {
      if (!edge.curve) continue;
      const endpoint = year === a.year ? a : b;
      if (Math.abs(y - endpoint.y) < NODE_RADIUS + 2) continue;
    }
    bands.push({ lo: y - LINE_CLEARANCE + 0.05, hi: y + LINE_CLEARANCE - 0.05 });
  }
  bands.sort((left, right) => left.lo - right.lo);
  return bands;
}

export function layoutGraph(graph, { width, height: stageHeight = 0, margin, yearRange }) {
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const edges = graph.edges;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const neighbors = neighborMap(edges);

  const years = [...new Set(nodes.map((node) => node.year))].sort((a, b) => a - b);
  const columns = new Map();
  for (const year of years) {
    const colNodes = nodes.filter((node) => node.year === year);
    columns.set(year, connectedBlocks(colNodes, edges));
  }

  const sides = assignSides(columns, years);
  const gap = MIN_GAP;
  const axisLocal = 0;
  const padTop = margin.top ?? 0;
  const padBottom = margin.bottom ?? 0;

  for (const node of nodes) {
    node.x = yearX(node.year, width, margin, yearRange);
    node.r = NODE_RADIUS;
  }

  function reservationsAt(year) {
    const x = yearX(year, width, margin, yearRange);
    return [axisReservation(axisLocal), ...reservationsForYear(year, x, edges, byId)];
  }

  function placeYear(year, { above, below }) {
    const reservations = reservationsAt(year);
    placeBlocksOutward(above, axisLocal, -1, gap, reservations);
    placeBlocksOutward(below, axisLocal, 1, gap, reservations);
  }

  for (const [year, pair] of sides) {
    placeYear(year, pair);
  }

  for (let pass = 0; pass < 12; pass += 1) {
    for (const [year, pair] of sides) {
      if (pass < 8) {
        sortBlocks(pair.above, -1, neighbors, byId);
        sortBlocks(pair.below, 1, neighbors, byId);
      }
      placeYear(year, pair);
    }
  }

  for (let settle = 0; settle < 16; settle += 1) {
    for (const [year, pair] of sides) {
      placeYear(year, pair);
    }
  }

  for (let pass = 0; pass < 8; pass += 1) {
    for (const { above, below } of sides.values()) {
      repairColumnSide(above, edges, byId, axisLocal, -1, gap);
      repairColumnSide(below, edges, byId, axisLocal, 1, gap);
    }
  }

  let maxAbs = FIRST_ROW_OFFSET + NODE_RADIUS;
  for (const node of nodes) {
    maxAbs = Math.max(maxAbs, Math.abs(node.y) + NODE_RADIUS);
  }
  const half = maxAbs + Math.max(padTop, padBottom);
  const finalHeight = Math.max(stageHeight || 0, half * 2);
  const axisY = finalHeight / 2;
  for (const node of nodes) {
    node.y += axisY;
  }

  return { nodes, height: finalHeight, axisY };
}

function blockHitsLines(block, edges, byId) {
  for (const node of block) {
    for (const edge of edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      if (node.id === a.id || node.id === b.id) continue;
      if (distPointToEdge(node, a, b, edge.curve) < LINE_CLEARANCE - 0.05) return true;
    }
  }
  return false;
}

function repairColumnSide(blocks, edges, byId, axisY, side, gap) {
  const ordered = [...blocks].sort(
    (left, right) => Math.abs(left[0].y - axisY) - Math.abs(right[0].y - axisY),
  );
  let minRow = 0;
  for (const block of ordered) {
    let row = Math.max(
      minRow,
      Math.round((Math.abs(block[0].y - axisY) - FIRST_ROW_OFFSET) / gap),
    );
    for (let guard = 0; guard < 200; guard += 1) {
      for (let i = 0; i < block.length; i += 1) {
        block[i].y = sideY(row + i, axisY, side, gap);
      }
      if (row >= minRow && !blockHitsLines(block, edges, byId)) break;
      row += 1;
    }
    minRow = row + block.length;
  }
}

export function linePath(a, b) {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export function quadPath(a, b, sign, offset = CURVE_OFFSET) {
  const c = controlPoint(a, b, sign, offset);
  return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
}

export function nodeCollisions(nodes, minDist = MIN_GAP) {
  const hits = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dist = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      if (dist < minDist - 0.05) hits.push([nodes[i].id, nodes[j].id, dist]);
    }
  }
  return hits;
}

export function lineNodeCollisions(nodes, edges, clearance = LINE_CLEARANCE) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const hits = [];
  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    for (const node of nodes) {
      if (node.id === a.id || node.id === b.id) continue;
      const dist = distPointToEdge(node, a, b, edge.curve);
      if (dist < clearance - 0.05) hits.push([edge.id, node.id, dist]);
    }
  }
  return hits;
}
