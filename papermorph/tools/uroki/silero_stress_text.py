"""The lessons' narration as Silero says it, stress shown, for checking stress by reading instead of listening.

Usage, from the repository root (the same uv command as silero_tts.py):
    ... python papermorph/tools/uroki/silero_stress_text.py papermorph/content/uroki/ch*/narration.ru.json > stress.md

Silero's own accentor (the one inside the voice, so the marks are what the clips say) runs on each beat's text with
the stress pieces of narration.ru.stress.json already applied. In the output every word of two or more syllables
carries U+0301 after its stressed vowel;
  **word** — Silero chose between two stresses itself (a homograph: «чи́сла» / «числа́»), or chose «е» or «ё»;
  _word_   — the stress is given by a piece of narration.ru.stress.json.
A wrong stress is fixed with a piece in narration.ru.stress.json, then silero_tts.py for the chapter.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import silero_tts as st  # noqa: E402  silero(), silero_text(), tts helpers

VOW = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"
WORDS = re.compile(r"[\w+]+(?:-[\w+]+)*")
FLAGGED = {}


def words_of(marked):
    """[(start, end, word with «+»)] of a text the accentor returned."""
    return [(m.start(), m.end(), m.group()) for m in WORDS.finditer(marked)]


def shown(word):
    """«ч+исла» -> «чи́сла»; a word of one syllable stays bare."""
    bare = word.replace("+", "")
    if sum(c in VOW for c in bare) < 2:
        return bare
    return re.sub(r"\+([" + VOW + r"])", lambda m: m.group(1) + ("" if m.group(1) in "ёЁ" else st.ACC), word).replace("+", "")


def beat_line(acc, clean, pieces, where):
    stext = st.silero_text(clean, pieces, where)
    given = set()   # positions (in clean) of the words a piece fixes
    for m in re.finditer(r"\+", stext):
        given.add(m.start() - stext[:m.start()].count("+"))
    on, homo_off, yo_off = acc(stext), acc(stext, put_stress_homo=False), acc(stext, put_yo_homo=False)
    w_on, w_homo, w_yo = words_of(on), words_of(homo_off), words_of(yo_off)
    if not (len(w_on) == len(w_homo) == len(w_yo)):
        return on, 0
    out, pos_clean, flagged = [], 0, 0
    clean_words = [(m.start(), m.end()) for m in re.finditer(r"\w+(?:-\w+)*", clean)]
    for k, ((s, e, w), (_, _, wh), (_, _, wy)) in enumerate(zip(w_on, w_homo, w_yo)):
        text = shown(w)
        cs, ce = clean_words[k] if k < len(clean_words) else (-1, -1)
        if any(cs <= g < ce for g in given):
            text = f"_{text}_"
        elif ("+" in w and "+" not in wh) or (w.replace("+", "") != wy.replace("+", "")):
            FLAGGED[shown(w).lower()] = FLAGGED.get(shown(w).lower(), 0) + 1
            text = f"**{text}**"
            flagged += 1
        out.append((s, e, text))
    line, last = [], 0
    for s, e, text in out:
        line.append(on[last:s]); line.append(text); last = e
    line.append(on[last:])
    return "".join(line), flagged


def main(files):
    acc = st.silero().packages[0].accentor
    total, body = 0, []
    print = lambda *a, **k: body.append(" ".join(map(str, a)))   # the summary goes first, so collect the text
    for f in files:
        src = Path(f)
        spec = json.loads(src.read_text(encoding="utf-8-sig"))
        stress_path = src.with_suffix(".stress.json")
        stress = json.loads(stress_path.read_text(encoding="utf-8")) if stress_path.exists() else {}
        print(f"## {src.parent.name}\n")
        for beat, raw in spec["beats"].items():
            raw = raw["text"] if isinstance(raw, dict) else raw
            clean, _ = st.tts.split_marks(raw)
            line, n = beat_line(acc, clean, stress.get(beat, []), f"{src.parent.name} {beat}")
            total += n
            print(f"- `{beat}` {line}")
        print()
    out = ["# Ударения в озвучке Silero", "",
           "Жирным — где Silero сам выбирал между двумя ударениями или между «е» и «ё»; курсивом — ударение задано "
           "куском в `narration.ru.stress.json`. Остальные слова Silero ударяет по своему словарю.", "",
           f"## Где Silero выбирал сам ({total} мест), по частоте", "",
           ", ".join(f"{w} ×{n}" if n > 1 else w for w, n in sorted(FLAGGED.items(), key=lambda x: (-x[1], x[0]))), ""]
    sys.stdout.write("\n".join(out + body) + "\n")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if len(sys.argv) > 1 else 2)
    main(sys.argv[1:])
