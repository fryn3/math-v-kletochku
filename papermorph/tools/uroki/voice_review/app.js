'use strict';
// Озвучка уроков: every beat of the book to listen to, its stress to fix, voiced again and saved.
// The server is papermorph/tools/uroki/voice_review.py; it does the stress pieces, the voicing and the files.

const ACC = '́', VOW = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ', YO = 'ёЁ';
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = s => s.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
const dec = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
const plural = (n, [one, few, many]) => {
  const a = n % 100, b = n % 10;
  return `${n} ${a > 10 && a < 20 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many}`;
};
const duration = s => {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return h ? `${h} ч ${m} мин` : m ? `${m} мин ${r} с` : `${r} с`;
};
const store = {   // per-browser conveniences only; the page works without them
  get(k, d) { try { const v = localStorage.getItem('golos.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('golos.' + k, JSON.stringify(v)); } catch { /* private window */ } },
};

const S = {
  book: null, view: null, info: null, list: [], current: null, token: 0, poll: 0,
  filter: store.get('filter', 'all'), auto: store.get('auto', true), speed: store.get('speed', 1),
};
const MODELS = new Map();   // "chNN/beat" -> the beat as the page holds it, kept across topics and searches
const P = { audio: new Audio(), m: null, which: 'clip', clip: null, k: -1, raf: 0, run: false, from: 0, next: false };
P.audio.preload = 'auto';
const main = $('#main'), side = $('#side'), pop = $('#pop');

const FILTERS = [
  ['all', 'Все', () => true],
  ['flag', 'Омографы', m => m.cur.words.some(w => w.why === 'homo' || w.why === 'yo')],
  ['given', 'Заданы', m => m.cur.pieces.length > 0],
  ['unheard', 'Не прослушаны', m => !m.saved.heard],
  ['todo', 'Изменены', m => m.cur.dirty || !m.cur.voiced || !!m.draft || m.cur.lost.length > 0],
];

function soon(fn, ms = 400) {   // one call after a burst of them
  clearTimeout(soon.timers.get(fn));
  soon.timers.set(fn, setTimeout(fn, ms));
}
soon.timers = new Map();

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
}

async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  let r;
  try { r = await fetch(path, opt); } catch { throw new Error('сервер не отвечает — запущен ли voice_review.py?'); }
  const data = await r.json().catch(() => ({ error: `ошибка ${r.status}` }));
  if (!r.ok) throw new Error(data.error || `ошибка ${r.status}`);
  return data;
}

// --- beats -----------------------------------------------------------------------------------------------------------

function formsFrom(words) {   // {word index: form} of the words a stress piece sets
  const f = {};
  words.forEach((w, k) => { if (w.given) f[k] = w.given; });
  return f;
}

function reset(m, v) {
  return Object.assign(m, { saved: v, cur: v, text: v.text, forms: formsFrom(v.words), derive: false, draft: null,
    busy: '', error: v.pending_error || '', editing: false, note: '' });
}

function model(v) {   // a beat from the server, with the unsaved change the server keeps for it (the queue)
  const uid = `${v.ch}/${v.id}`;
  let m = MODELS.get(uid);
  if (!m) MODELS.set(uid, m = { uid, ch: v.ch, id: v.id });
  else if (m.busy || m.editing) { m.saved = v; return m; }   // mid-request or mid-edit: the page's own state wins
  reset(m, v);
  const p = v.pending;
  if (p) Object.assign(m, { cur: p, text: p.text, forms: formsFrom(p.words), draft: p.draft || null, note: p.note || '' });
  return m;
}

const pendingSave = m => m.cur.dirty || !!m.draft;
const topicOf = ch => S.book?.topics.find(t => t.ch === ch) || { label: ch, title: '', color: '#999' };
const cardEl = m => document.getElementById(`b-${m.ch}-${m.id}`);
const vowels = s => [...s].filter(c => VOW.includes(c)).length;
const formOf = (acc, word) => [...word].map((c, i) => c + (acc.includes(i) ? ACC : '')).join('');

function formHTML(form) {   // «чи́сла» -> ч<b>и́</b>сла
  let out = '';
  for (let i = 0; i < form.length; i++) {
    const c = form[i];
    if (c === ACC) continue;
    out += form[i + 1] === ACC ? `<b class="v">${esc(c)}${YO.includes(c) ? '' : ACC}</b>` : esc(c);
  }
  return out;
}

function wordsHTML(m) {
  const v = m.cur, q = S.view?.kind === 'search' ? fold(S.view.q.toLowerCase()) : '';
  let out = '', last = 0;
  v.words.forEach((w, k) => {
    const plain = v.clean.slice(w.s, w.e), said = w.said ?? plain;
    const html = w.acc && (vowels(said) > 1 || w.why) ? formHTML(formOf(w.acc, said)) : esc(said);
    const cls = 'w' + (w.why ? ' why-' + w.why : '') + (q && fold(plain.toLowerCase()).includes(q) ? ' hit' : '');
    out += esc(v.clean.slice(last, w.s)) + `<span class="${cls}" data-k="${k}">${html}</span>`;
    last = w.e;
  });
  return out + esc(v.clean.slice(last));
}

function cardClass(m) {
  const v = m.cur;
  return 'beat' + (S.current === m ? ' current' : '') + (v.dirty || m.draft ? ' dirty' : !v.voiced ? ' stale' : '')
    + (P.m === m && !P.audio.paused ? ' playing' : '');
}

function cardHTML(m) {
  return `<article class="${cardClass(m)}" id="b-${m.ch}-${m.id}" data-uid="${m.uid}">${cardInner(m)}</article>`;
}

function cardInner(m) {
  const v = m.cur, s = m.saved, clip = s.clip;
  const flags = v.words.filter(w => w.why === 'homo' || w.why === 'yo').length;
  return `
    <header class="bh">
      <button class="play" data-act="play" title="Слушать (пробел)" ${clip ? '' : 'disabled'}>▶</button>
      <span class="bid">${esc(m.id)}</span>
      <span class="dur">${clip ? dec(clip.dur) + ' с' : 'записи нет'}</span>
      ${flags ? `<span class="tag flag" title="Слова, где Silero сам выбирал ударение или «е/ё»">омографы: ${flags}</span>` : ''}
      ${v.pieces.length ? `<span class="tag given" title="Ударения, заданные кусками в narration.ru.stress.json">задано: ${v.pieces.length}</span>` : ''}
      <span class="sp"></span>
      <label class="heard" title="Прослушан до конца"><input type="checkbox" data-act="heard" ${s.heard ? 'checked' : ''}> прослушан</label>
      <button class="link" data-act="edit" title="Изменить текст шага">✎ текст</button>
      <a class="link" href="/uroki/${m.ch}/?beat=${s.index}" target="_blank" rel="noopener" title="Открыть урок на этом шаге">урок ↗</a>
    </header>
    <div class="bar" data-act="seek" title="Перемотать"><i></i></div>
    ${m.editing ? editHTML(m) : `<p class="text">${wordsHTML(m)}</p>`}
    ${v.dirty || !v.voiced || m.draft || m.busy || m.error || v.lost.length ? footHTML(m) : ''}`;
}

function footHTML(m) {
  const v = m.cur, d = m.draft, parts = [], notes = [];
  if (m.busy) parts.push(`<span class="busy"><i class="spin"></i>${m.busy}</span>`);
  else {
    if (v.dirty) parts.push('<span class="state dirty">Изменено, не сохранено</span>');
    else if (!v.voiced) parts.push('<span class="state stale">Запись не совпадает с текстом</span>');
    if (!v.voiced && !d) parts.push('<button class="btn" data-act="voice" title="Озвучить шаг как он сейчас размечен">Озвучить</button>');
    if (d) parts.push(`<button class="btn" data-act="old" ${m.saved.clip ? '' : 'disabled'}>▶ Было</button>`
      + `<button class="btn" data-act="new">▶ Стало <small>${dec(d.dur)} с</small></button>`);
    if (v.dirty || !v.voiced) parts.push('<button class="btn primary" data-act="save" title="Записать ударения, текст и звук в книгу (S)">Сохранить</button>');
    if (v.dirty || d) parts.push('<button class="btn ghost" data-act="revert">Отменить</button>');
  }
  if (m.note && (v.dirty || d)) notes.push(`<span class="why">${esc(m.note)}</span>`);
  if (v.lost.length) notes.push(`Куски ударений больше не встречаются в тексте один раз и уйдут при сохранении: ${v.lost.map(p => `«${esc(p)}»`).join(', ')}`);
  if (m.error) notes.push(`<span class="err">${esc(m.error)}</span>`);
  return `<footer class="bf">${parts.join('')}${notes.map(n => `<p class="note">${n}</p>`).join('')}</footer>`;
}

function editHTML(m) {
  const rows = Math.min(14, Math.ceil(m.text.length / 90) + 1);
  return `<div class="edit">
    <textarea data-role="text" rows="${rows}" spellcheck="true" lang="ru">${esc(m.text)}</textarea>
    <div class="edit-bar">
      <span class="hint">Метки <code>[[…]]</code> — моменты анимации: оставьте их, их порядок не меняйте.${m.cur.dirty ? ' Несохранённые ударения шага сбросятся.' : ''}</span>
      <button class="btn primary" data-act="apply">Применить</button>
      <button class="btn ghost" data-act="cancel-edit">Отмена</button>
    </div>
  </div>`;
}

function paint(m) {
  const el = cardEl(m);
  if (el) {
    el.className = cardClass(m);
    el.innerHTML = cardInner(m);
    if (P.m === m) { P.k = -1; paintPlayState(); paintNow(); }
    if (m.editing) el.querySelector('textarea')?.focus();
  }
  updateCounts();
}

function setCurrent(m) {
  if (S.current === m) return;
  const old = S.current && cardEl(S.current);
  old?.classList.remove('current');
  S.current = m;
  if (m) cardEl(m)?.classList.add('current');
}

function scrollToCard(m, block = 'nearest') { cardEl(m)?.scrollIntoView({ block, behavior: 'smooth' }); }

// --- what the beat would be: stress, text, draft, saving ---------------------------------------------------------------

async function refresh(m, voice, k = null, listen = true) {   // the server works out the pieces; with voice, a draft too
  if (m.busy) return;
  if (listen && P.m === m && !P.audio.paused) P.audio.pause();
  m.busy = voice ? 'Озвучиваю…' : 'Проверяю…';
  m.error = '';
  paint(m);
  let ok = false;
  try {
    const v = await api(voice ? '/api/draft' : '/api/analyze',
      { ch: m.ch, beat: m.id, text: m.text, forms: m.derive ? null : m.forms });
    m.cur = v; m.text = v.text; m.forms = formsFrom(v.words); m.derive = false; m.note = v.dirty ? v.note || '' : '';
    if (voice) m.draft = v.draft.same ? null : v.draft;   // same: the clip in the book says it already
    else if (m.draft && m.draft.key !== v.key) m.draft = null;
    ok = true;
  } catch (e) {
    m.error = e.message;
    if (m.derive) m.editing = true;   // an edited text that cannot be taken goes back to its editor
  }
  m.busy = '';
  paint(m);
  soon(loadBook);   // the counts of the queue
  if (ok && voice && listen) {
    const clip = m.draft || m.saved.clip, times = clip?.times;
    const from = k != null && times && clip.clean === m.cur.clean ? Math.max(0, times[Math.max(0, k - 2)] - 0.15) : 0;
    play(m, m.draft ? 'draft' : 'clip', from);
  }
}

const plainOf = (m, k) => m.cur.clean.slice(m.cur.words[k].s, m.cur.words[k].e);
const sameWord = (a, b) => fold(a.toLowerCase()) === fold(b.toLowerCase());

function others(m, k) {   // the same word elsewhere in this list: [[beat, word index], ...]
  const word = plainOf(m, k), out = [];
  for (const o of S.list) o.cur.words.forEach((w, j) => {
    if ((o !== m || j !== k) && sameWord(o.cur.clean.slice(w.s, w.e), word)) out.push([o, j]);
  });
  return out;
}

function formLike(form, plain) {   // the chosen stress (and «ё») on another spelling of the word: «Равно» for «равно́»
  const [offs, word] = [[], []];
  for (const c of form) { if (c === ACC) offs.push(word.length - 1); else word.push(c); }
  if (word.length !== plain.length) return null;
  return [...plain].map((c, i) => (YO.includes(word[i]) && 'еЕ'.includes(c) ? (c === 'е' ? 'ё' : 'Ё') : c)
    + (offs.includes(i) ? ACC : '')).join('');
}

async function choose(m, k, form, everywhere = false) {
  closePop();
  if (form) m.forms[k] = form; else delete m.forms[k];
  const rest = [];
  if (everywhere) {   // each other beat gets the same choice; drafts are made one by one, nothing is saved
    const touched = new Set();
    for (const [o, j] of others(m, k)) {   // only where the voice says it otherwise now, or another stress is given
      if (o.busy) continue;
      const w = o.cur.words[j], now = w.acc ? formOf(w.acc, w.said) : '';
      if (!form) {
        if (o.forms[j]) { delete o.forms[j]; touched.add(o); }
        continue;
      }
      const f = formLike(form, plainOf(o, j));
      if (!f || o.forms[j] === f || (!o.forms[j] && now === f)) continue;
      o.forms[j] = f;
      touched.add(o);
    }
    touched.delete(m);
    rest.push(...touched);
    if (rest.length) toast(`То же ещё в ${plural(rest.length, ['шаге', 'шагах', 'шагах'])}: ${S.auto ? 'озвучиваю' : 'проверяю'} по очереди`);
  }
  await refresh(m, S.auto, k);
  for (const o of rest) await refresh(o, S.auto, null, false);
}

async function save(m) {
  if (m.busy) return;
  m.busy = 'Сохраняю…';
  m.error = '';
  paint(m);
  try {
    const v = await api('/api/save', { ch: m.ch, beat: m.id, text: m.text, forms: m.derive ? null : m.forms });
    if (P.m === m) { P.audio.pause(); P.audio.removeAttribute('src'); P.m = null; }
    reset(m, v);
    toast(`Сохранено: ${topicOf(m.ch).label} · ${m.id}`);
    loadBook();
  } catch (e) { m.error = e.message; }
  m.busy = '';
  paint(m);
}

async function saveAll() {   // the changed beats of this list
  for (const m of S.list.filter(pendingSave)) await save(m);
}

async function revert(m) {   // back to the book; the queue forgets the change
  if (m.busy) return;
  if (P.m === m && P.which === 'draft') P.audio.pause();
  try { reset(m, await api('/api/forget', { ch: m.ch, beat: m.id })); } catch (e) { m.error = e.message; }
  paint(m);
  soon(loadBook);
}

function applyEdit(m) {
  const ta = cardEl(m)?.querySelector('textarea');
  if (!ta) return;
  m.text = ta.value;
  m.derive = true;   // the saved pieces that still occur once in the new text
  m.editing = false;
  refresh(m, S.auto, null);
}

async function markHeard(m, on) {
  if (m.saved.heard === on) return;
  try {
    await api('/api/heard', { ch: m.ch, beat: m.id, heard: on });
    m.saved.heard = on;
    const t = S.book?.topics.find(x => x.ch === m.ch);
    if (t) t.heard += on ? 1 : -1;
    const box = cardEl(m)?.querySelector('[data-act=heard]');
    if (box) box.checked = on;
    updateCounts();
  } catch (e) { toast(e.message); }
}

// --- the stress picker -------------------------------------------------------------------------------------------------

const POP = { m: null, k: -1 };

function variants(word) {   // every vowel stressed in turn; an «е» could be a «ё»
  const stress = [], yo = [];
  for (let i = 0; i < word.length; i++) {
    if (!VOW.includes(word[i])) continue;
    stress.push(word.slice(0, i + 1) + ACC + word.slice(i + 1));
    if (word[i] === 'е' || word[i] === 'Е') yo.push(word.slice(0, i) + (word[i] === 'е' ? 'ё' : 'Ё') + ACC + word.slice(i + 1));
  }
  return { stress, yo };
}

function openPop(m, k, el) {
  if (m.busy) return;
  P.run = false;
  if (P.m && !P.audio.paused) P.audio.pause();
  const w = m.cur.words[k], plain = m.cur.clean.slice(w.s, w.e);
  const now = w.acc ? formOf(w.acc, w.said) : '', given = m.forms[k] || '';
  const { stress, yo } = variants(plain);
  const why = {
    homo: 'Silero выбрал ударение сам (омограф) — проверьте на слух',
    yo: 'Silero сам выбрал «е» или «ё»',
    given: 'Ударение задано куском в narration.ru.stress.json',
  }[w.why] || 'Ударение из словаря Silero';
  let n = 0;
  const btn = f => `<button class="var${f === now ? ' is-now' : ''}${f === given ? ' is-given' : ''}" data-form="${esc(f)}">`
    + `<span class="n">${++n <= 9 ? n : ''}</span><span class="f">${formHTML(f)}</span>`
    + `<small>${f === given ? 'задано' : f === now ? 'сейчас' : '&nbsp;'}</small></button>`;
  POP.m = m; POP.k = k;
  const more = others(m, k).length;
  pop.innerHTML = `<div class="pop-why">${why}. Выберите ударение:</div>
    <div class="pop-row">${stress.map(btn).join('')}</div>
    ${yo.length ? `<div class="pop-row yo">${yo.map(btn).join('')}</div>` : ''}
    ${more ? `<label class="pop-all" title="Там, где голос говорит это слово иначе; черновики, без сохранения">
      <input type="checkbox" id="popAll"${POP.all ? ' checked' : ''}> так же везде в этом списке
      <span>(ещё ${plural(more, ['слово', 'слова', 'слов'])} «${esc(plain.toLowerCase())}»)</span></label>` : ''}
    <div class="pop-foot">
      <button class="btn ghost" data-act="auto" ${given ? '' : 'disabled'} title="Убрать заданное ударение: пусть решает Silero (0)">Авто</button>
      <button class="btn ghost" data-act="from" title="Слушать с этого слова">▶ Отсюда</button>
      <button class="btn ghost" data-act="find" title="Все шаги книги с этим словом">Найти в книге</button>
    </div>`;
  pop.hidden = false;
  $$('.w.picked').forEach(x => x.classList.remove('picked'));
  el.classList.add('picked');
  placePop(el);
}

function placePop(el) {
  const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const vw = document.documentElement.clientWidth;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(x, vw - w - 8));
  let y = r.bottom + 8;
  if (y + h > window.innerHeight - 8 && r.top - h - 8 > 60) y = r.top - h - 8;
  pop.style.left = `${x + window.scrollX}px`;
  pop.style.top = `${y + window.scrollY}px`;
}

function closePop() {
  pop.hidden = true;
  POP.m = null;
  $$('.w.picked').forEach(x => x.classList.remove('picked'));
}

pop.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !POP.m) return;
  const { m, k } = POP, all = !!$('#popAll', pop)?.checked;
  if (b.dataset.form) return choose(m, k, b.dataset.form, all);
  if (b.dataset.act === 'auto') return choose(m, k, null, all);
  if (b.dataset.act === 'from') { closePop(); return playFromWord(m, k); }
  if (b.dataset.act === 'find') {
    const w = m.cur.words[k];
    closePop();
    location.hash = '#q=' + encodeURIComponent(m.cur.clean.slice(w.s, w.e).toLowerCase());
  }
});

pop.addEventListener('change', e => {   // remembered for the next word; the keys 1–9 work again after the click
  if (e.target.id === 'popAll') { POP.all = e.target.checked; e.target.blur(); }
});

document.addEventListener('mousedown', e => {
  if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.w')) closePop();
});
window.addEventListener('resize', closePop);

// --- playing -----------------------------------------------------------------------------------------------------------

function ready(a) {
  return new Promise((resolve, reject) => {
    if (a.readyState >= 1) return resolve();
    const done = ok => () => { a.removeEventListener('loadedmetadata', yes); a.removeEventListener('error', no); ok ? resolve() : reject(a.error); };
    const yes = done(true), no = done(false);
    a.addEventListener('loadedmetadata', yes);
    a.addEventListener('error', no);
  });
}

async function play(m, which = 'clip', from = 0) {
  const clip = which === 'draft' ? m.draft : m.saved.clip;
  if (!clip) return;
  setCurrent(m);
  const url = new URL(clip.audio, location.href).href, prev = P.m;
  Object.assign(P, { m, which, clip, k: -1, from });
  if (prev && prev !== m) paintPlayState();
  if (P.audio.src !== url) {
    P.audio.src = url;
    try { await ready(P.audio); } catch { toast('Запись не загрузилась'); return; }
    if (P.clip !== clip) return;   // another play started meanwhile
  }
  P.audio.currentTime = Math.max(0, Math.min(from, (P.audio.duration || clip.dur) - 0.05));
  P.audio.playbackRate = S.speed;
  try { await P.audio.play(); } catch (e) { if (e.name !== 'AbortError') toast(`Не играет: ${e.message}`); }
}

function togglePlay(m, which) {
  if (P.m === m && P.which === which && P.audio.src) {
    if (P.audio.paused) { P.audio.playbackRate = S.speed; P.audio.play(); } else P.audio.pause();
    return;
  }
  P.run = false;
  play(m, which, 0);
}

function playFromWord(m, k) {
  const clip = m.draft || m.saved.clip;
  if (!clip) return;
  const t = clip.times && clip.clean === m.cur.clean ? Math.max(0, clip.times[k] - 0.1) : 0;
  P.run = false;
  play(m, m.draft ? 'draft' : 'clip', t);
}

function tick() {
  cancelAnimationFrame(P.raf);
  const step = () => { paintNow(); if (!P.audio.paused) P.raf = requestAnimationFrame(step); };
  P.raf = requestAnimationFrame(step);
}

function paintNow() {   // the word being said and the clip's progress
  const m = P.m, el = m && cardEl(m);
  if (!el) return;
  const t = P.audio.currentTime, clip = P.clip, len = P.audio.duration || clip?.dur || 0;
  const fill = el.querySelector('.bar i');
  if (fill) fill.style.width = len ? `${Math.min(100, t / len * 100)}%` : '0';
  let k = -1;
  if (clip?.times && clip.clean === m.cur.clean && !m.editing && !P.audio.ended) {
    const T = clip.times, at = t + 0.04;
    let lo = 0, hi = T.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (T[mid] <= at) lo = mid + 1; else hi = mid; }
    k = lo - 1;
  }
  if (k !== P.k) {
    el.querySelector('.w.now')?.classList.remove('now');
    if (k >= 0) el.querySelector(`.w[data-k="${k}"]`)?.classList.add('now');
    P.k = k;
  }
}

function paintPlayState() {
  const playing = !!P.m && !P.audio.paused, el = P.m && cardEl(P.m);
  for (const c of $$('.beat.playing')) if (c !== el || !playing) c.classList.remove('playing');
  for (const b of $$('.beat .btn.on')) b.classList.remove('on');
  for (const b of $$('.beat .play')) b.textContent = '▶';
  if (el && playing) {
    el.classList.add('playing');
    if (P.which === 'clip') {
      el.querySelector('.play').textContent = '❚❚';
      el.querySelector('[data-act=old]')?.classList.add('on');
    } else el.querySelector('[data-act=new]')?.classList.add('on');
  }
  const run = $('#run');
  run.textContent = P.run && playing ? '❚❚ Пауза' : '▶ Подряд';
  run.classList.toggle('on', P.run && playing);
}

P.audio.addEventListener('play', () => { paintPlayState(); tick(); });
P.audio.addEventListener('pause', paintPlayState);
P.audio.addEventListener('ended', () => {
  const m = P.m;
  paintNow();
  if (m && P.which === 'clip' && P.from < 0.5) markHeard(m, true);
  paintPlayState();
  if (P.run && m) runNext(m);
});

function runNext(m) {
  const list = visible(), i = list.indexOf(m);
  if (i >= 0 && i + 1 < list.length) {
    scrollToCard(list[i + 1]);
    play(list[i + 1], 'clip', 0);
    return;
  }
  if (S.view.kind === 'topic') {
    const ts = S.book.topics, j = ts.findIndex(t => t.ch === S.view.ch);
    if (j >= 0 && j + 1 < ts.length) { P.next = true; location.hash = '#' + ts[j + 1].ch; return; }
  }
  P.run = false;
  paintPlayState();
  toast('Дальше записей нет');
}

function toggleRun() {
  if (P.run && !P.audio.paused) { P.run = false; P.audio.pause(); return; }
  const list = visible();
  const m = list.includes(S.current) ? S.current : list[0];
  if (!m) return;
  P.run = true;
  if (P.m === m && P.which === 'clip' && P.audio.src && P.audio.paused && !P.audio.ended && P.audio.currentTime > 0) {
    P.audio.playbackRate = S.speed;
    P.audio.play();
  } else play(m, 'clip', 0);
}

function step(d) {
  const list = visible();
  if (!list.length) return;
  let i = list.indexOf(S.current);
  i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + d));
  const playing = !!P.m && !P.audio.paused;
  setCurrent(list[i]);
  scrollToCard(list[i]);
  if (playing) play(list[i], 'clip', 0);
}

// --- views -------------------------------------------------------------------------------------------------------------

function visible() {
  const pred = (FILTERS.find(f => f[0] === S.filter) || FILTERS[0])[2];
  return S.list.filter(pred);
}

function filtersHTML() {
  return `<div class="filters">${FILTERS.map(([id, label]) =>
    `<button class="chip${S.filter === id ? ' on' : ''}" data-filter="${id}">${label}<span data-count="${id}"></span></button>`).join('')}</div>`;
}

const LEGEND = `<p class="legend">
  <span class="w">ч<b class="v">и́</b>сла</span> — ударная гласная, как её скажет Silero ·
  <span class="w why-homo">слово</span> — Silero выбирал сам, проверьте на слух ·
  <span class="w why-given">слово</span> — ударение задано · нажмите на слово, чтобы выбрать ударение<br>
  <kbd>Пробел</kbd> пауза · <kbd>↑</kbd><kbd>↓</kbd> шаг · <kbd>←</kbd><kbd>→</kbd> 3 секунды · <kbd>R</kbd> сначала ·
  <kbd>1</kbd>–<kbd>9</kbd> вариант ударения · <kbd>S</kbd> сохранить</p>`;

function renderMain() {
  let head, body;
  if (S.view.kind === 'topic') {
    const t = S.info, dur = S.list.reduce((a, m) => a + (m.saved.clip?.dur || 0), 0);
    head = `<div class="crumb"><i class="dot" style="--c:${esc(t.color || '#999')}"></i>Глава ${t.unit}. ${esc(t.unit_title || '')}</div>
      <h1><span class="lbl">${esc(t.label || t.ch)}</span> ${esc(t.title || '')}</h1>
      <div class="meta">${plural(S.list.length, ['шаг', 'шага', 'шагов'])} · ${duration(dur)} · голос ${esc(t.voice)}, темп ${esc(t.rate)} ·
        <a href="/uroki/${t.ch}/" target="_blank" rel="noopener">открыть урок ↗</a></div>`;
    body = S.list.map(cardHTML).join('');
  } else {
    head = S.view.kind === 'queue'
      ? `<h1>К проверке</h1>
        <div class="meta">${S.list.length ? `${plural(S.list.length, ['шаг', 'шага', 'шагов'])} с несохранёнными правками или предложениями.
          Послушайте «▶ Стало» и сохраните или отмените каждую.` : 'Несохранённых правок нет.'}</div>`
      : `<h1>Поиск: «${esc(S.view.q)}»</h1>
        <div class="meta">${plural(S.list.length, ['шаг', 'шага', 'шагов'])}${S.view.more ? ' (показаны первые)' : ''} во всей книге</div>`;
    let last = '';
    body = S.list.map(m => {
      let h = '';
      if (m.ch !== last) {
        const t = topicOf(m.ch);
        h = `<h2 class="group"><i class="dot" style="--c:${esc(t.color)}"></i><a href="#${m.ch}">${esc(t.label)} ${esc(t.title)}</a></h2>`;
        last = m.ch;
      }
      return h + cardHTML(m);
    }).join('');
  }
  main.innerHTML = `<section class="head">${head}${filtersHTML()}${LEGEND}</section>
    <div class="beats">${body}</div><p class="empty" hidden>Под этот фильтр шагов нет.</p>`;
  applyFilter();
}

function applyFilter() {
  const pred = (FILTERS.find(f => f[0] === S.filter) || FILTERS[0])[2];
  for (const m of S.list) { const el = cardEl(m); if (el) el.hidden = !pred(m); }
  for (const h of $$('h2.group', main)) {
    let n = h.nextElementSibling, any = false;
    while (n && !n.matches('h2.group')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
    h.hidden = !any;
  }
  for (const c of $$('[data-filter]', main)) c.classList.toggle('on', c.dataset.filter === S.filter);
  const empty = $('.empty', main);
  if (empty) empty.hidden = S.list.some(pred);
  updateCounts();
}

function updateCounts() {
  for (const [id, , pred] of FILTERS) {
    const el = $(`[data-count="${id}"]`, main);
    if (el) el.textContent = S.list.filter(pred).length;
  }
  const n = S.list.filter(pendingSave).length, b = $('#saveAll');
  b.hidden = n < 2;
  b.textContent = `Сохранить все ${n}`;
  b.title = 'Сохранить все изменённые шаги этого списка';
  const q = S.book ? S.book.topics.reduce((a, t) => a + (t.pending || 0), 0) : 0, qb = $('#queueBtn');
  qb.hidden = q === 0 && S.view?.kind !== 'queue';
  qb.textContent = `К проверке${q ? ` · ${q}` : ''}`;
  qb.classList.toggle('on', S.view?.kind === 'queue');
  renderSide();
}

function renderSide() {
  if (!S.book) return;
  const units = [], pend = {};
  for (const t of S.book.topics) pend[t.ch] = t.pending || 0;   // the server's queue, which every change reaches
  for (const t of S.book.topics) {
    let u = units.find(x => x.unit === t.unit);
    if (!u) units.push(u = { unit: t.unit, title: t.unit_title, color: t.color, topics: [] });
    u.topics.push(t);
  }
  const all = S.book.topics, heard = all.reduce((a, t) => a + t.heard, 0), beats = all.reduce((a, t) => a + t.beats, 0);
  const dur = all.reduce((a, t) => a + t.dur, 0), on = S.view?.kind === 'topic' ? S.view.ch : '';
  const scroll = side.scrollTop;
  side.innerHTML = `<div class="sum">Прослушано <b>${heard}</b> из ${beats} шагов · ${duration(dur)}</div>` + units.map(u => `
    <section class="unit">
      <h2><i class="dot" style="--c:${esc(u.color)}"></i>${u.unit}. ${esc(u.title)}</h2>
      ${u.topics.map(t => `<a class="topic${t.ch === on ? ' on' : ''}" href="#${t.ch}" title="${esc(t.title)}">
        <span class="lbl">${esc(t.label)}</span><span class="tt">${esc(t.title)}</span>
        <span class="cnt">${pend[t.ch] ? `<b class="c-pend" title="Несохранённых правок и предложений">● ${pend[t.ch]}</b>` : ''}${t.stale || t.lost
          ? `<b class="c-stale" title="${t.stale ? `Записей, не совпадающих с текстом: ${t.stale}` : ''}${t.lost ? ` Неверных кусков ударений: ${t.lost}` : ''}">!</b>` : ''}${t.flagged
          ? `<b class="c-flag" title="Слов, где Silero выбирал ударение сам">${t.flagged}</b>` : ''}<b class="c-heard${t.heard === t.beats ? ' done' : ''}" title="Прослушано шагов">${t.heard}/${t.beats}</b></span>
      </a>`).join('')}
    </section>`).join('');
  side.scrollTop = scroll;
}

async function loadBook() {
  try { S.book = await api('/api/book'); } catch (e) { $('#status').textContent = e.message; return false; }
  const n = S.book.topics.length, k = S.book.scanned;
  $('#status').textContent = k < n ? `Silero читает книгу: ${k} из ${n} тем` : '';
  clearTimeout(S.poll);
  if (k < n) S.poll = setTimeout(loadBook, 2500);
  renderSide();
  return true;
}

async function openTopic(ch, beat) {
  const token = ++S.token;
  closePop();
  if (S.view?.kind !== 'topic' || S.view.ch !== ch) main.innerHTML = '<p class="loading"><i class="spin"></i> Загружаю тему…</p>';
  let data;
  try { data = await api('/api/topic?ch=' + encodeURIComponent(ch)); } catch (e) {
    main.innerHTML = `<p class="err">${esc(e.message)}</p>`;
    return;
  }
  if (token !== S.token) return;
  S.view = { kind: 'topic', ch };
  S.info = data;
  $('#voice').textContent = `Silero · ${data.voice}`;
  S.list = data.beats.map(model);
  S.current = null;
  renderMain();
  const target = beat && S.list.find(m => m.id === beat);
  setCurrent(target || visible()[0] || S.list[0]);
  if (target) scrollToCard(target, 'center'); else window.scrollTo(0, 0);
}

async function openSearch(q) {
  const token = ++S.token;
  closePop();
  main.innerHTML = '<p class="loading"><i class="spin"></i> Ищу…</p>';
  let data;
  try { data = await api('/api/search?q=' + encodeURIComponent(q)); } catch (e) {
    main.innerHTML = `<p class="err">${esc(e.message)}</p>`;
    return;
  }
  if (token !== S.token) return;
  S.view = { kind: 'search', q, more: data.more };
  S.list = data.beats.map(model);
  S.current = null;
  renderMain();
  renderSide();
  setCurrent(visible()[0] || S.list[0]);
  window.scrollTo(0, 0);
}

async function openQueue() {
  const token = ++S.token;
  closePop();
  main.innerHTML = '<p class="loading"><i class="spin"></i> Собираю очередь…</p>';
  let data;
  try { data = await api('/api/queue'); } catch (e) {
    main.innerHTML = `<p class="err">${esc(e.message)}</p>`;
    return;
  }
  if (token !== S.token) return;
  S.view = { kind: 'queue' };
  S.list = data.beats.map(model);
  S.current = null;
  renderMain();
  setCurrent(visible()[0] || S.list[0]);
  window.scrollTo(0, 0);
}

async function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'queue') await openQueue();
  else if (h.startsWith('q=')) {
    $('#q').value = h.slice(2);
    await openSearch(h.slice(2));
  } else {
    const [ch, beat] = h.split('/');
    await openTopic(/^ch\d\d$/.test(ch) ? ch : S.book.topics[0].ch, beat);
  }
  if (P.next) {   // «Подряд» went on into this topic
    P.next = false;
    const first = visible()[0];
    if (first && P.run) play(first, 'clip', 0);
  }
}

// --- events ------------------------------------------------------------------------------------------------------------

main.addEventListener('click', e => {
  const chip = e.target.closest('[data-filter]');
  if (chip) { S.filter = chip.dataset.filter; store.set('filter', S.filter); applyFilter(); return; }
  const card = e.target.closest('.beat'), m = card && MODELS.get(card.dataset.uid);
  if (!m) return;
  const actEl = e.target.closest('[data-act]'), act = actEl?.dataset.act;
  if (act === 'heard' || e.target.closest('.heard')) return;   // the checkbox speaks through «change»
  setCurrent(m);
  const w = e.target.closest('.w');
  if (w && !act) return openPop(m, +w.dataset.k, w);
  switch (act) {
    case 'play': case 'old': return togglePlay(m, 'clip');
    case 'new': return togglePlay(m, 'draft');
    case 'voice': return refresh(m, true, null);
    case 'save': return save(m);
    case 'revert': return revert(m);
    case 'edit':
      if (!m.editing) { m.editing = true; return paint(m); }
    // falls through: closing the editor is a cancel
    case 'cancel-edit':   // back to the last text the server took
      Object.assign(m, { editing: false, text: m.cur.text, derive: false, error: '' });
      return paint(m);
    case 'apply': return applyEdit(m);
    case 'seek': {
      const which = P.m === m ? P.which : 'clip', clip = which === 'draft' ? m.draft : m.saved.clip;
      if (!clip) return;
      const r = actEl.getBoundingClientRect();
      P.run = false;
      return play(m, which, (e.clientX - r.left) / r.width * clip.dur);
    }
  }
});

main.addEventListener('change', e => {
  if (e.target.dataset.act !== 'heard') return;
  const m = MODELS.get(e.target.closest('.beat').dataset.uid);
  if (m) markHeard(m, e.target.checked);
  e.target.blur();
});

main.addEventListener('keydown', e => {   // Ctrl+Enter applies an edited text
  if (e.target.matches('textarea') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    const m = MODELS.get(e.target.closest('.beat').dataset.uid);
    if (m) { e.preventDefault(); applyEdit(m); }
  }
});

document.addEventListener('click', e => {   // a clicked button gives the keyboard back to the page
  const b = e.target.closest('button');
  if (b) setTimeout(() => b.blur(), 0);
});

document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!pop.hidden) {
    if (e.code === 'Escape') { e.preventDefault(); return closePop(); }
    const d = /^Digit([1-9])$/.exec(e.code);
    if (d) { const b = $$('[data-form]', pop)[+d[1] - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if (e.code === 'Digit0') { e.preventDefault(); $('[data-act=auto]', pop)?.click(); return; }
  }
  const m = S.current;
  switch (e.code) {
    case 'Space': e.preventDefault(); if (m) togglePlay(m, P.m === m ? P.which : 'clip'); break;
    case 'ArrowDown': case 'KeyJ': e.preventDefault(); step(1); break;
    case 'ArrowUp': case 'KeyK': e.preventDefault(); step(-1); break;
    case 'ArrowLeft': case 'ArrowRight':
      if (P.m && P.audio.src) {
        e.preventDefault();
        P.audio.currentTime = Math.max(0, Math.min((P.audio.duration || 0) - 0.05, P.audio.currentTime + (e.code === 'ArrowLeft' ? -3 : 3)));
        paintNow();
      }
      break;
    case 'KeyR': if (m) { e.preventDefault(); P.run = false; play(m, P.m === m ? P.which : 'clip', 0); } break;
    case 'KeyS': if (m && (m.cur.dirty || !m.cur.voiced)) { e.preventDefault(); save(m); } break;
    case 'Escape': closePop(); break;
  }
});

$('#find').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (q) location.hash = '#q=' + encodeURIComponent(q);
});
$('#auto').checked = S.auto;
$('#auto').addEventListener('change', e => { S.auto = e.target.checked; store.set('auto', S.auto); e.target.blur(); });
$('#speed').value = String(S.speed);
$('#speed').addEventListener('change', e => {
  S.speed = +e.target.value;
  store.set('speed', S.speed);
  P.audio.playbackRate = S.speed;
  e.target.blur();
});
$('#run').addEventListener('click', toggleRun);
$('#saveAll').addEventListener('click', saveAll);
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', e => {   // changes are kept by the server; only work in flight would be lost
  if ([...MODELS.values()].some(m => m.busy || m.editing)) { e.preventDefault(); e.returnValue = ''; }
});

window.name = 'golos';   // a lesson's «🎙 Озвучка» button opens its beat in this tab (uroki/lib/kletka.js)
(async () => { if (await loadBook()) await route(); })();
