/* Страница для родителей: итоговый тест, экзамены по главам (любой из трёх вариантов) и задачи по отдельным темам
   для печати, ключ ответов с решениями и результаты ребёнка на сайте. */
(function () {
  const { rich, fmtAnswer, plural, grade, scale, examBest, HIDDEN_FINAL, finalTasks, paper, RULES } = window.MVK;
  const E3 = window.EXAMS3 || {}, E12 = window.EXAMS || {};
  const course = (window.COURSE || []).slice().sort((a, b) => a.n - b.n);
  const topicList = course.flatMap(ch => ch.topics.map((t, i) => ({ ch, t, num: `${ch.n}.${i + 1}` })));
  const topicName = Object.fromEntries(topicList.map(x => [x.t.id, `${x.num}. ${x.t.title}`]));
  const topicsOf = k => [].concat(k.t || []).map(id => topicName[id]).filter(Boolean).join('; ');
  const count = (n, forms) => `${n} ${plural(n, forms)}`;
  const TASKS = ['задача', 'задачи', 'задач'];

  // Экзамен главы: варианты 1 и 2 — из exams.js (они же на сайте), вариант 3 — из exam-parents.js.
  const examTasks = (n, v) => v === 3 ? (E3[n] || []) : (E12[n] || []).map(s => Object.assign({ t: s.t }, s.v[v - 1]));
  const chapters = course.filter(ch => E12[ch.n] || E3[ch.n]);

  // Задачи по одной теме: из «Проверь себя», из экзаменов главы и из итогового теста, все три варианта.
  // src — откуда задача: по ней в ключе видно, какие задачи ребёнок мог решать на сайте (вариантов 3 там нет).
  const pool = {};
  const put = (k, src) => [].concat(k.t || []).forEach(id => (pool[id] = pool[id] || []).push({ k, src }));
  topicList.forEach(({ t }) => (t.tasks || []).forEach(k => put(Object.assign({ t: t.id }, k), '«Проверь себя» в теме')));
  [1, 2, 3].forEach(v => chapters.forEach(ch => examTasks(ch.n, v).forEach(k => put(k, `экзамен главы ${ch.n}, вариант ${v}`))));
  [1, 2, 3].forEach(v => finalTasks(v).forEach(k => put(k, `итоговый тест, вариант ${v}`)));

  // Работы по порядку печати: итоговый тест, экзамены глав, темы. sel — значение флажка и метка листа и ключа.
  const finals = [1, 2, 3].map(v => ({ v, tasks: finalTasks(v) })).filter(w => w.tasks.length);
  const works = [
    ...finals.map(w => ({ sel: `itog-${w.v}`, tasks: w.tasks, title: 'Итоговый тест по всей программе',
      sub: `Проверочная работа · вариант ${w.v}`, key: `Итоговый тест · вариант ${w.v}`, rules: `${RULES} На работу — около часа.` })),
    ...chapters.flatMap(ch => [1, 2, 3].filter(v => examTasks(ch.n, v).length).map(v => ({ sel: `ch-${ch.n}-${v}`, tasks: examTasks(ch.n, v),
      title: `Глава ${ch.n}. ${ch.title}`, sub: `Проверочная работа · вариант ${v}`, key: `Глава ${ch.n}. ${ch.title} · вариант ${v}` }))),
    ...topicList.filter(x => pool[x.t.id]).map(x => ({ sel: `t-${x.t.id}`, tasks: pool[x.t.id].map(p => p.k), src: pool[x.t.id].map(p => p.src),
      title: `Тема ${x.num}. ${x.t.title}`, sub: `Задачи по теме · глава ${x.ch.n}`, key: `Тема ${x.num}. ${x.t.title}` })),
  ];

  // Результаты ребёнка, если он решал на сайте в этом же браузере.
  let exams = {};
  try { exams = (JSON.parse(localStorage.getItem('mvk-progress-v1')) || {}).exams || {}; } catch (e) { /* хранилище недоступно */ }
  const mark = b => `${b.ok} из ${b.n} («${grade(b.ok, b.n)}»)`;
  function chapterLine(n) {
    const done = [1, 2].map(v => [v, examBest(exams, n, v)]).filter(([, b]) => b);
    return done.length ? 'на сайте: ' + done.map(([v, b]) => `вариант ${v} — ${mark(b)}`).join(', ') : '';
  }
  // У вариантов 1 и 2 итогового теста — лучший результат, у варианта 3 — первая попытка с датой и номерами ошибок.
  function finalLine(v) {
    const b = examBest(exams, 'itog', v);
    if (!b) return '';
    if (v < 3) return `вариант ${v} — лучший результат на сайте: ${mark(b)}`;
    const day = b.at ? ' ' + new Date(b.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
    const errors = b.wrong && b.wrong.length ? `, ошибки в задачах ${b.wrong.join(', ')}` : ', без ошибок';
    return `вариант 3 решён на сайте${day}: ${mark(b)}${errors}${b.tries > 1 ? ` (первая из ${b.tries} попыток)` : ''}`;
  }
  const anyResults = chapters.some(ch => chapterLine(ch.n)) || finals.some(w => finalLine(w.v));

  const chip = (sel, text, label) => `<label class="chip"><input type="checkbox" name="sel" value="${sel}"${label ? ` aria-label="${label}"` : ''}><span>${text}</span></label>`;
  document.getElementById('final-size').textContent = finals.length ? count(finals[0].tasks.length, TASKS) : '';
  document.getElementById('finals').innerHTML = `
    <div class="pick"><span class="chips">${finals.map(w => chip(`itog-${w.v}`, `Вариант ${w.v}${w.v === 3 ? ' · скрытый' : ''}`)).join('')}</span>
      ${finals.map(w => finalLine(w.v)).filter(Boolean).map(s => `<small class="site">${s}</small>`).join('')}</div>`;
  // Первая строка отмечает вариант сразу во всех главах.
  document.getElementById('chapters').innerHTML = `
    <div class="pick all"><span class="name">Все главы сразу</span>
      <span class="chips">${[1, 2, 3].map(v => `<label class="chip"><input type="checkbox" data-all="${v}" aria-label="Вариант ${v} во всех главах"><span>${v}</span></label>`).join('')}</span></div>
    ${chapters.map(ch => `
    <div class="pick"><span class="name">${ch.n}. ${ch.title}</span>
      <span class="chips">${[1, 2, 3].filter(v => examTasks(ch.n, v).length).map(v => chip(`ch-${ch.n}-${v}`, v, `Глава ${ch.n}, вариант ${v}`)).join('')}</span>
      ${chapterLine(ch.n) ? `<small class="site">${chapterLine(ch.n)}</small>` : ''}</div>`).join('')}`;
  // Темы свёрнуты по главам; у свёрнутой главы видно, сколько тем в ней отмечено.
  document.getElementById('topics').innerHTML = course.map(ch => `
    <details>
      <summary>${ch.n}. ${ch.title}<small class="picked"></small></summary>
      ${topicList.filter(x => x.ch === ch && pool[x.t.id]).map(x => `
        <label><input type="checkbox" name="sel" value="t-${x.t.id}"> <span>${x.num}. ${x.t.title}</span> <small class="site">${count(pool[x.t.id].length, TASKS)}</small></label>`).join('')}
    </details>`).join('');
  document.getElementById('site-note').textContent = anyResults
    ? 'Результаты на сайте — попытки ребёнка в этом браузере: у вариантов 1 и 2 лучшая, у варианта 3 итогового теста первая.'
    : 'Если открыть эту страницу в браузере, где ребёнок решает работы на сайте, рядом с ними появятся его результаты.';

  document.getElementById('sheets').innerHTML = works.map(w =>
    paper({ title: w.title, sub: w.sub, tasks: w.tasks, rules: w.rules, cls: 'is-hidden', attrs: ` data-sel="${w.sel}"` })).join('');

  // Ключ: столбец решений есть, только если они есть у задач работы; последний столбец — тема для повторения,
  // а в листе по теме — откуда задача.
  document.getElementById('keys').innerHTML = '<h2>Ответы</h2>' + works.map(w => {
    const sol = w.tasks.some(k => k.why || k.hint);
    return `
    <div class="key is-hidden${w.tasks.length > 10 ? ' long' : ''}" data-sel="${w.sel}">
      <h3>${w.key}</h3>
      <div class="key-wrap"><table class="key-table">
        <thead><tr><th>№</th><th>Ответ</th>${sol ? '<th>Решение</th>' : ''}<th>${w.src ? 'Откуда задача' : 'Если ошибка, повторить тему'}</th></tr></thead>
        <tbody>${w.tasks.map((k, i) => `<tr><td>${i + 1}</td><td class="a">${fmtAnswer([].concat(k.a)[0])}</td>${sol ? `<td>${rich(k.why || k.hint || '')}</td>` : ''}<td class="last">${w.src ? w.src[i] : topicsOf(k)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="scale">Оценка по числу верных ответов: ${scale(w.tasks.length)}.</p>
    </div>`;
  }).join('');

  // Показываются и печатаются только отмеченные работы.
  const form = document.getElementById('choose'), printBtn = document.getElementById('print');
  const chapterBoxes = v => [...form.querySelectorAll(`input[name="sel"][value^="ch-"][value$="-${v}"]`)];
  function update() {
    const on = new Set([...form.querySelectorAll('input[name="sel"]:checked')].map(i => i.value));
    document.querySelectorAll('.paper, .key').forEach(el => el.classList.toggle('is-hidden', !on.has(el.dataset.sel)));
    form.querySelectorAll('[data-all]').forEach(a => {
      const boxes = chapterBoxes(a.dataset.all), n = boxes.filter(b => b.checked).length;
      a.checked = boxes.length > 0 && n === boxes.length;
      a.indeterminate = n > 0 && n < boxes.length;
    });
    form.querySelectorAll('.topics details').forEach(d => {
      const n = d.querySelectorAll('input:checked').length;
      d.querySelector('.picked').textContent = n ? ` · отмечено: ${n}` : '';
    });
    document.getElementById('count').textContent = on.size ? `Отмечено: ${count(on.size, ['работа', 'работы', 'работ'])}` : 'Ничего не отмечено';
    document.body.classList.toggle('no-keys', !document.getElementById('with-keys').checked || on.size === 0);
    document.getElementById('empty').hidden = on.size > 0;
    printBtn.disabled = on.size === 0;
  }
  form.addEventListener('change', e => {
    const v = e.target.dataset.all;
    if (v) chapterBoxes(v).forEach(b => { b.checked = e.target.checked; });
    update();
  });
  printBtn.addEventListener('click', () => window.print());
  // Вариант 3 на сайте открывается вместо этой страницы: кнопка «Назад» в браузере сюда не вернёт.
  document.getElementById('open-final').addEventListener('click', () => location.replace('./#' + HIDDEN_FINAL));
  update();
})();
