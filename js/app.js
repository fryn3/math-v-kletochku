/* Оглавление, страницы тем, экзамены, итоговый тест, шпаргалка, прогресс и переключатель темы. */
(function () {
  const { rich, esc, check, fmtAnswer, grade, scale, examVer, examBest, HIDDEN_FINAL, finalTasks, paper, RULES } = window.MVK;
  // Номер версии из адреса этого скрипта (app.js?v=9): с ним же подгружается скрытый вариант итогового теста.
  const VER = (((document.currentScript || {}).src || '').match(/\?v=([\w.-]+)/) || [])[1];
  const chapters = (window.COURSE || []).slice().sort((a, b) => a.n - b.n);
  const topics = [];
  chapters.forEach(ch => ch.topics.forEach((t, i) => {
    t.num = `${ch.n}.${i + 1}`; t.ch = ch; t.grade = t.grade || ch.grade; t.tasks = t.tasks || [];
    topics.push(t);
  }));
  const byId = Object.fromEntries(topics.map(t => [t.id, t]));
  const app = document.getElementById('app');
  // Связи между правилами: из чего тема следует (base) и где она используется (usedBy).
  const usedBy = {};
  topics.forEach(t => (t.base || []).forEach(b => (usedBy[b] = usedBy[b] || []).push(t)));
  const ref = t => `<a href="#${t.id}">${t.num} ${t.title}</a>`;
  const refs = ids => ids.map(id => byId[id]).filter(Boolean).map(ref).join(', ');
  // Экзамены: EXAMS[n] — список задач главы n, у каждой два варианта (v[0] и v[1]) и тема t.
  const EXAMS = window.EXAMS || {};
  const examTasks = (n, v) => (EXAMS[n] || []).map(s => Object.assign({ t: s.t }, s.v[v - 1]));
  // Итоговый тест по всей программе: варианты 1 и 2 (final.js) открыты, вариант 3 подгружается по скрытому адресу.
  const FINAL = window.FINAL || [];
  // Уроки у доски (uroki/): у темы есть урок, если в курсе книги (uroki/course.js) на её месте готовый урок
  // с тем же названием. Так ссылка не уедет на чужой урок, когда в справочнике появится новая тема.
  const lessons = {};
  for (const [n, , , first, list] of window.UROKI_COURSE || []) list.forEach(([title, min], i) => {
    if (min > 0) lessons[`${n}.${i + 1}`] = { href: `uroki/ch${String(first + i).padStart(2, '0')}/`, title, min };
  });
  const lessonOf = t => { const l = lessons[t.num]; return l && l.title === t.title ? l : null; };
  const PLAY = '<span class="play" aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 0l9 5-9 5z"/></svg></span>';

  /* ---------- прогресс (только в этом браузере) ---------- */
  const KEY = 'mvk-progress-v1';
  let progress = { solved: {}, exams: {} };
  try { progress = JSON.parse(localStorage.getItem(KEY)) || progress; } catch (e) { /* хранилище недоступно */ }
  progress.solved = progress.solved || {};
  progress.exams = progress.exams || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* ничего */ } };
  const solvedSet = id => new Set(progress.solved[id] || []);
  const isDone = t => t.tasks.length > 0 && solvedSet(t.id).size >= t.tasks.length;
  function markSolved(t, i) {
    const s = solvedSet(t.id); s.add(i); progress.solved[t.id] = [...s]; save();
  }
  // Лучший результат экзамена: { ok: верных, n: всего задач, ver: версия экзамена }.
  const bestOf = (n, v) => examBest(progress.exams, n, v);
  const scoreHtml = (n, v) => {
    const b = bestOf(n, v);
    return b ? ` — <span class="score${grade(b.ok, b.n) < 4 ? ' low' : ''}" title="Лучший результат">${b.ok} из ${b.n}</span>` : '';
  };

  /* ---------- страницы ---------- */
  function home() {
    const done = topics.filter(isDone).length;
    const pct = topics.length ? Math.round(done / topics.length * 100) : 0;
    return `
      <section class="hero">
        <h1>Математика 5–6 класса: общие правила и всё, что из них следует</h1>
        <p>В каждой теме одно общее правило, из него выведены частные правила с примерами. Дальше идут частая ошибка и задачи с проверкой ответа. В теме указано, на какие правила она опирается и где используется дальше. После каждой главы есть экзамен в двух вариантах, а в конце — итоговый тест по всей программе.</p>
        ${Object.keys(lessons).length ? `<a class="lesson" href="uroki/">${PLAY}Уроки у доски <small>каждая тема — анимированный урок с озвучкой</small></a>` : ''}
        <div class="progress"><span>Решено тем: <b class="mono">${done} из ${topics.length}</b></span><span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span></div>
      </section>
      <div class="toc">
        ${chapters.map(ch => `
          <section>
            <h2><span>${ch.n}. ${ch.title}</span><span class="grade">${ch.grade}</span></h2>
            <ol>${ch.topics.map(t => `
              <li><a href="#${t.id}"><span class="n">${t.num}</span><span class="t">${t.title}</span>${isDone(t) ? '<span class="ok" title="Все задачи решены">✓</span>' : ''}</a></li>`).join('')}
            </ol>
            ${EXAMS[ch.n] ? `<p class="exam-link">Экзамен: ${[1, 2].map(v => `<span class="nw"><a href="#ekzamen-${ch.n}-${v}">вариант ${v}</a>${scoreHtml(ch.n, v)}</span>`).join(' · ')}</p>` : ''}
          </section>`).join('')}
        ${FINAL.length ? `
          <section class="final">
            <h2><span>Итоговый тест по всей программе</span><span class="grade">5–6 класс</span></h2>
            <p>${FINAL.length} ${plural(FINAL.length, ['задача', 'задачи', 'задач'])} по всем главам. Его можно решить здесь или распечатать и решить на бумаге.</p>
            <p class="exam-link">Тест: ${[1, 2].map(v => `<span class="nw"><a href="#itog-${v}">вариант ${v}</a>${scoreHtml('itog', v)}</span>`).join(' · ')}</p>
          </section>` : ''}
      </div>
      <p style="margin-top:22px">Все правила на одной странице — в <a href="#shpargalka">шпаргалке</a>.</p>`;
  }

  function sheet() {
    return `
      <p class="crumbs"><a href="#">Оглавление</a></p>
      <h1>Шпаргалка</h1>
      <p>Все общие правила и их следствия на одной странице.</p>
      <div class="sheet">
        ${chapters.map(ch => `
          <section>
            <h2>${ch.n}. ${ch.title}</h2>
            ${ch.topics.map(t => `<div class="item"><a href="#${t.id}">${t.num}. ${t.title}</a>${rich(t.rule)}${t.derive ? `<p class="dlist">Отсюда: ${t.derive.map(d => d[0].toLowerCase()).join(' · ')}</p>` : ''}</div>`).join('')}
          </section>`).join('')}
      </div>`;
  }

  const fracFormat = '<div class="format">Дробь пиши через косую черту: 3/4. Смешанное число — через пробел: 1 2/3.</div>';
  const hasFrac = task => [].concat(task.a).some(a => String(a).includes('/'));

  function taskHtml(t, task, i, solved) {
    const ctrl = task.opts
      ? `<div class="opts" role="group" aria-label="Варианты ответа">${task.opts.map(o => `<button type="button" class="btn opt" data-opt="${esc(o)}">${rich(o)}</button>`).join('')}</div>`
      : `<form data-task="${i}" autocomplete="off">
           <input id="in-${t.id}-${i}" name="answer" aria-label="Ответ к задаче ${i + 1}" placeholder="Ответ" ${solved ? `value="${esc([].concat(task.a)[0])}"` : ''}>
           <button class="btn" type="submit">Проверить</button>
         </form>
         ${hasFrac(task) ? fracFormat : ''}`;
    return `
      <div class="task${solved ? ' solved' : ''}" data-i="${i}">
        <div class="q"><span class="k">${solved ? '✓' : (i + 1) + '.'}</span><div>${rich(task.q)}</div></div>
        ${ctrl}
        <div class="fb" aria-live="polite">${solved ? '<span class="fb ok">Решено.</span>' : ''}</div>
        <div class="more"></div>
      </div>`;
  }

  function topic(t) {
    const i = topics.indexOf(t), prev = topics[i - 1], next = topics[i + 1], s = solvedSet(t.id);
    const toExam = (!next || next.ch !== t.ch) && EXAMS[t.ch.n];
    return `
      <p class="crumbs"><a href="#">Оглавление</a> · Глава ${t.ch.n}. ${t.ch.title}</p>
      <p class="eyebrow">Тема ${t.num} · ${t.grade}</p>
      <h1>${t.title}</h1>
      ${lessonOf(t) ? `<a class="lesson" href="${lessonOf(t).href}">${PLAY}Урок у доски <small>${lessonOf(t).min} мин</small></a>` : ''}
      ${t.base && t.base.length ? `<p class="base">Опирается на: ${refs(t.base)}</p>` : ''}
      <div class="rule"><div class="eyebrow">Общее правило</div>${rich(t.rule)}</div>
      ${rich(t.body)}
      ${t.derive ? `<section class="derive"><h2>Отсюда</h2><ol>${t.derive.map(([name, how, ex]) =>
        `<li><b>${rich(name)}${how ? ':' : ''}</b>${how ? ' ' + rich(how) : ''}${ex ? `<div class="eg">${rich(ex)}</div>` : ''}</li>`).join('')}</ol></section>` : ''}
      ${usedBy[t.id] ? `<p class="base">Используется дальше: ${usedBy[t.id].map(ref).join(', ')}</p>` : ''}
      ${t.trap ? `<div class="trap"><span class="hand">Ловушка!</span>${rich(t.trap)}</div>` : ''}
      ${t.tasks.length ? `<section class="tasks"><h2>Проверь себя</h2>${t.tasks.map((k, j) => taskHtml(t, k, j, s.has(j))).join('')}</section>` : ''}
      <nav class="pager" aria-label="Соседние темы">
        ${prev ? `<a class="prev" href="#${prev.id}"><small>← Назад</small>${prev.num}. ${prev.title}</a>` : ''}
        ${toExam ? `<a class="next" href="#ekzamen-${t.ch.n}-1"><small>Дальше →</small>Экзамен по главе ${t.ch.n}</a>`
          : next ? `<a class="next" href="#${next.id}"><small>Дальше →</small>${next.num}. ${next.title}</a>`
          : `<a class="next" href="#"><small>Это последняя тема</small>К оглавлению</a>`}
      </nav>`;
  }

  /* ---------- экзамены глав и итоговый тест ---------- */
  const plural = (n, forms) => forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
  // Открытая работа: { n, v, tasks } — результат хранится под ключом «n-v»; again — куда вести после проверки;
  // draft — ответы сохраняются до проверки; first — запоминается первая попытка, а не лучшая.
  let test = null;

  function examTaskHtml(k, i) {
    const ctrl = k.opts
      ? `<div class="opts" role="radiogroup" aria-label="Варианты ответа к задаче ${i + 1}">${k.opts.map(o =>
          `<label class="opt"><input type="radio" name="q${i}" value="${esc(o)}"> ${rich(o)}</label>`).join('')}</div>`
      : `<div><input name="q${i}" aria-label="Ответ к задаче ${i + 1}" placeholder="Ответ" enterkeyhint="next"></div>${hasFrac(k) ? fracFormat : ''}`;
    return `<div class="task" data-i="${i}"><div class="q"><span class="k">${i + 1}.</span><div>${rich(k.q)}</div></div>${ctrl}<div class="fb" aria-live="polite"></div></div>`;
  }

  const variants = (href, v) => `<div class="seg" role="group" aria-label="Вариант">${[1, 2].map(k =>
    `<a href="${href}${k}"${k === v ? ' aria-current="page"' : ''}>Вариант ${k}</a>`).join('')}</div>`;
  const testForm = tasks => `
      <form id="exam" autocomplete="off">
        ${tasks.map(examTaskHtml).join('')}
        <p><button class="btn" type="submit">Проверить</button></p>
      </form>
      <div id="exam-result" aria-live="polite"></div>`;

  function exam(ch, v) {
    const tasks = examTasks(ch.n, v), best = bestOf(ch.n, v);
    const last = ch.topics[ch.topics.length - 1], nextCh = chapters[chapters.indexOf(ch) + 1];
    test = { n: ch.n, v, tasks, again: { href: `#ekzamen-${ch.n}-${3 - v}`, t: `Вариант ${3 - v}` } };
    return `
      <p class="crumbs"><a href="#">Оглавление</a> · Глава ${ch.n}. ${ch.title}</p>
      <p class="eyebrow">Экзамен по главе ${ch.n}</p>
      <h1>${ch.title}: экзамен</h1>
      ${variants(`#ekzamen-${ch.n}-`, v)}
      <p>${tasks.length} ${plural(tasks.length, ['задача', 'задачи', 'задач'])} по всем темам главы, подсказок нет. Реши все задачи и нажми «Проверить». Оценка по числу верных ответов: ${scale(tasks.length)}.${best ? ` Твой лучший результат в этом варианте: ${best.ok} из ${best.n}.` : ''}</p>
      ${testForm(tasks)}
      <nav class="pager" aria-label="Соседние разделы">
        <a class="prev" href="#${last.id}"><small>← Назад</small>${last.num}. ${last.title}</a>
        ${nextCh ? `<a class="next" href="#${nextCh.topics[0].id}"><small>Дальше →</small>Глава ${nextCh.n}. ${nextCh.title}</a>`
          : FINAL.length ? '<a class="next" href="#itog-1"><small>Дальше →</small>Итоговый тест по всей программе</a>'
          : '<a class="next" href="#"><small>Это последняя глава</small>К оглавлению</a>'}
      </nav>`;
  }

  // Итоговый тест. Вариант 3 открывается только по скрытому адресу: без переключателя вариантов и навигации,
  // и запоминается его первая попытка — её увидит родитель на своей странице.
  function finalPage(v) {
    const tasks = finalTasks(v), hidden = v === 3, best = hidden ? null : bestOf('itog', v);
    const lastCh = chapters.filter(ch => EXAMS[ch.n]).pop();
    test = { n: 'itog', v, tasks, draft: true, first: hidden, again: hidden ? null : { href: `#itog-${3 - v}`, t: `Вариант ${3 - v}` } };
    return `
      <p class="crumbs"><a href="#">Оглавление</a> · Итоговый тест</p>
      <p class="eyebrow">Итоговый тест${hidden ? ' · вариант 3' : ''}</p>
      <h1>Итоговый тест по всей программе</h1>
      ${hidden ? '' : variants('#itog-', v)}
      <p>${tasks.length} ${plural(tasks.length, ['задача', 'задачи', 'задач'])} по всем главам в порядке программы. Подсказок нет, на работу нужно около часа. Реши все задачи и нажми «Проверить». Оценка по числу верных ответов: ${scale(tasks.length)}.${best ? ` Твой лучший результат в этом варианте: ${best.ok} из ${best.n}.` : ''}</p>
      <p class="aside">Ответы сохраняются в этом браузере, пока ты не нажмёшь «Проверить», поэтому работу можно прервать и закончить позже. Удобнее на бумаге — распечатай задачи, а ответы потом впиши сюда.</p>
      <p><button type="button" class="btn ghost" data-print>Распечатать</button></p>
      ${testForm(tasks)}
      ${hidden ? '' : `<nav class="pager" aria-label="Соседние разделы">
        ${lastCh ? `<a class="prev" href="#ekzamen-${lastCh.n}-1"><small>← Назад</small>Экзамен по главе ${lastCh.n}</a>` : ''}
        <a class="next" href="#"><small>Это конец программы</small>К оглавлению</a>
      </nav>`}
      ${paper({ title: 'Итоговый тест по всей программе', sub: `Вариант ${v}`, tasks, rules: `${RULES} На работу — около часа.` })}`;
  }

  // Вариант 3 итогового теста на сайт не подключён: его скрипт загружается, только когда открыт скрытый адрес.
  let hiddenState = '';
  function loadHidden() {
    if (hiddenState === 'failed') return '<p>Не удалось загрузить работу. Проверь подключение к интернету и обнови страницу.</p>';
    if (!hiddenState) {
      hiddenState = 'loading';
      const s = document.createElement('script');
      s.src = `js/final-parents.js${VER ? '?v=' + VER : ''}`;
      s.onload = s.onerror = () => { hiddenState = window.FINAL3 ? 'done' : 'failed'; if (current === HIDDEN_FINAL) render(); };
      document.head.appendChild(s);
    }
    return '<p>Загружаю работу…</p>';
  }

  // Черновик итогового теста: ответы хранятся в этом браузере, пока работу не проверили, но не дольше недели.
  const draftKey = () => `mvk-draft-${test.n}-${test.v}`;
  function saveDraft(form) {
    const a = test.tasks.map((k, i) => answerOf(form, i));
    try { localStorage.setItem(draftKey(), JSON.stringify({ ver: examVer(test.n), at: Date.now(), a })); } catch (e) { /* ничего */ }
  }
  const dropDraft = () => { try { localStorage.removeItem(draftKey()); } catch (e) { /* ничего */ } };
  function restoreDraft(form) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey())); } catch (e) { /* хранилище недоступно */ }
    if (!d) return;
    if (d.ver !== examVer(test.n) || !Array.isArray(d.a) || !(Date.now() - d.at < 7 * 864e5)) { dropDraft(); return; }
    // У поля ответа value — текст, у группы переключателей value отмечает вариант с таким значением.
    d.a.forEach((val, i) => { const el = form.elements['q' + i]; if (el && val) el.value = val; });
  }

  const answerOf = (form, i) => String((form.elements['q' + i] || {}).value || '').trim();
  const topicsOf = k => [].concat(k.t || []).map(id => byId[id]).filter(Boolean);

  // Перед проверкой: если есть пустые ответы, сначала спрашиваем.
  function submitExam(form, force) {
    const empty = test.tasks.map((k, i) => i).filter(i => !answerOf(form, i)).map(i => i + 1);
    if (!empty.length || force) return gradeExam(form);
    document.getElementById('exam-result').innerHTML = `<div class="result">
        <p>Нет ответа ${empty.length === 1 ? 'в задаче' : 'в задачах'} ${empty.join(', ')}. Можно вернуться и дорешать или проверить как есть: пустой ответ считается ошибкой.</p>
        <p><button type="button" class="btn ghost" data-force>Проверить как есть</button></p>
      </div>`;
  }

  function gradeExam(form) {
    const { n, v, tasks } = test, review = [], wrong = [];
    let ok = 0;
    tasks.forEach((k, i) => {
      const box = form.querySelector(`.task[data-i="${i}"]`), fb = box.querySelector('.fb');
      const val = answerOf(form, i);
      const r = val ? check(k, val) : { ok: false, msg: 'Нет ответа.' };
      if (r.ok) {
        ok++;
        box.classList.add('solved');
        box.querySelector('.k').textContent = '✓';
        fb.className = 'fb ok';
        fb.textContent = 'Верно.';
      } else {
        const ts = topicsOf(k);
        wrong.push(i + 1);
        ts.forEach(t => { if (!review.includes(t)) review.push(t); });
        box.classList.add('wrong');
        box.querySelector('.k').textContent = '✗';
        fb.className = 'fb no';
        fb.innerHTML = `${r.msg ? esc(r.msg) + ' ' : ''}Правильный ответ: <b>${fmtAnswer([].concat(k.a)[0])}</b>.${ts.length ? ` Повтори ${ts.length > 1 ? 'темы' : 'тему'} ${ts.map(ref).join(' и ')}.` : ''}${k.why ? `<div class="hint">${rich(k.why)}</div>` : ''}`;
      }
    });
    [...form.elements].forEach(el => { el.disabled = true; });
    form.querySelector('[type="submit"]').hidden = true;
    const key = `${n}-${v}`, prev = bestOf(n, v);
    if (test.first) {
      // Скрытый вариант: родителю важна первая попытка, следующие только считаются.
      if (prev) prev.tries = (prev.tries || 1) + 1;
      else progress.exams[key] = { ok, n: tasks.length, ver: examVer(n), at: Date.now(), wrong, tries: 1 };
      save();
    } else if (!prev || prev.n !== tasks.length || ok > prev.ok) { progress.exams[key] = { ok, n: tasks.length, ver: examVer(n) }; save(); }
    if (test.draft) dropDraft();
    review.sort((a, b) => topics.indexOf(a) - topics.indexOf(b));
    const res = document.getElementById('exam-result');
    res.innerHTML = `<div class="result">
        <p class="big"><b>${ok} из ${tasks.length}</b> — оценка «${grade(ok, tasks.length)}»</p>
        <p>${review.length ? `Повтори ${review.length === 1 ? 'тему' : 'темы'}: ${review.map(ref).join(', ')}.` : 'Все задачи решены верно!'}</p>
        <p class="acts">${test.again ? `<button type="button" class="btn ghost" data-retry>Решить заново</button><a class="btn ghost" href="${test.again.href}">${test.again.t}</a>`
          : '<a class="btn ghost" href="#">К оглавлению</a>'}</p>
      </div>`;
    res.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- ответы в темах ---------- */
  const tries = {};
  function answer(t, i, value, box) {
    const task = t.tasks[i], fb = box.querySelector('.fb'), more = box.querySelector('.more');
    if (!String(value).trim()) { fb.className = 'fb no'; fb.textContent = 'Сначала впиши ответ.'; return; }
    const r = check(task, value);
    if (r.ok) {
      fb.className = 'fb ok'; fb.textContent = 'Верно!';
      box.classList.add('solved'); box.querySelector('.k').textContent = '✓';
      markSolved(t, i);
      if (task.why) more.innerHTML = `<div class="hint">${rich(task.why)}</div>`;
      return;
    }
    const key = t.id + ':' + i; tries[key] = (tries[key] || 0) + 1;
    fb.className = 'fb no'; fb.textContent = r.msg ? r.msg + ' Исправь и отправь ещё раз.' : 'Пока не то. Попробуй ещё раз.';
    let html = '';
    if (task.hint) html += `<div class="hint"><b>Подсказка.</b> ${rich(task.hint)}</div>`;
    if (tries[key] >= 2) html += `<p><button type="button" class="btn ghost" data-show="${i}">Показать ответ</button></p>`;
    more.innerHTML = html;
  }

  app.addEventListener('submit', e => {
    if (e.target.id === 'exam') { e.preventDefault(); submitExam(e.target); return; }
    const form = e.target.closest('form[data-task]');
    if (!form) return;
    e.preventDefault();
    answer(byId[current], +form.dataset.task, form.elements.answer.value, form.closest('.task'));
  });
  app.addEventListener('click', e => {
    const opt = e.target.closest('[data-opt]'), show = e.target.closest('[data-show]');
    if (e.target.closest('[data-retry]')) { render(); return; }
    if (e.target.closest('[data-force]')) { submitExam(document.getElementById('exam'), true); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (opt) { const box = opt.closest('.task'); answer(byId[current], +box.dataset.i, opt.dataset.opt, box); }
    if (show) {
      const task = byId[current].tasks[+show.dataset.show];
      show.closest('.more').innerHTML = `<div class="hint"><b>Ответ:</b> ${fmtAnswer([].concat(task.a)[0])}${task.why ? '<br>' + rich(task.why) : ''}</div>`;
    }
  });

  // В экзамене Enter переводит к следующему полю, а не отправляет работу раньше времени.
  app.addEventListener('keydown', e => {
    const el = e.target;
    if (e.key !== 'Enter' || !el.form || el.form.id !== 'exam' || el.type === 'radio') return;
    e.preventDefault();
    const inputs = [...el.form.querySelectorAll('input:not([type="radio"])')];
    const next = inputs[inputs.indexOf(el) + 1];
    if (next) next.focus(); else el.form.querySelector('[type="submit"]').click();
  });

  // Черновик итогового теста сохраняется при каждом изменении ответа.
  const keepDraft = e => { const f = e.target.form; if (f && f.id === 'exam' && test && test.draft) saveDraft(f); };
  app.addEventListener('input', keepDraft);
  app.addEventListener('change', keepDraft);

  /* ---------- маршруты: #, #shpargalka, #ekzamen-N-V, #itog-V, скрытый #HIDDEN_FINAL, #id-темы ---------- */
  let current = '';
  function render() {
    const id = decodeURIComponent(location.hash.slice(1));
    const m = id.match(/^ekzamen-(\d+)-([12])$/), ch = m && chapters.find(c => c.n === +m[1]);
    const f = id.match(/^itog-([12])$/);
    current = id; test = null;
    if (id === 'shpargalka') app.innerHTML = sheet();
    else if (ch && EXAMS[ch.n]) app.innerHTML = exam(ch, +m[2]);
    else if (f && FINAL.length) app.innerHTML = finalPage(+f[1]);
    else if (id === HIDDEN_FINAL) app.innerHTML = window.FINAL3 ? finalPage(3) : loadHidden();
    else if (byId[id]) app.innerHTML = topic(byId[id]);
    else { current = ''; app.innerHTML = home(); }
    if (test && test.draft) restoreDraft(document.getElementById('exam'));
    // Страница с листом для печати печатает только его (стили @media print в index.html).
    document.body.classList.toggle('has-paper', !!app.querySelector('.paper'));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();

  /* ---------- тема: авто (как в системе) / светлая / тёмная ---------- */
  const THEME_KEY = 'mvk-theme', themeBox = document.getElementById('theme');
  let themeMode = 'auto';
  try { themeMode = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* хранилище недоступно */ }
  const markTheme = () => themeBox && themeBox.querySelectorAll('[data-mode]')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === themeMode)));
  markTheme();
  if (themeBox) themeBox.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    themeMode = b.dataset.mode;
    if (themeMode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themeMode);
    try { themeMode === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, themeMode); } catch (e) { /* ничего */ }
    markTheme();
  });
})();
