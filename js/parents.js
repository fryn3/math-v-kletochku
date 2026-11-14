/* Страница для родителей: вариант 3 по главам для печати и ключ ответов с решениями. */
(function () {
  const { rich, fmtAnswer, grade, scale, examBest } = window.MVK;
  const E = window.EXAMS3 || {};
  const chapters = (window.COURSE || []).slice().sort((a, b) => a.n - b.n).filter(ch => E[ch.n]);
  const topicName = {};
  chapters.forEach(ch => ch.topics.forEach((t, i) => { topicName[t.id] = `${ch.n}.${i + 1}. ${t.title}`; }));

  // Лучшие результаты вариантов 1 и 2, если ребёнок решал их на сайте в этом же браузере.
  let exams = {};
  try { exams = (JSON.parse(localStorage.getItem('mvk-progress-v1')) || {}).exams || {}; } catch (e) { /* хранилище недоступно */ }
  function siteLine(n) {
    const done = [1, 2].map(v => [v, examBest(exams, n, v)]).filter(([, b]) => b);
    return done.length ? 'на сайте: ' + done.map(([v, b]) => `вариант ${v} — ${b.ok} из ${b.n} («${grade(b.ok, b.n)}»)`).join(', ') : '';
  }
  const anyResults = chapters.some(ch => siteLine(ch.n));

  const answerLine = k => k.opts
    ? `<div class="ans">Обведи ответ: ${k.opts.map(o => `<span class="choice">${rich(o)}</span>`).join('')}</div>`
    : '<div class="ans">Ответ: <span class="line"></span></div>';

  document.querySelector('#choose .chapters').insertAdjacentHTML('beforeend', chapters.map(ch => `
    <label><input type="checkbox" name="ch" value="${ch.n}"> <span>${ch.n}. ${ch.title}</span>${siteLine(ch.n) ? ` <small class="site">${siteLine(ch.n)}</small>` : ''}</label>`).join(''));
  document.getElementById('site-note').textContent = anyResults
    ? 'Результаты вариантов 1 и 2 — лучшие попытки ребёнка на сайте в этом браузере.'
    : 'Если открыть эту страницу в браузере, где ребёнок решает экзамены на сайте, рядом с главами появятся его результаты по вариантам 1 и 2.';

  document.getElementById('sheets').innerHTML = chapters.map(ch => `
    <section class="sheet is-hidden" data-ch="${ch.n}">
      <div class="sheet-head"><h2>Глава ${ch.n}. ${ch.title}</h2><span>Проверочная работа · вариант 3</span></div>
      <p class="who"><span>Имя ______________________</span><span>Дата ____________</span><span>Верно ____ из ${E[ch.n].length}</span><span>Оценка ______</span></p>
      <p class="rules">Реши задачи на черновике и запиши ответ на строке. Справочником и калькулятором не пользуйся.</p>
      <ol class="ptasks">${E[ch.n].map(k => `<li><div class="q">${rich(k.q)}</div>${answerLine(k)}</li>`).join('')}</ol>
    </section>`).join('');

  document.getElementById('keys').innerHTML = '<h2>Ответы к варианту 3</h2>' + chapters.map(ch => `
    <div class="key is-hidden" data-ch="${ch.n}">
      <h3>Глава ${ch.n}. ${ch.title}</h3>
      <table class="key-table">
        <thead><tr><th>№</th><th>Ответ</th><th>Решение</th><th>Если ошибка, повторить тему</th></tr></thead>
        <tbody>${E[ch.n].map((k, i) => `<tr><td>${i + 1}</td><td class="a">${fmtAnswer([].concat(k.a)[0])}</td><td>${rich(k.why || '')}</td><td>${topicName[k.t] || ''}</td></tr>`).join('')}</tbody>
      </table>
      <p class="scale">Оценка по числу верных ответов: ${scale(E[ch.n].length)}.</p>
    </div>`).join('');

  // Показываются и печатаются только отмеченные главы.
  const form = document.getElementById('choose'), printBtn = document.getElementById('print');
  function update() {
    const on = new Set([...form.querySelectorAll('input[name="ch"]:checked')].map(i => i.value));
    document.querySelectorAll('.sheet, .key').forEach(el => el.classList.toggle('is-hidden', !on.has(el.dataset.ch)));
    document.body.classList.toggle('no-keys', !document.getElementById('with-keys').checked || on.size === 0);
    document.getElementById('empty').hidden = on.size > 0;
    printBtn.disabled = on.size === 0;
  }
  form.addEventListener('change', update);
  printBtn.addEventListener('click', () => window.print());
  update();
})();
