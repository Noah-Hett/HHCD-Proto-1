export const CATEGORY_ORDER = [
  "Transport",
  "Mobility and Transport",
  "City and community",
  "Health and wellbeing",
  "Work and workplace",
];

export const CATEGORY_COLORS = {
  Transport: "#c24e2f",
  "Mobility and Transport": "#d8892c",
  "City and community": "#3d6e8a",
  "Health and wellbeing": "#2f7a62",
  "Work and workplace": "#6e4d7b",
};

const FALLBACK_COLOR = "#555";

export const METHOD_SHORT = {
  "Individual Interviews": "Interviews",
  "Mockups and Rapid Prototyping": "Mockups",
  "Critical User Forums": "User forums",
  "Desk Research": "Desk research",
  "Focus Groups": "Focus groups",
  "Co-Design": "Co-design",
  "Role Playing": "Role playing",
};

export function categoryColor(category) {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

export function buildGraph(reports) {
  const methods = new Map();
  const projects = [];
  const links = [];

  for (const report of reports) {
    const project = {
      id: `p-${report.reportNo}`,
      kind: "project",
      report,
      category: report.category,
      color: categoryColor(report.category),
      title: report.title,
      methodIds: [],
    };
    projects.push(project);

    for (const name of report.methodsPrimary ?? []) {
      let method = methods.get(name);
      if (!method) {
        method = {
          id: `m-${name}`,
          kind: "method",
          label: name,
          short: METHOD_SHORT[name] ?? name,
          count: 0,
          projectIds: [],
        };
        methods.set(name, method);
      }
      method.count += 1;
      method.projectIds.push(project.id);
      project.methodIds.push(method.id);
      links.push({
        id: `${method.id}→${project.id}`,
        source: method.id,
        target: project.id,
      });
    }
  }

  const counts = new Map();
  for (const project of projects) {
    counts.set(project.category, (counts.get(project.category) ?? 0) + 1);
  }

  const known = CATEGORY_ORDER.filter((name) => counts.has(name));
  const extra = [...counts.keys()]
    .filter((name) => !CATEGORY_ORDER.includes(name))
    .sort((a, b) => a.localeCompare(b));

  const categories = [...known, ...extra].map((name) => ({
    id: name,
    kind: "category",
    label: name,
    count: counts.get(name),
    color: categoryColor(name),
  }));

  const byCategory = new Map(categories.map((category) => [category.id, []]));
  for (const project of projects) {
    (byCategory.get(project.category) ?? projects).push(project);
  }
  for (const group of byCategory.values()) {
    group.sort((a, b) => {
      const year = (a.report.year ?? 0) - (b.report.year ?? 0);
      return year || a.title.localeCompare(b.title);
    });
  }

  return {
    methods: [...methods.values()],
    projects,
    links,
    categories,
    byCategory,
  };
}

export function layoutGraph(graph, width, height) {
  const padX = 58;
  const padTop = 56;
  const padBottom = 22;
  const cx = width / 2;
  const cy = height - padBottom;
  const outerR = Math.max(72, Math.min(cx - padX, cy - padTop));
  const innerR = outerR * 0.34;
  const projectR = outerR * 0.8;
  const bandInner = outerR * 0.865;
  const bandOuter = outerR * 0.935;
  const angleStart = -Math.PI + 0.18;
  const angleEnd = -0.18;
  const span = angleEnd - angleStart;
  const gap = Math.min(0.055, span * 0.04);
  const usable = span - gap * Math.max(0, graph.categories.length - 1);
  const total = graph.projects.length || 1;
  const maxMethod = Math.max(...graph.methods.map((method) => method.count), 1);
  const scale = Math.max(0.72, Math.min(1.15, outerR / 280));

  let cursor = angleStart;
  for (const category of graph.categories) {
    const slice = usable * (category.count / total);
    category.angle0 = cursor;
    category.angle1 = cursor + slice;
    category.mid = cursor + slice / 2;
    cursor += slice + gap;

    const group = graph.byCategory.get(category.id) ?? [];
    const inset = slice * (group.length > 1 ? 0.07 : 0.5);
    group.forEach((project, index) => {
      const t = group.length === 1 ? 0.5 : index / (group.length - 1);
      project.angle = category.angle0 + inset + t * (slice - inset * 2);
      project.angleMin = category.angle0;
      project.angleMax = category.angle1;
      project.ring = projectR;
      project.r = 4.1 * scale;
      project.x = cx + project.ring * Math.cos(project.angle);
      project.y = cy + project.ring * Math.sin(project.angle);
    });
  }

  const methodSpanStart = angleStart + 0.1;
  const methodSpan = span - 0.2;
  const projectById = new Map(graph.projects.map((project) => [project.id, project]));
  for (const method of graph.methods) {
    const connected = method.projectIds
      .map((id) => projectById.get(id))
      .filter(Boolean);
    const bary =
      connected.reduce((sum, project) => sum + project.angle, 0) /
      Math.max(connected.length, 1);
    method.bary = bary;
  }
  graph.methods.sort((a, b) => a.bary - b.bary || a.label.localeCompare(b.label));
  graph.methods.forEach((method, index) => {
    const t =
      graph.methods.length === 1 ? 0.5 : index / (graph.methods.length - 1);
    method.angle = methodSpanStart + t * methodSpan;
    method.ring = innerR;
    method.r = (6.2 + 8.5 * Math.sqrt(method.count / maxMethod)) * scale;
    method.x = cx + method.ring * Math.cos(method.angle);
    method.y = cy + method.ring * Math.sin(method.angle);
  });

  return {
    cx,
    cy,
    innerR,
    projectR,
    bandInner,
    bandOuter,
    angleStart,
    angleEnd,
    outerR,
    scale,
  };
}

export function polar(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function wrapLines(text, max = 18) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}
