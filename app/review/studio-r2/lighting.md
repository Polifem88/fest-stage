# Отчёт Отраслевого эксперта — Художник по свету / Завпост (Раунд 2)

**Роль:** Роль 4 — Отраслевой эксперт (Художник по свету / Завпост)  
**Тестируемые площадки и платформы:** Студия мультимедиа (`studio`, `http://localhost:5173/desktop.html#v=studio`), проверка регрессии палитры Большой сцены (`big`, `http://localhost:5173/desktop.html#v=big`)  
**Дата и коммит:** 25.11.2026, ветка `studio-ready`, коммит `e210e22`

---

## 1. Кратко: что и как проверено

1. **Аудит обновлённого кода и документации:**
   - Изучены решения Раунда 1 [`decisions.md`](../studio-r1/decisions.md) и отчёт [`studio-r1/lighting.md`](../studio-r1/lighting.md).
   - Прочитаны обновлённые файлы модуля `fest-studio`: [`dimensions.js`](../../src/venues/fest-studio/config/dimensions.js), [`fixtures.js`](../../src/venues/fest-studio/config/fixtures.js), [`floor.js`](../../src/venues/fest-studio/build/floor.js), [`dxf2d.js`](../../src/venues/fest-studio/export/dxf2d.js), [`export3d.js`](../../src/venues/fest-studio/export/export3d.js), а также [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md).
2. **Визуальная приёмка рендеров Раунда 2 (`studio-r2`):**
   - Открыты и проверены через `read_file` рендеры из [`app/review/shots/studio-r2/desktop/studio/`](../shots/studio-r2/desktop/studio/): `01-overview.jpg`, `03-camera.jpg`, `07-plan.jpg`, `10-section_bp_dims.jpg`, `11-plan_bp_grid.jpg`, `12-overview_off_house.jpg`, `14-overview_lo-unfolded.jpg`, `17-plan_lo-unfolded_bp_dims.jpg`, `18-section_lo-unfolded_bp_dims.jpg`, `20-camera_mf2.jpg`.
3. **Инструментальный контроль в Playwright и разбор выгрузок DXF / GLB:**
   - Написан и синхронно выполнен скрипт [`verify-r2.mjs`](lighting-shots/verify-r2.mjs) по `http://localhost:5173/desktop.html#v=studio` и `#v=big` (`Errors: 0`), полные метрики сохранены в [`verify-r2-results.json`](lighting-shots/verify-r2-results.json).
   - Открыты через `read_file` все 12 диагностических скриншотов в [`lighting-shots/`](lighting-shots/): `diag-r2-front.jpg`, `diag-r2-cyc-fillet.jpg`, `pool-r2-bleacher-folded.jpg`, `pool-r2-bleacher-unfolded.jpg`, `set-r2-front.jpg`, `set-r2-spot.jpg`, `set-r2-sides.jpg`, `set-r2-cyc.jpg`, `card-r2-4-bsw200.jpg`, `card-r2-6-prof100.jpg`, `duty-r2-only.jpg`, `all-r2-off.jpg`.
   - Через меню «Экспорт» выгружены и разобраны по кодам DXF и бинарной структуре GLB **все 4 формата × 3 состояния** (`A-folded-4.50`, `B-unfolded-4.50`, `C-unfolded-1.50`) в [`lighting-shots/exports/`](lighting-shots/exports/).

---

## 2. Проверка исправлений предыдущего раунда

| № | Пункт исправлений | Статус | Комментарий и доказательства |
|---|---|---|---|
| П. 4 (`decisions.md`) | Новое наведение фронта `№ 1–3` (исключить выход конусов за стены `±3,05` м) и плавный скос ширины `FLOOR` на стыке `d = 0` | **Работает** | В [`fixtures.js`](../../src/venues/fest-studio/config/fixtures.js#L97-L99) цели `№ 1–3` перенесены ближе к оси: `[-0,45; 0; 0,30]`, `[0; 0; 0,50]`, `[+0,45; 0; 0,30]`. По [`verify-r2-results.json`](lighting-shots/verify-r2-results.json) у всех 15 приборов `maxWallBreach = 0` (у `№ 1/3` было `0,49` м в R1), а `maxCycBreach` снизился с `1,4161` до `0,6314` м. В [`floor.js`](../../src/venues/fest-studio/build/floor.js#L194-L197) для `d ∈ [-0,50; 0,00]` добавлен плавный скос `halfW = mix(2.325, 3.050, clamp(-pd / 0.50, 0.0, 1.0))`. На [`diag-r2-front.jpg`](lighting-shots/diag-r2-front.jpg) и [`07-plan.jpg`](../shots/studio-r2/desktop/studio/07-plan.jpg) ступенька пятна на `d = 0` исчезла, кромки не выходят за стены, а [`diag-r2-cyc-fillet.jpg`](lighting-shots/diag-r2-cyc-fillet.jpg) подтверждает отсутствие прорезания скруглений `R = 0,70`. |
| П. 5 (`decisions.md`) | Снижение яркости дежурки (`11 / 28`) и повышение `poolK` (`0,68 / 0,74`) для читаемости световых пятен на блитчере | **Частично** | В [`dimensions.js`](../../src/venues/fest-studio/config/dimensions.js#L183) `ambient.duty` снижен с `16 / 42` до `full: 11, lite: 28`, в [`floor.js`](../../src/venues/fest-studio/build/floor.js#L61) `poolK` поднят с `0,45 / 0,50` до `0,68` (`CYC`) и `0,74` (остальные). Замер яркости на `overview`: `allOff` `mean = 9,92, std = 7,12` ([`all-r2-off.jpg`](lighting-shots/all-r2-off.jpg)); `dutyOnly` снизился с `65,71 / 78,78` (R1) до `58,70 / 70,86` ([`duty-r2-only.jpg`](lighting-shots/duty-r2-only.jpg)); `allOn` — `59,23 / 71,81` ([`01-overview.jpg`](../shots/studio-r2/desktop/studio/01-overview.jpg)). На основном полу и циклораме ([`07-plan.jpg`](../shots/studio-r2/desktop/studio/07-plan.jpg)) пятна заметно контрастнее, перенос пятен на ярусы блитчера работает (`zone = 1`, `throw = 3,9424 / 4,2791` м на [`pool-r2-bleacher-unfolded.jpg`](lighting-shots/pool-r2-bleacher-unfolded.jpg) против `zone = 0`, `4,8771 / 4,9172` м на [`pool-r2-bleacher-folded.jpg`](lighting-shots/pool-r2-bleacher-folded.jpg)). Однако при включённых 7 точечных источниках дежурки суммарный прирост `luma` всего кадра от сценического света по-прежнему `< 1 %` (`+0,53` к `mean`), поэтому на блитчере при включённой «Дежурке» пятна читаются слабо; для наводки на трибуну требуется отключать дежурный свет или включать «Соло». |
| П. 7 (`decisions.md`) | Устранение дублирования `CommuPack 24` в карточках паспортов и компактные названия в `GROUP_SETS` | **Работает** | В [`fixtures.js`](../../src/venues/fest-studio/config/fixtures.js#L49-L54) `GROUP_SETS` заданы как `['Фронт', 'BSW 200', 'Профили', 'Циклорама']` (в DOM: `Фронт · 3`, `BSW 200 · 2`, `Профили · 2`, `Циклорама · 8`, без обрезаний на [`card-r2-4-bsw200.jpg`](lighting-shots/card-r2-4-bsw200.jpg) и `set-r2-*.jpg`). В `powerOf()` / `lineText()` ([`fixtures.js`](../../src/venues/fest-studio/config/fixtures.js#L126-L132)) и в карточках [`card-r2-4-bsw200.jpg`](lighting-shots/card-r2-4-bsw200.jpg), [`card-r2-6-prof100.jpg`](lighting-shots/card-r2-6-prof100.jpg) строка `Питание` содержит `свитчер CommuPack 24 (номер линии не указан)`, а `Линии группы` — `пульт ETC Cobalt Congo Kid` (без повтора свитчера). |
| П. 9 (`decisions.md`) | Доработка 2D CAD (`dxf2d.js`): поворот блоков по наведению и отступ `7*` в `planDXF`, 3 знака `ФП` со смещением под раму и группировка приборов в `sectionDXF` | **Работает** | В `planDXF` ([`dxf2d.js`](../../src/venues/fest-studio/export/dxf2d.js#L227-L232)) блоки приборов развёрнуты по вектору `(aim − mount)`: у боковых профилей `№ 6/7` заданы `code 50 = -57° / +57°` (`№ 1..3`: `-9° / 0° / 9°`, `№ 4..5`: `-5° / 5°`, `№ 8..15`: `-59° / -87° / -171° / -178° / 178° / 171° / 87° / 59°`); подписи у правой стены сдвинуты внутрь на `x = 2,42` (`7* (2,42; -0,39)`, `14* (2,42; 2,71)`, `15* (2,42; 0,81)`). В `sectionDXF` ([`dxf2d.js`](../../src/venues/fest-studio/export/dxf2d.js#L374-L375)): `ФП (+4,500 м)` при `mfH = 4,50 > 4,1` м вынесена под раму (`y = 4,28`), `ФП (+1,500 м)` при `1,50` м — над рамой (`y = 1,88`). В [`dxf2d.js`](../../src/venues/fest-studio/export/dxf2d.js#L406-L421) контуры приборов сгруппированы без дублей (`FIXTURES`: `24` линии вместо `60`) с 6 подписями (`1*-3*`, `4*-5*`, `6*-7*`, `8*,15*`, `9*,14*`, `10*-13*`). |
| П. 1 и 10 (`decisions.md`, контроль смежных правок) | Разнесение выносок на 2D-видах чертежа (`section`/`plan`) и сдвиг 0-го ряда `row0D` до `-3,60` м в экспортах | **Работает** | На [`10-section_bp_dims.jpg`](../shots/studio-r2/desktop/studio/10-section_bp_dims.jpg) и [`18-section_lo-unfolded_bp_dims.jpg`](../shots/studio-r2/desktop/studio/18-section_lo-unfolded_bp_dims.jpg) метка `ФП` перенесена в пролёт `Ф3–Ф4` и не наезжает на лебёдку, подписи `Глубина 12,6 м` и `ФП 5 м` не накладываются на красную сетку; на [`11-plan_bp_grid.jpg`](../shots/studio-r2/desktop/studio/11-plan_bp_grid.jpg) и [`17-plan_lo-unfolded_bp_dims.jpg`](../shots/studio-r2/desktop/studio/17-plan_lo-unfolded_bp_dims.jpg) `d = 0 — передний край циклорамы` не обрезается шапкой. Сдвиг `row0D = -3,60` м ([`dimensions.js`](../../src/venues/fest-studio/config/dimensions.js#L137)) отразился в `planDXF` (`seatDs = [-7,57; -6,62; -5,67; -4,72; -3,6]`) и `sectionDXF` (`standsXMin = 3,39` вместо `3,36`), без пересечения с `ФП` в [`14-overview_lo-unfolded.jpg`](../shots/studio-r2/desktop/studio/14-overview_lo-unfolded.jpg). |
| П. 3 (`decisions.md`, свет на шторках) | Коррекция материала боковых шторок блитчера `hallCurtains` | **Работает** | На [`01-overview.jpg`](../shots/studio-r2/desktop/studio/01-overview.jpg) и [`14-overview_lo-unfolded.jpg`](../shots/studio-r2/desktop/studio/14-overview_lo-unfolded.jpg) шторки блитчера отображаются оранжевыми в тон кресел, без тёмно-коричневого провала в тени ярусов. |
| П. 4 (R1 `lighting.md`, перенесено в Task 10) | Актуализация §1.4 [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md) по новому развесу, допущениям приборов и `row0D` | **Отложено (план Task 10)** | По [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md#L79-L91) §1.4 пока содержит статус `draft` (`FIXTURES = []`, `layouts: null`, `exports: {}`). Согласно [`decisions.md`](../studio-r1/decisions.md) обновление выполняется синхронно с переводом в `status: 'ready'` в финальном Task 10. |

---

## 3. Что работает хорошо

### 3.1. Обновлённая таблица всех 15 приборов (`window.__fest.stage.fixtures.list`)
Все 15 приборов проверены в браузере в состоянии по умолчанию (`folded`, `ФП = +4,50` м), данные взяты из [`verify-r2-results.json`](lighting-shots/verify-r2-results.json#L3-L484):

| № | Тип (`type`) | Группа | Линия | `mount (x; y; d)` | `aim (x; y; d)` | `world.throw`, м | `spotDiam` (`rCone`), м | Полуоси пятна, м | `onFloor` | `maxWallBreach`, м | `assumed` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `PROF_CW` | `FRONT` | `Ф1` | `-1,75; 5,18; -7,55` | `-0,45; 0; +0,30` | `9,1023` | `4,2028` (`2,1014`) | `3,972 × 2,101` | `true` | **`0`** | `true` |
| 2 | `PROF_CW` | `FRONT` | `Ф1` | `0; 5,18; -7,55` | `0; 0; +0,50` | `9,1814` | `4,2394` (`2,1197`) | `4,041 × 2,120` | `true` | **`0`** | `true` |
| 3 | `PROF_CW` | `FRONT` | `Ф1` | `+1,75; 5,18; -7,55` | `+0,45; 0; +0,30` | `9,1023` | `4,2028` (`2,1014`) | `3,972 × 2,101` | `true` | **`0`** | `true` |
| 4 | `BSW200` | `SPOT` | `Ф2` | `-1,35; 5,18; -5,70` | `-0,80; 0; +0,80` | `7,8825` | `2,2156` (`1,1078`) | `1,854 × 1,108` | `true` | `0` | `true` (`assumption`) |
| 5 | `BSW200` | `SPOT` | `Ф2` | `+1,35; 5,18; -5,70` | `+0,80; 0; +0,80` | `7,8825` | `2,2156` (`1,1078`) | `1,854 × 1,108` | `true` | `0` | `true` (`assumption`) |
| 6 | `PROF100_RGB` | `SIDE_L` | `Н-2.70` | `-2,70; 3,23; -0,55` | `+0,60; 0; +1,60` | `4,7375` | `2,1875` (`1,0937`) | `1,801 × 1,094` | `true` | `0` | `true` (`assumption`) |
| 7 | `PROF100_RGB` | `SIDE_R` | `Н2.70` | `+2,70; 3,23; -0,55` | `-0,60; 0; +1,60` | `4,7375` | `2,1875` (`1,0937`) | `1,801 × 1,094` | `true` | `0` | `true` (`assumption`) |
| 8 | `BEYE640` | `CYC` | `Д-2.70` | `-2,70; 5,18; +0,65` | `-1,80; 0; +1,20` | `4,8523` | `1,8864` (`0,9432`) | `0,965 × 0,943` | `true` | `0` | `true` |
| 9 | `BEYE640` | `CYC` | `Д-2.70` | `-2,70; 5,18; +2,55` | `-1,80; 0; +2,60` | `4,8221` | `1,8746` (`0,9373`) | `0,953 × 0,937` | `true` | `0` | `true` |
| 10 | `BEYE640` | `CYC` | `Ф6` | `-1,80; 5,18; +3,65` | `-1,60; 0; +2,40` | `4,9014` | `1,9055` (`0,9527`) | `0,985 × 0,953` | `true` | `0` | `true` |
| 11 | `BEYE640` | `CYC` | `Ф6` | `-0,60; 5,18; +3,65` | `-0,55; 0; +2,40` | `4,8976` | `1,9040` (`0,9520`) | `0,983 × 0,952` | `true` | `0` | `true` |
| 12 | `BEYE640` | `CYC` | `Ф6` | `+0,60; 5,18; +3,65` | `+0,55; 0; +2,40` | `4,8976` | `1,9040` (`0,9520`) | `0,983 × 0,952` | `true` | `0` | `true` |
| 13 | `BEYE640` | `CYC` | `Ф6` | `+1,80; 5,18; +3,65` | `+1,60; 0; +2,40` | `4,9014` | `1,9055` (`0,9527`) | `0,985 × 0,953` | `true` | `0` | `true` |
| 14 | `BEYE640` | `CYC` | `Д2.70` | `+2,70; 5,18; +2,55` | `+1,80; 0; +2,60` | `4,8221` | `1,8746` (`0,9373`) | `0,953 × 0,937` | `true` | `0` | `true` |
| 15 | `BEYE640` | `CYC` | `Д2.70` | `+2,70; 5,18; +0,65` | `+1,80; 0; +1,20` | `4,8523` | `1,8864` (`0,9432`) | `0,965 × 0,943` | `true` | `0` | `true` |

### 3.2. «Соло», карточки паспортов, ракурсы и регрессия Большой сцены
- **Режимы «Соло» (`GROUP_SETS`):** кнопки корректно изолируют все 4 набора с чистыми подписями в UI ([`set-r2-front.jpg`](lighting-shots/set-r2-front.jpg) → `[1, 2, 3]`, `luma: 12,76 / 16,89`; [`set-r2-spot.jpg`](lighting-shots/set-r2-spot.jpg) → `[4, 5]`, `luma: 11,05 / 12,14`; [`set-r2-sides.jpg`](lighting-shots/set-r2-sides.jpg) → `[6, 7]`, `luma: 10,54 / 10,52`; [`set-r2-cyc.jpg`](lighting-shots/set-r2-cyc.jpg) → `[8..15]`, `luma: 12,54 / 18,94`).
- **Сценические ракурсы без регрессий:** вид со стороны операторской на циклораму ([`03-camera.jpg`](../shots/studio-r2/desktop/studio/03-camera.jpg)), при опущенной ферме `ФП = +2,00` м ([`20-camera_mf2.jpg`](../shots/studio-r2/desktop/studio/20-camera_mf2.jpg)) и при выключенной дежурке ([`12-overview_off_house.jpg`](../shots/studio-r2/desktop/studio/12-overview_off_house.jpg)) корректно показывают заливку циклорамы, перекрестие фронта, профили и дымку; при опускании `ФП` до `2,00` м все 15 приборов остаются на своих стационарных фермах (`mount.on = null`).
- **Регрессия палитры на Большой сцене (`#v=big`):** по [`verify-r2-results.json`](lighting-shots/verify-r2-results.json#L2112-L2117) получено `totalTypes: 31`, `hasBSW200: false`, `GAL_LAMP_index: 30`, `GAL_LAMP_color: "#6b6b6b"`. Локальный `BSW200` не просочился в общий справочник и не сдвинул цвета Большой сцены.

### 3.3. Выгрузки DXF / GLB во всех 3 состояниях после правок Раунда 2
Результаты по 12 выгруженным файлам ([`verify-r2-results.json`](lighting-shots/verify-r2-results.json#L748-L2110)):

| Формат / Параметр | Состояние A (`folded`, `MF = 4,50` м) | Состояние B (`unfolded`, `MF = 4,50` м) | Состояние C (`unfolded`, `MF = 1,50` м) |
|---|---|---|---|
| **`planDXF`** | `37 699` Б, `AC1009`, `ANSI_1251`, `$INSUNITS=6`, `EOF`, `SEAT: 0`, `~ 4,3 кВт`, `ФП (H=+4,50 м)`, поворот `№ 6/7 = -57°/+57°`, подписи `7*, 14*, 15*` на `x = 2,42` | `41 840` Б, `40` блоков `SEAT` (`seatDs = [-7,57; -6,62; -5,67; -4,72; -3,6]`), `~ 4,3 кВт`, `ФП (H=+4,50 м)` | `41 840` Б, `40` блоков `SEAT` (`row0D = -3,60`), `ФП (H=+1,50 м)` |
| **`sectionDXF`** | `17 714` Б, `AC1009`, `ANSI_1251`, `EOF`, `ФП (+4,500 м)` (`y = 4,28`), `FIXTURES: 24 LINE`, 6 групповых меток (`1*-3*`…`10*-13*`), `standsXMin = 6,83`, `CYC ARC (-3,275; 0,70; R=0,70)` | `21 032` Б, `STANDS: 73 LINE`, `standsXMin = 3,39` (учёт `row0D = -3,60`), `ФП (+4,500 м)` (`y = 4,28`), отметки `±0,000`…`+5,650` | `21 032` Б, `ФП (+1,500 м)` (`y = 1,88` над рамой), `standsXMin = 3,39`, все 6 групповых подписей приборов на месте |
| **`dxf3d`** | `719 489` Б, `EOF`, `3D_RIGGING`: `528 3DFACE + 4 LINE`, `Z ∈ [4,500; 5,205]` (без `hit`), `3D_HALL: 2832 3DFACE` | `1 078 495` Б, `3D_RIGGING Z ∈ [4,500; 5,205]`, `3D_HALL: 5712 3DFACE` | `1 078 495` Б, `3D_RIGGING Z ∈ [1,500; 5,205]`, `3D_HALL: 5712 3DFACE` |
| **`glb`** | `1 564 720` Б, `glTF v2`, `21 372` треуг., `0 NaN`, `0` вырожденных, `anyDoubleSidedTrue: false` (19 мат.), узлы `Seats_0`, `MovableTruss_H4_50`, `Fixture_1..15` | `1 772 104` Б, `24 252` треуг., `0 NaN`, `0` вырожденных, узлы `Seats_40`, `MovableTruss_H4_50` | `1 772 104` Б, `24 252` треуг., `0 NaN`, `0` вырожденных, узлы `Seats_40`, `MovableTruss_H1_50` |

---

## 4. Замечания и проблемы

### Высокий приоритет (Блокирует выпуск / Искажает данные)
Критических блокирующих ошибок в световом развесе, фотометрических расчётах, паспортах, изоляции справочника и выгрузках DXF / GLB не выявлено.

### Средний приоритет (Удобство / Документация)
1. **Актуализация [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md) §1.4 перед переводом площадки в `ready` (запланировано на Task 10):**
   - **Доказательство:** в [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md#L79-L91) площадка `fest-studio` всё ещё описана в статусе `draft` без развеса (`FIXTURES = []`, `layouts: null`, `exports: {}`), тогда как в коде уже введены `LOCAL_SPECS.BSW200`, условные номера `1*..15*` (`assumed: true`), координаты `№ 4–5` на `Ф2` и `№ 6–7` на `Н±2,70` (`assumption: true`), `AIM_NOTE`, отсутствие номеров линий свитчера `CommuPack 24` и уточнение `row0D = -3,60` м / `sideSplayDeg`.
   - **Предложение:** обновить §1.4 в рамках Task 10 строго синхронно со сменой `status: 'ready'`.
2. **Ограниченный контраст пятен сценического света на разложенном блитчере при включённой «Дежурке»:**
   - **Доказательство:** по [`verify-r2-results.json`](lighting-shots/verify-r2-results.json#L485-L498) после правок `dutyOnly` (`mean = 58,70, std = 70,86`) и `allOn` (`mean = 59,23, std = 71,81`) по-прежнему различаются менее чем на `1 %` глобальной яркости кадра, поэтому на [`pool-r2-bleacher-unfolded.jpg`](lighting-shots/pool-r2-bleacher-unfolded.jpg) при включённой дежурке пятна `№ 1/4` на ярусах видны на пределе читаемости.
   - **Рекомендация:** с точки зрения физики освещения павильона 7 потолочных рабочих светильников действительно забивают 2 направленных прибора на серо-оранжевой трибуне, и штатный рабочий сценарий художников по свету — отключение тумблера «Дежурка» ([`12-overview_off_house.jpg`](../shots/studio-r2/desktop/studio/12-overview_off_house.jpg)) или режим «Соло». Считать ли это допустимым балансом для дежурного света или ещё снизить `ambient.duty` (например до `8 / 20`) — на усмотрение основного разработчика перед релизом; правка не блокирует приёмку.

### Низкий приоритет (Полировка / На будущее)
1. **Точность отметки `ФП` в штампе чертежей `dxf2d.js`:** на разрезе динамическая отметка у фермы имеет формат 3 знаков `ФП (+4,500 м)` / `ФП (+1,500 м)`, а в подзаголовке основной надписи [`dxf2d.js:436`](../../src/venues/fest-studio/export/dxf2d.js#L436) и на плане [`dxf2d.js:183, 285`](../../src/venues/fest-studio/export/dxf2d.js#L183) оставлено 2 знака (`H=+4,50 м` / `+1,50 м`), что на чтение чертежа не влияет.
2. **Упрощённая геометрия 3D-приборов и маркер `Seats_40` в GLB:** в [`export3d.js`](../../src/venues/fest-studio/export/export3d.js#L155-L166) корпуса приборов экспортируются как `BoxGeometry 0,22 × 0,22 × 0,26`, подписи `3D_FIXTURES` выводятся без `*`, а узел `Seats_0/40` служит маркером количества мест рядом с запечёнными мешами блитчера — унифицировано с эталоном `fest-roof`.
