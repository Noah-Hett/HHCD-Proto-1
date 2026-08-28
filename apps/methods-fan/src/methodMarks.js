function circ(cx, cy, r) {
  return `M${cx},${cy - r}a${r},${r} 0 1 1 0,${2 * r}a${r},${r} 0 1 1 0,${-2 * r}z`;
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  return `M${x + radius},${y}h${w - 2 * radius}a${radius},${radius} 0 0 1 ${radius},${radius}v${h - 2 * radius}a${radius},${radius} 0 0 1 ${-radius},${radius}h${-(w - 2 * radius)}a${radius},${radius} 0 0 1 ${-radius},${-radius}v${-(h - 2 * radius)}a${radius},${radius} 0 0 1 ${radius},${-radius}z`;
}

function bust(cx, cy, scale = 1) {
  const headR = 2.35 * scale;
  const headY = cy - 2.4 * scale;
  const shoulderY = cy + 1.05 * scale;
  const bottom = cy + 5.4 * scale;
  const left = cx - 4.35 * scale;
  const right = cx + 4.35 * scale;
  return (
    circ(cx, headY, headR) +
    `M${left},${bottom}C${left},${shoulderY} ${cx - headR},${shoulderY} ${cx},${shoulderY}S${right},${shoulderY} ${right},${bottom}z`
  );
}

function speechBubble(ox, oy, w, h, flip = 1) {
  const x = ox - w / 2;
  const y = oy - h / 2;
  const r = Math.min(2.1, w / 4, h / 4);
  const tail = flip > 0
    ? `l${-2.4},${3.1}v${-3.1}`
    : `h${2.4}l${2.4},${3.1}v${-3.1}`;
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${flip > 0 ? -(w / 2 - r - 0.4) : -(w - 2 * r)}${tail}h${flip > 0 ? -(w / 2 - r - 2) : 0}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}z`;
}

const ICONS = {
  "Individual Interviews": {
    ink: "fill",
    rule: "evenodd",
    d:
      speechBubble(0.15, -0.9, 15.4, 10.6, 1) +
      roundedRect(-3.6, -3.4, 1.35, 3.6, 0.4) +
      roundedRect(0.4, -3.4, 1.35, 3.6, 0.4),
  },
  Observation: {
    ink: "fill",
    rule: "evenodd",
    d:
      `M-9.8,0c2.7,-6.4 6.6,-8.6 9.8,-8.6s7.1,2.2 9.8,8.6c-2.7,6.4 -6.6,8.6 -9.8,8.6s-7.1,-2.2 -9.8,-8.6z` +
      circ(0, 0, 2.7),
  },
  "Desk Research": {
    ink: "fill",
    rule: "evenodd",
    d:
      `M-6.4,-9h9.2l3.6,3.6v14.4h-12.8zM2.8,-9v3.6h3.6z` +
      roundedRect(-4.2, -1.4, 8.4, 1.15, 0.4) +
      roundedRect(-4.2, 1.3, 8.4, 1.15, 0.4) +
      roundedRect(-4.2, 4, 6.2, 1.15, 0.4),
  },
  Workshops: {
    ink: "fill",
    d:
      roundedRect(-9.2, 2.4, 18.4, 4.6, 1.6) +
      circ(-4.9, -3.1, 2.2) +
      circ(0, -5.3, 2.45) +
      circ(4.9, -3.1, 2.2),
  },
  Scenarios: {
    ink: "fill",
    d:
      roundedRect(-9.5, -7.2, 5.4, 14.4, 0.85) +
      roundedRect(-2.7, -7.2, 5.4, 14.4, 0.85) +
      roundedRect(4.1, -7.2, 5.4, 14.4, 0.85),
  },
  Mapping: {
    ink: "fill",
    rule: "evenodd",
    d:
      `M0,9.6c-0.4,0 -7.2,-8.1 -7.2,-12.2a7.2,7.2 0 1 1 14.4,0c0,4.1 -6.8,12.2 -7.2,12.2z` +
      circ(0, -2.7, 2.35),
  },
  "Focus Groups": {
    ink: "fill",
    d: bust(-4.6, 0.6, 0.78) + bust(4.6, 0.6, 0.78) + bust(0, -0.4, 0.95),
  },
  "Mockups and Rapid Prototyping": {
    ink: "stroke",
    d:
      `M0,-7.6L7.8,-3.2V5L0,9.4L-7.8,5V-3.2Z` +
      `M-7.8,-3.2L0,1.2L7.8,-3.2` +
      `M0,1.2V9.4`,
  },
  "Co-Design": {
    ink: "fill",
    d:
      bust(-4.1, 0.35, 0.88) +
      bust(4.1, 0.35, 0.88) +
      `M-1.15,-8.6h2.3v2.3h2.3v2.3h-2.3v2.3h-2.3v-2.3h-2.3v-2.3h2.3z`,
  },
  Personas: {
    ink: "fill",
    d: bust(0, 0.2, 1.12),
  },
  "Role Playing": {
    ink: "fill",
    rule: "evenodd",
    d:
      `M0,-9.2c5.4,0 9.4,3.4 9.4,8.4c0,4.2 -2.6,6.8 -6.4,8.4l-3,1.6l-3,-1.6c-3.8,-1.6 -6.4,-4.2 -6.4,-8.4c0,-5 4,-8.4 9.4,-8.4z` +
      circ(-3.1, -1.6, 1.7) +
      circ(3.1, -1.6, 1.7) +
      `M-3.2,3.1c1.8,2.4 4.6,2.4 6.4,0c-2.1,0.7 -4.3,0.7 -6.4,0z`,
  },
  "Critical User Forums": {
    ink: "fill",
    d:
      speechBubble(-3.1, -3.7, 12.6, 8, 1) +
      speechBubble(3.3, 3.9, 12.2, 7.6, -1),
  },
};

const FALLBACK = { ink: "fill", d: circ(0, 0, 6) };

export function methodMark(name) {
  return ICONS[name] ?? FALLBACK;
}
