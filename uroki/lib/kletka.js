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
// A dot that hops along the ray through the values in order (one hop per value, each `per` seconds), from t0.
// Returns the dot's group (at the first value, hidden until t0).
function klHops(p, ray, values, t0, { per = .45, fill = KL.NUM, r = 13 } = {}) {
  const dotG = G(p, { x: ray.X(values[0]), y: ray.y, o: 0 });
  mk('circle', { r, fill, stroke: COL.board, 'stroke-width': 3 }, dotG);
  show(dotG, t0, .25);
  for (let i = 1; i < values.length; i++) {
    const a = ray.X(values[i - 1]), b = ray.X(values[i]), s = t0 + .2 + (i - 1) * per;
    prog(q => put(dotG, { x: a + (b - a) * q, y: ray.y - Math.sin(Math.PI * q) * 46 }), s, per * .9, io);
    const arcPath = path(p, `M${a} ${ray.y - 6}Q${(a + b) / 2} ${ray.y - 96} ${b} ${ray.y - 6}`, { stroke: fill, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '7 7' }, { d: 0, o: .7 });
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
