export const NODE_RADIUS = 7;
const GAP = 8;

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function yearX(year, width, margin, yearRange) {
  const span = yearRange.max - yearRange.min || 1;
  const inner = Math.max(width - margin.left - margin.right, 1);
  return margin.left + ((year - yearRange.min) / span) * inner;
}

export function layoutReports(reports, { width, height, margin, yearRange }) {
  const minDist = NODE_RADIUS * 2 + GAP;
  const yMin = margin.top + NODE_RADIUS;
  const yMax = height - margin.bottom - NODE_RADIUS;
  const usableY = Math.max(yMax - yMin, minDist);

  const nodes = reports.map((report) => {
    const rng = mulberry32(hashString(report.uid));
    return {
      id: report.uid,
      report,
      x: yearX(report.year, width, margin, yearRange),
      y: yMin + rng() * usableY,
      r: NODE_RADIUS,
    };
  });

  for (let iter = 0; iter < 180; iter += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dy = b.y - a.y;
        const dx = b.x - a.x;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          dy = i % 2 === 0 ? 1 : -1;
          dist = 1;
        }
        const overlap = (minDist - dist) / 2;
        const dir = dy === 0 ? 1 : Math.sign(dy);
        a.y -= overlap * dir;
        b.y += overlap * dir;
      }
    }
    for (const node of nodes) {
      node.y = Math.min(yMax, Math.max(yMin, node.y));
    }
  }

  return nodes;
}

export function overlaps(nodes, padding = GAP) {
  const minDist = NODE_RADIUS * 2 + padding;
  const collisions = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dist = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      if (dist < minDist - 0.01) {
        collisions.push([nodes[i].id, nodes[j].id, dist]);
      }
    }
  }
  return collisions;
}

export function linePath(a, b) {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export function quadPath(a, b, sign, offset = 22) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * offset * sign;
  const cy = my + (dx / len) * offset * sign;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export function yearTicks(min, max, width) {
  const years = [];
  for (let year = min; year <= max; year += 1) years.push(year);
  if (width < 760) {
    return years.filter((year) => year === min || year === max || year % 2 === 0);
  }
  return years;
}
