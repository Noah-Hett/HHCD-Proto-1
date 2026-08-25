export const CATEGORY_GROUPS = [
  {
    id: "city-work",
    label: "City and community / Work and workplace",
    color: "#4c8dde",
    match(category) {
      const value = (category || "").toLowerCase();
      return value === "city and community" || value === "work and workplace";
    },
  },
  {
    id: "health",
    label: "Health and wellbeing",
    color: "#e25b5b",
    match(category) {
      return (category || "").toLowerCase() === "health and wellbeing";
    },
  },
  {
    id: "mobility",
    label: "Mobility and transport",
    color: "#3ba56a",
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
  return CATEGORY_GROUPS.find((group) => group.match(category))?.color ?? "#888888";
}

export function parseAuthors(author) {
  if (!author) return [];
  return author
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseConnectionIds(connections) {
  if (connections == null || connections === "") return [];
  return String(connections)
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function buildLinks(reports) {
  const ids = new Set(reports.map((report) => report.reportNo));
  const reportPairs = new Set();
  const skippedConnections = [];

  for (const report of reports) {
    for (const target of parseConnectionIds(report.connections)) {
      if (target === report.reportNo) continue;
      if (!ids.has(target)) {
        skippedConnections.push({ from: report.reportNo, to: target });
        continue;
      }
      reportPairs.add(pairKey(report.reportNo, target));
    }
  }

  const namesById = new Map(
    reports.map((report) => [
      report.reportNo,
      new Set(parseAuthors(report.author).map((name) => name.toLowerCase())),
    ]),
  );

  const authorPairs = new Set();
  for (let i = 0; i < reports.length; i += 1) {
    const left = reports[i];
    const leftNames = namesById.get(left.reportNo);
    if (!leftNames.size) continue;
    for (let j = i + 1; j < reports.length; j += 1) {
      const right = reports[j];
      for (const name of namesById.get(right.reportNo)) {
        if (leftNames.has(name)) {
          authorPairs.add(pairKey(left.reportNo, right.reportNo));
          break;
        }
      }
    }
  }

  const links = [];
  for (const key of new Set([...reportPairs, ...authorPairs])) {
    const [source, target] = key.split("::");
    const reportConnection = reportPairs.has(key);
    const sharedAuthor = authorPairs.has(key);
    links.push({
      id: key,
      source,
      target,
      reportConnection,
      sharedAuthor,
      dual: reportConnection && sharedAuthor,
    });
  }

  return { links, skippedConnections };
}

export function neighborsOf(reportId, links) {
  const nodes = new Set([reportId]);
  const edgeIds = new Set();
  for (const link of links) {
    if (link.source === reportId || link.target === reportId) {
      nodes.add(link.source);
      nodes.add(link.target);
      edgeIds.add(link.id);
    }
  }
  return { nodes, edgeIds };
}

export function linkedReports(reportId, graphLinks, reportsById) {
  const items = [];
  for (const link of graphLinks) {
    if (link.source !== reportId && link.target !== reportId) continue;
    const otherId = link.source === reportId ? link.target : link.source;
    const report = reportsById.get(otherId);
    if (!report) continue;
    const reasons = [];
    if (link.reportConnection) reasons.push("project connection");
    if (link.sharedAuthor) reasons.push("shared author");
    items.push({ report, reasons });
  }
  items.sort((a, b) => a.report.title.localeCompare(b.report.title));
  return items;
}

export function displayValue(report, key) {
  if (key === "methods") {
    if (Array.isArray(report.methods) && report.methods.length) {
      return report.methods.join(", ");
    }
    if (typeof report.methods === "string" && report.methods) return report.methods;
    return null;
  }
  const value = report[key];
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  if (value == null || value === "") return null;
  return String(value);
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
