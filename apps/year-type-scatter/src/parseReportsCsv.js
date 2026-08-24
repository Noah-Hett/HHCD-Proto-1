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

export function parseReportsCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const body = rows.slice(1).filter((row) => row.some((cell) => clean(cell)));
  return body.map((row) => {
    const cells = [...row];
    while (cells.length < 17) cells.push("");
    const yearRaw = clean(cells[4]);
    let year = yearRaw;
    if (yearRaw) {
      const parsed = Number.parseInt(yearRaw, 10);
      if (String(parsed) === yearRaw) year = parsed;
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
      methods: splitOpts(cells[12]),
      website: clean(cells[13]),
      partner: clean(cells[14]),
      connections: clean(cells[15]),
      contact: clean(cells[16]),
    };
  });
}
