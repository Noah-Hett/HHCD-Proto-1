export const Y_BANDS = [
  { id: 0, label: "Conceptual framework" },
  { id: 1, label: "Design guidelines / Policy guidelines" },
  { id: 2, label: "Business model / Design concepts" },
  { id: 3, label: "Physical prototypes" },
  { id: 4, label: "Products" },
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

function radius(count) {
  return Math.min(14, 5 + 3 * (count - 1));
}

function bandForProjectType(projectType) {
  if (!projectType) return undefined;
  return PROJECT_TYPE_TO_BAND[String(projectType).trim().toLowerCase()];
}

function colorGroupForCategory(category) {
  return COLOR_GROUPS.find((group) => group.categories.includes(category));
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

  const clusters = new Map();
  for (const item of mapped) {
    const key = `${item.report.year}|${item.yBand}|${item.colorGroup.id}`;
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        key,
        year: item.report.year,
        yBand: item.yBand,
        color: item.colorGroup.color,
        colorGroupId: item.colorGroup.id,
        colorLabel: item.colorGroup.label,
        reports: [],
      };
      clusters.set(key, cluster);
    }
    cluster.reports.push(item.report);
  }

  const dots = [...clusters.values()].map((cluster) => ({
    ...cluster,
    r: radius(cluster.reports.length),
  }));

  dots.sort((a, b) => b.r - a.r || a.year - b.year || a.yBand - b.yBand);

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
  const count = cluster.reports.length;
  const categories = [...new Set(cluster.reports.map((report) => report.category))];
  const categoryLabel =
    categories.length === 1 ? categories[0] : cluster.colorLabel;
  const bandLabel = Y_BANDS[cluster.yBand]?.label ?? "Unknown type";
  const noun = count === 1 ? "report" : "reports";
  return `${count} ${categoryLabel} ${noun}, ${cluster.year}, ${bandLabel}`;
}
