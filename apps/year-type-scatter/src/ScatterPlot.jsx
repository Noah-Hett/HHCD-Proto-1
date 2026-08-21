import { Y_BANDS, clusterAriaLabel } from "./mapReports.js";

const VIEW_W = 900;
const VIEW_H = 520;
const MARGIN = { top: 24, right: 28, bottom: 52, left: 168 };

const innerWidth = VIEW_W - MARGIN.left - MARGIN.right;
const innerHeight = VIEW_H - MARGIN.top - MARGIN.bottom;

function xForYear(year, yearMin, yearMax) {
  const span = Math.max(yearMax - yearMin, 1);
  const pad = 0.6;
  const t = (year - yearMin + pad) / (span + pad * 2);
  return MARGIN.left + t * innerWidth;
}

function yForBand(yBand) {
  const t = (yBand + 0.5) / Y_BANDS.length;
  return MARGIN.top + innerHeight * (1 - t);
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
  function handleKeyDown(event, cluster) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cluster);
    }
  }

  return (
    <svg
      className="scatter"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-labelledby="scatter-title scatter-desc"
    >
      <title id="scatter-title">HHCD reports by year and project type</title>
      <desc id="scatter-desc">
        Scatter plot of research associate reports. The horizontal axis is year.
        The vertical axis is project type, from conceptual framework at the bottom
        to products at the top. Dot colour is research theme; size is how many
        reports of that theme share a year and type. Themes at the same place
        stack vertically and overlap. Activate a dot to read the reports.
      </desc>

      {Y_BANDS.map((band) => {
        const y = yForBand(band.id);
        return (
          <foreignObject
            key={band.id}
            x={8}
            y={y - 22}
            width={MARGIN.left - 20}
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
        x={MARGIN.left}
        y={VIEW_H - 18}
        textAnchor="start"
      >
        {yearMin}
      </text>
      <text
        className="x-end"
        x={VIEW_W - MARGIN.right}
        y={VIEW_H - 18}
        textAnchor="end"
      >
        {yearMax}
      </text>
      <text
        className="x-title"
        x={MARGIN.left + innerWidth / 2}
        y={VIEW_H - 8}
        textAnchor="middle"
      >
        year
      </text>

      {clusters.map((cluster) => {
        const cx = xForYear(cluster.year, yearMin, yearMax) + cluster.dx;
        const cy = yForBand(cluster.yBand) + cluster.dy;
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
  );
}
