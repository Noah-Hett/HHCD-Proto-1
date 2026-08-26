const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "and",
  "or",
  "with",
  "by",
  "at",
  "from",
]);

const FIELD_WEIGHTS = [
  ["title", 8],
  ["targetedUser", 5],
  ["author", 4],
  ["partner", 3],
  ["description", 3],
  ["findings", 2],
  ["outputs", 2],
  ["challenges", 1.5],
  ["projectType", 1.5],
  ["category", 1],
];

const METHOD_SYNONYMS = [
  ["individual interviews", "Individual Interviews"],
  ["interviews", "Individual Interviews"],
  ["interview", "Individual Interviews"],
  ["observation", "Observation"],
  ["observe", "Observation"],
  ["ethnography", "Observation"],
  ["ethnographic", "Observation"],
  ["desk research", "Desk Research"],
  ["literature review", "Desk Research"],
  ["literary research", "Desk Research"],
  ["literature", "Desk Research"],
  ["workshops", "Workshops"],
  ["workshop", "Workshops"],
  ["scenarios", "Scenarios"],
  ["scenario", "Scenarios"],
  ["mapping", "Mapping"],
  ["focus groups", "Focus Groups"],
  ["focus group", "Focus Groups"],
  ["mockups and rapid prototyping", "Mockups and Rapid Prototyping"],
  ["rapid prototyping", "Mockups and Rapid Prototyping"],
  ["mockups", "Mockups and Rapid Prototyping"],
  ["mockup", "Mockups and Rapid Prototyping"],
  ["co-design workshops", "Co-Design"],
  ["co-design", "Co-Design"],
  ["codesign", "Co-Design"],
  ["personas", "Personas"],
  ["persona", "Personas"],
  ["role playing", "Role Playing"],
  ["role-playing", "Role Playing"],
  ["critical user forums", "Critical User Forums"],
];

const CATEGORY_SYNONYMS = [
  ["health and wellbeing", "Health and wellbeing"],
  ["wellbeing", "Health and wellbeing"],
  ["wellness", "Health and wellbeing"],
  ["healthcare", "Health and wellbeing"],
  ["health", "Health and wellbeing"],
  ["work and workplace", "Work and workplace"],
  ["workplace", "Work and workplace"],
  ["office", "Work and workplace"],
  ["city and community", "City and community"],
  ["community", "City and community"],
  ["urban", "City and community"],
  ["city", "City and community"],
  ["mobility and transport", "Mobility and Transport"],
  ["mobility", "Mobility and Transport"],
];

const TYPE_SYNONYMS = [
  ["design concepts", "Design Concepts"],
  ["concepts", "Design Concepts"],
  ["physical prototypes", "Physical prototypes"],
  ["design guidelines", "Design guidelines"],
  ["guidelines", "Design guidelines"],
  ["business model", "Business model"],
  ["media campaign", "Media Campaign"],
  ["campaign", "Media Campaign"],
  ["conceptual framework", "Conceptual framework"],
  ["framework", "Conceptual framework"],
  ["policy guidelines", "Policy guidelines"],
  ["policy", "Policy guidelines"],
];

const EMPTY_FILTERS = () => ({
  methods: [],
  categories: [],
  projectTypes: [],
  years: [],
  yearRanges: [],
  reportNos: [],
  targetedUsers: [],
});

export function emptyFilters() {
  return EMPTY_FILTERS();
}

export function filterKey(dimension, value) {
  return `${dimension}:${value}`;
}

export function reportKey(report, index) {
  return report.reportNo ? `n-${report.reportNo}` : `i-${index}`;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stem(token) {
  const word = token.toLowerCase();
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map((token) => token.trim())
    .filter((token) => token && !STOPWORDS.has(token));
}

export function levenshtein(a, b) {
  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  if (left === right) return 0;
  const m = left.length;
  const n = right.length;
  if (Math.abs(m - n) > 2) return 99;
  const prev = new Array(n + 1);
  const next = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    next[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j += 1) prev[j] = next[j];
  }
  return prev[n];
}

function typoBudget(word) {
  if (word.length >= 8) return 2;
  if (word.length >= 4) return 1;
  return 0;
}

export const SENSES = [
  {
    label: "Growing older",
    seeds: ["age", "aging", "ageing", "older", "elderly", "dementia", "carehome", "care"],
  },
  {
    label: "Light and the city",
    seeds: ["light", "lighting", "night", "shade", "street", "urban"],
  },
  {
    label: "Moving through the city",
    seeds: ["transport", "mobility", "taxi", "airport", "wayfinding", "travel", "interchange", "bus"],
  },
  {
    label: "Work and the office",
    seeds: ["workplace", "office", "worker", "desk", "homeworking", "knowledge"],
  },
  {
    label: "Care and hospitals",
    seeds: ["patient", "hospital", "ambulance", "surgery", "nurse", "safety", "ward"],
  },
];

function documentText(report) {
  return [
    report.title,
    report.title,
    report.description,
    report.findings,
    report.outputs,
    report.targetedUser,
    report.author,
    report.partner,
    report.category,
    report.projectType,
    ...(report.methodsPrimary ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

const indexCache = new WeakMap();

export function buildIndex(reports) {
  const cached = indexCache.get(reports);
  if (cached) return cached;

  const docs = reports.map((report, index) => {
    const tokens = tokenize(documentText(report)).map(stem);
    const tf = new Map();
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    return { report, index, key: reportKey(report, index), tokens, tf };
  });

  const df = new Map();
  for (const doc of docs) {
    for (const token of doc.tf.keys()) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const n = docs.length || 1;
  const idf = new Map();
  for (const [token, count] of df) idf.set(token, Math.log((n + 1) / (count + 1)) + 1);

  const vectors = docs.map((doc) => {
    const vector = new Map();
    let norm = 0;
    for (const [token, freq] of doc.tf) {
      const weight = (1 + Math.log(freq)) * (idf.get(token) ?? 0);
      vector.set(token, weight);
      norm += weight * weight;
    }
    return { ...doc, vector, norm: Math.sqrt(norm) || 1 };
  });

  const dictionary = new Set();
  for (const token of idf.keys()) {
    if (token.length >= 4) dictionary.add(token);
  }

  const index = { vectors, idf, dictionary };
  indexCache.set(reports, index);
  return index;
}

function cosine(queryVector, doc) {
  let dot = 0;
  for (const [token, weight] of queryVector) {
    const other = doc.vector.get(token);
    if (other) dot += weight * other;
  }
  let qn = 0;
  for (const weight of queryVector.values()) qn += weight * weight;
  if (!dot) return 0;
  return dot / ((Math.sqrt(qn) || 1) * doc.norm);
}

export function closestWord(token, dictionary) {
  const stemmed = stem(token);
  let best = null;
  let bestDist = 99;
  for (const word of dictionary) {
    if (word[0] !== stemmed[0] && token[0] !== word[0]) continue;
    const dist = Math.min(levenshtein(token, word), levenshtein(stemmed, word));
    if (dist < bestDist) {
      best = word;
      bestDist = dist;
    }
    if (bestDist === 0) break;
  }
  return bestDist <= typoBudget(token) ? { word: best, distance: bestDist } : null;
}

export function correctTerms(terms, vocab, index) {
  const dictionary = new Set(index?.dictionary ?? []);
  for (const { label } of vocab.methods.values()) tokenize(label).forEach((item) => dictionary.add(stem(item)));
  for (const { label } of vocab.categories.values()) tokenize(label).forEach((item) => dictionary.add(stem(item)));
  for (const [phrase] of METHOD_SYNONYMS) tokenize(phrase).forEach((item) => dictionary.add(stem(item)));
  for (const [phrase] of CATEGORY_SYNONYMS) tokenize(phrase).forEach((item) => dictionary.add(stem(item)));
  for (const sense of SENSES) sense.seeds.forEach((seed) => dictionary.add(stem(seed)));

  const corrections = [];
  const expanded = [];
  for (const term of terms) {
    expanded.push(term);
    if (dictionary.has(term) || dictionary.has(stem(term))) continue;
    const hit = closestWord(term, dictionary);
    if (hit && hit.word !== stem(term) && hit.word !== term) {
      corrections.push({ from: term, to: hit.word });
      expanded.push(hit.word);
    }
  }
  return { corrections, expanded };
}

function makeQueryVector(terms, idf) {
  const tf = new Map();
  for (const term of terms) {
    const token = stem(term);
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const vector = new Map();
  for (const [token, freq] of tf) {
    vector.set(token, (1 + Math.log(freq)) * (idf.get(token) ?? 1.2));
  }
  return vector;
}

function sensesFor(terms) {
  const bag = new Set(terms.map(stem));
  const hits = [];
  for (const sense of SENSES) {
    const overlap = sense.seeds.filter((seed) => {
      const stemmed = stem(seed);
      if (bag.has(stemmed)) return true;
      return [...bag].some((term) => levenshtein(term, stemmed) <= typoBudget(term));
    });
    if (overlap.length) hits.push({ ...sense, overlap });
  }
  return hits;
}

function titleFuzzy(report, terms) {
  const titleTokens = tokenize(report.title);
  let score = 0;
  for (const term of terms) {
    const stemmed = stem(term);
    if (titleTokens.some((token) => token === term || stem(token) === stemmed)) {
      score += 1;
      continue;
    }
    if (titleTokens.some((token) => levenshtein(token, term) <= typoBudget(term))) {
      score += 0.7;
    }
  }
  return score;
}

function canonicalMethodLabel(label, vocab) {
  const lower = String(label).toLowerCase();
  const mapped = METHOD_SYNONYMS.find(([phrase]) => phrase === lower);
  if (mapped) return vocab?.methods.get(mapped[1].toLowerCase())?.label ?? mapped[1];
  return vocab?.methods.get(lower)?.label ?? label;
}

function preferLabel(current, next) {
  if (!current) return next;
  const score = (value) => (value.match(/[A-Z]/g) ?? []).length;
  return score(next) > score(current) ? next : current;
}

function addCount(map, label) {
  if (!label) return;
  const key = String(label).trim();
  if (!key) return;
  const existing = map.get(key.toLowerCase());
  if (existing) {
    existing.count += 1;
    existing.label = preferLabel(existing.label, key);
  } else {
    map.set(key.toLowerCase(), { label: key, count: 1 });
  }
}

export function buildVocab(reports) {
  const methods = new Map();
  const categories = new Map();
  const projectTypes = new Map();
  const targetedUsers = new Map();
  const years = new Set();
  const reportNos = new Set();

  for (const report of reports) {
    for (const method of report.methodsPrimary ?? []) addCount(methods, method);
    addCount(categories, report.category);
    addCount(projectTypes, report.projectType);
    addCount(targetedUsers, report.targetedUser);
    if (typeof report.year === "number") years.add(report.year);
    if (report.reportNo) reportNos.add(String(report.reportNo));
  }

  const yearList = [...years].sort((a, b) => a - b);
  return {
    methods,
    categories,
    projectTypes,
    targetedUsers,
    years,
    reportNos,
    yearMin: yearList[0] ?? 2000,
    yearMax: yearList.at(-1) ?? 2017,
  };
}

function pushUnique(list, value) {
  if (value == null || value === "") return;
  if (!list.includes(value)) list.push(value);
}

function consumeMatch(consumed, start, end) {
  for (let index = start; index < end; index += 1) consumed[index] = true;
}

function leftoverText(query, consumed) {
  let text = "";
  for (let index = 0; index < query.length; index += 1) {
    text += consumed[index] ? " " : query[index];
  }
  return text.replace(/\s+/g, " ").trim();
}

function collectPhrases(vocab) {
  const phrases = [];

  const add = (phrase, action) => {
    const normalized = phrase.toLowerCase().trim();
    if (!normalized) return;
    phrases.push({ phrase: normalized, words: tokenize(normalized), ...action });
  };

  const ambiguous = new Set([
    "transport",
    "transportation",
    "prototype",
    "prototypes",
    "prototyping",
  ]);
  for (const { label } of vocab.methods.values()) {
    if (ambiguous.has(label.toLowerCase())) continue;
    add(label, {
      kind: "filter",
      dimension: "methods",
      value: canonicalMethodLabel(label, vocab),
    });
  }
  for (const { label } of vocab.categories.values()) {
    add(label, { kind: "filter", dimension: "categories", value: label });
  }
  for (const { label } of vocab.projectTypes.values()) {
    add(label, { kind: "filter", dimension: "projectTypes", value: label });
  }
  for (const [phrase, value] of METHOD_SYNONYMS) {
    const canonical = vocab.methods.get(value.toLowerCase())?.label ?? value;
    add(phrase, { kind: "filter", dimension: "methods", value: canonical });
  }
  for (const [phrase, value] of CATEGORY_SYNONYMS) {
    add(phrase, { kind: "filter", dimension: "categories", value });
  }
  for (const [phrase, value] of TYPE_SYNONYMS) {
    add(phrase, { kind: "filter", dimension: "projectTypes", value });
  }
  for (const { label } of vocab.targetedUsers.values()) {
    if (tokenize(label).length < 2) continue;
    add(label, { kind: "filter", dimension: "targetedUsers", value: label });
  }

  add("transport", {
    kind: "suggest",
    options: [
      { dimension: "categories", value: "Mobility and Transport" },
      { dimension: "categories", value: "Transport" },
    ],
  });
  add("transportation", {
    kind: "suggest",
    options: [
      { dimension: "categories", value: "Mobility and Transport" },
      { dimension: "categories", value: "Transport" },
    ],
  });
  add("prototype", {
    kind: "suggest",
    options: [
      { dimension: "projectTypes", value: "Physical prototypes" },
      { dimension: "methods", value: "Mockups and Rapid Prototyping" },
    ],
  });
  add("prototypes", {
    kind: "suggest",
    options: [
      { dimension: "projectTypes", value: "Physical prototypes" },
      { dimension: "methods", value: "Mockups and Rapid Prototyping" },
    ],
  });
  add("prototyping", {
    kind: "suggest",
    options: [
      { dimension: "projectTypes", value: "Physical prototypes" },
      { dimension: "methods", value: "Mockups and Rapid Prototyping" },
    ],
  });

  phrases.sort(
    (a, b) =>
      b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase),
  );
  return phrases;
}

function findUnconsumed(query, consumed, phrase) {
  const lower = query.toLowerCase();
  let from = 0;
  while (from <= lower.length - phrase.length) {
    const index = lower.indexOf(phrase, from);
    if (index === -1) return -1;
    const end = index + phrase.length;
    const before = index === 0 ? " " : lower[index - 1];
    const after = end === lower.length ? " " : lower[end];
    const bounded = /[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after);
    let free = bounded;
    if (free) {
      for (let pos = index; pos < end; pos += 1) {
        if (consumed[pos]) {
          free = false;
          break;
        }
      }
    }
    if (free) return index;
    from = index + 1;
  }
  return -1;
}

export function parseQuery(query, vocab) {
  const filters = EMPTY_FILTERS();
  const suggestions = [];
  const raw = String(query ?? "");
  const consumed = new Array(raw.length).fill(false);

  const noteSuggestion = (option) => {
    const key = filterKey(option.dimension, option.value);
    if (!suggestions.some((item) => item.key === key)) {
      suggestions.push({ ...option, key });
    }
  };

  const takeYear = (year) =>
    year >= vocab.yearMin && year <= vocab.yearMax ? year : null;

  for (const match of raw.matchAll(/\b(\d{4})\s*[-–to]{1,3}\s*(\d{4})\b/gi)) {
    const from = takeYear(Number(match[1]));
    const to = takeYear(Number(match[2]));
    if (from != null && to != null) {
      filters.yearRanges.push({ from: Math.min(from, to), to: Math.max(from, to) });
      consumeMatch(consumed, match.index, match.index + match[0].length);
    }
  }

  for (const match of raw.matchAll(/\b(?:after|since|from)\s+(\d{4})\b/gi)) {
    const from = takeYear(Number(match[1]));
    if (from != null) {
      filters.yearRanges.push({ from, to: vocab.yearMax });
      consumeMatch(consumed, match.index, match.index + match[0].length);
    }
  }

  for (const match of raw.matchAll(/\b(?:before|until|up to)\s+(\d{4})\b/gi)) {
    const to = takeYear(Number(match[1]));
    if (to != null) {
      filters.yearRanges.push({ from: vocab.yearMin, to });
      consumeMatch(consumed, match.index, match.index + match[0].length);
    }
  }

  for (const match of raw.matchAll(/\bearly 2000s\b/gi)) {
    filters.yearRanges.push({ from: 2000, to: 2004 });
    consumeMatch(consumed, match.index, match.index + match[0].length);
  }
  for (const match of raw.matchAll(/\blate 2000s\b/gi)) {
    filters.yearRanges.push({ from: 2005, to: 2009 });
    consumeMatch(consumed, match.index, match.index + match[0].length);
  }

  for (const match of raw.matchAll(/\b(19|20)\d{2}\b/g)) {
    if (consumed[match.index]) continue;
    const year = takeYear(Number(match[0]));
    if (year != null) {
      pushUnique(filters.years, year);
      consumeMatch(consumed, match.index, match.index + match[0].length);
    }
  }

  for (const match of raw.matchAll(/(?:#|report\s+|no\.?\s+)(\d+)\b/gi)) {
    const id = match[1];
    if (vocab.reportNos.has(id)) {
      pushUnique(filters.reportNos, id);
      consumeMatch(consumed, match.index, match.index + match[0].length);
    }
  }

  for (const item of collectPhrases(vocab)) {
    const index = findUnconsumed(raw, consumed, item.phrase);
    if (index === -1) continue;
    if (item.kind === "filter") {
      consumeMatch(consumed, index, index + item.phrase.length);
      pushUnique(filters[item.dimension], item.value);
    } else {
      for (const option of item.options) noteSuggestion(option);
    }
  }

  const remainder = leftoverText(raw, consumed);
  const remainderTerms = tokenize(remainder).filter((token) => !/^\d{4}$/.test(token));

  return { query: raw, filters, suggestions, remainder, remainderTerms };
}

export function mergeFilters(parsed, manual = {}, suppressed = []) {
  const blocked = new Set(suppressed);
  const merged = EMPTY_FILTERS();
  const source = [parsed.filters, manual];
  for (const bag of source) {
    if (!bag) continue;
    for (const dimension of Object.keys(merged)) {
      for (const value of bag[dimension] ?? []) {
        const key =
          dimension === "yearRanges"
            ? filterKey(dimension, `${value.from}-${value.to}`)
            : filterKey(dimension, value);
        if (blocked.has(key)) continue;
        if (dimension === "yearRanges") {
          if (
            !merged.yearRanges.some(
              (range) => range.from === value.from && range.to === value.to,
            )
          ) {
            merged.yearRanges.push(value);
          }
        } else {
          pushUnique(merged[dimension], value);
        }
      }
    }
  }
  return merged;
}

function methodsOf(report) {
  return (report.methodsPrimary ?? []).map((method) =>
    canonicalMethodLabel(method).toLowerCase(),
  );
}

function yearInFilters(year, filters) {
  if (typeof year !== "number") return filters.years.length === 0 && filters.yearRanges.length === 0;
  const yearOk =
    filters.years.length === 0 || filters.years.includes(year);
  const rangeOk =
    filters.yearRanges.length === 0 ||
    filters.yearRanges.some((range) => year >= range.from && year <= range.to);
  return yearOk && rangeOk;
}

export function reportMatches(report, filters) {
  if (filters.reportNos.length && !filters.reportNos.includes(String(report.reportNo ?? ""))) {
    return false;
  }
  if (!yearInFilters(report.year, filters)) return false;
  if (
    filters.categories.length &&
    !filters.categories.some(
      (label) => (report.category ?? "").toLowerCase() === label.toLowerCase(),
    )
  ) {
    return false;
  }
  if (
    filters.projectTypes.length &&
    !filters.projectTypes.some(
      (label) => (report.projectType ?? "").toLowerCase() === label.toLowerCase(),
    )
  ) {
    return false;
  }
  if (filters.methods.length) {
    const have = methodsOf(report);
    const ok = filters.methods.every((method) => have.includes(method.toLowerCase()));
    if (!ok) return false;
  }
  if (filters.targetedUsers.length) {
    const user = (report.targetedUser ?? "").toLowerCase();
    const ok = filters.targetedUsers.some((label) => user.includes(label.toLowerCase()));
    if (!ok) return false;
  }
  return true;
}

function fieldBlob(report) {
  return FIELD_WEIGHTS.map(([field]) => String(report[field] ?? "")).join("\n");
}

export function scoreReport(report, remainderTerms) {
  if (!remainderTerms.length) return { score: 1, hits: [] };
  const hits = [];
  let score = 0;
  for (const term of remainderTerms) {
    const stemmed = stem(term);
    let termHits = 0;
    for (const [field, weight] of FIELD_WEIGHTS) {
      const text = String(report[field] ?? "");
      if (!text) continue;
      const tokens = tokenize(text);
      const found = tokens.some(
        (token) => token === term || stem(token) === stemmed || token.includes(term),
      );
      if (found) {
        score += weight;
        termHits += 1;
        hits.push({ field, term });
      }
    }
    const methodsHit = (report.methodsPrimary ?? []).some((method) => {
      const tokens = tokenize(method);
      return tokens.some((token) => token === term || stem(token) === stemmed);
    });
    if (methodsHit) {
      score += 2;
      hits.push({ field: "methodsPrimary", term });
      termHits += 1;
    }
    if (String(report.reportNo ?? "") === term) {
      score += 12;
      hits.push({ field: "reportNo", term });
      termHits += 1;
    }
    if (termHits === 0) {
      const blob = fieldBlob(report).toLowerCase();
      if (!blob.includes(term) && !tokenize(blob).some((token) => stem(token) === stemmed)) {
        return { score: 0, hits: [] };
      }
    }
  }

  const phrase = remainderTerms.join(" ");
  if (remainderTerms.length > 1 && fieldBlob(report).toLowerCase().includes(phrase)) {
    score += 6;
  }

  return { score, hits };
}

export function highlightParts(text, terms) {
  const value = String(text ?? "");
  if (!value || !terms.length) return [{ text: value, hit: false }];
  const unique = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "ig");
  const parts = [];
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > last) {
      parts.push({ text: value.slice(last, match.index), hit: false });
    }
    parts.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
  }
  if (last < value.length) parts.push({ text: value.slice(last), hit: false });
  return parts.length ? parts : [{ text: value, hit: false }];
}

function snippetFrom(text, terms, fallback) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return fallback;
  if (!terms.length) {
    return value.length > 180 ? `${value.slice(0, 177)}…` : value;
  }
  const lower = value.toLowerCase();
  let index = -1;
  for (const term of terms) {
    const at = lower.indexOf(term.toLowerCase());
    if (at !== -1 && (index === -1 || at < index)) index = at;
  }
  if (index === -1) {
    return value.length > 180 ? `${value.slice(0, 177)}…` : value;
  }
  const start = Math.max(0, index - 70);
  const end = Math.min(value.length, index + 110);
  const slice = `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
  return slice;
}

export function snippetFor(report, remainderTerms, hits) {
  const preferred = hits[0]?.field;
  const order = preferred
    ? [preferred, "description", "findings", "outputs", "title", "targetedUser"]
    : ["description", "findings", "outputs", "title"];
  for (const field of order) {
    if (field === "methodsPrimary" || field === "reportNo") continue;
    const text = report[field];
    if (!text) continue;
    return { field, text: snippetFrom(text, remainderTerms, String(text)) };
  }
  return { field: "description", text: report.description ?? "" };
}

function whyMatched(report, filters, hits) {
  const reasons = [];
  for (const method of filters.methods) {
    if (methodsOf(report).includes(method.toLowerCase())) {
      reasons.push(`method ${method}`);
    }
  }
  for (const category of filters.categories) {
    if ((report.category ?? "").toLowerCase() === category.toLowerCase()) {
      reasons.push(category);
    }
  }
  if (filters.years.includes(report.year)) reasons.push(String(report.year));
  for (const range of filters.yearRanges) {
    if (report.year >= range.from && report.year <= range.to) {
      reasons.push(`${range.from}–${range.to}`);
    }
  }
  for (const type of filters.projectTypes) {
    if ((report.projectType ?? "").toLowerCase() === type.toLowerCase()) {
      reasons.push(type);
    }
  }
  const seen = new Set();
  for (const hit of hits) {
    if (seen.has(hit.term)) continue;
    seen.add(hit.term);
    const where =
      hit.field === "title"
        ? "title"
        : hit.field === "targetedUser"
          ? "targeted user"
          : hit.field === "author"
            ? "author"
            : hit.field === "description"
              ? "description"
              : hit.field;
    reasons.push(`“${hit.term}” in ${where}`);
  }
  return reasons.slice(0, 5);
}

export function countFacets(reports) {
  const methods = new Map();
  const categories = new Map();
  const projectTypes = new Map();
  const years = new Map();
  const bump = (map, label) => {
    if (!label) return;
    const existing = map.get(String(label).toLowerCase());
    if (existing) {
      existing.count += 1;
      existing.label = preferLabel(existing.label, String(label));
    } else {
      map.set(String(label).toLowerCase(), { label: String(label), count: 1 });
    }
  };
  for (const report of reports) {
    for (const method of report.methodsPrimary ?? []) bump(methods, method.trim());
    bump(categories, report.category);
    bump(projectTypes, report.projectType);
    if (typeof report.year === "number") {
      years.set(report.year, (years.get(report.year) ?? 0) + 1);
    }
  }
  return {
    methods: [...methods.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
    categories: [...categories.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
    projectTypes: [...projectTypes.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
    years: [...years.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label - b.label),
  };
}

export function appliedChips(filters) {
  const chips = [];
  for (const value of filters.methods) {
    chips.push({ dimension: "methods", value, label: `Method: ${value}` });
  }
  for (const value of filters.categories) {
    chips.push({ dimension: "categories", value, label: `Category: ${value}` });
  }
  for (const value of filters.projectTypes) {
    chips.push({ dimension: "projectTypes", value, label: `Type: ${value}` });
  }
  for (const value of filters.years) {
    chips.push({ dimension: "years", value, label: `Year: ${value}` });
  }
  for (const value of filters.yearRanges) {
    chips.push({
      dimension: "yearRanges",
      value,
      label: `Years: ${value.from}–${value.to}`,
    });
  }
  for (const value of filters.reportNos) {
    chips.push({ dimension: "reportNos", value, label: `Report ${value}` });
  }
  for (const value of filters.targetedUsers) {
    chips.push({ dimension: "targetedUsers", value, label: `User: ${value}` });
  }
  return chips.map((chip) => ({
    ...chip,
    key:
      chip.dimension === "yearRanges"
        ? filterKey("yearRanges", `${chip.value.from}-${chip.value.to}`)
        : filterKey(chip.dimension, chip.value),
  }));
}

export function search(reports, query, { manual, suppressed, vocab, index } = {}) {
  const lexicon = vocab ?? buildVocab(reports);
  const corpus = index ?? buildIndex(reports);
  const parsed = parseQuery(query, lexicon);
  const filters = mergeFilters(parsed, manual, suppressed);
  const chips = appliedChips(filters);
  const suggestions = parsed.suggestions.filter(
    (item) => !chips.some((chip) => chip.key === item.key),
  );

  const rawTerms = [
    ...parsed.remainderTerms,
    ...filters.methods.flatMap((label) => tokenize(label)),
    ...filters.categories.flatMap((label) => tokenize(label)),
    ...filters.projectTypes.flatMap((label) => tokenize(label)),
    ...filters.targetedUsers.flatMap((label) => tokenize(label)),
    ...filters.years.map(String),
  ];
  const { corrections, expanded } = correctTerms(rawTerms, lexicon, corpus);
  const senses = sensesFor(expanded);
  const senseTerms = senses.flatMap((sense) => sense.seeds);
  const highlightTerms = [...new Set([...expanded, ...corrections.map((item) => item.to)])];
  const vector = makeQueryVector([...expanded, ...senseTerms], corpus.idf);

  const idle = !String(query ?? "").trim() && chips.length === 0;
  const ranked = corpus.vectors.map((doc) => {
    const report = doc.report;
    const { hits } = scoreReport(report, highlightTerms);
    let score = cosine(vector, doc) * 6;
    score += titleFuzzy(report, highlightTerms) * 2.4;
    if (filters.methods.length) {
      const have = methodsOf(report);
      score += filters.methods.some((method) => have.includes(method.toLowerCase())) ? 1.8 : 0;
    }
    if (filters.categories.length) {
      score += filters.categories.some(
        (label) => (report.category ?? "").toLowerCase() === label.toLowerCase(),
      )
        ? 1.4
        : 0;
    }
    if (filters.projectTypes.length) {
      score += filters.projectTypes.some(
        (label) => (report.projectType ?? "").toLowerCase() === label.toLowerCase(),
      )
        ? 1.1
        : 0;
    }
    if (yearInFilters(report.year, filters) && (filters.years.length || filters.yearRanges.length)) {
      score += 1.2;
    }
    if (filters.reportNos.includes(String(report.reportNo ?? ""))) score += 8;
    if (filters.targetedUsers.length) {
      const user = (report.targetedUser ?? "").toLowerCase();
      if (filters.targetedUsers.some((label) => user.includes(label.toLowerCase()))) score += 1.6;
    }
    return {
      report,
      index: doc.index,
      key: doc.key,
      score,
      hits,
      snippet: snippetFor(report, highlightTerms, hits),
      reasons: whyMatched(report, filters, hits),
    };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.report.year ?? 0) - (a.report.year ?? 0) ||
      String(a.report.title).localeCompare(String(b.report.title)),
  );

  const max = ranked[0]?.score ?? 0;
  const hotCut = Math.max(0.22, max * 0.38);
  const pops = idle ? [] : ranked.filter((item) => item.score >= hotCut).slice(0, 8);
  const popKeys = new Set(pops.map((item) => item.key));
  const nearby = idle
    ? []
    : ranked
        .filter((item) => !popKeys.has(item.key) && item.score > 0.12)
        .slice(0, 4);
  const all = ranked.map((item) => ({
    ...item,
    glow: popKeys.has(item.key) ? "hot" : item.score > 0.12 ? "warm" : "quiet",
  }));

  const themes = [];
  for (const sense of senses) {
    themes.push({ kind: "sense", label: sense.label, value: sense.seeds[0] });
  }
  for (const chip of chips) {
    themes.push({ kind: "heard", label: chip.label.replace(/^(Method|Category|Type|Year|Years|Report|User): /, ""), value: chip.value, key: chip.key });
  }
  for (const item of suggestions) {
    themes.push({
      kind: "maybe",
      label: item.value,
      value: item.value,
      key: item.key,
    });
  }

  return {
    parsed,
    filters,
    chips,
    suggestions,
    corrections,
    themes,
    remainderTerms: highlightTerms,
    highlightTerms,
    results: idle ? ranked : pops,
    pops,
    nearby,
    all,
    idle,
  };
}
