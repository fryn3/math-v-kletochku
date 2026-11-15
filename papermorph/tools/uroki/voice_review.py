"""A page for listening to the lessons' narration, fixing stress and voicing beats again, saved into the book.

Usage, from the repository root:
    papermorph/golos                 start it and open http://localhost:8767/ in the browser (or show it, if it runs)
    papermorph/golos ch41            the same, at topic ch41 (a new lesson, say)
    papermorph/golos 8780 --no-open  another port; no browser (the app's preview opens it itself)
papermorph/golos is python3 papermorph/tools/uroki/voice_review.py; without torch, vosk and numpy at hand it runs
itself again under uv with them (as silero_tts.py is run).

Every beat of the book is listed by topic with its text as Silero says it: the stressed vowel of each word marked
(Silero's own accentor, run with the stress pieces applied), the words where Silero chose between two stresses or
between «е» and «ё» itself picked out, the words a piece of narration.ru.stress.json sets underlined. A click on a word
offers its stresses; the beat is then voiced into a draft (papermorph/books/uroki/review/golos/, out of git) to be
compared with the clip in the book, and «Сохранить» writes what was heard into the book as silero_tts.py would:
  - the pieces into chNN/narration.ru.stress.json: the pieces that still agree are kept as they are, a new stress gets
    the shortest piece around its word that occurs once in the beat (the rules of silero_tts.py);
  - the text into chNN/narration.ru.json, when it was edited (its [[marks]] must stay the same, in the same order);
  - the clip into uroki/chNN/audio/ru/, its word times into narration.ru.timings.json and timings.js, under the same
    key silero_tts.py computes, so silero_tts.py later finds the beat up to date.
A change not saved yet is kept in review/golos/pending.json, with a note when one was given (POST /api/draft with
"note": a proposal for the author's ear): the page lists them all under «К проверке», across reloads.
The lesson opens at the beat from the page (/uroki/chNN/?beat=N); the book is served here too, without caching, and a
lesson served from here shows a «🎙 Озвучка» button (uroki/lib/kletka.js) back to its beat on this page.
Which beats were heard to the end is kept in review/golos/heard.json.

The server listens on this computer only and takes writes only from its own page (Host, Origin, JSON body).
"""
import functools
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import traceback
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True   # no __pycache__ beside the tools
import silero_tts as st  # noqa: E402  silero(), silero_text(), synth(), word_times(); puts the skill's scripts on sys.path
import serve  # noqa: E402  the skill's preview server: no-store, byte ranges, a long queue

tts = st.tts
ROOT = HERE.parents[2]
CONTENT = ROOT / "papermorph/content/uroki"
BOOK = ROOT / "uroki"
DRAFTS = ROOT / "papermorph/books/uroki/review/golos"   # drafts, heard.json, pending.json: review/ is out of git
PAGE = HERE / "voice_review"
HEARD = DRAFTS / "heard.json"
PENDING = DRAFTS / "pending.json"   # changes not saved yet, beat by beat: the page's queue «К проверке»
QUEUE = threading.Lock()
ACC, VOWELS, fold = st.ACC, st.VOWELS, st.fold
CH = re.compile(r"ch\d\d")
TOKEN = re.compile(r"\S+")
MODEL = threading.Lock()   # one Silero and one Vosk in this process: one job at a time
FILES = threading.Lock()   # one writer of the book's files at a time
READINGS = {}              # Silero's text -> the accentor's readings: all, homographs left alone, «ё» in them left alone
FLAGS = {}                 # chNN -> {beat: words where Silero chose the stress or «е»/«ё» itself}
SEARCH_LIMIT = 300
PORT = 8767


class Problem(Exception):
    """A request that cannot be done as asked; its message goes back to the page."""


def read_json(path, default):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else default


def write_atomic(path, text):
    """Replace path with text only once it is all written; an existing file keeps its permissions."""
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}-", delete=False) as f:
        f.write(text)
        tmp = Path(f.name)
    try:
        os.chmod(tmp, mode)
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)


def course():
    """{chNN: unit, its title and colour, the topic's label and title} from the book's course (uroki/course.js); a lesson
    not listed there yet (a new one) takes its label and title from its page's CHAPTER."""
    src, out, units = BOOK / "course.js", {}, {}
    body = src.read_text(encoding="utf-8") if src.is_file() else ""
    for m in re.finditer(r"\[(\d+), '([^']+)', '([^']+)', (\d+), \[(.*?)\]\]", body, re.S):
        unit, title, color, first = int(m[1]), m[2], m[3], int(m[4])
        units[unit] = (title, color)
        for i, t in enumerate(re.finditer(r"\['([^']+)', (\d+)", m[5])):
            out[f"ch{first + i:02d}"] = {"unit": unit, "unit_title": title, "color": color,
                                         "label": f"{unit}.{i + 1}", "title": t[1], "minutes": int(t[2])}
    for ch in topics():
        if ch in out:
            continue
        page = BOOK / ch / "index.html"
        m = re.search(r"const CHAPTER = \{[^}]*?label: '([^']+)'[^}]*?title: '([^']+)'",
                      page.read_text(encoding="utf-8")) if page.is_file() else None
        label, title = (m[1], m[2]) if m else (ch, ch)
        unit = int(label.split(".")[0]) if re.fullmatch(r"\d+\.\d+", label) else 0
        name, color = units.get(unit, ("Новые темы", "#999999"))
        out[ch] = {"unit": unit, "unit_title": name, "color": color, "label": label, "title": title, "minutes": 0}
    return out


def topics():
    return sorted(p.name for p in CONTENT.iterdir() if CH.fullmatch(p.name) and (p / "narration.ru.json").is_file())


def lesson_order(ch, beats):
    """{beat: its place among the lesson page's steps}, the N of /uroki/chNN/?beat=N (narration order if unsure)."""
    page, ids = BOOK / ch / "index.html", []
    if page.is_file():
        for m in re.finditer(r"\[\s*'(\w+)'\s*,\s*['\"`]", page.read_text(encoding="utf-8")):
            if m[1] in beats and m[1] not in ids:
                ids.append(m[1])
    if sorted(ids) != sorted(beats):
        ids = beats
    return {b: i for i, b in enumerate(ids)}


class Topic:
    """One lesson's narration, stress pieces and voice cache, as they are on disk now."""

    def __init__(self, ch):
        if not isinstance(ch, str) or not CH.fullmatch(ch) or not (CONTENT / ch / "narration.ru.json").is_file():
            raise Problem(f"нет темы {ch!r}")
        self.ch = ch
        self.src = CONTENT / ch / "narration.ru.json"
        self.stress_path = self.src.with_suffix(".stress.json")
        self.cache_path = self.src.with_suffix(".timings.json")
        self.out = BOOK / ch / "audio" / "ru"
        self.spec_text = self.src.read_text(encoding="utf-8-sig")
        self.spec = json.loads(self.spec_text)
        if self.spec.get("engine") != "silero" or self.spec.get("voices"):
            raise Problem(f"{ch}: не озвучка одним голосом Silero")
        self.voice, self.rate = self.spec["voice"], self.spec.get("rate", "100%")
        self.stress = read_json(self.stress_path, {})
        self.cache = read_json(self.cache_path, {})
        self.order = lesson_order(ch, list(self.spec["beats"]))

    def raw(self, beat):
        if not isinstance(beat, str) or beat not in self.spec["beats"]:
            raise Problem(f"{self.ch}: нет шага {beat!r}")
        raw = self.spec["beats"][beat]
        return raw["text"] if isinstance(raw, dict) else raw

    def key(self, stext):
        """The clip's key, as silero_tts.py computes it: the same key means the same clip."""
        return st.sha1(f"silero|{st.MODEL}|{self.voice}|{self.rate}|{st.LEAD}|{st.TAIL}|{st.LUFS}|{stext}")


# --- stress: pieces of text with U+0301, and the words they set ------------------------------------------------------

def word_spans(clean):
    return [m.span() for m in st.WORD.finditer(clean)]   # the words silero_tts.py times, in the same order


def form_of(offs, word):
    """(stressed offsets, word) -> the word with U+0301 after each stressed vowel."""
    return "".join(c + (ACC if i in offs else "") for i, c in enumerate(word))


def parse_form(form):
    if not isinstance(form, str) or not form or form[0] == ACC:
        raise Problem(f"неверная форма слова {form!r}")
    offs, chars = [], []
    for c in form:
        if c == ACC:
            offs.append(len(chars) - 1)
        else:
            chars.append(c)
    return tuple(sorted(set(offs))), "".join(chars)


def piece_effect(clean, piece):
    """{word index: (stressed offsets, the word as the piece writes it)} for the words a piece sets; None when the piece
    would stop silero_tts.py: it does not occur exactly once in the beat («е» and «ё» alike), or has no mark, or puts
    a mark after a consonant."""
    if not isinstance(piece, str) or ACC not in piece:
        return None
    bare = piece.replace(ACC, "")
    found = [m.start() for m in re.finditer(re.escape(fold(bare)), fold(clean))] if bare else []
    if len(found) != 1:
        return None
    pos, stressed, chars, prev = found[0], set(), {}, None
    for c in piece:
        if c == ACC:
            if prev not in VOWELS:
                return None
            stressed.add(pos - 1)
        else:
            if c != clean[pos]:
                chars[pos] = c
            pos, prev = pos + 1, c
    effect = {}
    for k, (s, e) in enumerate(word_spans(clean)):
        offs = tuple(sorted(p - s for p in stressed if s <= p < e))
        if offs or any(s <= p < e for p in chars):
            effect[k] = (offs, "".join(chars.get(p, clean[p]) for p in range(s, e)))
    return effect


def shortest_piece(clean, spans, k, offs, word, target):
    """The piece giving word k its form: the word alone if it occurs once in the beat, else with its punctuation, then
    with neighbouring words, right first, until it does. target: the beat's text with the «ё» the forms write."""
    s, e = spans[k]
    folded = fold(clean)
    once = lambda a, b: len(re.findall(re.escape(folded[a:b]), folded)) == 1
    toks = [m.span() for m in TOKEN.finditer(clean)]
    i = next(j for j, (a, b) in enumerate(toks) if a <= s < b)
    a, b = s, e
    L = R = i
    if not once(a, b):
        a, b = min(a, toks[i][0]), max(b, toks[i][1])
        turn = 0
        while not once(a, b):
            if (turn % 2 == 0 and R < len(toks) - 1) or L == 0:
                R += 1
            else:
                L -= 1
            a, b, turn = toks[L][0], toks[R][1], turn + 1
    return target[a:s] + form_of(offs, word) + target[e:b]


def build_pieces(clean, forms, base):
    """Pieces that give the words of forms ({word index: form}) their stress: the pieces of base that agree with forms
    stay as they are, every other word gets a piece of its own."""
    if not isinstance(forms, dict):
        raise Problem("forms — словарь {номер слова: форма}")
    spans, want = word_spans(clean), {}
    for k, form in forms.items():
        k = int(k)
        if not 0 <= k < len(spans):
            raise Problem(f"нет слова номер {k}")
        offs, word = parse_form(form)
        s, e = spans[k]
        if len(word) != e - s or fold(word) != fold(clean[s:e]):
            raise Problem(f"«{word}» — не слово «{clean[s:e]}» этого шага")
        if any(word[o] not in VOWELS for o in offs):
            raise Problem(f"в «{form}» знак ударения стоит не после гласной")
        if not offs:
            if word == clean[s:e]:
                continue   # nothing to give
            offs = tuple(i for i, c in enumerate(word) if c in "ёЁ")[:1]   # a piece needs a mark: «ё» is stressed
        want[k] = (offs, word)
    pieces, done = [], set()
    for piece in base:
        effect = piece_effect(clean, piece)
        if effect and all(want.get(k) == v for k, v in effect.items()):
            pieces.append(piece)
            done |= effect.keys()
    target = list(clean)
    for k, (_, word) in want.items():
        target[spans[k][0]:spans[k][1]] = word
    target = "".join(target)
    for k in sorted(want.keys() - done):
        pieces.append(shortest_piece(clean, spans, k, *want[k], target))
    st.silero_text(clean, pieces, "")   # stops (SystemExit) on anything silero_tts.py would not take
    return pieces


def readings(stext):
    if stext not in READINGS:
        with MODEL:
            acc = st.accentor()   # as the voice reads: restored from its quantized weights first
            READINGS[stext] = acc(stext), acc(stext, put_stress_homo=False), acc(stext, put_yo_homo=False)
    return READINGS[stext]


def unplus(out):
    """The accentor's text without its «+», and the positions of the vowels that had one."""
    plus, chars = set(), []
    for c in out:
        if c == "+":
            plus.add(len(chars))
        else:
            chars.append(c)
    return "".join(chars), plus


def analyze(clean, pieces):
    """Silero's text for the pieces, and each word of clean: where it is, its stress as Silero says it, and why."""
    given = {}
    for p in pieces:
        for k, (offs, word) in piece_effect(clean, p).items():
            had = given.get(k, ((), word))[0]
            given[k] = (tuple(sorted(set(had) | set(offs))), word)
    stext = st.silero_text(clean, pieces, "")
    (t_on, p_on), (t_homo, p_homo), (t_yo, _) = (unplus(r) for r in readings(stext))
    aligned = all(len(t) == len(clean) and fold(t) == fold(clean) for t in (t_on, t_homo, t_yo))
    words = []
    for k, (s, e) in enumerate(word_spans(clean)):
        item = {"s": s, "e": e}
        if k in given:
            item["given"] = form_of(*given[k])
        if aligned:
            inside = lambda ps: any(s <= p < e for p in ps)
            item["said"], item["acc"] = t_on[s:e], sorted(p - s for p in p_on if s <= p < e)
            if k in given:
                item["why"] = "given"
            elif inside(p_on) and not inside(p_homo):
                item["why"] = "homo"   # a homograph: Silero chose the stress itself
            elif t_on[s:e] != t_yo[s:e]:
                item["why"] = "yo"     # Silero chose «е» or «ё» itself
        words.append(item)
    return stext, words


# --- beats -----------------------------------------------------------------------------------------------------------

def times_of(words, clean):
    """The clip's word starts, if its words are this text's words."""
    spans = word_spans(clean)
    if not words or len(words) != len(spans) or any(w != clean[s:e] for (_, w), (s, e) in zip(words, spans)):
        return None
    return [t for t, _ in words]


def state(topic, beat, text, forms):
    """The beat's text, its marks and pieces as the page asks for them (None: as saved), and the saved pieces that no
    longer occur once in the text."""
    saved_raw = topic.raw(beat)
    raw = saved_raw if text is None else text
    if not isinstance(raw, str) or not raw.strip():
        raise Problem("пустой текст шага")
    clean, marks = tts.split_marks(raw)
    if list(marks) != list(tts.split_marks(saved_raw)[1]):
        old = " ".join(f"[[{m}]]" for m in tts.split_marks(saved_raw)[1]) or "нет"
        raise Problem(f"метки должны остаться те же и в том же порядке: {old}")
    saved = topic.stress.get(beat, [])
    base = [p for p in saved if piece_effect(clean, p)]
    lost = [p for p in saved if p not in base]
    pieces = base if forms is None else build_pieces(clean, forms, base)
    return raw, clean, marks, pieces, lost


def view(topic, beat, text=None, forms=None, heard=None):
    """A beat as the page shows it: its words with Silero's stress, its pieces, the clip in the book. With text or
    forms: the beat as it would be with them, against what is saved (dirty) and what the clip says (voiced)."""
    raw, clean, _, pieces, lost = state(topic, beat, text, forms)
    stext, words = analyze(clean, pieces)
    key = topic.key(stext)
    entry, mp3 = topic.cache.get(beat, {}), topic.out / f"{beat}.mp3"
    have = mp3.is_file() and "key" in entry
    saved_clean = tts.split_marks(topic.raw(beat))[0]
    heard = read_json(HEARD, {}) if heard is None else heard
    return {
        "ch": topic.ch, "id": beat, "index": topic.order.get(beat, 0),
        "text": raw, "clean": clean, "words": words, "pieces": pieces, "lost": lost, "key": key,
        "dirty": raw != topic.raw(beat) or pieces != topic.stress.get(beat, []),
        "voiced": have and entry["key"] == key,   # the clip in the book says exactly this
        "clip": {"audio": f"/uroki/{topic.ch}/audio/ru/{beat}.mp3?v={entry['key'][:10]}", "dur": entry.get("dur"),
                 "clean": saved_clean, "times": times_of(entry.get("words"), saved_clean), "key": entry["key"]}
        if have else None,
        "heard": bool(heard.get(topic.ch, {}).get(beat)),
    }


def flagged(words):
    return sum(w.get("why") in ("homo", "yo") for w in words)


def voice_clip(topic, clean, stext, key, mp3):
    """Silero's take of stext into mp3 (written whole or not at all) and its word times, as silero_tts.py makes them."""
    mp3.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=mp3.parent, prefix=f".{mp3.stem}-", suffix=".mp3", delete=False) as f:
        tmp = Path(f.name)
    try:
        with MODEL:
            pcm16 = st.synth(stext, topic.voice, topic.rate, tmp)
            dur = tts.duration(tmp)
            words, missed = st.word_times(clean, pcm16, dur)
        tmp.replace(mp3)
    finally:
        tmp.unlink(missing_ok=True)
    return {"key": key, "dur": dur, "words": words, "missed": missed}


def drafted(ch, beat, key):
    """The draft of this beat with this key: (mp3, its word times), or (mp3, None) when there is none."""
    mp3 = DRAFTS / ch / f"{beat}.{key[:12]}.mp3"
    meta = read_json(mp3.with_suffix(".json"), {}) if mp3.is_file() else {}
    return mp3, (meta if meta.get("key") == key else None)


def draft_info(ch, beat, clean, key, meta):
    return {"audio": f"/drafts/{ch}/{beat}.{key[:12]}.mp3", "dur": meta["dur"], "clean": clean, "key": key,
            "times": [t for t, _ in meta["words"]], "missed": meta.get("missed", 0)}


def draft(topic, beat, text, forms):
    """The beat voiced as the page asks, into a draft beside the book (the clip in the book, if it says this already)."""
    v = view(topic, beat, text, forms)
    if v["voiced"]:
        v["draft"] = dict(v["clip"], key=v["key"], same=True)
        return v
    raw, clean, marks, pieces, _ = state(topic, beat, text, forms)
    stext = st.silero_text(clean, pieces, f"{topic.ch} {beat}")
    mp3, meta = drafted(topic.ch, beat, v["key"])
    if meta is None:
        for old in (DRAFTS / topic.ch).glob(f"{beat}.*"):   # one draft per beat (beat ids have no dots)
            old.unlink(missing_ok=True)
        meta = voice_clip(topic, clean, stext, v["key"], mp3)
        write_atomic(mp3.with_suffix(".json"), json.dumps(meta, ensure_ascii=False))
    tts.mark_times(clean, marks, meta["words"])   # a mark no word follows stops here rather than at saving
    v["draft"] = draft_info(topic.ch, beat, clean, v["key"], meta)
    return v


# --- the queue: changes listened to (or proposed) but not saved yet, kept across reloads ---------------------------------

def keep(ch, beat, v=None, note=None):
    """Keep the beat's unsaved change (v: the beat as changed) in the queue; drop it when v is None or as saved."""
    with QUEUE:
        queue = read_json(PENDING, {})
        had = queue.get(ch, {}).get(beat)
        if v is not None and v["dirty"]:
            entry = {"text": v["text"], "forms": {str(k): w["given"] for k, w in enumerate(v["words"]) if "given" in w}}
            note = note or (had or {}).get("note")
            if note:
                entry["note"] = note
            if entry == had:
                return
            queue.setdefault(ch, {})[beat] = entry
        elif had is not None:
            del queue[ch][beat]
            if not queue[ch]:
                del queue[ch]
        else:
            return
        write_atomic(PENDING, json.dumps(queue, ensure_ascii=False, indent=1) + "\n")


def note_of(ch, beat):
    return (read_json(PENDING, {}).get(ch, {}).get(beat) or {}).get("note", "")


def changed(body, voice):
    """The beat as the page changed it (voiced into a draft with voice), kept in the queue while it differs from the book."""
    topic, beat = Topic(body.get("ch")), body.get("beat")
    v = (draft if voice else view)(topic, beat, body.get("text"), body.get("forms"))
    note = body.get("note")
    keep(topic.ch, beat, v, note if isinstance(note, str) and note.strip() else None)
    v["note"] = note_of(topic.ch, beat)
    return v


def with_pending(topic, beat, heard, queue):
    """The saved beat, and the unsaved change the queue keeps for it, with its draft when it was voiced."""
    v = view(topic, beat, heard=heard)
    entry = queue.get(topic.ch, {}).get(beat)
    if not entry:
        return v
    try:
        p = view(topic, beat, entry["text"], entry.get("forms") or {}, heard=heard)
    except (Problem, SystemExit, ValueError, KeyError, TypeError) as e:   # the files were changed under it
        v["pending_error"] = f"несохранённая правка не подходит к тексту шага: {e}"
        return v
    if not p["dirty"]:   # the book says this now
        keep(topic.ch, beat)
        return v
    _, meta = drafted(topic.ch, beat, p["key"])
    p["draft"] = draft_info(topic.ch, beat, tts.split_marks(p["text"])[0], p["key"], meta) if meta else None
    p["note"] = entry.get("note", "")
    v["pending"] = p
    return v


def forget(ch, beat):
    topic = Topic(ch)
    topic.raw(beat)
    keep(ch, beat)
    return view(topic, beat)


def queue_page():
    queue, heard, out = read_json(PENDING, {}), read_json(HEARD, {}), []
    for ch in topics():
        if ch in queue:
            t = Topic(ch)
            for b in t.spec["beats"]:
                if b in queue[ch]:
                    v = with_pending(t, b, heard, queue)
                    if "pending" in v or "pending_error" in v:
                        out.append(v)
    return {"beats": out}


def save(ch, beat, text, forms):
    """Write the beat into the book as the page asks: pieces, text, clip, word times, timings.js."""
    with FILES:
        topic = Topic(ch)
        raw, clean, marks, pieces, _ = state(topic, beat, text, forms)
        stext = st.silero_text(clean, pieces, f"{ch} {beat}")
        key = topic.key(stext)
        mp3, old = topic.out / f"{beat}.mp3", topic.cache.get(beat, {})
        take, meta = drafted(ch, beat, key)
        if meta is None and old.get("key") == key and mp3.is_file() and "words" in old:
            take, meta = None, old   # the clip in the book says this already
        elif meta is None:
            meta = voice_clip(topic, clean, stext, key, take)
        entry = {"key": key, "dur": meta["dur"], "words": meta["words"],
                 "marks": tts.mark_times(clean, marks, meta["words"]), "cues": tts.caption_cues(clean, meta["words"])}
        # all is known; now the files
        if take is not None:
            try:
                os.replace(take, mp3)
            except OSError:   # another disk
                shutil.copyfile(take, mp3)
                take.unlink()
        stress = dict(topic.stress)
        if pieces:
            stress[beat] = pieces
        else:
            stress.pop(beat, None)
        if stress != topic.stress:
            write_atomic(topic.stress_path, json.dumps(stress, ensure_ascii=False, indent=1) + "\n")
        if raw != topic.raw(beat):
            beats = topic.spec["beats"]
            if isinstance(beats[beat], dict):
                beats[beat]["text"] = raw
            else:
                beats[beat] = raw
            end = "\n" if topic.spec_text.endswith("\n") else ""
            write_atomic(topic.src, json.dumps(topic.spec, ensure_ascii=False, indent=2) + end)
        topic.cache[beat] = entry
        cache = {b: topic.cache[b] for b in topic.spec["beats"] if b in topic.cache}
        write_atomic(topic.cache_path, json.dumps(cache, indent=1))
        public = {b: {k: v[k] for k in ("dur", "marks", "cues", "forced") if k in v} for b, v in cache.items()}
        write_atomic(topic.out / "timings.js", "window.TIMINGS = " + json.dumps(public, indent=1) + ";\n")
        for f in (DRAFTS / ch).glob(f"{beat}.*"):
            f.unlink(missing_ok=True)
        keep(ch, beat)
        print(f"{ch} {beat}: saved, {entry['dur']:.2f} s, pieces {pieces}", flush=True)
        v = view(Topic(ch), beat)
        FLAGS.setdefault(ch, {})[beat] = flagged(v["words"])
        return v


def set_heard(ch, beat, on):
    Topic(ch).raw(beat)
    with FILES:
        heard = read_json(HEARD, {})
        if on:
            heard.setdefault(ch, {})[beat] = True
        else:
            heard.get(ch, {}).pop(beat, None)
        write_atomic(HEARD, json.dumps(heard, ensure_ascii=False, indent=1) + "\n")
    return {"ch": ch, "id": beat, "heard": bool(on)}


# --- the page's requests ---------------------------------------------------------------------------------------------

def book():
    info, heard, queue, out = course(), read_json(HEARD, {}), read_json(PENDING, {}), []
    for ch in topics():
        t = Topic(ch)
        beats, stale, lost = list(t.spec["beats"]), 0, 0
        for b in beats:
            _, clean, _, pieces, gone = state(t, b, None, None)
            entry = t.cache.get(b, {})
            lost += len(gone)
            stale += entry.get("key") != t.key(st.silero_text(clean, pieces, "")) or not (t.out / f"{b}.mp3").is_file()
        out.append({"ch": ch, **info.get(ch, {"unit": 0, "unit_title": "", "color": "#999", "label": ch, "title": ch}),
                    "beats": len(beats), "dur": round(sum(t.cache.get(b, {}).get("dur", 0) for b in beats), 1),
                    "heard": sum(1 for b in beats if heard.get(ch, {}).get(b)),
                    "given": sum(len(t.stress.get(b, [])) for b in beats),
                    "flagged": sum(FLAGS[ch].values()) if ch in FLAGS else None, "stale": stale, "lost": lost,
                    "pending": len(queue.get(ch, {}))})
    return {"topics": out, "scanned": sum(t["flagged"] is not None for t in out)}


def topic_page(ch):
    t, heard, queue = Topic(ch), read_json(HEARD, {}), read_json(PENDING, {})
    beats = [with_pending(t, b, heard, queue) for b in t.spec["beats"]]
    FLAGS[ch] = {v["id"]: flagged(v["words"]) for v in beats}
    return {"ch": ch, **course().get(ch, {}), "voice": t.voice, "rate": t.rate, "beats": beats}


def search(q):
    q = fold(q.strip().lower()) if isinstance(q, str) else ""
    if len(q) < 2:
        raise Problem("для поиска нужно хотя бы две буквы")
    heard, queue, out = read_json(HEARD, {}), read_json(PENDING, {}), []
    for ch in topics():
        t = Topic(ch)
        for b in t.spec["beats"]:
            if q in fold(tts.split_marks(t.raw(b))[0].lower()):
                if len(out) == SEARCH_LIMIT:
                    return {"q": q, "beats": out, "more": True}
                out.append(with_pending(t, b, heard, queue))
    return {"q": q, "beats": out, "more": False}


def scan():
    """Silero, then its readings of every beat in the background: the topics' counts of words it chose itself."""
    with MODEL:
        st.accentor()
    print("Silero is ready", flush=True)
    for ch in topics():
        try:
            t = Topic(ch)
            counts = {}
            for b in t.spec["beats"]:
                _, clean, _, pieces, _ = state(t, b, None, None)
                counts[b] = flagged(analyze(clean, pieces)[1])
            FLAGS[ch] = counts
        except (Exception, SystemExit) as e:   # silero_text stops with SystemExit on a bad piece
            print(f"{ch}: {e}", file=sys.stderr, flush=True)


GET = {
    "/api/ping": lambda q: {"golos": True, "port": PORT},
    "/api/book": lambda q: book(),
    "/api/queue": lambda q: queue_page(),
    "/api/topic": lambda q: topic_page(q.get("ch")),
    "/api/search": lambda q: search(q.get("q")),
}
POST = {
    "/api/analyze": lambda b: changed(b, voice=False),
    "/api/draft": lambda b: changed(b, voice=True),
    "/api/save": lambda b: save(b.get("ch"), b.get("beat"), b.get("text"), b.get("forms")),
    "/api/forget": lambda b: forget(b.get("ch"), b.get("beat")),
    "/api/heard": lambda b: set_heard(b.get("ch"), b.get("beat"), bool(b.get("heard"))),
}


class Handler(serve.NoStore):
    """The page, its requests, the book (/uroki/) and the drafts (/drafts/); nothing else of the repository."""

    def hosts(self):
        return {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}

    def translate_path(self, path):
        p = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        if p in ("/", "/index.html"):
            return str(PAGE / "index.html")
        for prefix, root in (("/app/", PAGE), ("/drafts/", DRAFTS), ("/uroki/", BOOK)):
            if p.startswith(prefix):
                root, target = root.resolve(), (root / p[len(prefix):]).resolve()
                if target == root or root in target.parents:
                    return str(target)
        return str(PAGE / "-not-served-")

    def list_directory(self, path):
        self.send_error(404)

    def end_headers(self):   # a lesson served from here knows it (kletka.js shows its «Озвучка» button)
        self.send_header("Server-Timing", "golos")
        super().end_headers()

    def do_GET(self):
        if self.headers.get("Host") not in self.hosts():
            return self.send_error(403)
        url = urllib.parse.urlsplit(self.path)
        if url.path.startswith("/api/"):
            query = {k: v[-1] for k, v in urllib.parse.parse_qs(url.query).items()}
            return self.answer(GET.get(url.path), query)
        super().do_GET()

    def do_HEAD(self):
        if self.headers.get("Host") not in self.hosts():
            return self.send_error(403)
        super().do_HEAD()

    def do_POST(self):
        origin = self.headers.get("Origin")
        if self.headers.get("Host") not in self.hosts() or (origin and origin not in {f"http://{h}" for h in self.hosts()}):
            return self.send_error(403)
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self.send_error(415)
        size = int(self.headers.get("Content-Length") or 0)
        if size > 1 << 20:
            return self.send_error(413)
        try:
            body = json.loads(self.rfile.read(size) or b"{}")
        except ValueError:
            return self.reply(400, {"error": "тело запроса — не JSON"})
        self.answer(POST.get(urllib.parse.urlsplit(self.path).path), body if isinstance(body, dict) else {})

    def answer(self, route, arg):
        if route is None:
            return self.reply(404, {"error": "нет такого запроса"})
        try:
            self.reply(200, route(arg))
        except (Problem, SystemExit, ValueError, KeyError, TypeError) as e:   # silero_text and tts stop with SystemExit
            self.reply(400, {"error": str(e) or e.__class__.__name__})
        except Exception as e:
            traceback.print_exc()
            self.reply(500, {"error": f"{e.__class__.__name__}: {e}"})

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_request(self, code="-", size="-"):   # the page's writes and the failures, not every clip it plays
        code = getattr(code, "value", code)
        if self.command == "POST" or (str(code).isdigit() and int(code) >= 400):
            super().log_request(code, size)


UV = ["run", "-q", "--python", "3.11", "--with", "torch", "--with", "vosk", "--with", "numpy",
      "--index", "https://download.pytorch.org/whl/cpu", "--index-strategy", "unsafe-best-match"]


def under_uv():
    """Silero and Vosk need torch, vosk and numpy: without them here (a plain python3), run this script again under uv,
    which brings them (downloaded once, then from its cache)."""
    try:
        import numpy, torch, vosk  # noqa: F401
        return
    except ImportError:
        if os.environ.get("VOICE_REVIEW_UV"):
            raise
    uv = shutil.which("uv") or str(Path.home() / ".local/bin/uv")
    if not Path(uv).is_file():
        sys.exit("uv is needed to bring torch, vosk and numpy: https://docs.astral.sh/uv/")
    os.environ["VOICE_REVIEW_UV"] = "1"
    print("starting under uv (torch, vosk, numpy)…", flush=True)
    os.execv(uv, [uv, *UV, "python", str(Path(__file__).resolve()), *sys.argv[1:]])


def running(port):
    """True when this page already answers on the port."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=2) as r:
            return bool(json.loads(r.read()).get("golos"))
    except (OSError, ValueError):
        return False


def main():
    global PORT
    args = sys.argv[1:]
    if any(a in ("-h", "--help") for a in args):
        print(__doc__)
        return
    PORT = next((int(a) for a in args if a.isdigit()), PORT)
    ch = next((a for a in args if CH.fullmatch(a)), "")
    url = f"http://localhost:{PORT}/" + (f"#{ch}" if ch else "")
    show = "--no-open" not in args
    if running(PORT):   # already up: just show it
        print(f"voice review is already running: {url}", flush=True)
        if show:
            webbrowser.open(url)
        return
    under_uv()
    DRAFTS.mkdir(parents=True, exist_ok=True)
    try:
        server = serve.Server(("127.0.0.1", PORT), functools.partial(Handler, directory=str(ROOT)))
    except OSError as e:
        sys.exit(f"port {PORT} is taken by something else ({e}): pass another port")
    threading.Thread(target=scan, daemon=True).start()
    print(f"voice review: {url} (Silero is loading)", flush=True)
    if show:
        threading.Timer(0.3, webbrowser.open, [url]).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
