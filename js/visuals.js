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

  const P = (x, y) => `${(+x).toFixed(1)},${(+y).toFixed(1)}`;
  const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); return [dx / L, dy / L]; };

  // Многоугольники в ряд, у каждого своя подпись. items: [{ pts: [[x, y], …], t: 'подпись',
  // ticks: [[сторона, штрихов]] — равные стороны, right: вершина с прямым углом, arc: вершина с отмеченным углом }].
  // Сторона k соединяет вершины k и k + 1. Координаты в пикселях, ширина рисунка o.w.
  function shapes(items, o = {}) {
    const W = o.w || 150;
    return `<div class="row">${items.map(it => {
      const p = it.pts, n = p.length, H = Math.max(...p.map(q => q[1])) + 8;
      let s = `<path d="M${p.map(q => P(q[0], q[1])).join(' L')} Z" ${st('var(--pen-soft)', 'var(--ink)', 2)} stroke-linejoin="round"/>`;
      (it.ticks || []).forEach(([k, cnt]) => {
        const a = p[k], b = p[(k + 1) % n], [ux, uy] = dir(a, b), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        for (let j = 0; j < cnt; j++) {
          const off = (j - (cnt - 1) / 2) * 5, cx = mx + ux * off, cy = my + uy * off;
          s += `<path d="M${P(cx - uy * 6, cy + ux * 6)} L${P(cx + uy * 6, cy - ux * 6)}" ${st('none', 'var(--ink)', 2)}/>`;
        }
      });
      const corner = i => [p[i], dir(p[i], p[(i + n - 1) % n]), dir(p[i], p[(i + 1) % n])];
      if (it.right != null) {
        const [c, a, b] = corner(it.right), r = 12;
        s += `<path d="M${P(c[0] + a[0] * r, c[1] + a[1] * r)} L${P(c[0] + (a[0] + b[0]) * r, c[1] + (a[1] + b[1]) * r)} L${P(c[0] + b[0] * r, c[1] + b[1] * r)}" ${st('none', 'var(--pen)', 2)}/>`;
      }
      if (it.arc != null) {
        const [c, a, b] = corner(it.arc), r = 16, sweep = a[0] * b[1] - a[1] * b[0] > 0 ? 1 : 0;
        s += `<path d="M${P(c[0] + a[0] * r, c[1] + a[1] * r)} A${r},${r} 0 0 ${sweep} ${P(c[0] + b[0] * r, c[1] + b[1] * r)}" ${st('none', 'var(--pen)', 2)}/>`;
      }
      return fig(svg(W, H, s, it.t || 'многоугольник'), it.t);
    }).join('')}</div>`;
  }

  // Клетчатая бумага w × h клеток с фигурами: o.polys = [{ pts: [[x, y], …], fill: true, dash: true }]; y идёт сверху вниз.
  function grid(w, h, o = {}) {
    const u = o.u || 26, pad = 4, X = v => pad + v * u, gl = 'style="stroke:var(--muted);stroke-opacity:.4;stroke-width:1"';
    let s = `<rect x="${X(0)}" y="${X(0)}" width="${w * u}" height="${h * u}" ${st('var(--card)')}/>`;
    for (let i = 0; i <= w; i++) s += `<line x1="${X(i)}" y1="${X(0)}" x2="${X(i)}" y2="${X(h)}" ${gl}/>`;
    for (let j = 0; j <= h; j++) s += `<line x1="${X(0)}" y1="${X(j)}" x2="${X(w)}" y2="${X(j)}" ${gl}/>`;
    (o.polys || []).forEach(f => {
      s += `<path d="M${f.pts.map(([x, y]) => P(X(x), X(y))).join(' L')} Z" style="fill:${f.fill ? 'var(--shade)' : 'none'};fill-opacity:.55;stroke:var(--${f.dash ? 'pen' : 'ink'});stroke-width:2"${f.dash ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round"/>`;
    });
    return fig(svg(2 * pad + w * u, 2 * pad + h * u, s, o.label || 'фигура на клетчатой бумаге'), o.cap);
  }

  // Многогранники каркасом, у каждого своя подпись. items: [{ v: [[x, y], …] — вершины, e: [[i, j], …] — видимые рёбра,
  // h: [[i, j], …] — невидимые (пунктиром), f: [[i, j, k, …]] — закрашенные грани, t: 'подпись' }].
  function wire(items) {
    return `<div class="row">${items.map(it => {
      const v = it.v, W = Math.max(...v.map(q => q[0])) + 12, H = Math.max(...v.map(q => q[1])) + 8;
      const edge = ([i, j], look) => `<line x1="${v[i][0]}" y1="${v[i][1]}" x2="${v[j][0]}" y2="${v[j][1]}" ${look}/>`;
      let s = (it.f || []).map(f => `<path d="M${f.map(i => P(v[i][0], v[i][1])).join(' L')} Z" ${st('var(--pen-soft)')}/>`).join('');
      s += (it.h || []).map(e => edge(e, `${st('none', 'var(--ink)', 1.5)} stroke-dasharray="5 4" opacity=".5"`)).join('');
      s += (it.e || []).map(e => edge(e, `${st('none', 'var(--ink)', 2)} stroke-linecap="round"`)).join('');
      s += v.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" ${st('var(--pen)')}/>`).join('');
      return fig(svg(W, H, s, it.t || 'многогранник'), it.t);
    }).join('')}</div>`;
  }

  // Развёртка из квадратов: cells = [[столбец, строка, подпись], …].
  function net(cells, o = {}) {
    const u = o.u || 38, pad = 3, cols = Math.max(...cells.map(c => c[0])) + 1, rows = Math.max(...cells.map(c => c[1])) + 1;
    const s = cells.map(([c, r, t]) => `<rect x="${pad + c * u}" y="${pad + r * u}" width="${u}" height="${u}" ${st('var(--card)', 'var(--ink)', 2)}/>`
      + (t ? `<text x="${pad + c * u + u / 2}" y="${pad + r * u + u / 2 + 6}" text-anchor="middle" font-size="17" font-weight="700">${t}</text>` : '')).join('');
    return fig(svg(2 * pad + cols * u, 2 * pad + rows * u, s, o.label || 'развёртка куба'), o.cap);
  }

  // Столбчатая диаграмма одного ряда: data = [{ t: 'подпись', v: число }]. Значения читают по шкале, поэтому
  // на столбцах их нет (в aria-label они есть). o.max — верх шкалы, o.step — шаг сетки, o.every — шаг подписей,
  // o.from — начало шкалы (0, если не задано).
  function columns(data, o = {}) {
    const from = o.from || 0, max = o.max, step = o.step || 1, every = o.every || step;
    const ph = o.h || 150, slot = o.slot || 60, bw = 24, left = 38, top = 10, base = top + ph, W = left + data.length * slot + 8;
    const Y = v => top + (max - v) / (max - from) * ph;
    let s = '';
    for (let v = from; v <= max + 1e-9; v += step) {
      const y = Y(v), k = (v - from) / every;
      s += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W - 4}" y2="${y.toFixed(1)}" style="stroke:var(--muted);stroke-opacity:.3;stroke-width:1"/>`;
      if (Math.abs(k - Math.round(k)) < 1e-9) s += `<text x="${left - 7}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="12" style="fill:var(--muted)">${fmt(v)}</text>`;
    }
    data.forEach((d, i) => {
      const x = left + i * slot + (slot - bw) / 2, y = Y(d.v), r = Math.min(4, base - y);
      s += `<path d="M${x},${base} V${(y + r).toFixed(1)} Q${x},${y.toFixed(1)} ${x + r},${y.toFixed(1)} H${x + bw - r} Q${x + bw},${y.toFixed(1)} ${x + bw},${(y + r).toFixed(1)} V${base} Z" style="fill:var(--series-1)"/>`;
      s += `<text x="${x + bw / 2}" y="${base + 19}" text-anchor="middle" font-size="13">${d.t}</text>`;
    });
    s += `<path d="M${left},${top} V${base} H${W - 4}" ${st('none', 'var(--muted)', 1)}/>`;
    const label = `${o.label || 'столбчатая диаграмма'}: ${data.map(d => `${d.t} — ${fmt(d.v)}`).join(', ')}`;
    return fig(svg(W, base + 28, s, label), o.cap);
  }

  // Круговая диаграмма: data = [{ t: 'подпись', v: процент }], не больше трёх частей (цвета --series-1…3).
  // Части разделены зазором цвета бумаги; проценты подписаны и на секторах, и в легенде.
  function sectors(data, o = {}) {
    const R = o.r || 62, C = R + 4, lx = 2 * C + 18, at = (a, r) => P(C + r * Math.cos(a), C + r * Math.sin(a));
    let s = '', a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const a1 = a0 + d.v / 100 * 2 * Math.PI, am = (a0 + a1) / 2, col = `var(--series-${i + 1})`, y = 20 + i * 27;
      s += `<path d="M${C},${C} L${at(a0, R)} A${R},${R} 0 ${d.v > 50 ? 1 : 0} 1 ${at(a1, R)} Z" style="fill:${col};stroke:var(--paper);stroke-width:2;stroke-linejoin:round"/>`;
      const [tx, ty] = at(am, 0.6 * R).split(',');
      s += `<text x="${tx}" y="${(+ty + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" style="fill:#fff">${fmt(d.v)} %</text>`;
      s += `<rect x="${lx}" y="${y - 11}" width="14" height="14" rx="3" style="fill:${col}"/>`;
      s += `<text x="${lx + 22}" y="${y + 1}" font-size="14">${d.t} — ${fmt(d.v)} %</text>`;
      a0 = a1;
    });
    const W = Math.ceil(lx + 28 + Math.max(...data.map(d => `${d.t} — ${d.v} %`.length)) * 7.8);
    return fig(svg(W, 2 * C, s, `${o.label || 'круговая диаграмма'}: ${data.map(d => `${d.t} — ${fmt(d.v)} %`).join(', ')}`), o.cap);
  }

  // Дерево вариантов: levels = [['белая', 'синяя'], ['чёрные', 'серые', 'зелёные']]. Каждая ветка до конца — один вариант,
  // справа ветки пронумерованы.
  function tree(levels, o = {}) {
    const row = 28, top = 6, cw = 7.8, leaves = levels.reduce((m, l) => m * l.length, 1), wide = l => Math.max(...l.map(t => t.length)) * cw;
    const xs = [44];
    levels.forEach((l, k) => xs.push(xs[k] + wide(l) + 52));
    const xEnd = xs[levels.length - 1] + wide(levels[levels.length - 1]) + 18;
    let s = '', num = 0;
    const draw = (k, first, span, from) => {
      const sub = span / levels[k].length;
      levels[k].forEach((t, i) => {
        const y = top + (first + (i + 0.5) * sub) * row, x = xs[k];
        s += `<path d="M${P(from[0], from[1])} L${P(x - 7, y)}" ${st('none', 'var(--muted)', 1.5)}/>`;
        s += `<text x="${x}" y="${(y + 5).toFixed(1)}" font-size="14">${t}</text>`;
        if (k + 1 < levels.length) draw(k + 1, first + i * sub, sub, [x + t.length * cw + 6, y]);
        else s += `<text x="${xEnd}" y="${(y + 5).toFixed(1)}" font-size="12" style="fill:var(--muted)">${++num}</text>`;
      });
    };
    const yRoot = top + leaves * row / 2;
    s += `<circle cx="10" cy="${yRoot}" r="4.5" ${st('var(--pen)')}/>`;
    draw(0, 0, leaves, [15, yRoot]);
    return fig(svg(Math.ceil(xEnd + 22), 2 * top + leaves * row, s, o.label || 'дерево вариантов'), o.cap);
  }

  window.V = { bar, pie, line, plane, cells, box, angles, shapes, grid, wire, net, columns, sectors, tree, svg, fig, fmt };
})();
