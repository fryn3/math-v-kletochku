// Chalk sketches for the unit headers on the contents page, one per unit, drawn in the unit's colour.
// Each entry is the inside of an SVG with viewBox 0 0 600 180; keep the left ~200 px light (the unit title sits there
// on narrow screens). The sketches are keyed by the unit's own number (UNIT_ART_BY_UNIT); index.html builds the
// engine's UNIT_ART list from the units it shows, so a unit can be added before the ones ahead of it.
// Classes, styled in lib/units.css:
//   d  a stroke that draws itself in when the unit scrolls into view (--k orders the strokes)
//   t  text or a filled shape that fades in
//   a  faint chalk white instead of the unit colour;  faint  even fainter
//   cut  a filled shape that keeps fading in and out;  cell (with --j)  cells that light up one after another
//   hop, ride  a shape that moves along its offset-path (hop: on and on; ride: there and back)
'use strict';
(() => {
  let k = 0;
  const P = (d, cls = '', extra = '') => `<path class="d ${cls}" pathLength="1" style="--k:${k++}" d="${d}" ${extra}/>`;
  const Tx = (x, y, s, size = 24, cls = '', anchor = 'start') => `<text class="t ${cls}" style="--k:${k++}" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
  const C = (cx, cy, r, cls = '') => `<circle class="d ${cls}" pathLength="1" style="--k:${k++}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const Cell = (x, y, w, h, j) => `<rect class="cell" style="--j:${j}" x="${x}" y="${y}" width="${w}" height="${h}" fill="currentColor" stroke="none"/>`;
  const Dot = (cx, cy, r = 5) => `<circle class="t" style="--k:${k++}" cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;
  const reset = s => { k = 0; return s; };
  const threeQuarters = 'M300 90V36A54 54 0 1 1 246 90Z';   // a circle of radius 54 at (300, 90), three of four quarters

  window.UNIT_ART_BY_UNIT = {
    // Глава 1. Числа и действия: three place-value boxes with a counter hopping across them; the laws as text.
    1: reset([0, 1, 2].map(i => P(`M${240 + i * 58} 96h52v52h-52Z`)).join('') +
      Tx(266, 132, '4', 30, '', 'middle') + Tx(324, 132, '0', 30, '', 'middle') + Tx(382, 132, '5', 30, '', 'middle') +
      Tx(266, 84, 'с', 16, 'a', 'middle') + Tx(324, 84, 'д', 16, 'a', 'middle') + Tx(382, 84, 'е', 16, 'a', 'middle') +
      `<circle class="t hop" r="7" fill="currentColor" stroke="none" style="--k:${k++};offset-path:path('M382 64Q353 34 324 64Q295 34 266 64')"/>` +
      Tx(450, 70, 'a + b = b + a', 26) + Tx(450, 128, '(2 + 3) · 4', 24, 'a')),
    // Глава 2. Делимость: a factor tree of 60 and a 3 × 4 array whose cells light up.
    2: reset(Tx(300, 44, '60', 28, '', 'middle') + P('M290 52L262 82M310 52L338 82', 'a') +
      Tx(258, 104, '6', 24, '', 'middle') + Tx(342, 104, '10', 24, '', 'middle') + P('M252 112L238 138M264 112L278 138M334 112L320 138M350 112L364 138', 'a') +
      Tx(236, 160, '2', 22, '', 'middle') + Tx(280, 160, '3', 22, '', 'middle') + Tx(318, 160, '2', 22, '', 'middle') + Tx(366, 160, '5', 22, '', 'middle') +
      Array.from({ length: 12 }, (_, i) => Cell(440 + (i % 4) * 30, 50 + Math.floor(i / 4) * 30, 24, 24, i)).join('') +
      Tx(497, 160, 'НОД · НОК', 20, 'a', 'middle')),
    // Глава 3. Обыкновенные дроби: a pizza cut in four with three quarters taken, 3 : 4 = ¾, a strip whose cells light up.
    3: reset(C(300, 90, 54) + P('M300 36V144', 'a') + P('M246 90H354', 'a') +
      `<path d="${threeQuarters}" fill="currentColor" stroke="none" opacity=".16"/>` +
      `<path class="cut" d="${threeQuarters}" fill="currentColor" stroke="none"/>` +
      Tx(482, 76, '3 : 4 = ¾', 32, '', 'middle') +
      P('M392 112H572V148H392Z') + [437, 482, 527].map(x => P(`M${x} 112V148`, 'a')).join('') +
      [0, 1, 2].map(j => `<rect class="cell" style="--j:${j}" x="${394 + j * 45}" y="114" width="41" height="32" fill="currentColor" stroke="none"/>`).join('')),
    // Глава 4. Десятичные дроби и проценты: a hundred square with a quarter shaded, 0,25 = 25 %.
    4: reset(P('M240 40h100v100h-100Z') + P(Array.from({ length: 9 }, (_, i) => `M${250 + i * 10} 40V140M240 ${50 + i * 10}H340`).join(''), 'faint') +
      `<path d="M240 40h50v50h-50Z" fill="currentColor" stroke="none" opacity=".16"/>` +
      `<path class="cut" d="M240 40h50v50h-50Z" fill="currentColor" stroke="none"/>` +
      Tx(470, 82, '0,25 = 25 %', 30, '', 'middle') + Tx(470, 132, '× 10 → запятая вправо', 18, 'a', 'middle')),
    // Глава 5. Отношения и пропорции: two bars in the ratio 2 : 3, cells lighting up; a proportion.
    5: reset(P('M240 56h96v34h-96Z') + P('M288 56V90', 'a') + P('M240 112h144v34h-144Z') + P('M288 112V146M336 112V146', 'a') +
      Cell(242, 58, 44, 30, 0) + Cell(290, 58, 44, 30, 1) + Cell(242, 114, 44, 30, 2) + Cell(290, 114, 44, 30, 3) + Cell(338, 114, 44, 30, 4) +
      Tx(490, 80, '2 : 3 = 4 : 6', 28, '', 'middle') + Tx(490, 132, 'a · d = b · c', 22, 'a', 'middle')),
    // Глава 6. Положительные и отрицательные числа: a number line from −3 to 3, a counter hopping from 2 back to −1.
    6: reset(P('M228 120H584') + Array.from({ length: 7 }, (_, i) => P(`M${256 + i * 50} 112v16`, 'a')).join('') +
      ['−3', '−2', '−1', '0', '1', '2', '3'].map((s, i) => Tx(256 + i * 50, 152, s, 17, 'a', 'middle')).join('') +
      `<circle class="t hop" r="7" fill="currentColor" stroke="none" style="--k:${k++};offset-path:path('M506 112Q481 84 456 112Q431 84 406 112Q381 84 356 112')"/>` +
      Tx(406, 58, '2 − 3 = −1', 28, '', 'middle')),
    // Глава 7. Геометрия: a triangle with a marked angle, a circle with its radius.
    7: reset(P('M236 150L322 42L404 150Z') + P('M262 150A26 26 0 0 0 252 130', 'a') +
      C(500, 94, 54) + P('M500 94L554 94', 'a') + Dot(500, 94, 4) + Tx(527, 86, 'r', 20, 'a', 'middle') +
      Tx(322, 172, 'A + B + C = 180°', 18, 'a', 'middle')),
    // Глава 8. Текстовые задачи: a road with a car that drives there and back; s = v · t.
    8: reset(P('M228 146H584') + P('M240 160H572', 'faint', 'stroke-dasharray="14 12"') +
      `<path class="t ride" d="M-22 -8h30l10 -12h14l8 12h6v14h-68Z M-12 6a6 6 0 1 0 0.1 0Z M22 6a6 6 0 1 0 0.1 0Z" fill="currentColor" stroke="none" style="--k:${k++};offset-path:path('M260 128H540')"/>` +
      Tx(406, 70, 's = v · t', 30, '', 'middle')),
    // Глава 9. Диаграммы, перебор, вероятность: columns that light up, a die showing three.
    9: reset(P('M236 150H392') + [[244, 70], [282, 40], [320, 96], [358, 60]].map(([x, h], j) => Cell(x, 150 - h - 8, 28, h + 8, j)).join('') +
      P('M452 52h76v76h-76Z') + Dot(470, 70) + Dot(490, 90) + Dot(510, 110) +
      Tx(490, 166, 'P = 1/6', 20, 'a', 'middle')),
  };
})();
