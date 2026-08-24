function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
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
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function splitOpts(value) {
  const text = clean(value);
  if (!text) return [];
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

const HEADER_TO_FIELD = {
  "report no.": "reportNo",
  category: "category",
  "title [text]": "title",
  "author [text]": "author",
  year: "year",
  "description [text]": "description",
  "project type [options]": "projectType",
  "targeted user [text]": "targetedUser",
  "findings (what conclusions were drawn from the research?) [text]": "findings",
  "outputs (how were the findings applied?) [text]": "outputs",
  "challenges the project faced [text]": "challenges",
  "what kind of budget was it? [text]": "budget",
  "methods [options]": "methods",
  "website / links to videos [link]": "website",
  "partner/sponsor [text]": "partner",
};

const PREFIX_TO_FIELD = [
  ["report no", "reportNo"],
  ["title", "title"],
  ["author", "author"],
  ["description", "description"],
  ["project type", "projectType"],
  ["targeted user", "targetedUser"],
  ["findings", "findings"],
  ["outputs", "outputs"],
  ["challenges", "challenges"],
  ["what kind of budget", "budget"],
  ["methods", "methods"],
  ["website", "website"],
  ["partner", "partner"],
];

function fieldForHeader(header) {
  const key = String(header ?? "").trim().toLowerCase();
  if (!key) return null;
  if (HEADER_TO_FIELD[key]) return HEADER_TO_FIELD[key];
  const prefix = PREFIX_TO_FIELD.find(([start]) => key.startsWith(start));
  return prefix ? prefix[1] : null;
}

function parseYear(value) {
  const yearRaw = clean(value);
  if (!yearRaw) return null;
  const parsed = Number.parseInt(yearRaw, 10);
  return String(parsed) === yearRaw ? parsed : yearRaw;
}

export function parseReportsCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];

  const headers = rows[0].map(fieldForHeader);
  const body = rows.slice(1).filter((row) => row.some((cell) => clean(cell)));

  return body.map((row) => {
    const report = {
      reportNo: null,
      category: null,
      title: null,
      author: null,
      year: null,
      description: null,
      projectType: null,
      targetedUser: null,
      findings: null,
      outputs: null,
      challenges: null,
      budget: null,
      methods: [],
      website: null,
      partner: null,
    };

    headers.forEach((field, index) => {
      if (!field) return;
      const value = row[index];
      if (field === "year") {
        report.year = parseYear(value);
      } else if (field === "methods") {
        report.methods = splitOpts(value);
      } else {
        report[field] = clean(value);
      }
    });

    return report;
  });
}
