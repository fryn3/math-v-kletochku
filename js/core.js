/* Общие функции сайта и страницы для родителей: разметка дробей, разбор и проверка ответов, оценка. */
(function () {
  // {3/4} → дробь, {1 2/3} → смешанное число
  const frac = (a, b) => `<span class="fr" role="math" aria-label="${a}/${b}"><span>${a}</span><span>${b}</span></span>`;
  function rich(html) {
    if (!html) return '';
    return String(html)
      .replace(/\{(\d+)\s+([^{}\/\s]+)\/([^{}\/]+)\}/g, (m, w, a, b) => `<span class="mix"><span class="w">${w}</span>${frac(a, b)}</span>`)
      .replace(/\{([^{}\/]+)\/([^{}\/]+)\}/g, (m, a, b) => frac(a, b));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Число из ответа: 7, -3, 0,25, 3/4, 1 2/3
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  function parseNum(raw) {
    const s = String(raw).trim().replace(/\s+/g, ' ').replace(/[−–—]/g, '-').replace(',', '.').replace(/\s*\/\s*/g, '/');
    let m, p, q;
    if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) { q = +m[4]; p = (+m[2] * q + +m[3]) * (m[1] ? -1 : 1); }
    else if ((m = s.match(/^(-?\d+)\/(-?\d+)$/))) { p = +m[1]; q = +m[2]; }
    else if ((m = s.match(/^-?\d+(?:\.(\d+))?$/))) { const k = m[1] ? m[1].length : 0; q = 10 ** k; p = Math.round(parseFloat(s) * q); }
    else return null;
    if (!q) return null;
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(p, q);
    return { p: p / g, q: q / g, reduced: g === 1, isFrac: s.includes('/') };
  }

  // Кириллические «х», «а», «у» и т. п. выглядят как латинские: принимаем оба варианта (М — для римских цифр).
  const LOOK = { 'х': 'x', 'а': 'a', 'с': 'c', 'у': 'y', 'е': 'e', 'о': 'o', 'р': 'p', 'к': 'k', 'в': 'b', 'м': 'm' };
  const normText = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[−–—]/g, '-').replace(/[*×·]/g, '')
    .replace(/\s+/g, '').replace(',', '.').replace(/[хасуеорквм]/g, c => LOOK[c]);

  // Проверка ответа: числа сравниваются по значению, несокращённая дробь не засчитывается.
  function check(task, input) {
    const u = parseNum(input);
    for (const a of [].concat(task.a)) {
      const e = parseNum(a);
      if (task.exact || !e || !u) {
        if (normText(input) === normText(a)) return { ok: true };
        continue;
      }
      if (u.p === e.p && u.q === e.q) {
        if (u.isFrac && !u.reduced) return { ok: false, msg: 'Значение верное, но дробь нужно сократить.' };
        return { ok: true };
      }
    }
    return { ok: false };
  }

  // Ответ для показа: «1 2/3» и «3/4» — дробью, «-5» — с настоящим минусом, «0.75» — с запятой,
  // «12000308» — с пробелами между классами, как в условиях задач.
  function fmtAnswer(a) {
    let s = String(a);
    const neg = /^-/.test(s);
    if (neg) s = s.slice(1);
    s = /^\d+( \d+)?\/\d+$/.test(s) ? rich('{' + s + '}')
      : esc(s).replace(/(\d)\.(\d)/, '$1,$2').replace(/^\d{4,}/, m => m.replace(/\B(?=(\d{3})+$)/g, ' '));
    return (neg ? '−' : '') + s;
  }

  // Школьная оценка по доле верных ответов.
  const grade = (ok, total) => { const p = total ? ok / total : 0; return p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.45 ? 3 : 2; };

  // Шкала для n задач: «5» — 7–8, «4» — 6, «3» — 4–5, «2» — 0–3.
  function scale(n) {
    const by = { 5: [], 4: [], 3: [], 2: [] };
    for (let k = 0; k <= n; k++) by[grade(k, n)].push(k);
    return [5, 4, 3, 2].filter(g => by[g].length)
      .map(g => `«${g}» — ${by[g].length > 1 ? `${by[g][0]}–${by[g][by[g].length - 1]}` : by[g][0]}`).join(', ');
  }

  window.MVK = { rich, esc, parseNum, check, fmtAnswer, grade, scale };
})();
