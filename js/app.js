/* Оглавление, страницы тем, шпаргалка, проверка ответов и прогресс. */
(function () {
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

  /* ---------- прогресс (только в этом браузере) ---------- */
  const KEY = 'mvk-progress-v1';
  let progress = { solved: {} };
  try { progress = JSON.parse(localStorage.getItem(KEY)) || progress; } catch (e) { /* хранилище недоступно */ }
  if (!progress.solved) progress.solved = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* ничего */ } };
  const solvedSet = id => new Set(progress.solved[id] || []);
  const isDone = t => t.tasks.length > 0 && solvedSet(t.id).size >= t.tasks.length;
  function markSolved(t, i) {
    const s = solvedSet(t.id); s.add(i); progress.solved[t.id] = [...s]; save();
  }

  /* ---------- разметка дробей: {3/4} и {1 2/3} ---------- */
  const frac = (a, b) => `<span class="fr" role="math" aria-label="${a}/${b}"><span>${a}</span><span>${b}</span></span>`;
  function rich(html) {
    if (!html) return '';
    return html
      .replace(/\{(\d+)\s+([^{}\/\s]+)\/([^{}\/]+)\}/g, (m, w, a, b) => `<span class="mix"><span class="w">${w}</span>${frac(a, b)}</span>`)
      .replace(/\{([^{}\/]+)\/([^{}\/]+)\}/g, (m, a, b) => frac(a, b));
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- разбор числа: 7, -3, 0,25, 3/4, 1 2/3 ---------- */
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
    const reduced = gcd(p, q) === 1;
    const g = gcd(p, q);
    return { p: p / g, q: q / g, reduced, isFrac: s.includes('/') };
  }
  // Кириллические «х», «а», «с» и т. п. выглядят как латинские: принимаем оба варианта.
  const LOOK = { 'х': 'x', 'а': 'a', 'с': 'c', 'у': 'y', 'е': 'e', 'о': 'o', 'р': 'p', 'к': 'k', 'в': 'b' };
  const normText = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[−–—]/g, '-').replace(/[*×·]/g, '')
    .replace(/\s+/g, '').replace(',', '.').replace(/[хасуеоркв]/g, c => LOOK[c]);

  function check(task, input) {
    const answers = [].concat(task.a);
    const u = parseNum(input);
    for (const a of answers) {
      const e = parseNum(a);
      if (task.exact || !e || !u) {
        if (normText(input) === normText(a)) return { ok: true };
        continue;
      }
      if (u.p === e.p && u.q === e.q) {
        if (u.isFrac && !u.reduced) return { ok: false, msg: 'Значение верное, но дробь можно сократить. Сократи и отправь ещё раз.' };
        return { ok: true };
      }
    }
    return { ok: false };
  }

  /* ---------- страницы ---------- */
  function home() {
    const done = topics.filter(isDone).length;
    const pct = topics.length ? Math.round(done / topics.length * 100) : 0;
    return `
      <section class="hero">
        <h1>Математика 5–6 класса: общие правила и всё, что из них следует</h1>
        <p>В каждой теме одно общее правило, из него выведены частные правила с примерами. Дальше идут частая ошибка и задачи с проверкой ответа. В теме указано, на какие правила она опирается и где используется дальше.</p>
        <div class="progress"><span>Решено тем: <b class="mono">${done} из ${topics.length}</b></span><span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span></div>
      </section>
      <div class="toc">
        ${chapters.map(ch => `
          <section>
            <h2><span>${ch.n}. ${ch.title}</span><span class="grade">${ch.grade}</span></h2>
            <ol>${ch.topics.map(t => `
              <li><a href="#${t.id}"><span class="n">${t.num}</span><span class="t">${t.title}</span>${isDone(t) ? '<span class="ok" title="Все задачи решены">✓</span>' : ''}</a></li>`).join('')}
            </ol>
          </section>`).join('')}
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

  function taskHtml(t, task, i, solved) {
    const fracHint = [].concat(task.a).some(a => String(a).includes('/'));
    const ctrl = task.opts
      ? `<div class="opts" role="group" aria-label="Варианты ответа">${task.opts.map(o => `<button type="button" class="btn opt" data-opt="${esc(o)}">${rich(o)}</button>`).join('')}</div>`
      : `<form data-task="${i}" autocomplete="off">
           <input id="in-${t.id}-${i}" name="answer" aria-label="Ответ к задаче ${i + 1}" inputmode="${task.text ? 'text' : 'decimal'}" placeholder="Ответ" ${solved ? `value="${esc([].concat(task.a)[0])}"` : ''}>
           <button class="btn" type="submit">Проверить</button>
         </form>
         ${fracHint ? '<div class="format">Дробь пиши через косую черту: 3/4. Смешанное число — через пробел: 1 2/3.</div>' : ''}`;
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
    return `
      <p class="crumbs"><a href="#">Оглавление</a> · Глава ${t.ch.n}. ${t.ch.title}</p>
      <p class="eyebrow">Тема ${t.num} · ${t.grade}</p>
      <h1>${t.title}</h1>
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
        ${next ? `<a class="next" href="#${next.id}"><small>Дальше →</small>${next.num}. ${next.title}</a>` : `<a class="next" href="#"><small>Это последняя тема</small>К оглавлению</a>`}
      </nav>`;
  }

  /* ---------- ответы ---------- */
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
    fb.className = 'fb no'; fb.textContent = r.msg || 'Пока не то. Попробуй ещё раз.';
    let html = '';
    if (task.hint) html += `<div class="hint"><b>Подсказка.</b> ${rich(task.hint)}</div>`;
    if (tries[key] >= 2) html += `<p><button type="button" class="btn ghost" data-show="${i}">Показать ответ</button></p>`;
    more.innerHTML = html;
  }

  app.addEventListener('submit', e => {
    const form = e.target.closest('form[data-task]');
    if (!form) return;
    e.preventDefault();
    const t = byId[current], i = +form.dataset.task;
    answer(t, i, form.elements.answer.value, form.closest('.task'));
  });
  app.addEventListener('click', e => {
    const opt = e.target.closest('[data-opt]'), show = e.target.closest('[data-show]');
    if (opt) { const box = opt.closest('.task'); answer(byId[current], +box.dataset.i, opt.dataset.opt, box); }
    if (show) {
      const t = byId[current], i = +show.dataset.show, task = t.tasks[i];
      show.closest('.more').innerHTML = `<div class="hint"><b>Ответ:</b> ${rich(String([].concat(task.a)[0]).replace(/^(-?\d+) (\d+)\/(\d+)$/, '{$1 $2/$3}').replace(/^(-?\d+)\/(\d+)$/, '{$1/$2}'))}${task.why ? '<br>' + rich(task.why) : ''}</div>`;
    }
  });

  /* ---------- маршруты: #, #shpargalka, #id-темы ---------- */
  let current = '';
  function render() {
    const id = decodeURIComponent(location.hash.slice(1));
    current = id;
    if (id === 'shpargalka') app.innerHTML = sheet();
    else if (byId[id]) app.innerHTML = topic(byId[id]);
    else { current = ''; app.innerHTML = home(); }
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
