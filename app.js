"use strict";
const D = window.DATA;
const SVGNS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};
function track(name, params = {}) { if (typeof gtag === "function") gtag("event", name, params); }

function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
}
const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

// ---------- Tooltip ----------
const tip = $("tooltip");
function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 18;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
}
const hideTip = () => { tip.hidden = true; };
const row = (label, value, color) =>
    `<div class="tt-row"><span>${color ? `<i style="background:${color}"></i>` : ""}${label}</span><b>${value}</b></div>`;

function grid(svg, y, ticks, x0, x1, fmt) {
    const g = el("g", { class: "grid" }, svg);
    for (const t of ticks) {
        el("line", { x1: x0, x2: x1, y1: y(t), y2: y(t) }, g);
        const lbl = el("text", { x: x0 - 8, y: y(t) + 4, "text-anchor": "end" }, g);
        lbl.textContent = fmt(t);
    }
}

// ---------- Hero tiles ----------
const pres = D.pres;
const majVotes = pres.filter((p) => p.ofVotes > 0.5).length;
const majPop = pres.filter((p) => p.ofPop > 0.5).length;
const best = pres.reduce((a, b) => (b.ofPop > a.ofPop ? b : a));
$("t-maj").textContent = majPop;
$("t-elec").textContent = pres.length;
$("t-best").textContent = `The closest anyone came: ${best.winner} in ${best.year}, with ${pct(best.ofPop)}.`;

const polled = D.congress.filter((c) => c.approval != null && c.house != null);
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const allApproval = D.congress.filter((c) => c.approval != null);
$("t-appr").textContent = Math.round(avg(allApproval.map((c) => c.approval)));
$("t-reel").textContent = Math.round(avg(polled.map((c) => c.house)));
$("t-span").textContent = `${allApproval[0].year}–${allApproval.at(-1).year}. In the House's worst year, ${Math.min(...polled.map((c) => c.house))}% were still sent back.`;

// ---------- Part 1: presidential bar chart ----------
let presMode = "ofVotes";
let presBars = [];
let presY = null;

function presSummary() {
    $("pres-summary").innerHTML = presMode === "ofVotes"
        ? `<b>${majVotes} of ${pres.length}</b> winners took a majority of the votes cast.`
        : `<b>${majPop} of ${pres.length}</b> won a majority of voting-age adults. The best: ${best.winner}, ${best.year}, at ${pct(best.ofPop)}.`;
}

function drawPres() {
    const box = $("pres-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), H = W < 560 ? 280 : 340;
    const m = { t: 16, r: 8, b: 28, l: 40 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Bar chart of each presidential winner's share, 1789 to 2024, against a 50 percent majority line" }, box);
    const y = scale(0, 1, H - m.b, m.t);
    presY = y;
    grid(svg, y, [0, 0.25, 0.75, 1], m.l, W - m.r, (t) => t * 100 + "%");
    const step = (W - m.l - m.r) / pres.length;
    const bw = Math.max(2, step - 2);
    const bands = el("g", {}, svg);
    const bars = el("g", {}, svg);
    presBars = pres.map((p, i) => {
        const x = m.l + i * step + 1;
        const band = el("rect", { class: "hover-band", x: x - 1, y: m.t, width: step, height: H - m.t - m.b }, bands);
        const v = p[presMode];
        const bar = el("rect", { class: "bar", x, width: bw, rx: Math.min(3, bw / 2), y: y(v), height: y(0) - y(v),
            fill: presMode === "ofPop" ? "var(--s-orange)" : "var(--s-blue)" }, bars);
        return { bar, band, p, x };
    });
    el("line", { class: "axis-line", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);
    for (const [i, p] of pres.entries()) {
        if (p.year % 40 === 0) {
            const t = el("text", { x: m.l + i * step + step / 2, y: H - 8, "text-anchor": "middle" }, svg);
            t.textContent = p.year;
        }
    }
    el("line", { class: "ref-line", x1: m.l, x2: W - m.r, y1: y(0.5), y2: y(0.5) }, svg);
    const rl = el("text", { class: "ref-label", x: W - m.r, y: y(0.5) - 7, "text-anchor": "end" }, svg);
    rl.textContent = "Majority · 50%";

    const hit = el("rect", { class: "hit", x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);
    let last = null;
    const move = (e) => {
        const pt = svg.getBoundingClientRect();
        const sx = ((e.clientX - pt.left) / pt.width) * W;
        const i = Math.max(0, Math.min(pres.length - 1, Math.floor((sx - m.l) / step)));
        if (last !== null) presBars[last].band.classList.remove("on");
        presBars[i].band.classList.add("on");
        last = i;
        const p = pres[i];
        showTip(`<div class="tt-h">${p.year} · ${p.winner}</div>` +
            row("Of votes cast", pct(p.ofVotes), "var(--s-blue)") +
            row("Of all voting-age adults", pct(p.ofPop), "var(--s-orange)") +
            row("Turnout", pct(p.turnout)), e.clientX, e.clientY);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", () => { hideTip(); if (last !== null) presBars[last].band.classList.remove("on"); });
    presSummary();
}

function animatePres() {
    const y = presY;
    const from = presBars.map((b) => +b.bar.getAttribute("y"));
    const color = presMode === "ofPop" ? "var(--s-orange)" : "var(--s-blue)";
    const dur = reduceMotion ? 0 : 750, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    presBars.forEach((b) => b.bar.setAttribute("fill", color));
    const frame = (now) => {
        const k = dur ? ease(Math.min(1, (now - t0) / dur)) : 1;
        presBars.forEach((b, i) => {
            const yy = from[i] + (y(b.p[presMode]) - from[i]) * k;
            b.bar.setAttribute("y", yy);
            b.bar.setAttribute("height", y(0) - yy);
        });
        if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    presSummary();
}

$("pres-mode").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn || btn.dataset.mode === presMode) return;
    presMode = btn.dataset.mode;
    for (const b of $("pres-mode").querySelectorAll("button")) b.setAttribute("aria-pressed", b === btn);
    animatePres();
    track("pres_measure_switch", { mode: presMode });
});

// ---------- Part 1: 100 adults ----------
const waffle = $("waffle");
for (let i = 0; i < 100; i++) waffle.appendChild(document.createElement("span"));
const sel = $("waffle-year");
for (const p of [...pres].reverse()) sel.add(new Option(`${p.year} · ${p.winner}`, p.year));

function hundred(parts) { // largest-remainder rounding to 100
    const raw = parts.map((v) => v * 100), out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => out[i]++);
    return out;
}
function drawWaffle() {
    const p = pres.find((q) => q.year === +sel.value);
    const [w, o, n] = hundred([p.ofPop, p.turnout - p.ofPop, 1 - p.turnout]);
    [...waffle.children].forEach((s, i) => { s.className = i < w ? "w" : i < w + o ? "o" : ""; });
    waffle.setAttribute("aria-label", `${p.year}: of 100 adults, ${w} voted for ${p.winner}, ${o} voted for someone else, ${n} did not vote`);
    $("waffle-legend").innerHTML =
        `<li><i style="background:var(--s-orange)"></i><b>${w}</b><small>voted for ${p.winner}</small></li>` +
        `<li><i style="background:var(--s-blue)"></i><b>${o}</b><small>voted for someone else</small></li>` +
        `<li><i style="background:var(--s-gray)"></i><b>${n}</b><small>did not vote</small></li>` +
        `<li><i style="background:transparent"></i><b>${o + n}</b><small>did not choose the winner</small></li>`;
}
sel.addEventListener("change", () => { drawWaffle(); track("waffle_year", { year: +sel.value }); });
sel.value = pres.at(-1).year;
drawWaffle();

$("pres-table").innerHTML = "<thead><tr><th>Year</th><th>Winner</th><th>Turnout</th><th>Of votes cast</th><th>Of voting-age adults</th></tr></thead><tbody>" +
    pres.map((p) => `<tr><td>${p.year}</td><td>${p.winner}</td><td>${pct(p.turnout)}</td><td>${pct(p.ofVotes)}</td><td>${pct(p.ofPop)}</td></tr>`).join("") + "</tbody>";

// ---------- Part 2: Congress over time ----------
const C = D.congress;
const SERIES = [
    { key: "approval", label: "Approval of Congress (yearly average)", color: "var(--s-orange)" },
    { key: "house", label: "House incumbents reelected", color: "var(--s-blue)" },
    { key: "senate", label: "Senate incumbents reelected", color: "var(--s-aqua)" },
];
$("cong-legend").innerHTML = SERIES.map((s) => `<span><i class="line" style="background:${s.color}"></i>${s.label}</span>`).join("") +
    `<span><i class="line" style="background:var(--s-orange);opacity:.35"></i>Individual Gallup polls</span>`;

function pathFor(pts) { return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(""); }

function drawCong() {
    const box = $("cong-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), H = W < 560 ? 300 : 360;
    const m = { t: 16, r: W < 560 ? 12 : 64, b: 28, l: 40 };
    const x0 = C[0].year, x1 = C.at(-1).year + 1;
    const x = scale(x0, x1, m.l, W - m.r), y = scale(0, 100, H - m.b, m.t);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Line chart: approval of Congress has mostly been between 15 and 50 percent, while House and Senate reelection rates stayed mostly between 80 and 100 percent" }, box);
    grid(svg, y, [0, 25, 50, 75, 100], m.l, W - m.r, (t) => t + "%");
    for (let yr = 1970; yr <= x1; yr += 10) {
        const t = el("text", { x: x(yr), y: H - 8, "text-anchor": "middle" }, svg);
        t.textContent = yr;
    }
    // every poll, faint
    const pollPts = D.polls.map(([d, v]) => { const dt = new Date(d); return [x(dt.getFullYear() + dt.getMonth() / 12 + 0.04), y(v)]; });
    el("path", { d: pathFor(pollPts), fill: "none", stroke: "var(--s-orange)", "stroke-width": 1, opacity: 0.35 }, svg);
    const ends = [];
    for (const s of SERIES) {
        const pts = C.filter((c) => c[s.key] != null).map((c) => [x(c.year + 0.5), y(c[s.key]), c]);
        el("path", { d: pathFor(pts), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
        if (s.key !== "approval") for (const [px, py] of pts) el("circle", { cx: px, cy: py, r: 3, fill: s.color, stroke: "var(--surface)", "stroke-width": 1.5 }, svg);
        ends.push({ s, last: pts.at(-1) });
    }
    if (W >= 560) {
        const labels = { approval: "Approval", house: "House", senate: "Senate" };
        // nudge apart overlapping end labels
        const placed = ends.map((e) => ({ ...e, ly: e.last[1] + 4 })).sort((a, b) => a.ly - b.ly);
        for (let i = 1; i < placed.length; i++) if (placed[i].ly - placed[i - 1].ly < 14) placed[i].ly = placed[i - 1].ly + 14;
        for (const e of placed) {
            const t = el("text", { class: "direct", x: e.last[0] + 8, y: e.ly }, svg);
            t.textContent = labels[e.s.key];
        }
    }
    const cross = el("line", { class: "crosshair", y1: m.t, y2: H - m.b, visibility: "hidden" }, svg);
    const hit = el("rect", { class: "hit", x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);
    const move = (e) => {
        const r = svg.getBoundingClientRect();
        const sx = ((e.clientX - r.left) / r.width) * W;
        const yr = Math.max(x0, Math.min(x1 - 1, Math.floor(x0 + ((sx - m.l) / (W - m.l - m.r)) * (x1 - x0))));
        const c = C.find((q) => q.year === yr);
        cross.setAttribute("x1", x(yr + 0.5)); cross.setAttribute("x2", x(yr + 0.5)); cross.setAttribute("visibility", "visible");
        let html = `<div class="tt-h">${yr}${c.house != null ? " · election year" : ""}</div>`;
        html += row("Approval", c.approval != null ? Math.round(c.approval) + "%" : "no poll", "var(--s-orange)");
        if (c.house != null) html += row("House reelected", c.house + "%", "var(--s-blue)") + row("Senate reelected", c.senate + "%", "var(--s-aqua)");
        showTip(html, e.clientX, e.clientY);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
}

// ---------- Part 2: scatter ----------
const SC = [
    { key: "house", label: "House", color: "var(--s-blue)" },
    { key: "senate", label: "Senate", color: "var(--s-aqua)" },
];
$("scatter-legend").innerHTML = SC.map((s) => `<span><i style="background:${s.color};border-radius:50%"></i>${s.label}</span>`).join("") +
    `<span><i class="line" style="background:var(--muted)"></i>Trend line</span>`;

function fit(key) {
    const pts = polled.filter((c) => c[key] != null).map((c) => [c.approval, c[key]]);
    const mx = avg(pts.map((p) => p[0])), my = avg(pts.map((p) => p[1]));
    const slope = pts.reduce((s, [a, b]) => s + (a - mx) * (b - my), 0) / pts.reduce((s, [a]) => s + (a - mx) ** 2, 0);
    return { slope, icpt: my - slope * mx, min: Math.min(...pts.map((p) => p[1])) };
}

function drawScatter() {
    const box = $("scatter-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), H = W < 560 ? 340 : 420;
    const m = { t: 16, r: 16, b: 44, l: 64 };
    const x = scale(0, 60, m.l, W - m.r), y = scale(0, 100, H - m.b, m.t);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Scatter plot of Congress approval against reelection rate for each election year since 1974" }, box);
    grid(svg, y, [0, 25, 50, 75, 100], m.l, W - m.r, (t) => t + "%");
    el("line", { class: "axis-line", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);
    const yl = el("text", { x: 0, y: 0, "text-anchor": "middle",
        transform: `translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)` }, svg);
    yl.textContent = "Incumbents reelected →";
    for (const t of [0, 10, 20, 30, 40, 50, 60]) {
        const lbl = el("text", { x: x(t), y: H - m.b + 18, "text-anchor": "middle" }, svg);
        lbl.textContent = t + "%";
    }
    const xl = el("text", { x: (m.l + W - m.r) / 2, y: H - 4, "text-anchor": "middle" }, svg);
    xl.textContent = "Approval of Congress that year →";
    for (const s of SC) {
        const f = fit(s.key);
        el("line", { x1: x(10), x2: x(58), y1: y(f.icpt + f.slope * 10), y2: y(f.icpt + f.slope * 58),
            stroke: s.color, "stroke-width": 1.5, "stroke-dasharray": "6 4", opacity: 0.8 }, svg);
    }
    for (const s of SC) {
        for (const c of polled) {
            const dot = el("circle", { cx: x(c.approval), cy: y(c[s.key]), r: 5, fill: s.color, stroke: "var(--surface)", "stroke-width": 2 }, svg);
            const hitc = el("circle", { cx: x(c.approval), cy: y(c[s.key]), r: 12, class: "hit" }, svg);
            const show = (e) => {
                dot.setAttribute("r", 7);
                showTip(`<div class="tt-h">${c.year} · ${s.label}</div>` + row("Approval", Math.round(c.approval) + "%", "var(--s-orange)") +
                    row(`${s.label} reelected`, c[s.key] + "%", s.color), e.clientX, e.clientY);
            };
            hitc.addEventListener("pointerenter", show);
            hitc.addEventListener("pointerdown", show);
            hitc.addEventListener("pointerleave", () => { dot.setAttribute("r", 5); hideTip(); });
        }
    }
}

(function corrCards() {
    const h = D.corr.house, s = D.corr.senate, fh = fit("house"), fs = fit("senate");
    const words = (r) => Math.abs(r) < 0.1 ? "No relationship at all." : Math.abs(r) < 0.3 ? "A weak relationship." : "A moderate relationship.";
    $("corr").innerHTML =
        `<div><span class="sw" style="background:var(--s-blue)"></span>House<strong>r = ${h.r.toFixed(2)}</strong>${words(h.r)} A 10-point drop in approval goes with about ${(fh.slope * 10).toFixed(1)} points lower reelection, and the rate never fell below ${fh.min}% in ${h.n} elections.</div>` +
        `<div><span class="sw" style="background:var(--s-aqua)"></span>Senate<strong>r = ${s.r.toFixed(2)}</strong>${words(s.r)} How Americans rated Congress tells you nothing about how many senators kept their seats.</div>`;
})();

$("cong-table").innerHTML = "<thead><tr><th>Year</th><th>Approval</th><th>House reelected</th><th>Senate reelected</th></tr></thead><tbody>" +
    C.filter((c) => c.approval != null || c.house != null).map((c) =>
        `<tr><td>${c.year}</td><td>${c.approval != null ? Math.round(c.approval) + "%" : "–"}</td><td>${c.house ?? "–"}${c.house != null ? "%" : ""}</td><td>${c.senate ?? "–"}${c.senate != null ? "%" : ""}</td></tr>`).join("") + "</tbody>";

for (const d of document.querySelectorAll(".table-view")) d.addEventListener("toggle", () => { if (d.open) track("table_open", { table: d.querySelector("table").id }); });

// ---------- Shared: horizontal paired bars ----------
// rows: [{ label, bars: [{ v (0-100), color, text, tip }] }]
function pairedBars(box, rows, { max = 100, ref = null, refLabel = "", aria = "" } = {}) {
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth);
    const narrow = W < 560;
    const m = { t: ref != null ? 26 : 8, r: narrow ? 8 : 16, b: 26, l: narrow ? 78 : 140 };
    const barH = 16, gap = 4, rowGap = 18;
    const rowH = rows[0].bars.length * (barH + gap) - gap;
    const H = m.t + rows.length * (rowH + rowGap) - rowGap + m.b;
    const x = scale(0, max, m.l, W - m.r);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": aria }, box);
    const g = el("g", { class: "grid" }, svg);
    for (let t = 0; t <= max; t += max > 60 ? 25 : 10) {
        el("line", { x1: x(t), x2: x(t), y1: m.t - 4, y2: H - m.b }, g);
        const lbl = el("text", { x: x(t), y: H - 8, "text-anchor": "middle" }, g);
        lbl.textContent = t + "%";
    }
    rows.forEach((r, ri) => {
        const y0 = m.t + ri * (rowH + rowGap);
        const lbl = el("text", { class: "cat", x: m.l - 10, y: y0 + rowH / 2 + 4, "text-anchor": "end" }, svg);
        lbl.textContent = r.label;
        r.bars.forEach((b, bi) => {
            const y = y0 + bi * (barH + gap);
            const w = Math.max(2, x(b.v) - x(0));
            el("rect", { x: x(0), y, width: w, height: barH, rx: 3, fill: b.color }, svg);
            const inside = w > 150;
            const t = el("text", { class: "val", x: inside ? x(0) + w - 6 : x(0) + w + 6, y: y + barH / 2 + 4,
                "text-anchor": inside ? "end" : "start" }, svg);
            if (inside) t.setAttribute("style", b.color === "var(--s-gray)" ? "fill:var(--text)" : "fill:#fff");
            t.textContent = b.text;
            const hit = el("rect", { class: "hit", x: m.l, y: y - gap / 2, width: W - m.l - m.r, height: barH + gap }, svg);
            const show = (e) => showTip(b.tip, e.clientX, e.clientY);
            hit.addEventListener("pointermove", show);
            hit.addEventListener("pointerdown", show);
            hit.addEventListener("pointerleave", hideTip);
        });
    });
    if (ref != null) {
        el("line", { class: "ref-line", x1: x(ref), x2: x(ref), y1: m.t - 8, y2: H - m.b }, svg);
        const rl = el("text", { class: "ref-label", x: x(ref), y: m.t - 12, "text-anchor": "middle" }, svg);
        rl.textContent = refLabel;
    }
}

// ---------- Part 1: popular-vote losers ----------
function drawLosers() {
    pairedBars($("losers-chart"), D.popLosers.map((p) => ({
        label: String(p.year),
        bars: [
            { v: p.winnerPct, color: "var(--s-orange)", text: `${p.winner} ${p.winnerPct}%`,
              tip: `<div class="tt-h">${p.year}</div>` + row(`${p.winner} (became president)`, p.winnerPct + "%", "var(--s-orange)") },
            { v: p.leaderPct, color: "var(--s-blue)", text: `${p.leader} ${p.leaderPct}%`,
              tip: `<div class="tt-h">${p.year}</div>` + row(`${p.leader} (most votes)`, p.leaderPct + "%", "var(--s-blue)") },
        ],
    })), { max: 60, ref: 50, refLabel: "Majority · 50%",
        aria: "Bar chart of the five elections where the president lost the popular vote: 1824, 1876, 1888, 2000 and 2016" });
}

// ---------- Part 2: trust in government ----------
const T = D.trust.map(([d, v, s]) => { const dt = new Date(d); return { t: dt.getFullYear() + dt.getMonth() / 12, yr: dt.getFullYear(), v, s }; });
const houseSince = C.filter((c) => c.house != null);
(function trustSummary() {
    const peak = T.reduce((a, b) => (b.v > a.v ? b : a)), last = T.at(-1);
    $("trust-summary").innerHTML = `Trust fell from <b>${peak.v}%</b> in ${peak.yr} to <b>${last.v}%</b> in ${last.yr}. In every House election over those years, at least ${Math.min(...houseSince.map((c) => c.house))}% of incumbents were reelected.`;
})();

function drawTrust() {
    const box = $("trust-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), H = W < 560 ? 300 : 360;
    const m = { t: 16, r: W < 560 ? 12 : 64, b: 28, l: 40 };
    const x0 = 1958, x1 = 2026;
    const x = scale(x0, x1, m.l, W - m.r), y = scale(0, 100, H - m.b, m.t);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Line chart: trust in the federal government fell from 77 percent in 1964 to 17 percent in 2025, while House reelection stayed near 90 percent" }, box);
    grid(svg, y, [0, 25, 50, 75, 100], m.l, W - m.r, (t) => t + "%");
    for (let yr = 1960; yr <= 2020; yr += 10) {
        const t = el("text", { x: x(yr), y: H - 8, "text-anchor": "middle" }, svg);
        t.textContent = yr;
    }
    for (const p of T) el("circle", { cx: x(p.t), cy: y(p.v), r: 2.5, fill: "var(--s-yellow)", opacity: 0.45 }, svg);
    const tp = T.map((p) => [x(p.t), y(p.s)]);
    el("path", { d: pathFor(tp), fill: "none", stroke: "var(--s-yellow)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    const hp = houseSince.map((c) => [x(c.year + 0.85), y(c.house)]);
    el("path", { d: pathFor(hp), fill: "none", stroke: "var(--s-blue)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    for (const [px, py] of hp) el("circle", { cx: px, cy: py, r: 3, fill: "var(--s-blue)", stroke: "var(--surface)", "stroke-width": 1.5 }, svg);
    if (W >= 560) {
        const a = el("text", { class: "direct", x: tp.at(-1)[0] + 8, y: tp.at(-1)[1] + 4 }, svg); a.textContent = "Trust";
        const b = el("text", { class: "direct", x: hp.at(-1)[0] + 8, y: hp.at(-1)[1] + 4 }, svg); b.textContent = "House";
    }
    const cross = el("line", { class: "crosshair", y1: m.t, y2: H - m.b, visibility: "hidden" }, svg);
    const hit = el("rect", { class: "hit", x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);
    const move = (e) => {
        const r = svg.getBoundingClientRect();
        const yr = Math.max(x0, Math.min(x1 - 1, Math.floor(x0 + ((((e.clientX - r.left) / r.width) * W - m.l) / (W - m.l - m.r)) * (x1 - x0))));
        cross.setAttribute("x1", x(yr + 0.5)); cross.setAttribute("x2", x(yr + 0.5)); cross.setAttribute("visibility", "visible");
        const polls = T.filter((p) => p.yr === yr);
        const h = houseSince.find((c) => c.year === yr);
        let html = `<div class="tt-h">${yr}</div>`;
        html += row("Trust in government", polls.length ? Math.round(avg(polls.map((p) => p.v))) + "%" + (polls.length > 1 ? ` (avg of ${polls.length} polls)` : "") : "no poll", "var(--s-yellow)");
        if (h) html += row("House reelected", h.house + "%", "var(--s-blue)");
        showTip(html, e.clientX, e.clientY);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", () => { hideTip(); cross.setAttribute("visibility", "hidden"); });
}

// ---------- Part 3: primaries and margins ----------
// Unite America, 2024: 380 seats decided by 18.1 million voters; 169 members ran unopposed in the primary for a safe seat.
const p24 = D.primaries.at(-1);
$("primary-stats").innerHTML =
    `<div><strong>${p24.seats}%</strong>of House seats (380 of 435) were effectively decided in ${p24.year} primaries</div>` +
    `<div><strong>${p24.voters}%</strong>of voting-age Americans cast those deciding votes, about 18.1 million people</div>` +
    `<div><strong>169</strong>House members had no primary opponent for a safe seat, so they were effectively elected without facing a single challenger</div>`;

function drawPrimary() {
    pairedBars($("primary-chart"), D.primaries.map((p) => ({
        label: String(p.year),
        bars: [
            { v: p.seats, color: "var(--s-blue)", text: p.seats + "% of seats", tip: `<div class="tt-h">${p.year}</div>` + row("House seats decided in primary", p.seats + "%", "var(--s-blue)") },
            { v: p.voters, color: "var(--s-orange)", text: p.voters + "% of Americans", tip: `<div class="tt-h">${p.year}</div>` + row("Americans who decided them", p.voters + "%", "var(--s-orange)") },
        ],
    })), { aria: "Bar chart: in 2020, 2022 and 2024, 83 to 87 percent of House seats were effectively decided in primaries by 7 to 10 percent of voting-age Americans" });
}

function drawMargins() {
    const box = $("margin-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), narrow = W < 560;
    const m = { t: 8, r: 8, b: 8, l: 48 };
    const barH = 30, gap = 14;
    const rows = D.margins;
    const H = m.t + rows.length * (barH + gap) - gap + m.b;
    const x = scale(0, 435, m.l, W - m.r);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Stacked bars of all 435 House races in 2018 through 2024: in each year roughly 80 to 84 percent were decided by more than 10 points" }, box);
    rows.forEach((r, i) => {
        const y = m.t + i * (barH + gap);
        const lbl = el("text", { class: "cat", x: m.l - 10, y: y + barH / 2 + 4, "text-anchor": "end" }, svg);
        lbl.textContent = r.year;
        const segs = [
            { n: r.within5, color: "var(--m-close)", name: "Within 5 points" },
            { n: r.within10 - r.within5, color: "var(--m-mid)", name: "5–10 points" },
            { n: 435 - r.within10, color: "var(--m-blow)", name: "More than 10 points" },
        ];
        let acc = 0;
        segs.forEach((s, si) => {
            const x0 = x(acc) + (si ? 1 : 0), x1 = x(acc + s.n) - (si < 2 ? 1 : 0);
            el("rect", { x: x0, y, width: Math.max(1, x1 - x0), height: barH, rx: 3, fill: s.color }, svg);
            const share = Math.round((s.n / 435) * 100);
            if (si === 2) {
                const t = el("text", { class: "val", x: x1 - 8, y: y + barH / 2 + 5, "text-anchor": "end" }, svg);
                t.setAttribute("style", "fill:var(--surface)");
                t.textContent = narrow ? `${share}% not close` : `${s.n} races (${share}%) not close`;
            }
            const hit = el("rect", { class: "hit", x: x0, y, width: Math.max(1, x1 - x0), height: barH }, svg);
            const show = (e) => showTip(`<div class="tt-h">${r.year} House races</div>` + row(s.name, `${s.n} (${share}%)`, s.color), e.clientX, e.clientY);
            hit.addEventListener("pointermove", show);
            hit.addEventListener("pointerdown", show);
            hit.addEventListener("pointerleave", hideTip);
            acc += s.n;
        });
    });
}

// ---------- Part 4: Gilens & Page ----------
const G = D.gilens;
const POLICY_ROWS = [
    { name: "Average Americans", sub: "middle income", lo: G.adopt.citizensLow, hi: G.adopt.citizensHigh,
      loWhen: "1 in 5 favor it", hiWhen: "4 in 5 favor it" },
    { name: "Affluent Americans", sub: "top 10% by income", lo: G.adopt.elitesLow, hi: G.adopt.elitesHigh,
      loWhen: "1 in 5 favor it", hiWhen: "4 in 5 favor it" },
    { name: "Organized interest groups", sub: "business and advocacy groups", lo: G.adopt.groupsLow, hi: G.adopt.groupsHigh,
      loWhen: "groups strongly oppose it", hiWhen: "groups strongly favor it" },
];
$("policy-summary").innerHTML = `When average Americans switch from opposing a policy to supporting it, its chances <b>don't move</b>. When the affluent or interest groups switch, its chances <b>more than double</b>.`;
$("policy-foot").textContent = `Even when 80% of the public favored a change, it became law only about ${G.bigMajority}% of the time. Each group's chances are measured with the other two held neutral.`;

function drawPolicy() {
    const box = $("policy-chart");
    box.innerHTML = "";
    const W = Math.max(320, box.clientWidth), narrow = W < 560;
    const m = { t: 8, r: narrow ? 64 : 110, b: 28, l: 16 };
    const rowH = 74;
    const H = m.t + POLICY_ROWS.length * rowH + m.b;
    const x = scale(0, 60, m.l + 6, W - m.r);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
        "aria-label": "Chance a policy becomes law: average Americans 30 percent whether they oppose or support it; affluent Americans 18 to 45 percent; interest groups 16 to 47 percent" }, box);
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--s-blue)" }, mk);
    const g = el("g", { class: "grid" }, svg);
    for (let t = 0; t <= 60; t += 10) {
        el("line", { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b }, g);
        const l = el("text", { x: x(t), y: H - 8, "text-anchor": "middle" }, g);
        l.textContent = t + "%";
    }
    POLICY_ROWS.forEach((r, i) => {
        const top = m.t + i * rowH;
        const ty = top + 22, cy = top + 46;
        const name = el("text", { class: "row-label", x: m.l, y: ty }, svg);
        name.textContent = r.name;
        if (!narrow) {
            const sub = el("tspan", { class: "row-sub", dx: 8 }, name);
            sub.textContent = r.sub;
        }
        el("line", { class: "track", x1: x(0), x2: x(60), y1: cy, y2: cy }, svg);
        const d = r.hi - r.lo;
        if (d > 0) {
            el("line", { x1: x(r.lo) + 8, x2: x(r.hi) - 13, y1: cy, y2: cy, stroke: "var(--s-blue)", "stroke-width": 3, "marker-end": "url(#arrow)" }, svg);
        }
        el("circle", { cx: x(r.lo), cy, r: 8, fill: "var(--s-gray)", stroke: "var(--surface)", "stroke-width": 2 }, svg);
        el("circle", { cx: x(r.hi), cy, r: 8, fill: "var(--s-blue)", stroke: "var(--surface)", "stroke-width": 2, opacity: d > 0 ? 1 : 0.9 }, svg);
        const lv = el("text", { class: "val", x: x(r.lo), y: cy + 24, "text-anchor": "middle" }, svg);
        lv.textContent = d > 0 ? r.lo + "%" : r.lo + "% either way";
        if (d > 0) { const hv = el("text", { class: "val", x: x(r.hi), y: cy + 24, "text-anchor": "middle" }, svg); hv.textContent = r.hi + "%"; }
        const dt = el("text", { class: "delta", x: W - 4, y: cy + 2, "text-anchor": "end" }, svg);
        dt.textContent = d > 0 ? `+${d} pts` : "0";
        const ds = el("text", { class: "delta-sub", x: W - 4, y: cy + 18, "text-anchor": "end" }, svg);
        ds.textContent = d > 0 ? (narrow ? `×${(r.hi / r.lo).toFixed(1)}` : `${(r.hi / r.lo).toFixed(1)}× the chance`) : "no change";
        const hit = el("rect", { class: "hit", x: 0, y: top, width: W, height: rowH }, svg);
        const show = (e) => showTip(`<div class="tt-h">${r.name}</div>` +
            row(`When ${r.loWhen}`, "about " + r.lo + "%", "var(--s-gray)") +
            row(`When ${r.hiWhen}`, "about " + r.hi + "%", "var(--s-blue)"), e.clientX, e.clientY);
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("pointerleave", hideTip);
    });
}

// ---------- Render + resize ----------
function drawAll() { drawPres(); drawCong(); drawScatter(); drawLosers(); drawTrust(); drawPrimary(); drawMargins(); drawPolicy(); }
drawAll();
let rz, lastW = innerWidth;
addEventListener("resize", () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(drawAll, 150);
});
document.addEventListener("scroll", hideTip, { passive: true });

// ---------- Theme ----------
$("theme").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("sandTheme", root.dataset.theme);
    track("theme_toggle", { theme: root.dataset.theme });
});

// ---------- Install (PWA) ----------
addEventListener("appinstalled", () => track("app_installed"));
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

// ---------- Support callout ----------
const SUPPORT_DAY_MS = 20 * 60 * 60 * 1000;
const SUPPORT_FIRST_VISITS_THRESHOLD = 10;
const SUPPORT_FIRST_DAYS_THRESHOLD = 3;
const SUPPORT_RESHOW_INTERVAL_DAYS = 24;
const SUPPORT_MAX_MAYBE_LATER = 5;
const supportCallout = $("support-callout");
const supportLink = $("support");
// Keys prefixed so other apps on sots1689.github.io don't share the setting
const K = (k) => "sand_" + k;

function trackSupportUsage() {
    if (store.get(K("supportDismissedForever"), false) || store.get(K("supportActed"), false)) return;
    const visits = store.get(K("supportVisits"), 0) + 1;
    store.set(K("supportVisits"), visits);
    let days = store.get(K("supportDaysUsed"), 0);
    const today = new Date().toISOString().slice(0, 10);
    if (store.get(K("supportLastDayUsed"), "") !== today) {
        days += 1;
        store.set(K("supportDaysUsed"), days);
        store.set(K("supportLastDayUsed"), today);
    }
    if (store.get(K("supportMaybeLaterCount"), 0) >= SUPPORT_MAX_MAYBE_LATER) return;
    const lastShown = store.get(K("supportLastShown"), 0);
    const due = lastShown === 0
        ? visits >= SUPPORT_FIRST_VISITS_THRESHOLD || days >= SUPPORT_FIRST_DAYS_THRESHOLD
        : Date.now() - lastShown >= SUPPORT_RESHOW_INTERVAL_DAYS * SUPPORT_DAY_MS;
    if (due) setTimeout(showSupportCallout, 1500);
}
function showSupportCallout() {
    supportCallout.classList.add("open");
    store.set(K("supportLastShown"), Date.now());
    track("support_callout_shown");
    setTimeout(() => document.addEventListener("click", supportOutsideClick), 0);
}
function supportOutsideClick(e) {
    if (supportCallout.contains(e.target) || supportLink.contains(e.target)) return;
    supportCallout.classList.remove("open");
    document.removeEventListener("click", supportOutsideClick);
}
function supportDismiss(mode) {
    supportCallout.classList.remove("open");
    document.removeEventListener("click", supportOutsideClick);
    if (mode === "forever") store.set(K("supportDismissedForever"), true);
    else if (mode === "later") store.set(K("supportMaybeLaterCount"), store.get(K("supportMaybeLaterCount"), 0) + 1);
    else if (mode === "acted") store.set(K("supportActed"), true);
    if (mode === "forever" || mode === "later") track("support_callout_dismiss", { choice: mode });
}
supportLink.addEventListener("click", () => { track("support_click", { source: "heart" }); supportDismiss("acted"); });
supportCallout.querySelector('[data-support="acted"]').addEventListener("click", () => track("support_click", { source: "callout" }));
supportCallout.querySelectorAll("[data-support]").forEach((b) => b.addEventListener("click", () => supportDismiss(b.dataset.support)));
trackSupportUsage();
