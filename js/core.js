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

  // Число из ответа: 7, -3, 0,25, 3/4, 1 2/3. «x =» в начале и знак % или ° в конце не мешают: «x = −7», «85 %», «65°».
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  function parseNum(raw) {
    const s = String(raw).trim().replace(/^[xх]\s*=\s*/i, '').replace(/\s*[%°]$/, '')
      .replace(/\s+/g, ' ').replace(/[−–—]/g, '-').replace(',', '.').replace(/\s*\/\s*/g, '/');
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

  // Форма слова после числа: plural(5, ['задача', 'задачи', 'задач']) → «задач».
  const plural = (n, forms) => forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];

  // Школьная оценка по доле верных ответов.
  const grade = (ok, total) => { const p = total ? ok / total : 0; return p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.45 ? 3 : 2; };

  // Шкала для n задач: «5» — 7–8, «4» — 6, «3» — 4–5, «2» — 0–3.
  function scale(n) {
    const by = { 5: [], 4: [], 3: [], 2: [] };
    for (let k = 0; k <= n; k++) by[grade(k, n)].push(k);
    return [5, 4, 3, 2].filter(g => by[g].length)
      .map(g => `«${g}» — ${by[g].length > 1 ? `${by[g][0]}–${by[g][by[g].length - 1]}` : by[g][0]}`).join(', ');
  }

  // Версия экзамена главы (ключ itog — итогового теста). Её увеличивают, когда в работе меняют задачи: результат,
  // полученный на прежних задачах, перестаёт показываться как лучший. Нет в списке — версия 1.
  const EXAM_VER = { 1: 2, 2: 2, 4: 2, 7: 2, 8: 2 };
  const examVer = n => EXAM_VER[n] || 1;
  // Сохранённый результат варианта v экзамена главы n (или итогового теста, n = 'itog'), если он получен
  // на текущей версии работы. У вариантов 1 и 2 это лучший результат, у варианта 3 итогового теста — первая попытка.
  function examBest(saved, n, v) {
    const b = (saved || {})[`${n}-${v}`];
    return b && typeof b === 'object' && (b.ver || 1) === examVer(n) ? b : null;
  }

  // Итоговый тест: варианты 1 и 2 — в final.js, вариант 3 — в final-parents.js. Вариант 3 открывается на сайте
  // только по адресу #HIDDEN_FINAL: ссылки на него на сайте нет, её даёт страница для родителей.
  const HIDDEN_FINAL = 'proverka-itog';
  const finalTasks = v => v === 3 ? (window.FINAL3 || []) : (window.FINAL || []).map(s => Object.assign({ t: s.t }, s.v[v - 1]));

  // Лист для печати: заголовок, поля для имени и оценки, задачи со строкой для ответа (или вариантами, которые обводят).
  // o: { title, sub, tasks, rules, cls, attrs } — cls и attrs дописываются к <section>.
  const RULES = 'Реши задачи на черновике и запиши ответ на строке. Справочником и калькулятором не пользуйся.';
  function paper(o) {
    const line = k => k.opts
      ? `<div class="ans">Обведи ответ: ${k.opts.map(x => `<span class="choice">${rich(x)}</span>`).join('')}</div>`
      : '<div class="ans">Ответ: <span class="line"></span></div>';
    return `
      <section class="paper${o.cls ? ' ' + o.cls : ''}"${o.attrs || ''}>
        <div class="paper-head"><h2>${o.title}</h2><span>${o.sub}</span></div>
        <p class="who"><span>Имя ______________________</span><span>Дата ____________</span><span>Верно ____ из ${o.tasks.length}</span><span>Оценка ______</span></p>
        <p class="rules">${o.rules || RULES}</p>
        <ol class="ptasks">${o.tasks.map(k => `<li><div class="q">${rich(k.q)}</div>${line(k)}</li>`).join('')}</ol>
      </section>`;
  }

  window.MVK = { rich, esc, parseNum, check, fmtAnswer, plural, grade, scale, examVer, examBest, HIDDEN_FINAL, finalTasks, paper, RULES };
})();
