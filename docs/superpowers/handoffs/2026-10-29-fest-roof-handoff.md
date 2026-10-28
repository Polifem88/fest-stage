# HANDOFF — реализация «Сцены под крышей» (`roof`)

Дата передачи: 29.10.2026. Предыдущая беседа: исследование материалов, интервью с заказчиком (15 вопросов), спецификация и план. **Кода по сцене ещё нет.**

## 0. Что прочитать первым (по порядку)

1. `GEMINI.md` (корень) — правила проекта, обязательны без исключений.
2. `docs/superpowers/specs/2026-10-28-fest-roof-design.md` — **SSOT по размерам и решениям** (стены, конструкция, фермы, 49 приборов, 20 куполов, 6 планировок, слои, виды, экспорт).
3. `docs/superpowers/plans/2026-10-28-fest-roof-venue.md` — план, задачи 0–16 с интерфейсами и тестами.
4. Навыки проекта: `.agents/skills/venue-module-authoring/SKILL.md` (основной), `theatrical-stage-rigging`, `stage-lighting-photometry`, `playwright-webgl-qa`, `mobile-cad-touch-ux`, `multi-persona-review`.
5. Навык исполнения: `superpowers:executing-plans` (`C:\Users\Полифем\.gemini\config\plugins\superpowers\skills\executing-plans\SKILL.md`), а также `test-driven-development`, `verification-before-completion`, `systematic-debugging` по ситуации.
6. Эталон реализации: `app/src/venues/fest-chamber/` (index, config, build, export) и тест `app/tests/unit/chamber.test.js`.

## 1. Режим выполнения (решение заказчика)

- **Native:** все задачи 0–12 и 16 выполняет один агент сам, последовательно, без субагентов.
- **Субагенты разрешены только:** (а) 4 ревьюера по `multi-persona-review` в Task 13–14 (3 × `flash` + художник по свету `pro`); (б) документалист `flash` в Task 15 (отдельно запрошен заказчиком).
- **Точки остановки (ждать заказчика):** после сводки ревью раунда 1 (Task 13 Step 3), раунда 2 (Task 14), после предложений документалиста (Task 15), перед `status: 'ready'` и перед слиянием в `master`/push (Task 16). Push — только после явного «ок» после проверки на локальном сервере.
- Общение с заказчиком — по-русски, кратко.

## 2. Состояние репозитория на момент передачи

- Ветка `master`, последний коммит `ddf38bd`, **33 коммита** (`git rev-list --count HEAD`). Есть ветки `modular`, `subagent-Chamber-Venue-Template-Builder-self-ea61581c` (не трогать).
- Не закоммичены (untracked): `docs/superpowers/specs/…`, `docs/superpowers/plans/…`, этот handoff. Task 0: создать ветку `roof`, закоммитить их первым коммитом (это будет коммит №34).
- Правило бэкапа: после каждого коммита, если `git rev-list --count HEAD` делится на 10 (ближайшие — №40, №50) → `powershell -ExecutionPolicy Bypass -File app/scripts/backup.ps1` и проверить «VERIFIED (100% MATCH)» для зеркала и снимка + ZIP. Плюс обязательный бэкап `-Force` по завершении (Task 16).
- **Бэкап «до» уже сделан:** `C:\Backups\fest-3dmodels-and-stages_2026-10-28_18-57-47` (+ `.zip`), коммит №33, 3520 файлов, 100% совпадение. Повторять не нужно.
- Сборка сейчас: `desktop.html` ≈ 858 КБ, `mobile.html` ≈ 856 КБ, `index.html` ≈ 22 КБ (бюджет 1,3 МБ / 0,1 МБ).
- Окружение: Windows, PowerShell; `npm.cmd`/`npx.cmd`; Python 3.12 + Pillow есть (удобно для кропов схемы). Каждая команда — новая сессия: всегда `cd app;` в начале.

## 3. Ключевые решения интервью (кратко; детали — в spec)

| Тема | Решение |
|---|---|
| Координаты | d = 0 — передний край ряда 1 «Стандарта» = поперечная линия ферм с №1–7; +d к стене 13; X = 0 — середина рядов; +X к стенам 2–3–4; Y = 0 — пол |
| Подгонка стен | ширина 14,60 (стена 9 = 6,35), глубина 17,40 (стена 6 = 4,50), `assumption: true` |
| Зал | вариант A: готовые планировки + «рядов» и «сдвиг» (шаг 0,5 м). 6 планировок: std, empty, cross, crossRev, traverse, arena. В «Пустом зале» пультов нет |
| Инвентарь | ≤ 20 станков 2×1 (высоты 0,2/0,4/0,6/0,8), 2 пультовых, ≤ 90 стульев; лестниц нет; вход с края рядов со стороны стен 2–3–4 |
| Пульты (std) | у стены 10: свет — подиум 0,4 вровень с рядами 2–3; звук — подиум 0,8 вровень с рядами 4–5 |
| Профили | верхний «14» на схеме = №13; Q400 RGBALC = №8 и №10 (допущение) |
| ComPC-500 | значки без номера = 104 и 108 |
| Дежурный свет | 20 куполов по центрам ячеек (от «жёлтой» фермы до стены 13, от стен 10–12 до колонн), одна кнопка «Дежурный»; `houseLight: false` |
| LedPar | «Подсв 109» — единственный Involight LedPar 933 (новый тип в конец справочника); 72/32/33 — не приборы |
| V-косынки | только 2 пары, только в плоскостях вдоль d между колоннами d −2,65 и −9,15; поперёк ничего. Схема: `data/roof/Схема V-образных косынок между колоннами.jpg` (узел 2,5 м высоты, 1 м от грани колонны) |
| Стойки ферм | три: (7,35; 5,0), (−5,0; −7,5), у стены 13 — центр x −3,05 (1 м от проёма) |
| Слои | hall, walls, ceiling, trusses, lights, molton (порядок фиксирован) |
| Доп. оборудование | не моделируется, `portable: false`; текстом в панели «Свет» (`texts.extraEquipment`) |
| Коридор | тёмный тупик 2 м за проёмом 2,25 |
| Дверь в стене 6 | в техпомещение (не моделируется); в склад ходят через мольтон |

## 4. Карта кода, которую уже разведали (экономит время)

- **Контракт:** `app/src/venues/contract.js` — `CAPS = ['rigging','counterweights','portable','duty','houseLight']` (стр. 48); `validateVenue` проверяет слои, виды, механику, приборы (тип, паспорт, группа, наборы, floor.trace/zone/clip, hangs/poolK), lightPlans, exports.
- **Ссылка:** `app/src/engine/state.js` — `encodeState(st, venue)` строит `{v:2, vn, h, fx, fn, f, l, ln, view, p?, hd?}`; `decodeState` возвращает `{venue, heights, fixturesOn, flags, layers, portable, view}`. Сюда добавляется `lo`.
- **Движок:** `app/src/engine/stage.js`
  - `_loadVenue` (≈138–182): память `_memory`, свои duty/house у площадки, событие `venue`, затем `_restore(mem)`;
  - `_buildVenue` (≈202–265): `StaticBatch`, `commitBatch`, `add(layer, …objs)`, `venue.build(ctx)`, `FixtureSystem`, `LightingSystem`, overlays, `_applyFlags/_applyLayers`, `setView(defaultView)`;
  - `_teardownVenue` (≈268) — `disposeTree(g, sharedSet(...))`;
  - `_applyBlueprint` (≈540–600) — обход мешей, `userData.matOrig`, `userData.static`, edges; вынести в `_bpApply(root, on)` для новых мешей зала;
  - `getState` (855), `loadState` (875), `openState` (890), экспорт `exportPlanDXF/SectionDXF/3DDXF/GLB` (922–944; без `venue.exports.glb` — `buildSceneGLB`).
- **Тест-API:** `app/src/engine/testapi.js` (`window.__fest`: venue, loadVenue, setView, setCamera, light, flag, layer, getState, stats, export*, fps, project). Добавить `layout()`, `setLayout()`.
- **Свет:** `app/src/systems/fixtures.js` — `FixtureSystem` (`updateAll`, `updateBar`, `setOn`, `setMany`, `setHaze*`, `setPools`), `rectFloor`. Пол площадки — `{trace, zone, clip}`; образец сложного пола — `fest-chamber/build/floor.js` (`clipPoolsToFloor`, ключ кэша шейдера).
- **UI:** `app/src/ui/common.js` — `rigPanel`, `lightPanel` (стр. 101; duty/house по `caps`), `layersPanel`, `exportButtons`, `viewsPanel`, `quickBar` (411–413), `h()`, `toggle()`; вкладки — `desktop.js:105`, `mobile.js:82` (по `caps.rigging`). Подписки — внутри `stage.scope()`.
- **Справочник:** `app/src/library/fixtureTypes.js` — уже есть `FRESNEL100, PROF100_CW, PROF_RGB, P7X40, BEYE640, RAVEN150, COMPC500`; добавить `LEDPAR933` **последним**. Паспорта — `library/specs.js`.
- **Материалы:** `app/src/core/materials.js` — `canvasTex`, `brickTex(base, mortar)`, `boardsTex`, `tilesTex`; есть `floor`, `blackWall`, `steel`, `truss`, `seatFabric` (0xc4602a — оранжевый), `seatFrame`, `fixtureBody`, `dutyBulb`. Кирпичи в проекте сейчас только тёмные → нужен `brickRed`.
- **Геометрия:** `app/src/core/geom.js` — `box, rect, wallWithHoles, cylBetween, P, prism, worldUV, StaticBatch`.
- **Каталог:** `app/src/venues/catalog.js` (roof сейчас `status: 'soon'` без type/seats), `registry.js` (LOADERS).
- **Тесты, которые сломаются/надо править:**
  - `tests/e2e/venues.spec.js:33–36` — проверяет, что `roof` «скоро» и не открывается → перевести на `foyer`;
  - `tests/e2e/shots.spec.js:117` ждёт 5 карточек (останется 5), `:130` `OTHER_VENUES = ['chamber']` → добавить `roof`;
  - `tests/e2e/perf.spec.js:44` `otherCases` → добавить `roof:overview`, `roof:plan`;
  - `tests/unit/export.test.js:187+` — блок Камерной как образец блока roof;
  - `tests/unit/boundaries.test.js` — запрещает id/названия площадок в общем коде.
- **Паритет:** `app/scripts/parity.mjs capture|compare` (эталон в `app/review/modular/baseline`, игнорируется git).
- **Снимки:** `$env:VENUE='roof'; npm.cmd run shots` → `app/review/shots/<раунд>/<проект>/roof/`.
- **Отчёты ревью:** класть в `app/review/roof-r1/`, `app/review/roof-r2/` (jpg/png/json там игнорируются git, md — коммитятся).

## 5. Исходные материалы (`data/roof/`, вне git)

- `Информация о стенах на чертеже.txt`, `Информация о потолке и фермах.txt`, `Информация о зрительном зале.txt`, `Световое оборудование/Описание светового оборудования.txt`.
- `Условный чертёж сцены под крышей.jpg` — верен по стенам. `Световое оборудование/Схема развеса …jpg` — верна по свету и фермам (стены не совпадают; повёрнута: стены 2–3–4 снизу). Увеличенные кропы схемы: `C:\Users\Полифем\.gemini\antigravity\brain\e5fa3f33-ce72-4a7f-b707-44688e574e62\scratch\q1..q4.png, legend.png` (скрипт `crop.py` там же).
- `Схема V-образных косынок между колоннами.jpg`.
- `Фото/` — 16 снимков. Главные для сверки: «Общий вид на сцену от стен 2-3-4», «Вид на потолок, I-образные колонны, и на стены 2 и 3», «Капитальные балки…», «Венткороб (стена 11)», «Венткороб (стена 9)», «Угол между 13 и 14», «Текстура кирпич».

## 6. Подводные камни

- Номера приборов в схеме несквозные (1–29, 50–62, 101–109) — порядок `FIXTURES` в конфиге фиксирует формат ссылки с первой публикации.
- Капитальные балки, диагонали и замурованные колонны продолжаются за стенами — обрезать по контуру помещения (`clipSegmentToRects`), иначе торчат наружу на «общем виде» и в GLB.
- Смена планировки = замена мешей: обязательно освобождать старую группу (тест утечек), применять чертёж к новой, пересчитывать пятна (пол знает текущую планировку через `floor.setLayout`).
- `matOn` у светящихся мешей запоминается при сборке: купола — прямые потомки `groups.duty`.
- Уникальный `customProgramCacheKey = () => 'pool-roof'`, иначе пятна обрежутся по контуру Камерной.
- Не вписывать `roof`/размеры сцены в `engine/ ui/ systems/ core/ library/ export/`.
- Вотчер Vite: `dist/`, `review/`, `test-results/` исключены — не ломать (EBUSY).

## 7. Определение готовности

`cd app; npm.cmd run check` — зелёный; паритет Большой и Камерной 100%; снимки roof просмотрены глазами; DXF/GLB открываются; ревью 2 раунда закрыты; документация обновлена по одобренным предложениям; бэкап «после» проверен; заказчик принял на локальном сервере → merge в `master` и push.
