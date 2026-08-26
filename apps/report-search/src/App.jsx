import { useEffect, useMemo, useRef, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import {
  appliedChips,
  buildVocab,
  filterKey,
  search,
  highlightParts,
} from "./search.js";

const EXAMPLES = [
  "health interviews 2001",
  "urban lighting",
  "observation workplace",
  "taxi",
  "aging vertical city",
];

const vocab = buildVocab(reports);

function Marks({ text, terms }) {
  return highlightParts(text, terms).map((part, index) =>
    part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
  );
}

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function App() {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState({
    methods: [],
    categories: [],
    projectTypes: [],
    years: [],
  });
  const [suppressed, setSuppressed] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const result = useMemo(
    () => search(reports, query, { manual, suppressed, vocab }),
    [query, manual, suppressed],
  );

  useEffect(() => {
    const still = new Set(
      appliedChips(result.parsed.filters).map((chip) => chip.key),
    );
    setSuppressed((current) => {
      const next = current.filter((key) => still.has(key));
      return next.length === current.length ? current : next;
    });
  }, [query, result.parsed.filters]);

  useEffect(() => {
    setActive(0);
  }, [query, manual, suppressed]);

  useEffect(() => {
    function onKey(event) {
      const inInput = event.target === inputRef.current;
      if (event.key === "/" && !inInput && event.target.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (expanded) {
          setExpanded(null);
          return;
        }
        if (query || result.chips.length) {
          setQuery("");
          setManual({ methods: [], categories: [], projectTypes: [], years: [] });
          setSuppressed([]);
          inputRef.current?.focus();
        }
        return;
      }
      if (!result.results.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => Math.min(result.results.length - 1, index + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
      }
      if (event.key === "Enter" && !inInput) {
        const item = result.results[active];
        if (item) setExpanded((current) => (current === item.key ? null : item.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, expanded, query, result.chips.length, result.results]);

  function removeChip(chip) {
    if ((manual[chip.dimension] ?? []).some((value) => value === chip.value)) {
      setManual((current) => ({
        ...current,
        [chip.dimension]: current[chip.dimension].filter((value) => value !== chip.value),
      }));
      return;
    }
    setSuppressed((current) =>
      current.includes(chip.key) ? current : [...current, chip.key],
    );
  }

  function toggleFacet(dimension, value) {
    const key = filterKey(dimension, value);
    const applied = result.chips.some((chip) => chip.key === key);
    if (applied) {
      removeChip({ dimension, value, key });
      return;
    }
    setSuppressed((current) => current.filter((item) => item !== key));
    setManual((current) => ({
      ...current,
      [dimension]: toggleValue(current[dimension] ?? [], value),
    }));
  }

  function acceptSuggestion(item) {
    setSuppressed((current) => current.filter((key) => key !== item.key));
    setManual((current) => ({
      ...current,
      [item.dimension]: toggleValue(current[item.dimension] ?? [], item.value),
    }));
  }

  const terms = result.remainderTerms;

  return (
    <Shell title="Report search">
      <div className="search-page">
        <header className="hero">
          <p className="eyebrow">{reports.length} reports · 2000–2017</p>
          <h1>Search the catalogue by what you mean</h1>
          <p className="lede">
            Type a method, year, category, or any words from a project. Known
            catalogue values become filters; leftover words still search titles
            and descriptions.
          </p>
          <label className="search-box">
            <span className="sr-only">Search reports</span>
            <input
              ref={inputRef}
              type="search"
              autoFocus
              placeholder="health interviews 2001"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {result.chips.length > 0 && (
            <ul className="chips">
              {result.chips.map((chip) => (
                <li key={chip.key}>
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${chip.label}`}
                    onClick={() => removeChip(chip)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.suggestions.length > 0 && (
            <p className="suggest">
              Also filter by{" "}
              {result.suggestions.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => acceptSuggestion(item)}
                >
                  {item.dimension === "methods" ? "method" : item.dimension === "projectTypes" ? "type" : "category"}: {item.value}
                </button>
              ))}
            </p>
          )}
          {result.idle && (
            <p className="examples">
              Try{" "}
              {EXAMPLES.map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => {
                    setQuery(example);
                    inputRef.current?.focus();
                  }}
                >
                  {example}
                </button>
              ))}
            </p>
          )}
        </header>

        <div className="layout">
          <aside className="facets">
            <Facet
              title="Methods"
              items={result.facets.methods}
              applied={result.filters.methods}
              onToggle={(value) => toggleFacet("methods", value)}
            />
            <Facet
              title="Category"
              items={result.facets.categories}
              applied={result.filters.categories}
              onToggle={(value) => toggleFacet("categories", value)}
            />
            <Facet
              title="Year"
              items={result.facets.years}
              applied={result.filters.years}
              onToggle={(value) => toggleFacet("years", value)}
            />
            <Facet
              title="Project type"
              items={result.facets.projectTypes}
              applied={result.filters.projectTypes}
              onToggle={(value) => toggleFacet("projectTypes", value)}
            />
          </aside>

          <section className="results" aria-live="polite">
            <div className="list-head">
              <h2>
                {result.idle ? "All reports" : "Results"}
                <span> {result.results.length}</span>
              </h2>
              {!result.idle && (
                <button
                  type="button"
                  className="clear"
                  onClick={() => {
                    setQuery("");
                    setManual({
                      methods: [],
                      categories: [],
                      projectTypes: [],
                      years: [],
                    });
                    setSuppressed([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {result.results.length === 0 ? (
              <p className="empty">No reports match this search. Drop a filter or try another word.</p>
            ) : (
              <ul className="catalogue">
                {result.results.map((item, index) => (
                  <li
                    key={item.key}
                    className={
                      item.key === expanded
                        ? "open active"
                        : index === active
                          ? "active"
                          : ""
                    }
                  >
                    <button
                      type="button"
                      className="row"
                      onClick={() =>
                        setExpanded((current) => (current === item.key ? null : item.key))
                      }
                    >
                      <span className="year">{item.report.year ?? "—"}</span>
                      <div>
                        <strong>
                          <Marks text={item.report.title} terms={terms} />
                        </strong>
                        <p className="meta">
                          {item.report.author}
                          {item.report.projectType ? ` · ${item.report.projectType}` : ""}
                          {item.report.category ? ` · ${item.report.category}` : ""}
                        </p>
                        <p className="snippet">
                          <Marks text={item.snippet.text} terms={terms} />
                        </p>
                        {item.reasons.length > 0 && (
                          <p className="why">{item.reasons.join(" · ")}</p>
                        )}
                        {(item.report.methodsPrimary ?? []).length > 0 && (
                          <p className="method-tags">
                            {item.report.methodsPrimary.map((method) => (
                              <span key={method}>{method}</span>
                            ))}
                          </p>
                        )}
                      </div>
                    </button>
                    {item.key === expanded && (
                      <div className="detail">
                        <Detail label="Description" text={item.report.description} terms={terms} />
                        <Detail label="Findings" text={item.report.findings} terms={terms} />
                        <Detail label="Outputs" text={item.report.outputs} terms={terms} />
                        <Detail label="Partner" text={item.report.partner} terms={terms} />
                        <Detail label="Targeted user" text={item.report.targetedUser} terms={terms} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}

function Facet({ title, items, applied, onToggle }) {
  if (!items.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => {
          const active = applied.some(
            (value) => String(value).toLowerCase() === String(item.label).toLowerCase(),
          );
          return (
            <li key={String(item.label)}>
              <button
                type="button"
                className={active ? "active" : ""}
                onClick={() => onToggle(item.label)}
              >
                <span className="label">{item.label}</span>
                <span className="count">{item.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Detail({ label, text, terms }) {
  if (!text) return null;
  return (
    <p>
      <span>{label}</span>
      <Marks text={text} terms={terms} />
    </p>
  );
}
