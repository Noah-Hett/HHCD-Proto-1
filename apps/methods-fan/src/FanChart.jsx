import { useEffect, useRef } from "react";
import {
  arc as d3arc,
  drag as d3drag,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
} from "d3";
import {
  buildGraph,
  CATEGORY_DASH,
  layoutGraph,
  linksForView,
  methodMark,
  nodesForView,
  polar,
  wrapLines,
} from "./graph.js";

function methodMarkSize(r) {
  return (Math.max(8, r) * 1.55) ** 2;
}

function applyMethodMarks(sel) {
  sel.select("path.method-mark").each(function (d) {
    const mark = methodMark(d.label, methodMarkSize(d.r));
    select(this)
      .attr("d", mark.d)
      .attr("class", `method-mark is-${mark.ink}`);
  });
}

function methodLabelAnchor(angle) {
  const c = Math.cos(angle);
  if (c < -0.34) return "end";
  if (c > 0.34) return "start";
  return "middle";
}

function mathToArc(angle) {
  return angle + Math.PI / 2;
}

function ringPath(cx, cy, radius, a0, a1) {
  const start = polar(cx, cy, radius, a0);
  const end = polar(cx, cy, radius, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

function lerpAngle(a, b, t) {
  let delta = b - a;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return a + delta * t;
}

function isPoint(p) {
  return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function bentLink(cx, cy, d) {
  const source = d.source;
  const target = d.target;
  if (!isPoint(source) || !isPoint(target)) return null;
  const sx = source.x;
  const sy = source.y;
  const tx = target.x;
  const ty = target.y;
  const sa = Math.atan2(sy - cy, sx - cx);
  const ta = Math.atan2(ty - cy, tx - cx);
  const sr = Math.hypot(sx - cx, sy - cy);
  const tr = Math.hypot(tx - cx, ty - cy);
  const mid = polar(cx, cy, (sr + tr) / 2, lerpAngle(sa, ta, 0.5));
  return `M${sx},${sy} Q${mid.x},${mid.y} ${tx},${ty}`;
}

function applyFocus(svgEl, focus, nodeById, categories) {
  const svg = select(svgEl);
  const resolved =
    !focus
      ? null
      : focus.kind === "category"
        ? (nodeById.get(focus.id) ??
          categories.find((item) => item.id === focus.id) ??
          null)
        : (nodeById.get(focus.id) ?? focus);

  svg.classed("is-focusing", Boolean(resolved));
  if (!resolved) {
    svg.selectAll(".is-hot").classed("is-hot", false);
    return;
  }

  const hotNodes = new Set();
  const hotCats = new Set();

  if (resolved.kind === "method") {
    hotNodes.add(resolved.id);
    svg.selectAll(".fan-link, .fan-ribbon").each((d) => {
      const sourceId = d.source.id ?? d.source;
      const targetId = d.target.id ?? d.target;
      if (sourceId === resolved.id) {
        hotNodes.add(targetId);
        const target = nodeById.get(targetId);
        if (target?.kind === "category") hotCats.add(target.id);
        if (target?.category) hotCats.add(target.category);
      }
    });
  } else if (resolved.kind === "project") {
    hotNodes.add(resolved.id);
    for (const id of resolved.methodIds ?? []) hotNodes.add(id);
    if (resolved.category) hotCats.add(resolved.category);
  } else {
    hotCats.add(resolved.id);
    hotNodes.add(resolved.id);
    svg.selectAll(".fan-link, .fan-ribbon").each((d) => {
      const sourceId = d.source.id ?? d.source;
      const targetId = d.target.id ?? d.target;
      if (targetId === resolved.id || d.categoryId === resolved.id) {
        hotNodes.add(sourceId);
        hotNodes.add(targetId);
      }
    });
  }

  svg.selectAll(".fan-link, .fan-ribbon").classed("is-hot", (d) => {
    const sourceId = d.source.id ?? d.source;
    const targetId = d.target.id ?? d.target;
    return hotNodes.has(sourceId) && hotNodes.has(targetId);
  });
  svg.selectAll(".fan-node").classed("is-hot", (d) => hotNodes.has(d.id));
  svg.selectAll(".method-label, .outer-label").classed("is-hot", (d) =>
    hotNodes.has(d.id),
  );
  svg
    .selectAll(".fan-band, .fan-wedge, .cat-label")
    .classed("is-hot", (d) => hotCats.has(d.id));
}

export function FanChart({
  reports,
  focus,
  onFocus,
  onSelect,
  zoomedCategory,
  onZoom,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const apiRef = useRef(null);
  const focusRef = useRef(focus);
  const onFocusRef = useRef(onFocus);
  const onSelectRef = useRef(onSelect);
  const onZoomRef = useRef(onZoom);

  focusRef.current = focus;
  onFocusRef.current = onFocus;
  onSelectRef.current = onSelect;
  onZoomRef.current = onZoom;

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const svg = select(svgEl);
    const graph = buildGraph(reports);
    const zoomed = Boolean(zoomedCategory);
    const nodes = nodesForView(graph, zoomedCategory);
    const links = linksForView(graph, zoomedCategory);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const maxRibbon = Math.max(
      ...links.map((link) => link.count ?? 1),
      1,
    );

    let explodeOrigin = null;
    let didExplode = false;
    let metrics = layoutGraph(
      graph,
      Math.max(wrap.clientWidth || 0, 800),
      Math.max(wrap.clientHeight || 0, 560),
      zoomedCategory,
    );

    svg.selectAll("*").remove();
    svg.classed("is-zoomed", zoomed);
    svg
      .append("title")
      .attr("id", "methods-fan-title")
      .text(
        zoomed
          ? `Methods fan, ${zoomedCategory}`
          : "Methods fan",
      );
    svg
      .append("desc")
      .attr("id", "methods-fan-desc")
      .text(
        zoomed
          ? `Zoomed into ${zoomedCategory}. Inner marks are methods used in this category, each with its own symbol. Names are in the method key; hover a mark to read it on the fan. Outer nodes are this category’s reports around the semicircle. Escape returns to all categories.`
          : "Inner marks are research methods, each with its own symbol. Names live in the method key; hover a mark to read it on the fan. Outer nodes are categories. A curve from a method to a category means reports in that category used the method. Activate a category to zoom in.",
      );

    const root = svg.append("g").attr("class", "fan-root");
    const wedgesG = root.append("g").attr("class", "fan-wedges");
    const guidesG = root.append("g").attr("class", "fan-guides");
    const bandsG = root.append("g").attr("class", "fan-bands");
    const catLabelsG = root.append("g").attr("class", "fan-cat-labels");
    const linksG = root.append("g").attr("class", "fan-links");
    const nodesG = root.append("g").attr("class", "fan-nodes");
    const labelG = root.append("g").attr("class", "fan-labels");

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((d) => d.id)
          .distance(() => Math.max(24, metrics.projectR - metrics.innerR))
          .strength(zoomed ? 0.08 : 0.12),
      )
      .force("charge", forceManyBody().strength(zoomed ? -18 : -20))
      .force(
        "collide",
        forceCollide()
          .radius((d) => d.r + (d.kind === "method" ? 10 : d.kind === "category" ? 10 : 2.8))
          .strength(0.85),
      )
      .force(
        "x",
        forceX((d) => metrics.cx + d.ring * Math.cos(d.angle)).strength((d) =>
          d.kind === "method" ? 0.72 : 0.78,
        ),
      )
      .force(
        "y",
        forceY((d) => metrics.cy + d.ring * Math.sin(d.angle)).strength((d) =>
          d.kind === "method" ? 0.72 : 0.78,
        ),
      )
      .velocityDecay(0.32)
      .stop();

    const linkSel = linksG
      .selectAll("path")
      .data(links, (d) => d.id)
      .join("path")
      .attr("class", (d) =>
        d.kind === "ribbon" ? "fan-link fan-ribbon" : "fan-link",
      )
      .attr("stroke", (d) => {
        if (d.color) return d.color;
        const target = nodeById.get(d.target.id ?? d.target);
        return target?.color ?? "#111";
      })
      .attr("stroke-dasharray", (d) => {
        if (d.dash) return d.dash;
        const target = nodeById.get(d.target.id ?? d.target);
        return CATEGORY_DASH[target?.category] || null;
      })
      .attr("stroke-width", (d) =>
        d.kind === "ribbon" ? 2.6 + 7 * Math.sqrt((d.count ?? 1) / maxRibbon) : 1.5,
      )
      .attr("aria-hidden", "true");

    const nodeSel = nodesG
      .selectAll("g")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", (d) => `fan-node is-${d.kind}`);
        g.append("circle")
          .attr("class", "hit")
          .attr("r", (d) => Math.max(14, d.r + 8));
        g.append("circle")
          .attr("class", "dot")
          .attr("r", (d) => d.r)
          .attr("fill", (d) => (d.kind === "method" ? "#f4efe6" : d.color));
        g.append("path").attr("class", "method-mark").attr("aria-hidden", "true");
        g.append("title");
        g.append("text")
          .attr("class", "cat-count")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("aria-hidden", "true")
          .text((d) => (d.kind === "category" ? d.count : ""));
        return g;
      });

    const methodSel = nodeSel.filter((d) => d.kind === "method");
    const categorySel = nodeSel.filter((d) => d.kind === "category");
    const projectSel = nodeSel.filter((d) => d.kind === "project");

    applyMethodMarks(methodSel);
    methodSel.select("title").text((d) => d.label);
    categorySel
      .select("title")
      .text((d) => `${d.label}, ${d.count} reports`);

    methodSel
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) =>
        zoomed
          ? `${d.label}, used in ${d.localCount ?? d.count} reports in this category`
          : `${d.label}, used in ${d.count} of ${graph.projects.length} reports`,
      );
    categorySel
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr(
        "aria-label",
        (d) => `${d.label} category, ${d.count} reports. Activate to zoom in.`,
      );
    projectSel
      .attr("tabindex", -1)
      .attr(
        "aria-label",
        (d) => `${d.title}, ${d.report.year ?? "year unknown"}`,
      );

    const methodLabelSel = labelG
      .selectAll("text.method-label")
      .data(
        nodes.filter((node) => node.kind === "method"),
        (d) => d.id,
      )
      .join("text")
      .attr("class", "method-label")
      .attr("dy", "0.32em")
      .attr("aria-hidden", "true")
      .text((d) => d.short);

    const outerLabelSel = labelG
      .selectAll("text.outer-label")
      .data(
        nodes.filter((node) => node.kind === "category" || node.kind === "project"),
        (d) => d.id,
      )
      .join("text")
      .attr("class", "outer-label")
      .attr("text-anchor", "middle")
      .attr("aria-hidden", "true")
      .each(function (d) {
        const text =
          d.kind === "category"
            ? d.label.replace(" and ", " & ")
            : String(d.report.year ?? "");
        const lines = d.kind === "category" ? wrapLines(text, 14) : [text];
        const sel = select(this);
        sel.selectAll("tspan").remove();
        lines.forEach((line, i) => {
          sel
            .append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? 0 : "1.1em")
            .text(line);
        });
        d.outerLines = lines.length;
      });

    const drag = d3drag()
      .on("start", (event, d) => {
        d.didDrag = false;
        if (!reduceMotion && !event.active) sim.alphaTarget(0.18).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.didDrag = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!reduceMotion && !event.active) sim.alphaTarget(0);
        if (d.kind === "method" || d.kind === "category") {
          const { cx, cy, angleStart, angleEnd } = metrics;
          let a = Math.atan2(d.y - cy, d.x - cx);
          if (a > 0) a = a > Math.PI / 2 ? angleStart : angleEnd;
          a = Math.max(angleStart, Math.min(angleEnd, a));
          d.angle = a;
          d.x = cx + d.ring * Math.cos(a);
          d.y = cy + d.ring * Math.sin(a);
          d.fx = d.x;
          d.fy = d.y;
        } else {
          d.fx = null;
          d.fy = null;
        }
        if (reduceMotion) ticked();
      });

    nodeSel.call(drag);

    function pinDesigned() {
      const { cx, cy } = metrics;
      for (const node of nodes) {
        if (node.kind !== "method" && node.kind !== "category") continue;
        node.x = cx + node.ring * Math.cos(node.angle);
        node.y = cy + node.ring * Math.sin(node.angle);
        node.fx = node.x;
        node.fy = node.y;
      }
    }

    pinDesigned();

    function emitFocus(item, event) {
      if (event) event.stopPropagation();
      onFocusRef.current?.(item);
    }

    function activate(d, event) {
      if (event) event.stopPropagation();
      if (d.didDrag) {
        d.didDrag = false;
        return;
      }
      if (d.kind === "category") {
        onZoomRef.current?.(d.id);
        return;
      }
      onSelectRef.current?.(d);
    }

    nodeSel
      .on("pointerenter", (event, d) => emitFocus(d, event))
      .on("pointerleave", () => onFocusRef.current?.(null))
      .on("click", (event, d) => activate(d, event));

    methodSel
      .on("focus", (event, d) => emitFocus(d, event))
      .on("blur", () => onFocusRef.current?.(null))
      .on("keydown", (event, d) => {
        const list = nodes.filter((node) => node.kind === "method");
        const index = list.findIndex((method) => method.id === d.id);
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(d, event);
          return;
        }
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!step || index < 0) return;
        event.preventDefault();
        const next = list[(index + step + list.length) % list.length];
        methodSel.filter((method) => method.id === next.id).node()?.focus();
      });

    categorySel
      .on("focus", (event, d) => emitFocus(d, event))
      .on("blur", () => onFocusRef.current?.(null))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(d, event);
        }
      });

    svg.on("click", () => {
      if (zoomed) onSelectRef.current?.(null);
      else onFocusRef.current?.(null);
    });
    svg.on("pointerleave", () => onFocusRef.current?.(null));

    function drawStatic() {
      const { cx, cy, innerR, projectR, bandInner, bandOuter, angleStart, angleEnd } =
        metrics;
      const bandSource = zoomed
        ? graph.categories.filter((item) => item.id === zoomedCategory)
        : graph.categories;
      const wedgeArc = d3arc()
        .innerRadius(innerR * 0.55)
        .outerRadius(bandOuter)
        .startAngle((d) => mathToArc(d.angle0))
        .endAngle((d) => mathToArc(d.angle1));
      const bandArc = d3arc()
        .innerRadius(bandInner)
        .outerRadius(bandOuter)
        .startAngle((d) => mathToArc(d.angle0))
        .endAngle((d) => mathToArc(d.angle1))
        .cornerRadius(2);

      wedgesG.attr("transform", `translate(${cx},${cy})`);
      bandsG.attr("transform", `translate(${cx},${cy})`);

      wedgesG
        .selectAll("path")
        .data(bandSource, (d) => d.id)
        .join("path")
        .attr("class", "fan-wedge")
        .attr("d", wedgeArc)
        .attr("fill", (d) => d.color)
        .on("pointerenter", (event, d) => {
          if (!zoomed) emitFocus(d, event);
        })
        .on("pointerleave", () => onFocusRef.current?.(null))
        .on("click", (event, d) => {
          if (zoomed) return;
          event.stopPropagation();
          onZoomRef.current?.(d.id);
        });

      bandsG
        .selectAll("path")
        .data(bandSource, (d) => d.id)
        .join("path")
        .attr("class", "fan-band")
        .attr("d", bandArc)
        .attr("fill", (d) => d.color)
        .attr("aria-hidden", "true");

      guidesG
        .selectAll("path.guide")
        .data([
          { id: "inner", r: innerR },
          { id: "outer", r: projectR },
        ])
        .join("path")
        .attr("class", (d) => `guide guide-${d.id}`)
        .attr("d", (d) => ringPath(cx, cy, d.r, angleStart, angleEnd));

      catLabelsG
        .selectAll("text.cat-band-label")
        .data(zoomed ? bandSource : [], (d) => d.id)
        .join("text")
        .attr("class", "cat-label cat-band-label")
        .attr("text-anchor", "middle")
        .attr("aria-hidden", "true")
        .each(function (d) {
          const pos = polar(cx, cy, bandOuter + 16, d.mid);
          select(this).attr("transform", `translate(${pos.x},${pos.y})`).text(d.label);
        });
    }

    function ticked() {
      const { cx, cy, angleStart, angleEnd } = metrics;
      for (const d of nodes) {
        if (d.fx != null) continue;
        let a;
        if (d.kind === "method" || d.kind === "category") {
          a = d.angle;
        } else {
          a = Math.atan2(d.y - cy, d.x - cx);
          if (a > 0) a = a > Math.PI / 2 ? angleStart : angleEnd;
          if (d.kind === "project" && d.angleMin != null) {
            a = Math.max(d.angleMin, Math.min(d.angleMax, a));
          } else {
            a = Math.max(angleStart, Math.min(angleEnd, a));
          }
        }
        d.x = cx + d.ring * Math.cos(a);
        d.y = cy + d.ring * Math.sin(a);
      }

      linkSel.attr("d", (d) => {
        const source = d.source.x != null ? d.source : nodeById.get(d.source);
        let target = d.target.x != null ? d.target : nodeById.get(d.target);
        if (!isPoint(source) || !isPoint(target)) return null;
        if (d.kind === "ribbon") {
          const sa = Math.atan2(source.y - cy, source.x - cx);
          const start = polar(
            cx,
            cy,
            source.ring + Math.max(14, source.r + 6),
            sa,
          );
          return bentLink(cx, cy, { source: start, target });
        }
        return bentLink(cx, cy, { source, target });
      });

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);

      methodLabelSel
        .attr("text-anchor", (d) => {
          const a = Math.atan2(d.y - cy, d.x - cx);
          return methodLabelAnchor(a);
        })
        .attr("transform", (d) => {
          const a = Math.atan2(d.y - cy, d.x - cx);
          const inward = Math.max(28, d.ring - d.r - 14);
          const p = polar(cx, cy, inward, a);
          return `translate(${p.x},${p.y})`;
        });

      outerLabelSel.attr("transform", (d) => {
        const a = Math.atan2(d.y - cy, d.x - cx);
        const outward =
          d.ring +
          d.r +
          (d.kind === "category" ? 16 : 12) +
          ((d.outerLines ?? 1) - 1) * 6;
        const p = polar(cx, cy, outward, a);
        return `translate(${p.x},${p.y})`;
      });
    }

    sim.on("tick", ticked);

    function applySize() {
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 40 || height < 40) return;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      if (zoomed && !didExplode && !reduceMotion) {
        layoutGraph(graph, width, height, null);
        const cat = graph.categories.find((item) => item.id === zoomedCategory);
        if (cat) explodeOrigin = { x: cat.x, y: cat.y };
      }
      metrics = layoutGraph(graph, width, height, zoomedCategory);
      nodeSel.select("circle.dot").attr("r", (d) => d.r);
      nodeSel.select("circle.hit").attr("r", (d) => Math.max(14, d.r + 8));
      applyMethodMarks(methodSel);
      pinDesigned();
      sim
        .force("link")
        .distance(Math.max(24, metrics.projectR - metrics.innerR));
      sim.force("x").x((d) => metrics.cx + d.ring * Math.cos(d.angle));
      sim.force("y").y((d) => metrics.cy + d.ring * Math.sin(d.angle));
      drawStatic();
      if (explodeOrigin && !didExplode && !reduceMotion) {
        for (const node of nodes) {
          if (node.kind === "project") {
            node.x = explodeOrigin.x;
            node.y = explodeOrigin.y;
          }
        }
        didExplode = true;
      }
      ticked();
      applyFocus(svgEl, focusRef.current, nodeById, graph.categories);
      if (reduceMotion) {
        sim.stop();
      } else {
        sim.alpha(zoomed && explodeOrigin ? 0.85 : 0.5).restart();
      }
    }

    const ro = new ResizeObserver(applySize);
    ro.observe(wrap);
    applySize();

    apiRef.current = {
      setFocus(next) {
        applyFocus(svgEl, next, nodeById, graph.categories);
      },
    };

    return () => {
      ro.disconnect();
      sim.stop();
      svg.on("click", null);
      svg.on("pointerleave", null);
      apiRef.current = null;
    };
  }, [reports, zoomedCategory]);

  useEffect(() => {
    apiRef.current?.setFocus(focus);
  }, [focus]);

  const zoomed = Boolean(zoomedCategory);

  return (
    <div className={`fan-wrap${zoomed ? " is-zoomed" : ""}`} ref={wrapRef}>
      <svg
        ref={svgRef}
        className={`fan${zoomed ? " is-zoomed" : ""}`}
        role="group"
        aria-labelledby="methods-fan-title methods-fan-desc"
      />
      {zoomed ? (
        <button
          type="button"
          className="zoom-back"
          aria-label="Show all categories"
          onClick={() => onZoom(null)}
        >
          All categories
        </button>
      ) : null}
      <p className="fan-caption">
        <span>inner → methods by symbol</span>
        <span>
          {zoomed
            ? `outer → ${zoomedCategory} reports`
            : "outer → category nodes"}
        </span>
        <span>line texture also marks category</span>
      </p>
    </div>
  );
}
