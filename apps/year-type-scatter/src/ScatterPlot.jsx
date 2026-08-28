import { useLayoutEffect, useRef, useState } from "react";
import { Y_BANDS, clusterAriaLabel } from "./mapReports.js";

const LEFT = 168;
const RIGHT = 40;
const TOP = 28;
const BOTTOM = 2;
const PX_PER_YEAR = 48;
const MIN_INNER_FLOOR = 692;

function minInnerWidth(yearMin, yearMax) {
  const slots = Math.max(yearMax - yearMin, 1) + 1.2;
  return Math.max(MIN_INNER_FLOOR, slots * PX_PER_YEAR);
}

function plotLayout(viewportWidth, height, yearMin, yearMax) {
  const innerWidth = Math.max(
    Math.max(viewportWidth - RIGHT, 1),
    minInnerWidth(yearMin, yearMax),
  );
  const plotWidth = innerWidth + RIGHT;
  const innerHeight = Math.max(height - TOP - BOTTOM, 1);
  return {
    height,
    left: LEFT,
    right: RIGHT,
    top: TOP,
    bottom: BOTTOM,
    innerWidth,
    innerHeight,
    plotWidth,
    originY: height - BOTTOM,
    arrowTop: 10,
    arrowRight: plotWidth - 10,
    scrollable: plotWidth > viewportWidth + 1,
  };
}

function xForYear(year, yearMin, yearMax, layout) {
  const span = Math.max(yearMax - yearMin, 1);
  const pad = 0.6;
  const t = (year - yearMin + pad) / (span + pad * 2);
  return t * layout.innerWidth;
}

function yForBand(yBand, layout) {
  const n = Y_BANDS.length;
  const top = layout.top;
  const bottom = layout.originY - 18;
  if (n <= 1) return (top + bottom) / 2;
  const t = yBand / (n - 1);
  return bottom - t * (bottom - top);
}

function usePlotSize() {
  const frameRef = useRef(null);
  const scrollRef = useRef(null);
  const [size, setSize] = useState({ viewportWidth: 0, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const scroll = scrollRef.current;
    if (!frame || !scroll) return undefined;

    const read = () => {
      const height = Math.round(
        scroll.clientHeight || frame.getBoundingClientRect().height,
      );
      const viewportWidth = Math.round(scroll.clientWidth);
      if (height < 2 || viewportWidth < 2) return;
      setSize((prev) =>
        Math.abs(prev.viewportWidth - viewportWidth) < 0.5 &&
        Math.abs(prev.height - height) < 0.5
          ? prev
          : { viewportWidth, height },
      );
    };

    read();
    const raf = requestAnimationFrame(read);
    const observer = new ResizeObserver(read);
    observer.observe(frame);
    observer.observe(scroll);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  return { frameRef, scrollRef, size };
}

function AxisArrowMarker({ id }) {
  return (
    <marker
      id={id}
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
  );
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
  const { frameRef, scrollRef, size } = usePlotSize();
  const layout = plotLayout(size.viewportWidth, size.height, yearMin, yearMax);
  const ready = size.viewportWidth > 1 && size.height > 1;

  function handleKeyDown(event, cluster) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cluster);
    }
  }

  return (
    <div
      className={
        layout.scrollable ? "scatter-frame is-scrollable" : "scatter-frame"
      }
      ref={frameRef}
    >
      <div className="scatter-y-col">
        {ready ? (
          <svg
            className="scatter-y"
            width={LEFT}
            height={layout.height}
            viewBox={`0 0 ${LEFT} ${layout.height}`}
            overflow="visible"
            aria-hidden="true"
            style={{ width: LEFT, height: layout.height }}
          >
            <defs>
              <AxisArrowMarker id="axis-arrow-y" />
            </defs>
            {Y_BANDS.map((band) => {
              const y = yForBand(band.id, layout);
              return (
                <foreignObject
                  key={band.id}
                  x={8}
                  y={y - 22}
                  width={LEFT - 16}
                  height={44}
                >
                  <div xmlns="http://www.w3.org/1999/xhtml" className="y-label">
                    {band.label}
                  </div>
                </foreignObject>
              );
            })}
            <line
              className="axis-line"
              x1={LEFT - 0.75}
              y1={layout.originY}
              x2={LEFT - 0.75}
              y2={layout.arrowTop}
              markerEnd="url(#axis-arrow-y)"
            />
          </svg>
        ) : null}
      </div>
      <div
        className="scatter-scroll"
        ref={scrollRef}
        tabIndex={layout.scrollable ? 0 : undefined}
        role={layout.scrollable ? "region" : undefined}
        aria-label={
          layout.scrollable
            ? "Year axis. Scroll horizontally to see later years."
            : undefined
        }
      >
        {ready ? (
          <div
            className="scatter-surface"
            style={{ width: layout.plotWidth, height: layout.height }}
          >
          <svg
            className="scatter-plot"
            width={layout.plotWidth}
            height={layout.height}
            viewBox={`0 0 ${layout.plotWidth} ${layout.height}`}
            preserveAspectRatio="none"
            overflow="visible"
            aria-labelledby="scatter-title scatter-desc"
            style={{ width: layout.plotWidth, height: layout.height }}
          >
            <title id="scatter-title">
              HHCD reports by year and project type
            </title>
            <desc id="scatter-desc">
              Scatter plot of research associate reports. The horizontal axis is
              year. The vertical axis is project type, from conceptual framework
              at the bottom to products / media campaign at the top. Each report
              is a same-size dot, coloured by research theme. Reports that share
              a year and type pack into a small cluster. Activate a dot to read
              the report. On a narrow window, scroll horizontally to keep year
              spacing readable.
            </desc>

            <defs>
              <AxisArrowMarker id="axis-arrow-x" />
            </defs>

            <line
              className="axis-line"
              x1={0}
              y1={layout.originY}
              x2={layout.arrowRight}
              y2={layout.originY}
              markerEnd="url(#axis-arrow-x)"
            />

            <text
              className="x-end"
              x={xForYear(yearMin, yearMin, yearMax, layout)}
              y={layout.originY - 6}
              textAnchor="start"
            >
              {yearMin}
            </text>
            <text
              className="x-end"
              x={xForYear(yearMax, yearMin, yearMax, layout)}
              y={layout.originY - 6}
              textAnchor="end"
            >
              {yearMax}
            </text>

            {clusters.map((cluster) => {
              const cx =
                xForYear(cluster.year, yearMin, yearMax, layout) + cluster.dx;
              const cy = yForBand(cluster.yBand, layout) + cluster.dy;
              const active =
                hoveredKey === cluster.key || selectedKey === cluster.key;
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
