import { useCallback, useEffect, useMemo, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { FanChart } from "./FanChart.jsx";
import { buildGraph, CATEGORY_DASH } from "./graph.js";

function refOf(item) {
  if (!item) return null;
  return { kind: item.kind, id: item.id };
}

function sameRef(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

export default function App() {
  const graph = useMemo(() => buildGraph(reports), []);
  const [pinned, setPinned] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [showAllLinks, setShowAllLinks] = useState(false);

  const onFocus = useCallback((item) => setHovered(refOf(item)), []);
  const onSelect = useCallback((item) => {
    const next = refOf(item);
    setPinned((prev) => (next && sameRef(prev, next) ? null : next));
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        setPinned(null);
        setHovered(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focus = hovered ?? pinned;
  const detail = resolveDetail(graph, pinned ?? hovered);
  const status = statusText(graph, pinned);

  return (
    <Shell fill title="Methods fan">
      <div className="page">
        <div className="stage">
          <FanChart
            reports={reports}
            focus={focus}
            onFocus={onFocus}
            onSelect={onSelect}
            showAllLinks={showAllLinks}
          />
        </div>
        <aside className="panel">
          <p className="kicker" id="fan-summary">
            {graph.methods.length} methods · {graph.projects.length} reports ·{" "}
            {graph.links.length} links
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
          <button
            type="button"
            className="link-toggle"
            aria-pressed={showAllLinks}
            onClick={() => setShowAllLinks((value) => !value)}
          >
            {showAllLinks
              ? "Hide individual connections"
              : "Show all individual connections"}
          </button>
          <ul className="legend">
            {graph.categories.map((category) => {
              const pressed =
                pinned?.kind === "category" && pinned.id === category.id;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    className={pressed ? "active" : ""}
                    aria-pressed={pressed}
                    aria-label={`${category.label}, ${category.count} reports`}
                    onClick={() =>
                      onSelect({ kind: "category", id: category.id })
                    }
                    onMouseEnter={() =>
                      setHovered({ kind: "category", id: category.id })
                    }
                    onMouseLeave={() => setHovered(null)}
                  >
                    <i
                      style={{
                        background: category.color,
                        borderColor: category.color,
                      }}
                      aria-hidden="true"
                    />
                    <svg
                      className="dash-swatch"
                      width="22"
                      height="8"
                      aria-hidden="true"
                    >
                      <line
                        x1="1"
                        y1="4"
                        x2="21"
                        y2="4"
                        stroke={category.color}
                        strokeWidth="2.5"
                        strokeDasharray={CATEGORY_DASH[category.id] || undefined}
                        strokeLinecap="round"
                      />
                    </svg>
                    {category.label}
                    <span>{category.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Detail detail={detail} graph={graph} onSelect={onSelect} />
        </aside>
      </div>
    </Shell>
  );
}

function statusText(graph, pinned) {
  if (!pinned) return "Showing method to category summaries.";
  if (pinned.kind === "method") {
    const method = graph.methods.find((item) => item.id === pinned.id);
    return method
      ? `${method.label} pinned, used in ${method.count} reports.`
      : "";
  }
  if (pinned.kind === "project") {
    const project = graph.projects.find((item) => item.id === pinned.id);
    return project ? `${project.title} pinned.` : "";
  }
  if (pinned.kind === "category") {
    const category = graph.categories.find((item) => item.id === pinned.id);
    return category
      ? `${category.label} pinned, ${category.count} reports.`
      : "";
  }
  return "";
}

function resolveDetail(graph, ref) {
  if (!ref) return { kind: "intro" };
  if (ref.kind === "method") {
    const method = graph.methods.find((item) => item.id === ref.id);
    if (!method) return { kind: "intro" };
    const connected = method.projectIds
      .map((id) => graph.projects.find((project) => project.id === id))
      .filter(Boolean);
    return { kind: "method", method, connected };
  }
  if (ref.kind === "project") {
    const project = graph.projects.find((item) => item.id === ref.id);
    if (!project) return { kind: "intro" };
    const methods = project.methodIds
      .map((id) => graph.methods.find((method) => method.id === id))
      .filter(Boolean);
    return { kind: "project", project, methods };
  }
  if (ref.kind === "category") {
    const category = graph.categories.find((item) => item.id === ref.id);
    if (!category) return { kind: "intro" };
    const connected = graph.byCategory.get(category.id) ?? [];
    return { kind: "category", category, connected };
  }
  return { kind: "intro" };
}

function Detail({ detail, graph, onSelect }) {
  if (detail.kind === "method") {
    return (
      <div className="detail">
        <h1>{detail.method.label}</h1>
        <p className="lede">
          Used in {detail.method.count} of {graph.projects.length} reports.
        </p>
        <ul className="hits">
          {detail.connected.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onSelect(project)}>
                <i
                  style={{ background: project.color }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{project.title}</strong>
                  <em>
                    {project.report.year} · {project.category}
                  </em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (detail.kind === "project") {
    const report = detail.project.report;
    return (
      <div className="detail">
        <p className="meta">
          <span className="pill">
            <i
              style={{ background: detail.project.color }}
              aria-hidden="true"
            />
            {report.category}
          </span>
          <span>{report.year}</span>
        </p>
        <h1>{report.title}</h1>
        <p className="lede">
          {report.author}
          {report.projectType ? ` · ${report.projectType}` : ""}
        </p>
        {report.description ? (
          <p className="body">{report.description}</p>
        ) : null}
        <h2>Methods</h2>
        <p className="chips">
          {detail.methods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method)}
            >
              {method.label}
            </button>
          ))}
        </p>
        {report.website ? (
          <p className="web">
            <a href={report.website} target="_blank" rel="noreferrer">
              Report website
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (detail.kind === "category") {
    return (
      <div className="detail">
        <h1>{detail.category.label}</h1>
        <p className="lede">
          {detail.connected.length} reports on the outer arc, left to right by
          year.
        </p>
        <ul className="hits">
          {detail.connected.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onSelect(project)}>
                <i
                  style={{ background: project.color }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{project.title}</strong>
                  <em>
                    {project.report.year} ·{" "}
                    {(project.report.methodsPrimary ?? []).length} methods
                  </em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="detail">
      <h1>How to read this</h1>
      <p className="lede">
        Inner nodes are research methods, sized by use. Outer nodes are the 62
        reports, grouped by category. At rest, each curve is a method–category
        summary — thicker means more reports. Line texture also marks category,
        not colour alone.
      </p>
      <p className="body">
        Hover, tab, or arrow-key a method to see its individual report links.
        Enter or click to pin. Esc or click the background to clear.
      </p>
    </div>
  );
}
