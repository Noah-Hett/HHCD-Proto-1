import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reports } from "./loadReports.js";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import { COLOR_GROUPS, mapReports } from "./mapReports.js";
import ScatterPlot from "./ScatterPlot.jsx";
import Tooltip from "./Tooltip.jsx";
import ReportPanel from "./ReportPanel.jsx";
import MethodFilter from "./MethodFilter.jsx";

function uniqueMethods(allReports) {
  const counts = new Map();
  for (const report of allReports) {
    for (const method of report.methods) {
      counts.set(method, (counts.get(method) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function reportsMatchingMethods(allReports, selectedMethods) {
  if (selectedMethods.size === 0) return allReports;
  return allReports.filter((report) =>
    report.methods.some((method) => selectedMethods.has(method)),
  );
}

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
  const methodOptions = useMemo(() => uniqueMethods(reports), []);
  const fullMapped = useMemo(() => mapReports(reports), []);
  const [selectedMethods, setSelectedMethods] = useState(() => new Set());
  const filteredReports = useMemo(
    () => reportsMatchingMethods(reports, selectedMethods),
    [selectedMethods],
  );
  const mapped = useMemo(() => mapReports(filteredReports), [filteredReports]);
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

  const handleToggleMethod = useCallback((label) => {
    setSelectedMethods((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  useEffect(() => {
    if (selected) {
      closeRef.current?.focus();
    }
  }, [selected]);

  useEffect(() => {
    setSelected((current) => {
      if (!current) return current;
      return mapped.clusters.find((cluster) => cluster.key === current.key) ?? null;
    });
    setHovered((current) => {
      if (!current) return current;
      return mapped.clusters.find((cluster) => cluster.key === current.key) ?? null;
    });
  }, [mapped]);

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
              yearMin={fullMapped.yearMin}
              yearMax={fullMapped.yearMax}
              hoveredKey={hovered?.key ?? null}
              selectedKey={selected?.key ?? null}
              onHover={handleHover}
              onLeave={handleLeave}
              onSelect={handleSelect}
              onDotRef={setDotRef}
            />
            <MethodFilter
              methods={methodOptions}
              selected={selectedMethods}
              onToggle={handleToggleMethod}
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
