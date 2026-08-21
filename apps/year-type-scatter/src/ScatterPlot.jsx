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

function groupByCell(clusters) {
  const cells = new Map();
  for (const cluster of clusters) {
    const members = cells.get(cluster.cellKey);
    if (members) members.push(cluster);
    else cells.set(cluster.cellKey, [cluster]);
  }
  return [...cells.values()].map((dots) => ({
    cellKey: dots[0].cellKey,
    year: dots[0].year,
    yBand: dots[0].yBand,
    dots,
  }));
}

function DotControl({
  cluster,
  active,
  selected,
  onHover,
  onLeave,
  onSelect,
  onDotRef,
  showMark,
}) {
  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(cluster);
    }
  }

  return (
    <g
      className={active ? "dot active" : "dot"}
      transform={`translate(${cluster.dx} ${cluster.dy})`}
      tabIndex={0}
      role="button"
      aria-label={clusterAriaLabel(cluster)}
      aria-pressed={selected}
      ref={(node) => onDotRef(cluster.key, node)}
      onMouseEnter={(event) => onHover(cluster, event)}
      onMouseMove={(event) => onHover(cluster, event)}
      onMouseLeave={onLeave}
      onFocus={(event) => onHover(cluster, event)}
      onBlur={onLeave}
      onClick={() => onSelect(cluster)}
      onKeyDown={handleKeyDown}
    >
      <circle
        className="dot-hit"
        r={Math.max(cluster.r + 6, 12)}
        fill="transparent"
      />
      {showMark ? (
        <circle
          className="dot-mark"
          r={cluster.r}
          fill={cluster.color}
          stroke="#111"
          strokeWidth={active ? 1.6 : 1}
        />
      ) : null}
      <circle className="dot-focus" r={cluster.r + 3.5} />
    </g>
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
  const cells = groupByCell(clusters);

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
        reports of that theme share a year and type. Themes at the same place sit
        side by side and visually join. Activate a dot to read the reports.
      </desc>

      <defs>
        <filter
          id="goo"
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
        </filter>
      </defs>

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

      {cells.map((cell) => {
        const cx = xForYear(cell.year, yearMin, yearMax);
        const cy = yForBand(cell.yBand);
        const gooey = cell.dots.length > 1;
        return (
          <g key={cell.cellKey} transform={`translate(${cx} ${cy})`}>
            {gooey ? (
              <g className="blob-visual" filter="url(#goo)" aria-hidden="true">
                {cell.dots.map((cluster) => (
                  <circle
                    key={cluster.key}
                    className="blob-mark"
                    cx={cluster.dx}
                    cy={cluster.dy}
                    r={cluster.r}
                    fill={cluster.color}
                  />
                ))}
              </g>
            ) : null}
            {cell.dots.map((cluster) => (
              <DotControl
                key={cluster.key}
                cluster={cluster}
                active={
                  hoveredKey === cluster.key || selectedKey === cluster.key
                }
                selected={selectedKey === cluster.key}
                onHover={onHover}
                onLeave={onLeave}
                onSelect={onSelect}
                onDotRef={onDotRef}
                showMark={!gooey}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
