# Студия мультимедиа (`studio`) — перевод в `ready`: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (выбрано заказчиком: последовательная разработка одним агентом в текущем сеансе; субагенты — для двухраундовой экспертной приёмки `multi-persona-review` в Tasks 8–9). Steps use checkbox (`- [ ]`) syntax for tracking. Передача контекста — [`docs/superpowers/handoffs/2026-11-24-fest-studio-ready-handoff.md`](../handoffs/2026-11-24-fest-studio-ready-handoff.md).

**Goal:** Довести площадку `studio` («Студия мультимедиа») из `draft` до статуса `ready`: добавить подвижный фермовый контур `4,10 × 5,00` м на 4 цепных лебёдках (слой `'rigging'`), телескопический 4-рядный блитчер с 0-м рядом стульев на 40 мест и двухфазной анимацией (слой `'hall'`), постоянный развес из 15 световых приборов с шейдерной обрезкой пятен `'pool-studio'`, полный экспорт `planDXF` / `sectionDXF` / `dxf3d` / `glb`, пройти двухраундовую приёмку 4 субагентами и включить `studio` в харнесс паритета `parity.mjs`.

**Architecture:** Вся предметная логика и геометрия размещаются изолированно в `app/src/venues/fest-studio/{config,build,export}/` по образцу `fest-roof` и `fest-big`. Интеграция с общим движком выполняется по утверждённому **Подходу A**: используются штатные контракты `caps.rigging: true` и `caps.layouts: true` с минимальными обратно-совместимыми опциями (`RIG_KINDS.truss` в конец словаря, `layouts.steppers: false`, хук `layouts.animate` только при интерактивном клике в UI, локальный тип `BSW200` в `fest-studio/config/fixtures.js`), что гарантирует 100 % побайтовый и попиксельный паритет уже готовых площадок (`big`, `chamber`, `roof`).

**Tech Stack:** Three.js 0.170, Vite 5 + `vite-plugin-singlefile`, Vitest 2, Playwright 1.48, Windows PowerShell (`npm.cmd`, `npx.cmd`).

**Spec:** [`docs/superpowers/specs/2026-11-24-fest-studio-ready-design.md`](../specs/2026-11-24-fest-studio-ready-design.md) — единственный источник размеров, координат и решений; при любом расхождении прав spec.

## Global Constraints

- Правила [`AGENTS.md`](../../../AGENTS.md) обязательны без исключений. Профильные навыки: `venue-module-authoring`, `theatrical-stage-rigging`, `stage-lighting-photometry`, `playwright-webgl-qa`, `mobile-cad-touch-ux`, `multi-persona-review`.
- Ветка разработки: `studio-ready` от `master`. До перевода в `ready` в Task 10 у модуля сохраняется `status: 'draft'`, чтобы `parity-config.test.js` оставался зелёным, а `node scripts/parity.mjs compare` проверял 100 % неизменность `big`, `chamber`, `roof` относительно свежего эталона `master`.
- Все числовые габариты — строго в `app/src/venues/fest-studio/config/*.js`. В `build/*` допускаются только именованные визуальные константы деталей в шапке файла. Любое допущение помечается `assumption: true` / `assumed: true` и заносится в [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md).
- Общий код (`engine/`, `systems/`, `core/`, `ui/`, `library/`, `export/`, `venues/_template/`) не содержит строк `'studio'`, `'Студия'` и размеров конкретной площадки (`tests/unit/boundaries.test.js`).
- Тип прибора `BSW200` (`Showlee BSW 200`) объявляется **локально** в `fest-studio/config/fixtures.js` через `venueTypes(LOCAL_TYPES)`, а НЕ в `library/fixtureTypes.js`, чтобы индекс `GAL_LAMP` в `typeColors()` на Большой сцене не сдвинулся.
- Слои `studio` (первые 6 заморожены ссылками черновика; новые строго в конец): `walls`, `ceiling`, `cyc`, `trusses`, `lights`, `duty`, `rigging`, `hall`.
- Шейдер обрезки пятен обязан задавать уникальный ключ: `mat.customProgramCacheKey = () => 'pool-studio'`.
- Сборка: `dist/desktop.html` и `dist/mobile.html` ≤ `1,3` МБ, `dist/index.html` ≤ `0,1` МБ, полная автономность по `file://`. Все тач-таргеты на мобильной версии ≥ `44 × 44` px.
- Регламент бэкапа (`AGENTS.md` §5): после каждого коммита проверять `(git rev-list --count HEAD) % 10 === 0` → `cd app; npm.cmd run backup` с верификацией `100% MATCH` (сейчас на `master` 127 коммитов → ближайшие рубежи **№ 130** и **№ 140**).

## Review Focus

1. **Совместимость ссылок черновика Студии (`fn: 0, ln: 6, без lo и h`):** ссылка, сохранённая в черновике Студии, при открытии на готовой модели включает все 15 приборов, ставит подвижную ферму `ФП` на `4,50` м, блитчер в режим по умолчанию `folded`, а новые слои `rigging` и `hall` оставляет видимыми → unit-тест в `tests/unit/state.test.js` (Task 5).
2. **Прерывание двухфазной анимации блитчера и режим «чертёж»:** повторный клик по кнопкам «Разложен / Свёрнут» в середине анимации, переключение в ортогональный вид или уход на другую площадку не оставляют «висящих» кадров и не растят `renderer.info.memory.geometries`; при включённом режиме «чертёж» финальная группа зала сразу получает материалы чертежа и рёбра → unit-тест `bleacherPose` (Task 3) + E2E-стресс на 10 циклов и проверку `matOrig` (Task 7).
3. **Захват подвижной фермы мышью и пальцем в 3D при выключенном слое `rigging` и рядом с приборами:** рама хватается за любую из 4 сторон (`x = ±2,05`, `d = −3,20 / +1,80`), при скрытии слоя `rigging` перестаёт перехватывать луч, и не блокирует клик по приборам `№ 6–15` → unit-тест `StudioRigging` (Task 2) + E2E-тест в `venues.spec.js` (Task 7).
4. **Пятна света на выкружках циклорамы и ступенях блитчера:** плоские пятна зоны `0` не прорезают цилиндрические дуги `R = 0,70` циклорамы (`|x| > 2,325` или `d > 3,275`), конусы лучей `B-EYE` и боковых профилей останавливаются на стенках/дугах циклорамы, а при раскладывании блитчера пятна над `d ∈ [−7,90; −4,10]` поднимаются на высоту соответствующего яруса `0,30…1,20` м → unit-тесты `traceToFloor` (Task 4) + E2E проверка `pools` (Task 7).
5. **Неизменность `big`, `chamber`, `roof` и одновременный учёт `layout` + `rigging` в экспорте Студии:** ни одна правка `rigKinds.js`, `ui/common.js`, `engine/stage.js` не меняет паритет трёх готовых сцен, а `planDXF`, `sectionDXF`, `dxf3d`, `glb` Студии синхронно отражают и опущенную ферму `ФП`, и разложенный блитчер на 40 мест → `parity.mjs compare` (Tasks 1, 7, 10) + `tests/unit/export.test.js` (Task 6).

---

## Карта файлов

| Файл | Действие | Ответственность |
|---|---|---|
| `app/src/library/rigKinds.js` | изменить (в конец) | вид механики `truss` (`Ф — подъёмная ферма`) |
| `app/src/ui/style.css` | изменить | цвет `--truss` и класс `.k-truss` |
| `app/src/venues/contract.js` | изменить | JSDoc и валидация опций `layouts.steppers`, `layouts.animate`, `texts.rigHint`, `texts.layoutHint` |
| `app/src/ui/common.js` | изменить | `layoutPanel`: скрытие степперов при `steppers: false`, вызов `{ animate: true }`; `rigPanel`: `texts.rigHint` |
| `app/src/engine/stage.js` | изменить | `setLayout(partial, { animate })` + шаг `_hallAnim` в `_loop()` и очистка в `_teardownVenue` |
| `app/src/venues/fest-studio/config/dimensions.js` | изменить | блоки `STUDIO.rigging` (лебёдки, рама) и `STUDIO.bleacher` (ярусы, лестница, поручни, 0-й ряд) |
| `app/src/venues/fest-studio/config/rigging.js` | создать | подъём `MF` (`ФП`, `0…4,50` м) и `describeRig()` |
| `app/src/venues/fest-studio/build/rigging.js` | создать | `StudioRigging`: рама `30×30`, 4 лебёдки со спансетами, 4 динамические цепи, 4-сторонний `hit` |
| `app/src/venues/fest-studio/config/layouts.js` | создать | планировки `folded` (по умолчанию, 0 мест) и `unfolded` (40 мест), `bleacherPose(p)`, `placed(st)` |
| `app/src/venues/fest-studio/build/hall.js` | создать | `buildHall(st, ctx)` и двухфазный аниматор `animateHall(from, to, ctx)` |
| `app/src/venues/fest-studio/config/fixtures.js` | изменить | локальный тип `BSW200`, 15 приборов (`№ 1…15`), группы, наборы, `LIGHT_PLANS` |
| `app/src/venues/fest-studio/build/floor.js` | создать | `FLOOR` (`'pool-studio'`), обрезка по полу до выкружек циклорамы и по 4 ярусам блитчера |
| `app/src/venues/fest-studio/build/overlays.js` | изменить | высотная размерная линия подвижной фермы / блитчера без наложений |
| `app/src/venues/fest-studio/export/dxf2d.js` | создать | `buildPlanDXF(stage)` и `buildSectionDXF(stage)` с учётом `layout` и высоты `MF` |
| `app/src/venues/fest-studio/export/export3d.js` | создать | `build3DDXF(stage)`, `buildGLB(stage)`, `buildExportSceneForGLTF(stage)` |
| `app/src/venues/fest-studio/index.js` | изменить | слои `rigging` и `hall`, вид `hall`, подключение механики, зала, света, экспорта, затем `status: 'ready'` |
| `app/src/venues/catalog.js` | изменить (Task 10) | `studio`: `status: 'ready'`, `seats: 40` |
| `app/scripts/parity.mjs` | изменить (Task 10) | добавление `studio` в `VENUES` и сценариев `lo-unfolded`, `lo-unfolded-mf2`, `off+haze55` |
| `app/tests/unit/state.test.js` | изменить | поддержка площадки с 1 подъёмом механики (стр. 60) + тест старой черновой ссылки `studio` |
| `app/tests/unit/studio.test.js` | изменить | тесты подвижной фермы, блитчера, двухфазной кинематики, 15 приборов и `FLOOR` |
| `app/tests/unit/export.test.js` | изменить | тесты 2D/3D DXF и GLB Студии (`folded`/`unfolded`, высота `MF`) |
| `app/tests/e2e/helpers.js`, `venues.spec.js`, `shots.spec.js`, `perf.spec.js` | изменить | модификатор `+mf2`, E2E механики/блитчера/анимации/утечек/44 px, сюжетные снимки |
| `ASSUMPTIONS.md`, `AGENTS.md`, `.agents/skills/venue-module-authoring/SKILL.md` | изменить (Task 10) | актуализация допущений и документации готовой площадки |

---

### Task 0: Ветка `studio-ready` и свежий эталон паритета `master`

**Files:**
- Без правок исходного кода (локальный эталон в `app/review/modular/baseline/`, исключён из git).

- [x] **Step 1: Проверить чистоту дерева на `master` и снять свежую сборку эталона**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  git status -sb
  npm.cmd run build
  Remove-Item -Recurse -Force review/modular/baseline/dist-studio-ready-base -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path review/modular/baseline | Out-Null
  Copy-Item -Recurse dist review/modular/baseline/dist-studio-ready-base
  ```
  Expected: сборка без ошибок, каталог `review/modular/baseline/dist-studio-ready-base` создан.

- [x] **Step 2: Снять эталон паритета трёх готовых сцен (`big`, `chamber`, `roof`) и выполнить самопроверку**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  node scripts/parity.mjs capture review/modular/baseline/dist-studio-ready-base
  node scripts/parity.mjs compare review/modular/baseline/dist-studio-ready-base
  ```
  Expected: код возврата `0`, в отчёте `big`, `chamber`, `roof` — `100 %` совпадение (без этого к правкам не переходить).

- [x] **Step 3: Создать рабочую ветку `studio-ready` и зафиксировать документацию планирования**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages"
  git checkout -b studio-ready
  ```
  Если файлы `docs/superpowers/{specs,plans,handoffs}/*2026-11-24-fest-studio-ready*` ещё не закоммичены — закоммитить их первым коммитом ветки (`Документация: спецификация, план и handoff перевода Студии в ready`) и проверить `(git rev-list --count HEAD) % 10 === 0`.

---

### Task 1: Обратно-совместимые хуки движка и UI (`RIG_KINDS.truss`, `steppers: false`, анимация зала)

**Files:**
- Modify: `app/src/library/rigKinds.js:6-11`
- Modify: `app/src/ui/style.css:1-50`
- Modify: `app/src/venues/contract.js:32-72`
- Modify: `app/src/ui/common.js:85-90, 268-320`
- Modify: `app/src/engine/stage.js:272-334, 379-392, 414-438`
- Modify: `app/tests/unit/state.test.js:58-63`
- Modify: `app/tests/unit/venues.contract.test.js:30-63`

**Interfaces:**
- Produces:
  - `RIG_KINDS.truss = { letter: 'Ф', name: 'Подъёмная ферма', short: 'Ф — подъёмная ферма', legend: 'Ф — подъёмная ферма', color: 0x0ea5a4 }` (последним ключом в `RIG_KINDS`).
  - Контракт `layouts`: опциональные поля `steppers?: boolean` (`false` — скрыть степперы «Рядов» и «Сдвиг») и `animate?: (from: LayoutState, to: LayoutState, ctx: { M, profile }) => { group: THREE.Object3D, duration: number, update: (progress01: number) => void, dispose?: () => void } | null`.
  - Контракт `texts`: опциональные `rigHint?: string`, `layoutHint?: string`.
  - `stage.setLayout(partial = {}, { animate = false } = {})`: без `animate` (или без `venue.layouts.animate`) — прежний синхронный `_swapHall(st)`; при `animate === true && venue.layouts.animate` — останавливает прежнюю `_hallAnim`, обновляет `this.layout = st`, `floor.setLayout?.(st)`, помещает анимируемую группу в `layerGroups.hall` (применяя `_bpApply`, если `_bpOn`), крутит `update(k)` в `_loop()`, а при `k >= 1` (или при отмене в `_stopHallAnim()`) освобождает временную группу и вызывает штатный `_swapHall(st)` + `fixtures.updateAll()` + `lighting.placeGroupLights()`. Событие `emit('layout', { ...st })` отправляется сразу при начале перехода, чтобы кнопки UI переключались мгновенно.

- [x] **Step 1: Написать падающие тесты в `venues.contract.test.js` и поправить индекс механики в `state.test.js`**
  В `app/tests/unit/venues.contract.test.js` добавить проверки:
  - подъём с `kind: 'truss'` проходит `validateVenue`;
  - `layouts` со `steppers: false` и функцией `animate` проходит `validateVenue`, а `steppers: 'no'` или `animate: 123` возвращают ошибку контракта.
  В `app/tests/unit/state.test.js:60` заменить жёсткий индекс `[3]` на безопасный для площадок с 1 подъёмом:
  ```js
  if (venue.rigging) {
    const r = venue.rigging.list[Math.min(3, venue.rigging.list.length - 1)];
    st.heights[r.id] = Math.min(r.max, Math.max(r.min, 2.35));
  }
  ```

- [x] **Step 2: Запустить тесты и убедиться, что новые проверки падают**
  Run: `cd app; npx.cmd vitest run tests/unit/venues.contract.test.js tests/unit/state.test.js`
  Expected: FAIL на `kind: 'truss'` и валидации `steppers` / `animate`.

- [x] **Step 3: Реализовать расширения в `rigKinds.js`, `style.css`, `contract.js`, `ui/common.js`, `engine/stage.js`**
  - В `style.css` добавить `--truss: #2dd4bf;` в `:root` и `.k-truss { color: var(--truss); }` рядом с `.k-side`.
  - В `ui/common.js`:
    - `rigPanel`: текст подсказки `stage.venue.texts?.rigHint || 'Порядок — спереди назад. Высота трубы над планшетом.'`;
    - `layoutPanel`: клик по кнопке планировки вызывает `stage.setLayout({ id: l.id }, { animate: true })`; `steppers.hidden = cfg.steppers === false || it.rowsMax === 0`; текст подсказки `stage.venue.texts?.layoutHint ?? '«Рядов» убирает задние ряды…'`.
  - В `engine/stage.js`: добавить метод `_stopHallAnim({ commit = false } = {})` и вызывать его в `_teardownVenue()` (`commit: false`), в начале `setLayout()` (`commit: false`) и при переходе в `ortho` в `setView()` (`commit: true`). В `_loop()` наравне с `this._anim` обновлять `this._hallAnim`.

- [x] **Step 4: Проверить все юнит-тесты и 100 % паритет `big`, `chamber`, `roof`**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  npx.cmd vitest run
  npm.cmd run build
  node scripts/parity.mjs compare
  ```
  Expected: все юнит-тесты (включая `boundaries.test.js`) PASS; `parity.mjs compare` — код `0` (100 % по всем трём готовым площадкам).

- [x] **Step 5: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/library/rigKinds.js app/src/ui/style.css app/src/venues/contract.js app/src/ui/common.js app/src/engine/stage.js app/tests/unit/state.test.js app/tests/unit/venues.contract.test.js
  git commit -m "Движок и UI: вид механики truss, опция layouts.steppers и хук анимации зала"
  git rev-list --count HEAD
  ```
  Если счётчик кратен 10 — выполнить `cd app; npm.cmd run backup`.

---

### Task 2: Подвижная ферма `4,10 × 5,00` м на 4 цепных лебёдках (`config/rigging.js`, `build/rigging.js`)

**Files:**
- Modify: `app/src/venues/fest-studio/config/dimensions.js`
- Create: `app/src/venues/fest-studio/config/rigging.js`
- Create: `app/src/venues/fest-studio/build/rigging.js`
- Modify: `app/tests/unit/studio.test.js`

**Interfaces:**
- Consumes: `STUDIO` (`dimensions.js`), `trussLineTubes` (`venues/_template/trusses.js`), `box` (`core/geom.js`).
- Produces:
  - `STUDIO.movableTruss`:
    ```js
    {
      x: 2.05, d0: -3.20, d1: 1.80, // оси углов и лебёдок (1,00 м от стен ±3,05; под Ф3 и Ф5)
      minY: 0, maxY: 4.50, restY: 4.50, topClearance: 0.40,
      hoist: { w: 0.24, h: 0.18, d: 0.20, y0: 4.92, y1: 5.10, spansetTopY: 5.20, assumption: true },
      lines: [
        { id: 'МП-Л', axis: 'x', at: -2.05, a0: -3.35, a1: 1.95 },
        { id: 'МП-П', axis: 'x', at: 2.05, a0: -3.35, a1: 1.95 },
        { id: 'МП-Ф3', axis: 'd', at: -3.20, a0: -1.90, a1: 1.90 },
        { id: 'МП-Ф5', axis: 'd', at: 1.80, a0: -1.90, a1: 1.90 },
      ],
    }
    ```
  - `config/rigging.js`: `RIGGING` (`[{ id: 'MF', name: 'ФП', fullName: 'Подъёмная ферма 4,1 × 5,0 м (4 лебёдки)', kind: 'truss', min: 0, max: 4.5, rest: 4.5 }]`), `RIG_BY_ID`, `describeRig(r)`.
  - `build/rigging.js`: `export class StudioRigging` с конструктором `(M, { labels = null, mobile = false } = {})` и полным контрактом движка (`root`, `items`, `cables`, `buildStatic(batch)`, `onChange(fn)`, `get(id)`, `height(id)`, `setHeight(id, h, { silent })`, `highlight(id)`, `hover(id)`, `axis(id)`, `setLabelLayout(mode)`, `snapshot()`).

- [x] **Step 1: Написать падающие тесты в `app/tests/unit/studio.test.js` (блок `Студия · подвижная ферма`)**
  Проверить:
  - оси подвеса совпадают с `Ф3` (`-3.20`) и `Ф5` (`+1.80`), отступ от боковых стен `3.05 - 2.05 = 1.00` м;
  - при `h = 4.50` м верх фермы `4.80` м отстоит на `0.40` м от `STUDIO.trusses.upper.y0` (`5.20` м);
  - зазор внешнего габарита `[-2.20..2.20] × [-3.35..1.95]` до нижних боковых ферм (`±2.55`) равен `0.35` м, а внутри циклорамы (`d > 0`) рама целиком лежит в пределах плоского пола `[-2.325..2.325] × [0..3.275]` без пересечения с выкружками `R = 0.70`;
  - `StudioRigging`: `setHeight('MF', 0)` и `setHeight('MF', 2.15)` зажимают ход в `[0, 4.5]`, двигают `group.position.y` и обновляют нижние концы всех 4 цепей в `cables.geometry.attributes.position` на `h + 0.30` при верхних концах `4.92`; на `mobile: true` число треугольников рамы меньше, чем на `mobile: false`; `hit.userData.pick` равен `{ kind: 'rig', id: 'MF' }`.

- [x] **Step 2: Запустить тест и убедиться в FAIL**
  Run: `cd app; npx.cmd vitest run tests/unit/studio.test.js`
  Expected: FAIL (`Cannot find module .../config/rigging.js`).

- [x] **Step 3: Реализовать `STUDIO.movableTruss`, `config/rigging.js` и `build/rigging.js`**
  - В `StudioRigging`: рама строится в локальных координатах `y0: 0, y1: 0.30` через `trussLineTubes`, сливается в один меш `visual` с материалом `M.trussAlu.clone()` (`group.position.y = h`).
  - `hit` — один невидимый меш из 4 боксов сечением `0.42 × 0.42` м вдоль 4 сторон рамы (внутри `group`, поднимается вместе с ней).
  - `buildStatic(batch)` добавляет в слой `'rigging'` 4 корпуса лебёдок (`M.fixtureBody`) и 4 спансета (`M.steel`) под `Ф3` и `Ф5`.

- [x] **Step 4: Прогнать тесты**
  Run: `cd app; npx.cmd vitest run tests/unit/studio.test.js`
  Expected: PASS.

- [x] **Step 5: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/venues/fest-studio/config/dimensions.js app/src/venues/fest-studio/config/rigging.js app/src/venues/fest-studio/build/rigging.js app/tests/unit/studio.test.js
  git commit -m "Студия: подвижная ферма 4,1×5,0 м на 4 цепных лебёдках (конфиг и кинематика)"
  git rev-list --count HEAD
  ```

---

### Task 3: Телескопический блитчер на 40 мест с двухфазной анимацией (`config/layouts.js`, `build/hall.js`)

**Files:**
- Modify: `app/src/venues/fest-studio/config/dimensions.js`
- Create: `app/src/venues/fest-studio/config/layouts.js`
- Create: `app/src/venues/fest-studio/build/hall.js`
- Modify: `app/tests/unit/studio.test.js`

**Interfaces:**
- Consumes: `STUDIO.bleacher` (`dimensions.js`), `box` (`core/geom.js`).
- Produces:
  - `STUDIO.bleacher` в `dimensions.js`: все параметры из spec §4.1 (`x0: -2.90, x1: 1.60`, `seatsX0: -2.90, seatsX1: 1.10`, `stairX0: 1.10, stairX1: 1.60`, `seatCountPerRow: 8`, `seatPitch: 0.50`, `dBack: -7.90`, `tierDepth: 0.95`, `riser: 0.30`, `tiers: 4`, `foldedCascade: 0.04`, `row0D: -3.57`, `backRailH: 1.00`, `sideRailH: 0.85`, `sideSplayDeg: [7, 5.5, 4, 2.5]`, пометки `assumption: true`).
  - `config/layouts.js`:
    - `LAYOUTS = [{ id: 'folded', name: 'Свёрнут у стены', rowsMax: 0 }, { id: 'unfolded', name: 'Разложен со стульями', rowsMax: 5 }]`
    - `DEFAULT_LAYOUT = 'folded'`, `SHIFT_STEP = 0.5`, `shiftRange = () => [0, 0]`
    - `seatCount(st)` → `st?.id === 'unfolded' ? 40 : 0`
    - `bleacherPose(p)` (`p ∈ [0, 1]`): возвращает `{ tSlide, tFold, tChairs }`, где при `p ≤ 0.55` `tSlide = smooth(p / 0.55), tFold = 0, tChairs = 0`, а при `p > 0.55` `tSlide = 1, tFold = smooth((p - 0.55) / 0.45), tChairs = smooth(Math.max(0, (p - 0.70) / 0.30))`
    - `placedAt(pose)` и `placed(st)` → координаты ярусов `tiers` (`[{ tier: 1..4, x0, x1, d0, d1, h }]`), полуступеней лестницы `steps`, кресел трибуны `bleacherSeats` (`32` шт. с углом спинки), стульев 0-го ряда `floorChairs` (`8` шт.), секций поручней (`backRail`, `sideRails` с углом отгиба вбок).
  - `build/hall.js`:
    - `buildHall(st, { M, profile }) → THREE.Group`: строит чистое терминальное состояние (`folded` или `unfolded`): статика с `userData.static = true, userData.layer = 'hall'` (настилы `M.aluDeck`, подступенки/каркас/поручни `M.steel`, оранжевые тканевые боковины `M.velvetOrange`) + `InstancedMesh` кресел и стульев (`seatsFabric` на `M.seatFabric`, `seatsFrame` на `M.seatFrame` с `userData.layer = 'hall'`). Пустые `InstancedMesh` (`count = 0`) или пустые геометрии не ломают `EdgesGeometry`!
    - `animateHall(fromSt, toSt, { M, profile }) → { group, duration: 950, update(k), dispose() }`: строит артикулированную группу из переиспользуемых мешей 4 ярусов, шарнирных спинок, поворачиваемых боковых поручней и группы 0-го ряда стульев; `update(k)` интерполирует `p = fromP + (toP - fromP) * k` без создания новых `BufferGeometry` в кадре.

- [x] **Step 1: Написать падающие тесты в `app/tests/unit/studio.test.js` (блок `Студия · блитчер и планировки`)**
  Проверить:
  - `seatCount({ id: 'folded' }) === 0`, `seatCount({ id: 'unfolded' }) === 40`; `DEFAULT_LAYOUT === 'folded'`;
  - в `folded`: габарит ярусов `d ∈ [-7.90, -6.83]` (`1.07` м), за спиной проход `0.70` м (`-8.60..-7.90`), все 8 боковых поручней присутствуют и с учётом отгиба не выходят за левую стену `x = -3.05`, верх заднего ограждения `2.20 < 2.40` м козырька;
  - в `unfolded`: 4 яруса `0.30, 0.60, 0.90, 1.20` м занимают `d ∈ [-7.90, -4.10]`, справа проход `1.45` м (`x = 1.60..3.05`) свободен перед тех. дверью и дверью выхода, 0-й ряд стульев (`8` шт.) стоит на `Y = 0, d = -3.57` и его передний край `d < -3.35` не пересекает проекцию подвижной фермы;
  - `bleacherPose`: в точке `p = 0.4` ярусы уже выдвинуты частично (`0 < tSlide < 1`), а спинки ещё сложены и 0-го ряда нет (`tFold === 0, tChairs === 0`); в точке `p = 0.8` ярусы полностью выдвинуты (`tSlide === 1`), спинки поднимаются (`0 < tFold < 1`);
  - `buildHall` и `animateHall`: сборка без `NaN`, `animateHall` проходит `update(0) → update(0.5) → update(1)` и `dispose()` без ошибок.

- [x] **Step 2: Запустить тест и убедиться в FAIL**
  Run: `cd app; npx.cmd vitest run tests/unit/studio.test.js`
  Expected: FAIL (`Cannot find module .../config/layouts.js`).

- [x] **Step 3: Реализовать `STUDIO.bleacher`, `config/layouts.js` и `build/hall.js`**
  Строго следить, чтобы в `buildHall` не создавались статические `THREE.Mesh` с пустой геометрией (`position.count === 0`), иначе `EdgesGeometry` в режиме «чертёж» упадёт или создаст мусор.

- [x] **Step 4: Прогнать тесты**
  Run: `cd app; npx.cmd vitest run tests/unit/studio.test.js`
  Expected: PASS.

- [x] **Step 5: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/venues/fest-studio/config/dimensions.js app/src/venues/fest-studio/config/layouts.js app/src/venues/fest-studio/build/hall.js app/tests/unit/studio.test.js
  git commit -m "Студия: телескопический блитчер на 40 мест и двухфазная анимация"
  git rev-list --count HEAD
  ```
  (Внимание: здесь счётчик коммитов приблизится к **№ 130** — если кратен 10, немедленно запустить `cd app; npm.cmd run backup` и убедиться в `100% MATCH`!)

---

### Task 4: Развес 15 приборов и пол световых пятен `'pool-studio'` (`config/fixtures.js`, `build/floor.js`)

**Files:**
- Modify: `app/src/venues/fest-studio/config/fixtures.js`
- Create: `app/src/venues/fest-studio/build/floor.js`
- Modify: `app/tests/unit/studio.test.js`

**Interfaces:**
- Consumes: `STUDIO` (`dimensions.js`), `placed` (`config/layouts.js`), `venueTypes` (`library/fixtureTypes.js`), `SPECS` (`library/specs.js`).
- Produces:
  - `config/fixtures.js`: `LOCAL_TYPES = { BSW200: { name: 'Showlee BSW 200', shape: 'spot', beam: 16, scale: 0.82 } }`, `LOCAL_SPECS = { BSW200: { ... } }`, `TYPES = venueTypes(LOCAL_TYPES)`, `SPECS = { ...LIB_SPECS, ...LOCAL_SPECS }`, `INVENTORY = { PROF_CW: 3, BSW200: 2, PROF100_RGB: 2, BEYE640: 8 }`, `GROUPS`, `GROUP_SETS`, `LIGHT_PLANS`, `FIXTURES` (15 приборов с `assumed: true`, координаты и `aim` из таблицы spec §5.1), `AIM_NOTE`, `powerOf`, `lineText`, `countByType()`.
  - `build/floor.js`: `FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor, setLayout }`, `hangs = () => true`, `poolK = (f) => (f.group === 'CYC' ? 0.45 : 0.5)`.
    - Прямоугольники зоны `0` (чистый пол без захода на дуги выкружки циклорамы `R = 0,70`):
      - павильон перед циклорамой: `[−3.05, 3.05, −8.60, 0]`;
      - плоское дно циклорамы: `[−2.325, 2.325, 0, 3.275]`;
      - ниша выхода `[1.25, 3.05, −8.95, −8.60]` и ниша тех. двери `[3.05, 3.50, −4.45, −3.40]`.
    - Зона `1`: uniform-массивы `uTops[4]`, `uTopH[4]`, `uTopN` по 4 ярусам разложенного блитчера (`setLayout(st)` ставит `uTopN = 0` для `folded` и `uTopN = 4` для `unfolded`).
    - `traceToFloor(p, dir)` проверяет ярусы блитчера, плоский пол зоны `0`, цилиндрические/плоские грани циклорамы и стены павильона (возвращая `floor: false` при ударе в стену или стенку/дугу циклорамы).
    - `mat.customProgramCacheKey = () => 'pool-studio'`.

- [x] **Step 1: Обновить и дополнить тесты в `app/tests/unit/studio.test.js` (блок `Студия · свет и пол пятен`)**
  Заменить старый тест черновика (`развес приборов в черновике пуст`) на проверки:
  - `FIXTURES` содержит 15 приборов с уникальными номерами `1…15` и флагом `assumed: true`, `countByType()` совпадает с `INVENTORY`;
  - каждый прибор висит на расстоянии `≤ 0.03` м под нижним поясом своей фермы (`5.20` или `3.25`) в пределах её пролёта, `mount.on === null`;
  - `'BSW200'` присутствует в `TYPES` Студии, но **отсутствует** в `library/fixtureTypes.js` (палитра Большой сцены не сдвинута);
  - `FLOOR`: при `setLayout({ id: 'unfolded' })` вертикальный луч над 3-м ярусом (`x = 0, d = -6.50`) даёт `point.y ≈ 0.90, floor: true` и `poolZone(point) === 1`, а при `setLayout({ id: 'folded' })` в той же точке даёт `point.y ≈ 0, floor: true` и `poolZone(point) === 0`; пологий луч в стену или в вертикальную часть циклорамы останавливается внутри помещения с `floor: false`; `clip` выставляет `customProgramCacheKey() === 'pool-studio'`.

- [x] **Step 2: Запустить тест и убедиться в FAIL**
  Run: `cd app; npx.cmd vitest run tests/unit/studio.test.js`
  Expected: FAIL.

- [x] **Step 3: Реализовать `config/fixtures.js` и `build/floor.js`**

- [x] **Step 4: Прогнать все юнит-тесты**
  Run: `cd app; npx.cmd vitest run`
  Expected: PASS.

- [x] **Step 5: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/venues/fest-studio/config/fixtures.js app/src/venues/fest-studio/build/floor.js app/tests/unit/studio.test.js
  git commit -m "Студия: развес 15 приборов, паспорт BSW 200 и обрезка пятен pool-studio"
  git rev-list --count HEAD
  ```

---

### Task 5: Интеграция паспорта Студии (`fest-studio/index.js`, `overlays.js`) и совместимость ссылок черновика

**Files:**
- Modify: `app/src/venues/fest-studio/index.js`
- Modify: `app/src/venues/fest-studio/build/overlays.js`
- Modify: `app/tests/unit/state.test.js`

**Interfaces:**
- Consumes: модули Tasks 1–4.
- Produces: собранная интерактивная площадка `studio` (пока со `status: 'draft'` до Task 10) с 8 слоями (`walls, ceiling, cyc, trusses, lights, duty, rigging, hall`), 8 видами (включая `hall`: «С блитчера (3-й ряд)» и `plan` с `legendRows: 5`), `caps: { rigging: true, counterweights: false, portable: false, duty: true, houseLight: false, layouts: true }`, `rigging`, `layouts` (`default: 'folded'`, `steppers: false`, `animate: animateHall`), `fixtures`, `texts`.

- [x] **Step 1: Добавить в `app/tests/unit/state.test.js` тест обратной совместимости ссылки черновика Студии**
  Сформировать строку ссылки формата v2, какую писал черновик Студии (`{ v: 2, vn: 'studio', h: [], fx: '', fn: 0, f: 0b101, l: 0b111111, ln: 6, view: 'camera', hd: 30 }`), и проверить `decodeState(draftLink, studio)`:
  - `heights` пуст (движок оставит `MF` на `rest = 4.5`);
  - `fixturesOn` длины `15`, все `true`;
  - `layout` равен `{ id: 'folded', rows: 0, shift: 0 }`;
  - слои `rigging` и `hall` не выключены старой 6-битной маской.
  Также проверить round-trip новой ссылки `studio` с `heights: { MF: 1.85 }`, `layout: { id: 'unfolded', rows: 5, shift: 0 }`, `layers: { rigging: false, hall: true, ... }`.

- [x] **Step 2: Подключить механику, блитчер, свет, новый ракурс `hall` и слои в `fest-studio/index.js` и обновить `overlays.js`**
  - В `index.js` в `build(ctx)`: создать `const rig = new StudioRigging(ctx.M, { labels: ctx.labels, mobile })`, вызвать `rig.buildStatic(ctx.batch)` **до** `ctx.commitBatch()`, затем `ctx.add('rigging', rig.root)` и вернуть `rigging: rig`.
  - В `texts` задать:
    - `rigDrag: 'подвижную ферму можно тянуть мышью'`,
    - `rigHint: 'Высота низа подвижной фермы 4,1 × 5,0 м над полом (4 цепные лебёдки синхронно).'`,
    - `layoutHint: 'При переключении блитчер выезжает от стены операторской, поднимаются кресла и выставляется 0-й ряд стульев.'`,
    - `extraEquipment` (по spec §5.1).

- [x] **Step 3: Запустить полный набор юнит-тестов**
  Run: `cd app; npx.cmd vitest run`
  Expected: все тесты (`venues.contract.test.js`, `state.test.js`, `studio.test.js`, `boundaries.test.js`, `parity-config.test.js`) — PASS.

- [x] **Step 4: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/venues/fest-studio/index.js app/src/venues/fest-studio/build/overlays.js app/tests/unit/state.test.js
  git commit -m "Студия: подключение подвижной фермы, блитчера, 15 приборов и слоёв rigging/hall"
  git rev-list --count HEAD
  ```

---

### Task 6: Собственный экспорт 2D/3D DXF и GLB Студии (`export/dxf2d.js`, `export/export3d.js`)

**Files:**
- Create: `app/src/venues/fest-studio/export/dxf2d.js`
- Create: `app/src/venues/fest-studio/export/export3d.js`
- Modify: `app/src/venues/fest-studio/index.js` (`exports`)
- Modify: `app/tests/unit/export.test.js`

**Interfaces:**
- Consumes: `STUDIO`, `RIGGING`, `LAYOUTS` / `placed`, `FIXTURES` / `TYPES` / `SPECS`, построители `build/*`, `DxfWriter` (`export/dxfWriter.js`); эталон структуры — `app/src/venues/fest-roof/export/{dxf2d,export3d}.js`.
- Produces:
  - `exportState(stage)`: берёт `layout = stage?.layout || { id: 'folded', rows: 0, shift: 0 }`, `mfH = stage?.rigging?.height?.('MF') ?? 4.5`, `fixtures`.
  - `buildPlanDXF(stage)` (слои `0_AXES`, `0_GRID`, `WALLS`, `DOORS`, `CANOPY`, `CYC`, `TRUSSES`, `RIGGING`, `DUTY`, `CEIL_EQUIP`, `STANDS`, `SEATS`, `FIXTURES`, `DIMS`, `TEXT`): двери с дугами открывания, контур циклорамы и линия начала скругления `R = 0,70`, стационарные фермы, подвижный контур `ФП` с подписью `ФП (H=+… м)` и 4 лебёдками, блитчер в текущем состоянии (`0` или `40` блоков `SEAT`), 12 светильников `DUTY`, 15 блоков приборов с номерами `1*…15*`, сноской `* — номер по допущению` и ведомостью с суммарной мощностью.
  - `buildSectionDXF(stage)`: продольный разрез с отметками `±0,000`, `+2,400`, `+3,250`, `+3,900` (с дугой нижней выкружки циклорамы `R = 0,70`), `+5,200`, `+5,650`, подвижной фермой `ФП (+…)` с цепями к `Ф3`/`Ф5`, профилем блитчера (`folded` пакет или `unfolded` гребёнка 4 ярусов `0,30…1,20` + 0-й ряд + заднее ограждение `+2,20`) и приборами разреза.
  - `build3DDXF(stage)`: 3D WCS (`Z` — высота), внешние стены и пол на отключаемом слое `3D_OUTER_WALLS`, слои `3D_WALLS`, `3D_CEILING`, `3D_CYC`, `3D_TRUSSES`, `3D_RIGGING` (рама на высоте `mfH` + лебёдки + линии цепей), `3D_HALL`, `3D_DUTY`, `3D_FIXTURES`.
  - `buildGLB(stage)` и `buildExportSceneForGLTF(stage)`: односторонние материалы (`doubleSided: false`), цвета всех материалов студии (`walnutWall`, `walnutCeil`, `cyc`, `floorPoured`, `trussAlu`, `plasticWhite`, `ventGrille`, `velvetOrange`, `seatFabric`, `seatFrame`, `aluDeck`, `steel`, `door`, `glass`, `booth`, `fixtureBody`, `dutyBulb`), без `NaN`, узлы `Seats_0` / `Seats_40` и `MovableTruss`.

- [x] **Step 1: Написать падающие тесты экспорта Студии в `app/tests/unit/export.test.js`**
  Проверить:
  - `planDXF`: все целевые слои объявлены, `15` блоков `INSERT` на `FIXTURES`, номера `1*…15*` и сноска `* — номер по допущению`, `12` светильников дежурки; по умолчанию (`null` / `folded`) `0` мест на `SEATS` и `ФП (H=+4,50 м)`; при `{ layout: { id: 'unfolded' }, rigging: { height: () => 2.1 } }` — `40` блоков `INSERT` на `SEATS` и подпись `ФП (H=+2,10 м)`;
  - `sectionDXF`: отметки `±0,000`, `+2,400`, `+3,250`, `+3,900`, `+5,200`, `+5,650`, динамическая отметка `+2,10` у `ФП` и гребёнка ярусов в `unfolded`;
  - `dxf3d`: `3DFACE` на `3D_OUTER_WALLS`, `3D_CYC`, `3D_RIGGING`, `3D_HALL`, `3D_FIXTURES`, все `Z ∈ [-0.02, 5.66]`, при смене `mfH` с `4.5` на `1.2` минимальный `Z` на `3D_RIGGING` опускается до `≈ 1.20`;
  - `glb`: валидный glTF 2.0, `doubleSided !== true`, без `NaN`, сцены дают `Seats_0` (`folded`) и `Seats_40` (`unfolded`).

- [x] **Step 2: Запустить `npx.cmd vitest run tests/unit/export.test.js` и убедиться в FAIL**

- [x] **Step 3: Реализовать `export/dxf2d.js`, `export/export3d.js` и подключить их в `fest-studio/index.js`**

- [x] **Step 4: Прогнать все юнит-тесты**
  Run: `cd app; npx.cmd vitest run`
  Expected: PASS.

- [x] **Step 5: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/src/venues/fest-studio/export/dxf2d.js app/src/venues/fest-studio/export/export3d.js app/src/venues/fest-studio/index.js app/tests/unit/export.test.js
  git commit -m "Студия: экспорт 2D/3D DXF и GLB с учётом высоты фермы и состояния блитчера"
  git rev-list --count HEAD
  ```

---

### Task 7: E2E-тесты, сюжетные снимки, производительность и до-ревью проверка паритета

**Files:**
- Modify: `app/tests/e2e/helpers.js`
- Modify: `app/tests/e2e/venues.spec.js`
- Modify: `app/tests/e2e/shots.spec.js`
- Modify: `app/tests/e2e/perf.spec.js`

- [x] **Step 1: Дополнить `helpers.js`, `venues.spec.js`, `shots.spec.js`, `perf.spec.js`**
  - В `app/tests/e2e/helpers.js` в цикле модификаторов `applyShot` добавить:
    ```js
    if (m === 'mf2') f.setHeight('MF', 2);
    if (m === 'selMF') f.select({ kind: 'rig', id: 'MF' });
    ```
  - В `app/tests/e2e/venues.spec.js` заменить тест `'студия: черновик без приборов'` (проверка пустого списка приборов остаётся в соседнем тесте Фойе!) на тесты Студии:
    1. открытие `#v=studio`: вкладки `rig`, `light`, `hall`, `layers`, `views` присутствуют; исходно `layout().id === 'folded'` (`0` мест), степперы в `.panel-layout` скрыты, `height('MF') === 4.5`; клик `.layout-btn[data-layout="unfolded"]` запускает анимацию и приводит к `40` местам в `seatsFabric.count`, пишет `lo` в хэш; переключение на `roof` и обратно сохраняет `unfolded` и опущенную высоту `MF = 2.0`;
    2. стресс и режимы: 10 циклов `folded ↔ unfolded` не увеличивают `geometries / textures / programs` больше чем на `2`; в режиме «чертёж» меши `hall` и `rigging` получают материалы чертежа; пятно прибора `№ 1` / `№ 4` при наведении на блитчер меняет высоту между `folded` и `unfolded`; выключение слоя `l-rigging` скрывает `layerGroups.rigging`; все 4 кнопки экспорта доступны на десктопе (2 на мобильном);
    3. телефон (`mobile.html#v=studio`): во всех вкладках (`rig`, `light`, `hall`, `views`, `layers`) и в карточках выбранной фермы `selMF` и прибора `№ 1` все видимые интерактивные элементы ≥ `44 × 44` px.
  - В `app/tests/e2e/shots.spec.js` расширить `EXTRA_SHOTS`:
    ```js
    studio: [
      'overview+lo-unfolded', 'hall+lo-unfolded', 'cycToExit+lo-unfolded',
      'plan+lo-unfolded+bp+dims', 'section+lo-unfolded+bp+dims',
      'overview+lo-unfolded+mf2', 'camera+mf2', 'overview+selMF',
    ],
    ```
  - В `app/tests/e2e/perf.spec.js` добавить `'studio:overview+lo-unfolded'` в `otherCases` (проверка бюджета треугольников ≤ `200 000` и вызовов ≤ `150` в самом тяжёлом состоянии Студии!).

- [x] **Step 2: Снять снимки Студии и визуально сверить рендеры с фотографиями `data/studio/`**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  $env:VENUE='studio'; $env:ROUND='studio-dev'; npm.cmd run shots
  Remove-Item Env:VENUE, Env:ROUND -ErrorAction SilentlyContinue
  ```
  Открыть через `read_file` рендеры `app/review/shots/studio-dev/desktop/studio/*.jpg` и `iphone/studio/*.jpg` и сверить с `data/studio/Фото/` и `data/studio/Блитчер/` (ориентация лестницы справа, оранжевые кресла и боковины, поручни на всех 4 ярусах в свёрнутом виде, отсутствие щелей и пробоев лучей, читаемость чертежа `+bp+dims`). При необходимости скорректировать ракурс `hall` или визуальные константы.

- [x] **Step 3: Запустить полную проверку `npm.cmd run check` и `parity.mjs compare`**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  npm.cmd run check
  node scripts/parity.mjs compare
  ```
  Expected: `npm.cmd run check` полностью зелёный (Vitest + однофайловая сборка ≤ 1,3 МБ + весь Playwright); `parity.mjs compare` — код `0` (100 % паритет `big`, `chamber`, `roof`).

- [x] **Step 4: Закоммитить и проверить счётчик 10-го коммита**
  ```powershell
  git add app/tests/e2e/helpers.js app/tests/e2e/venues.spec.js app/tests/e2e/shots.spec.js app/tests/e2e/perf.spec.js app/src/venues/fest-studio/
  git commit -m "Студия: E2E-тесты механики, блитчера, анимации, 44 px и сюжетные снимки"
  git rev-list --count HEAD
  ```

---

### Task 8: Приёмка субагентами — Раунд 1 (`multi-persona-review` → `app/review/studio-r1/`)

**Files:**
- Create: `app/review/studio-r1/model.md`, `app/review/studio-r1/ui-desktop.md`, `app/review/studio-r1/ui-mobile.md`, `app/review/studio-r1/lighting.md`, `app/review/studio-r1/decisions.md`

- [x] **Step 1: Подготовить снимки раунда `studio-r1` и поднять локальный dev-сервер**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  $env:VENUE='studio'; $env:ROUND='studio-r1'; npm.cmd run shots
  Remove-Item Env:VENUE, Env:ROUND -ErrorAction SilentlyContinue
  ```
  Запустить `npm.cmd run dev` фоновым демоном (`IsDaemon: true`) и запомнить порт (например, `http://localhost:5173`).

- [x] **Step 2: Параллельно запустить 4 независимых субагента-ревьюера по `.agents/skills/multi-persona-review/SKILL.md`**
  Вызвать `invoke_subagent` (`TypeName: "self"`, `Workspace: "inherit"` — код проекта менять запрещено, писать только свой отчёт и свои снимки в `app/review/studio-r1/<роль>-shots/`):
  1. **Архитектор / 3D-моделлер** (`Model: "flash"` — согласовано заказчиком) → `app/review/studio-r1/model.md`: сверить `dimensions.js`, `rigging.js`, `layouts.js`, снимки `studio-r1` и фото `data/studio/{Фото,Блитчер,Подвижная механика}` (зазоры рамы 30×30 до нижних ферм и выкружек циклорамы, лебёдки и цепи на `Ф3`/`Ф5`, блитчер свёрнутый/разложенный, отгиб всех 4 пар поручней, проход 1,45 м справа, отсутствие z-fighting).
  2. **Десктопный UI/UX** (`Model: "flash"`) → `app/review/studio-r1/ui-desktop.md`: проверить Playwright-сценарием на живом сервере переключение вкладок Механика / Свет / Зал / Слои / Виды, 3D-перетаскивание рамы за разные стороны, двухфазную анимацию блитчера туда/обратно, поиск приборов `1…15`, режим «Соло», чертёж с экспликацией, экспорт 4 форматов, ссылки состояния и память при переключении сцен.
  3. **Мобильный UI/UX** (`Model: "flash"`) → `app/review/studio-r1/ui-mobile.md`: проверить на iPhone 13 / Pixel 5 (портрет и альбом) размеры всех кнопок ≥ `44 × 44` px, шторку Bottom Sheet, выбор фермы тапом и перетаскивание пальцем, long-press 500 мс на фишках приборов, анимацию блитчера и отсутствие горизонтального переполнения.
  4. **Художник по свету / Завпост** (`Model: "pro"` — согласовано заказчиком) → `app/review/studio-r1/lighting.md`: сверить 15 приборов с `.docx`, схемой и фото, карточку и паспорт `Showlee BSW 200`, обрезку пятен `'pool-studio'` на полу, перед выкружкой циклорамы и на ярусах блитчера, а также программно выгрузить и проверить содержимое `planDXF`, `sectionDXF`, `dxf3d` и `glb` в разных состояниях (`folded`/`unfolded`, `MF = 4,50 / 1,50` м).
  - **Жёсткое правило промпта субагентов (`multi-persona-review` §5):** каждый пункт обязан содержать конкретное доказательство (путь открытого через `read_file` снимка/фото, замер в px, вывод `window.__fest` или строку DXF); фразы «нужно проверить / убедиться» запрещены; команды выполнять синхронно строго из `cd app` без оставления фоновых процессов. Отчёт без доказательств отклонять и перезапускать.

- [x] **Step 3: Остановить dev-сервер, свести `app/review/studio-r1/decisions.md` и СОГЛАСОВАТЬ с заказчиком (ТОЧКА ОСТАНОВКИ)**
  В `decisions.md` сгруппировать все замечания 4 ролей по приоритетам с вердиктом «Принято / Отклонено и почему», показать сводку и ключевые снимки заказчику и **дождаться его одобрения** перед правками.

- [x] **Step 4: Внедрить одобренные правки Раунда 1, прогнать `npm.cmd run check` + `parity.mjs compare` и закоммитить**
  Каждую поведенческую или геометрическую правку закрепить тестом в `studio.test.js` / `export.test.js` / `venues.spec.js`. Проверить счётчик 10-го коммита.

---

### Task 9: Приёмка субагентами — Раунд 2 (`app/review/studio-r2/`)

**Files:**
- Create: `app/review/studio-r2/model.md`, `app/review/studio-r2/ui-desktop.md`, `app/review/studio-r2/ui-mobile.md`, `app/review/studio-r2/lighting.md`, `app/review/studio-r2/decisions.md`

- [x] **Step 1: Переснять снимки `studio-r2`, поднять dev-сервер и запустить 4 субагентов повторного аудита**
  Каждая роль заполняет обязательную таблицу §2 «Проверка исправлений предыдущего раунда» (`Работает / Не работает / Частично` с доказательством) и проверяет отсутствие регрессий.

- [x] **Step 2: Свести `app/review/studio-r2/decisions.md`, согласовать с заказчиком остаточные правки (если есть), внедрить и закоммитить**
  Убедиться, что замечаний высокого приоритета = `0`, `npm.cmd run check` и `node scripts/parity.mjs compare` (`big`, `chamber`, `roof` = 100 %) проходят с кодом `0`. Проверить счётчик 10-го коммита.

---

### Task 10: Перевод `studio` в `ready`, включение в паритет (`parity.mjs`), документация и выпуск

**Files:**
- Modify: `app/src/venues/fest-studio/index.js` (`status: 'ready'`, убрать `meta.note`)
- Modify: `app/src/venues/catalog.js` (`studio`: `status: 'ready'`, `seats: 40`)
- Modify: `app/tests/e2e/venues.spec.js:31-37` (оставить проверку `'черновик'` только у `'foyer'`; для `'studio'` проверить `'40 мест'` и отсутствие `'черновик'`)
- Modify: `app/scripts/parity.mjs` (`VENUES.studio`, `applyScenario`)
- Modify: `ASSUMPTIONS.md`, `AGENTS.md`, `.agents/skills/venue-module-authoring/SKILL.md`

- [ ] **Step 1: Финальная сверка `big`, `chamber`, `roof` со старым эталоном `master` ПЕРЕД переключением `studio` в `ready`**
  Run: `cd app; npm.cmd run build; node scripts/parity.mjs compare`
  Expected: код `0` — 100 % гарантия, что за всё время работы три прежние готовые сцены не изменились ни на байт и ни на пиксель.

- [ ] **Step 2: Перевести `studio` в `status: 'ready'` (`index.js`, `catalog.js`), обновить `venues.spec.js` и добавить `studio` в `app/scripts/parity.mjs`**
  В `app/scripts/parity.mjs`:
  - в `VENUES` добавить:
    ```js
    studio: {
      layouts: true,
      shots: async (page) => [
        ...(await VENUES.chamber.shots(page)),
        'overview+lo-unfolded', 'hall+lo-unfolded', 'cycToExit+lo-unfolded',
        'plan+lo-unfolded+bp+dims', 'section+lo-unfolded+bp+dims',
        'overview+lo-unfolded+mf2', 'camera+mf2', 'overview+selMF',
      ],
      exports: ['default', 'lo-unfolded', 'lo-unfolded-mf2'],
      states: ['default', 'lo-unfolded', 'lo-unfolded-mf2', 'plan+bp+dims+grid', 'off+haze55'],
    },
    ```
  - в `applyScenario` добавить:
    ```js
    case 'lo-unfolded': f.setLayout({ id: 'unfolded' }); break;
    case 'lo-unfolded-mf2': f.setLayout({ id: 'unfolded' }); f.setHeight('MF', 2); break;
    case 'off+haze55': f.light('all', false); f.flag('hazeDensity', 0.55); break;
    ```

- [ ] **Step 3: Собрать проект, переснять полный 4-площадочный эталон паритета и пройти обязательную самопроверку (`AGENTS.md` §4 п. 3)**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  npm.cmd run build
  Remove-Item -Recurse -Force review/modular/baseline/dist-studio-ready -ErrorAction SilentlyContinue
  Copy-Item -Recurse dist review/modular/baseline/dist-studio-ready
  node scripts/parity.mjs capture review/modular/baseline/dist-studio-ready
  node scripts/parity.mjs compare review/modular/baseline/dist-studio-ready
  node scripts/parity.mjs compare
  ```
  Expected: оба вызова `compare` возвращают код `0`, в отчёте проверены все 4 площадки: `big, chamber, roof, studio` — `100 %`.

- [ ] **Step 4: Синхронно обновить `ASSUMPTIONS.md`, `AGENTS.md` и `.agents/skills/venue-module-authoring/SKILL.md`**
  - В `ASSUMPTIONS.md` §1.4: перевести заголовок на `статус ready`, убрать строку «Незавершённые блоки черновика», внести все фактические допущения Студии (отступ блитчера `0,15` м слева, пакет `1,07` м в свёрнутом виде, высота/отгиб поручней и полуступени, привязка 0-го ряда `d = −3,57` м, корпуса лебёдок `4,92…5,10` м, поперечные координаты `BSW200` на `Ф2`, условные номера приборов `1*…15*` и типовой паспорт `BSW200` в §1.6).
  - В `AGENTS.md` (шапка, §4 п. 3, §7 п. 2) и `.agents/skills/venue-module-authoring/SKILL.md` (§3, §5): обновить описание Студии как готовой площадки (`40 мест`, подъёмная ферма на 4 цепных лебёдках, телескопический блитчер с двухфазной анимацией, 15 приборов, полный экспорт DXF/GLB).

- [ ] **Step 5: Полная проверка `npm.cmd run check`, финальный коммит и полный 3-уровневый бэкап**
  Run:
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages\app"
  npm.cmd run check
  git add -A
  git commit -m "Студия мультимедиа: перевод в ready (40 мест, паритет 4 площадок, документация)"
  powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -Force
  ```
  Expected: `npm.cmd run check` зелёный; бэкап сообщает `VERIFIED (100% MATCH)` для рабочего зеркала и снимка, архив `.zip` проверен `tar.exe -tf`.

- [ ] **Step 6: Живой показ заказчику и слияние в `master` (ТОЧКА ОСТАНОВКИ)**
  Запустить `npm.cmd run dev` для итоговой проверки заказчиком (`desktop.html#v=studio`, `mobile.html#v=studio`, `index.html`). **Только после явного «ок» заказчика:**
  ```powershell
  cd "d:\Antigravity Projects\fest-3dmodels-and-stages"
  git checkout master
  git merge --no-ff studio-ready
  git push origin master
  ```
