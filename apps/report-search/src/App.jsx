import { useEffect, useMemo, useRef, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { buildIndex, buildVocab, highlightParts, search } from "./search.js";

const PROMPTS = [
  "growing older",
  "light at night",
  "waiting at the airport",
  "working from home",
  "how people move",
];

const vocab = buildVocab(reports);
const index = buildIndex(reports);

function Marks({ text, terms }) {
  return highlightParts(text, terms).map((part, i) =>
    part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);
  const popItemsRef = useRef([]);

  const result = useMemo(
    () => search(reports, query, { vocab, index }),
    [query],
  );

  const popItems = useMemo(() => {
    const items = [];
    for (const item of result.pops) items.push({ type: "report", key: `p-${item.key}`, item });
    for (const item of result.nearby) items.push({ type: "nearby", key: `n-${item.key}`, item });
    return items;
  }, [result.pops, result.nearby]);
  popItemsRef.current = popItems;

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    function onKey(event) {
      const items = popItemsRef.current;
      if (event.key === "/" && event.target.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (selected) {
          setSelected(null);
          return;
        }
        if (query) {
          setQuery("");
          inputRef.current?.focus();
        }
        return;
      }
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => Math.min(items.length - 1, value + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => Math.max(0, value - 1));
      }
      if (event.key === "Enter") {
        const current = items[active];
        if (current?.item) {
          event.preventDefault();
          setSelected(current.item.key);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, query, selected]);

  const selectedReport =
    result.all.find((item) => item.key === selected)?.report ??
    reports.find((report, i) => (report.reportNo ? `n-${report.reportNo}` : `i-${i}`) === selected);

  const terms = result.highlightTerms;
  const open = !result.idle;

  function applyPrompt(text) {
    setQuery(text);
    setSelected(null);
    inputRef.current?.focus();
  }

  return (
    <Shell title="Report search">
      <div className="stage">
        <div className="omni">
          <p className="eyebrow">{reports.length} reports to wander through</p>
          <h1>What are you curious about?</h1>
          <p className="lede">
            Ask the way you would a person — lighting, growing older, taxis.
            Close matches float up; everything else stays on the table.
          </p>
          <div className="float">
            <label className="search-box">
              <span className="sr-only">Search reports</span>
              <input
                ref={inputRef}
                type="search"
                autoFocus
                placeholder="lighting, growing older, how people wait…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-expanded={open}
                aria-controls="search-pop"
              />
            </label>
            {open && (
              <div className="pop" id="search-pop" role="listbox">
                {result.corrections.length > 0 && (
                  <p className="didyou">
                    Treating{" "}
                    {result.corrections.map((item, i) => (
                      <span key={item.from}>
                        {i ? ", " : ""}
                        <s>{item.from}</s> as <button type="button" onClick={() => applyPrompt(item.to)}>{item.to}</button>
                      </span>
                    ))}
                  </p>
                )}
                {result.themes.length > 0 && (
                  <div className="heard">
                    {result.themes.map((theme) => (
                      <button
                        type="button"
                        key={`${theme.kind}-${theme.label}`}
                        onClick={() => applyPrompt(String(theme.value ?? theme.label))}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                )}
                {result.pops.length > 0 && (
                  <section>
                    <h2>Close by</h2>
                    <ul>
                      {result.pops.map((item, index) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            className={index === active ? "on" : ""}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => setSelected(item.key)}
                          >
                            <span className="year">{item.report.year ?? "—"}</span>
                            <span>
                              <strong>
                                <Marks text={item.report.title} terms={terms} />
                              </strong>
                              <em>
                                <Marks text={item.snippet.text} terms={terms} />
                              </em>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {result.nearby.length > 0 && (
                  <section>
                    <h2>In the same neighbourhood</h2>
                    <ul>
                      {result.nearby.map((item, index) => {
                        const pos = result.pops.length + index;
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              className={pos === active ? "on" : ""}
                              onMouseEnter={() => setActive(pos)}
                              onClick={() => setSelected(item.key)}
                            >
                              <span className="year">{item.report.year ?? "—"}</span>
                              <span>
                                <strong>
                                  <Marks text={item.report.title} terms={terms} />
                                </strong>
                                <em>{item.report.category}</em>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {result.pops.length === 0 && (
                  <p className="empty">Nothing close yet — try a place, a feeling, or a way of working.</p>
                )}
              </div>
            )}
          </div>
          {result.idle && (
            <p className="prompts">
              {PROMPTS.map((prompt) => (
                <button type="button" key={prompt} onClick={() => applyPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </p>
          )}
        </div>

        <div className="body">
          <ul className={`field ${open ? "searching" : ""}`}>
            {result.all.map((item) => (
              <li key={item.key} className={`${item.glow}${item.key === selected ? " picked" : ""}`}>
                <button type="button" onClick={() => setSelected(item.key)}>
                  <span className="year">{item.report.year ?? "—"}</span>
                  {item.report.title}
                </button>
              </li>
            ))}
          </ul>
          {selectedReport && (
            <aside className="peek">
              <p className="peek-kicker">
                {selectedReport.year} · {selectedReport.category}
                <button type="button" className="close" onClick={() => setSelected(null)} aria-label="Close">
                  ×
                </button>
              </p>
              <h2>{selectedReport.title}</h2>
              <p className="meta">
                {selectedReport.author}
                {selectedReport.projectType ? ` · ${selectedReport.projectType}` : ""}
              </p>
              <PeekBlock label="About" text={selectedReport.description} terms={terms} />
              <PeekBlock label="Findings" text={selectedReport.findings} terms={terms} />
              <PeekBlock label="What came of it" text={selectedReport.outputs} terms={terms} />
              {selectedReport.targetedUser && (
                <PeekBlock label="Who for" text={selectedReport.targetedUser} terms={terms} />
              )}
              {(selectedReport.methodsPrimary ?? []).length > 0 && (
                <p className="method-tags">
                  {selectedReport.methodsPrimary.map((method) => (
                    <span key={method}>{method}</span>
                  ))}
                </p>
              )}
            </aside>
          )}
        </div>
      </div>
    </Shell>
  );
}

function PeekBlock({ label, text, terms }) {
  if (!text) return null;
  return (
    <p>
      <span>{label}</span>
      <Marks text={text} terms={terms} />
    </p>
  );
}
