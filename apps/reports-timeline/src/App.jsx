import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reports, yearRange } from "./loadReports.js";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import {
  CATEGORY_GROUPS,
  DETAIL_FIELDS,
  buildLinks,
  colorForCategory,
  displayValue,
  isHttpUrl,
  linkedReports,
  neighborsOf,
  parseConnectionIds,
} from "./graph.js";
import {
  NODE_RADIUS,
  layoutReports,
  linePath,
  quadPath,
  yearTicks,
  yearX,
} from "./layout.js";

const MARGIN = { top: 18, right: 28, bottom: 36, left: 28 };
const MIN_CHART_WIDTH = 860;

const plotted = reports.filter((report) => typeof report.year === "number");
const { links } = buildLinks(plotted);

function FieldValue({ field, report, reportsByNo, onSelect }) {
  if (field.key === "connections") {
    const tokens = parseConnectionIds(report.connections);
    if (!tokens.length) return <span className="empty">Not recorded</span>;
    return (
      <ul className="connection-list">
        {tokens.map((token) => {
          const target = /^\d+$/.test(token) ? reportsByNo.get(token) : null;
          if (target) {
            return (
              <li key={token}>
                <button type="button" className="text-link" onClick={() => onSelect(target)}>
                  {target.title}
                </button>
                <span className="muted"> (Report no. {target.reportNo})</span>
              </li>
            );
          }
          if (/^\d+$/.test(token)) {
            return (
              <li key={token}>
                Report no. {token} <span className="empty">(not in catalogue)</span>
              </li>
            );
          }
          return <li key={token}>{token}</li>;
        })}
      </ul>
    );
  }

  const value = displayValue(report, field.key);
  if (value == null) return <span className="empty">Not recorded</span>;
  if (field.key === "website" && isHttpUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }
  return value;
}

function SidePanel({ report, reportsByUid, reportsByNo, onClose, onSelect }) {
  const closeRef = useRef(null);
  const graphLinks = linkedReports(report.uid, links, reportsByUid);

  useEffect(() => {
    closeRef.current?.focus();
  }, [report.uid]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      className="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-panel-title"
    >
      <div className="panel-head">
        <h2 id="report-panel-title">{report.title}</h2>
        <button
          ref={closeRef}
          type="button"
          className="close"
          onClick={onClose}
          aria-label="Close report details"
        >
          Close
        </button>
      </div>
      <dl>
        {DETAIL_FIELDS.map((field) => (
          <div className="field" key={field.key}>
            <dt>{field.label}</dt>
            <dd>
              <FieldValue
                field={field}
                report={report}
                reportsByNo={reportsByNo}
                onSelect={onSelect}
              />
            </dd>
          </div>
        ))}
        <div className="field">
          <dt>Linked in this view</dt>
          <dd>
            {graphLinks.length ? (
              <ul className="connection-list">
                {graphLinks.map((item) => (
                  <li key={item.report.uid}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => onSelect(item.report)}
                    >
                      {item.report.title}
                    </button>
                    <span className="muted">
                      {" "}
                      (Report no. {item.report.reportNo ?? "—"} · {item.reasons.join(", ")})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="empty">No project or author links</span>
            )}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export default function App() {
  const wrapRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const [size, setSize] = useState({ width: MIN_CHART_WIDTH, height: 520 });
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(rect.width, MIN_CHART_WIDTH),
        height: Math.max(rect.height, 420),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo(
    () =>
      layoutReports(plotted, {
        width: size.width,
        height: size.height,
        margin: MARGIN,
        yearRange,
      }),
    [size.width, size.height],
  );

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const reportsByUid = useMemo(
    () => new Map(plotted.map((report) => [report.uid, report])),
    [],
  );
  const reportsByNo = useMemo(
    () =>
      new Map(
        plotted.filter((report) => report.reportNo).map((report) => [report.reportNo, report]),
      ),
    [],
  );

  const selected = selectedId ? reportsByUid.get(selectedId) : null;
  const hovered = hoveredId ? reportsByUid.get(hoveredId) : null;
  const activeId = hoveredId ?? selectedId;
  const neighborhood = useMemo(
    () => (activeId ? neighborsOf(activeId, links) : null),
    [activeId],
  );

  const ticks = yearTicks(yearRange.min, yearRange.max, size.width);
  const axisY = size.height - MARGIN.bottom;

  const moveTooltip = (event, report) => {
    const pad = 14;
    const width = 280;
    const left =
      event.clientX + pad + width > window.innerWidth
        ? event.clientX - width - pad
        : event.clientX + pad;
    const top = Math.min(event.clientY + pad, window.innerHeight - 88);
    setTooltip({ left: Math.max(8, left), top: Math.max(8, top), report });
  };

  const selectReport = useCallback((report) => {
    setSelectedId(report.uid);
    setHoveredId(null);
    setTooltip(null);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedId((current) => {
      requestAnimationFrame(() => nodeRefs.current.get(current)?.focus());
      return null;
    });
  }, []);

  return (
    <Shell title="Year × connections">
      <div className={`workspace${selected ? " has-panel" : ""}`}>
        <div className="chart-col">
          <div className="toolbar">
            <p className="count">
              <b>
                {plotted.length} of {reports.length}
              </b>{" "}
              reports plotted
            </p>
            <ul className="legend" aria-label="Category colours">
              {CATEGORY_GROUPS.map((group) => (
                <li key={group.id}>
                  <span className="swatch" style={{ background: group.color }} />
                  {group.label}
                </li>
              ))}
            </ul>
            <ul className="legend links-legend" aria-label="Connection styles">
              <li>
                <span className="line-sample solid" />
                Project connection
              </li>
              <li>
                <span className="line-sample dotted" />
                Shared author
              </li>
            </ul>
          </div>

          <div className="chart-wrap" ref={wrapRef}>
            <svg
              className="chart"
              width={size.width}
              height={size.height}
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="img"
              aria-label={`Timeline of ${plotted.length} Helen Hamlyn Centre for Design reports from ${yearRange.min} to ${yearRange.max}. Dots are reports. Bold lines are project connections. Dotted lines are shared authors.`}
            >
              <line
                className="axis-line"
                x1={MARGIN.left}
                x2={size.width - MARGIN.right}
                y1={axisY}
                y2={axisY}
              />
              {ticks.map((year) => {
                const x = yearX(year, size.width, MARGIN, yearRange);
                return (
                  <g key={year}>
                    <line className="tick" x1={x} x2={x} y1={axisY} y2={axisY + 5} />
                    <text className="tick-label" x={x} y={axisY + 18} textAnchor="middle">
                      {year}
                    </text>
                  </g>
                );
              })}

              <g className="links" pointerEvents="none">
                {links.map((link) => {
                  const a = nodesById.get(link.source);
                  const b = nodesById.get(link.target);
                  if (!a || !b) return null;
                  const related = !neighborhood || neighborhood.edgeIds.has(link.id);
                  const dim = neighborhood && !related ? " dim" : "";
                  if (link.dual) {
                    return (
                      <g key={link.id} className={dim}>
                        <path d={quadPath(a, b, 1)} className="link report-link" />
                        <path d={quadPath(a, b, -1)} className="link author-link" />
                      </g>
                    );
                  }
                  return (
                    <path
                      key={link.id}
                      d={linePath(a, b)}
                      className={`link${link.reportConnection ? " report-link" : " author-link"}${dim}`}
                    />
                  );
                })}
              </g>

              <g className="nodes">
                {nodes.map((node) => {
                  const related = !neighborhood || neighborhood.nodes.has(node.id);
                  const isActive = node.id === hoveredId || node.id === selectedId;
                  return (
                    <g
                      key={node.id}
                      className={`node${related ? "" : " dim"}${isActive ? " active" : ""}`}
                      transform={`translate(${node.x} ${node.y})`}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selectedId === node.id}
                      aria-label={`Report no. ${node.report.reportNo ?? "not recorded"}. ${node.report.title}. ${node.report.author}. ${node.report.year}. ${node.report.category}.`}
                      ref={(element) => {
                        if (element) nodeRefs.current.set(node.id, element);
                        else nodeRefs.current.delete(node.id);
                      }}
                      onMouseEnter={(event) => {
                        setHoveredId(node.id);
                        moveTooltip(event, node.report);
                      }}
                      onMouseMove={(event) => moveTooltip(event, node.report)}
                      onMouseLeave={() => {
                        setHoveredId(null);
                        setTooltip(null);
                      }}
                      onFocus={(event) => {
                        setHoveredId(node.id);
                        const rect = event.currentTarget.getBoundingClientRect();
                        setTooltip({
                          left: rect.right + 8,
                          top: rect.top,
                          report: node.report,
                        });
                      }}
                      onBlur={() => {
                        setHoveredId(null);
                        setTooltip(null);
                      }}
                      onClick={() => selectReport(node.report)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectReport(node.report);
                        }
                      }}
                    >
                      <circle className="hit" r={NODE_RADIUS + 2} />
                      <circle
                        className="dot"
                        r={NODE_RADIUS}
                        fill={colorForCategory(node.report.category)}
                      />
                      <text className="dot-label" x={NODE_RADIUS + 4} y="3.5">
                        {node.report.reportNo ?? "—"}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        {selected ? (
          <SidePanel
            report={selected}
            reportsByUid={reportsByUid}
            reportsByNo={reportsByNo}
            onClose={closePanel}
            onSelect={selectReport}
          />
        ) : null}
      </div>

      {tooltip?.report && hovered ? (
        <div
          className="tooltip"
          role="status"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <strong>{tooltip.report.title}</strong>
          <span>Report no. {tooltip.report.reportNo ?? "Not recorded"}</span>
          <span>{tooltip.report.author}</span>
        </div>
      ) : null}
    </Shell>
  );
}
