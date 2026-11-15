/* Страница для родителей: итоговый тест (три варианта) и вариант 3 экзаменов по главам для печати,
   ключ ответов с решениями и результаты ребёнка на сайте. */
(function () {
  const { rich, fmtAnswer, grade, scale, examBest, HIDDEN_FINAL, finalTasks, paper, RULES } = window.MVK;
  const E = window.EXAMS3 || {};
  const course = (window.COURSE || []).slice().sort((a, b) => a.n - b.n);
  const chapters = course.filter(ch => E[ch.n]);
  const topicName = {};
  course.forEach(ch => ch.topics.forEach((t, i) => { topicName[t.id] = `${ch.n}.${i + 1}. ${t.title}`; }));
  const topicsOf = k => [].concat(k.t || []).map(id => topicName[id]).filter(Boolean).join('; ');

  // Работы по порядку печати: итоговый тест, потом экзамены глав. sel — значение флажка и метка листа и ключа.
  const finals = [1, 2, 3].map(v => ({ v, tasks: finalTasks(v) })).filter(w => w.tasks.length);
  const works = [
    ...finals.map(w => ({ sel: `itog-${w.v}`, tasks: w.tasks, title: 'Итоговый тест по всей программе',
      sub: `Проверочная работа · вариант ${w.v}`, key: `Итоговый тест · вариант ${w.v}`, rules: `${RULES} На работу — около часа.` })),
    ...chapters.map(ch => ({ sel: `ch-${ch.n}`, tasks: E[ch.n], title: `Глава ${ch.n}. ${ch.title}`,
      sub: 'Проверочная работа · вариант 3', key: `Глава ${ch.n}. ${ch.title} · вариант 3` })),
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
    if (v < 3) return `лучший результат на сайте: ${mark(b)}`;
    const day = b.at ? ' ' + new Date(b.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
    const errors = b.wrong && b.wrong.length ? `, ошибки в задачах ${b.wrong.join(', ')}` : ', без ошибок';
    return `решён на сайте${day}: ${mark(b)}${errors}${b.tries > 1 ? ` (первая из ${b.tries} попыток)` : ''}`;
  }
  const anyResults = chapters.some(ch => chapterLine(ch.n)) || finals.some(w => finalLine(w.v));

  const choice = (sel, label, note) => `
    <label><input type="checkbox" name="sel" value="${sel}"> <span>${label}</span>${note ? ` <small class="site">${note}</small>` : ''}</label>`;
  document.querySelector('#choose .finals').insertAdjacentHTML('beforeend', finals.map(w =>
    choice(`itog-${w.v}`, `Вариант ${w.v}${w.v === 3 ? ' (скрытый)' : ''}`, finalLine(w.v))).join(''));
  document.querySelector('#choose .chapters').insertAdjacentHTML('beforeend', chapters.map(ch =>
    choice(`ch-${ch.n}`, `${ch.n}. ${ch.title}`, chapterLine(ch.n))).join(''));
  document.getElementById('site-note').textContent = anyResults
    ? 'Результаты на сайте — попытки ребёнка в этом браузере: у вариантов 1 и 2 лучшая, у варианта 3 итогового теста первая.'
    : 'Если открыть эту страницу в браузере, где ребёнок решает работы на сайте, рядом с ними появятся его результаты.';

  document.getElementById('sheets').innerHTML = works.map(w =>
    paper({ title: w.title, sub: w.sub, tasks: w.tasks, rules: w.rules, cls: 'is-hidden', attrs: ` data-sel="${w.sel}"` })).join('');

  document.getElementById('keys').innerHTML = '<h2>Ответы</h2>' + works.map(w => `
    <div class="key is-hidden${w.tasks.length > 10 ? ' long' : ''}" data-sel="${w.sel}">
      <h3>${w.key}</h3>
      <table class="key-table">
        <thead><tr><th>№</th><th>Ответ</th><th>Решение</th><th>Если ошибка, повторить тему</th></tr></thead>
        <tbody>${w.tasks.map((k, i) => `<tr><td>${i + 1}</td><td class="a">${fmtAnswer([].concat(k.a)[0])}</td><td>${rich(k.why || '')}</td><td>${topicsOf(k)}</td></tr>`).join('')}</tbody>
      </table>
      <p class="scale">Оценка по числу верных ответов: ${scale(w.tasks.length)}.</p>
    </div>`).join('');

  // Показываются и печатаются только отмеченные работы.
  const form = document.getElementById('choose'), printBtn = document.getElementById('print');
  function update() {
    const on = new Set([...form.querySelectorAll('input[name="sel"]:checked')].map(i => i.value));
    document.querySelectorAll('.paper, .key').forEach(el => el.classList.toggle('is-hidden', !on.has(el.dataset.sel)));
    document.body.classList.toggle('no-keys', !document.getElementById('with-keys').checked || on.size === 0);
    document.getElementById('empty').hidden = on.size > 0;
    printBtn.disabled = on.size === 0;
  }
  form.addEventListener('change', update);
  printBtn.addEventListener('click', () => window.print());
  // Вариант 3 на сайте открывается вместо этой страницы: кнопка «Назад» в браузере сюда не вернёт.
  document.getElementById('open-final').addEventListener('click', () => location.replace('./#' + HIDDEN_FINAL));
  update();
})();
