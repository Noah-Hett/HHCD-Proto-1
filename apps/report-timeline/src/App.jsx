import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { reports, yearRange } from "./loadReports.js";
import {
  CATEGORY_GROUPS,
  DETAIL_FIELDS,
  buildGraph,
  displayValue,
  neighborsOf,
  websiteUrls,
} from "./graph.js";
import {
  AXIS_BOTTOM,
  AXIS_PAD,
  NODE_RADIUS,
  layoutGraph,
  linePath,
  quadPath,
  yearTicks,
  yearX,
} from "./layout.js";

const MARGIN = { top: 36, right: 36, bottom: AXIS_BOTTOM, left: 36 };
const MIN_CHART_WIDTH = 960;

function SidePanel({ report, edges, reportsById, onClose, onOpen }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [report, onClose]);

  const linked = [];
  for (const edge of edges) {
    if (edge.source !== report.uid && edge.target !== report.uid) continue;
    const otherId = edge.source === report.uid ? edge.target : edge.source;
    const other = reportsById.get(otherId);
    if (!other) continue;
    linked.push({
      report: other,
      label: edge.kind === "project" ? "Project connection" : "Shared author",
    });
  }

  return (
    <aside className="panel" role="dialog" aria-labelledby="panel-title">
      <div className="panel-bar">
        <h2 id="panel-title">{report.title}</h2>
        <button ref={closeRef} type="button" className="close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="panel-body">
        {DETAIL_FIELDS.map((field) => {
          const value = displayValue(report, field.key);
          if (!value) return null;
          if (field.key === "website") {
            const urls = websiteUrls(value);
            return (
              <section key={field.key}>
                <h3>{field.label}</h3>
                {urls.length ? (
                  <p>
                    {urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    ))}
                  </p>
                ) : (
                  <p>{value}</p>
                )}
              </section>
            );
          }
          return (
            <section key={field.key}>
              <h3>{field.label}</h3>
              <p>{value}</p>
            </section>
          );
        })}
        {linked.length > 0 ? (
          <section>
            <h3>Linked reports</h3>
            <ul className="linked">
              {linked.map((item) => (
                <li key={`${item.report.uid}-${item.label}`}>
                  <button type="button" onClick={() => onOpen(item.report.uid)}>
                    {item.report.title}
                  </button>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

export default function App() {
  const graph = useMemo(() => buildGraph(reports), []);
  const reportsById = useMemo(
    () => new Map(reports.map((report) => [report.uid, report])),
    [],
  );
  const frameRef = useRef(null);
  const [width, setWidth] = useState(MIN_CHART_WIDTH);
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setWidth(Math.max(rect.width, MIN_CHART_WIDTH));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const laidOut = useMemo(
    () =>
      layoutGraph(graph, {
        width,
        margin: MARGIN,
        yearRange,
      }),
    [graph, width],
  );

  const nodesById = useMemo(
    () => new Map(laidOut.nodes.map((node) => [node.id, node])),
    [laidOut.nodes],
  );
  const selected = selectedId ? reportsById.get(selectedId) : null;
  const highlight = selectedId ? neighborsOf(selectedId, graph.edges) : null;
  const hoverNode = hoverId ? nodesById.get(hoverId) : null;

  function showTooltip(node, event) {
    setHoverId(node.id);
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame) return;
    setTooltip({
      x: event.clientX - frame.left + 12,
      y: event.clientY - frame.top + 12,
      title: node.report.title,
      author: node.report.author,
    });
  }

  function hideTooltip() {
    setHoverId(null);
    setTooltip(null);
  }

  const ticks = yearTicks(yearRange.min, yearRange.max, width);

  return (
    <Shell title="Report timeline">
      <div className={`workspace${selected ? " has-panel" : ""}`}>
        <div className="toolbar">
          <p className="status">
            <b>{reports.length}</b> reports · {yearRange.min}–{yearRange.max} · from
            data/reports.csv
          </p>
          <ul className="legend" aria-label="Category colours">
            {CATEGORY_GROUPS.map((group) => (
              <li key={group.id}>
                <span className="swatch" style={{ background: group.color }} />
                {group.label}
              </li>
            ))}
          </ul>
          <ul className="legend lines" aria-label="Line styles">
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              Project connection
            </li>
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line
                  x1="1"
                  y1="5"
                  x2="27"
                  y2="5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              </svg>
              Shared author
            </li>
          </ul>
        </div>

        <div className="stage">
          <div className="chart-scroll">
            <div ref={frameRef} className="chart-frame">
              <svg
                className="chart"
                width={width}
                height={laidOut.height}
                viewBox={`0 0 ${width} ${laidOut.height}`}
                role="img"
                aria-label="Timeline of research associate reports by year"
                onClick={() => setSelectedId(null)}
              >
                <defs>
                  <marker
                    id="axis-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#111" />
                  </marker>
                </defs>
                {ticks.map((year) => {
                  const x = yearX(year, width, MARGIN, yearRange);
                  return (
                    <line
                      key={`grid-${year}`}
                      className="grid"
                      x1={x}
                      x2={x}
                      y1={MARGIN.top}
                      y2={laidOut.height - MARGIN.bottom}
                    />
                  );
                })}
                <line
                  className="axis-line"
                  x1={AXIS_PAD}
                  y1={laidOut.height - MARGIN.bottom}
                  x2={width - AXIS_PAD}
                  y2={laidOut.height - MARGIN.bottom}
                  markerEnd="url(#axis-arrow)"
                />
                {ticks.map((year) => {
                  const x = yearX(year, width, MARGIN, yearRange);
                  return (
                    <text
                      key={`tick-${year}`}
                      className="tick"
                      x={x}
                      y={laidOut.height - AXIS_PAD}
                      textAnchor="middle"
                      dominantBaseline="text-after-edge"
                    >
                      {year}
                    </text>
                  );
                })}

                {graph.edges.map((edge) => {
                  const a = nodesById.get(edge.source);
                  const b = nodesById.get(edge.target);
                  if (!a || !b) return null;
                  const dimmed = highlight && !highlight.edgeIds.has(edge.id);
                  const d = edge.curve ? quadPath(a, b, edge.curve) : linePath(a, b);
                  return (
                    <path
                      key={edge.id}
                      className={`link ${edge.kind}${dimmed ? " dim" : ""}${
                        highlight?.edgeIds.has(edge.id) ? " hot" : ""
                      }`}
                      d={d}
                    />
                  );
                })}

                {laidOut.nodes.map((node) => {
                  const dimmed = highlight && !highlight.nodeIds.has(node.id);
                  const active = hoverId === node.id || selectedId === node.id;
                  return (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                      <circle
                        className={`dot${dimmed ? " dim" : ""}${active ? " active" : ""}`}
                        r={active ? NODE_RADIUS + 1.5 : NODE_RADIUS}
                        fill={node.color}
                        tabIndex={0}
                        role="button"
                        aria-label={`${node.report.title}, ${node.report.author}, ${node.report.year}`}
                        onMouseEnter={(event) => showTooltip(node, event)}
                        onMouseMove={(event) => showTooltip(node, event)}
                        onMouseLeave={hideTooltip}
                        onFocus={(event) => showTooltip(node, event)}
                        onBlur={hideTooltip}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(node.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedId(node.id);
                          }
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
              {tooltip && hoverNode ? (
                <div
                  className="tooltip"
                  style={{ left: tooltip.x, top: tooltip.y }}
                  role="status"
                >
                  <strong>{tooltip.title}</strong>
                  <span>{tooltip.author}</span>
                </div>
              ) : null}
            </div>
          </div>

          {selected ? (
            <SidePanel
              report={selected}
              edges={graph.edges}
              reportsById={reportsById}
              onClose={() => setSelectedId(null)}
              onOpen={setSelectedId}
            />
          ) : (
            <p className="hint-side">Click a report for full details.</p>
          )}
        </div>
      </div>
    </Shell>
  );
}
