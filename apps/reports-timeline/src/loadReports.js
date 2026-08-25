import csvText from "../../../data/reports.csv?raw";

const COLUMN_COUNT = 16;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") continue;
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

function clean(value) {
  const text = (value ?? "").trim();
  return text || null;
}

function splitMethods(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toReport(row) {
  const cells = row.length >= COLUMN_COUNT ? row : [...row, ...Array(COLUMN_COUNT - row.length).fill("")];
  const yearRaw = clean(cells[4]);
  let year = null;
  if (yearRaw != null) {
    const parsed = Number(yearRaw);
    year = Number.isInteger(parsed) ? parsed : yearRaw;
  }
  return {
    reportNo: clean(cells[0]),
    category: clean(cells[1]),
    title: clean(cells[2]),
    author: clean(cells[3]),
    year,
    description: clean(cells[5]),
    projectType: clean(cells[6]),
    targetedUser: clean(cells[7]),
    findings: clean(cells[8]),
    outputs: clean(cells[9]),
    challenges: clean(cells[10]),
    budget: clean(cells[11]),
    methods: splitMethods(cells[12]),
    website: clean(cells[13]),
    partner: clean(cells[14]),
    connections: clean(cells[15]),
  };
}

const [header, ...dataRows] = parseCsv(csvText);
if (!header || header[0] !== "Report no.") {
  throw new Error("data/reports.csv is missing the expected header row");
}

export const reports = dataRows.map(toReport);

const years = reports.map((report) => report.year).filter((year) => typeof year === "number");

export const yearRange = {
  min: Math.min(...years),
  max: Math.max(...years),
};
