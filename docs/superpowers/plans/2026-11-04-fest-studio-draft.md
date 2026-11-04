# Студия мультимедиа — черновик: план внедрения

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** открываемая площадка `studio` (статус `draft`) — помещение, двери, окно операторской, циклорама со скруглениями, две системы алюминиевых ферм 30 × 30, потолок с 12 светильниками дежурного света, 2 кассетами и 4 диффузорами — опубликованная в `master` без изменения трёх готовых сцен.

**Architecture:** новый модуль `app/src/venues/fest-studio/` по образцу `fest-roof` (config → build → index). Построитель ферм выносится из `fest-roof` в общий `venues/_template/trusses.js` (только геометрия; материал выбирает площадка). Новые материалы дописываются в конец `core/materials.js`. Общий интерфейс получает правило «у площадки нет приборов» — скрываются органы сценического света.

**Tech Stack:** Three.js 0.170, Vite 5 + vite-plugin-singlefile, Vitest 2, Playwright 1.48, PowerShell (`npm.cmd`/`npx.cmd`).

**Spec:** `docs/superpowers/specs/2026-11-04-fest-studio-draft-design.md` (утверждена 04.11.2026; правка заказчика: светильников 12 — центральный столбец только d −4,99 и +1,21).

## Global Constraints

- Ветка `studio`; слияние в `master` и push — только после `npm run check`, паритета 100 % и просмотра заказчиком.
- Координаты: `d = 0` — передний край циклорамы; `+d` — в циклораму; `X = 0` — ось зала, `+X` — стена с технической дверью; `Y = 0` — пол; `z = −d`.
- Все размеры — в `fest-studio/config/dimensions.js`; в построителях только именованные визуальные константы в начале файла. Неизмеренное — `assumption: true`.
- Слои строго в порядке: `walls`, `ceiling`, `cyc`, `trusses`, `lights`, `duty` (формат ссылки; потом только дописывать в конец).
- Общий код (`engine/ systems/ core/ ui/ library/ export/`, `_template/`) — без названий, id и размеров сцен (`tests/unit/boundaries.test.js`).
- Материалы — только в конец `createMaterials()` (после `molton`).
- Сборка: ≤ 1,3 МБ на `desktop.html`/`mobile.html`, `index.html` ≤ 0,1 МБ, открывается по `file://`.
- Паритет Большой, Камерной и Сцены под крышей: DXF/GLB побайтово, состояние, снимки — `node scripts/parity.mjs compare` с кодом 0. Студия (`draft`) в `VENUES` паритета **не** добавляется.
- Кнопки ≥ 44 × 44 px на телефоне; `touch-action: none` на холсте (уже в движке).
- Субагенты — уровня **pro** (GEMINI.md §8).

## Review Focus

1. **Площадка без приборов во всём движке** — ссылка (`fn: 0`), общий GLB, смена сцен, «чертёж», дымка: ничего не падает, ошибок в консоли нет → тест состояния (Task 6) и e2e открытия/экспорта (Task 7).
2. **Обратный переход на сцену с приборами** — после студии у Сцены под крышей и Большой снова есть «Сценический свет», «Дымка», поиск, слой «Свет (приборы)» → e2e (Task 7).
3. **Щели и перекрытия циклорамы** — в сферических углах и на стыках дуг; z-fighting белого пола с серым → тест площади и «все вершины на поверхности» (Task 4) + снимки (Task 8).
4. **«Чертёж» на гнутых поверхностях** — рёбра `EdgesGeometry` по дугам циклорамы не должны давать «штриховку» → снимок `+bp` (Task 8), при необходимости — порог угла рёбер у меша циклорамы.
5. **Телефон** — треугольники циклорамы и ферм, FPS → профиль `mobile` (меньше сегментов, без раскосов) и `studio:overview` в `perf.spec.js` (Task 8).

---

## Файлы

| Файл | Действие | Отвечает за |
|---|---|---|
| `app/src/venues/_template/trusses.js` | создать | общая геометрия ферм 30 × 30: линия и вертикальная вставка |
| `app/src/venues/fest-roof/build/trusses.js` | изменить | `buildTrusses` через общий построитель (геометрия без изменений) |
| `app/src/core/materials.js` | изменить (конец) | `trussAlu`, `walnutWall`, `walnutCeil`, `cyc`, `floorPoured`, `plasticWhite`, `ventGrille` |
| `app/src/venues/fest-studio/config/dimensions.js` | создать | SSOT студии `STUDIO` + производные (`dutyLights`, `ceilingItems`, `trussFootprints`) |
| `app/src/venues/fest-studio/config/fixtures.js` | создать | пустой развес: `FIXTURES = []`, `TYPES`, `GROUPS`, `GROUP_SETS`, `LIGHT_PLANS` |
| `app/src/venues/fest-studio/build/panels.js` | создать | `panelUV()` — UV в модулях панелей с привязкой |
| `app/src/venues/fest-studio/build/architecture.js` | создать | пол, стены, козырёк, ниши, двери, окно (слой `walls`), потолок с кассетами и диффузорами (слой `ceiling`) |
| `app/src/venues/fest-studio/build/cyclorama.js` | создать | `cycPatches()` + `buildCyclorama()` (слой `cyc`) |
| `app/src/venues/fest-studio/build/trusses.js` | создать | верхняя решётка, нижние фермы, 3 вставки (слой `trusses`) |
| `app/src/venues/fest-studio/build/emitters.js` | создать | 12 дисков дежурного света, `groups.duty/house` |
| `app/src/venues/fest-studio/build/ambient.js` | создать | точечные источники дежурного света |
| `app/src/venues/fest-studio/build/overlays.js` | создать | размеры и сетка |
| `app/src/venues/fest-studio/index.js` | создать | паспорт площадки |
| `app/src/venues/catalog.js`, `registry.js` | изменить | `studio: draft`, загрузчик |
| `app/src/ui/common.js`, `app/src/ui/desktop.js` | изменить | правило «нет приборов» |
| `app/tests/unit/trusses.test.js` | создать | общий построитель |
| `app/tests/unit/studio.test.js` | создать | геометрия и сборка студии |
| `app/tests/unit/state.test.js` | изменить | ссылка студии |
| `app/tests/e2e/venues.spec.js`, `shots.spec.js`, `perf.spec.js` | изменить | студия открывается, снимки, FPS |
| `GEMINI.md`, `.agents/skills/venue-module-authoring/SKILL.md`, `app/src/venues/_template/README.md` | изменить | документация |

---

### Task 0: Эталон паритета со свежей сборки `master`

**Files:** нет изменений кода (результат — `review/modular/baseline/`, не в git).

- [x] **Step 1:** рабочее дерево чистое; `git switch master`; из `app`: `npm.cmd run build`.
- [x] **Step 2:** скопировать `app/dist` в `review/modular/baseline/dist-studio-base` (PowerShell `Copy-Item -Recurse`).
- [x] **Step 3:** `node scripts/parity.mjs capture review/modular/baseline/dist-studio-base` — без ошибок; в отчёте — площадки `big, chamber, roof`.
- [x] **Step 4:** самопроверка `node scripts/parity.mjs compare review/modular/baseline/dist-studio-base` → код 0, 100 %. Иначе эталон негоден — разобраться до правок.
- [x] **Step 5:** `git switch studio`.

---

### Task 1: Общий построитель ферм и перевод Сцены под крышей

**Files:**
- Create: `app/src/venues/_template/trusses.js`
- Modify: `app/src/venues/fest-roof/build/trusses.js`
- Test: `app/tests/unit/trusses.test.js`

**Interfaces:**
- Produces:
  - `TRUSS_SEG = { desktop: { chord: 8, lacing: 5 }, mobile: { chord: 6, lacing: 4 } }`, `LACE_PITCH = 0.3`
  - `trussLineTubes(line: {axis:'d'|'x', at:number, a0:number, a1:number}, T: {y0, y1, size, tube, brace}, opts?: {mobile?: boolean}) → THREE.BufferGeometry[]` — 4 пояса; без `mobile` — ещё раскосы 4 граней и торцевые рамки (как сейчас `trussLine`).
  - `trussPostTubes(post: {x:number, d:number, y0:number, y1:number}, T, opts?: {mobile?: boolean}) → THREE.BufferGeometry[]` — 4 вертикальных пояса от `y0` до `y1`; без `mobile` — зигзаг 4 граней, `n = max(1, round((y1 − y0) / LACE_PITCH))`, высоты узлов `y0 + ((y1 − y0) · i) / n`.
  - Материал не задаётся — его передаёт площадка в `batch.add`.

- [x] **Step 1: Write the failing test** `tests/unit/trusses.test.js`:

```js
import { trussLineTubes, trussPostTubes, LACE_PITCH } from '../../src/venues/_template/trusses.js';
const T = { y0: 5.2, y1: 5.5, size: 0.3, tube: 0.05, brace: 0.016 };
const bbox = (gs) => { const b = new THREE.Box3(); for (const g of gs) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };
it('линия вдоль X: 4 пояса на телефоне, решётка на компьютере, габарит по сечению', () => {
  const l = { axis: 'd', at: -0.7, a0: -2.55, a1: 2.55 };
  expect(trussLineTubes(l, T, { mobile: true })).toHaveLength(4);
  const n = Math.round(5.1 / LACE_PITCH);
  expect(trussLineTubes(l, T)).toHaveLength(4 + 4 * n + 8);
  const b = bbox(trussLineTubes(l, T, { mobile: true }));
  expect(b.min.y).toBeCloseTo(5.2, 3); expect(b.max.y).toBeCloseTo(5.5, 3);
  expect(-b.max.z).toBeCloseTo(-0.85, 3); expect(-b.min.z).toBeCloseTo(-0.55, 3); // z = −d
});
it('вставка от y0 до y1 не выходит за свои отметки', () => {
  const b = bbox(trussPostTubes({ x: -2.7, d: -7.55, y0: 3.55, y1: 5.2 }, T));
  expect(b.min.y).toBeCloseTo(3.55, 3); expect(b.max.y).toBeCloseTo(5.2, 3);
});
it('Сцена под крышей: число треугольников ферм не изменилось', () => { /* buildTrusses(fakeBatch, fakeM) — сравнить с числом до правки, записанным в тест как константа */ });
```

Для третьего теста: до правки один раз посчитать сумму `position.count / 3` по геометриям, которые `fest-roof` `buildTrusses` кладёт в batch (desktop и mobile), и вписать оба числа константами.

- [x] **Step 2:** `npx.cmd vitest run tests/unit/trusses.test.js` → FAIL (модуля нет).
- [x] **Step 3:** перенести `chordOffsets`, `trussLine`, `trussLeg` из `fest-roof/build/trusses.js` в `_template/trusses.js` как `trussLineTubes`/`trussPostTubes` (ось и порядок труб — без изменений: пояса → 4 грани по очереди → торцевые рамки; у вставки — 4 пояса → грани k = 0…3). `fest-roof/build/trusses.js` оставляет `buildTrusses(batch, M, { mobile })`: линии → `trussLineTubes`, стойки → `trussPostTubes({ x, d, y0: 0, y1: T.y0 })`, тот же `batch.add('trusses', M.truss, tubes, { tag: 'trusses' })` и плиты `M.steel`.
- [x] **Step 4:** `npx.cmd vitest run` → всё PASS (в т.ч. `roof.test.js`, `boundaries.test.js`).
- [x] **Step 5:** `npm.cmd run build` → `node scripts/parity.mjs compare` → код 0 (Сцена под крышей побайтово, фермы чёрные).
- [x] **Step 6: Commit** `git add app/src/venues/_template/trusses.js app/src/venues/fest-roof/build/trusses.js app/tests/unit/trusses.test.js` → `git commit -m "Общий построитель ферм 30×30 в _template (Сцена под крышей — без изменений, паритет 100 %)"`.

---

### Task 2: Конфигурация студии

**Files:**
- Create: `app/src/venues/fest-studio/config/dimensions.js`, `app/src/venues/fest-studio/config/fixtures.js`
- Test: `app/tests/unit/studio.test.js` (раздел «геометрия»)

**Interfaces:**
- Produces `STUDIO` (все числа — из спецификации §2–§5):
  - `room: { x0: -3.05, x1: 3.05, d0: -8.60, d1: 4.00, ceiling: 5.65 }`
  - `canopy: { d0: -8.60, d1: -7.90, y: 2.40 }`
  - `doors: [{ id: 'exit', wall: 'back', x0: 1.25, x1: 3.05, d0: -8.95, d1: -8.60, h: 2.15, double: true }, { id: 'tech', wall: 'right', x0: 3.05, x1: 3.50, d0: -4.45, d1: -3.40, h: 2.15 }]`
  - `window: { d: -7.90, x0: -2.70, x1: 2.90, y0: 3.70, y1: 4.60, sections: 5, assumption: true }`
  - `cyc: { x0: -3.025, x1: 3.025, d0: 0, d1: 3.975, h: 3.90, r: 0.70, hAssumption: true }`
  - `trusses: { size: 0.30, tube: 0.05, brace: 0.016, upper: { y0: 5.20, y1: 5.50, lines: [...] }, lower: { y0: 3.25, y1: 3.55, lines: [...] }, posts: [...] }` —
    upper: `{ id: 'Д-2.70', axis: 'x', at: -2.70, a0: -7.70, a1: 3.80 }`, `Д2.70` аналогично; `Ф1…Ф6`: `axis: 'd'`, `at` = −7.55, −5.70, −3.20, −0.70, 1.80, 3.65, `a0: -2.55, a1: 2.55`;
    lower: `{ id: 'Н-козырёк', axis: 'd', at: -7.70, a0: -2.85, a1: 2.85 }`, `{ id: 'Н-2.70', axis: 'x', at: -2.70, a0: -7.55, a1: 0 }`, `Н2.70` аналогично;
    posts: `{ x: -2.70, d: -7.55, y0: 3.55, y1: 5.20 }`, `{ x: ±2.70, d: 0.15, y0: 3.55, y1: 5.20, assumption: true }`.
  - `panels: { wall: { w: 1.20, h: 2.40, seam: 0.02 }, ceil: { w: 1.20, h: 0.60, seam: 0.02 }, ceilOriginD: 4.00, ceilAssumption: true }`
  - `duty: { r: 0.10, list: [{x, d}] }` (радиус выреза светильника, assumption; нужен тесту перекрытий) — x = ±1.22 × d ∈ {−6.23, −4.37, −2.51, −0.03, 2.45} (10) + x = 0 × d ∈ {−4.99, 1.21} (2), `assumption: true`
  - `cassettes: [{ x: -1.22, d0: -5.55, d1: -4.75, size: 0.80 }, { x: -1.22, d0: -1.65, d1: -0.85, size: 0.80 }]`, `diffusers: [{ x: ±1.22, d: -6.85 }, { x: ±1.22, d: 3.07 }]` (`size: 0.60`)
  - `ambient: { duty: { color, decay, full, lite } }` — значения как у `fest-roof` `ROOF.ambient.duty`
  - `zeroLineLabel: 'd = 0 — передний край циклорамы'`
- Produces функции: `ceilingItems() → Array<{kind:'duty'|'cassette'|'diffuser', x0, x1, d0, d1}>`, `trussFootprints(level:'upper'|'lower') → Array<[x0,x1,d0,d1]>`.
- `fixtures.js`: `FIXTURES = []`, `TYPES = {}`, `SPECS = {}`, `GROUPS = {}`, `GROUP_SETS = []`, `LIGHT_PLANS = { full: [], lite: [] }`.

- [x] **Step 1: Write the failing tests** (`describe('Студия · геометрия')`):
  - `room`: ширина 6,10; глубина слева `d1 − d0` = 12,60; справа до полотна выхода 12,95; потолок 5,65.
  - `4,00 + 7,90 = 0,20 + 0,15 + (Ф6 − Ф1) + 0,15 + 0,20` и `Ф6 − Ф1 = 11,20`; шаги Ф1–Ф2 и Ф5–Ф6 = 1,85, Ф2…Ф5 = 2,50.
  - отступы граней: продольные верхние/нижние — 0,20 от стен; верхние — 0,20 от козырька (−7,90) и стены (4,00); нижняя у козырька — 0,05.
  - нижние боковые кончаются на `d = 0`; вставки у циклорамы: передняя грань `d = 0`; все вставки от 3,55 до 5,20.
  - циклорама: ширина 6,05, зазоры 0,025 к боковым стенам и к стене за ней, `r = 0.70`, `h = 3.90`.
  - ниша выхода примыкает к правой стене (`x1 === room.x1`), ширина 1,80; углубление тех. двери 1,05 × 0,45, d −4,45…−3,40.
  - дежурный свет: 12 точек (5 + 5 + 2), все в центрах столбцов (x ∈ {−1.22, 0, 1.22}).
  - `ceilingItems()` попарно не перекрываются и не перекрывают `trussFootprints('upper')` (касание ≤ 1e-6 — не перекрытие); все в пределах `room` по X и d ∈ [−7.90, 4.00].
- [x] **Step 2:** `npx.cmd vitest run tests/unit/studio.test.js` → FAIL.
- [x] **Step 3:** написать `config/dimensions.js` (шапка: источник, система координат, нулевая линия — по образцу `fest-roof`) и `config/fixtures.js`.
- [x] **Step 4:** тесты PASS.
- [x] **Step 5: Commit** «Студия: конфигурация помещения, ферм, циклорамы и потолка (SSOT)».

---

### Task 3: Материалы и архитектура (стены, козырёк, двери, окно, потолок)

**Files:**
- Modify: `app/src/core/materials.js` (только конец `createMaterials()` и блок `uvScale`)
- Create: `app/src/venues/fest-studio/build/panels.js`, `app/src/venues/fest-studio/build/architecture.js`
- Test: `app/tests/unit/studio.test.js` (раздел «сборка»)

**Interfaces:**
- Consumes: `STUDIO` (Task 2); `box`, `rect`, `wallWithHoles`, `P` из `core/geom.js`.
- Produces:
  - материалы: `trussAlu` (натуральный алюминий, металл), `walnutWall` (тайл = 1 панель 1,20 × 2,40 + шов 0,02 по правому и нижнему краю, мелкая перфорация), `walnutCeil` (тайл 1,20 × 0,60 + шов), `cyc` (матовый белый), `floorPoured` (серый полуматовый, без текстуры), `plasticWhite`, `ventGrille` (решётка кассеты). Имена — общие.
  - `panelUV(g: BufferGeometry, m: {du:number, dv:number, u0:number, v0:number}) → g` — UV по доминирующей нормали (как `worldUV`), затем `u = (coord − u0) / du`, `v = (coord − v0) / dv`; такие геометрии кладутся с `{ uv: false }`.
  - `buildArchitecture(batch, M, { mobile }) → void`: слой `walls` — пол `floorPoured` по контуру (вкл. ниши), стены/торцы/откосы/потолки ниш, низ и грань козырька `walnutWall`; полотна дверей `M.door` (двустворчатое — со швом, как в `fest-roof` `addDoor`); окно — рама `M.blackWall`/`M.steel` с 4 импостами, стекло `M.glass`, фон `M.booth` за стеклом. Слой `ceiling` — панели `walnutCeil` (низ на 5,65), кассеты (`plasticWhite` + `ventGrille`), диффузоры (`plasticWhite`), чуть ниже плоскости потолка.
  - Привязка UV: стены d = const — `u0 = −0.61`, `du = 1.22`; стены x = const — `u0` = координата стены за циклорамой в развёртке `z = −4.00`, `du = 1.22`; по высоте `v0 = 0`, `dv = 2.42`; потолок — `du = 1.22` с `u0 = −0.61`, `dv = 0.62` от `d = 4.00`.

- [x] **Step 1: Write the failing tests:**
  - `buildArchitecture(new StaticBatch(), fakeM())` → `batch.build()` содержит слои `walls` и `ceiling`; ни одной вершины с `NaN`; все вершины в коробке `x ∈ [−3.05, 3.50]`, `d ∈ [−8.95, 4.00]`, `y ∈ [0, 5.65]`.
  - у геометрий `walnutWall` UV в швах: точка стены x = −0,61 (d = const) даёт `u` целое (±1e-6); точка y = 2,42 даёт `v = 1`.
  - в слое `walls` есть меш(и) материала `door` с площадью полотен ≈ 1,80 × 2,15 + 1,05 × 2,15 (±2 %).
- [x] **Step 2:** FAIL.
- [x] **Step 3:** дописать материалы в конец (после `molton`) и их `userData.uvScale` (для `walnut*` — 1: UV считает площадка); `panels.js`; `architecture.js`.
- [x] **Step 4:** PASS; `npx.cmd vitest run` целиком PASS.
- [x] **Step 5: Commit** «Студия: стены, козырёк, двери, окно операторской, потолок; материалы (в конец палитры)».

---

### Task 4: Циклорама

**Files:**
- Create: `app/src/venues/fest-studio/build/cyclorama.js`
- Test: `app/tests/unit/studio.test.js` (раздел «циклорама»)

**Interfaces:**
- Consumes: `STUDIO.cyc`.
- Produces:
  - `cycPatches(c = STUDIO.cyc, seg: {arc:number}) → THREE.BufferGeometry[]` — 11 участков с общими кромками: пол (плоский, `x ∈ [x0+r, x1−r]`, `d ∈ [d0, d1−r]`), 2 боковые и 1 задняя нижняя дуга (четверть цилиндра R), 2 угла (⅛ сферы R с центрами `(x0+r | x1−r, r, d1−r)`), задняя стенка (`y ∈ [r, h]`), 2 боковые стенки (`d ∈ [d0, d1−r]`), 2 вертикальные дуги (`y ∈ [r, h]`, центры в плане `(x0+r | x1−r, d1−r)`). Нормали — внутрь циклорамы. Пол циклорамы поднят на визуальную константу `FLOOR_LIFT` (≈ 0,003) над серым полом.
  - `buildCyclorama(batch, M, { mobile }) → void` — `batch.add('cyc', M.cyc, cycPatches(STUDIO.cyc, { arc: mobile ? 8 : 16 }), { tag: 'cyc' })`.
- Неявная поверхность для теста: точка `p` лежит на оболочке, если расстояние от `p` до «внутреннего скруглённого ящика» (боковые и задняя стенки + пол, скругление R) = 0 — посчитать в тесте через ближайшую точку участка.

- [ ] **Step 1: Write the failing tests:**
  - все вершины `cycPatches` на поверхности (отклонение ≤ 1e-6 для плоских, ≤ хорда дуги `r·(1 − cos(π/(4·arc)))` для дуг; `y ≤ h`, `d ∈ [0, d1]`, `|x| ≤ 3.025`).
  - сумма площадей треугольников = аналитической площади (плоские части + `π r / 2 · длина` для дуг + `π r² / 2` за два угла) с допуском 1 % при `arc = 16` — ловит щели и перекрытия.
  - кромки соседних участков совпадают: множество вершин на линии `y = r` у задней стенки и у задней дуги совпадает (до 1e-6).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** реализовать (параметрические сетки: `PlaneGeometry`/ручные буферы; без CSG).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** «Студия: циклорама — скругления R 0,70, сферические углы, белый пол вровень».

---

### Task 5: Фермы, дежурный свет, источники

**Files:**
- Create: `app/src/venues/fest-studio/build/trusses.js`, `build/emitters.js`, `build/ambient.js`
- Test: `app/tests/unit/studio.test.js` (раздел «фермы и дежурка»)

**Interfaces:**
- Consumes: `trussLineTubes`, `trussPostTubes` (Task 1); `STUDIO.trusses`, `STUDIO.duty`, `STUDIO.ambient`.
- Produces:
  - `buildTrusses(batch, M, { mobile }) → void` — верхние линии с `T = { ...trusses, ...upper }`, нижние с `{ ...trusses, ...lower }`, вставки; всё одним `batch.add('trusses', M.trussAlu, tubes, { tag: 'trusses' })`.
  - `buildEmitters(M) → { groups: { duty: THREE.Group, house: THREE.Group }, dutyPoints: THREE.Vector3[], dutyRows: THREE.Vector3[][] }` — ободки (`M.steelGray`, `userData.static = true`, `userData.layer = 'duty'`) и один меш светящихся дисков `M.dutyBulb` с `userData.emitter = 'duty'` — **прямые потомки** `groups.duty`; диски на `5.65 − ε` лицом вниз; `dutyRows` — точки, сгруппированные по d (7 рядов).
  - `ambientLights(plan, em) → { duty: THREE.PointLight[], blue: [], house: [] }` — `full`: по источнику на ряд, `lite`: 2; источник на `BELOW` (визуальная константа) ниже диска; над плоскостью низа ферм источник не ставить — ниже 5,20 он не затеняется фермами.

- [ ] **Step 1: Write the failing tests:**
  - треугольники ферм: на телефоне меньше, чем на компьютере; bbox всех ферм в `x ∈ [−2.85, 2.85]`, `y ∈ [3.25, 5.50]`, `d ∈ [−7.85, 3.80]`.
  - `buildEmitters(fakeM())`: у `groups.duty` прямой потомок с `userData.emitter === 'duty'`; `dutyPoints.length === 12`; `groups.house.children.length === 0`.
  - `ambientLights('full', em).duty.length === 7`, `('lite')` — 2; все источники `y < 5.20`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** реализовать.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** «Студия: алюминиевые фермы (верхняя решётка, нижние, 3 вставки), 12 светильников дежурного света».

---

### Task 6: Паспорт, каталог, ссылка

**Files:**
- Create: `app/src/venues/fest-studio/build/overlays.js`, `app/src/venues/fest-studio/index.js`
- Modify: `app/src/venues/catalog.js`, `app/src/venues/registry.js`, `app/tests/unit/state.test.js`

**Interfaces:**
- Consumes: всё из Task 2–5; `rectFloor` из `systems/fixtures.js`; `buildDimsFromList`, `fmtM` из `core/overlays.js`.
- Produces паспорт (спецификация §6):
  - `id: 'studio'`, `name: 'Студия мультимедиа'`, `status: 'draft'`, `meta: { type: 'Съёмочный павильон с циклорамой', note: 'черновик: без света и зала' }`
  - `caps: { rigging: false, counterweights: false, portable: false, duty: true, houseLight: false, layouts: false }`
  - `layers: [['walls','Стены'], ['ceiling','Потолок',{bp:0xe8e9eb}], ['cyc','Циклорама',{bp:0xf4f4f2}], ['trusses','Фермы',{bp:0xe2e5ea}], ['lights','Свет (приборы)'], ['duty','Свет (дежурка)',{bp:0x8a8f98}]]`
  - `views` (начальные точки, уточняются по снимкам в Task 8): `overview` persp pos `[6.0, 9.0, -14.0]` → target `[0, 1.5, 0]`, `portraitPullback: true`; `camera` «На циклораму» `[0, 1.6, -6.0]` → `[0, 1.4, 3.0]`; `booth` «Из операторской» `[0.2, 4.1, -7.6]` → `[0, 1.0, 2.0]`; `cycToExit` «С циклорамы к выходу» `[0, 1.7, 3.0]` → `[1.5, 1.4, -8.0]`; `ceiling` «Фермы и потолок (снизу)» `[-1.0, 1.2, -2.0]` → `[0.5, 5.4, 1.0]`; `plan` ortho top `center [0, 0, -2.475]`, `height 14.5`, `width 9`; `section` ortho side `center [0, 2.8, -2.475]`, `height 6.8`, `width 14.5`. `defaultView: 'overview'`, `camera: { maxDistance: 35 }`.
  - `rigging: null`, `layouts: null`, `fixtures: { list: FIXTURES, types: TYPES, specs: SPECS, groups: GROUPS, groupSets: GROUP_SETS, barDepth: {}, portable: null, floor: rectFloor({ x0: -3.05, x1: 3.05, d0: -8.60, d1: 4.00 }), hangs: () => true, poolK: () => 0.5 }`, `lightPlans: LIGHT_PLANS`, `exports: {}`.
  - `build(ctx)`: `buildArchitecture` → `buildCyclorama` → `buildTrusses` → `ctx.commitBatch()` → `buildEmitters`; `ctx.add('duty', em.groups.duty)`, `ctx.add('lights', em.groups.house)`; возвращает `{ rigging: null, emitters: em.groups, ambient: (plan) => ambientLights(plan, em), overlays: (labels) => ({ dims: buildDims(labels), grid: buildGrid(labels) }) }`.
  - overlays: размеры «Ширина 6,10», «Глубина 12,60», «Потолок 5,65», «Верхние фермы 5,20», «Нижние фермы 3,25», «Циклорама 3,90», «Шаг ферм 2,50»; сетка 1 м по прямоугольнику помещения, ось X = 0 и линия d = 0 красным, подпись `STUDIO.zeroLineLabel`.
  - `catalog.js`: `{ id: 'studio', name: 'Студия мультимедиа', short: 'Студия', status: 'draft', type: 'Съёмочный павильон с циклорамой' }`; `registry.js`: `studio: () => import('./fest-studio/index.js')`.

- [ ] **Step 1: Write the failing tests:** в `state.test.js` «Ссылка: формат v2» добавить `studio` в перебор (`import studio from '../../src/venues/fest-studio/index.js'`): кодирование/раскодирование с `fixturesOn: []` и выключенным слоем `cyc` возвращает тот же `venue`, слои и вид. Контракт (`venues.contract.test.js`) подхватит студию сам.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** реализовать `overlays.js`, `index.js`, правки каталога и реестра.
- [ ] **Step 4:** `npx.cmd vitest run` → PASS (контракт, границы, состояние).
- [ ] **Step 5: Commit** «Студия: паспорт площадки (draft), каталог и реестр — открывается по #v=studio».

---

### Task 7: Интерфейс площадки без приборов

**Files:**
- Modify: `app/src/ui/common.js` (`lightPanel`, `layersPanel`, `quickBar`), `app/src/ui/desktop.js` (поиск в шапке, справка)
- Test: `app/tests/e2e/venues.spec.js`

**Interfaces:**
- Правило (общее, без названий сцен): `const noFixtures = !stage.fixtures.list.length;`
  - `lightPanel`: при `noFixtures` в панели только `h4 'Свет'`, кнопки «Дежурный свет» / «Свет в зале» (по `caps`) и `h('div', { class: 'hint lights-note' }, 'Развес света — в следующей версии')`; нет «Сценический свет», «Лучи (дымка)», ползунка дымки, поиска, групп, подсказок, «Приборы по группам»; «Доп. оборудование» — только при `texts.extraEquipment`.
  - `quickBar`: при `noFixtures` нет `q-stage` и `q-haze`.
  - `layersPanel`: при `noFixtures` не выводится переключатель слоя `lights` (слой в паспорте остаётся) и «Номера приборов».
  - `desktop.js`: контейнер `.top-search` получает `hidden = noFixtures` в `mountVenue`; пункт справки «Щелчок по прибору…» — только при наличии приборов.

- [ ] **Step 1: Write the failing e2e** в `venues.spec.js`:
  - в существующем тесте: `for (const id of ['foyer'])` → `aria-disabled`; `studio` — **не** `aria-disabled`, в пункте списка есть «черновик».
  - новый тест «студия: черновик без приборов»: открыть `#v=studio` (desktop и mobile) → `__fest.venue() === 'studio'`; во вкладке «Свет» есть `[data-id="duty"]` и текст «Развес света — в следующей версии», нет `[data-id="stage"]`, `[data-id="haze"]`, `.haze-row`; в слоях есть `[data-id="l-cyc"]`, нет `[data-id="l-lights"]`; на desktop `.top-search` скрыт; `canvasStats().std > 4`; экспорт GLB (`__fest.exportGLB`) отдаёт непустой буфер; затем `loadVenue('roof')` → снова есть `[data-id="stage"]`, `[data-id="haze"]`, `[data-id="l-lights"]`, `.top-search` виден; `expectNoErrors(log)`.
- [ ] **Step 2:** `npm.cmd run build; npx.cmd playwright test tests/e2e/venues.spec.js` → FAIL.
- [ ] **Step 3:** реализовать правило.
- [ ] **Step 4:** тот же прогон → PASS.
- [ ] **Step 5:** `node scripts/parity.mjs compare` → код 0 (интерфейс готовых сцен не изменился).
- [ ] **Step 6: Commit** «Интерфейс: площадка без приборов — только дежурный свет и пометка о развесе; e2e студии».

---

### Task 8: Снимки, FPS, полная проверка, паритет

**Files:**
- Modify: `app/tests/e2e/shots.spec.js` (`OTHER_VENUES` по умолчанию `['chamber', 'roof', 'studio']`), `app/tests/e2e/perf.spec.js` (`otherCases` + `'studio:overview', 'studio:plan'`)

- [ ] **Step 1:** `$env:VENUE='studio'; npm.cmd run shots` → все снимки непустые; просмотреть `review/shots/<раунд>/*/studio/`: геометрия против фото `data/studio/Фото` (циклорама, углы, швы панелей, окно, ниши, фермы и вставки, светильники/кассеты/диффузоры), «чертёж» без штриховки на дугах, нет z-fighting. Уточнить точки видов в `index.js`. Найденные расхождения — правка конфига/построителя + повтор снимков.
- [ ] **Step 2:** `npm.cmd run check` → код 0 (Vitest, сборка, весь Playwright: размер ≤ 1,3 МБ, кнопки ≥ 44 px, утечки при смене сцен, FPS).
- [ ] **Step 3:** `node scripts/parity.mjs compare` → код 0, в отчёте `big, chamber, roof` — 100 %.
- [ ] **Step 4: Commit** «Студия: снимки и FPS в e2e, виды уточнены по снимкам».
- [ ] **Step 5:** если `git rev-list --count HEAD` кратно 10 — `npm.cmd run backup` (сверка числа файлов и байтов, `tar -tf`).

---

### Task 9: Документация, просмотр заказчиком, публикация

**Files:**
- Modify: `GEMINI.md` (шапка: «Студия мультимедиа (черновик: геометрия, фермы, циклорама, потолок)»; §1 п. 2 — общий построитель ферм `_template/trusses.js`; правило «площадка без приборов» в §1 п. 1), `.agents/skills/venue-module-authoring/SKILL.md` (§3/§5: `_template/trusses.js`, площадка без приборов, параметрическая циклорама), `app/src/venues/_template/README.md` (раздел о `trusses.js`).

- [ ] **Step 1:** правки документации; `npx.cmd vitest run tests/unit/boundaries.test.js` → PASS. (§8 GEMINI.md заказчика уже закоммичен в `studio`, `b70c50e`.)
- [ ] **Step 2: Commit** «Документация: Студия мультимедиа (черновик), общий построитель ферм, площадка без приборов».
- [ ] **Step 3:** локальный сервер (`npm.cmd run dev`, порт 5173) → ссылки заказчику на desktop/mobile `#v=studio`; ждать его подтверждения. Замечания — правки + повтор Task 8 шагов 2–3.
- [ ] **Step 4:** финальное ревью всей ветки (субагент уровня pro, `superpowers:requesting-code-review`) — только после подтверждения заказчика; при отказе — самопроверка по тому же навыку.
- [ ] **Step 5:** `git switch master; git merge --no-ff studio` → `npm.cmd run check` на `master` → `git push origin master` (публикация GitHub Pages), `git push origin studio`.
- [ ] **Step 6:** бэкап по правилу 10 коммитов (`git rev-list --count HEAD % 10 === 0` → `npm.cmd run backup`).
