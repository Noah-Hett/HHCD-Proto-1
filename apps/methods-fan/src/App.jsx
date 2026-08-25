import { useCallback, useEffect, useMemo, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { FanChart } from "./FanChart.jsx";
import { buildGraph, CATEGORY_DASH, methodMark } from "./graph.js";

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
  const [zoomedCategory, setZoomedCategory] = useState(null);

  const onFocus = useCallback((item) => setHovered(refOf(item)), []);
  const onZoom = useCallback((categoryId) => {
    setZoomedCategory(categoryId);
    setPinned(null);
    setHovered(null);
  }, []);
  const onSelect = useCallback(
    (item) => {
      const next = refOf(item);
      if (!next) {
        setPinned(null);
        return;
      }
      if (next.kind === "category") {
        setZoomedCategory((current) => (current === next.id ? null : next.id));
        setPinned(null);
        setHovered(null);
        return;
      }
      if (next.kind === "project") {
        const project =
          graph.projects.find((entry) => entry.id === next.id) ?? item;
        if (project?.category) setZoomedCategory(project.category);
      }
      setPinned((prev) => (next && sameRef(prev, next) ? null : next));
    },
    [graph.projects],
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (pinned) {
        setPinned(null);
        return;
      }
      if (zoomedCategory) {
        setZoomedCategory(null);
        setHovered(null);
        return;
      }
      setHovered(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, zoomedCategory]);

  const focus = hovered ?? pinned;
  const detail = resolveDetail(graph, pinned ?? hovered, zoomedCategory);
  const status = statusText(graph, pinned, zoomedCategory);
  const zoomed = graph.categories.find((item) => item.id === zoomedCategory);

  return (
    <Shell fill title="Methods fan">
      <div className="page">
        <div className="stage">
          <FanChart
            reports={reports}
            focus={focus}
            onFocus={onFocus}
            onSelect={onSelect}
            zoomedCategory={zoomedCategory}
            onZoom={onZoom}
          />
        </div>
        <aside className="panel">
          <p className="kicker" id="fan-summary">
            {zoomed
              ? `${zoomed.count} reports in ${zoomed.label}`
              : `${graph.methods.length} methods · ${graph.categories.length} categories · ${graph.projects.length} reports`}
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
          <ul className="legend">
            {graph.categories.map((category) => {
              const pressed = zoomedCategory === category.id;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    className={pressed ? "active" : ""}
                    aria-pressed={pressed}
                    aria-label={`${category.label}, ${category.count} reports. ${pressed ? "Showing reports. Activate to go back." : "Activate to zoom in."}`}
                    onClick={() => onSelect({ kind: "category", id: category.id })}
                    onMouseEnter={() => {
                      if (!zoomedCategory) {
                        setHovered({ kind: "category", id: category.id });
                      }
                    }}
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
          <p className="key-label">Methods</p>
          <ul className="method-key">
            {([...graph.methods]
              .filter((method) =>
                zoomedCategory
                  ? method.projectIds.some((id) => {
                      const project = graph.projects.find((entry) => entry.id === id);
                      return project?.category === zoomedCategory;
                    })
                  : true,
              )
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            ).map((method) => {
              const pressed = pinned?.kind === "method" && pinned.id === method.id;
              return (
                <li key={method.id}>
                  <button
                    type="button"
                    className={pressed ? "active" : ""}
                    aria-pressed={pressed}
                    aria-label={`${method.label}, used in ${method.count} reports`}
                    onClick={() => onSelect(method)}
                    onMouseEnter={() =>
                      setHovered({ kind: "method", id: method.id })
                    }
                    onMouseLeave={() => setHovered(null)}
                  >
                    <MethodGlyph name={method.label} />
                    {method.short}
                  </button>
                </li>
              );
            })}
          </ul>
          <Detail
            detail={detail}
            graph={graph}
            onSelect={onSelect}
            zoomedCategory={zoomedCategory}
          />
        </aside>
      </div>
    </Shell>
  );
}

function statusText(graph, pinned, zoomedCategory) {
  if (pinned?.kind === "method") {
    const method = graph.methods.find((item) => item.id === pinned.id);
    return method ? `${method.label} selected.` : "";
  }
  if (pinned?.kind === "project") {
    const project = graph.projects.find((item) => item.id === pinned.id);
    return project ? `${project.title} selected.` : "";
  }
  if (zoomedCategory) {
    return `Zoomed into ${zoomedCategory}. Escape returns to all categories.`;
  }
  return "Showing methods linked to category nodes. Activate a category to zoom in.";
}

function resolveDetail(graph, ref, zoomedCategory) {
  if (!ref) return { kind: "intro" };
  if (ref.kind === "method") {
    const method = graph.methods.find((item) => item.id === ref.id);
    if (!method) return { kind: "intro" };
    const connected = method.projectIds
      .map((id) => graph.projects.find((project) => project.id === id))
      .filter(Boolean)
      .filter((project) =>
        zoomedCategory ? project.category === zoomedCategory : true,
      );
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

function Detail({ detail, graph, onSelect, zoomedCategory }) {
  if (detail.kind === "method") {
    return (
      <div className="detail">
        <h1>{detail.method.label}</h1>
        <p className="lede">
          {zoomedCategory
            ? `Used in ${detail.connected.length} reports in this category.`
            : `Used in ${detail.method.count} of ${graph.projects.length} reports.`}
        </p>
        <ul className="hits">
          {detail.connected.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onSelect(project)}>
                <i style={{ background: project.color }} aria-hidden="true" />
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
          {zoomedCategory === detail.category.id
            ? `${detail.connected.length} reports around the semicircle, left to right by year.`
            : `${detail.connected.length} reports. Activate to zoom in and scatter them around the fan.`}
        </p>
        <ul className="hits">
          {detail.connected.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onSelect(project)}>
                <i style={{ background: project.color }} aria-hidden="true" />
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
      <h1>{zoomedCategory ? "This category" : "How to read this"}</h1>
      <p className="lede">
        {zoomedCategory
          ? "Inner marks are the methods used here — each has its own symbol. Hover a mark to read its name; the key on the right lists them all. Outer nodes are this category’s reports, spread around the semicircle by year."
          : "Inner marks are research methods: each shape is a method, with the name beside it. See the key if a label is tight. Outer nodes are categories, sized by how many reports they hold. A curve means that method was used in that category. Line texture also marks category, not colour alone."}
      </p>
      <p className="body">
        {zoomedCategory
          ? "Click a report for its details. All categories or Escape goes back."
          : "Click a category node or the list to zoom in. Tab or arrow-key methods. Escape clears."}
      </p>
    </div>
  );
}

function MethodGlyph({ name }) {
  const mark = methodMark(name, 92);
  return (
    <svg
      className={`method-glyph is-${mark.ink}`}
      width="18"
      height="18"
      viewBox="-9 -9 18 18"
      aria-hidden="true"
    >
      <path d={mark.d} />
    </svg>
  );
}
