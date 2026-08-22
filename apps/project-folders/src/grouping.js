import { reports } from "@hhcd/data";

export const GROUPINGS = [
  {
    id: "theme",
    label: "Theme",
    hint: "Research area",
    description:
      "Magazine folders grouped by the report’s theme — health, work, city, and transport.",
  },
  {
    id: "year",
    label: "Year",
    hint: "When it was written",
    description:
      "The same 62 reports, re-shelved into year bands from 2000 to 2017.",
  },
  {
    id: "type",
    label: "Project type",
    hint: "What it produced",
    description:
      "Folders by output: concepts, prototypes, guidelines, business models, and campaigns.",
  },
];

export const YEAR_BUCKETS = [
  { id: "2000-2003", label: "2000–2003", min: 2000, max: 2003 },
  { id: "2004-2008", label: "2004–2008", min: 2004, max: 2008 },
  { id: "2009-2012", label: "2009–2012", min: 2009, max: 2012 },
  { id: "2013-2017", label: "2013–2017", min: 2013, max: 2017 },
];

/** Dark cover colours kept for any text UI that still names a theme. */
export const CATEGORY_PALETTE = [
  { label: "Health and wellbeing", color: "#8B1A1A", initial: "H" },
  { label: "Work and workplace", color: "#1E3A8A", initial: "W" },
  { label: "City and community", color: "#5B21B6", initial: "C" },
  { label: "Mobility and Transport", color: "#9A3412", initial: "M" },
  { label: "Transport", color: "#14532D", initial: "T" },
];

/** Jacket colours — mostly paper, with a few tints. Not mapped to theme. */
const COVER_POOL = [
  "#F4EFE6",
  "#F4EFE6",
  "#F4EFE6",
  "#F4EFE6",
  "#F4EFE6",
  "#F4EFE6",
  "#E8C4B8",
  "#C5D4E6",
  "#D2E3C8",
  "#EDD99A",
];

export function coverColorFor(reportNo) {
  const str = String(reportNo);
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return COVER_POOL[Math.abs(hash) % COVER_POOL.length];
}

const CATEGORY_BY_LABEL = new Map(
  CATEGORY_PALETTE.map((item) => [item.label, item]),
);

export function categoryStyle(category) {
  return (
    CATEGORY_BY_LABEL.get(category) ?? {
      label: category || "Other",
      color: "#3F3F46",
      initial: "?",
    }
  );
}

function yearBucket(year) {
  return (
    YEAR_BUCKETS.find((bucket) => year >= bucket.min && year <= bucket.max) ??
    YEAR_BUCKETS[YEAR_BUCKETS.length - 1]
  );
}

function sortReports(list) {
  return [...list].sort((a, b) => {
    const year = (a.year ?? 0) - (b.year ?? 0);
    if (year !== 0) return year;
    return String(a.title).localeCompare(String(b.title));
  });
}

export function groupReports(groupingId, source = reports) {
  const buckets = new Map();

  const ensure = (id, label, meta = {}) => {
    if (!buckets.has(id)) {
      buckets.set(id, { id, label, reports: [], ...meta });
    }
    return buckets.get(id);
  };

  for (const report of source) {
    if (groupingId === "year") {
      const bucket = yearBucket(report.year);
      ensure(`year:${bucket.id}`, bucket.label, {
        period: bucket.label,
      }).reports.push(report);
    } else if (groupingId === "type") {
      const type = report.projectType || "Unspecified";
      ensure(`type:${type}`, type).reports.push(report);
    } else {
      const category = report.category || "Unspecified";
      const style = categoryStyle(category);
      ensure(`theme:${category}`, category, {
        color: style.color,
        initial: style.initial,
      }).reports.push(report);
    }
  }

  const folders = [...buckets.values()].map((folder) => ({
    ...folder,
    reports: sortReports(folder.reports),
    count: folder.reports.length,
  }));

  if (groupingId === "year") {
    folders.sort(
      (a, b) =>
        YEAR_BUCKETS.findIndex((bucket) => `year:${bucket.id}` === a.id) -
        YEAR_BUCKETS.findIndex((bucket) => `year:${bucket.id}` === b.id),
    );
  } else if (groupingId === "type") {
    folders.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  } else {
    folders.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  return folders;
}

export function folderForReport(groupingId, reportNo, source = reports) {
  const folders = groupReports(groupingId, source);
  return (
    folders.find((folder) =>
      folder.reports.some((report) => report.reportNo === reportNo),
    ) ?? null
  );
}

export function findReport(reportNo, source = reports) {
  return source.find((report) => report.reportNo === reportNo) ?? null;
}

/**
 * Map a 0–2 scroll progress to a from/to grouping and a 0–1 morph t.
 * Holds at each chapter, then eases into the next.
 */
export function morphFromProgress(progress) {
  const p = Math.min(2, Math.max(0, progress));
  if (p <= 0.38) return { from: "theme", to: "theme", t: 0, grouping: "theme" };
  if (p < 0.62) {
    return {
      from: "theme",
      to: "year",
      t: (p - 0.38) / 0.24,
      grouping: p < 0.5 ? "theme" : "year",
    };
  }
  if (p <= 1.38) return { from: "year", to: "year", t: 0, grouping: "year" };
  if (p < 1.62) {
    return {
      from: "year",
      to: "type",
      t: (p - 1.38) / 0.24,
      grouping: p < 1.5 ? "year" : "type",
    };
  }
  return { from: "type", to: "type", t: 0, grouping: "type" };
}

export function progressForGrouping(groupingId) {
  if (groupingId === "year") return 1;
  if (groupingId === "type") return 2;
  return 0;
}
