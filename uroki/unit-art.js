// Chalk sketches for the unit headers on the contents page, one per unit, drawn in the unit's colour.
// Each entry is the inside of an SVG with viewBox 0 0 600 180; keep the left ~200 px light (the unit title sits there
// on narrow screens). UNIT_ART[u] belongs to the u-th entry of `units` in index.html (counted from 0 in that list, not
// by the unit's number): when a unit is added before another, add its sketch at the same place here.
// Classes, styled in lib/units.css:
//   d  a stroke that draws itself in when the unit scrolls into view (--k orders the strokes)
//   t  text or a filled shape that fades in
//   a  faint chalk white instead of the unit colour;  faint  even fainter
//   cut  a filled shape that keeps fading in and out;  cell (with --j)  cells that light up one after another
'use strict';
(() => {
  let k = 0;
  const P = (d, cls = '', extra = '') => `<path class="d ${cls}" pathLength="1" style="--k:${k++}" d="${d}" ${extra}/>`;
  const Tx = (x, y, s, size = 24, cls = '', anchor = 'start') => `<text class="t ${cls}" style="--k:${k++}" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
  const C = (cx, cy, r, cls = '') => `<circle class="d ${cls}" pathLength="1" style="--k:${k++}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const reset = s => { k = 0; return s; };
  const threeQuarters = 'M300 90V36A54 54 0 1 1 246 90Z';   // a circle of radius 54 at (300, 90), three of four quarters

  window.UNIT_ART = [
    // Глава 3. Обыкновенные дроби: a pizza cut in four with three quarters taken, 3 : 4 = ¾, a strip whose cells light up.
    reset(C(300, 90, 54) + P('M300 36V144', 'a') + P('M246 90H354', 'a') +
      `<path d="${threeQuarters}" fill="currentColor" stroke="none" opacity=".16"/>` +
      `<path class="cut" d="${threeQuarters}" fill="currentColor" stroke="none"/>` +
      Tx(482, 76, '3 : 4 = ¾', 32, '', 'middle') +
      P('M392 112H572V148H392Z') + [437, 482, 527].map(x => P(`M${x} 112V148`, 'a')).join('') +
      [0, 1, 2].map(j => `<rect class="cell" style="--j:${j}" x="${394 + j * 45}" y="114" width="41" height="32" fill="currentColor" stroke="none"/>`).join('')),
  ];
})();
