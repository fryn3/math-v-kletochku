# Уроки у доски: рабочие файлы

Второй вариант уроков «Математики в клеточку» в стиле [Papermorph](https://github.com/DozenTwelve/Papermorph): каждая тема — анимированный урок с озвучкой, проверками прямо в кадре и практикой. Готовая книга лежит в [`uroki/`](../uroki/) и открывается по адресу `/uroki/` рядом со справочником. Справочник (корень репозитория) не изменён.

Книга собрана целиком: 40 тем в 9 главах, как в справочнике (папки `ch01`–`ch40`), около пяти часов уроков. Глава 3 «Обыкновенные дроби» — пилот, его автор одобрил; остальные темы сделаны по его образцу и ждут просмотра автором. Статус каждой темы — в `books/uroki/chapters.md`.

Эта папка — исходники, из которых книга собирается скиллом Papermorph. Сайту она не нужна.

| Путь | Что в нём |
|---|---|
| `books/uroki/style.json` | принятые решения: вид, цвета смыслов, голос, общие элементы |
| `books/uroki/chapters.md` | карта глав, статусы тем, помощники уроков, которые стоит перенести в общую библиотеку |
| `books/uroki/worker-brief.md` | задание помощнику на одну тему: что прочитать, что сделать, какие проверки пройти |
| `books/uroki/chapters/chNN.md` | раскадровка урока: шаги, метки, что движется, принятые решения |
| `books/uroki/review/chNN/` | листы кадров `storyboard.jpg` (собирает `strip.py`; в git не входят) |
| `books/uroki/voices/` | пробы двух русских голосов Edge (Светлана — выбран, Дмитрий) |
| `content/uroki/chNN/narration.ru.json` | дикторский текст урока с метками `[[метка]]` |
| `content/uroki/chNN/narration.ru.timings.json` | кэш озвучки: время каждого слова, чтобы правка меток не требовала новой записи |
| `content/uroki/chNN/narration.ru.stress.json` | ударения в омографах: куски текста шага со знаком ударения; эти шаги озвучивает Azure |
| `content/uroki/chNN/narration.ru.azure.json` | какие шаги озвучены через Azure: хэши SSML и mp3 (пишет `azure_tts.py`) |
| `content/uroki/ipa.ru.json` | формы слов с ударением в фонемах Azure (IPA, набор ru-RU) |
| `tools/uroki/azure_tts.py` | озвучка шагов с заданным ударением через Azure Speech тем же голосом |
| `tools/uroki/e2e_chNN.py` | интерактивный тест урока (воспроизведение, перемотка, карточки, все ответы, итог) |

## Как устроена книга

- Раздел книги — глава справочника, глава книги (папка `uroki/chNN`) — тема справочника. `NN` — сквозной номер темы в курсе: тема 3.1 — 13-я по счёту, поэтому `ch13`. На экране показывается номер темы (`CHAPTER.label`).
- Оглавление `uroki/index.html` строится из списка `COURSE`: глава, её цвет, первая папка и темы с минутами. Глава появляется в оглавлении, когда у всех её тем стоят минуты.
- `uroki/lib/engine.*`, `math.js`, `contents.*`, `units.*`, `volume.*` — копия движка Papermorph (engine-v2.12). Руками не правится, обновляется скриптом `engine.py`.
- `uroki/lib/book.css` — оформление книги: зелёная доска движка в бледную клетку.
- `uroki/lib/kletka.js` — общие элементы уроков: полоски, круги-«пиццы», числовой луч, дроби с цветными числителем и знаменателем, титульная карточка, итоги. Свои элементы урок держит у себя под префиксом `cNN` (`c34Plane`); те, что пригодятся другим урокам, перечислены в `chapters.md`.
- Финальная реплика каждой темы начинается одинаково: «Отлично! Тема «…» пройдена…» и называет следующую тему.

## Команды

Скилл: `~/.claude/skills/papermorph` (дальше `SKILL`). Нужны `uv`, `ffmpeg`, сеть для голоса Edge и Azure Speech (ключ — в разделе «Ударение в озвучке») и браузеры Playwright (`uv run --with playwright playwright install chromium firefox`).

Предпросмотр (из корня репозитория; без кэша браузера):

```bash
python3 ~/.claude/skills/papermorph/scripts/serve.py 8766 .
```

Книга: http://localhost:8766/uroki/, справочник: http://localhost:8766/.

Озвучить урок после правки текста (меняются только изменённые шаги; перенос метки не требует новой записи):

```bash
uv run --with edge-tts python ~/.claude/skills/papermorph/scripts/tts.py papermorph/content/uroki/ch13/narration.ru.json uroki/ch13/audio/ru
```

Сразу после него — шаги с заданным ударением (раздел «Ударение в озвучке» ниже):

```bash
uv run --with azure-cognitiveservices-speech python papermorph/tools/uroki/azure_tts.py papermorph/content/uroki/ch13/narration.ru.json uroki/ch13/audio/ru
```

Проверки всей книги (для одной темы — её папка вместо списка):

```bash
python3 ~/.claude/skills/papermorph/scripts/lint.py uroki --content papermorph/content/uroki --brief papermorph/books/uroki
```

```bash
uv run --with playwright python ~/.claude/skills/papermorph/scripts/check.py $(cd uroki && ls -d ch[0-9]*) --url http://localhost:8766/uroki/ --browsers chromium,firefox
```

В Chromium `check.py` может вывести одно предупреждение «Did not find element … rel=expect href="#bar"»: оно из заголовка движка, а не из уроков.

Тесты уроков в Chromium и в Firefox (каждый печатает «… passed»; если Chromium из Playwright не запускается, укажите установленный браузер в `CHROME`):

```bash
for f in papermorph/tools/uroki/e2e_ch*.py; do uv run -q --with playwright python "$f" || echo "FAILED $f"; done
```

```bash
for f in papermorph/tools/uroki/e2e_ch*.py; do BROWSER=firefox uv run -q --with playwright python "$f" || echo "FAILED $f"; done
```

Кадры урока одним листом (раскадровка):

```bash
uv run --with playwright --with pillow --with numpy python ~/.claude/skills/papermorph/scripts/strip.py ch13 /tmp/ch13 whole:end divide:end --sheet storyboard --url http://localhost:8766/uroki/
```

Видео урока (MP4 с субтитрами, вопросы пропускаются):

```bash
uv run --with playwright --with numpy python ~/.claude/skills/papermorph/scripts/export.py ch13 --url http://localhost:8766/uroki/ --out /tmp/video
```

## Ударение в озвучке

Голос Edge (`tts.py`) сам выбирает ударение в словах, которые пишутся одинаково, и иногда ошибается: «Сравни числа» звучит как «числа́». В Edge это не исправить: знак ударения U+0301 и другие знаки, SSML (сервис отклоняет любые теги) и латинские буквы-двойники звук не меняют. Поэтому шаги с такими словами переозвучивает Azure Speech тем же голосом и с той же скоростью (ru-RU-SvetlanaNeural, −4 %): слово с заданным ударением уходит в SSML как `<phoneme alphabet="ipa">`. Текст урока и субтитры остаются без знаков.

- `content/uroki/chNN/narration.ru.stress.json` — `{"шаг": ["кусок текста", …]}`. Кусок — часть произносимого текста шага (без меток `[[…]]`) со знаком U+0301 после ударной гласной каждого слова, которое нужно задать: `"Сравни чи́сла."`, `"два числа́?"`. Без знаков кусок должен встречаться в шаге ровно один раз; если нет — добавьте соседнее слово.
- `content/uroki/ipa.ru.json` — каждая форма со знаком (строчными буквами) и её запись в IPA: `"чи́сла": "ˈt͡ɕislə"`. Только символы набора ru-RU из таблицы Azure (learn.microsoft.com, статья «SSML phonetic alphabets», `speech-ssml-phonetic-sets`): гласные a ʌ ə ɛ i ɪ ɨ ɔ u, мягкость ʲ, t͡s t͡ɕ ɕː ʂ ʐ j и остальные согласные таблицы; ударение ˈ (U+02C8) — перед ударным слогом. Если формы нет, скрипт остановится и назовёт её.
- Ключ Azure (бесплатный уровень F0, регион eastus) лежит в `~/.config/papermorph/azure-speech.env` строками `AZURE_SPEECH_KEY=…` и `AZURE_SPEECH_REGION=eastus` (можно и переменными окружения с теми же именами). В репозиторий он не входит, скрипт его не печатает. Бесплатного уровня хватает с запасом: все шаги с ударениями — около 43 тысяч знаков.

Порядок всегда такой: сначала `tts.py`, затем `azure_tts.py` (команды — в разделе «Команды»). `azure_tts.py` озвучивает только шаги из stress-файла и пишет то же, что `tts.py`: mp3, время слов в кэш `narration.ru.timings.json` с тем же ключом кэша (поэтому `tts.py` эти шаги не трогает) и `timings.js`; что озвучено — в `narration.ru.azure.json`. Шаг озвучивается заново, когда меняется его SSML (текст, куски, IPA, голос, скорость). Если поменялся текст шага, `tts.py` сначала озвучит его голосом Edge, а `azure_tts.py` после него — снова через Azure; запущенный раньше `tts.py`, он остановится и скажет об этом.

`--dry` печатает SSML шагов и ничего не отправляет. Пробная фраза с временем слов:

```bash
uv run --with azure-cognitiveservices-speech python papermorph/tools/uroki/azure_tts.py --say "Сравни чи́сла." /tmp/proba.mp3
```

Ударение задано во всех местах с такими словами (221 место в 39 темах), даже там, где Edge читал верно: числа, часа, стороны, места, цены, длины, кружки, воды, руки, шкалы, голоса, слова, острова, поезда, реки, ребра, трубы, сорока, а после «два, три, четыре» — ряда, шага, шара. В новом тексте ищите прежде всего их. Счётная форма — «два часа́», «три шага́», «две стороны́»; после дроби и слов «часть», «половина» — «ча́са».

## Новая тема или переделка

1. Дикторский текст в `content/uroki/chNN/narration.ru.json` (числа словами, метка `[[имя]]` перед словом, на котором что-то происходит), озвучка `tts.py`; омографы — куски в `narration.ru.stress.json`, новые формы в `ipa.ru.json`, затем `azure_tts.py`.
2. Страница `uroki/chNN/index.html` по образцу `ch13`: шаги `[id, заголовок, (m, D) => { … }, { ask }?]`, время действий — `m('метка')`.
3. Минуты в `COURSE` в `uroki/index.html`, `CHAPTER.next` у предыдущей темы, строка в `chapters.md`.
4. `lint.py`, `check.py`, раскадровка `strip.py`, тест `e2e`.

Темы делались так: по одному помощнику на тему по заданию `books/uroki/worker-brief.md`; координатор смотрел лист кадров каждой темы, возвращал на доработку то, что читалось неверно, и регистрировал главу целиком.
