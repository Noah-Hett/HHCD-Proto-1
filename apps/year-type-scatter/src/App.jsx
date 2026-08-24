import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reports } from "./loadReports.js";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { COLOR_GROUPS, mapReports } from "./mapReports.js";
import ScatterPlot from "./ScatterPlot.jsx";
import Tooltip from "./Tooltip.jsx";
import ReportPanel from "./ReportPanel.jsx";

function tooltipPosition(event) {
  const pad = 12;
  const width = 280;
  const estimatedHeight = 120;
  let x;
  let y;

  if (event.type === "focus" && event.currentTarget?.getBoundingClientRect) {
    const box = event.currentTarget.getBoundingClientRect();
    x = box.right + 8;
    y = box.top;
  } else {
    x = event.clientX + 16;
    y = event.clientY + 16;
  }

  if (x + width > window.innerWidth - pad) {
    x = Math.max(pad, window.innerWidth - width - pad);
  }
  if (y + estimatedHeight > window.innerHeight - pad) {
    y = Math.max(pad, window.innerHeight - estimatedHeight - pad);
  }
  return { x, y };
}

export default function App() {
  const mapped = useMemo(() => mapReports(reports), []);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const closeRef = useRef(null);
  const lastDotKey = useRef(null);
  const dotRefs = useRef(new Map());

  const setDotRef = useCallback((key, node) => {
    if (node) dotRefs.current.set(key, node);
    else dotRefs.current.delete(key);
  }, []);

  const handleHover = useCallback((cluster, event) => {
    setHovered(cluster);
    setTipPos(tooltipPosition(event));
  }, []);

  const handleLeave = useCallback(() => {
    setHovered(null);
  }, []);

  const handleSelect = useCallback((cluster) => {
    lastDotKey.current = cluster.key;
    setSelected((current) => (current?.key === cluster.key ? null : cluster));
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
    setHovered(null);
    const node = dotRefs.current.get(lastDotKey.current);
    node?.focus();
  }, []);

  useEffect(() => {
    if (selected) {
      closeRef.current?.focus();
    }
  }, [selected]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (selected) {
        event.preventDefault();
        handleClose();
        return;
      }
      if (hovered) {
        setHovered(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, hovered, handleClose]);

  const status =
    mapped.unmappedCount === 0
      ? `${mapped.plottedCount} of ${reports.length} reports plotted`
      : `${mapped.plottedCount} of ${reports.length} reports plotted · ${mapped.unmappedCount} unmapped`;

  return (
    <Shell title="Year × project type">
      <div className={selected ? "workspace panel-open" : "workspace"}>
        <div className="toolbar">
          <p className="status">{status}</p>
          <ul className="legend">
            {COLOR_GROUPS.map((group) => (
              <li key={group.id}>
                <span className="swatch" style={{ background: group.color }} />
                {group.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="chart-row">
          <div className="chart-wrap">
            <ScatterPlot
              clusters={mapped.clusters}
              yearMin={mapped.yearMin}
              yearMax={mapped.yearMax}
              hoveredKey={hovered?.key ?? null}
              selectedKey={selected?.key ?? null}
              onHover={handleHover}
              onLeave={handleLeave}
              onSelect={handleSelect}
              onDotRef={setDotRef}
            />
            <Tooltip cluster={hovered} x={tipPos.x} y={tipPos.y} />
          </div>
          <ReportPanel
            cluster={selected}
            onClose={handleClose}
            closeRef={closeRef}
          />
        </div>
      </div>
    </Shell>
  );
}
