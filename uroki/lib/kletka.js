/* «Математика в клеточку — уроки у доски»: the book's own element library. Every lesson loads it right after
   engine.js and math.js. Names start with kl (or KL) so they never clash with the engine's or math.js's globals.
   What each piece does is listed under "components" in papermorph/books/uroki/style.json. */
'use strict';

/* ---------- interface words ---------- */
// In this book one engine "chapter" is one topic (тема) of the reference site «Математика в клеточку»; the site's
// chapters (главы) are the book's units. The engine's own Russian words say «глава», so the lessons say «тема».
Object.assign(TRANSLATIONS.ru, {
  chapterNumber: 'Тема {n}', chapterComplete: 'Тема {n} пройдена', chapterPractice: 'Практика по теме',
  allChapters: 'Все темы', nextChapter: 'Следующая тема',
});
{ const home = document.getElementById('bHome'); if (home) { home.setAttribute('aria-label', 'Все темы'); home.title = 'Все темы'; } }

/* ---------- colours that mean something (the same in every lesson) ---------- */
const KL = {
  NUM: COL.nat,      // числитель: взятые (закрашенные) части
  DEN: COL.whole,    // знаменатель: разрезы целого на равные части
  TWO: COL.irr,      // вторая дробь: второе слагаемое, вычитаемое, второй множитель
  WHOLE: COL.real,   // целые части смешанного числа
  RULE: COL.task,    // правило, главный вывод
};

/* ---------- text ---------- */
const klCtx = document.createElement('canvas').getContext('2d');
// Width of a line of interface text (the UI face) at a size and weight.
function klW(str, size, weight = 500) { klCtx.font = `${weight} ${size}px ${UI}`; return klCtx.measureText(str).width; }
// Interface text that fades in at t0 (no t0: shown at once).
function klText(p, str, x, y, t0, { size = 32, fill = COL.chalk, anchor = 'start', weight = 500 } = {}) {
  const e = T(p, str, { x, y, size, fill, anchor, weight, o: t0 === undefined ? 1 : 0 });
  if (t0 !== undefined) show(e, t0);
  return e;
}
// Mathematics (M parts: strings, F(n, d), E(x)) that fades in at t0, centred on x unless anchor says otherwise.
function klMath(p, parts, x, y, t0, { size = 56, fill = COL.chalk, anchor = 'middle' } = {}) {
  const e = M(p, [].concat(parts), { x, y, size, fill, anchor, o: t0 === undefined ? 1 : 0 });
  if (t0 !== undefined) show(e, t0);
  return e;
}
// One line mixing words and mathematics: pieces are strings (words) or { m: parts, fill? } (maths), laid out left to
// right with the baseline at y. Returns the line's group with _w.
function klRow(p, pieces, x, y, t0, { size = 36, fill = COL.chalk, anchor = 'middle', weight = 500, msize } = {}) {
  const g = G(p, { o: t0 === undefined ? 1 : 0 }), inner = G(g);
  let cx = 0;
  for (const it of pieces) {
    if (typeof it === 'string') { T(inner, it, { x: cx, y, size, fill, weight }); cx += klW(it, size, weight); }
    else { const e = M(inner, [].concat(it.m), { x: cx, y, size: msize || size * 1.3, fill: it.fill || fill, anchor: 'start' }); cx += e._w; }
  }
  put(inner, { x: x - (anchor === 'middle' ? cx / 2 : anchor === 'end' ? cx : 0) });
  g._w = cx;
  if (t0 !== undefined) show(g, t0);
  return g;
}
// The heading of a lesson picture: a line at the top left and, below it, a dim line that says what to look at.
function klTitle(p, str, sub, t0 = .1) {
  klText(p, str, 100, 112, t0, { size: 44, weight: 600 });
  if (sub) klText(p, sub, 100, 162, t0 + .1, { size: 27, fill: COL.dim });
}

/* ---------- a fraction with its meanings ---------- */
// A built-up fraction n/d: the numerator in KL.NUM over the denominator in KL.DEN, the bar centred on (x, y).
// Returns { g, num, den, bar, w } so the numerator and the denominator can be pulsed or recoloured on their own.
function klFrac(p, n, d, x, y, t0, { size = 96, numFill = KL.NUM, denFill = KL.DEN, barFill = COL.chalk, anchor = 'middle' } = {}) {
  const g = G(p, { x, y, o: t0 === undefined ? 1 : 0 });
  const w = Math.max(textW(String(n), size), textW(String(d), size)) + size * .36;
  const dx = anchor === 'start' ? w / 2 : anchor === 'end' ? -w / 2 : 0;
  // Each number sits in a group centred on its digits, so a pulse grows it in place.
  const num = G(g, { x: dx, y: -size * .55 }), den = G(g, { x: dx, y: size * .55 });
  T(num, String(n), { x: 0, y: size * .35, size, fill: numFill, font: MATH, anchor: 'middle' });
  T(den, String(d), { x: 0, y: size * .35, size, fill: denFill, font: MATH, anchor: 'middle' });
  const bar = path(g, `M${dx - w / 2} 0H${dx + w / 2}`, { stroke: barFill, 'stroke-width': size * .06, 'stroke-linecap': 'round' });
  if (t0 !== undefined) show(g, t0);
  return { g, num, den, bar, w };
}

/* ---------- one whole as a strip ---------- */
// A strip w × h at (x, y), cut into d equal cells by d − 1 lines in KL.DEN; the first n cells are shaded in fill.
// Returns { g, cells, cuts, frame, x, y, w, h, d, cw }: cells[i] is a group at its cell's left edge inside the strip,
// cuts are the cut lines (cuts: false draws them hidden, ready for draw()).
function klStrip(p, { x = 0, y = 0, w = 600, h = 80, d = 4, n = 0, fill = KL.NUM, t0, cuts = true, cutCol = KL.DEN, op = .85 } = {}) {
  const g = G(p, { x, y, o: t0 === undefined ? 1 : 0 }), cw = w / d;
  mk('rect', { x: 0, y: 0, width: w, height: h, fill: COL.chalk, 'fill-opacity': .07 }, g);
  const cells = [];
  for (let i = 0; i < n; i++) {
    const c = G(g, { x: i * cw, y: 0 });
    mk('rect', { width: cw, height: h, fill, 'fill-opacity': op }, c);
    cells.push(c);
  }
  const cutEls = [];
  for (let i = 1; i < d; i++) cutEls.push(path(g, `M${i * cw} 0V${h}`, { stroke: cutCol, 'stroke-width': 3 }, cuts ? {} : { d: 0 }));
  const frame = mk('rect', { x: 0, y: 0, width: w, height: h, fill: 'none', stroke: COL.chalk, 'stroke-width': 3.5, rx: 2 }, g);
  if (t0 !== undefined) show(g, t0);
  return { g, cells, cuts: cutEls, frame, x, y, w, h, d, cw };
}
// Draw a strip's hidden cuts in, one after another from t0.
function klCut(strip, t0, dur = .5) { strip.cuts.forEach((c, i) => draw(c, t0 + i * .06, dur)); }
// Loose pieces that each measure one d-th of a whole strip of width w: n groups side by side from (x, y), each with its
// own chalk edge so it reads as a separate piece. Move them with tw(piece, { x, y }, …); returns the array.
function klPieces(p, { n, d, w, h = 80, x = 0, y = 0, fill = KL.NUM, t0, step = .04, gap = 0, op = .85 }) {
  const cw = w / d;
  return Array.from({ length: n }, (_, i) => {
    const e = G(p, { x: x + i * (cw + gap), y, o: t0 === undefined ? 1 : 0 });
    mk('rect', { width: cw, height: h, fill, 'fill-opacity': op, stroke: COL.chalk, 'stroke-width': 2 }, e);
    if (t0 !== undefined) show(e, t0 + i * step);
    return e;
  });
}

/* ---------- one whole as a circle ---------- */
// A sector path of a circle of radius r around (0, 0): from angle a0 to a1 in degrees, 0 at the top, clockwise.
function klSectorD(r, a0, a1) {
  const pt = a => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)].map(v => v.toFixed(2)).join(' ');
  if (a1 - a0 >= 359.99) return `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`;
  return `M0 0L${pt(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}Z`;
}
// A circle («пицца») of radius r centred on (x, y), cut into d equal sectors from the top, clockwise; the first n are
// shaded. Returns { g, sectors, cuts, x, y, r, d }: sectors[i] is a group at the centre holding sector i, so moving it
// carries the slice and its r (degrees) turns it about the circle's centre. cuts: false draws the cuts hidden.
// edges: the angles where unequal cuts fall (0 … 360, from the top), instead of d equal sectors.
function klPie(p, { x, y, r = 120, d = 4, n = 0, fill = KL.NUM, t0, cuts = true, cutCol = KL.DEN, op = .85, edges } = {}) {
  const g = G(p, { o: t0 === undefined ? 1 : 0 });
  const E = edges || Array.from({ length: d + 1 }, (_, i) => i * 360 / d);
  mk('circle', { cx: x, cy: y, r, fill: COL.chalk, 'fill-opacity': .07 }, g);
  const sectors = [];
  for (let i = 0; i < n; i++) {
    const s = G(g, { x, y });
    path(s, klSectorD(r, E[i], E[i + 1]), { fill, 'fill-opacity': op, stroke: COL.chalk, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    sectors.push(s);
  }
  const cutEls = [];
  if (E.length > 2) for (let i = 0; i < E.length - 1; i++) {
    const a = E[i] * Math.PI / 180;
    cutEls.push(path(g, `M${x} ${y}L${(x + r * Math.sin(a)).toFixed(2)} ${(y - r * Math.cos(a)).toFixed(2)}`, { stroke: cutCol, 'stroke-width': 3, 'stroke-linecap': 'round' }, cuts ? {} : { d: 0 }));
  }
  mk('circle', { cx: x, cy: y, r, fill: 'none', stroke: COL.chalk, 'stroke-width': 3.5 }, g);
  if (t0 !== undefined) show(g, t0);
  return { g, sectors, cuts: cutEls, x, y, r, d };
}

/* ---------- the number ray ---------- */
// A number ray at height y: 0 at x0, u pixels per unit, up to max; ticks every 1/d with whole numbers labelled.
// Returns { g, X, y, u, x0 }: X(v) is the x of the number v.
function klRay(p, { x0 = 200, y = 450, u = 500, max = 2, d = 4, t0 = .2, size = 34, fill = COL.chalk } = {}) {
  const g = G(p, { o: 0 }), X = v => x0 + u * v, end = X(max) + 70;
  path(g, `M${x0 - 20} ${y}H${end}`, { stroke: fill, 'stroke-width': 3.5 });
  path(g, `M${end - 16} ${y - 11}L${end + 2} ${y}L${end - 16} ${y + 11}`, { stroke: fill, 'stroke-width': 3.5, fill: 'none', 'stroke-linejoin': 'round' });
  for (let k = 0; k <= max * d; k++) {
    const whole = k % d === 0, xx = X(k / d);
    path(g, `M${xx} ${y - (whole ? 18 : 10)}V${y + (whole ? 18 : 10)}`, { stroke: whole ? fill : KL.DEN, 'stroke-width': whole ? 3.5 : 2.5 });
    if (whole) T(g, String(k / d), { x: xx, y: y + 58, size, fill, font: MATH, anchor: 'middle' });
  }
  show(g, t0);
  return { g, X, y, u, x0 };
}
// A dot that hops along the ray through the values in order (one hop per value, each `per` seconds), from t0, above
// the ray (dir −1) or below it (dir +1, to compare two fractions on one ray). Returns the dot's group (at the first
// value, hidden until t0). Works on any { X, y } ray, klRay's or one of the chapter's own.
function klHops(p, ray, values, t0, { per = .45, fill = KL.NUM, r = 13, dir = -1 } = {}) {
  const dotG = G(p, { x: ray.X(values[0]), y: ray.y, o: 0 });
  mk('circle', { r, fill, stroke: COL.board, 'stroke-width': 3 }, dotG);
  show(dotG, t0, .25);
  for (let i = 1; i < values.length; i++) {
    const a = ray.X(values[i - 1]), b = ray.X(values[i]), s = t0 + .2 + (i - 1) * per;
    prog(q => put(dotG, { x: a + (b - a) * q, y: ray.y + dir * Math.sin(Math.PI * q) * 44 }), s, per * .9, io);
    const arcPath = path(p, `M${a} ${ray.y + dir * 6}Q${(a + b) / 2} ${ray.y + dir * 92} ${b} ${ray.y + dir * 6}`, { stroke: fill, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '7 7' }, { d: 0, o: .7 });
    draw(arcPath, s, per * .9);
  }
  return dotG;
}

/* ---------- marks ---------- */
// A strike drawn on over a mistake, from (x1, y1) to (x2, y2).
function klStrike(p, x1, y1, x2, y2, t0, dur = .4) {
  const e = path(p, `M${x1} ${y1}L${x2} ${y2}`, { stroke: COL.bad, 'stroke-width': 7, 'stroke-linecap': 'round' }, { d: 0 });
  draw(e, t0, dur);
  return e;
}
// A tick (ok) or a cross centred on (x, y), drawn on at t0.
function klMark(p, x, y, t0, ok = true, s = 1) {
  const g = G(p, { x, y, s });
  const d = ok ? 'M-26 2L-8 20L28 -22' : 'M-20 -20L20 20M20 -20L-20 20';
  draw(path(g, d, { stroke: ok ? COL.good : COL.bad, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, { d: 0 }), t0, .45);
  return g;
}
// Numbers that count objects one by one: labels 1, 2, 3 … appear over the points [[x, y], …] from t0, `step` apart.
function klCount(p, points, t0, { step = .18, size = 30, fill = COL.chalk, from = 1 } = {}) {
  return points.map(([x, y], i) => {
    const e = T(p, String(from + i), { x, y, size, fill, font: MATH, anchor: 'middle', weight: 600, o: 0 });
    tw(e, { o: 1 }, t0 + i * step, .2);
    return e;
  });
}

/* ---------- beats every lesson shares ---------- */
// The opening title card: the unit, the title, and one line of purpose that appears on the word after [[sub]].
// art(g, t0), when given, draws a small picture under the title on the card's own group.
function klIntro(m, D, { unit, title, sub, art }) {
  const g = G(scene, { o: 0, y: 24 });
  T(g, unit, { x: 800, y: 286, size: 28, fill: COL.dim, anchor: 'middle', weight: 600 });
  T(g, title, { x: 800, y: 396, size: title.length > 24 ? 74 : 84, weight: 600, anchor: 'middle' });
  tw(g, { o: 1, y: 0 }, .2, 1.1, out);
  const s = T(scene, sub, { x: 800, y: 486, size: 34, fill: COL.dim, anchor: 'middle', o: 0 });
  show(s, m('sub'));
  if (art) art(g, .6);
  tw(g, { o: 0, y: -24 }, D - .9, .8);
  hide(s, D - .9, .8);
}
// The summary: numbered takeaways, the k-th sliding in on [[wk]]. An item is a string or a list of klRow pieces.
function klWrap(m, items, title = 'Главное в этой теме') {
  const p = panel(0);
  klTitle(p, title);
  const top = items.length > 3 ? 270 : 300, gap = items.length > 3 ? 135 : 150;
  items.forEach((it, i) => {
    const g = G(p, { x: -16, y: top + i * gap, o: 0 });
    mk('circle', { cx: 170, cy: -12, r: 28, fill: KL.RULE }, g);
    T(g, String(i + 1), { x: 170, y: -1, size: 30, fill: COL.board, weight: 700, anchor: 'middle' });
    if (typeof it === 'string') T(g, it, { x: 230, size: 36, weight: 600 });
    else klRow(g, it, 230, 0, undefined, { size: 36, weight: 600, anchor: 'start' });
    tw(g, { o: 1, x: 0 }, m('w' + (i + 1)), .6);
  });
  return p;
}

/* ---------- more strips: re-cutting and hidden shading (from 3.2) ---------- */
// Cut every cell of a klStrip into k equal pieces: (k − 1) new KL.DEN lines per cell, drawn on one cell after another
// from t0. The strip's frame is moved back on top of the new cuts. Returns the new lines.
function klSplit(strip, k, t0, { step = .05, dur = .35, width = 2.5 } = {}) {
  const lines = [];
  for (let j = 0; j < strip.d; j++) for (let s = 1; s < k; s++) {
    const x = (j + s / k) * strip.cw;
    lines.push(path(strip.g, `M${x} 0V${strip.h}`, { stroke: KL.DEN, 'stroke-width': width }, { d: 0 }));
  }
  strip.g.append(strip.frame);
  lines.forEach((l, i) => draw(l, t0 + Math.floor(i / (k - 1)) * step, dur));
  return lines;
}
// Hidden shading for cells from … from + n − 1 of a klStrip, under its cuts and frame; bring it in with tw or fx on o.
function klShade(strip, from, n, fill = KL.NUM, op = .85) {
  return Array.from({ length: n }, (_, i) => {
    const r = mk('rect', { x: (from + i) * strip.cw, y: 0, width: strip.cw, height: strip.h, fill, 'fill-opacity': op }, null);
    strip.g.insertBefore(r, strip.g.children[1]);
    put(r, { o: 0 });
    return r;
  });
}

/* ---------- the hundred square (from 3.2): hundredths, percent, decimals ---------- */
// A 10 × 10 grid of cells of size c at (x, y): a shading layer under faint cell lines, a layer for block lines (top) and
// a frame. Returns { g, shade, top, x, y, c, W, cell(i, j, w, h, fill) }: cell() adds a hidden shaded block of w × h
// cells at row i, column j (bring it in with show).
function klHundred(p, { x, y, c = 46, t0 } = {}) {
  const g = G(p, { o: t0 === undefined ? 1 : 0 }), W = 10 * c;
  mk('rect', { x, y, width: W, height: W, fill: COL.chalk, 'fill-opacity': .07 }, g);
  const shade = G(g);
  let d = '';
  for (let k = 1; k < 10; k++) d += `M${x + k * c} ${y}V${y + W}M${x} ${y + k * c}H${x + W}`;
  path(g, d, { stroke: COL.chalk, 'stroke-width': 1.5, 'stroke-opacity': .35 });
  const top = G(g);
  mk('rect', { x, y, width: W, height: W, fill: 'none', stroke: COL.chalk, 'stroke-width': 3.5, rx: 2 }, g);
  if (t0 !== undefined) show(g, t0);
  const cell = (i, j, w = 1, h = 1, fill = KL.NUM) => put(mk('rect', { x: x + j * c, y: y + i * c, width: w * c, height: h * c, fill, 'fill-opacity': .85 }, shade), { o: 0 });
  return { g, shade, top, x, y, c, W, cell };
}

/* ---------- arrows, guides, brackets (from 3.2 and 3.4) ---------- */
// A curved arrow from (x1, y1) to (x2, y2) bending through the control height cy, its head shown as the line arrives.
function klArrow(p, x1, y1, x2, y2, cy, col, t0, dur = .6) {
  const mx = (x1 + x2) / 2;
  draw(path(p, `M${x1} ${y1}Q${mx} ${cy} ${x2} ${y2}`, { stroke: col, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' }, { d: 0 }), t0, dur);
  const a = Math.atan2(y2 - cy, x2 - mx), L = 18;
  const pt = da => `${(x2 - L * Math.cos(a + da)).toFixed(1)} ${(y2 - L * Math.sin(a + da)).toFixed(1)}`;
  const head = path(p, `M${pt(.45)}L${x2} ${y2}L${pt(-.45)}`, { stroke: col, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, { o: 0 });
  show(head, t0 + dur * .85, .2);
  return head;
}
// A thin dashed vertical guide from y1 to y2 at x (the edge of a shading that does not move), drawn on at t0.
function klGuide(p, x, y1, y2, t0, col = COL.chalk) {
  const e = path(p, `M${x} ${y1}V${y2}`, { stroke: col, 'stroke-width': 2.5, 'stroke-dasharray': '9 8' }, { d: 0, o: .8 });
  draw(e, t0, .5);
  return e;
}
// A bracket over (up) or under a stretch x1 … x2 at height y with its label, drawn on at t0. Returns the label.
function klBrace(p, x1, x2, y, label, t0, { up = true, fill = COL.chalk, size = 40 } = {}) {
  const k = up ? 12 : -12;
  draw(path(p, `M${x1} ${y + k}V${y}H${x2}V${y + k}`, { stroke: fill, 'stroke-width': 3, fill: 'none' }, { d: 0 }), t0, .5);
  return klText(p, label, (x1 + x2) / 2, up ? y - 14 : y + size * .95, t0 + .3, { size, fill, weight: 600, anchor: 'middle' });
}

/* ---------- worked lines in the meaning colours (from 3.3) ---------- */
// A row of fractions, whole parts and signs with every fraction bar on y. items:
//   { f: [n, d], num?, den? } a fraction (numerator KL.NUM, denominator KL.DEN unless given),
//   { w: '2', fill? }         the whole part of a mixed number (set tight against the fraction after it, KL.WHOLE),
//   { s: '+', fill? }         a sign or a plain number (chalk unless given).
// Each item fades in at its own t (or the row's t0; neither: shown at once). Returns the items, each with g (a group
// centred on the item, so pulse() grows it in place), fr (klFrac's parts) and c (its centre x); and x0, x1 (the ends).
function klExpr(p, items, x, y, { size = 80, gap, anchor = 'start', t0 } = {}) {
  gap = gap ?? size * .28;
  const big = size * 1.2;
  const ws = items.map(it => it.f ? Math.max(textW(String(it.f[0]), size), textW(String(it.f[1]), size)) + size * .36
    : textW(String(it.w ?? it.s), it.w !== undefined ? big : size));
  const sep = i => items[i - 1].w !== undefined && items[i].f ? size * .06 : gap;
  let total = 0;
  ws.forEach((w, i) => { total += w + (i ? sep(i) : 0); });
  let cx = x - (anchor === 'middle' ? total / 2 : anchor === 'end' ? total : 0);
  const out = items.map((it, i) => {
    if (i) cx += sep(i);
    const c = cx + ws[i] / 2, t = it.t ?? t0;
    cx += ws[i];
    if (it.f) {
      const fr = klFrac(p, it.f[0], it.f[1], c, y, t, { size, numFill: it.num || KL.NUM, denFill: it.den || KL.DEN });
      return { g: fr.g, fr, c, w: ws[i] };
    }
    const g = G(p, { x: c, y, o: t === undefined ? 1 : 0 });
    const sz = it.w !== undefined ? big : size;
    T(g, String(it.w ?? it.s), { x: 0, y: size * .35, size: sz, fill: it.fill || (it.w !== undefined ? KL.WHOLE : COL.chalk), font: MATH, anchor: 'middle' });
    if (t !== undefined) show(g, t);
    return { g, c, w: ws[i] };
  });
  out.x0 = x - (anchor === 'middle' ? total / 2 : anchor === 'end' ? total : 0);
  out.x1 = out.x0 + total;
  return out;
}
// One line of a worked column aligned on its sign at xEq: L ends left of it, R starts right of it (klExpr items).
// The sign appears at tEq (default t0); items keep their own t. Returns { l, eq, r }.
function klEq(p, L, R, y, t0, { xEq = 760, size = 60, tEq, sym = '=' } = {}) {
  const gap = size * .3;
  const l = L.length ? klExpr(p, L, xEq - gap - size * .3, y, { size, anchor: 'end', t0 }) : [];
  const eq = klExpr(p, [{ s: sym, t: tEq ?? t0 }], xEq, y, { size, anchor: 'middle' });
  const r = klExpr(p, R, xEq + gap + size * .3, y, { size, t0: tEq ?? t0 });
  return { l, eq, r };
}

/* ---------- the area picture (from 3.4): products, area, the distributive law ---------- */
// Diagonal hatching inside a w × h box: lines «/» every gap px, as one path's d.
function klHatch(w, h, gap) {
  let d = '';
  for (let k = gap / 2; k < w + h; k += gap) {
    const x0 = Math.max(0, k - h), x1 = Math.min(w, k);
    d += `M${x0.toFixed(1)} ${(k - x0).toFixed(1)}L${x1.toFixed(1)} ${(k - x1).toFixed(1)}`;
  }
  return d;
}
// A rectangle w × h at (x, y) cut into cols × rows cells: nc columns shaded in KL.TWO and nr rows hatched in KL.NUM, so
// the cells in both show both colours. Parts start hidden for the beat to bring in: colShade, rowShade, over (a frame
// round the cells in both) by show; vcuts, hcuts by draw. all: true shows everything at t0.
// Returns the parts and cc(i, j), the centre of the cell in row i, column j.
function klArea(p, { x, y, w, h, cols, rows, nc, nr, t0, all = false, hatch = 22 }) {
  const g = G(p, { x, y, o: t0 === undefined ? 1 : 0 }), cw = w / cols, rh = h / rows;
  mk('rect', { width: w, height: h, fill: COL.chalk, 'fill-opacity': .07 }, g);
  const colShade = G(g, { o: all ? 1 : 0 });
  mk('rect', { width: nc * cw, height: h, fill: KL.TWO, 'fill-opacity': .5 }, colShade);
  const rowShade = G(g, { o: all ? 1 : 0 });
  mk('rect', { width: w, height: nr * rh, fill: KL.NUM, 'fill-opacity': .2 }, rowShade);
  path(rowShade, klHatch(w, nr * rh, hatch), { stroke: KL.NUM, 'stroke-width': 4 });
  const cut = d => path(g, d, { stroke: KL.DEN, 'stroke-width': 3 }, all ? {} : { d: 0 });
  const vcuts = Array.from({ length: cols - 1 }, (_, i) => cut(`M${(i + 1) * cw} 0V${h}`));
  const hcuts = Array.from({ length: rows - 1 }, (_, i) => cut(`M0 ${(i + 1) * rh}H${w}`));
  mk('rect', { width: w, height: h, fill: 'none', stroke: COL.chalk, 'stroke-width': 3.5, rx: 2 }, g);
  const over = put(mk('rect', { x: -2, y: -2, width: nc * cw + 4, height: nr * rh + 4, fill: 'none', stroke: COL.chalk, 'stroke-width': 7, rx: 4 }, g), { o: all ? 1 : 0 });
  if (t0 !== undefined) show(g, t0);
  return { g, colShade, rowShade, vcuts, hcuts, over, cw, rh, x, y, w, h, cc: (i, j) => [x + (j + .5) * cw, y + (i + .5) * rh] };
}

/* ---------- counting units in groups (from 3.4): a fraction of a number, division, ratio ---------- */
// A strip of n unit cells w wide at (x, y), split into groups of `per` by thick dividers drawn at tSplit.
// Returns { s, cw, shade(k, t, fill), gx(k) }: shade(k, t) shades group k (cells k·per … k·per + per − 1) under the
// strip's lines; gx(k) is the centre x of group k.
function klUnits(p, { x, y, w, h = 80, n, per, t0, tSplit }) {
  const s = klStrip(p, { x, y, w, h, d: n, t0 });
  const cw = w / n, divs = [];
  for (let k = per; k < n; k += per) divs.push(path(p, `M${x + k * cw} ${y - 10}V${y + h + 10}`, { stroke: KL.DEN, 'stroke-width': 7, 'stroke-linecap': 'round' }, tSplit === undefined ? {} : { d: 0 }));
  if (tSplit !== undefined) divs.forEach((e, i) => draw(e, tSplit + i * .15, .4));
  const shade = (k, t, fill = KL.NUM) => {
    const r = put(mk('rect', { x: x + k * per * cw, y, width: per * cw, height: h, fill, 'fill-opacity': .85 }, p), { o: t === undefined ? 1 : 0 });
    p.insertBefore(r, s.g);
    if (t !== undefined) show(r, t, .4);
    return r;
  };
  return { s, cw, shade, gx: k => x + (k + .5) * per * cw };
}

/* ---------- a clock face (from 3.4): minutes as parts of an hour, time in motion problems ---------- */
// A clock of radius r centred on (cx, cy), shown at t0: hour marks and 12, 3, 6, 9 at once, the 48 small minute marks
// hidden. Returns { g, sweep(t, min, dur), ticksAt(t) }: sweep turns the minute hand from 12 to min minutes and shades
// that sector in KL.NUM; ticksAt brings the minute marks in one after another.
function klClock(p, cx, cy, r, t0) {
  const g = G(p, { o: 0 });
  mk('circle', { cx, cy, r, fill: COL.chalk, 'fill-opacity': .05 }, g);
  const sector = path(g, 'M0 0', { fill: KL.NUM, 'fill-opacity': .85, stroke: COL.chalk, 'stroke-width': 2 });
  const sg = G(g, { x: cx, y: cy }); sg.append(sector);
  const minutes = [];
  for (let k = 0; k < 60; k++) {
    const a = k * 6 * Math.PI / 180, big = k % 5 === 0, r0 = r - (big ? 24 : 12);
    const d = `M${(cx + r0 * Math.sin(a)).toFixed(1)} ${(cy - r0 * Math.cos(a)).toFixed(1)}L${(cx + (r - 3) * Math.sin(a)).toFixed(1)} ${(cy - (r - 3) * Math.cos(a)).toFixed(1)}`;
    const e = path(g, d, { stroke: big ? COL.chalk : KL.DEN, 'stroke-width': big ? 4 : 2.5, 'stroke-linecap': 'round' });
    if (!big) { put(e, { o: 0 }); minutes.push(e); }
  }
  [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([n, a]) => {
    const rr = r - 58, ar = a * Math.PI / 180;
    T(g, String(n), { x: cx + rr * Math.sin(ar), y: cy - rr * Math.cos(ar) + 13, size: 36, fill: COL.chalk, font: MATH, anchor: 'middle' });
  });
  mk('circle', { cx, cy, r, fill: 'none', stroke: COL.chalk, 'stroke-width': 4 }, g);
  const hand = G(g, { x: cx, y: cy });
  path(hand, `M0 14V${-r + 34}`, { stroke: COL.chalk, 'stroke-width': 6, 'stroke-linecap': 'round' });
  mk('circle', { r: 9, fill: COL.chalk }, hand);
  show(g, t0);
  return {
    g,
    sweep(t, min, dur = 1.6) {
      prog(q => {
        const a = min * 6 * q;
        sector.setAttribute('d', a > .2 ? klSectorD(r - 4, 0, a) : 'M0 0');
        put(hand, { r: a });
      }, t, dur, io);
    },
    ticksAt(t) { minutes.forEach((e, i) => show(e, t + i * .018, .2)); },
  };
}

/* ---------- the voice review page, on the computer where it runs ---------- */
// A lesson served by papermorph/tools/uroki/voice_review.py (its responses say «Server-Timing: golos») gets a
// «🎙 Озвучка» button: the beat on screen opens on that page, to listen to it and fix its stress. The published book
// and the other servers never say it, so there the button never shows and nothing is asked of any server.
{
  const ch = (location.pathname.match(/\/(ch\d\d)\/(?:index\.html)?$/) || [])[1];
  const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  if (ch && nav && (nav.serverTiming || []).some(s => s.name === 'golos')) {
    const a = document.createElement('a');
    a.textContent = '🎙 Озвучка';
    a.title = 'Этот шаг на странице проверки озвучки: послушать, поправить ударение';
    a.href = `/#${ch}`;
    a.target = 'golos';   // the review page names its tab so: the beat opens there
    a.style.cssText = 'position:fixed;top:10px;right:12px;z-index:50;padding:6px 12px;border-radius:16px;'
      + 'font:600 13px/1.2 system-ui,sans-serif;color:#eef3ef;background:rgba(18,28,24,.9);'
      + 'border:1px solid rgba(255,255,255,.22);text-decoration:none';
    a.addEventListener('click', () => {
      try {
        const beat = BEATS[P.i];   // the engine turns each [id, title, …] into { id, … }
        a.href = `/#${ch}/${beat.id || beat[0]}`;
        if (P.playing) setPlaying(false);
      } catch { /* the lesson has not started: its first beat */ }
    });
    const add = () => document.body.appendChild(a);
    if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  }
}
