# Сцена под крышей (`roof`) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (выбрано заказчиком: **Native** — все задачи выполняет один агент сам, без субагентов; субагенты только для ревью мультиперсонами в Task 13–14 и для документалиста в Task 15). Steps use checkbox (`- [ ]`) syntax for tracking. Передача контекста — `docs/superpowers/handoffs/2026-10-29-fest-roof-handoff.md`.

**Goal:** Добавить в каталог готовую 3D-модель «Сцены под крышей» с трансформируемым залом (6 планировок), 49 приборами, 20 дежурными куполами, сложным потолком (колонны, капитальные фермы, диагонали, V-косынки, швеллеры, настил), сеткой ферм 30×30 и экспортом DXF/GLB.

**Architecture:** Модуль площадки `app/src/venues/fest-roof/` по образцу `fest-chamber` (config → build → export). Трансформируемый зал — новая **общая** возможность движка `caps.layouts`: площадка описывает планировки и строит группу зала по состоянию `{ id, rows, shift }`. Движок хранит состояние, подменяет группу в слое `hall`, пересчитывает пятна света, пишет `lo` в ссылку. Вкладка «Зал» есть на компьютере и телефоне.

**Tech Stack:** Three.js 0.170, Vite 5 + vite-plugin-singlefile, Vitest 2, Playwright 1.48, PowerShell (Windows: `npm.cmd`, `npx.cmd`).

**Spec:** `docs/superpowers/specs/2026-10-28-fest-roof-design.md` — все размеры, таблица приборов, таблица планировок. Числа в этом плане взяты оттуда. При расхождении прав spec.

## Global Constraints

- Правила проекта `GEMINI.md` обязательны. Навыки: `venue-module-authoring` (основной), `theatrical-stage-rigging`, `stage-lighting-photometry`, `playwright-webgl-qa`, `mobile-cad-touch-ux`, `multi-persona-review`.
- Все размеры площадки — только в `app/src/venues/fest-roof/config/*.js`. В построителях нет «магических чисел», кроме именованных визуальных констант в начале файла. Неизмеренное помечается `assumption: true`.
- Общий код (`engine/ ui/ systems/ core/ library/ export/`) не содержит `roof`, «под крышей» и размеров сцены (`boundaries.test.js`).
- Порядок `layers`, `fixtures.list` и `layouts.list` — часть формата ссылки, только добавлять в конец. Ссылки всех прежних версий открываются как раньше.
- Бюджет: `desktop.html` / `mobile.html` ≤ 1,3 МБ (сейчас ≈ 0,86), `index.html` ≤ 0,1 МБ. Никаких CDN, картинок-текстур и шрифтов: только процедурные canvas-текстуры.
- Тач-элементы ≥ 44 × 44 px. Кнопки планировок и степперы — тоже.
- Для нестандартного пола пятен — уникальный `mat.customProgramCacheKey = () => 'pool-roof'`.
- Светящиеся меши куполов — прямые потомки `groups.duty` с `userData.emitter = 'duty'`.
- Ветка `roof`. Коммит после каждой задачи. Если после коммита `git rev-list --count HEAD` делится на 10 — сразу `powershell -ExecutionPolicy Bypass -File app/scripts/backup.ps1` (без `-Force`, сработает само) и проверить отчёт «100% MATCH».
- Определение готовности: `npm.cmd run check` из `app/`.

## Review Focus

1. **Старые ссылки** (v1 `#s=…`, v2 Большой и Камерной без `lo`) открываются как раньше. Ссылка `#v=roof` без `lo` даёт «Стандарт», все ряды, сдвиг 0. Тесты — Task 1 (unit) и Task 10 (e2e).
2. **Утечки при смене планировки:** 10 циклов `std → traverse → empty → arena` не растят `renderer.info.memory.geometries/textures`. Тест — Task 10.
3. **Память по площадкам:** планировка «Траверс» на Сцене под крышей, переход на Камерную и обратно — «Траверс» на месте. Флаги (чертёж, дымка) переносятся. Тест — Task 10.
4. **Чертёж + смена планировки:** при включённом режиме «чертёж» новые меши зала сразу получают материалы чертежа (нет «цветных» стульев). Тест — Task 10 (пиксельная проверка или `matOrig` у мешей зала).
5. **Пятна света после смены планировки** ложатся на новые станки. На пустом полу пятно уходит на Y = 0. Обрезка Камерной не меняется (ключ кэша шейдера). Тесты — Task 9 (unit trace) и Task 10 (снимки обеих площадок).

---

## Карта файлов

**Общий код (изменить):**
- `app/src/venues/contract.js` — `caps.layouts`, проверка `layouts`.
- `app/src/engine/state.js` — поле `lo`.
- `app/src/engine/stage.js` — состояние планировки, `setLayout`, память, подмена группы зала.
- `app/src/engine/testapi.js` — `layout()`, `setLayout()`.
- `app/src/ui/common.js`, `ui/desktop.js`, `ui/mobile.js`, `ui/style.css` — вкладка «Зал», текст доп. оборудования.
- `app/src/library/fixtureTypes.js`, `library/specs.js` — тип `LEDPAR933` (в конец).
- `app/src/core/materials.js` — `brickRed`, `deckRibbed`, `aluDeck`, `molton`, `floorBlack` (если `floor` не чёрный).
- `app/src/core/geom.js` — `clipSegmentToRects`.
- `app/src/venues/fest-big/index.js`, `fest-chamber/index.js` — `caps.layouts: false`, `layouts: null`.
- `app/src/venues/catalog.js`, `registry.js` — Сцена под крышей.

**Площадка (создать):** `app/src/venues/fest-roof/`
- `config/dimensions.js` — стены, двери, колонны, балки, косынки, швеллеры, фермы, стойки, купола, мольтон, преграды.
- `config/layouts.js` — 6 планировок, раскладка станков и мест, пределы сдвига.
- `config/fixtures.js` — 49 приборов, группы, наборы.
- `build/architecture.js` — пол, стены, потолок, конструкция.
- `build/trusses.js` — фермы 30×30 и стойки.
- `build/hall.js` — станки, стулья (InstancedMesh), пульты по состоянию планировки.
- `build/emitters.js` — купола дежурного света.
- `build/floor.js` — trace/zone/clip пятен с учётом станков.
- `build/overlays.js`, `build/ambient.js`.
- `export/dxf2d.js`, `export/export3d.js`.
- `index.js`.

**Тесты:** `app/tests/unit/roof.test.js` (новый), `state.test.js`, `venues.contract.test.js`, `export.test.js`, `boundaries.test.js` (при необходимости), `tests/e2e/venues.spec.js`, `shots.spec.js`, `perf.spec.js`.

---

### Task 0: Ветка и эталон паритета

**Files:** нет изменений кода.

- [x] **Step 1:** `git checkout -b roof` (от `master`, рабочее дерево чистое; spec и план закоммитить первым коммитом ветки: `docs: спецификация и план Сцены под крышей`).
- [x] **Step 2:** Собрать и снять эталон для неизменности Большой и Камерной: `cd app; npm.cmd run build; node scripts/parity.mjs capture`. Ожидается: отчёт о снятом эталоне без ошибок.

---

### Task 1: Контракт и ссылка — возможность `layouts`

**Files:**
- Modify: `app/src/venues/contract.js`, `app/src/engine/state.js`, `app/src/venues/fest-big/index.js`, `app/src/venues/fest-chamber/index.js`
- Test: `app/tests/unit/state.test.js`, `app/tests/unit/venues.contract.test.js`

**Interfaces:**
- Produces (контракт площадки):
  ```js
  caps.layouts: boolean
  layouts: null | {
    list: Array<{ id: string, name: string, rowsMax: number }>,   // порядок = формат ссылки
    default: string,                                              // id планировки по умолчанию
    shiftStep: number,                                            // м, у roof = 0.5
    range(id: string, rows: number): [number, number],            // допустимые шаги сдвига [min, max], всегда содержит 0
    seats(st: LayoutState): number,
    build(st: LayoutState, ctx: { M, profile }): THREE.Object3D,  // группа слоя 'hall'
  }
  // LayoutState = { id: string, rows: number, shift: number /* в шагах */ }
  ```
- Produces (state.js): в `encodeState(st, venue)` при `venue.layouts` пишется `lo: [index, rows, shift]`. `decodeState` возвращает `layout: LayoutState`. Без `lo` — `{ id: default, rows: rowsMax, shift: 0 }`. Для площадок без `layouts` — `layout: null`.

- [x] **Step 1: Падающие тесты** в `state.test.js`. Фиктивная площадка `fake` с `layouts.list = [{id:'a',rowsMax:5},{id:'b',rowsMax:3}]`, `default:'a'`:
  ```js
  it('ссылка хранит планировку lo', () => {
    const s = encodeState({ ...base, layout: { id: 'b', rows: 2, shift: -3 } }, fake);
    expect(decodeState(s, fake).layout).toEqual({ id: 'b', rows: 2, shift: -3 });
  });
  it('ссылка без lo — планировка по умолчанию', () => {
    const s = encodeState({ ...base, layout: undefined }, fake);
    expect(decodeState(s, fake).layout).toEqual({ id: 'a', rows: 5, shift: 0 });
  });
  it('площадка без layouts — layout null, lo не пишется', () => { /* big: JSON без ключа lo */ });
  it('неизвестный индекс lo → по умолчанию; rows зажимается в [min(1, rowsMax), rowsMax] (у планировки без рядов rowsMax = 0 → rows 0)', () => { /* lo:[9,99,0] */ });
  ```
  Существующие тесты v1/v2 не трогать: они обязаны пройти без изменений.
  В `venues.contract.test.js` добавить: `validateVenue` даёт ошибку, если `caps.layouts !== !!layouts`, если `default` не в `list`, если повторяются id, если нет `build`/`range`/`seats`.
- [x] **Step 2:** `npx.cmd vitest run tests/unit/state.test.js tests/unit/venues.contract.test.js`. Ожидается: новые тесты FAIL.
- [x] **Step 3:** В `contract.js` добавить `'layouts'` в `CAPS` и проверки выше. В `fest-big` и `fest-chamber` добавить `caps.layouts: false` и `layouts: null`. В `state.js` — `lo` (кодирование и разбор с зажимом значений).
- [x] **Step 4:** `npx.cmd vitest run`. Ожидается: всё PASS.
- [x] **Step 5:** Коммит: `Движок: возможность трансформируемого зала (caps.layouts, поле ссылки lo)`.

---

### Task 2: Движок — состояние планировки

**Files:**
- Modify: `app/src/engine/stage.js`, `app/src/engine/testapi.js`

**Interfaces:**
- Consumes: контракт `layouts` (Task 1).
- Produces:
  - `stage.layout: LayoutState | null`;
  - `stage.setLayout(partial: Partial<LayoutState>): void` — нормализует (id из списка, rows в 1..rowsMax, shift в `range(id, rows)`), строит `venue.layouts.build(st, { M, profile })`, удаляет прежнюю группу из `layerGroups.hall` через `disposeTree(old, sharedSet(...))`, добавляет новую. Если `_bpOn` — применяет чертёж к новой группе (вынести обход мешей из `_applyBlueprint` в `_bpApply(root, on)`). Затем `fixtures.updateAll()`, `lighting.placeGroupLights()`, `_shadowsDirty = true`, `emit('layout', st)`.
  - `getState()` включает `layout`; `loadState()` применяет `st.layout` через `setLayout`; `_buildVenue` вызывает `setLayout(default)`, если `venue.layouts`.
  - Площадка читает текущую планировку через `stage.layout` (экспорт) и через объект пола (Task 9: `venue.fixtures.floor.setLayout(st)` вызывается движком **до** `updateAll()`, если такой метод есть).
  - `window.__fest.layout()` → `stage.layout`; `window.__fest.setLayout(p)`.

- [x] **Step 1:** Реализовать по интерфейсу. Для площадок без `layouts` всё работает как прежде (`stage.layout = null`).
- [x] **Step 2:** `npx.cmd vitest run`. Ожидается PASS.
- [x] **Step 3:** Паритет: `npm.cmd run build; node scripts/parity.mjs compare`. Ожидается: DXF/GLB побайтово, состояние и снимки Большой и Камерной — 100%.
- [x] **Step 4:** Коммит: `Движок: setLayout — подмена группы зала, память площадки, чертёж, пересчёт пятен`.

---

### Task 3: Интерфейс — вкладка «Зал» и текст доп. оборудования

**Files:**
- Modify: `app/src/ui/common.js`, `app/src/ui/desktop.js`, `app/src/ui/mobile.js`, `app/src/ui/style.css`, `app/src/venues/contract.js` (тип `texts.extraEquipment?: string` в JSDoc)

**Interfaces:**
- Produces: `layoutPanel(stage, { compact?: boolean }): HTMLElement` в `ui/common.js`:
  - кнопки планировок: `button.layout-btn[data-layout="<id>"]` с подписью `name` и числом мест (`seatsLabel` из `venues/catalog.js`);
  - степпер «Рядов» (`button[data-step="rows-"]`, `button[data-step="rows+"]`, значение);
  - степпер «Сдвиг» (`data-step="shift-"` / `"shift+"`, значение `±N,N м`). Кнопки на границе `range`/`rowsMax` — `disabled`. Для планировки без рядов (`rowsMax = 0`) степперы скрыты.
  - подписка через `stage.on('layout'|'state', …)` внутри `stage.scope()`.
- Вкладка `['hall', '🪑', 'Зал', () => layoutPanel(stage)]` в `desktop.js` и `mobile.js` (compact) — только при `caps.layouts`.
- `lightPanel`: если `venue.texts?.extraEquipment` — внизу `<details class="extra-eq"><summary>Доп. оборудование (под спектакль)</summary>…</details>`.
- CSS: `.layout-btn`, степперы — `min-height: 44px; min-width: 44px`.

- [x] **Step 1:** Реализовать. Проверка отложена до Task 10 (e2e на реальной площадке): клик по `layout-btn` меняет `__fest.layout().id` и хэш (`lo`); все кнопки вкладки ≥ 44 px на `mobile.html`.
- [x] **Step 2:** `npx.cmd vitest run` — PASS (границы модулей: в общем коде нет `roof`).
- [x] **Step 3:** Коммит: `Интерфейс: вкладка «Зал» (планировки, ряды, сдвиг) и блок доп. оборудования`.

---

### Task 4: Общие заготовки — тип прибора, материалы, обрезка отрезков

**Files:**
- Modify: `app/src/library/fixtureTypes.js` (в конец), `app/src/library/specs.js`, `app/src/core/materials.js`, `app/src/core/geom.js`
- Test: `app/tests/unit/config.test.js` (или новый `geom.test.js`)

**Interfaces:**
- Produces:
  - `TYPES.LEDPAR933 = { name: 'Involight LedPar 933', shape: 'ledpar', beam: 25, scale: 0.7 }` — **последним** ключом; `SPECS.LEDPAR933` (мощность, DMX-режимы, вес — по паспорту производителя, с пометкой источника).
  - Материалы: `M.brickRed` (рыжий кирпич, светлый шов, `uvScale = 1`), `M.deckRibbed` (тёмный рифлёный настил, волны по одной оси), `M.aluDeck` (серый рифлёный алюминий станка), `M.molton` (чёрный бархат, `DoubleSide`, roughness 1), `M.floorBlack`, если `M.floor` не чёрный.
  - `clipSegmentToRects(a: [x,d], b: [x,d], rects: Array<[x0,x1,d0,d1]>): Array<[[x,d],[x,d]]>` — части отрезка внутри объединения прямоугольников (ортогональный контур помещения).

- [x] **Step 1: Падающие тесты:**
  ```js
  expect(Object.keys(TYPES).at(-1)).toBe('LEDPAR933');           // цвета чертежа не сдвинуты
  expect(clipSegmentToRects([0,0],[10,0],[[2,4,-1,1],[3,6,-1,1]])).toEqual([[[2,0],[6,0]]]);
  expect(clipSegmentToRects([0,0],[10,10],[[0,5,0,5]])).toEqual([[[0,0],[5,5]]]);
  expect(clipSegmentToRects([0,0],[1,0],[[2,3,0,1]])).toEqual([]);
  ```
- [x] **Step 2:** Запустить — FAIL. **Step 3:** Реализовать (canvas-текстуры как `brickTex`/`boardsTex`). **Step 4:** `npx.cmd vitest run` — PASS.
- [x] **Step 5:** Коммит: `Справочник и ядро: LedPar 933, материалы кирпича/настила/станков/мольтона, clipSegmentToRects`.

---

### Task 5: Конфиг размеров `fest-roof/config/dimensions.js`

**Files:**
- Create: `app/src/venues/fest-roof/config/dimensions.js`
- Test: `app/tests/unit/roof.test.js` (создать)

**Interfaces:**
- Produces:
  ```js
  export const ROOF = {
    room: { x0: -6.45, x1: 8.15, d0: -9.65, d1: 7.75, ceiling: 4.70 },
    walls: Array<{ id: '1'|'2'|…|'14'|'7.1'|'8.1', axis: 'x'|'d', at, a0, a1, finish: 'brick'|'black', h?: number, assumption?: true }>,
    rects: Array<[x0,x1,d0,d1]>,          // контур пола помещения — объединение прямоугольников (≤ 8)
    doors, corridor, vent11, vent9, plinths,
    columns: Array<{ id, x, d, w: 0.40, embedded?: true }>,
    capital: { y0: 3.45, y1: 4.45, chord: 0.15, lines: Array<{ axis, at, a0, a1 }> },
    diagonals: { y0: 3.45, y1: 3.60, w: 0.15, bays: Array<[[x,d],[x,d]]> },
    vFrames: Array<{ x, faceA: -2.85, faceB: -8.95, node: { off: 1.0, y: 2.50 }, topY: 3.45 }>,
    channels: { y0: 4.45, y1: 4.70, step: 1.2, assumption: true },
    trusses: { y0: 3.15, y1: 3.45, size: 0.30, tube: 0.032, lines: Array<{ id, axis, at, a0, a1 }>, legs: Array<{ x, d }> },
    domes: { list: Array<{ x, d }>, bottomY: 3.30, r: 0.225, assumption: true },
    molton: { d: -5.15, x0: -6.30, x1: 6.15, y0: 0, y1: 3.45 },
    obstacles: Array<[x0,x1,d0,d1]>,      // для проверки планировок (колонны, ноги V-косынок до Y 2,5, стойки, цоколи, короб 11, зоны дверей 1,0, проём коридора, мольтон)
  };
  export function insideRoom(x, d): boolean;
  ```
  Значения — из spec §2–§5.2 (купола со сдвигом по правилу 0,35).

- [x] **Step 1: Падающие тесты** (`roof.test.js`, блок «Геометрия»):
  ```js
  it('контур замкнут, углы 90°, ширина 14,60, глубина 17,40', …);  // обход стен по порядку 1→14 возвращается в начало
  it('цепочки стен: 1+13+проём = 5+7+8+9 = 14,60; 14+2+3+4+6+7.1 = 12+11+10+8.1 = 17,40', …);
  it('колонны: левые x 5,70 (грань 2,25 от стены 2), правые x −6,45; d 3,85 и −2,65; шаг 6,5', …);
  it('фермы: зазор 0,10 до короба 11 (x −5,25) и до стены 13 (d 7,75); 7 поперечных и 5 продольных линий; добавка до x 7,35; обрубок d −2,5 до x 5,5; смещённая d −2,25', …);
  it('3 стойки: (7,35;5), (−5;−7,5), (−3,05;7,5)', …);
  it('20 куполов: внутри ячеек, ≥ 0,35 в плане от осей капитальных балок и диагоналей', …);
  it('все концы капитальных балок, диагоналей и ферм — внутри помещения (insideRoom)', …);
  it('высоты: потолок 4,70; швеллеры 4,45–4,70; балки 3,45–4,45; фермы 3,15–3,45', …);
  ```
- [x] **Step 2:** FAIL. **Step 3:** Реализовать. **Step 4:** `npx.cmd vitest run tests/unit/roof.test.js` — PASS.
- [x] **Step 5:** Коммит: `Сцена под крышей: конфиг размеров (стены, конструкция, фермы, купола, мольтон)`.

---

### Task 6: Конфиг планировок `fest-roof/config/layouts.js`

**Files:**
- Create: `app/src/venues/fest-roof/config/layouts.js`
- Test: `app/tests/unit/roof.test.js` (блок «Планировки»)

**Interfaces:**
- Consumes: `ROOF.obstacles`, `ROOF.rects` (Task 5).
- Produces:
  ```js
  export const SEAT_PITCH = 10 / 18;
  export const STOCK = { stands: 20, pultStands: 2, chairs: 90, heights: [0.2, 0.4, 0.6, 0.8] };
  export const LAYOUTS = [ /* std, empty, cross, crossRev, traverse, arena — в этом порядке */ {
    id, name, axis: 'd'|'x',                              // ось сдвига
    rows: Array<{ rank: 1..5, x0, x1, d0, d1, h, facing: '+d'|'-d'|'+x'|'-x', seats: number }>,
    pults: Array<{ kind: 'light'|'sound', x0, x1, d0, d1, h }>,
  } ];
  export function placed(st: LayoutState): { rows, stands: Array<{x0,x1,d0,d1,h}>, seats: Array<{x, d, y, rotY}>, pults };
  export function shiftRange(id, rows): [number, number];   // в шагах 0,5 м, по преградам, |шаг| ≤ 10
  export function seatCount(st): number;
  ```
  Ряд с `h > 0` делится на станки 2×1 вдоль длинной стороны. Места — по центру ряда с шагом `SEAT_PITCH`, `seats` штук. Координаты рядов и пультов — таблица spec §6.

- [x] **Step 1: Падающие тесты:**
  ```js
  it('места: std 90, empty 0, cross 90, crossRev 90, traverse 84, arena 82', …);
  it('инвентарь: станков ≤ 20, пультовых ≤ 2, стульев ≤ 90 — в каждой планировке', …);
  it('станки 2×1, высоты из STOCK.heights; ряд 1 на полу', …);
  it('зазор ≥ 0,05 до всех преград — для каждой планировки, каждого rows 1..rowsMax и каждого сдвига из shiftRange', …);
  it('все станки и места внутри помещения', …);
  it('shiftRange содержит 0; у std минимум 0 (мольтон)', …);
  it('rows=2 у std оставляет ранги 1–2 (пол и 0,2), пульты на месте', …);
  ```
- [x] **Step 2:** FAIL. **Step 3:** Реализовать. **Step 4:** PASS.
- [x] **Step 5:** Коммит: `Сцена под крышей: 6 планировок зала, раскладка станков и мест, пределы сдвига`.

---

### Task 7: Конфиг света `fest-roof/config/fixtures.js`

**Files:**
- Create: `app/src/venues/fest-roof/config/fixtures.js`
- Test: `app/tests/unit/roof.test.js` (блок «Свет»)

**Interfaces:**
- Consumes: `ROOF.trusses` (Task 5).
- Produces: `TYPES = venueTypes()`, `SPECS`, `INVENTORY`, `GROUPS`, `GROUP_SETS`, `FIXTURES`, `AIM_NOTE`, `powerOf`, `countByType()`. Функция `onTruss(lineId, along)` даёт точку на нижнем поясе (`y = 3.15 − 0.02`, `on: null`).
  Группы: `FRONT` (8–10), `SIDE_L` (17, 11–13), `SIDE_R` (18, 14–16), `FRESNEL` (1–7), `COMPC` (101–108), `BEYE` (50–58), `RAVEN` (59–62), `BACK` (19–23), `SIDE_WASH` (24, 26, 28, 29), `STORAGE` (109). Наборы: Фронт · Боковые профили · Френели · ComPC · Головы (B-Eye + Raven) · Контровой и боковой wash · Подсветка склада.
  Порядок `FIXTURES`: по номерам 1…29, 50…62, 101…109 (формат ссылки фиксируется с первой публикацией).

- [x] **Step 1: Падающие тесты:**
  ```js
  expect(FIXTURES).toHaveLength(49);
  expect(countByType()).toEqual({ FRESNEL100: 7, PROF100_CW: 9, PROF_RGB: 2, P7X40: 9, BEYE640: 9, RAVEN150: 4, COMPC500: 8, LEDPAR933: 1 });
  // номера уникальны; №13 есть, дублей 14 нет; 8 и 10 — PROF_RGB
  // каждое крепление в 0,03 от нижнего пояса какой-либо линии ферм и внутри её пролёта
  // каждая группа входит в набор; все типы есть в SPECS
  ```
- [x] **Step 2:** FAIL. **Step 3:** Реализовать (координаты — spec §5.1, наведение условное). **Step 4:** PASS.
- [x] **Step 5:** Коммит: `Сцена под крышей: развес 49 приборов по схеме цеха, группы и наборы`.

---

### Task 8: Построение архитектуры, конструкции, ферм, куполов, мольтона

**Files:**
- Create: `fest-roof/build/architecture.js`, `build/trusses.js`, `build/emitters.js`, `build/ambient.js`, `build/overlays.js`
- Test: `app/tests/unit/roof.test.js` (блок «Сборка»)

**Interfaces:**
- Consumes: `ROOF` (Task 5), `M.*` (Task 4), `clipSegmentToRects` (Task 4), `StaticBatch`/`box`/`rect`/`wallWithHoles`/`cylBetween`/`prism` из `core/geom.js`.
- Produces:
  - `buildArchitecture(batch, M, { mobile }): void` — слой `walls`: пол, стены с дверями и проёмом, тупик коридора, короба 9 и 11 с решёткой, цоколи, колонны (сечение I). Слой `ceiling`: настил, швеллеры, капитальные фермы (Уоррен), диагонали, V-косынки. Всё обрезано `ROOF.rects`; внешние грани односторонние.
  - `buildTrusses(batch, M, { mobile }): void` — слой `trusses`: коробчатые фермы 30×30 по `ROOF.trusses.lines` и 3 стойки. Решётка (раскосы) только на компьютере, на телефоне — пояса (как у Камерной).
  - `buildMolton(M): THREE.Mesh` — слой `molton`, складки вертикальной волной.
  - `buildEmitters(M): { groups: { duty: THREE.Group, house: THREE.Group }, dutyPoints }` — 20 куполов. Светящиеся диски — прямые потомки `groups.duty` с `userData.emitter = 'duty'`. `house` — пустая группа (`houseLight: false`).
  - `ambientLights(plan, em)`, `buildDims(labels)`, `buildGrid(labels)` — по образцу Камерной (сетка 1 м, размерные цепочки ширины 14,60 и глубины 17,40).

- [x] **Step 1: Падающие тесты** (сборка в node с фиктивным `batch`, как в `chamber.test.js`):
  ```js
  it('ни одна вершина walls/ceiling/trusses не выходит за контур помещения больше чем на толщину стены', …);
  it('20 светящихся мешей — прямые потомки groups.duty с userData.emitter = "duty"', …);
  it('mobile: треугольников ферм меньше, чем на компьютере', …);
  ```
- [x] **Step 2:** FAIL. **Step 3:** Реализовать. **Step 4:** PASS.
- [x] **Step 5:** Коммит: `Сцена под крышей: стены, потолок с капитальными фермами, диагоналями и V-косынками, фермы 30×30, купола, мольтон`.

---

### Task 9: Зал, пол пятен, паспорт площадки, регистрация

**Files:**
- Create: `fest-roof/build/hall.js`, `build/floor.js`, `fest-roof/index.js`
- Modify: `app/src/venues/catalog.js`, `app/src/venues/registry.js`
- Test: `app/tests/unit/roof.test.js`, `app/tests/unit/venues.contract.test.js` (подхватит сам)

**Interfaces:**
- Consumes: `placed`, `shiftRange`, `seatCount`, `LAYOUTS` (Task 6), конфиг света (Task 7), построители (Task 8).
- Produces:
  - `buildHall(st, { M, profile }): THREE.Group` — станки (верх `M.aluDeck` 0,05, 4 ножки, чёрный фартук спереди), стулья — `InstancedMesh` (обивка `M.seatFabric`, каркас `M.seatFrame`), пульты (подиум, стол 1,2×0,6 на +0,75, стул, корпус пульта). Draw calls зала ≤ 8 при любой планировке.
  - `FLOOR = { trace(p, dir), zone(p), clip(mat), setLayout(st) }` — пересечение луча с Y = 0 и с верхом станков/пультов текущей планировки (зона 1). Стены — пересечение с плоскостями контура. `clip` отбрасывает пиксели вне `ROOF.rects` (uniform `vec4[8]`), `customProgramCacheKey = () => 'pool-roof'`.
  - `index.js`: `id 'roof'`, `name 'Сцена под крышей'`, `status 'draft'`, `meta { type: 'Трансформируемый зал под капитальными фермами', seats: 90 }`, `caps { rigging:false, counterweights:false, portable:false, duty:true, houseLight:false, layouts:true }`, `layers` (spec §7, именно в этом порядке), `views` (spec §8), `defaultView 'overview'`, `camera { maxDistance: 45 }`, `rigging: null`, `layouts { list: LAYOUTS.map((l) => ({ id: l.id, name: l.name, rowsMax: max(rank) или 0 })), default:'std', shiftStep:0.5, range: shiftRange, seats: seatCount, build: buildHall }`, `fixtures { …, floor: FLOOR, hangs: () => true, poolK, powerOf, lineText: () => 'на схеме не указаны', aimNote }`, `lightPlans { full: [FRONT, SIDES, WASH(shadow), HEADS, BACK, STORAGE], lite: [FRONT_SIDE, STAGE] }`, `texts.extraEquipment` (spec §5.3), `exports: {}` (заполнится в Task 11).
  - `catalog.js`: `{ id:'roof', name:'Сцена под крышей', short:'Под крышей', status:'draft', type: <как meta.type>, seats: 90 }`. `registry.js`: `roof: () => import('./fest-roof/index.js')`.

- [ ] **Step 1: Падающие тесты:**
  ```js
  it('validateVenue(roof) — без ошибок', …);
  it('meta.type/seats совпадают с catalog.js', …);
  it('trace: луч вниз над станком h 0,8 std → y 0,8, zone 1; при empty → y 0, zone 0', …);
  it('trace: луч в стену не выходит за контур', …);
  it('buildHall: число экземпляров стульев = seatCount для каждой планировки', …);
  ```
- [ ] **Step 2:** FAIL. **Step 3:** Реализовать. **Step 4:** `npx.cmd vitest run` — PASS (включая `boundaries.test.js`).
- [ ] **Step 5:** Ручная проверка: `npm.cmd run dev` → `http://localhost:5173/desktop.html#v=roof` — сцена строится без ошибок консоли, вкладка «Зал» переключает планировки.
- [ ] **Step 6:** Коммит: `Сцена под крышей (черновик): зал по планировкам, пол пятен, паспорт, подключение в каталог`.

---

### Task 10: E2E, снимки, виды

**Files:**
- Modify: `app/tests/e2e/venues.spec.js`, `app/tests/e2e/shots.spec.js`, `app/tests/e2e/perf.spec.js`, при необходимости `tests/e2e/helpers.js`; `fest-roof/index.js` (точки видов)

- [ ] **Step 1: Тесты:**
  - `venues.spec.js`: проверку «скоро» перевести с `roof` на `foyer`. Добавить: открытие `#v=roof`; выбор в шапке; клик `.layout-btn[data-layout="traverse"]` → `__fest.layout().id === 'traverse'`, в хэше `lo`; память (roof traverse → chamber → roof: traverse); 10 циклов `setLayout` без роста `geometries/textures` (Review Focus 2); чертёж включён + `setLayout('arena')` → у всех мешей зала `material === bp`-материал (Review Focus 4); старые ссылки v1 и v2 big/chamber без `lo` — без изменений; на `mobile.html` все кнопки вкладки «Зал» ≥ 44 px.
  - `shots.spec.js`: `OTHER_VENUES` по умолчанию `['chamber', 'roof']`; для roof дополнительно снимки планировок `cross`, `traverse`, `arena` (вид `overview` и `plan`).
  - `perf.spec.js`: `otherCases` + `'roof:overview'`, `'roof:plan'`.
- [ ] **Step 2:** `npm.cmd run build; npx.cmd playwright test tests/e2e/venues.spec.js` — PASS.
- [ ] **Step 3:** `$env:VENUE='roof'; npm.cmd run shots` → смотреть `review/shots/<раунд>/*/roof/*.jpg`. Подобрать точки видов, чтобы планшет, зал, фермы и потолок читались (сравнить с фото «Общий вид», «Вид на потолок…»). Повторять до удовлетворительного результата.
- [ ] **Step 4:** Коммит: `Сцена под крышей: e2e (планировки, память, утечки, 44 px), снимки и виды`.

---

### Task 11: Экспорт DXF и GLB

**Files:**
- Create: `fest-roof/export/dxf2d.js`, `fest-roof/export/export3d.js`
- Modify: `fest-roof/index.js` (`exports`)
- Test: `app/tests/unit/export.test.js` (блок «Сцена под крышей»)

**Interfaces:**
- Consumes: `ROOF`, `placed(stage.layout)`, `FIXTURES`, `DxfWriter` из `export/dxfWriter.js`; образец — `fest-chamber/export/*`.
- Produces: `buildPlanDXF(stage)`, `buildSectionDXF(stage)`, `build3DDXF(stage)`, `buildGLB(stage)`. Слои DXF: `WALLS`, `DOORS`, `COLUMNS`, `CAPITAL`, `DIAGONALS`, `VFRAMES`, `TRUSSES`, `LEGS`, `DOMES`, `MOLTON`, `STANDS`, `SEATS`, `PULTS`, `FIXTURES`, `DIMS`, `TEXT`, `3D_OUTER_WALLS`. Без лучей и пятен.

- [ ] **Step 1: Падающие тесты** (фиктивный `stage` с `venue`, `layout`, `fixtures.list`, как в блоке Камерной):
  ```js
  it('план: все слои, 49 блоков приборов, 20 куполов, std — 90 мест (блоки SEATS)', …);
  it('план после setLayout traverse — 84 места; empty — 0, слои STANDS/SEATS/PULTS пустые', …);
  it('разрез: отметки 3,15 / 3,45 / 4,45 / 4,70, гребёнка станков', …);
  it('3D DXF: 3DFACE и LINE в WCS (Z — высота), внешние стены на 3D_OUTER_WALLS', …);
  it('GLB: валидный glTF 2.0, односторонние внешние стены, без NaN', …);
  ```
- [ ] **Step 2:** FAIL. **Step 3:** Реализовать. **Step 4:** `npx.cmd vitest run` — PASS.
- [ ] **Step 5:** Ручная проверка: выгрузить 4 файла в браузере и открыть DXF в просмотрщике (например, LibreCAD или онлайн-вьюер), GLB — в `https://gltf-viewer.donmccurdy.com` (локально, файл не публикуется).
- [ ] **Step 6:** Коммит: `Сцена под крышей: экспорт 2D/3D DXF и GLB с текущей планировкой зала`.

---

### Task 12: Полная проверка черновика

- [ ] **Step 1:** `cd app; npm.cmd run check`. Ожидается: vitest PASS, сборка, playwright PASS; размеры `desktop.html`/`mobile.html` ≤ 1,3 МБ.
- [ ] **Step 2:** Паритет Большой и Камерной: `node scripts/parity.mjs compare`. Ожидается: 100%. Расхождения допустимы только там, где их объясняет общая вкладка «Зал» (её нет у этих площадок, поэтому расхождений быть не должно).
- [ ] **Step 3:** Коммит (если были правки) и проверка правила 10-го коммита.

---

### Task 13: Ревью, раунд 1 (`multi-persona-review`)

- [ ] **Step 1:** Запустить `npm.cmd run dev` (демон). Параллельно 4 субагента, каждому дать spec, роль из навыка, URL `desktop.html#v=roof` / `mobile.html#v=roof`, каталог снимков и формат отчёта из навыка:
  - Архитектор / 3D-моделлер — `flash` → `app/review/roof-r1/model.md` (фото из `data/roof/Фото` для сверки);
  - Десктопный UI/UX — `flash` → `app/review/roof-r1/ui-desktop.md`;
  - Мобильный UI/UX — `flash` → `app/review/roof-r1/ui-mobile.md`;
  - Художник по свету / завпост — `pro` → `app/review/roof-r1/lighting.md`.
- [ ] **Step 2:** Свести замечания в `app/review/roof-r1/decisions.md`: «принято / отклонено и почему».
- [ ] **Step 3:** Показать пользователю принятые правки и **дождаться одобрения**.
- [ ] **Step 4:** Внедрить одобренное (каждая правка — с тестом там, где это поведение). `npm.cmd run check`. Коммит `Ревью Сцены под крышей (раунд 1): …`.

### Task 14: Ревью, раунд 2

- [ ] **Step 1:** Те же 4 роли проверяют исправления → `app/review/roof-r2/*.md` (таблица «Проверка исправлений предыдущего раунда»).
- [ ] **Step 2:** `app/review/roof-r2/decisions.md` → одобрение пользователя → внедрение → `npm.cmd run check` → коммит.

### Task 15: Документалист (субагент `flash`)

- [ ] **Step 1:** Субагент-документалист (`flash`, только чтение кода и запись одного файла) изучает diff ветки (`git diff master...roof`), spec, отчёты ревью. Он пишет `app/review/roof-docs-proposal.md`: предлагаемые правки `README.md`, `GEMINI.md`, `BACKUP.md` (если нужно), навыков `.agents/skills/*` (в первую очередь `venue-module-authoring`: `caps.layouts`, `layouts`-контракт, обрезка конструкций контуром, приём «ортогональный контур как объединение прямоугольников», ключ `pool-roof`, `texts.extraEquipment`; `multi-persona-review`: каталоги `roof-r1/r2`). Каждое предложение — файл, раздел, текст «было → стало», обоснование.
- [ ] **Step 2:** Проверить предложения, показать пользователю, **дождаться одобрения**, внести, коммит `Документация: трансформируемый зал и опыт Сцены под крышей`.

### Task 16: Выпуск

- [ ] **Step 1:** После одобрения пользователем — `status: 'ready'` в `index.js` и `catalog.js`. `npm.cmd run check`.
- [ ] **Step 2:** Бэкап после завершения: `powershell -ExecutionPolicy Bypass -File app/scripts/backup.ps1 -Force` → отчёт «VERIFIED (100% MATCH)» для зеркала и снимка, ZIP проверен.
- [ ] **Step 3:** `npm.cmd run dev` → пользователь проверяет на локальном сервере (`desktop.html#v=roof`, `mobile.html#v=roof`).
- [ ] **Step 4:** Только после явного «ок» пользователя: `git checkout master; git merge --no-ff roof; git push origin master` (публикация GitHub Pages через `pages.yml`). Проверить, что `check.yml`/`pages.yml` прошли.
