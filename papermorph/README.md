# Уроки у доски: рабочие файлы

Второй вариант уроков «Математики в клеточку» в стиле [Papermorph](https://github.com/DozenTwelve/Papermorph): каждая тема — анимированный урок с озвучкой, проверками прямо в кадре и практикой. Готовая книга лежит в [`uroki/`](../uroki/) и открывается по адресу `/uroki/` рядом со справочником. Справочник (корень репозитория) не изменён.

Эта папка — исходники, из которых книга собирается скиллом Papermorph. Сайту она не нужна.

| Путь | Что в нём |
|---|---|
| `books/uroki/style.json` | принятые решения: вид, цвета смыслов, голос, общие элементы |
| `books/uroki/chapters.md` | карта глав и их статус |
| `books/uroki/chapters/chNN.md` | раскадровка урока: шаги, метки, что движется |
| `books/uroki/voices/` | пробы двух русских голосов Edge (Светлана — выбран, Дмитрий) |
| `content/uroki/chNN/narration.ru.json` | дикторский текст урока с метками `[[метка]]` |
| `content/uroki/chNN/narration.ru.timings.json` | кэш озвучки: время каждого слова, чтобы правка меток не требовала новой записи |
| `tools/uroki/e2e_chNN.py` | интерактивный тест урока (воспроизведение, перемотка, карточки, все ответы, итог) |

## Как устроена книга

- Раздел книги — глава справочника, глава книги (папка `uroki/chNN`) — тема справочника. `NN` — сквозной номер темы в курсе: тема 3.1 — 13-я по счёту, поэтому `ch13`. На экране показывается номер темы (`CHAPTER.label`).
- `uroki/lib/engine.*`, `math.js`, `contents.*`, `units.*`, `volume.*` — копия движка Papermorph (engine-v2.12). Руками не правится, обновляется скриптом `engine.py`.
- `uroki/lib/book.css` — оформление книги: зелёная доска движка в бледную клетку.
- `uroki/lib/kletka.js` — общие элементы уроков: полоски, круги-«пиццы», числовой луч, дроби с цветными числителем и знаменателем, титульная карточка, итоги.

## Команды

Скилл: `~/.claude/skills/papermorph` (дальше `SKILL`). Нужны `uv`, `ffmpeg`, сеть для голоса Edge и браузеры Playwright (`uv run --with playwright playwright install chromium firefox`).

Предпросмотр (из корня репозитория; без кэша браузера):

```bash
python3 ~/.claude/skills/papermorph/scripts/serve.py 8766 .
```

Книга: http://localhost:8766/uroki/, справочник: http://localhost:8766/.

Озвучить урок после правки текста (меняются только изменённые шаги; перенос метки не требует новой записи):

```bash
uv run --with edge-tts python ~/.claude/skills/papermorph/scripts/tts.py papermorph/content/uroki/ch13/narration.ru.json uroki/ch13/audio/ru
```

Проверки:

```bash
python3 ~/.claude/skills/papermorph/scripts/lint.py uroki --content papermorph/content/uroki --brief papermorph/books/uroki
```

```bash
uv run --with playwright python ~/.claude/skills/papermorph/scripts/check.py ch13 ch14 ch15 ch16 --url http://localhost:8766/uroki/ --browsers chromium,firefox
```

```bash
URL=http://localhost:8766/uroki/ch13/ uv run --with playwright python papermorph/tools/uroki/e2e_ch13.py
```

Кадры урока одним листом (раскадровка):

```bash
uv run --with playwright --with pillow --with numpy python ~/.claude/skills/papermorph/scripts/strip.py ch13 /tmp/ch13 whole:end divide:end --sheet storyboard --url http://localhost:8766/uroki/
```

Видео урока (MP4 с субтитрами, вопросы пропускаются):

```bash
uv run --with playwright --with numpy python ~/.claude/skills/papermorph/scripts/export.py ch13 --url http://localhost:8766/uroki/ --out /tmp/video
```

## Новая тема

1. Дикторский текст в `content/uroki/chNN/narration.ru.json` (числа словами, метка `[[имя]]` перед словом, на котором что-то происходит), озвучка `tts.py`.
2. Страница `uroki/chNN/index.html` по образцу `ch13`: шаги `[id, заголовок, (m, D) => { … }, { ask }?]`, время действий — `m('метка')`.
3. Карточка в `Contents.book` в `uroki/index.html`, `CHAPTER.next` у предыдущей темы, строка в `chapters.md`.
4. `lint.py`, `check.py`, раскадровка `strip.py`, тест `e2e`.
