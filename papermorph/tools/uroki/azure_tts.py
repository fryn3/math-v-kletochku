"""Voice again, with Azure Speech, the beats whose homographs need a fixed stress; same voice and rate as tts.py.

Edge (tts.py) guesses the stress of words spelled alike («чи́сла» / «числа́») and its endpoint takes no SSML, so no
mark in the text changes what it says. Azure Speech has the same neural voice and takes SSML: each listed word is
sent inside <phoneme alphabet="ipa">. The narration text and the captions stay without marks.

Usage, from the repository root, after tts.py for the chapter:
    uv run --with azure-cognitiveservices-speech python papermorph/tools/uroki/azure_tts.py \\
        papermorph/content/uroki/ch01/narration.ru.json uroki/ch01/audio/ru
    ... --dry                                print the SSML of the beats it would voice, send nothing
    azure_tts.py --say "Сравни чи́сла." out.mp3    one test line, its word times printed

Files:
  chNN/narration.ru.stress.json  {beat: ["кусок те́кста", ...]}: each piece is a part of the beat's spoken text
                                 (without [[marks]]) with U+0301 after the stressed vowel of every word to fix;
                                 without the marks it must occur in the beat exactly once.
  ipa.ru.json (next to the chNN folders)  {"чи́сла": "ˈt͡ɕislə", ...}: each stressed form in Azure's ru-RU IPA
                                 phone set (learn.microsoft.com: speech-ssml-phonetic-sets, ru-RU).
  chNN/narration.ru.azure.json   written here: for each beat the hash of the SSML sent and of the MP3 it made.
                                 A beat is voiced again when its text, voice, rate or stress changed, or when its MP3
                                 is no longer the one made here (tts.py voiced it again after its text changed).

The MP3, the word times in narration.ru.timings.json and timings.js are written as tts.py writes them, with its own
functions for marks and captions. The cache key is the one tts.py computes, so tts.py keeps these clips.

Key: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION from the environment or from ~/.config/papermorph/azure-speech.env
(lines NAME=value). The key is never printed.
"""
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from xml.sax.saxutils import escape

SKILL = Path(os.environ.get("PAPERMORPH_SKILL", Path.home() / ".claude/skills/papermorph"))
sys.path.insert(0, str(SKILL / "scripts"))
import tts  # noqa: E402  split_marks, mark_times, caption_cues, duration, write_atomic

ACC = "́"
STRESSED = re.compile(r"\w[\ẃ]*")       # a word, stress mark included
ENV_FILE = Path.home() / ".config/papermorph/azure-speech.env"
IPA_DEFAULT = Path(__file__).resolve().parents[2] / "content/uroki/ipa.ru.json"
RETRY = {"TooManyRequests", "ServiceTimeout", "ServiceUnavailable", "ConnectionFailure", "ServiceError"}
sha1 = lambda b: hashlib.sha1(b if isinstance(b, bytes) else b.encode()).hexdigest()


def credentials():
    vals = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                name, value = line.split("=", 1)
                vals[name.strip()] = value.strip().strip("'\"")
    key = os.environ.get("AZURE_SPEECH_KEY") or vals.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION") or vals.get("AZURE_SPEECH_REGION")
    if not key or not region:
        raise SystemExit(f"no Azure key: set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, or write them to {ENV_FILE}")
    return key, region


def ipa_of(word, ipa, where):
    form = word.lower()
    if form not in ipa:
        raise SystemExit(f"{where}: no IPA for {word!r}: add {form!r} to ipa.ru.json")
    return ipa[form]


def spans_in(clean, pieces, ipa, beat):
    """[(start, end, ipa)] in the beat's clean text for each stressed word of its pieces."""
    spans = []
    for piece in pieces:
        bare = piece.replace(ACC, "")
        found = [m.start() for m in re.finditer(re.escape(bare), clean)]
        if len(found) != 1:
            raise SystemExit(f"{beat}: {piece!r} occurs {len(found)} times in the beat's text, not once")
        marked = [m for m in STRESSED.finditer(piece) if ACC in m.group()]
        if not marked:
            raise SystemExit(f"{beat}: {piece!r} has no stress mark (U+0301 after the stressed vowel)")
        for m in marked:
            start = found[0] + m.start() - piece[:m.start()].count(ACC)
            word = m.group().replace(ACC, "")
            spans.append((start, start + len(word), ipa_of(m.group(), ipa, beat)))
    spans.sort()
    for (_, e0, _), (s1, _, _) in zip(spans, spans[1:]):
        if s1 < e0:
            raise SystemExit(f"{beat}: one word is listed twice in its stress pieces")
    return spans


def ssml(clean, spans, voice, rate, pitch="+0Hz"):
    """The SSML edge-tts sends for a beat (voice, prosody), with each listed word inside <phoneme>."""
    parts, pos = [], 0
    for start, end, ph in spans:
        parts += [escape(clean[pos:start]),
                  f'<phoneme alphabet="ipa" ph="{escape(ph, {chr(34): "&quot;"})}">{escape(clean[start:end])}</phoneme>']
        pos = end
    parts.append(escape(clean[pos:]))
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ru-RU">'
            f'<voice name="{voice}"><prosody pitch="{pitch}" rate="{rate}" volume="+0%">{"".join(parts)}</prosody>'
            '</voice></speak>')


def synth(doc, mp3, key, region, attempts=6):
    """Send the SSML; write the MP3 (24 kHz, 48 kbit/s mono, as Edge's) and return [[seconds, word], ...]."""
    import azure.cognitiveservices.speech as sdk
    cfg = sdk.SpeechConfig(subscription=key, region=region)
    cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3)
    for attempt in range(1, attempts + 1):
        synth_ = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=None)
        words = []
        synth_.synthesis_word_boundary.connect(
            lambda e: words.append([e.audio_offset / 1e7, e.text])
            if e.boundary_type == sdk.SpeechSynthesisBoundaryType.Word else None)
        res = synth_.speak_ssml_async(doc).get()
        if res.reason == sdk.ResultReason.SynthesizingAudioCompleted and res.audio_data:
            Path(mp3).write_bytes(res.audio_data)
            return words
        det = res.cancellation_details
        code = det.error_code.name if det else str(res.reason)
        if code not in RETRY or attempt == attempts:
            raise SystemExit(f"Azure refused: {code}: {(det.error_details if det else '')[:300]}")
        print(f"Azure: {code}, retrying in {5 * attempt} s", file=sys.stderr, flush=True)
        time.sleep(5 * attempt)


def say(text, out, voice, rate, ipa):
    clean, _ = tts.split_marks(text)
    no_acc = lambda i: i - clean[:i].count(ACC)   # a position in the text once its marks are gone
    spans = [(no_acc(m.start()), no_acc(m.end()), ipa_of(m.group(), ipa, "--say"))
             for m in STRESSED.finditer(clean) if ACC in m.group()]
    doc = ssml(clean.replace(ACC, ""), spans, voice, rate)
    words = synth(doc, out, *credentials())
    print(json.dumps({"ssml": doc, "dur": tts.duration(out), "words": words}, ensure_ascii=False, indent=1))


def main(src, out_dir, dry=False):
    src, out_dir = Path(src), Path(out_dir)
    stress_path = src.with_suffix(".stress.json")
    if not stress_path.exists():
        print(f"{stress_path}: none, nothing to voice")
        return
    stress = json.loads(stress_path.read_text(encoding="utf-8"))
    ipa = json.loads((src.parent.parent / "ipa.ru.json").read_text(encoding="utf-8"))
    spec = json.loads(src.read_text(encoding="utf-8-sig"))
    if spec.get("engine", "edge") != "edge" or spec.get("voices"):
        raise SystemExit("only a single-voice Edge narration file is handled")
    voice, rate = spec["voice"], spec.get("rate", "+0%")
    cache_path, record_path = src.with_suffix(".timings.json"), src.with_suffix(".azure.json")
    cache = json.loads(cache_path.read_text(encoding="utf-8-sig"))
    record = json.loads(record_path.read_text(encoding="utf-8")) if record_path.exists() else {}
    unknown = set(stress) - set(spec["beats"])
    if unknown:
        raise SystemExit(f"{stress_path}: no such beats: {sorted(unknown)}")
    creds, done = None, 0
    for beat, raw in spec["beats"].items():
        if beat not in stress:
            continue
        raw = raw["text"] if isinstance(raw, dict) else raw
        clean, marks = tts.split_marks(raw)
        doc = ssml(clean, spans_in(clean, stress[beat], ipa, beat), voice, rate)
        key = sha1(f"{voice}|{rate}|{clean}")   # tts.py's cache key for an Edge beat without pitch
        mp3, old = out_dir / f"{beat}.mp3", record.get(beat)
        if (old and old["ssml"] == sha1(doc) and mp3.exists() and sha1(mp3.read_bytes()) == old["mp3"]
                and cache.get(beat, {}).get("key") == key):
            continue
        if cache.get(beat, {}).get("key") != key:
            raise SystemExit(f"{beat}: its text changed since tts.py voiced it: run tts.py first")
        if dry:
            print(f"{beat}: {doc}\n")
            continue
        creds = creds or credentials()
        with tempfile.NamedTemporaryFile(dir=out_dir, prefix=f".{beat}-", suffix=".mp3", delete=False) as f:
            tmp = Path(f.name)
        try:
            words = synth(doc, tmp, *creds)
            if not words:
                raise SystemExit(f"{beat}: Azure gave no word times")
            entry = {"key": key, "dur": tts.duration(tmp), "words": words,
                     "marks": tts.mark_times(clean, marks, words), "cues": tts.caption_cues(clean, words)}
            last = re.findall(r"\w+", clean)[-1]
            if words[-1][1].strip(".,;:!?»«\"'") != last:
                print(f"{beat}: WARNING the last word heard is {words[-1][1]!r}, the text ends {last!r}", file=sys.stderr)
            tmp.replace(mp3)
        finally:
            tmp.unlink(missing_ok=True)
        old_dur = cache[beat]["dur"]
        cache[beat], record[beat] = entry, {"ssml": sha1(doc), "mp3": sha1(mp3.read_bytes())}
        tts.write_atomic(cache_path, json.dumps(cache, indent=1))
        tts.write_atomic(record_path, json.dumps(record, indent=1, ensure_ascii=False) + "\n")
        print(f"{beat}: voiced by Azure, {old_dur:.2f} -> {entry['dur']:.2f} s", flush=True)
        done += 1
    if dry:
        return
    for beat in set(record) - set(stress):   # no longer listed: its clip stays until tts.py voices it again
        del record[beat]
    if record or record_path.exists():
        tts.write_atomic(record_path, json.dumps(record, indent=1, ensure_ascii=False) + "\n")
    public = lambda v: {k: v[k] for k in ("dur", "marks", "cues", "forced") if k in v}
    js = {b: public(cache[b]) for b in spec["beats"] if b in cache}
    tts.write_atomic(out_dir / "timings.js", "window.TIMINGS = " + json.dumps(js, indent=1) + ";\n")
    print(f"{src.parent.name}: {done} beat(s) voiced by Azure, {len(stress) - done} up to date")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if args else 2)
    if args[0] == "--say":
        if len(args) != 3:
            sys.exit("usage: azure_tts.py --say 'текст с уда́рением' out.mp3")
        say(args[1], args[2], os.environ.get("VOICE", "ru-RU-SvetlanaNeural"), os.environ.get("RATE", "-4%"),
            json.loads(IPA_DEFAULT.read_text(encoding="utf-8")))
    else:
        main(*[a for a in args if a != "--dry"][:2], dry="--dry" in args)
