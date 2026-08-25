const FIELD_BY_HEADER = {
  "Report no.": "reportNo",
  Category: "category",
  "Title [text]": "title",
  "Author [text]": "author",
  Year: "year",
  "Description [text]": "description",
  "Project type [options]": "projectType",
  "Targeted user [text]": "targetedUser",
  "Findings (What conclusions were drawn from the research?) [text]": "findings",
  "Outputs (How were the findings applied?) [text]": "outputs",
  "Challenges the project faced [text]": "challenges",
  "What kind of budget was it? [text]": "budget",
  "Methods [options]": "methods",
  "Website / Links to videos [link]": "website",
  "Partner/Sponsor [text]": "partner",
  "Connections to other projects [text]": "connections",
  "Connections [number]": "connections",
};

function isRowBreak(char) {
  return char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = String(text).replace(/^\uFEFF/, "");

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
      } else if (isRowBreak(char)) {
        field += " ";
        if (char === "\r" && source[i + 1] === "\n") i += 1;
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
    if (isRowBreak(char)) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => String(value).trim() !== ""));
}

function clean(value) {
  const text = String(value ?? "")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function splitMethods(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function fieldKeyForHeader(header) {
  if (FIELD_BY_HEADER[header]) return FIELD_BY_HEADER[header];
  if ((header || "").toLowerCase().startsWith("connections")) return "connections";
  return null;
}

function looksLikeUrl(value) {
  if (!value) return false;
  return /\bhttps?:\/\//i.test(value);
}

function toReport(row, header) {
  const record = {};
  for (let i = 0; i < header.length; i += 1) {
    const key = fieldKeyForHeader(header[i]);
    if (!key) continue;
    record[key] = row[i] ?? "";
  }

  const yearRaw = clean(record.year);
  let year = null;
  if (yearRaw != null) {
    const parsed = Number(yearRaw);
    year = Number.isInteger(parsed) ? parsed : yearRaw;
  }

  const website = clean(record.website);
  return {
    reportNo: clean(record.reportNo),
    category: clean(record.category),
    title: clean(record.title),
    author: clean(record.author),
    year,
    description: clean(record.description),
    projectType: clean(record.projectType),
    targetedUser: clean(record.targetedUser),
    findings: clean(record.findings),
    outputs: clean(record.outputs),
    challenges: clean(record.challenges),
    budget: clean(record.budget),
    methods: splitMethods(clean(record.methods)),
    website: looksLikeUrl(website) ? website : null,
    partner: clean(record.partner),
    connections: clean(record.connections),
  };
}

export function parseReports(csvText) {
  const [header, ...dataRows] = parseCsv(csvText);
  if (!header || header[0] !== "Report no.") {
    throw new Error("data/reports.csv is missing the expected header row");
  }

  return dataRows.map((row, index) => {
    const report = toReport(row, header);
    return {
      ...report,
      uid: report.reportNo ?? `row-${index}`,
    };
  });
}

export function yearRangeOf(reports) {
  const years = reports.map((report) => report.year).filter((year) => typeof year === "number");
  return {
    min: Math.min(...years),
    max: Math.max(...years),
  };
}
