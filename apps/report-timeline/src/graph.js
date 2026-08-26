export const CATEGORY_GROUPS = [
  {
    id: "city-work",
    label: "City and community / Work and workplace",
    color: "#2563eb",
    match(category) {
      const value = (category || "").toLowerCase();
      return value === "city and community" || value === "work and workplace";
    },
  },
  {
    id: "health",
    label: "Health and wellbeing",
    color: "#dc2626",
    match(category) {
      return (category || "").toLowerCase() === "health and wellbeing";
    },
  },
  {
    id: "mobility",
    label: "Mobility and Transport / Transport",
    color: "#059669",
    match(category) {
      const value = (category || "").toLowerCase();
      return value === "mobility and transport" || value === "transport";
    },
  },
];

export const DETAIL_FIELDS = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "year", label: "Year" },
  { key: "reportNo", label: "Report no." },
  { key: "category", label: "Category" },
  { key: "projectType", label: "Project type" },
  { key: "description", label: "Description" },
  { key: "targetedUser", label: "Targeted user" },
  { key: "findings", label: "Findings" },
  { key: "outputs", label: "Outputs" },
  { key: "challenges", label: "Challenges" },
  { key: "budget", label: "Budget" },
  { key: "methods", label: "Methods" },
  { key: "website", label: "Website" },
  { key: "partner", label: "Partner / Sponsor" },
  { key: "connections", label: "Connections" },
];

export function colorForCategory(category) {
  return CATEGORY_GROUPS.find((group) => group.match(category))?.color ?? "#666666";
}

export function parseAuthorNames(author) {
  if (!author) return [];
  return author
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeAuthorName(name) {
  let value = String(name)
    .replace(/\bet al\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (value.includes(",")) {
    const [last, first] = value.split(",", 2);
    value = `${first.trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();
  }
  return value.toLowerCase();
}

export function parseConnectionIds(connections) {
  if (connections == null || connections === "") return [];
  return String(connections)
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part));
}

function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function buildGraph(reports) {
  const byNo = new Map(
    reports.filter((report) => report.reportNo).map((report) => [report.reportNo, report]),
  );

  const projectPairs = new Set();
  const skippedConnections = [];

  for (const report of reports) {
    for (const target of parseConnectionIds(report.connections)) {
      const other = byNo.get(target);
      if (!other) {
        skippedConnections.push({ from: report.uid, to: target });
        continue;
      }
      if (other.uid === report.uid) continue;
      projectPairs.add(pairKey(report.uid, other.uid));
    }
  }

  const authorIndex = new Map();
  for (const report of reports) {
    const names = new Set(parseAuthorNames(report.author).map(normalizeAuthorName).filter(Boolean));
    for (const name of names) {
      const list = authorIndex.get(name) ?? [];
      list.push(report);
      authorIndex.set(name, list);
    }
  }

  const authorPairs = new Set();
  for (const list of authorIndex.values()) {
    const unique = [...new Map(list.map((report) => [report.uid, report])).values()];
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        authorPairs.add(pairKey(unique[i].uid, unique[j].uid));
      }
    }
  }

  const edges = [];
  for (const key of new Set([...projectPairs, ...authorPairs])) {
    const [source, target] = key.split("::");
    const project = projectPairs.has(key);
    const author = authorPairs.has(key);
    if (project && author) {
      edges.push({ id: `${key}::project`, source, target, kind: "project", curve: 1 });
      edges.push({ id: `${key}::author`, source, target, kind: "author", curve: -1 });
    } else {
      edges.push({
        id: `${key}::${project ? "project" : "author"}`,
        source,
        target,
        kind: project ? "project" : "author",
        curve: 0,
      });
    }
  }

  const nodes = reports.map((report) => ({
    id: report.uid,
    report,
    year: report.year,
    color: colorForCategory(report.category),
  }));

  return { nodes, edges, skippedConnections };
}

export function neighborsOf(reportId, edges) {
  const nodeIds = new Set([reportId]);
  const edgeIds = new Set();
  for (const edge of edges) {
    if (edge.source === reportId || edge.target === reportId) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
      edgeIds.add(edge.id);
    }
  }
  return { nodeIds, edgeIds };
}

export function displayValue(report, key) {
  if (key === "reportNo") return report.reportNo || null;
  if (key === "methods") {
    if (Array.isArray(report.methods) && report.methods.length) {
      return report.methods.join(", ");
    }
    return null;
  }
  const value = report[key];
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  if (value == null || value === "") return null;
  return String(value);
}

export function websiteUrls(value) {
  if (!value) return [];
  return String(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part));
}
