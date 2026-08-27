export const Y_BANDS = [
  { id: 0, label: "Conceptual framework" },
  { id: 1, label: "Design guidelines / Policy guidelines" },
  { id: 2, label: "Business model / Design concepts" },
  { id: 3, label: "Physical prototypes" },
  { id: 4, label: "Products / Media campaign" },
];

const PROJECT_TYPE_TO_BAND = {
  "conceptual framework": 0,
  "design guidelines": 1,
  "policy guidelines": 1,
  "business model": 2,
  "design concepts": 2,
  "physical prototypes": 3,
  "products": 4,
  "media campaign": 4,
};

export const COLOR_GROUPS = [
  {
    id: "city-work",
    label: "City and community / Work and workplace",
    color: "#1e88e5",
    categories: ["City and community", "Work and workplace"],
  },
  {
    id: "health",
    label: "Health and wellbeing",
    color: "#e53935",
    categories: ["Health and wellbeing"],
  },
  {
    id: "mobility",
    label: "Mobility and transport",
    color: "#43a047",
    categories: ["Mobility and Transport", "Transport"],
  },
];

const DOT_R = 6;

function bandForProjectType(projectType) {
  if (!projectType) return undefined;
  return PROJECT_TYPE_TO_BAND[String(projectType).trim().toLowerCase()];
}

function colorGroupForCategory(category) {
  return COLOR_GROUPS.find((group) => group.categories.includes(category));
}

const COLOR_ORDER = Object.fromEntries(
  COLOR_GROUPS.map((group, index) => [group.id, index]),
);

function neighborGap(left, right) {
  const overlapped = 0.55 * (left.r + right.r);
  const unobscured = Math.abs(left.r - right.r) + 3;
  return Math.max(overlapped, unobscured);
}

function centerYs(group) {
  if (group.length === 1) return [0];
  const ys = [0];
  for (let i = 0; i < group.length - 1; i += 1) {
    ys.push(ys[i] + neighborGap(group[i], group[i + 1]));
  }
  const mid = (ys[0] + ys[ys.length - 1]) / 2;
  return ys.map((y) => y - mid);
}

function assignCellOffsets(dots) {
  const cells = new Map();
  for (const dot of dots) {
    const members = cells.get(dot.cellKey);
    if (members) members.push(dot);
    else cells.set(dot.cellKey, [dot]);
  }

  for (const group of cells.values()) {
    group.sort(
      (a, b) =>
        COLOR_ORDER[a.colorGroupId] - COLOR_ORDER[b.colorGroupId] ||
        String(a.key).localeCompare(String(b.key), undefined, { numeric: true }),
    );
    const ys = centerYs(group);
    group.forEach((dot, index) => {
      dot.dx = 0;
      dot.dy = ys[index];
    });
  }
}

export function mapReports(reports) {
  const unmapped = [];
  const mapped = [];

  for (const report of reports) {
    const yBand = bandForProjectType(report.projectType);
    const colorGroup = colorGroupForCategory(report.category);
    if (typeof report.year !== "number" || yBand === undefined || !colorGroup) {
      unmapped.push(report);
      continue;
    }
    mapped.push({ report, yBand, colorGroup });
  }

  const dots = mapped.map((item) => ({
    key: item.report.reportNo,
    year: item.report.year,
    yBand: item.yBand,
    color: item.colorGroup.color,
    colorGroupId: item.colorGroup.id,
    colorLabel: item.colorGroup.label,
    reports: [item.report],
    cellKey: `${item.report.year}|${item.yBand}`,
    r: DOT_R,
    dx: 0,
    dy: 0,
  }));

  assignCellOffsets(dots);

  dots.sort(
    (a, b) =>
      a.year - b.year ||
      a.yBand - b.yBand ||
      COLOR_ORDER[a.colorGroupId] - COLOR_ORDER[b.colorGroupId] ||
      String(a.key).localeCompare(String(b.key), undefined, { numeric: true }),
  );

  const years = mapped.map((item) => item.report.year);

  return {
    clusters: dots,
    plottedCount: mapped.length,
    unmappedCount: unmapped.length,
    yearMin: years.length ? Math.min(...years) : 2000,
    yearMax: years.length ? Math.max(...years) : 2017,
  };
}

export function clusterAriaLabel(cluster) {
  const report = cluster.reports[0];
  const title = report?.title?.trim() || "Untitled report";
  const bandLabel = Y_BANDS[cluster.yBand]?.label ?? "Unknown type";
  return `${title}, ${cluster.year}, ${bandLabel}`;
}
