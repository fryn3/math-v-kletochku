# Brief for a lesson worker (one topic = one lesson)

You make ONE lesson of the Papermorph lesson book «Математика в клеточку — уроки у доски»: an animated, narrated, interactive maths lesson in Russian for 5–6th grade, made with the Papermorph skill (installed at `~/.claude/skills/papermorph`). The repo is `/home/mger.karapetyan@rubius.rubius.com/Desktop/my_projects/math`, git branch `papermorph-uroki`. Your own topic (folder, label, source id, next topic, hints) is in the message that sent you here.

## Rules of the house

- Do not switch branches and do not commit. Other workers build other topics in the same checkout at the same time.
- Touch only your own files: `uroki/chNN/` (page and audio), `papermorph/content/uroki/chNN/`, `papermorph/books/uroki/chapters/chNN.md`, `papermorph/books/uroki/review/chNN/`, `papermorph/tools/uroki/e2e_chNN.py`. Never edit the reference site (repo root `index.html`, `js/`, `roditelyam.html`, `README.md`), `uroki/index.html`, `uroki/unit-art.js`, `uroki/lib/*` (engine copy and the book library `kletka.js`), `style.json`, `chapters.md` or another chapter. If the library needs a fix or a new shared piece, write it in your chapter with your prefix (`c07…` for ch07) and say so in your report.
- Do not run `perf.py` (the machine is busy with the other workers; the coordinator measures later).

## Read first

1. `~/.claude/skills/papermorph/SKILL.md`, then `references/lessons/lessons.md` (chapter loop), `authoring.md`, `diagrams.md`, `questions.md`, `maths.md`; `references/core/engine.md` and `references/core/sound.md` (the narration file, Voices) as needed. The engine's real code is `uroki/lib/engine.js` and `uroki/lib/math.js`: where docs and code differ, the code wins. Read a math.js helper before using it.
2. The book's anchor: `papermorph/books/uroki/style.json` (look, colour meanings, voice, components).
3. The approved lessons are the bar and the conventions to match. Open at least two: `uroki/ch13/index.html` (the first example) and the one closest to your topic among `ch14` (strips, a hundred square, a number line compared above/below), `ch15` (pieces sliding together, worked columns aligned on «=»), `ch16` (an area picture, cancelling, flipping, a clock). Their narration is in `papermorph/content/uroki/chNN/narration.ru.json`, their beat tables in `papermorph/books/uroki/chapters/chNN.md`, their frames in `papermorph/books/uroki/review/chNN/storyboard.jpg` (open with Read).
4. The book library `uroki/lib/kletka.js`: colours `KL.NUM, KL.DEN, KL.TWO, KL.WHOLE, KL.RULE`; text `klText, klMath, klRow(p, pieces, x, y, t0, opts), klTitle`; fractions `klFrac, klExpr, klEq`; strips `klStrip, klCut, klSplit, klShade, klPieces, klUnits`; circles `klPie, klSectorD`; `klRay, klHops (dir ±1)`; `klHundred` (10 × 10 square); `klArea, klHatch` (rectangle of cells); `klClock`; marks `klStrike, klMark, klCount, klArrow, klGuide, klBrace`; beats `klIntro, klWrap`. math.js adds number lines with integers (`numberLine, move, landDot, X(v), Y0`), signed and algebra tiles, a balance, `pointRow` (a decimal point that hops), `plane` and `pickPoint`, `die, coin, spinner`, `dataLine, axes`, `eqLine`. Prefer these; draw the rest in your chapter with your prefix (engine and math.js names are global: never declare them again; lint lists clashes).
5. Your source topic: its object in `js/chN-*.js` (id given to you): `rule`, `derive` (the special rules with why and an example), `trap` (the common mistake), `tasks`, sometimes `body` (a figure). Teach that scope in the lesson's own words and pictures, with new examples where they help; verify every number and every answer. If the source has many derive items, choose and order them so the lesson stays 6–9 minutes, and say in your chNN.md what you merged or left to practice.

## Make

- `papermorph/content/uroki/chNN/narration.ru.json`: `"voice": "ru-RU-SvetlanaNeural"`, `"rate": "-4%"`. Russian, plain and warm, short sentences, never childish. Every number and symbol is said in words (the picture shows the symbols); no digits in the narration. `[[mark]]` goes right before the word an action waits for; beat ids and mark names are ASCII. The voice runs about 1.7 words a second: aim for 6–9 minutes in total with questions (about 15 s per quiz entry + 0.6 s per beat), roughly 450–600 words.
- Voice it from the repo root: `uv run -q --with edge-tts python ~/.claude/skills/papermorph/scripts/tts.py papermorph/content/uroki/chNN/narration.ru.json uroki/chNN/audio/ru` (in the background when long; changing only marks reuses the cached audio). Then read `uroki/chNN/audio/ru/timings.js` for the mark times.
- `uroki/chNN/index.html`: copy ch13's `<head>` exactly (icon, engine.css, `rel=expect`) and its scripts (engine.js, math.js, kletka.js, audio/ru/timings.js); `<html lang="ru">`. `CHAPTER = { number: NN, label: 'N.k', title, minutes, language: 'ru', next }` (next is given to you; the very last topic has none). Beats:
  - `intro` — `klIntro` with the unit line `'Глава N · <chapter title> · Тема N.k'`, the title, one line of purpose spoken at `[[sub]]`, a small `art`.
  - lesson beats — each builds and changes the picture while the voice explains: the change is the argument (things move, split, combine, hop, balance — they are not just redrawn). One new thing at a time, text beside what it names, the same colour = the same meaning (style.json). Vary the compositions; avoid one centred formula after another.
  - 3–4 quick checks `q1…` between lesson beats; the picture they ask about stays in the top 60 % above a `BAND` card (or beside a side card); prefer questions that act on the picture (`pickEls`, `tap`, `pickPoint`) where it fits; a right answer gets an effect (`fx`).
  - the source's common mistake ("trap") shown crossed out (`klStrike`), then the right way.
  - `wrap` — `klWrap` with `[[w1]]…`.
  - `final1…final3` on `SCREEN`, labelled `'Практика по теме · часть k из 3'`; then `finish` (`finishCard`).
  - The `finish` line names the next topic: «Тема «…» пройдена. Дальше — …» (the message gives the wording for the end of a chapter).
- `papermorph/books/uroki/chapters/chNN.md`: the beat table in ch13.md's shape, the decisions, anything you found wrong in the source.

## Lessons learned in the pilot

- `klRow(p, pieces, x, y, t0, opts)` takes the parent first. A mixed number in `M()` is `['2', F('3', '4')]`.
- An answer in a fixed form (a mixed number, an improper fraction, a decimal) gets separate boxes (whole part and fraction; numerator and denominator), like ch13's `q4`. `lowest: true` demands lowest terms and rejects a decimal. Decimals are typed with a comma or a point; both are accepted.
- An opening where nothing moves for 4 s or more reads as a frozen picture: put the subject on the board at once, reveal the rest on the words, and split a long line that is said in parts («17 : 5 =», «3», «(ост. 2)») across marks.
- When pieces move (dealt, grouped, slid), the motion must be true: the count, the size and the place agree with the narration at every moment.
- `pulse()` on a `klRow` or `klMath` group scales about the stage origin, because those groups sit at 0,0: wrap the row in `G(p, {x, y})` first. A colour tween on a `klMath` group throws (the group has no fill): fade in a coloured copy instead.
- The answer box takes numbers only: an answer that is a word, a Roman numeral or an expression is a choice. A side card (`{x: 820, y: 220, w: 700, cls: 'side'}`, as in ch09 `q3`) passes the layout check.
- Shoot the intro at `intro:sub+1`: at `intro:end` it has already faded out. Re-shoot the sheet after your last layout fix.
- `check.py` in Chromium may print one console warning, «Did not find element expected to be parsed from: <link rel=expect href="#bar">»: it comes from the engine's head (approved ch13 has it too) and is not yours to fix.
- math.js `pointRow` draws a decimal point, but this book writes a decimal comma: use ch17's `c17Table` / `c17Col` (comma at a fixed x) instead.
- math.js `numberLine` draws into `S.line`, which is not cleared between beats: set `S.line = G(p)` right before each `numberLine(...)` call so the line leaves with the beat (ch25 `c25Line`). In an answer effect `move` takes the start time before the run function: `move(p, a, b, y, 0, fx)`.
- Finished lessons hold helpers worth copying under your own prefix (list in `chapters.md`, «Кандидаты в общую библиотеку»): read the one you need, not the whole page.

## Check before you report

1. `python3 ~/.claude/skills/papermorph/scripts/lint.py uroki chNN --content papermorph/content/uroki --brief papermorph/books/uroki` → 0 errors.
2. The book is served at `http://localhost:8766/uroki/` (already running; if it is not reachable, run `python3 ~/.claude/skills/papermorph/scripts/serve.py 8770 .` from the repo root in the background and use that port).
3. Storyboard: `mkdir -p papermorph/books/uroki/review/chNN && cd papermorph/books/uroki/review/chNN && uv run -q --with playwright --with pillow --with numpy python ~/.claude/skills/papermorph/scripts/strip.py chNN . BEAT:MARK+1,end … --sheet storyboard --url http://localhost:8766/uroki/` with one or two moments per beat (a real mark of that beat, mark+seconds, seconds, or end). Open the jpg with Read and look at every frame: nothing overlapping, nothing cut off at the 1600 × 900 stage edges, text beside what it names, a question's picture clear of its card. Fix and shoot again until clean.
4. `uv run -q --with playwright --with pillow python ~/.claude/skills/papermorph/scripts/still.py chNN --url http://localhost:8766/uroki/ --min 4`: give a stretch of 4 s or more something meaningful to do on its words, unless the voice is closing a finished picture.
5. `uv run -q --with playwright python ~/.claude/skills/papermorph/scripts/check.py chNN --url http://localhost:8766/uroki/ --browsers chromium,firefox` → 0 page errors, 0 missing files, 0 console errors, no beat overrunning its voice.
6. e2e: copy `papermorph/tools/uroki/e2e_ch13.py` to `papermorph/tools/uroki/e2e_chNN.py`, replace `ch13` with your folder and fill `ANSWERS` (question beat id → one step per quiz entry: `'2'` picks the 2nd choice; `'=a,b'` fills the boxes in order — type decimals with a point there, since the steps split on commas; `'#1;2;2'` answers a grid row by row; `'@3'` clicks the 3rd target ring of a pickEls/tap). Run it in Chromium (`CHROME=/home/mger.karapetyan@rubius.rubius.com/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome uv run -q --with playwright python papermorph/tools/uroki/e2e_chNN.py`) and in Firefox (`BROWSER=firefox uv run -q --with playwright python papermorph/tools/uroki/e2e_chNN.py`): both must print "passed".

## Report back (short)

The beat list, one line each; total voice seconds and `CHAPTER.minutes` (sum of the timings' dur + 15 s per quiz entry + 0.6 s per beat, rounded); the results of checks 1, 5 and 6; anything unresolved; and any helper of yours that other lessons would reuse.
