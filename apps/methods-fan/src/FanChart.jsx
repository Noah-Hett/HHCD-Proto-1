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
import { buildGraph, layoutGraph, polar, wrapLines } from "./graph.js";

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

function bentLink(cx, cy, d) {
  const source = d.source;
  const target = d.target;
  if (typeof source === "string" || typeof target === "string") return "";
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
        ? (categories.find((item) => item.id === focus.id) ?? null)
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
    for (const id of resolved.projectIds ?? []) {
      hotNodes.add(id);
      const project = nodeById.get(id);
      if (project?.category) hotCats.add(project.category);
    }
  } else if (resolved.kind === "project") {
    hotNodes.add(resolved.id);
    for (const id of resolved.methodIds ?? []) hotNodes.add(id);
    if (resolved.category) hotCats.add(resolved.category);
  } else {
    hotCats.add(resolved.id);
    for (const node of nodeById.values()) {
      if (node.kind === "project" && node.category === resolved.id) {
        hotNodes.add(node.id);
        for (const id of node.methodIds) hotNodes.add(id);
      }
    }
  }

  svg.selectAll(".fan-link").classed("is-hot", (d) => {
    const sourceId = d.source.id ?? d.source;
    const targetId = d.target.id ?? d.target;
    return hotNodes.has(sourceId) && hotNodes.has(targetId);
  });
  svg.selectAll(".fan-node").classed("is-hot", (d) => hotNodes.has(d.id));
  svg.selectAll(".method-label").classed("is-hot", (d) => hotNodes.has(d.id));
  svg
    .selectAll(".fan-band, .fan-wedge, .cat-label")
    .classed("is-hot", (d) => hotCats.has(d.id));
}

export function FanChart({ reports, focus, onFocus, onSelect }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const apiRef = useRef(null);
  const focusRef = useRef(focus);
  const onFocusRef = useRef(onFocus);
  const onSelectRef = useRef(onSelect);

  focusRef.current = focus;
  onFocusRef.current = onFocus;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const svg = select(svgEl);
    const graph = buildGraph(reports);
    const nodes = [...graph.methods, ...graph.projects];
    const links = graph.links.map((link) => ({ ...link }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let metrics = layoutGraph(
      graph,
      Math.max(wrap.clientWidth || 0, 800),
      Math.max(wrap.clientHeight || 0, 560),
    );

    svg.selectAll("*").remove();
    const root = svg.append("g").attr("class", "fan-root");
    const wedgesG = root.append("g").attr("class", "fan-wedges");
    const guidesG = root.append("g").attr("class", "fan-guides");
    const bandsG = root.append("g").attr("class", "fan-bands");
    const catLabelsG = root.append("g").attr("class", "fan-cat-labels");
    const linksG = root.append("g").attr("class", "fan-links");
    const nodesG = root.append("g").attr("class", "fan-nodes");
    const methodLabelsG = root.append("g").attr("class", "fan-method-labels");

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((d) => d.id)
          .distance(() => Math.max(24, metrics.projectR - metrics.innerR))
          .strength(0.06),
      )
      .force("charge", forceManyBody().strength(-12))
      .force(
        "collide",
        forceCollide()
          .radius((d) => d.r + 2.4)
          .strength(0.85),
      )
      .force(
        "x",
        forceX((d) => metrics.cx + d.ring * Math.cos(d.angle)).strength((d) =>
          d.kind === "project" ? 0.9 : 0.55,
        ),
      )
      .force(
        "y",
        forceY((d) => metrics.cy + d.ring * Math.sin(d.angle)).strength((d) =>
          d.kind === "project" ? 0.9 : 0.55,
        ),
      )
      .velocityDecay(0.32)
      .stop();

    const linkSel = linksG
      .selectAll("path")
      .data(links, (d) => d.id)
      .join("path")
      .attr("class", "fan-link")
      .attr("stroke", (d) => nodeById.get(d.target.id ?? d.target)?.color ?? "#111");

    const nodeSel = nodesG
      .selectAll("g")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", (d) => `fan-node is-${d.kind}`);
        g.append("circle")
          .attr("class", "hit")
          .attr("r", (d) => Math.max(10, d.r + 4));
        g.append("circle")
          .attr("class", "dot")
          .attr("r", (d) => d.r)
          .attr("fill", (d) => (d.kind === "method" ? "#161616" : d.color));
        return g;
      });

    const methodLabelSel = methodLabelsG
      .selectAll("text")
      .data(graph.methods, (d) => d.id)
      .join("text")
      .attr("class", "method-label")
      .attr("text-anchor", "middle")
      .each(function (d) {
        const lines = wrapLines(d.short, 14);
        const sel = select(this);
        sel.selectAll("tspan").remove();
        lines.forEach((line, i) => {
          sel
            .append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? 0 : "1.15em")
            .text(line);
        });
        d.labelLines = lines.length;
      });

    const drag = d3drag()
      .on("start", (event, d) => {
        d.didDrag = false;
        if (!event.active) sim.alphaTarget(0.18).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.didDrag = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(drag);

    function emitFocus(item, event) {
      if (event) event.stopPropagation();
      onFocusRef.current?.(item);
    }

    nodeSel
      .on("pointerenter", (event, d) => emitFocus(d, event))
      .on("pointerleave", () => onFocusRef.current?.(null))
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.didDrag) {
          d.didDrag = false;
          return;
        }
        onSelectRef.current?.(d);
      });

    svg.on("click", () => onSelectRef.current?.(null));
    svg.on("pointerleave", () => onFocusRef.current?.(null));

    function drawStatic() {
      const { cx, cy, innerR, projectR, bandInner, bandOuter, angleStart, angleEnd } =
        metrics;
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
        .data(graph.categories, (d) => d.id)
        .join("path")
        .attr("class", "fan-wedge")
        .attr("d", wedgeArc)
        .attr("fill", (d) => d.color)
        .on("pointerenter", (event, d) => emitFocus({ ...d, kind: "category" }, event))
        .on("pointerleave", () => onFocusRef.current?.(null))
        .on("click", (event, d) => {
          event.stopPropagation();
          onSelectRef.current?.({ ...d, kind: "category" });
        });

      bandsG
        .selectAll("path")
        .data(graph.categories, (d) => d.id)
        .join("path")
        .attr("class", "fan-band")
        .attr("d", bandArc)
        .attr("fill", (d) => d.color);

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
        .selectAll("text")
        .data(graph.categories, (d) => d.id)
        .join("text")
        .attr("class", "cat-label")
        .attr("text-anchor", "middle")
        .each(function (d) {
          const pos = polar(cx, cy, bandOuter + 16, d.mid);
          const sel = select(this);
          sel.attr("transform", `translate(${pos.x},${pos.y})`);
          const lines = wrapLines(d.label.replace(" and ", " & "), 16);
          sel.selectAll("tspan").remove();
          lines.forEach((line, i) => {
            sel
              .append("tspan")
              .attr("x", 0)
              .attr("dy", i === 0 ? 0 : "1.1em")
              .text(line);
          });
        });
    }

    function ticked() {
      const { cx, cy, angleStart, angleEnd } = metrics;
      for (const d of nodes) {
        if (d.fx != null) continue;
        let a = Math.atan2(d.y - cy, d.x - cx);
        if (a > 0) a = a > Math.PI / 2 ? angleStart : angleEnd;
        if (d.kind === "project") {
          a = Math.max(d.angleMin + 0.012, Math.min(d.angleMax - 0.012, a));
        } else {
          a = Math.max(angleStart, Math.min(angleEnd, a));
        }
        d.x = cx + d.ring * Math.cos(a);
        d.y = cy + d.ring * Math.sin(a);
      }

      linkSel.attr("d", (d) => bentLink(cx, cy, d));

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);

      methodLabelSel.attr("transform", (d) => {
        const a = Math.atan2(d.y - cy, d.x - cx);
        const inward = d.ring - d.r - 10 - (d.labelLines - 1) * 7;
        const p = polar(cx, cy, Math.max(18, inward), a);
        return `translate(${p.x},${p.y})`;
      });
    }

    sim.on("tick", ticked);

    function applySize() {
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 40 || height < 40) return;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      metrics = layoutGraph(graph, width, height);
      nodeSel.select("circle.dot").attr("r", (d) => d.r);
      nodeSel.select("circle.hit").attr("r", (d) => Math.max(10, d.r + 4));
      sim
        .force("link")
        .distance(Math.max(24, metrics.projectR - metrics.innerR));
      sim.force("x").x((d) => metrics.cx + d.ring * Math.cos(d.angle));
      sim.force("y").y((d) => metrics.cy + d.ring * Math.sin(d.angle));
      drawStatic();
      ticked();
      applyFocus(svgEl, focusRef.current, nodeById, graph.categories);
      sim.alpha(0.55).restart();
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
  }, [reports]);

  useEffect(() => {
    apiRef.current?.setFocus(focus);
  }, [focus]);

  return (
    <div className="fan-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="fan"
        role="img"
        aria-label="Force-directed fan: methods on the inner arc, reports on the outer arc grouped by category"
      />
      <p className="fan-caption">
        <span>inner → methods</span>
        <span>outer → reports by category</span>
      </p>
    </div>
  );
}
