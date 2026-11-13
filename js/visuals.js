/* Рисунки для тем: всё рисуется в SVG и берёт цвета из CSS-переменных темы. */
(function () {
  const fmt = v => String(+(+v).toFixed(6)).replace('-', '−').replace('.', ',');
  const st = (fill, stroke, w) => `style="fill:${fill};stroke:${stroke || 'none'};stroke-width:${w || 0}"`;
  const fig = (svg, cap) => `<figure>${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  const svg = (w, h, inner, label) =>
    `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${label || 'рисунок'}">${inner}</svg>`;

  // Полоска, разделённая на d частей, закрашено n (если n > d — несколько полосок).
  function bar(n, d, o = {}) {
    const W = o.w || 320, H = o.h || 34, rows = Math.max(1, Math.ceil(n / d));
    let s = '', y = 4;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < d; i++) {
        const on = r * d + i < n;
        s += `<rect x="${(4 + i * W / d).toFixed(2)}" y="${y}" width="${(W / d).toFixed(2)}" height="${H}" ${st(on ? 'var(--shade)' : 'var(--card)', 'var(--ink)', 1.5)}/>`;
      }
      y += H + 10;
    }
    return fig(svg(W + 8, y - 6, s, `закрашено ${n} из ${d} частей`), o.cap);
  }

  // Круг («пицца»), разделённый на d частей, закрашено n.
  function pie(n, d, o = {}) {
    const R = o.r || 56, C = R + 4, k = Math.max(1, Math.ceil(n / d));
    let s = '';
    for (let p = 0; p < k; p++) {
      const cx = C + p * (2 * R + 18);
      for (let i = 0; i < d; i++) {
        const on = p * d + i < n, style = st(on ? 'var(--shade)' : 'var(--card)', 'var(--ink)', 1.5);
        if (d === 1) { s += `<circle cx="${cx}" cy="${C}" r="${R}" ${style}/>`; continue; }
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / d, a1 = a0 + 2 * Math.PI / d;
        const x0 = cx + R * Math.cos(a0), y0 = C + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
        s += `<path d="M${cx},${C} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" ${style}/>`;
      }
    }
    return fig(svg(k * (2 * R + 18) - 10, 2 * C, s, `закрашено ${n} частей, каждая — 1/${d}`), o.cap);
  }

  // Координатная (числовая) прямая. o.marks: [{x, t, c}], o.jumps: [{a, b, t}] — дуги-«прыжки».
  function line(from, to, o = {}) {
    const n = to - from, u = o.u || Math.min(52, 520 / n), pad = 26, W = n * u + 2 * pad + 18;
    const y = o.jumps ? 74 : 34, H = y + 34, X = v => pad + (v - from) * u;
    let s = `<line x1="${pad - 16}" y1="${y}" x2="${W - 8}" y2="${y}" ${st('none', 'var(--ink)', 1.6)}/>`;
    s += `<path d="M${W - 2},${y} l-11,-5 v10 z" ${st('var(--ink)')}/>`;
    const step = o.step || 1;
    for (let v = from; v <= to + 1e-9; v += step) {
      const x = X(v);
      s += `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" ${st('none', 'var(--ink)', 1.3)}/>`;
      const every = o.labelEvery || step, k = Math.round((v - from) / every * 1e6) / 1e6;
      if (!o.noLabels && Number.isInteger(k)) s += `<text x="${x}" y="${y + 24}" text-anchor="middle" font-size="14">${fmt(v)}</text>`;
    }
    (o.jumps || []).forEach(j => {
      const x1 = X(j.a), x2 = X(j.b), mx = (x1 + x2) / 2, h = Math.min(38, Math.abs(x2 - x1) / 2 + 10), y0 = y - 4;
      s += `<path d="M${x1},${y0} Q${mx},${y0 - h * 1.6} ${x2},${y0}" ${st('none', 'var(--pen)', 2)}/>`;
      const tx = x2 - mx, ty = h * 1.6, L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L, bx = x2 - ux * 10, by = y0 - uy * 10;
      s += `<path d="M${x2},${y0} L${(bx - uy * 5).toFixed(1)},${(by + ux * 5).toFixed(1)} L${(bx + uy * 5).toFixed(1)},${(by - ux * 5).toFixed(1)} Z" ${st('var(--pen)')}/>`;
      if (j.t) s += `<text x="${mx}" y="${(y0 - 0.8 * h - 8).toFixed(1)}" text-anchor="middle" font-size="14" style="fill:var(--pen);font-weight:600">${j.t}</text>`;
    });
    (o.marks || []).forEach(m => {
      const x = X(m.x), c = `var(--${m.c || 'red'})`;
      s += `<circle cx="${x}" cy="${y}" r="6" ${st(c)}/>`;
      if (m.t) s += `<text x="${x}" y="${y - 13}" text-anchor="middle" font-size="15" style="fill:${c};font-weight:700">${m.t}</text>`;
    });
    return fig(svg(W, H, s, o.label || 'координатная прямая'), o.cap);
  }

  // Координатная плоскость. o.points: [{x, y, t}], o.paths: [{pts: [[x,y],...], close, c}]
  function plane(min, max, o = {}) {
    const n = max - min, u = o.u || Math.min(30, 330 / n), pad = 24, W = n * u + 2 * pad;
    const X = v => pad + (v - min) * u, Y = v => pad + (max - v) * u;
    let s = '';
    for (let v = min; v <= max; v++) {
      s += `<line x1="${X(v)}" y1="${Y(min)}" x2="${X(v)}" y2="${Y(max)}" ${st('none', 'var(--line)', 1)}/>`;
      s += `<line x1="${X(min)}" y1="${Y(v)}" x2="${X(max)}" y2="${Y(v)}" ${st('none', 'var(--line)', 1)}/>`;
    }
    (o.paths || []).forEach(p => {
      const d = p.pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0])},${Y(q[1])}`).join(' ') + (p.close ? ' Z' : '');
      s += `<path d="${d}" ${st(p.fill || 'none', `var(--${p.c || 'pen'})`, 2.2)} ${p.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
    });
    s += `<line x1="${X(min) - 8}" y1="${Y(0)}" x2="${X(max) + 14}" y2="${Y(0)}" ${st('none', 'var(--ink)', 1.6)}/>`;
    s += `<path d="M${X(max) + 20},${Y(0)} l-10,-5 v10 z" ${st('var(--ink)')}/>`;
    s += `<line x1="${X(0)}" y1="${Y(min) + 8}" x2="${X(0)}" y2="${Y(max) - 14}" ${st('none', 'var(--ink)', 1.6)}/>`;
    s += `<path d="M${X(0)},${Y(max) - 20} l-5,10 h10 z" ${st('var(--ink)')}/>`;
    s += `<text x="${X(max) + 8}" y="${Y(0) + 18}" font-size="14" font-style="italic">x</text>`;
    s += `<text x="${X(0) + 9}" y="${Y(max) - 8}" font-size="14" font-style="italic">y</text>`;
    const every = n > 12 ? 2 : 1;
    for (let v = min; v <= max; v++) {
      if (v === 0 || v % every) continue;
      s += `<text x="${X(v)}" y="${Y(0) + 15}" text-anchor="middle" font-size="11">${fmt(v)}</text>`;
      s += `<text x="${X(0) - 5}" y="${Y(v) + 4}" text-anchor="end" font-size="11">${fmt(v)}</text>`;
    }
    s += `<text x="${X(0) - 5}" y="${Y(0) + 15}" text-anchor="end" font-size="11">0</text>`;
    (o.points || []).forEach(p => {
      const c = `var(--${p.c || 'red'})`;
      s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" ${st(c)}/>`;
      if (p.t) s += `<text x="${X(p.x) + 7}" y="${Y(p.y) - 7}" font-size="13" style="fill:${c};font-weight:700">${p.t}</text>`;
    });
    return fig(svg(W + 14, W + 6, s, o.label || 'координатная плоскость'), o.cap);
  }

  // Прямоугольник из клеток w × h (для площади).
  function cells(w, h, o = {}) {
    const u = o.u || 28, pad = 4;
    let s = '';
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++)
      s += `<rect x="${pad + i * u}" y="${pad + j * u}" width="${u}" height="${u}" ${st(j * w + i < (o.fill ?? w * h) ? 'var(--shade)' : 'var(--card)', 'var(--ink)', 1)}/>`;
    s += `<rect x="${pad}" y="${pad}" width="${w * u}" height="${h * u}" ${st('none', 'var(--ink)', 2.2)}/>`;
    s += `<text x="${pad + w * u / 2}" y="${pad + h * u + 20}" text-anchor="middle" font-size="14">${o.a || w}</text>`;
    s += `<text x="${pad + w * u + 8}" y="${pad + h * u / 2 + 5}" font-size="14">${o.b || h}</text>`;
    return fig(svg(pad + w * u + 34, pad + h * u + 28, s, `прямоугольник ${w} на ${h} клеток`), o.cap);
  }

  // Прямоугольный параллелепипед (коробка) a × b × c.
  function box(a, b, c, o = {}) {
    const u = o.u || 30, dx = b * u * 0.5, dy = b * u * 0.4, x0 = 6, y0 = 6 + dy, W = a * u, H = c * u;
    const L = st('none', 'var(--ink)', 2), F = st('var(--pen-soft)', 'var(--ink)', 2);
    let s = `<path d="M${x0},${y0} L${x0 + dx},${y0 - dy} L${x0 + dx + W},${y0 - dy} L${x0 + W},${y0} Z" ${F}/>`;
    s += `<path d="M${x0 + W},${y0} L${x0 + W + dx},${y0 - dy} L${x0 + W + dx},${y0 - dy + H} L${x0 + W},${y0 + H} Z" ${F}/>`;
    s += `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" ${st('var(--card)', 'var(--ink)', 2)}/>`;
    s += `<path d="M${x0},${y0 + H} L${x0 + dx},${y0 - dy + H} L${x0 + dx + W},${y0 - dy + H} M${x0 + dx},${y0 - dy} L${x0 + dx},${y0 - dy + H}" ${L} stroke-dasharray="5 5" opacity=".45"/>`;
    s += `<text x="${x0 + W / 2}" y="${y0 + H + 20}" text-anchor="middle" font-size="14">${o.la || a}</text>`;
    s += `<text x="${x0 + W + dx / 2 + 10}" y="${y0 + H - dy / 2 + 16}" font-size="14">${o.lb || b}</text>`;
    s += `<text x="${x0 - 4 + W + dx + 8}" y="${y0 - dy + H / 2 + 5}" font-size="14">${o.lc || c}</text>`;
    return fig(svg(x0 + W + dx + 40, y0 + H + 28, s, 'прямоугольный параллелепипед'), o.cap);
  }

  // Несколько углов в ряд: list = [{deg, t}]
  function angles(list, o = {}) {
    const R = 70, cell = 170;
    let s = '';
    list.forEach((a, i) => {
      const cx = 20 + i * cell, cy = 100, rad = a.deg * Math.PI / 180;
      const ex = cx + R * Math.cos(rad), ey = cy - R * Math.sin(rad), r = a.deg === 90 ? 0 : 22;
      s += `<path d="M${cx + R + 20},${cy} L${cx},${cy} L${(cx + (R + 20) * Math.cos(rad)).toFixed(1)},${(cy - (R + 20) * Math.sin(rad)).toFixed(1)}" ${st('none', 'var(--ink)', 2)}/>`;
      if (a.deg === 90) s += `<path d="M${cx + 16},${cy} V${cy - 16} H${cx}" ${st('none', 'var(--pen)', 2)}/>`;
      else s += `<path d="M${cx + r},${cy} A${r},${r} 0 ${a.deg > 180 ? 1 : 0} 0 ${(cx + r * Math.cos(rad)).toFixed(1)},${(cy - r * Math.sin(rad)).toFixed(1)}" ${st('none', 'var(--pen)', 2)}/>`;
      s += `<text x="${cx + 34}" y="${cy - 8}" font-size="13" style="fill:var(--pen);font-weight:700">${a.deg}°</text>`;
      s += `<text x="${cx + 40}" y="${cy + 28}" text-anchor="middle" font-size="14">${a.t || ''}</text>`;
      void ex; void ey;
    });
    return fig(`<div class="wide">${svg(list.length * cell, 140, s, 'виды углов')}</div>`, o.cap);
  }

  window.V = { bar, pie, line, plane, cells, box, angles, svg, fig, fmt };
})();
