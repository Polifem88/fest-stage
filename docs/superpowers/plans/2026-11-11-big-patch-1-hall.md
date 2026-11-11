# Большая сцена (`fest-big`) · Патч 1 (часть 2: Зрительный зал) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (режим **Native**: исполнитель выполняет задачи сам, последовательно, без субагентов на этапах разработки; единственный субагент — независимый ревьюер в Task 5 с `Model: 'inherit'`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить зрительный зал Большой сцены (`fest-big`) по натурным замерам и 15 фотографиям (`16,0 м` серый верхний объём `M.wallPanel`, зубчатые светло-бежевые ниши «ёлочкой» `2,30 / 0,85 м` под плавным карнизом `2,30 → 2,75 м` с 8 LED-лентами, гладкие боковые пандусы `9°`, спуск пола `-0,85 м` и косые двери `1,75 × 2,15 м` у портала, операторская `16,5 м` со скосами и выходные «кишки» `2,60 м`) во всех представлениях (3D, свет, 2D/3D DXF, GLB) с ревью субагентом `inherit` и живой приёмкой на локальном сервере.

**Architecture:** Все первичные замеры и флаги `assumption: true` хранятся в `app/src/venues/fest-big/config/dimensions.js`, а чистый параметрический модуль `app/src/venues/fest-big/config/hallGeometry.js` строит единый замкнутый контур стен/дверей/LED-лент и гладкие функции `hallFloorY(d, x)` и `hallCanopyY(d)` для 3D-построителя, трассировки лучей, шейдера пятен и CAD-экспорта. Светло-бежевые материалы создаются локально внутри `fest-big` без единой правки общих модулей `core/` и `engine/`, что гарантирует 100 % паритет готовых площадок `fest-chamber` и `fest-roof`.

**Tech Stack:** Three.js, Vite (`vite-plugin-singlefile`), Vitest, Playwright (Chromium + SwiftShader), PowerShell (`npm.cmd`).

**Spec:** `docs/superpowers/specs/2026-11-11-big-patch-1-hall-design.md` — единственный источник чисел и проектных решений. Натурное описание и фотографии: `data/big/Патч 1/Патч Зрительный зал.md` и фото в `data/big/Патч 1/` и `data/big/` (вне git).

## Global Constraints

- Соблюдать `AGENTS.md` без исключений: SSOT в `app/src/venues/fest-big/config/`, запрет «магических чисел» в `build/*` и `export/*` (мелкие визуальные зазоры деталей — только именованными константами в шапке файла), границы модулей (`tests/unit/boundaries.test.js`), бюджет однофайловой сборки `desktop.html` / `mobile.html` ≤ 1,3 МБ, `index.html` ≤ 0,1 МБ, тач-цели ≥ 44×44 px.
- **Общий код (`app/src/core/`, `app/src/engine/`, `app/src/systems/`, `app/src/ui/`, `app/src/library/`, `app/src/export/`) не изменять.** Паритет готовых площадок `chamber` и `roof` обязан оставаться 100 % побайтово и попиксельно (`node scripts/parity.mjs compare`).
- Порядок и идентификаторы механики (`RIGGING`), световых приборов (`FIXTURES`) и слоёв (`layers`) не менять — старые ссылки `#s=…` (v1) и `#v=big&s=…` (v2) обязаны открываться штатно.
- Каждое снятое или новое оценочное допущение синхронно фиксировать в `ASSUMPTIONS.md` в том же изменении.
- Среда Windows / PowerShell: каждая команда — новая сессия (`cd app;`), вызовы пакетного менеджера через `npm.cmd` / `npx.cmd`; для кириллицы в консоли при необходимости `[Console]::OutputEncoding=[Text.Encoding]::UTF8;`.
- Сообщения коммитов — на русском языке в стиле истории проекта: `Большая сцена, зал (этап N): …`.
- Регламент резервного копирования (`AGENTS.md` §5): после **каждого** коммита проверять `git rev-list --count HEAD`. Если счётчик кратен 10 (`% 10 === 0`, ближайший рубеж — коммит **№100**), немедленно выполнить `cd app; npm.cmd run backup` и убедиться в `VERIFIED (100% MATCH)` по зеркалу, снимку и проверке ZIP-архива.
- Не додумывать размеры при обнаружении противоречия между кодом и спецификацией — остановиться и задать вопрос пользователю со своей рекомендацией.

## Review Focus

1. **Трассировка сценических лучей при сужении зала до `16,0 м` (`±8,00 м`) при коробке сцены `17,0 м` (`±8,50 м`):** в `traceToFloor` (`build/floor.js`) луч при $d \ge 0$ обязан проверяться по $\pm\text{BOX\_HALF}$ (`±8,50 м`), а не по `HALL_HALF` (`±8,00 м`), иначе приборы галерей и софитов обрежутся в воздухе в полуметре от стен сцены (тест в Task 3).
2. **Прямое подчинение 8 LED-полос в `emitters.house`:** `Stage._applyFlags` (`engine/stage.js:544`) перебирает только `this.emitters.house.children` первого уровня; если завернуть 8 полос во вложенную `THREE.Group`, кнопка «Зал» перестанет их выключать (тест в Task 2).
3. **Основание боковых лестниц авансцены и портальной стены при спуске пола до `-0,85 м`:** призмы ступеней лестниц (`architecture.js:222`) и лицевая грань портала (`architecture.js:231`) обязаны опускаться до `-0,85 м` и закрывать нишу под карнизом `|X| = 8,00..8,20 м`, иначе нижняя ступень повиснет в воздухе на `10 см`, а у портала образуется сквозная щель (тест и снимок `frontStairLeft` / `frontDoorRight` в Task 2).
4. **Метрические `uv` на скатах потолка `ceilQuad` и ориентация односторонних граней (`FrontSide`):** без атрибута `uv` на `ceilQuad` серый материал `M.wallPanel` потеряет расшивку панелей `1,2 × 0,6 м`, а инвертированная нормаль на зубцах «ёлочки», карнизе или стенах «кишок» сделает грань невидимой изнутри зала либо перекроет обзор снаружи «кукольного домика» (тест `uv` и нормалей в Task 2 + камера `hallOutsideDollhouse`).
5. **Синхронность словаря материалов и `outerShellMats` в `export3d.js`:** `build3DDXF` и `buildGLB` создают собственный набор материалов `createExportMaterials()` — отсутствие `wallPanel`, `hallBeigePanel`, `hallCanopy`, `hallLedStrip` приведёт к падению экспорта, а невключение наружных стен/карниза в `outerShellMats` отправит глухую оболочку зала на неотключаемый слой `3D_HALL` вместо `3D_OUTER_WALLS` (тест в Task 4).

---

## Карта файлов

- **Создаются:**
  - `app/src/venues/fest-big/config/hallGeometry.js` — детерминированный расчёт узлов плана зала/операторской/выходов, проёмов дверей, позиций 8 LED-лент и функций `hallFloorY(d, x)`, `hallCanopyY(d)`, `inHallFloor(x, d)`, кусочно-линейной огибающей для GLSL.
  - `app/src/venues/fest-big/build/hallMaterials.js` — локальные светло-бежевые материалы Большой сцены (`hallBeigePanel`, `hallCanopy`, `hallLedStrip`) с кешированием по объекту `M`.
  - `app/tests/unit/big-hall.test.js` — целевые юнит-тесты геометрии зала, сцены Three.js, трассировки лучей и переключателей света.
  - `app/review/patch1-hall/closeups.mjs` и `app/review/patch1-hall/REPORT.md` — скрипт контрольных крупных планов зала и сводный отчёт визуальной сверки «до/после».
- **Изменяются:**
  - `app/src/venues/fest-big/config/dimensions.js` — новые параметры `DIM.hall`, `DIM.openings` (двери зала, выходов и операторской), реэкспорт обновлённого `hallFloorY(d, x)` и `hallCanopyY(d)`.
  - `app/src/venues/fest-big/build/architecture.js` — `buildHall`, основание лестниц авансцены и лицевой стены портала (`-0,85 м`), `ceilQuad` с `uv`, `buildSeats` (`seatWidth = 0,54`), `buildEmitters` (8 вертикальных LED-лент в `groups.house`).
  - `app/src/venues/fest-big/build/ambient.js` — 4 безтеневых `PointLight` подсветки ниш «ёлочки» в профиле `'full'`.
  - `app/src/venues/fest-big/build/floor.js` — `traceToFloor` (разделение стен сцены `±8,50 м` и зала, новый рельеф и контур пола) и `clipPoolsToFloor` (кусочно-линейная обрезка пятен света в зале).
  - `app/src/venues/fest-big/build/overlays.js` — размер `Зал 16 м` и вынос линии `Портал — операторская 18 м` за габарит «кишки».
  - `app/src/venues/fest-big/index.js` — уточнение центра/высоты ортогональных видов `plan` и `section` под новую глубину `-20,34 м`.
  - `app/src/venues/fest-big/export/dxf2d.js` и `app/src/venues/fest-big/export/export3d.js` — 2D-план, 2D-разрез, 3D-DXF и GLB по новой геометрии.
  - `app/tests/unit/config.test.js`, `app/tests/unit/export.test.js`, `ASSUMPTIONS.md`.

---

### Task 0: Подготовка — эталон паритета с `master`, скрипт крупных планов зала и снимки «до»

**Files:**
- Create: `app/review/patch1-hall/closeups.mjs`
- Create: `app/review/patch1-hall/REPORT.md`

- [x] **Step 1: Снять свежий эталон паритета с актуального `master` и проверить самосовпадение 100 %**

Run:
```powershell
cd app; git status --short; git checkout master; npm.cmd run build
Copy-Item -Recurse -Force dist review/modular/baseline/dist-pre-hall
node scripts/parity.mjs capture review/modular/baseline/dist-pre-hall
node scripts/parity.mjs compare review/modular/baseline/dist-pre-hall
git checkout big-patch-1-hall
```
Expected: `compare` завершается с кодом `0` и выводит `Паритет: ПРОЙДЕН` по площадкам `big`, `chamber`, `roof`; рабочая ветка возвращена на `big-patch-1-hall`.

- [x] **Step 2: Создать скрипт контрольных крупных планов зала `app/review/patch1-hall/closeups.mjs`**

По образцу `app/review/patch1/closeups.mjs` (Playwright Chromium с `CHROME_ARGS` из `scripts/parity.mjs`, окно `1600×1000`, открытие `<distDir>/desktop.html#v=big`, ожидание `window.__fest.ready`): скрипт принимает `<distDir> <outDir>` и сохраняет PNG по 10 целевым ракурсам зала (координаты `[x, y, d]`, а для `sawtoothLedsOff` перед кадром выключает зальный свет через `window.__fest.stage.setFlag('house', false)` и затем возвращает `true`):

| Имя кадра | `pos` | `target` | Узел контроля |
|---|---|---|---|
| `frontDoorRight` | `[3.2, 1.3, -2.4]` | `[8.4, 0.3, -1.0]` | Правая косая дверь `1,75×2,15 м`, пол `-0,85 м`, `15 см` до карниза `+1,45 м`, стык с порталом |
| `frontStairLeft` | `[-2.8, 1.2, -3.6]` | `[-6.8, -0.4, -0.8]` | Левая лестница авансцены на уклоне `-0,75 → -0,85 м` (ступени не висят) |
| `aisleStepsLeft` | `[-7.5, 0.4, -4.6]` | `[-7.1, 0.2, -9.5]` | Треугольные торцы ступеней рядов у гладкого левого пандуса `9°` |
| `sawtoothLedsRight` | `[5.2, 1.4, -3.5]` | `[8.4, 1.3, -11.0]` | 4 зуба «ёлочки» справа, светло-бежевые панели, карниз и 4 горящие LED-полосы |
| `sawtoothLedsOff` | `[5.2, 1.4, -3.5]` | `[8.4, 1.3, -11.0]` | Тот же ракурс при выключенной кнопке «Зал» (`house = false`) — LED-полосы погашены |
| `boothCornerRight` | `[4.8, 2.5, -13.5]` | `[8.8, 2.2, -18.8]` | Фронт операторской `16,5 м`, скос `1,24 м` с дверью, примыкание серой стены `±8,0 м` и карниза |
| `exitPocketRight` | `[7.8, 2.3, -14.2]` | `[10.6, 2.1, -20.2]` | Раструб `45°` (`5,25 м`), горизонтальный тамбур `2,60 м`, торцевая двойная дверь выхода и потолок ниши |
| `stageToHallWide` | `[0.0, 2.0, 3.8]` | `[0.0, 1.8, -13.0]` | Общий вид со сцены в зал: пропорции `16 м`, серые стены и потолок `M.wallPanel`, проходы |
| `hallFromBooth` | `[0.0, 3.6, -17.4]` | `[0.0, 1.2, -2.0]` | Вид от операторской на портал, ряды кресел, ложи и прострелы на стенах `±8,0 м` |
| `hallOutsideDollhouse` | `[18.5, 8.0, -11.0]` | `[0.0, 1.8, -11.0]` | Внешний вид «кукольного домика» справа: односторонние внешние стены прозрачны снаружи, без перевёрнутых граней |

- [x] **Step 3: Снять кадры «до» и завести `app/review/patch1-hall/REPORT.md`**

Run:
```powershell
cd app; node review/patch1-hall/closeups.mjs review/modular/baseline/dist-pre-hall review/patch1-hall/before
```
Expected: 10 PNG-файлов созданы в `app/review/patch1-hall/before/` (папка `review/*/*.png` игнорируется git); создать `app/review/patch1-hall/REPORT.md` со списком исходных ракурсов и базовых метрик.

- [x] **Step 4: Закоммитить скрипт контроля и шаблон отчёта**

```powershell
git add app/review/patch1-hall/closeups.mjs app/review/patch1-hall/REPORT.md
git commit -m "Большая сцена, зал (этап 0): скрипт контрольных крупных планов зала"
git rev-list --count HEAD
```
(Проверить счётчик коммитов на кратность 10.)

---

### Task 1: Конфиг `dimensions.js`, параметрическое ядро `hallGeometry.js` и синхронизация `ASSUMPTIONS.md`

**Files:**
- Modify: `app/src/venues/fest-big/config/dimensions.js`
- Create: `app/src/venues/fest-big/config/hallGeometry.js`
- Modify: `app/tests/unit/config.test.js`
- Create: `app/tests/unit/big-hall.test.js`
- Modify: `ASSUMPTIONS.md`

**Interfaces:**
- Produces in `app/src/venues/fest-big/config/dimensions.js`:
  - `DIM.hall`: `width: 16.0`, `portalToBoothWall: 18.0`, `rakeDeg: 9`, `firstRowGap: 2.15`, `rows: 15`, `seatsPerRow: 26`, `rowPitch: 0.80` (`assumption: true`), `seatWidth: 0.54` (`seatWidthAssumption: true`), `stepMargin: 0.04` (`stepMarginAssumption: true`), `frontCornerFloorY: -0.85`, `canopyHeightAtPortal: 2.30`, `canopyHeightMain: 2.75`, `canopyFasciaH: 0.16` (`canopyFasciaAssumption: true`), `nicheMinDepth: 0.20`, `nicheMaxDepth: 0.70`, `sawtoothStartD: -2.30`, `sawtoothTeeth: 4`, `sawtoothLong: 2.30`, `sawtoothShort: 0.85`, `ledStripW: 0.04`, `ledStripD: 0.025`, `exitFlareAngleDeg: 45` (`exitFlareAngleAssumption: true`), `exitFlareLen: 5.25`, `exitStraightLen: 2.60`, `exitBackWallW: 2.60`, `boothFrontWidth: 16.50`, `boothSideLen: 1.70`, `ceilingY: 7.5`, `ceilingSlopeTo: -6.0`, `houseLights`, `nicheLightsX` / `nicheLightsD` (для 4 точек мягкой подсветки ниш в `full`-профиле).
  - `DIM.openings`:
    - `portalDoors: { width: 1.75, height: 2.15, sillY: -0.85 }` (заменяет старые `2.2 × 2.0`);
    - `hallExitDoors: { width: 1.75, height: 2.15, widthAssumption: true }`;
    - `boothDoors: { width: 0.90, height: 2.05, assumption: true }`.
  - Производные экспорты: `HALL_HALF` (`= 8.0`), `STEP_HALF_X` (`= 7.06`), `hallFloorY(d, x = 0)`, `hallCanopyY(d)`.
- Produces in `app/src/venues/fest-big/config/hallGeometry.js`:
  - `HALL_CONTOUR_RIGHT`: упорядоченный массив именованных узлов `{ id, x, d }` правой стороны (`P0`, `P1`, `Z0`, `V1`, `Z1`, `V2`, `Z2`, `V3`, `Z3`, `V4`, `Z4`, `E1`, `E2`, `B3`, `B2`, `B1`).
  - `hallSideWallSegments(side)` (`side ∈ {-1, +1}`): список сегментов нижней стены `{ id, kind: 'beige' | 'panel', x0, d0, x1, d1, door: null | { width, height, leaves: 1 | 2, sillY } }`.
  - `hallLedCorners(side)`: 4 внутренних угла «ёлочки» `{ x, d, y0, y1, nx, nd }` (`nx, nd` — единичная биссектриса внутрь зала).
  - `hallOuterXAtD(d)` и `hallInnerMinXAtD(d)`: точные кусочно-линейные границы пола зала $|X| \in [\text{innerMinX}(d),\; \text{outerX}(d)]$ на $d \in [E_2.d,\; 0]$ (при $d > -18{,}0$: `innerMinX = 0`, кроме выреза авансцены на $d \in [-2{,}75;\; 0]$; при $d \le -18{,}0$: `innerMinX` идёт по скосу `B1 → B2` и боковине `B2 → B3` операторской).
  - `inHallFloor(x, d)`, `stairBottomX(d)`, `hallRampY(d)`, `hallFloorY(d, x = 0)`, `hallCanopyY(d)`.

- [x] **Step 1: Написать падающие юнит-тесты геометрии зала в `app/tests/unit/big-hall.test.js` и обновить проверки в `app/tests/unit/config.test.js`**

Создать `app/tests/unit/big-hall.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { DIM, HALL_HALF, STEP_HALF_X, rowFrontD } from '../../src/venues/fest-big/config/dimensions.js';
import {
  HALL_CONTOUR_RIGHT,
  hallLedCorners,
  hallFloorY,
  hallCanopyY,
  inHallFloor,
} from '../../src/venues/fest-big/config/hallGeometry.js';

describe('Большая сцена · геометрия зрительного зала (Патч 1, часть 2)', () => {
  it('верхняя ширина зала 16,0 м, ступени ±7,06 м под 26 креслами по 0,54 м', () => {
    expect(DIM.hall.width).toBe(16.0);
    expect(HALL_HALF).toBe(8.0);
    expect(DIM.hall.seatWidth).toBe(0.54);
    expect(STEP_HALF_X).toBeCloseTo(7.06, 4);
  });

  it('контур нижних стен, ёлочки, кишок и операторской замыкается без невязки', () => {
    const byId = Object.fromEntries(HALL_CONTOUR_RIGHT.map((p) => [p.id, p]));
    expect(byId.P0).toMatchObject({ x: 8.2, d: 0 });
    expect(Math.hypot(byId.P1.x - byId.P0.x, byId.P1.d - byId.P0.d)).toBeCloseTo(1.75, 4);
    expect(byId.Z0.x).toBeCloseTo(8.2, 4);
    expect(byId.Z0.d).toBeCloseTo(-2.3, 4);
    for (let k = 1; k <= 4; k++) {
      const zPrev = byId[`Z${k - 1}`], v = byId[`V${k}`], zNext = byId[`Z${k}`];
      expect(v.x).toBeCloseTo(8.7, 4);
      expect(zNext.x).toBeCloseTo(8.2, 4);
      expect(Math.hypot(v.x - zPrev.x, v.d - zPrev.d)).toBeCloseTo(2.3, 4);
      expect(Math.hypot(zNext.x - v.x, zNext.d - v.d)).toBeCloseTo(0.85, 4);
    }
    expect(byId.Z4.d).toBeCloseTo(-14.0295, 3);
    expect(Math.hypot(byId.E1.x - byId.Z4.x, byId.E1.d - byId.Z4.d)).toBeCloseTo(5.25, 4);
    expect(byId.E1.x).toBeCloseTo(11.9123, 3);
    expect(byId.E1.d).toBeCloseTo(-17.7418, 3);
    expect(byId.E1.d - byId.E2.d).toBeCloseTo(2.6, 4);
    expect(byId.E2.x - byId.B3.x).toBeCloseTo(2.6, 4);
    expect(byId.B2.d - byId.B3.d).toBeCloseTo(1.7, 4);
    expect(byId.B1.x).toBeCloseTo(8.25, 4);
    expect(byId.B1.d).toBeCloseTo(-18.0, 4);
    expect(Math.hypot(byId.B2.x - byId.B1.x, byId.B2.d - byId.B1.d)).toBeCloseTo(1.2412, 3);
  });

  it('карниз C1-гладкий от +1,45 м у портала до +2,00 м у 2-го ряда и +3,91 м в тамбуре', () => {
    expect(hallCanopyY(0)).toBeCloseTo(1.45, 4);
    expect(hallCanopyY(rowFrontD(1))).toBeCloseTo(2.0, 4);
    const eps = 1e-4;
    const slopeLeft = (hallCanopyY(rowFrontD(1) - eps) - hallCanopyY(rowFrontD(1))) / eps;
    const slopeRight = (hallCanopyY(rowFrontD(1)) - hallCanopyY(rowFrontD(1) + eps)) / eps;
    expect(slopeRight).toBeCloseTo(slopeLeft, 3);
    expect(hallCanopyY(-19.5) - hallFloorY(-19.5, 10.5)).toBeCloseTo(2.75, 3);
  });

  it('пол зала: ступени по центру, гладкий пандус в проходах, -0,85 у передних дверей, горизонт у выходов', () => {
    expect(hallFloorY(0, 8.0)).toBeCloseTo(-0.85, 4);
    expect(hallFloorY(-1.5, 8.45)).toBeCloseTo(-0.85, 3);
    expect(hallFloorY(-2.75, 7.5)).toBeCloseTo(-0.75, 4);
    expect(hallFloorY(-5.3, 0)).toBeCloseTo(-0.75, 4); // 1-й ряд без ступени
    // в середине 5-го ряда центр ступенчатый, а проход выше переднего края ступени по гладкому уклону
    const dMid = rowFrontD(4) - 0.4;
    expect(hallFloorY(dMid, 0)).toBeGreaterThan(hallFloorY(dMid, 7.8));
    expect(hallFloorY(rowFrontD(4) - 0.8 + 1e-5, 0)).toBeCloseTo(hallFloorY(rowFrontD(4) - 0.8, 7.8), 3);
    // горизонтальный тамбур перед выходными дверями
    expect(hallFloorY(-18.0, 10.5)).toBeCloseTo(hallFloorY(-20.2, 10.5), 4);
    expect(inHallFloor(10.5, -19.5)).toBe(true);
    expect(inHallFloor(0, -19.5)).toBe(false); // внутри операторской пола зала нет
  });

  it('по 4 LED-ленты с каждой стороны от пола пандуса до низа карниза', () => {
    for (const side of [-1, 1]) {
      const leds = hallLedCorners(side);
      expect(leds).toHaveLength(4);
      for (const c of leds) {
        expect(Math.abs(c.x)).toBeCloseTo(8.7, 4);
        expect(c.y1 - c.y0).toBeCloseTo(2.75, 2);
      }
    }
  });
});
```

В `app/tests/unit/config.test.js`:
- в тесте `прострелы (sideTowers) и их приборы перенесены на серую часть стены` заменить старую константу `woodTopY` на `hallCanopyY(t.d) + DIM.hall.canopyFasciaH` и проверять превышение над верхом новых дверей `DIM.hall.frontCornerFloorY + DIM.openings.portalDoors.height` (`-0.85 + 2.15 = 1.30 м`);
- в тесте `все приборы внутри здания` проверять сценические приборы (`f.mount.d >= 0`) по `DIM.box.width / 2` (`8.50`), а зальные (`f.mount.d < 0`) — по `DIM.hall.width / 2` (`8.00`).

- [x] **Step 2: Запустить юнит-тесты и убедиться, что новые проверки падают**

Run: `cd app; npx.cmd vitest run tests/unit/big-hall.test.js tests/unit/config.test.js`
Expected: FAIL (`Cannot find module ... hallGeometry.js`).

- [x] **Step 3: Реализовать `hallGeometry.js`, обновить `dimensions.js` и синхронизировать `ASSUMPTIONS.md`**

В `app/src/venues/fest-big/config/dimensions.js` и `app/src/venues/fest-big/config/hallGeometry.js` реализовать формулы строго по разделу 3 и разделу 4 спецификации `2026-11-11-big-patch-1-hall-design.md` (`hallFloorY(d, x = 0)` при вызове с одним аргументом `d` сохраняет поведение по оси `x = 0` для обратной совместимости). В `ASSUMPTIONS.md` обновить раздел Большой сцены согласно разделу 6 спецификации.

- [x] **Step 4: Запустить юнит-тесты и убедиться в прохождении**

Run: `cd app; npm.cmd test`
Expected: PASS по всем юнит-тестам.

- [x] **Step 5: Закоммитить конфиг, геометрическое ядро и реестр допущений**

```powershell
git add app/src/venues/fest-big/config/dimensions.js app/src/venues/fest-big/config/hallGeometry.js app/tests/unit/big-hall.test.js app/tests/unit/config.test.js ASSUMPTIONS.md
git commit -m "Большая сцена, зал (этап 1): конфиг 16 м, параметрический контур зала и реестр допущений"
git rev-list --count HEAD
```

---

### Task 2: 3D-архитектура зала, локальные материалы и 8 светодиодных полос (`hallMaterials.js`, `architecture.js`, `ambient.js`)

**Files:**
- Create: `app/src/venues/fest-big/build/hallMaterials.js`
- Modify: `app/src/venues/fest-big/build/architecture.js`
- Modify: `app/src/venues/fest-big/build/ambient.js`
- Test: `app/tests/unit/big-hall.test.js`

**Interfaces:**
- Consumes: `DIM`, `HALL_HALF`, `STEP_HALF_X`, `HALL_CONTOUR_RIGHT`, `hallSideWallSegments`, `hallLedCorners`, `hallFloorY`, `hallCanopyY`, `stairBottomX` из `config/`.
- Produces:
  - `getHallMaterials(M)` в `build/hallMaterials.js` → `{ hallBeigePanel, hallCanopy, hallLedStrip }` (кешируется через `WeakMap` по объекту `M`; если `M` уже содержит одноимённые материалы из `createExportMaterials()`, возвращает их напрямую!).
  - `HALL_BACK_FLOOR_Y` в `build/architecture.js` (`= hallFloorY(-DIM.hall.portalToBoothWall, 0)`, сохраняет экспорт для `index.js`, `overlays.js`, `dxf2d.js`).
  - Обновлённые `buildArchitecture(batch, M)`, `buildSeats(M)`, `buildEmitters(M, dutyRows)` и `ambientLights(plan, em)`.

- [x] **Step 1: Добавить в `app/tests/unit/big-hall.test.js` падающие тесты на 3D-сборку зала, UV потолка, 8 LED-лент и нормали**

В `app/tests/unit/big-hall.test.js` добавить блок `3D-сборка зрительного зала`:
```js
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { DUTY_ROWS } from '../../src/venues/fest-big/config/rigging.js';
import { buildArchitecture, buildSeats, buildEmitters } from '../../src/venues/fest-big/build/architecture.js';
import { ambientLights } from '../../src/venues/fest-big/build/ambient.js';

function fakeMats() {
  return new Proxy({}, {
    get(t, k) {
      if (!(k in t)) t[k] = new THREE.MeshStandardMaterial({ name: String(k) });
      return t[k];
    },
  });
}

describe('Большая сцена · 3D-сборка зала и свет', () => {
  it('потолок зала использует wallPanel и имеет метрические UV-координаты', () => {
    const M = fakeMats();
    const batch = new StaticBatch();
    buildArchitecture(batch, M);
    const built = batch.build();
    let ceilFound = false;
    built.hall.traverse((o) => {
      if (o.isMesh && o.userData?.tag === 'ceiling') {
        ceilFound = true;
        expect(o.material.name).toBe('wallPanel');
        expect(o.geometry.getAttribute('uv')).toBeTruthy();
      }
    });
    expect(ceilFound).toBe(true);
  });

  it('emitters.house содержит прямым потомком меш 8 вертикальных LED-лент с userData.emitter = house', () => {
    const M = fakeMats();
    const em = buildEmitters(M, DUTY_ROWS);
    const houseEmitters = em.groups.house.children.filter((c) => c.userData?.emitter === 'house');
    expect(houseEmitters.length).toBeGreaterThanOrEqual(2); // потолочные лампы + 8 LED-лент в углах ёлочки
    const ambFull = ambientLights('full', em);
    const ambLite = ambientLights('lite', em);
    expect(ambFull.house.length).toBe(7); // 3 потолочных SpotLight + 4 безтеневых PointLight ниш
    expect(ambLite.house.length).toBe(1); // мобильный профиль без утяжеления
  });

  it('buildSeats строит 390 кресел с шагом 0,54 м внутри ±7,06 м', () => {
    const M = fakeMats();
    const [iF] = buildSeats(M);
    expect(iF.count).toBe(390);
    const p = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < iF.count; i++) {
      iF.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(Math.abs(p.x) + DIM.hall.seatWidth / 2).toBeLessThanOrEqual(STEP_HALF_X + 1e-4);
    }
  });
});
```

- [x] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd app; npx.cmd vitest run tests/unit/big-hall.test.js`
Expected: FAIL (`ceiling` использует старый материал `decoCeiling`/`hallCeiling` без `uv`, `houseEmitters` содержит только 1 меш).

- [x] **Step 3: Создать `build/hallMaterials.js`, перестроить `buildHall`/`buildEmitters` в `build/architecture.js` и подсветку ниш в `build/ambient.js`**

Ключевые требования к реализации:
1. **`build/hallMaterials.js`:** процедурная Canvas-текстура вертикальных/продольных реек светло-бежевого тона (`#c8b191` с мягкими бороздами `#b29978`, `wrapS = wrapT = RepeatWrapping`) для `hallBeigePanel`, матовый `hallCanopy` (`0xdfd6c7`, `roughness: 0.85`, `side: THREE.FrontSide`) и самосветящийся `hallLedStrip` (`color: 0xfff5e4`, `emissive: 0xffdfad`, `emissiveIntensity: 1.5`). Если `M.hallBeigePanel` уже передан извне (`export3d.js`), использовать готовый материал из `M`.
2. **Портал и лестницы авансцены в `build/architecture.js`:**
   - низ призм ступеней боковых лестниц (`prism(pts, ...)`) опустить с `-FSH` до `DIM.hall.frontCornerFloorY` (`-0.85`);
   - зрительскую грань портала (`d = 0`) расширить до `-BOX_HALF .. +BOX_HALF` и опустить `b0` до `DIM.hall.frontCornerFloorY` (`-0.85`).
3. **Пол зала в `buildHall` (`tag: 'hallFloor'`):**
   - передние углы `d ∈ [-2.75, 0]` снаружи `stairBottomX(d)` до ломаной стены `P0 → P1 → Z0 → (8.30, -2.75)`: регулярная триангулированная сетка по $(u, d)$ с высотами `hallFloorY(d, x)` и нормалями вверх (`+Y`);
   - партер `d ∈ [-5.70, -2.75]` и 1-й ряд: ровная поверхность `Y = -0.75` от левой до правой зубчатой стены;
   - ступени рядов 2..15 (`i = 1..14`): горизонтальные проступи и передние подступенки строго на `[-STEP_HALF_X, +STEP_HALF_X]` плюс **треугольные боковые щёчки** на $X = \pm\text{STEP\_HALF\_X}$ (от `hallFloorY(d, ±(STEP_HALF_X + 0.01))` внизу до `Y_row(i)` вверху, нормаль наружу $\pm X$);
   - боковые пандусы `9°` (`|X| > STEP_HALF_X`, `d ∈ [-17.7418, -5.70]`), задний проход за 15-м рядом (`d ∈ [-17.7418, -16.90]`) и горизонтальные тамбуры выходов + зона перед операторской (`d ∈ [-20.3418, -17.7418]`): единая сшитая триангуляция по узлам `HALL_CONTOUR_RIGHT` с высотами `hallFloorY(d, x)`.
4. **Стены, двери, карниз и потолок в `buildHall`:**
   - все нижние грани `hallSideWallSegments(side)` строить от фактического пола `hallFloorY(d, x)` внизу до `hallCanopyY(d)` вверху с метрическими `uv` (длина вдоль грани × высота $Y$) и нормалями строго внутрь зала (`FrontSide` — прозрачны снаружи «кукольного домика»), с `tag: 'hallWall'`;
   - проёмы и створки с коробками и ручками: 2 косые двойные двери у портала (`1,75 × 2,15 м` на $P_0 \to P_1$), 2 двойные двери выходов (`1,75 × 2,15 м` по центру стен $E_2 \to B_3$) и 2 однопольные двери в операторскую (`0,90 × 2,05 м` по центру скосов $B_1 \to B_2$);
   - подшив карниза (`hallCanopy`, нормаль вниз `-Y`, `tag: 'ceiling'`) между $|X| = 8{,}00\text{ м}$ и внешним контуром от $d = 0$ до $d = -18{,}00\text{ м}$, потолок выходных тамбуров на $Y = +3{,}9072\text{ м}$ на участке $d = -17{,}7418 \dots -20{,}3418\text{ м}$ и вертикальная фаска карниза высотой `0,16 м` по $|X| = 8{,}00\text{ м}$;
   - верхние стены зала ($X = \pm 8{,}00\text{ м}$, от `hallCanopyY(d) + 0.16` до `hallCeilingY(d)`), передняя стена операторской ($d = -18{,}00\text{ м}$, $X \in [-8{,}25;\; +8{,}25]$ с окном рубки) и верхние части скосов/боковин операторской до потолка — из `M.wallPanel` с метрическими `uv` и `tag: 'hallWall'`;
   - все секции `ceilQuad` потолка зала (`prof[0]..prof[3]`) переводятся на `M.wallPanel` с добавлением атрибута `uv` в метрах (`tag: 'ceiling'`).
5. **8 вертикальных LED-полос и мягкая подсветка ниш:**
   - в `buildEmitters` по `hallLedCorners(-1)` и `hallLedCorners(+1)` собрать 8 вертикальных призм `0,04 × 0,025 м` в один меш `hallLedMesh` с материалом `hallLedStrip`, `hallLedMesh.userData.emitter = 'house'`, добавить прямым потомком в `groups.house`;
   - в `build/ambient.js` при `plan === 'full'` добавить в массив `house` 4 безтеневых `THREE.PointLight(0xffe6bf, 0, 4.2, 1.6)` (`userData.base = 14`) в нишах «ёлочки» (по 2 на каждую сторону — между 1–2 и 3–4 впадинами на полувысоте ниши).

- [x] **Step 4: Запустить юнит-тесты и снять проверочные крупные планы**

Run:
```powershell
cd app; npm.cmd test
npm.cmd run build
node review/patch1-hall/closeups.mjs dist review/patch1-hall/step2
```
Expected: все юнит-тесты PASS; визуально проверить все 10 снимков в `app/review/patch1-hall/step2/` через `read_file` (нет щелей у портала и лестниц, чёткие треугольные торцы ступеней у гладкого пандуса, расшивка `M.wallPanel` на стенах и потолке, 8 LED-лент горят в `sawtoothLedsRight` и гаснут в `sawtoothLedsOff`, снаружи в `hallOutsideDollhouse` стены прозрачны за счёт `FrontSide`).

- [x] **Step 5: Закоммитить 3D-архитектуру, материалы и свет**

```powershell
git add app/src/venues/fest-big/build/hallMaterials.js app/src/venues/fest-big/build/architecture.js app/src/venues/fest-big/build/ambient.js app/tests/unit/big-hall.test.js
git commit -m "Большая сцена, зал (этап 2): 3D-геометрия ёлочки, карниза, пандусов, выходов и 8 LED-полос"
git rev-list --count HEAD
```

---

### Task 3: Световые пятна, трассировка лучей, размерные выноски и виды камер (`floor.js`, `overlays.js`, `index.js`)

**Files:**
- Modify: `app/src/venues/fest-big/build/floor.js`
- Modify: `app/src/venues/fest-big/build/overlays.js`
- Modify: `app/src/venues/fest-big/index.js`
- Test: `app/tests/unit/big-hall.test.js`

**Interfaces:**
- Consumes: `hallFloorY`, `hallCanopyY`, `inHallFloor`, `hallOuterXAtD`, `hallInnerMinXAtD` из `config/hallGeometry.js`.
- Produces: обновлённые `traceToFloor(p, dir)` и `clipPoolsToFloor(mat)` в `build/floor.js`, `buildDims(labels)` в `build/overlays.js` и `VIEWS` в `index.js`.

- [x] **Step 1: Добавить в `app/tests/unit/big-hall.test.js` падающие тесты на `traceToFloor` и размерные выноски**

```js
import { traceToFloor } from '../../src/venues/fest-big/build/floor.js';
import { buildDims } from '../../src/venues/fest-big/build/overlays.js';

describe('Большая сцена · трассировка лучей и оверлеи зала', () => {
  const down = new THREE.Vector3(0, -1, 0);

  it('луч на сцене при x = 8,2 м (между 8,0 м зала и 8,5 м коробки) попадает в планшет, а не в стену зала', () => {
    const hit = traceToFloor(new THREE.Vector3(7.0, 5.0, -3.0), new THREE.Vector3(1.2, -5.0, 0).normalize());
    expect(hit.floor).toBe(true);
    expect(hit.point.y).toBeCloseTo(0, 3);
  });

  it('вертикальные лучи в зале попадают точно в ступень, пандус, угол -0,85 и тамбур выхода', () => {
    expect(traceToFloor(new THREE.Vector3(8.0, 3.0, 0.5), down).point.y).toBeCloseTo(-0.85, 3); // z = +0.5 -> d = -0.5
    expect(traceToFloor(new THREE.Vector3(7.8, 4.0, 10.0), down).point.y).toBeCloseTo(hallFloorY(-10.0, 7.8), 3);
    expect(traceToFloor(new THREE.Vector3(10.5, 5.0, 19.5), down).point.y).toBeCloseTo(hallFloorY(-19.5, 10.5), 3);
    // за пределами контура зала пол не ловится
    expect(traceToFloor(new THREE.Vector3(11.5, 5.0, 10.0), down).floor).toBe(false);
  });
});
```

- [x] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd app; npx.cmd vitest run tests/unit/big-hall.test.js`
Expected: FAIL (старый `traceToFloor` режет сценический луч на `x = 8.0`, не знает `x`-зависимости `hallFloorY` и тамбура `x = 10.5`).

- [x] **Step 3: Обновить `floor.js`, `overlays.js` и `index.js`**

1. **`build/floor.js`:**
   - в `traceToFloor(p, dir)` итерации пересечения с полом зала вызывать `hallFloorY(-qq.z, qq.x)` и принимать точку при `inHallFloor(qq.x, -qq.z)`;
   - при проверке боковых стен: если точка пересечения имеет $d = -q.z \ge 0$ — проверять плоскость $\pm\text{BOX\_HALF}$ (`±8.50`); если $d < 0$ — проверять верхнюю стену $\pm\text{HALL\_HALF}$ (`±8.00`) при $q.y \ge \text{hallCanopyY}(d)$ и внешнюю границу ниши при $q.y < \text{hallCanopyY}(d)$; добавить также отсечение о заднюю стену зала ($d = -18{,}00$ на $|x| \le 8{,}25$ и торцевую стену выхода $d = -20{,}3418$);
   - в `clipPoolsToFloor(mat)` для `vZone >= 0.5` генерировать из узлов `HALL_CONTOUR_RIGHT` кусочно-линейную GLSL-проверку `ax > hallMaxX(pd) || ax < hallMinX(pd) || pd < E2.d`.
2. **`build/overlays.js`:**
   - размер `Зал 16 м` между `-HALL_HALF` и `+HALL_HALF`;
   - продольную выноску `Портал — операторская 18 м` сместить по $X$ наружу за выходной карман (`E1.x + 0.65 ≈ 12.56 м`), чтобы линия не проходила сквозь «кишку».
3. **`index.js`:**
   - обновить ортогональные виды `plan` (`center: [0, 0, -5.0], height: 33`) и `section` (`center: [0, 3.6, -5.0], height: 19.5`), чтобы торцевые двери на `d = -20.34 м` и ниши ворот на `d = +10.30 м` полностью входили в кадр.

- [x] **Step 4: Проверить прохождение юнит-тестов**

Run: `cd app; npm.cmd test`
Expected: PASS.

- [x] **Step 5: Закоммитить обновления света на полу, выносок и камер**

```powershell
git add app/src/venues/fest-big/build/floor.js app/src/venues/fest-big/build/overlays.js app/src/venues/fest-big/index.js app/tests/unit/big-hall.test.js
git commit -m "Большая сцена, зал (этап 3): обрезка пятен света, трассировка лучей, размеры и охват видов"
git rev-list --count HEAD
```

---

### Task 4: 2D-чертежи плана/разреза, 3D-экспорт DXF/GLB и полная проверка `npm run check`

**Files:**
- Modify: `app/src/venues/fest-big/export/dxf2d.js`
- Modify: `app/src/venues/fest-big/export/export3d.js`
- Modify: `app/tests/unit/export.test.js`
- Modify: `app/review/patch1-hall/REPORT.md`

**Interfaces:**
- Consumes: `HALL_CONTOUR_RIGHT`, `hallSideWallSegments`, `hallLedCorners`, `hallFloorY`, `hallCanopyY`, `STEP_HALF_X` из `config/`.
- Produces: синхронизированные `buildPlanDXF`, `buildSectionDXF`, `build3DDXF`, `buildGLB`.

- [ ] **Step 1: Добавить падающие тесты на 2D/3D-экспорт зала в `app/tests/unit/export.test.js`**

Добавить проверки для Большой сцены (`fest-big`):
- `buildPlanDXF(null)` содержит актуальную дверь у портала `1,75×2,15` и не содержит устаревшую `2,2×2,0`; содержит подпись верхнего габарита зала `16`;
- `buildSectionDXF(null)` не содержит ошибок и отражает профиль карниза и пола `-0,85`;
- `build3DDXF(null)` успешно строится, содержит слои `3D_OUTER_WALLS` и `3D_HALL`, причём меши с материалами `wallPanel`, `hallBeigePanel`, `hallCanopy` попадают в `3D_OUTER_WALLS`;
- `await buildGLB(null)` возвращает непустой `ArrayBuffer` (`byteLength > 10000`).

- [ ] **Step 2: Запустить `export.test.js` и убедиться в падении новых проверок**

Run: `cd app; npx.cmd vitest run tests/unit/export.test.js`
Expected: FAIL (в плане всё ещё `2,2×2,0`, в `export3d.js` нет новых материалов в `createExportMaterials` / `outerShellMats`).

- [ ] **Step 3: Обновить `export/dxf2d.js` и `export/export3d.js`**

1. **`export/export3d.js`:**
   - добавить в `createExportMaterials()` материалы `wallPanel` (`0x6f737a`), `hallBeigePanel` (`0xc8b191`), `hallCanopy` (`0xdfd6c7`), `hallLedStrip` (`0xffdfad`);
   - включить `'wallPanel'`, `'hallBeigePanel'`, `'hallCanopy'` в `outerShellMats` и `'hallWall'` в `outerShellTags`;
   - обновить 3D-оси зала в начале `build3DDXF` под новую геометрию.
2. **`export/dxf2d.js`:**
   - **План (`buildPlanDXF`):** расширить координатную сетку и габариты листа под `d = -20,34 м` и `|X| = 11,91 м`; вместо старого прямоугольника `-HW..HW` построить полилинию контура нижних стен по `HALL_CONTOUR_RIGHT` для обеих сторон, пунктиром `DASHED` линию нависающего карниза / верхних серых стен `X = ±8,00 м`, ступени рядов строго на `[-STEP_HALF_X, +STEP_HALF_X]`, условные обозначения косых передних дверей `1,75×2,15 м`, торцевых выходных дверей `1,75×2,15 м`, однопольных дверей в скосах операторской `0,90×2,05 м`, 8 точек угловых LED-полос, ложи и прострелы на стенах `±8,00 м` и вынесенные за контур размерные цепочки;
   - **Разрез (`buildSectionDXF`):** расширить сетку по `d` до `-21`; показать ступенчатый профиль по оси зала, пунктиром — гладкий пандус бокового прохода `9°` с выполаживанием на `d = -17,74..-20,34 м` и спуск переднего угла до `-0,85 м` у портала, плавную линию низа карниза `hallCanopyY(d)` (`+1,45 → +2,00 → +3,91 м`) и контур операторской.

- [ ] **Step 4: Прогнать полную проверку проекта `npm.cmd run check`, переснять `shots`, `closeups` и проверить паритет `chamber` / `roof`**

Run:
```powershell
cd app; npm.cmd run check
$env:VENUE='big'; npm.cmd run shots; Remove-Item Env:VENUE
node review/patch1-hall/closeups.mjs dist review/patch1-hall/after
node scripts/parity.mjs compare review/modular/baseline/dist-pre-hall
```
Expected:
- `npm.cmd run check` полностью зелёный (Vitest, single-file build ≤ 1,3 МБ, все E2E Playwright, кнопки ≥ 44 px, FPS);
- в `review/modular/parity-report.md` площадки **`chamber` и `roof` — 100 % совпадение (все ✅)**, расхождения только у `big`;
- просмотреть обновлённые снимки `shots` и все 10 кадров `review/patch1-hall/after/`, заполнить `app/review/patch1-hall/REPORT.md` таблицей соответствия всех 12 пунктов ТЗ файлам кода и снимкам «до/после».

- [ ] **Step 5: Закоммитить экспорт и сводный отчёт**

```powershell
git add app/src/venues/fest-big/export/dxf2d.js app/src/venues/fest-big/export/export3d.js app/tests/unit/export.test.js app/review/patch1-hall/REPORT.md
git commit -m "Большая сцена, зал (этап 4): 2D/3D DXF, GLB и сводный отчёт проверки"
git rev-list --count HEAD
```
(Проверить правило 10-го коммита.)

---

### Task 5: Независимое ревью патча субагентом уровня `inherit`

**Files:**
- Create: `app/review/patch1-hall/REVIEW.md` (создаётся ревьюером или сохраняется по его отчёту)
- Modify: файлы `fest-big` / `ASSUMPTIONS.md` (только при наличии замечаний ревьюера)

- [ ] **Step 1: Вызвать субагента-ревьюера с `Model: 'inherit'`**

Вызвать `invoke_subagent` со строгими параметрами (по прямому требованию заказчика и правилу приоритета `AGENTS.md` §8):
- `TypeName: 'self'`
- `Model: 'inherit'`
- `Role: 'Ревьюер патча зрительного зала'`
- `Prompt`:
  > Проведи независимое техническое и визуальное ревью ветки `big-patch-1-hall` (`git diff master...big-patch-1-hall`) проекта «ФЭСТ · 3D-каталог сцен» (`d:\Antigravity Projects\fest-3dmodels-and-stages`).
  > 1. Прочитай `AGENTS.md`, `ASSUMPTIONS.md`, первоисточник `data/big/Патч 1/Патч Зрительный зал.md`, посмотри фотографии зала в `data/big/Патч 1/` и `data/big/`, затем изучи утверждённую спецификацию `docs/superpowers/specs/2026-11-11-big-patch-1-hall-design.md`.
  > 2. Пункт за пунктом (1–12) сверь ТЗ и спецификацию с кодом в `app/src/venues/fest-big/` — составь таблицу «пункт ТЗ / спецификации → файл:строка → статус ✅/❌».
  > 3. Просмотри все крупные планы в `app/review/patch1-hall/after/` (и при необходимости сними собственные ракурсы через `window.__fest.setCamera`) и проверь геометрическую целостность: отсутствие щелей у портала, боковых лестниц `-0,85 м`, косых дверей `1,75×2,15 м`, карниза `+1,45 → +2,00 → +3,91 м`, треугольных торцов ступеней у пандусов, выходов `2,60 м` и скосов операторской; отсутствие вывернутых односторонних граней (`FrontSide`), z-fighting и висящих деталей; работу 8 вертикальных LED-лент от кнопки «Зал»; расшивку `M.wallPanel` на верхних стенах и потолке.
  > 4. Проверь экспорт 2D-плана, 2D-разреза, 3D-DXF и GLB, корректность `traceToFloor` (включая отсутствие обрезки сценических лучей при `d ≥ 0`), неизменность общего кода (`git diff master...big-patch-1-hall -- app/src/core app/src/engine app/src/systems app/src/ui app/src/library app/src/export` должен быть пустым), актуальность `ASSUMPTIONS.md` и 100 % паритет `chamber` и `roof` в `app/review/modular/parity-report.md`.
  > 5. Сам код не изменяй: запиши подробный отчёт (критичные / важные / мелкие замечания и итоговый вердикт «готово к показу заказчику / нужны правки») в `app/review/patch1-hall/REVIEW.md` и верни резюме.

- [ ] **Step 2: Отработать замечания ревьюера (навык `superpowers:receiving-code-review`)**

После получения ответа ревьюера:
- все критичные и важные замечания устранить в коде; спорные архитектурные вопросы (если ревьюер нашёл расхождение со спецификацией) вынести пользователю;
- при внесении правок повторно выполнить `cd app; npm.cmd run check`, переснять `after`-кадры и перепроверить паритет `chamber` / `roof` = 100 %.

- [ ] **Step 3: Закоммитить отчёт ревью и правки по ревью**

```powershell
git add app/review/patch1-hall/REVIEW.md app/review/patch1-hall/REPORT.md app/src/venues/fest-big app/tests ASSUMPTIONS.md
git commit -m "Большая сцена, зал (этап 5): ревью патча (inherit) и устранение замечаний"
git rev-list --count HEAD
```
(Проверить правило 10-го коммита: если `HEAD` кратен 10 — выполнить `cd app; npm.cmd run backup`.)

---

### Task 6: Поднятие локального сервера, личная проверка пользователем и финальный выпуск

**Files:**
- Modify (при правках от пользователя): файлы в `app/src/venues/fest-big/` и `ASSUMPTIONS.md`

- [ ] **Step 1: Поднять локальный сервер для личной проверки пользователем**

Запустить фоновый dev-сервер Vite (`IsDaemon: true` в `run_command`):
```powershell
cd app; npm.cmd run dev -- --host 127.0.0.1 --port 5173
```
Проверить доступность `http://127.0.0.1:5173/desktop.html#v=big` (и `http://127.0.0.1:5173/mobile.html#v=big`), кратко представить пользователю итоги `REPORT.md`, вердикт `REVIEW.md` и живые ссылки, после чего **остановиться и ждать личной проверки пользователя**.

- [ ] **Step 2: Внести возможные поправки по результатам живого осмотра**

Если пользователь просит скорректировать детали геометрии, материалов, света или подписей:
- внести изменения через конфиг `dimensions.js` / `hallGeometry.js` / построители (синхронно обновив `ASSUMPTIONS.md` и экспорт);
- убедиться, что dev-сервер отдаёт обновлённую сцену для повторного осмотра, прогнать `cd app; npm.cmd run check` и закоммитить правки (`Большая сцена, зал: поправки по живой проверке` + контроль 10-го коммита).
- повторять до явного подтверждения пользователя, что зрительный зал принят.

- [ ] **Step 3: Остановить dev-сервер, переснять финальный эталон паритета и влить ветку в `master` (только после явного «ок» пользователя)**

После явного подтверждения пользователя на выпуск:
1. Остановить фоновую задачу dev-сервера (`manage_task` `kill`).
2. Собрать свежий `dist` и переснять полный эталон паритета всех `ready`-площадок с обязательной самопроверкой 100 %:
   ```powershell
   cd app; npm.cmd run build
   Copy-Item -Recurse -Force dist review/modular/baseline/dist-post-hall
   node scripts/parity.mjs capture review/modular/baseline/dist-post-hall
   node scripts/parity.mjs compare review/modular/baseline/dist-post-hall
   node scripts/parity.mjs compare
   npm.cmd run check
   ```
   Expected: оба вызова `parity.mjs compare` возвращают код `0` (`Паритет: ПРОЙДЕН` по `big`, `chamber`, `roof`), `npm.cmd run check` полностью зелёный.
3. Слить `big-patch-1-hall` в `master` (и выполнить `git push`, если пользователь подтвердил публикацию) и проверить счётчик коммитов (`git rev-list --count HEAD % 10 === 0` → `cd app; npm.cmd run backup`).
