export const NODE_RADIUS = 7;
export const MIN_GAP = NODE_RADIUS * 2 + 12;
export const LINE_CLEARANCE = NODE_RADIUS + 6;
export const CURVE_OFFSET = 12;

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

function projectAdj(nodes, edges) {
  const ids = new Set(nodes.map((node) => node.id));
  const adj = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (edge.kind !== "project") continue;
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adj.get(edge.source).push(edge.target);
    adj.get(edge.target).push(edge.source);
  }
  return adj;
}

function connectedBlocks(nodes, edges) {
  const adj = projectAdj(nodes, edges);
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

function intervalsOverlap(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

function placeBlocks(blocks, yMin, gap, reservations = []) {
  let y = yMin;
  for (const block of blocks) {
    const blockSpan = Math.max(block.length - 1, 0) * gap;
    for (let step = 0; step < 80; step += 1) {
      const lo = y - LINE_CLEARANCE;
      const hi = y + blockSpan + LINE_CLEARANCE;
      const hit = reservations.find((res) => intervalsOverlap(lo, hi, res.lo, res.hi));
      if (!hit) break;
      y = Math.max(y + gap / 4, hit.hi + LINE_CLEARANCE);
    }
    for (const node of block) {
      node.y = y;
      y += gap;
    }
    y += gap * 0.2;
  }
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
    if (year <= loYear || year >= hiYear) continue;
    const y = yAtX(a, b, edge.curve, x);
    bands.push({ lo: y - LINE_CLEARANCE - 2, hi: y + LINE_CLEARANCE + 2 });
  }
  bands.sort((left, right) => left.lo - right.lo);
  return bands;
}

export function layoutGraph(graph, { width, height, margin, yearRange }) {
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

  const maxCount = Math.max(
    ...[...columns.values()].map((blocks) => blocks.reduce((sum, block) => sum + block.length, 0)),
    1,
  );
  const gap = MIN_GAP;
  const needed = margin.top + margin.bottom + maxCount * gap + 120;
  const chartHeight = Math.max(height, needed);
  const yMin = margin.top + NODE_RADIUS;

  for (const node of nodes) {
    node.x = yearX(node.year, width, margin, yearRange);
    node.r = NODE_RADIUS;
  }

  for (const blocks of columns.values()) {
    placeBlocks(blocks, yMin, gap);
  }

  for (let pass = 0; pass < 12; pass += 1) {
    for (const [year, blocks] of columns) {
      const x = yearX(year, width, margin, yearRange);
      if (pass < 8) {
        blocks.sort((left, right) => {
          const bary = (block) => {
            const values = [];
            for (const node of block) {
              for (const id of neighbors.get(node.id) ?? []) {
                const other = byId.get(id);
                if (other && other.year !== node.year) values.push(other.y);
              }
            }
            if (!values.length) {
              return block.reduce((sum, node) => sum + node.y, 0) / block.length;
            }
            return values.reduce((sum, value) => sum + value, 0) / values.length;
          };
          return bary(left) - bary(right);
        });
      }
      const reservations = reservationsForYear(year, x, edges, byId);
      placeBlocks(blocks, yMin, gap, reservations);
    }
  }

  for (let settle = 0; settle < 16; settle += 1) {
    for (const [year, blocks] of columns) {
      const x = yearX(year, width, margin, yearRange);
      placeBlocks(blocks, yMin, gap, reservationsForYear(year, x, edges, byId));
    }
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }
  const extra = yMin - minY;
  if (extra !== 0) {
    for (const node of nodes) node.y += extra;
    maxY += extra;
  }
  const finalHeight = Math.max(chartHeight, maxY + margin.bottom + NODE_RADIUS + 12);

  return { nodes, height: finalHeight };
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
