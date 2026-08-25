import { useCallback, useEffect, useMemo, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { FanChart } from "./FanChart.jsx";
import { buildGraph } from "./graph.js";

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

  return (
    <Shell fill title="Methods fan">
      <div className="page">
        <div className="stage">
          <FanChart
            reports={reports}
            focus={focus}
            onFocus={onFocus}
            onSelect={onSelect}
          />
        </div>
        <aside className="panel" aria-live="polite">
          <p className="kicker">
            {graph.methods.length} methods · {graph.projects.length} reports ·{" "}
            {graph.links.length} links
          </p>
          <ul className="legend">
            {graph.categories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  className={
                    pinned?.kind === "category" && pinned.id === category.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    onSelect({ kind: "category", id: category.id })
                  }
                  onMouseEnter={() =>
                    setHovered({ kind: "category", id: category.id })
                  }
                  onMouseLeave={() => setHovered(null)}
                >
                  <i style={{ background: category.color }} />
                  {category.label}
                  <span>{category.count}</span>
                </button>
              </li>
            ))}
          </ul>
          <Detail detail={detail} graph={graph} onSelect={onSelect} />
        </aside>
      </div>
    </Shell>
  );
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
                <i style={{ background: project.color }} />
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
          <span
            className="pill"
            style={{
              background: `${detail.project.color}22`,
              color: detail.project.color,
            }}
          >
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
                <i style={{ background: project.color }} />
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
        Inner nodes are research methods. Outer nodes are the 62 reports, grouped
        by category around the larger semicircle. A link means that report used
        that method.
      </p>
      <p className="body">
        Hover to trace a method or report. Click to pin it. Drag a node — the
        force layout will pull it back onto its arc. Esc or click the background
        to clear.
      </p>
    </div>
  );
}
