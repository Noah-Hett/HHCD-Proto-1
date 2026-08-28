import { useLayoutEffect, useRef, useState } from "react";
import { Y_BANDS, clusterAriaLabel } from "./mapReports.js";

const FALLBACK_SIZE = { width: 0, height: 0 };

function plotLayout(width, height) {
  const left = width < 640 ? 132 : 168;
  const right = Math.min(40, Math.max(28, width * 0.04));
  const top = 36;
  const bottom = 52;
  const innerWidth = Math.max(width - left - right, 1);
  const innerHeight = Math.max(height - top - bottom, 1);
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    innerWidth,
    innerHeight,
    originX: left,
    originY: height - bottom,
    arrowTop: 10,
    arrowRight: width - 10,
  };
}

function xForYear(year, yearMin, yearMax, layout) {
  const span = Math.max(yearMax - yearMin, 1);
  const pad = 0.6;
  const t = (year - yearMin + pad) / (span + pad * 2);
  return layout.left + t * layout.innerWidth;
}

function yForBand(yBand, layout) {
  const t = (yBand + 0.5) / Y_BANDS.length;
  return layout.top + layout.innerHeight * (1 - t);
}

function useFrameSize() {
  const frameRef = useRef(null);
  const [size, setSize] = useState(FALLBACK_SIZE);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;

    const read = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  return [frameRef, size];
}

export default function ScatterPlot({
  clusters,
  yearMin,
  yearMax,
  hoveredKey,
  selectedKey,
  onHover,
  onLeave,
  onSelect,
  onDotRef,
}) {
  const [frameRef, size] = useFrameSize();
  const layout = plotLayout(size.width, size.height);

  function handleKeyDown(event, cluster) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cluster);
    }
  }

  return (
    <div className="scatter-frame" ref={frameRef}>
      {layout.width > 1 && layout.height > 1 ? (
      <svg
        className="scatter"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        aria-labelledby="scatter-title scatter-desc"
      >
        <title id="scatter-title">HHCD reports by year and project type</title>
        <desc id="scatter-desc">
          Scatter plot of research associate reports. The horizontal axis is year.
          The vertical axis is project type, from conceptual framework at the bottom
          to products / media campaign at the top. Each report is a same-size dot,
          coloured by research theme. Reports that share a year and type pack into
          a small cluster. Activate a dot to read the report.
        </desc>

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

        <line
          className="axis-line"
          x1={layout.originX}
          y1={layout.originY}
          x2={layout.originX}
          y2={layout.arrowTop}
          markerEnd="url(#axis-arrow)"
        />
        <line
          className="axis-line"
          x1={layout.originX}
          y1={layout.originY}
          x2={layout.arrowRight}
          y2={layout.originY}
          markerEnd="url(#axis-arrow)"
        />

        {Y_BANDS.map((band) => {
          const y = yForBand(band.id, layout);
          return (
            <foreignObject
              key={band.id}
              x={8}
              y={y - 22}
              width={layout.left - 20}
              height={44}
            >
              <div xmlns="http://www.w3.org/1999/xhtml" className="y-label">
                {band.label}
              </div>
            </foreignObject>
          );
        })}

        <text
          className="x-end"
          x={layout.left}
          y={layout.height - 18}
          textAnchor="start"
        >
          {yearMin}
        </text>
        <text
          className="x-end"
          x={layout.width - layout.right}
          y={layout.height - 18}
          textAnchor="end"
        >
          {yearMax}
        </text>

        {clusters.map((cluster) => {
          const cx = xForYear(cluster.year, yearMin, yearMax, layout) + cluster.dx;
          const cy = yForBand(cluster.yBand, layout) + cluster.dy;
          const active = hoveredKey === cluster.key || selectedKey === cluster.key;
          return (
            <g
              key={cluster.key}
              className={active ? "dot active" : "dot"}
              transform={`translate(${cx} ${cy})`}
              tabIndex={0}
              role="button"
              aria-label={clusterAriaLabel(cluster)}
              aria-pressed={selectedKey === cluster.key}
              ref={(node) => onDotRef(cluster.key, node)}
              onMouseEnter={(event) => onHover(cluster, event)}
              onMouseMove={(event) => onHover(cluster, event)}
              onMouseLeave={onLeave}
              onFocus={(event) => onHover(cluster, event)}
              onBlur={onLeave}
              onClick={() => onSelect(cluster)}
              onKeyDown={(event) => handleKeyDown(event, cluster)}
            >
              <circle
                className="dot-hit"
                r={Math.max(cluster.r + 6, 12)}
                fill="transparent"
              />
              <circle
                className="dot-mark"
                r={cluster.r}
                fill={cluster.color}
                stroke="#111"
                strokeWidth={active ? 1.6 : 1}
              />
              <circle className="dot-focus" r={cluster.r + 3.5} />
            </g>
          );
        })}
      </svg>
      ) : null}
    </div>
  );
}
