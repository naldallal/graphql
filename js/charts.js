/**
 * charts.js
 * All SVG chart drawing functions.
 * Each function is self-contained and takes plain data as arguments.
 *
 * Functions exported (attached to window for use in profile.js):
 *  - drawXPTimeline(transactions)
 *  - drawPassFailChart(results)
 *  - drawAuditBarChart(upCount, downCount)
 *  - drawPiscineAttemptsBarChart(data)
 */

/* ─────────────────────────────────────────────────────────────────
   TOOLTIP HELPER
───────────────────────────────────────────────────────────────── */

/**
 * Create (or reuse) a single tooltip group inside the given SVG.
 *
 * Usage:
 *   const tip = createSvgTooltip(svg, { fontSize: 14, dark: true });
 *   tip.show(evt, "Hello");
 *   tip.hide();
 *   tip.attach(element, (evt) => "Dynamic text");
 *
 * @param {SVGSVGElement} svg
 * @param {object} [opts]
 * @param {number} [opts.fontSize=14]
 * @param {number} [opts.padX=10]
 * @param {number} [opts.padY=6]
 * @param {boolean} [opts.dark=true]
 * @param {{ x:number, y:number }} [opts.offset]
 * @returns {{ show, hide, attach, group }}
 */
function createSvgTooltip(svg, opts = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const {
    fontSize = 14,
    padX = 10,
    padY = 6,
    dark = true,
    offset = { x: 12, y: 12 },
  } = opts;

  let tipGroup = svg.querySelector(":scope > g.__svg-tooltip");
  if (!tipGroup) {
    tipGroup = document.createElementNS(ns, "g");
    tipGroup.classList.add("__svg-tooltip");
    tipGroup.setAttribute("opacity", "0");
    tipGroup.style.pointerEvents = "none";

    const tipBg = document.createElementNS(ns, "rect");
    tipBg.setAttribute("rx", 6);
    tipBg.setAttribute("ry", 6);
    tipBg.setAttribute("fill", dark ? "#0b1220" : "#ffffff");
    tipBg.setAttribute("stroke", dark ? "#334155" : "#cbd5e1");
    tipBg.setAttribute("stroke-width", "1");

    const tipText = document.createElementNS(ns, "text");
    tipText.setAttribute("fill", dark ? "#e2e8f0" : "#0f172a");
    tipText.setAttribute("font-size", String(fontSize));
    tipText.setAttribute("font-family", "DM Sans, sans-serif");
    tipText.setAttribute("dominant-baseline", "hanging");

    const tipTspan = document.createElementNS(ns, "tspan");
    tipText.appendChild(tipTspan);

    tipGroup.appendChild(tipBg);
    tipGroup.appendChild(tipText);
    svg.appendChild(tipGroup);
  }

  const tipBg    = tipGroup.querySelector("rect");
  const tipText  = tipGroup.querySelector("text");
  const tipTspan = tipText.querySelector("tspan");

  function getViewBoxMetrics() {
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const [minX, minY, W, H] = vb.split(/\s+/).map(Number);
      return { minX, minY, W, H };
    }
    const rect = svg.getBoundingClientRect();
    return { minX: 0, minY: 0, W: rect.width || 300, H: rect.height || 150 };
  }

  function show(evt, text) {
    // Re-append to ensure tooltip is always the topmost SVG element
    svg.appendChild(tipGroup);
    tipTspan.textContent = text ?? "";
    tipGroup.setAttribute("opacity", "1");
    tipText.setAttribute("x", "0");
    tipText.setAttribute("y", "0");

    const tb = tipText.getBBox();
    const bw = tb.width + padX * 2;
    const bh = tb.height + padY * 2;
    tipBg.setAttribute("width", String(bw));
    tipBg.setAttribute("height", String(bh));

    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const inv = svg.getScreenCTM()?.inverse();
    const loc = inv ? pt.matrixTransform(inv) : { x: 0, y: 0 };

    const { minX, minY, W, H } = getViewBoxMetrics();
    let tx = loc.x + offset.x;
    let ty = loc.y + offset.y;
    if (tx + bw > minX + W - 4) tx = loc.x - bw - offset.x;
    if (ty + bh > minY + H - 4) ty = loc.y - bh - offset.y;

    tipBg.setAttribute("x", String(tx));
    tipBg.setAttribute("y", String(ty));
    tipText.setAttribute("x", String(tx + padX));
    tipText.setAttribute("y", String(ty + padY));
  }

  function hide() {
    tipGroup.setAttribute("opacity", "0");
  }

  function attach(el, getText) {
    el.addEventListener("mousemove", (evt) => {
      show(evt, typeof getText === "function" ? getText(evt) : String(getText ?? ""));
    });
    el.addEventListener("mouseleave", hide);
    el.addEventListener("touchstart", (evt) => {
      const t = evt.touches?.[0];
      if (!t) return;
      show({ clientX: t.clientX, clientY: t.clientY },
           typeof getText === "function" ? getText(evt) : "");
    }, { passive: true });
    el.addEventListener("touchend", hide, { passive: true });
  }

  return { show, hide, attach, group: tipGroup };
}

/* ─────────────────────────────────────────────────────────────────
   1. XP TIMELINE (line chart)
───────────────────────────────────────────────────────────────── */

/**
 * Draw a cumulative XP-over-time line chart.
 * @param {Array<{ amount: number|string, createdAt: string }>} transactions
 */
function drawXPTimeline(transactions) {
  const svg = document.getElementById("xp-chart");
  if (!svg) return;
  svg.innerHTML = "";

  const width = 800, height = 300, padding = 50;

  let cumulativeXP = 0;
  const points = transactions.map((t) => {
    cumulativeXP += Number(t.amount) || 0;
    return { date: new Date(t.createdAt), xp: cumulativeXP };
  });

  if (!points.length) {
    svg.innerHTML = `<text x="400" y="150" text-anchor="middle" fill="#64748b" font-family="DM Sans,sans-serif">No XP data found.</text>`;
    return;
  }

  const tip = createSvgTooltip(svg, { fontSize: 13, dark: true });
  const ns = "http://www.w3.org/2000/svg";

  const minDate = points[0].date;
  const maxDate = points[points.length - 1].date;
  const maxXP   = Math.max(...points.map((p) => p.xp), 1);

  const scaleX = (date) =>
    padding + ((date - minDate) / (maxDate - minDate || 1)) * (width - 2 * padding);
  const scaleY = (xp) =>
    height - padding - (xp / maxXP) * (height - 2 * padding);

  const axisColor = "#334155";

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * (height - 2 * padding);
    const grid = document.createElementNS(ns, "line");
    grid.setAttribute("x1", padding);
    grid.setAttribute("y1", y);
    grid.setAttribute("x2", width - padding);
    grid.setAttribute("y2", y);
    grid.setAttribute("stroke", axisColor);
    grid.setAttribute("stroke-dasharray", "4 4");
    grid.setAttribute("stroke-opacity", "0.5");
    svg.appendChild(grid);

    // Y-axis labels
    const xpVal = Math.round(maxXP - (i / 4) * maxXP);
    const lbl = document.createElementNS(ns, "text");
    lbl.setAttribute("x", padding - 8);
    lbl.setAttribute("y", y + 4);
    lbl.setAttribute("text-anchor", "end");
    lbl.setAttribute("fill", "#64748b");
    lbl.setAttribute("font-size", "11");
    lbl.setAttribute("font-family", "DM Sans,sans-serif");
    lbl.textContent = formatXP(xpVal);
    svg.appendChild(lbl);
  }

  // Axes
  const xAxis = document.createElementNS(ns, "line");
  xAxis.setAttribute("x1", padding); xAxis.setAttribute("y1", height - padding);
  xAxis.setAttribute("x2", width - padding); xAxis.setAttribute("y2", height - padding);
  xAxis.setAttribute("stroke", "#475569");
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS(ns, "line");
  yAxis.setAttribute("x1", padding); yAxis.setAttribute("y1", padding);
  yAxis.setAttribute("x2", padding); yAxis.setAttribute("y2", height - padding);
  yAxis.setAttribute("stroke", "#475569");
  svg.appendChild(yAxis);

  // Area fill (gradient)
  const defs = document.createElementNS(ns, "defs");
  const grad = document.createElementNS(ns, "linearGradient");
  grad.setAttribute("id", "xpGrad");
  grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
  const stop1 = document.createElementNS(ns, "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", "#38bdf8");
  stop1.setAttribute("stop-opacity", "0.25");
  const stop2 = document.createElementNS(ns, "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "#38bdf8");
  stop2.setAttribute("stop-opacity", "0");
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Build path data
  let pathD = "";
  points.forEach((p, i) => {
    const x = scaleX(p.date);
    const y = scaleY(p.xp);
    pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Area path
  const firstX = scaleX(points[0].date);
  const lastX  = scaleX(points[points.length - 1].date);
  const areaD  = `${pathD} L ${lastX} ${height - padding} L ${firstX} ${height - padding} Z`;
  const area = document.createElementNS(ns, "path");
  area.setAttribute("d", areaD);
  area.setAttribute("fill", "url(#xpGrad)");
  svg.appendChild(area);

  // Line path with draw animation
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", pathD);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#38bdf8");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  const totalLen = path.getTotalLength?.() || pathD.length * 2;
  path.setAttribute("stroke-dasharray", String(totalLen));
  path.setAttribute("stroke-dashoffset", String(totalLen));
  path.style.transition = "stroke-dashoffset 2s ease-in-out";
  svg.appendChild(path);
  requestAnimationFrame(() => path.setAttribute("stroke-dashoffset", "0"));

  // Interactive dots
  points.forEach((p) => {
    const cx = scaleX(p.date);
    const cy = scaleY(p.xp);
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", 0);
    circle.setAttribute("fill", "#38bdf8");
    circle.setAttribute("stroke", "#060b14");
    circle.setAttribute("stroke-width", "2");
    circle.style.cursor = "pointer";
    circle.style.transition = "r 0.3s ease-out";
    tip.attach(circle, () => `XP: ${formatXP(p.xp)}  |  ${p.date.toLocaleDateString()}`);
    svg.appendChild(circle);
    setTimeout(() => circle.setAttribute("r", 4), 400);
  });
}

/* ─────────────────────────────────────────────────────────────────
   2. PASS / FAIL DONUT CHART
───────────────────────────────────────────────────────────────── */

/**
 * Draw a donut (ring) chart showing pass vs fail ratio.
 * @param {Array<{ grade: number|string }>} results
 */
function drawPassFailChart(results) {
  const svg = document.getElementById("passFailSvg");
  if (!svg) return;
  svg.innerHTML = "";
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "PASS vs FAIL ratio");

  const ns = "http://www.w3.org/2000/svg";
  const [, , W, H] = (svg.getAttribute("viewBox") || "0 0 300 300").split(/\s+/).map(Number);
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * 0.33;
  const strokeW = Math.min(W, H) * 0.106;
  const circumference = 2 * Math.PI * r;

  const pass  = results.filter((r) => Number(r.grade) >= 1).length;
  const fail  = results.filter((r) => Number(r.grade) < 1).length;
  const total = pass + fail || 1;
  const passPct = ((pass / total) * 100).toFixed(1);
  const failPct = ((fail / total) * 100).toFixed(1);

  const tip = createSvgTooltip(svg, { fontSize: 13, dark: true });

  // Track
  const base = document.createElementNS(ns, "circle");
  base.setAttribute("cx", cx); base.setAttribute("cy", cy); base.setAttribute("r", r);
  base.setAttribute("fill", "none");
  base.setAttribute("stroke", "#1e293b");
  base.setAttribute("stroke-width", strokeW);
  svg.appendChild(base);

  // PASS arc
  const passLen = circumference * (pass / total);
  const passArc = document.createElementNS(ns, "circle");
  passArc.setAttribute("cx", cx); passArc.setAttribute("cy", cy); passArc.setAttribute("r", r);
  passArc.setAttribute("fill", "none");
  passArc.setAttribute("stroke", "#22c55e");
  passArc.setAttribute("stroke-width", strokeW);
  passArc.setAttribute("stroke-linecap", "butt");
  passArc.setAttribute("stroke-dasharray", `${passLen} ${circumference - passLen}`);
  passArc.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
  passArc.style.cursor = "pointer";
  passArc.style.transition = "stroke-width 0.2s";
  svg.appendChild(passArc);

  // FAIL arc
  const failLen = circumference * (fail / total);
  const failArc = document.createElementNS(ns, "circle");
  failArc.setAttribute("cx", cx); failArc.setAttribute("cy", cy); failArc.setAttribute("r", r);
  failArc.setAttribute("fill", "none");
  failArc.setAttribute("stroke", "#ef4444");
  failArc.setAttribute("stroke-width", strokeW);
  failArc.setAttribute("stroke-linecap", "butt");
  failArc.setAttribute("stroke-dasharray", `${failLen} ${circumference - failLen}`);
  failArc.setAttribute("stroke-dashoffset", -passLen);
  failArc.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
  failArc.style.cursor = "pointer";
  failArc.style.transition = "stroke-width 0.2s";
  svg.appendChild(failArc);

  const enlarge = (el) => el.setAttribute("stroke-width", String(strokeW * 1.18));
  const reset   = (el) => el.setAttribute("stroke-width", String(strokeW));

  tip.attach(passArc, () => `PASS: ${pass} (${passPct}%)`);
  passArc.addEventListener("mouseenter", () => { enlarge(passArc); reset(failArc); });
  passArc.addEventListener("mouseleave", () => reset(passArc));

  tip.attach(failArc, () => `FAIL: ${fail} (${failPct}%)`);
  failArc.addEventListener("mouseenter", () => { enlarge(failArc); reset(passArc); });
  failArc.addEventListener("mouseleave", () => reset(failArc));

  // Center label
  const label = document.createElementNS(ns, "text");
  label.setAttribute("x", cx);
  label.setAttribute("y", cy - 10);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("font-size", "14");
  label.setAttribute("font-family", "Space Mono,monospace");
  label.setAttribute("fill", "#e2e8f0");
  label.textContent = `${passPct}%`;
  svg.appendChild(label);

  const sub = document.createElementNS(ns, "text");
  sub.setAttribute("x", cx);
  sub.setAttribute("y", cy + 14);
  sub.setAttribute("text-anchor", "middle");
  sub.setAttribute("font-size", "11");
  sub.setAttribute("font-family", "DM Sans,sans-serif");
  sub.setAttribute("fill", "#64748b");
  sub.textContent = "Pass rate";
  svg.appendChild(sub);

  // Legend
  const legend = [
    { color: "#22c55e", label: `Pass (${pass})`, x: cx - 55 },
    { color: "#ef4444", label: `Fail (${fail})`,  x: cx + 5  },
  ];
  legend.forEach(({ color, label: lbl, x }) => {
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x); dot.setAttribute("cy", H - 18); dot.setAttribute("r", 5);
    dot.setAttribute("fill", color);
    svg.appendChild(dot);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", x + 10); t.setAttribute("y", H - 14);
    t.setAttribute("fill", "#94a3b8");
    t.setAttribute("font-size", "11");
    t.setAttribute("font-family", "DM Sans,sans-serif");
    t.textContent = lbl;
    svg.appendChild(t);
  });

  const title = document.createElementNS(ns, "title");
  title.textContent = `PASS ${pass} (${passPct}%) — FAIL ${fail} (${failPct}%)`;
  svg.appendChild(title);
}

/* ─────────────────────────────────────────────────────────────────
   3. AUDIT BAR CHART (UP vs DOWN)
───────────────────────────────────────────────────────────────── */

/**
 * Draw a horizontal bar chart comparing audit up vs down counts.
 * @param {number} upCount
 * @param {number} downCount
 */
function drawAuditBarChart(upCount, downCount) {
  const svg = document.getElementById("auditBarSvg");
  if (!svg) return;
  svg.innerHTML = "";

  const ns = "http://www.w3.org/2000/svg";
  const [, , W, H] = (svg.getAttribute("viewBox") || "0 0 480 160").split(/\s+/).map(Number);

  const getVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  const colorUp   = getVar("--chart-green", "#22c55e");
  const colorDown = getVar("--chart-red",   "#ef4444");
  const colorAxis = getVar("--chart-slate", "#94a3b8");
  const colorCyan = getVar("--chart-cyan",  "#22d3ee");

  const PAD_L = 80, PAD_R = 24, PAD_T = 34, PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const barH = 28, gap = 16;
  const total  = Math.max(upCount + downCount, 1);
  const maxVal = Math.max(upCount, downCount, 1);

  const tip = createSvgTooltip(svg, { fontSize: 13, dark: true });

  // Title
  const title = document.createElementNS(ns, "text");
  title.setAttribute("x", PAD_L); title.setAttribute("y", PAD_T - 12);
  title.setAttribute("fill", colorAxis);
  title.setAttribute("font-size", "13");
  title.setAttribute("font-weight", "600");
  title.setAttribute("font-family", "Space Mono,monospace");
  title.textContent = "Audits — UP vs DOWN";
  svg.appendChild(title);

  // Ratio badge
  const ratio = ((upCount / total) * 100).toFixed(1);
  const badge = document.createElementNS(ns, "text");
  badge.setAttribute("x", W - PAD_R); badge.setAttribute("y", PAD_T - 12);
  badge.setAttribute("text-anchor", "end");
  badge.setAttribute("fill", colorCyan);
  badge.setAttribute("font-size", "12");
  badge.setAttribute("font-weight", "600");
  badge.setAttribute("font-family", "Space Mono,monospace");
  badge.textContent = `${ratio}% UP`;
  svg.appendChild(badge);

  const rows = [
    { label: "UP",   value: upCount,   color: colorUp },
    { label: "DOWN", value: downCount, color: colorDown },
  ];

  rows.forEach((row, idx) => {
    const y      = PAD_T + idx * (barH + gap);
    const labelY = y + barH / 2 + 5;
    const barW   = Math.max(2, Math.round((row.value / maxVal) * chartW));
    const pct    = ((row.value / total) * 100).toFixed(1);

    const lbl = document.createElementNS(ns, "text");
    lbl.setAttribute("x", PAD_L - 10); lbl.setAttribute("y", labelY);
    lbl.setAttribute("text-anchor", "end");
    lbl.setAttribute("fill", colorAxis);
    lbl.setAttribute("font-size", "13");
    lbl.setAttribute("font-family", "DM Sans,sans-serif");
    lbl.textContent = row.label;
    svg.appendChild(lbl);

    const bar = document.createElementNS(ns, "rect");
    bar.setAttribute("x", PAD_L); bar.setAttribute("y", y);
    bar.setAttribute("width", barW); bar.setAttribute("height", barH);
    bar.setAttribute("rx", Math.min(8, barH / 2));
    bar.setAttribute("fill", row.color);
    bar.style.cursor = "pointer";
    bar.addEventListener("mouseenter", () =>
      bar.setAttribute("filter", "drop-shadow(0 0 6px rgba(56,189,248,.35))"));
    bar.addEventListener("mouseleave", () => bar.removeAttribute("filter"));
    tip.attach(bar, () => `${row.label}: ${row.value} (${pct}%)`);
    svg.appendChild(bar);

    const val = document.createElementNS(ns, "text");
    val.setAttribute("x", PAD_L + barW + 8); val.setAttribute("y", labelY);
    val.setAttribute("fill", colorAxis);
    val.setAttribute("font-size", "12");
    val.setAttribute("font-family", "DM Sans,sans-serif");
    val.textContent = `${row.value} (${pct}%)`;
    svg.appendChild(val);
  });
}

/* ─────────────────────────────────────────────────────────────────
   4. PISCINE ATTEMPTS BAR CHART
───────────────────────────────────────────────────────────────── */

// /**
//  * Draw a horizontal bar chart of Piscine exercise attempt counts.
//  * @param {Array<{ name: string, attempts: number }>} data
//  */
// function drawPiscineAttemptsBarChart(data) {
//   const svg = document.getElementById("piscineAttemptsSvg");
//   if (!svg) return;
//   svg.innerHTML = "";

//   const ns = "http://www.w3.org/2000/svg";
//   const [, , W, H] = (svg.getAttribute("viewBox") || "0 0 800 400").split(/\s+/).map(Number);

//   const PAD_L = 200, PAD_R = 30, PAD_T = 44, PAD_B = 40;
//   const chartW = W - PAD_L - PAD_R;
//   const chartH = H - PAD_T - PAD_B;
//   const n = data.length;

//   if (n === 0) {
//     const msg = document.createElementNS(ns, "text");
//     msg.setAttribute("x", W / 2); msg.setAttribute("y", H / 2);
//     msg.setAttribute("text-anchor", "middle");
//     msg.setAttribute("fill", "#64748b");
//     msg.setAttribute("font-family", "DM Sans,sans-serif");
//     msg.setAttribute("font-size", "16");
//     msg.textContent = "No Piscine exercise data found.";
//     svg.appendChild(msg);
//     return;
//   }

//   const maxAttempts = Math.max(...data.map((d) => d.attempts), 1);
//   const barGap = Math.max(4, Math.floor(8 - n * 0.2));
//   const barH   = Math.max(14, Math.floor((chartH - barGap * (n - 1)) / n));

//   const tip = createSvgTooltip(svg, { fontSize: 13, dark: true });

//   // Title
//   const title = document.createElementNS(ns, "text");
//   title.setAttribute("x", PAD_L); title.setAttribute("y", PAD_T - 14);
//   title.setAttribute("fill", "#94a3b8");
//   title.setAttribute("font-size", "14");
//   title.setAttribute("font-weight", "600");
//   title.setAttribute("font-family", "Space Mono,monospace");
//   title.textContent = "Piscine — Attempts per Exercise";
//   svg.appendChild(title);

//   // Axis baseline
//   const axis = document.createElementNS(ns, "line");
//   axis.setAttribute("x1", PAD_L); axis.setAttribute("y1", H - PAD_B);
//   axis.setAttribute("x2", W - PAD_R); axis.setAttribute("y2", H - PAD_B);
//   axis.setAttribute("stroke", "#334155"); axis.setAttribute("stroke-width", "1.5");
//   svg.appendChild(axis);

//   data.forEach((d, i) => {
//     const y    = PAD_T + i * (barH + barGap);
//     const barW = Math.max(2, Math.round((d.attempts / maxAttempts) * chartW));
//     const labelY = y + barH / 2 + 5;

//     const label = document.createElementNS(ns, "text");
//     label.setAttribute("x", PAD_L - 10); label.setAttribute("y", labelY);
//     label.setAttribute("text-anchor", "end");
//     label.setAttribute("fill", "#e2e8f0");
//     label.setAttribute("font-size", "12");
//     label.setAttribute("font-family", "DM Sans,sans-serif");
//     label.textContent = d.name.length > 26 ? d.name.slice(0, 24) + "…" : d.name;
//     svg.appendChild(label);

//     const bar = document.createElementNS(ns, "rect");
//     bar.setAttribute("x", PAD_L); bar.setAttribute("y", y);
//     bar.setAttribute("width", barW); bar.setAttribute("height", barH);
//     bar.setAttribute("rx", Math.min(6, barH / 2));
//     bar.setAttribute("fill", "#22d3ee");
//     bar.style.cursor = "pointer";
//     bar.addEventListener("mouseenter", () => bar.setAttribute("fill", "#06b6d4"));
//     bar.addEventListener("mouseleave", () => bar.setAttribute("fill", "#22d3ee"));
//     tip.attach(bar, () => `${d.name} — Attempts: ${d.attempts}`);
//     svg.appendChild(bar);

//     const val = document.createElementNS(ns, "text");
//     val.setAttribute("x", PAD_L + barW + 6); val.setAttribute("y", labelY);
//     val.setAttribute("fill", "#64748b");
//     val.setAttribute("font-size", "11");
//     val.setAttribute("font-family", "DM Sans,sans-serif");
//     val.textContent = String(d.attempts);
//     svg.appendChild(val);
//   });
// }

/* ─── Utilities ─── */

/**
 * Format XP amount as a human-readable string (e.g. 12 500 kB).
 * The platform stores XP in bytes; display in kB.
 * @param {number} xp
 * @returns {string}
 */
function formatXP(xp) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)} MB`;
  if (xp >= 1_000)     return `${Math.round(xp / 1_000)} kB`;
  return `${xp} B`;
}