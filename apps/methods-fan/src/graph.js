import {
  symbol,
  symbolAsterisk,
  symbolCircle,
  symbolDiamond,
  symbolDiamond2,
  symbolPlus,
  symbolSquare,
  symbolSquare2,
  symbolStar,
  symbolTriangle,
  symbolTriangle2,
  symbolWye,
  symbolTimes,
} from "d3";

export const CATEGORY_ORDER = [
  "Transport",
  "Mobility and Transport",
  "City and community",
  "Health and wellbeing",
  "Work and workplace",
];

export const CATEGORY_COLORS = {
  Transport: "#a33b20",
  "Mobility and Transport": "#8a4f00",
  "City and community": "#2c5874",
  "Health and wellbeing": "#1e5a47",
  "Work and workplace": "#5a3c66",
};

export const CATEGORY_DASH = {
  Transport: "",
  "Mobility and Transport": "7 4",
  "City and community": "2.5 2.5",
  "Health and wellbeing": "10 3 3 3",
  "Work and workplace": "1.5 2.5",
};

const FALLBACK_COLOR = "#555";

export const METHOD_SHORT = {
  "Individual Interviews": "Interviews",
  "Observation": "Observation",
  "Desk Research": "Desk research",
  "Workshops": "Workshops",
  "Scenarios": "Scenarios",
  "Mapping": "Mapping",
  "Focus Groups": "Focus groups",
  "Mockups and Rapid Prototyping": "Mockups",
  "Co-Design": "Co-design",
  "Personas": "Personas",
  "Role Playing": "Role play",
  "Critical User Forums": "Forums",
};

const METHOD_MARK_SPEC = {
  "Individual Interviews": { type: symbolCircle, ink: "fill" },
  Observation: { type: symbolAsterisk, ink: "stroke" },
  "Desk Research": { type: symbolSquare, ink: "fill" },
  Workshops: { type: symbolWye, ink: "fill" },
  Scenarios: { type: symbolTriangle, ink: "fill" },
  Mapping: { type: symbolPlus, ink: "stroke" },
  "Focus Groups": { type: symbolDiamond, ink: "fill" },
  "Mockups and Rapid Prototyping": { type: symbolSquare2, ink: "stroke" },
  "Co-Design": { type: symbolStar, ink: "fill" },
  Personas: { type: symbolDiamond2, ink: "stroke" },
  "Role Playing": { type: symbolTriangle2, ink: "stroke" },
  "Critical User Forums": { type: symbolTimes, ink: "stroke" },
};

export function methodMark(name, size = 100) {
  const spec = METHOD_MARK_SPEC[name] ?? { type: symbolCircle, ink: "fill" };
  return {
    d: symbol().type(spec.type).size(size)(),
    ink: spec.ink,
  };
}

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
      r: 4,
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
          mark: methodMark(name, 100),
          count: 0,
          projectIds: [],
          r: 8,
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

export function buildRibbons(graph) {
  const projectById = new Map(graph.projects.map((project) => [project.id, project]));
  const ribbons = [];
  for (const method of graph.methods) {
    const byCat = new Map();
    for (const id of method.projectIds) {
      const project = projectById.get(id);
      if (!project) continue;
      byCat.set(project.category, (byCat.get(project.category) ?? 0) + 1);
    }
    for (const category of graph.categories) {
      const count = byCat.get(category.id);
      if (!count) continue;
      const projectIds = method.projectIds.filter((id) => {
        const project = projectById.get(id);
        return project?.category === category.id;
      });
      ribbons.push({
        id: `${method.id}→${category.id}`,
        methodId: method.id,
        categoryId: category.id,
        count,
        color: category.color,
        dash: CATEGORY_DASH[category.id] ?? "",
        method,
        category,
        projectIds,
      });
    }
  }
  return ribbons;
}

export function nodesForView(graph, zoomedCategory) {
  if (!zoomedCategory) return [...graph.methods, ...graph.categories];
  const projects = graph.byCategory.get(zoomedCategory) ?? [];
  const methodIds = new Set(projects.flatMap((project) => project.methodIds));
  return [
    ...graph.methods.filter((method) => methodIds.has(method.id)),
    ...projects,
  ];
}

export function linksForView(graph, zoomedCategory) {
  if (!zoomedCategory) {
    return buildRibbons(graph).map((ribbon) => ({
      id: ribbon.id,
      source: ribbon.methodId,
      target: ribbon.categoryId,
      count: ribbon.count,
      color: ribbon.color,
      dash: ribbon.dash,
      kind: "ribbon",
    }));
  }
  const allowed = new Set(
    (graph.byCategory.get(zoomedCategory) ?? []).map((project) => project.id),
  );
  return graph.links
    .filter((link) => allowed.has(link.target))
    .map((link) => ({ ...link, kind: "report" }));
}

function baseMetrics(width, height) {
  const padX = 86;
  const padTop = 56;
  const padBottom = 22;
  const cx = width / 2;
  const cy = height - padBottom;
  const outerR = Math.max(72, Math.min(cx - padX, cy - padTop));
  const innerR = outerR * 0.36;
  const categoryR = outerR * 0.68;
  const projectR = outerR * 0.8;
  const bandInner = outerR * 0.88;
  const bandOuter = outerR * 0.94;
  const angleStart = -Math.PI + 0.18;
  const angleEnd = -0.18;
  const scale = Math.max(0.72, Math.min(1.15, outerR / 280));
  return {
    cx,
    cy,
    innerR,
    categoryR,
    projectR,
    bandInner,
    bandOuter,
    angleStart,
    angleEnd,
    outerR,
    scale,
    span: angleEnd - angleStart,
  };
}

export function layoutGraph(graph, width, height, zoomedCategory = null) {
  const metrics = baseMetrics(width, height);
  placeCategorySectors(graph, metrics);
  if (zoomedCategory) {
    placeZoomed(graph, metrics, zoomedCategory);
  } else {
    placeOverview(graph, metrics);
  }
  return metrics;
}

function placeCategorySectors(graph, metrics) {
  const { angleStart, span } = metrics;
  const gap = Math.min(0.055, span * 0.04);
  const usable = span - gap * Math.max(0, graph.categories.length - 1);
  const total = graph.projects.length || 1;
  let cursor = angleStart;
  for (const category of graph.categories) {
    const slice = usable * (category.count / total);
    category.angle0 = cursor;
    category.angle1 = cursor + slice;
    category.mid = cursor + slice / 2;
    cursor += slice + gap;
  }
}

function placeOverview(graph, metrics) {
  const { cx, cy, categoryR, scale } = metrics;
  const maxCat = Math.max(...graph.categories.map((category) => category.count), 1);
  const maxMethod = Math.max(...graph.methods.map((method) => method.count), 1);

  for (const category of graph.categories) {
    category.angle = category.mid;
    category.ring = categoryR;
    category.r = (11 + 12 * Math.sqrt(category.count / maxCat)) * scale;
    category.x = cx + category.ring * Math.cos(category.angle);
    category.y = cy + category.ring * Math.sin(category.angle);
  }

  const counts = new Map();
  for (const ribbon of buildRibbons(graph)) {
    counts.set(
      `${ribbon.methodId}:${ribbon.categoryId}`,
      ribbon.count,
    );
  }
  graph.methods.forEach((method) => {
    let sum = 0;
    let weight = 0;
    for (const category of graph.categories) {
      const count = counts.get(`${method.id}:${category.id}`) ?? 0;
      if (!count) continue;
      sum += category.mid * count;
      weight += count;
    }
    method.bary = weight ? sum / weight : 0;
  });
  graph.methods.sort((a, b) => a.bary - b.bary || a.label.localeCompare(b.label));
  placeMethodNodes(
    graph.methods,
    metrics,
    (method) => method.count / maxMethod,
  );
}

function placeZoomed(graph, metrics, categoryId) {
  const { cx, cy, innerR, projectR, angleStart, angleEnd, span, scale } = metrics;
  const category = graph.categories.find((item) => item.id === categoryId);
  if (category) {
    category.angle0 = angleStart;
    category.angle1 = angleEnd;
    category.mid = (angleStart + angleEnd) / 2;
  }

  const projects = graph.byCategory.get(categoryId) ?? [];
  const inset = 0.1;
  projects.forEach((project, index) => {
    const t = projects.length === 1 ? 0.5 : index / (projects.length - 1);
    project.angle = angleStart + inset + t * (span - inset * 2);
    project.angleMin = angleStart;
    project.angleMax = angleEnd;
    project.ring = projectR;
    project.r = 5.4 * scale;
    project.x = cx + project.ring * Math.cos(project.angle);
    project.y = cy + project.ring * Math.sin(project.angle);
  });

  const methodIds = new Set(projects.flatMap((project) => project.methodIds));
  const methods = graph.methods.filter((method) => methodIds.has(method.id));
  const localCount = new Map();
  for (const project of projects) {
    for (const id of project.methodIds) {
      localCount.set(id, (localCount.get(id) ?? 0) + 1);
    }
  }
  const maxLocal = Math.max(...localCount.values(), 1);
  methods.forEach((method) => {
    const connected = projects.filter((project) =>
      project.methodIds.includes(method.id),
    );
    method.bary =
      connected.reduce((sum, project) => sum + project.angle, 0) /
      Math.max(connected.length, 1);
    method.localCount = localCount.get(method.id) ?? 0;
  });
  methods.sort((a, b) => a.bary - b.bary || a.label.localeCompare(b.label));
  placeMethodNodes(
    methods,
    metrics,
    (method) => (method.localCount || 1) / maxLocal,
  );
}

function placeMethodNodes(methods, metrics, sizeOf) {
  const { cx, cy, innerR, outerR, angleStart, span, scale } = metrics;
  const ringGap = Math.min(48, outerR * 0.15);
  const start = angleStart + 0.14;
  const methodSpan = span - 0.28;
  methods.forEach((method, index) => {
    const t = methods.length === 1 ? 0.5 : index / (methods.length - 1);
    method.angle = start + t * methodSpan;
    method.ring = innerR + (index % 2) * ringGap;
    method.r = Math.max(12, (10.5 + 3.8 * Math.sqrt(sizeOf(method))) * scale);
    method.labelIndex = index;
    method.x = cx + method.ring * Math.cos(method.angle);
    method.y = cy + method.ring * Math.sin(method.angle);
  });
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
