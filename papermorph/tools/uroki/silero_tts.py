"""Voice the lessons with Silero TTS (local, free): MP3s, word times and timings.js, as tts.py writes them.

The book's voice is Silero v5 (model v5_6_ru, speaker xenia); the narration file says so: "engine": "silero",
"voice": "xenia", "rate": "78%" (Silero's SSML prosody rate; 100% is its own, quicker pace; at 78% the book runs as
long as it did in Edge). tts.py stops on such a file, so Edge cannot voice the book over by mistake. Each clip gets
0.2 s of silence before the voice and 0.9 s after it, as Edge's clips have, so beats keep their holds, and is brought
to -21 LUFS (Edge's level; Silero's own varies from clip to clip by 2-3 dB).

Usage, from the repository root:
    uv run --python 3.11 --with torch --with vosk --with numpy \\
        --index https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match \\
        python papermorph/tools/uroki/silero_tts.py papermorph/content/uroki/ch01/narration.ru.json uroki/ch01/audio/ru
    ... --dry                                print each beat's text as Silero gets it, voice nothing
    ... --realign                            find the word times of the clips already made again (after a change here)
    silero_tts.py --say "Сравни чи́сла." out.mp3   one test line, its word times printed

Stress: Silero places it itself, homographs included, and takes «+» before a vowel as an order. Each piece of
chNN/narration.ru.stress.json ({beat: ["кусок те́кста", ...]}, U+0301 after the stressed vowel of every word to fix;
the piece without the marks occurs in the beat's spoken text exactly once, «е» and «ё» alike) becomes «+» before
that vowel; a «ё» written in a piece is spoken as «ё». The text and the captions stay without marks.

Word times: Silero gives none, so each clip is recognized by Vosk (vosk-model-small-ru-0.22) limited to the beat's
own words, and the words heard are lined up with the text's (difflib): a word Vosk does not know is heard as another
one in its place and keeps that time. Vosk hears a word 0.07 s later than Edge's and Azure's word boundaries put it
(16 beats voiced by Azure: 95 % of words matched; after that shift half are within 0.014 s, 99 % within 0.11 s), so
that much is taken off; a word left over sits halfway between its neighbours.

A beat is voiced again when its Silero text (spoken text, stress pieces), speaker or rate changes; moving a [[mark]]
only recomputes the times. Models are downloaded once to ~/.cache/papermorph/ (Silero 141 MB from models.silero.ai,
Vosk 45 MB from alphacephei.com). Silero's models are CC BY-NC-SA 4.0: non-commercial use, with credit to Silero.
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

SKILL = Path(os.environ.get("PAPERMORPH_SKILL", Path.home() / ".claude/skills/papermorph"))
sys.path.insert(0, str(SKILL / "scripts"))
import tts  # noqa: E402  split_marks, mark_times, caption_cues, duration, write_atomic

ACC = "́"
VOWELS = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")
MODEL = "v5_6_ru"
MODEL_URL = f"https://models.silero.ai/models/tts/ru/{MODEL}.pt"
VOSK = "vosk-model-small-ru-0.22"
VOSK_URL = f"https://alphacephei.com/vosk/models/{VOSK}.zip"
CACHE = Path(os.environ.get("PAPERMORPH_CACHE", Path.home() / ".cache/papermorph"))
SR = 48000            # Silero's output; the MP3 is written at 24 kHz, 48 kbit/s, mono, as Edge's
VOSK_LAG = 0.07       # Vosk's word starts minus Edge's/Azure's word boundaries (median, measured)
LEAD, TAIL = 0.2, 0.9  # silence before and after the voice, as in Edge's clips (0.2-0.25 s and 0.8-1.0 s)
LUFS = -21.0          # each clip's loudness, as Edge gave its clips (Silero's own: -18 to -21 LUFS)
WORD = re.compile(r"\w+(?:-\w+)*")
sha1 = lambda s: hashlib.sha1(s.encode()).hexdigest()
fold = lambda s: s.replace("ё", "е").replace("Ё", "Е")


def fetch(url, dst):
    """Download url to dst once, resuming and retrying (the Vosk server stalls at times)."""
    if dst.exists():
        return dst
    dst.parent.mkdir(parents=True, exist_ok=True)
    part = dst.with_suffix(dst.suffix + ".part")
    for attempt in range(8):
        try:
            have = part.stat().st_size if part.exists() else 0
            req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
            with urllib.request.urlopen(req, timeout=60) as r, open(part, "ab" if have else "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            part.replace(dst)
            return dst
        except OSError as e:
            print(f"download {url}: {e}, retrying", file=sys.stderr, flush=True)
            time.sleep(3 + 3 * attempt)
    raise SystemExit(f"could not download {url}")


_silero, _vosk = {}, {}


def silero():
    if "m" not in _silero:
        import torch
        torch.set_num_threads(int(os.environ.get("SILERO_THREADS", "4")))
        path = fetch(MODEL_URL, CACHE / "silero" / f"{MODEL}.pt")
        _silero["m"] = torch.package.PackageImporter(str(path)).load_pickle("tts_models", "model")
    return _silero["m"]


def accentor():
    """Silero's accentor as the voice uses it. The model ships its homograph solver quantized, and apply_tts restores
    the weights (unpack_q_model, once) before it places any stress; called before that, the accentor reads some
    homographs otherwise (on 2026-11-15, 42 words of the book: «равно́» where the voice says «ра́вно»), so the weights
    are restored here first, and marked restored so apply_tts does not scale them again."""
    for package in silero().packages:
        if not getattr(package, "q_model_unpacked", True):
            package.unpack_q_model()
            package.q_model_unpacked = True
    return silero().packages[0].accentor


def vosk_model():
    if "m" not in _vosk:
        from vosk import Model, SetLogLevel
        SetLogLevel(-1)
        root = CACHE / "vosk" / VOSK
        if not root.exists():
            z = fetch(VOSK_URL, CACHE / "vosk" / f"{VOSK}.zip")
            with zipfile.ZipFile(z) as f:
                f.extractall(CACHE / "vosk")
            z.unlink()
        _vosk["m"] = Model(str(root))
    return _vosk["m"]


def silero_text(clean, pieces, where):
    """The spoken text with «+» before each vowel the stress pieces mark (and their «ё»)."""
    chars, plus = list(clean), set()
    folded = fold(clean)
    for piece in pieces:
        bare = piece.replace(ACC, "")
        found = [m.start() for m in re.finditer(re.escape(fold(bare)), folded)]
        if len(found) != 1:
            raise SystemExit(f"{where}: {piece!r} occurs {len(found)} times in the beat's spoken text, not once")
        if ACC not in piece:
            raise SystemExit(f"{where}: {piece!r} has no stress mark (U+0301 after the stressed vowel)")
        k = found[0]
        for c in piece:
            if c == ACC:
                if chars[k - 1] not in VOWELS:
                    raise SystemExit(f"{where}: in {piece!r} the stress mark follows {chars[k - 1]!r}, not a vowel")
                plus.add(k - 1)
            else:
                chars[k] = c
                k += 1
    return "".join(("+" if i in plus else "") + c for i, c in enumerate(chars))


def synth(text, voice, rate, mp3):
    """Silero's take of text, written as MP3; returns its samples at 16 kHz (s16le) for the word times."""
    import numpy as np
    doc = f'<speak><prosody rate="{rate}">{escape(text)}</prosody></speak>'
    audio = silero().apply_tts(ssml_text=doc, speaker=voice, sample_rate=SR).numpy()
    audio = audio * 10 ** ((LUFS - loudness(audio)) / 20)   # one loudness for every clip (a gain, no limiter)
    pad = lambda s: np.zeros(int(s * SR), np.int16)
    pcm = np.concatenate([pad(LEAD), (audio * 32767).clip(-32768, 32767).astype(np.int16), pad(TAIL)]).tobytes()
    raw = ["ffmpeg", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-"]
    subprocess.run(raw + ["-ar", "24000", "-b:a", "48k", "-f", "mp3", "-y", str(mp3)], input=pcm, check=True)
    return subprocess.run(raw + ["-ar", "16000", "-f", "s16le", "-"], input=pcm, capture_output=True, check=True).stdout


def loudness(audio):
    """Integrated loudness (LUFS, EBU R128) of float samples at SR, measured by ffmpeg."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", "ebur128", "-f", "null", "-"], input=audio.astype("float32").tobytes(), capture_output=True)
    found = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr.decode())
    return float(found[-1]) if found else LUFS


def word_times(clean, pcm16, dur):
    """[[seconds, word], ...] for every word of clean: Vosk's start limited to the beat's words, less VOSK_LAG."""
    from vosk import KaldiRecognizer
    toks = [m.group() for m in WORD.finditer(clean)]
    norm = lambda w: fold(w.lower())
    vocab = {w.lower() for w in toks} | {norm(w) for w in toks}   # Vosk knows «ещё», not «еще»: both, it skips the other
    rec = KaldiRecognizer(vosk_model(), 16000, json.dumps([" ".join(sorted(vocab)), "[unk]"], ensure_ascii=False))
    rec.SetWords(True)
    heard = []
    for i in range(0, len(pcm16), 16000):
        if rec.AcceptWaveform(pcm16[i:i + 16000]):
            heard += json.loads(rec.Result()).get("result", [])
    heard += json.loads(rec.FinalResult()).get("result", [])
    heard = [(norm(h["word"]), max(0.0, h["start"] - VOSK_LAG)) for h in heard]
    # the text's words against the words heard, in order: a word Vosk does not know («семьюстами», «прикидка») is
    # heard as a similar one («семисот», «и к») in its place, so a one-to-one replacement keeps the time
    times = [None] * len(toks)
    ops = difflib.SequenceMatcher(None, [norm(w) for w in toks], [h[0] for h in heard], autojunk=False).get_opcodes()
    for op, i1, i2, j1, j2 in ops:
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = heard[j1 + k][1]
        elif op == "replace" and j2 > j1:   # the first word of an uneven stretch starts where its sound starts
            times[i1] = heard[j1][1]
    missed = sum(t is None for t in times)
    for i, t in enumerate(times):   # a word not placed: halfway between its known neighbours
        if t is None:
            prev = next((times[q] for q in range(i - 1, -1, -1) if times[q] is not None), 0.0)
            nxt = next((times[q] for q in range(i + 1, len(times)) if times[q] is not None), dur)
            times[i] = prev + (nxt - prev) * 0.5
    for i in range(1, len(times)):   # keep them in order
        times[i] = max(times[i], times[i - 1])
    return [[round(t, 3), w] for t, w in zip(times, toks)], missed


def say(text, out, voice, rate):
    clean, _ = tts.split_marks(text)
    plain = clean.replace(ACC, "")
    pieces = [m.group() for m in re.finditer(r"\w*" + ACC + r"\w*", clean)]
    stext = silero_text(plain, [p for p in pieces], "--say")
    pcm16 = synth(stext, voice, rate, out)
    dur = tts.duration(out)
    words, missed = word_times(plain, pcm16, dur)
    print(json.dumps({"silero": stext, "dur": dur, "words": words, "not heard": missed}, ensure_ascii=False, indent=1))


def main(src, out_dir, dry=False, realign=False):
    src, out_dir = Path(src), Path(out_dir)
    spec = json.loads(src.read_text(encoding="utf-8-sig"))
    if spec.get("engine") != "silero" or spec.get("voices"):
        raise SystemExit(f'{src}: not a single-voice Silero narration file ("engine": "silero")')
    voice, rate = spec["voice"], spec.get("rate", "100%")
    stress_path = src.with_suffix(".stress.json")
    stress = json.loads(stress_path.read_text(encoding="utf-8")) if stress_path.exists() else {}
    unknown = set(stress) - set(spec["beats"])
    if unknown:
        raise SystemExit(f"{stress_path}: no such beats: {sorted(unknown)}")
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_path = src.with_suffix(".timings.json")
    cache = json.loads(cache_path.read_text(encoding="utf-8-sig")) if cache_path.exists() else {}
    public = lambda v: {k: v[k] for k in ("dur", "marks", "cues", "forced") if k in v}
    result, voiced = {}, 0
    for beat, raw in spec["beats"].items():
        if isinstance(raw, dict) and (raw.get("speaker") or raw.get("sub")):
            raise SystemExit(f"{beat}: speakers and subtitles are not handled here")
        raw = raw["text"] if isinstance(raw, dict) else raw
        clean, marks = tts.split_marks(raw)
        stext = silero_text(clean, stress.get(beat, []), f"{src.parent.name} {beat}")
        if dry:
            print(f"{beat}: {stext}")
            continue
        key = sha1(f"silero|{MODEL}|{voice}|{rate}|{LEAD}|{TAIL}|{LUFS}|{stext}")
        mp3, old = out_dir / f"{beat}.mp3", cache.get(beat, {})
        if old.get("key") == key and "words" in old and mp3.exists() and mp3.stat().st_size:
            words = old["words"]
            if realign:   # the same clip, its word times found again
                pcm16 = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                                       capture_output=True, check=True).stdout
                words, missed = word_times(clean, pcm16, old["dur"])
                if missed:
                    print(f"{src.parent.name} {beat}: {missed} of {len(words)} words not heard (placed between neighbours)")
            entry = dict(old, words=words, marks=tts.mark_times(clean, marks, words), cues=tts.caption_cues(clean, words))
        else:
            with tempfile.NamedTemporaryFile(dir=out_dir, prefix=f".{beat}-", suffix=".mp3", delete=False) as f:
                tmp = Path(f.name)
            try:
                pcm16 = synth(stext, voice, rate, tmp)
                dur = tts.duration(tmp)
                words, missed = word_times(clean, pcm16, dur)
                entry = {"key": key, "dur": dur, "words": words, "marks": tts.mark_times(clean, marks, words),
                         "cues": tts.caption_cues(clean, words)}
                tmp.replace(mp3)
            finally:
                tmp.unlink(missing_ok=True)
            voiced += 1
            note = f", {missed} of {len(words)} words not heard (placed between neighbours)" if missed else ""
            print(f"{src.parent.name} {beat}: voiced, {entry['dur']:.2f} s{note}", flush=True)
        result[beat] = cache[beat] = entry
        tts.write_atomic(cache_path, json.dumps(cache, indent=1))   # a later failure keeps the beats done
    if dry:
        return
    tts.write_atomic(cache_path, json.dumps(result, indent=1))
    tts.write_atomic(out_dir / "timings.js",
                     "window.TIMINGS = " + json.dumps({b: public(v) for b, v in result.items()}, indent=1) + ";\n")
    print(f"{src.parent.name}: {voiced} beat(s) voiced by Silero, {len(result) - voiced} up to date")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if args else 2)
    if args[0] == "--say":
        if len(args) != 3:
            sys.exit("usage: silero_tts.py --say 'текст с уда́рением' out.mp3")
        say(args[1], args[2], os.environ.get("VOICE", "xenia"), os.environ.get("RATE", "78%"))
    else:
        main(*[a for a in args if not a.startswith("--")][:2], dry="--dry" in args, realign="--realign" in args)
