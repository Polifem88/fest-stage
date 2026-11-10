# Независимое ревью ветки `big-patch-1` (`3f133be...3fabc80`)

- **Проект:** ФЭСТ · 3D-каталог сцен (`D:\Antigravity Projects\fest-3dmodels-and-stages`)
- **Диапазон сравнения:** `git diff 3f133be...3fabc80` (`master...big-patch-1`, 18 файлов, только Большая сцена, её тесты, документация и ревью-артефакты)
- **Исходные документы:**
  - ТЗ: [`data/big/Патч 1/Новые замеры и изменения.md`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/data/big/%D0%9F%D0%B0%D1%82%D1%87%201/%D0%9D%D0%BE%D0%B2%D1%8B%D0%B5%20%D0%B7%D0%B0%D0%BC%D0%B5%D1%80%D1%8B%20%D0%B8%20%D0%B8%D0%B7%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F.md) + 6 эталонных фотографий в `data/big/Патч 1/`
  - Спецификация: [`docs/superpowers/specs/2026-11-10-big-patch-1-design.md`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/docs/superpowers/specs/2026-11-10-big-patch-1-design.md)
  - Правила разработки: [`AGENTS.md`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/AGENTS.md), реестр допущений: [`ASSUMPTIONS.md`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/ASSUMPTIONS.md)
- **Итоговый вердикт:** **НУЖНЫ ПРАВКИ** *(0 критичных блокеров, 3 важных геометрических замечания, 3 мелких замечания по деталям геометрии, 2D DXF и константам построителей)*

---

## Сводка выполненных проверок

| Проверка | Команда | Результат |
| :--- | :--- | :--- |
| Юнит-тесты и границы модулей | `npx.cmd vitest run` | ✅ **11/11 файлов, 172/172 тестов** пройдены |
| Однофайловая сборка | `npm.cmd run build` | ✅ `index.html` **23,1 КБ** (≤ 100 КБ), `desktop.html` **919,4 КБ**, `mobile.html` **916,9 КБ** (≤ 1,3 МБ) |
| Снимки и тач-цели Большой сцены | `$env:VENUE='big'; npm.cmd run shots` | ✅ **8/8 наборов** (`desktop`, `iphone`, `iphone-land`, `android`), 0 ошибок консоли, все кнопки ≥ 44×44 px |
| Крупные планы патча | `node review/patch1/closeups.mjs dist review/patch1/review` | ✅ **10/10 ракурсов** сняты и сверены с `review/patch1/before/*.png` и фото сцены |
| Доп. камеры и крайние высоты (`__fest.setCamera`, `__fest.setHeight`) | пользовательский прогон Playwright (`13` ракурсов `rev-*.png`) | ⚠️ Найдены пробитие настила правой галереи направляющей `Ш1`, висящие в воздухе ступени без перил над воротами, пересечение тяжа `8,10` м с прибором `191` и щель `8 × 90` см под дверью приямка |
| Экспорт 2D DXF / 3D DXF / GLB | `__fest.exportPlanDXF()`, `exportSectionDXF()`, `export3DDXF()`, `exportGLB()` | ⚠️ Числа ТЗ актуальны, GLB валиден (`193` меша, `0` NaN); мелкие огрехи раскладки на 2D-плане и разрезе |
| Паритет готовых площадок | `node scripts/parity.mjs compare` | ✅ **Камерная: 100 %** (`8/8` экспортов, `16/16` состояний, `36/36` снимков — `0` отличий); **Сцена под крышей: 100 %** (`12/12` экспортов, `20/20` состояний, `36/36` снимков — `0` отличий) |
| Изоляция правок | `git diff 3f133be...3fabc80 --stat` | ✅ Общий код (`engine/`, `systems/`, `core/`, `ui/`, `library/`, `export/`) и другие площадки **не затронуты** |

---

## 1. Попунктная сверка ТЗ и спецификации с кодом и `config/`

| № | Требование ТЗ / решение спецификации | Файл:строка | Значение / реализация в коде | Статус |
| :--- | :--- | :--- | :--- | :---: |
| **1.1** | Длина всех поперечных штанкетов и софитов — **13,5 м** (`x = -6,75..+6,75`), дорога занавеса `З` остаётся **15,0 м** | [`config/dimensions.js:149,153`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L149-L153)<br>[`build/rigging.js:65,75,275`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/rigging.js#L65-L75) | `DIM.pipe.length: 13.5`, `trackLength: 15.0` | ✅ |
| **1.1а** | 4 точки подвеса на 13,5-м трубе — `[-6,5; -2,2; 2,2; 6,5]` м (`assumption: true`, `A12`) | [`config/dimensions.js:154`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L154) | `pickupX: [-6.5, -2.2, 2.2, 6.5]` | ✅ |
| **1.2** | Максимальный подъём `Ш2–Ш6` — **6,7 м** (`max: 6.7, rest: 6.7`) | [`config/rigging.js:67,69-72`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/rigging.js#L67-L72) | `Sh2`, `Sh3`, `Sh4`, `Sh5`, `Sh6`: `min: 1, max: 6.7, rest: 6.7` | ✅ |
| **1.3** | Диапазон хода дороги занавеса `З` — **2,0 .. 6,0 м**, по умолчанию **6,0 м** | [`config/rigging.js:65`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/rigging.js#L65) | `Z`: `min: 2, max: 6, rest: 6` | ✅ |
| **1.4** | Левый боковой штанкет `Б1`: в **15 см** от перил левой галереи (`x = -6,80` м), длина прежняя (`Ш2..Ш11`), ход **1,0 .. 6,3 м**, по умолчанию **6,3 м** | [`config/rigging.js:52,82`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/rigging.js#L52-L82) | `B1_GAP = 0.15`, `x: +(LEFT_GALLERY.x1 + B1_GAP).toFixed(4)` (`-6.8`), `dFrom: 1.45, dTo: 7.45, min: 1, max: 6.3, rest: 6.3` | ✅ |
| **1.5** | Правый боковой штанкет `Б2`: в **50 см** от перил правой галереи (`7,60 - 0,50 = 7,10` м), длина прежняя (`Ш2..Ш9`), ход **1,0 .. 6,6 м** (ниже ригеля `6,65`), по умолчанию **6,6 м** | [`config/rigging.js:83`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/rigging.js#L83) | `B2`: `x: 7.1, dFrom: 1.45, dTo: 6.85, min: 1, max: 6.6, rest: 6.6` (верх трубы `6,625 < 6,65`; средний трос `d = 4,15` в `0,45` м за ригелем `3,40..3,70`) | ✅ |
| **2.1** | Левая верхняя боковая галерея: ширина `0,90` м, зазор **0,65 м** от левой стены (`x = -7,85..-6,95` м на `d = 0,80..8,30` м), стык с передней галереей через 3 ступени и с задней на `d = 8,30` м | [`config/dimensions.js:62-63,198-201`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L62-L63)<br>[`build/architecture.js:339-340,353`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L339-L353) | `leftGap: 0.65`, `LEFT_GALLERY = { x0: -7.85, x1: -6.95 }`, настил `box(LX0, LX1, ...)`, задний угол `box(-W, -GX, ..., GB, BACK)` | ✅ |
| **2.1а** | Перила на обеих продольных кромках левой галереи (`-7,85` и `-6,95`), а также на кромках `d = 0,80` и `d = 8,30` м над зазором `[-8,50; -7,85]` | [`build/architecture.js:356-368`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L356-L368) | Перила построены по `LX1`, `LX0`, левой лесенке и поперечным кромкам `-W..LX0` на `GB` и `FRONT_D1` | ✅ |
| **2.1б** | Подвесы левой галереи к потолку (`8,50` м) парными вертикальными тяжами с поперечными траверсами (`assumption: true`, мимо приборов и канатов) | [`config/dimensions.js:64-66`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L64-L66)<br>[`build/architecture.js:377-383`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L377-L383) | `leftHangersD: [2.35, 4.40, 6.10, 8.10]` — **4-я станция `8,10` м совпала по `d` с прибором `№ 191` (`d = 8,10` м) и врезается в его корпус** (см. Важное № 3) | ❌ |
| **2.1в** | Приборы `187–192` (`GAL_L`), левая LED-линейка дежурки и размерная линия «Галерея 5,7 м» перенесены со старой галереи на новую | [`config/fixtures.js:143,202-203`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/fixtures.js#L202-L203)<br>[`build/architecture.js:768`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L768)<br>[`build/overlays.js:12,23`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/overlays.js#L12-L23) | `galLX = LEFT_GALLERY.x1 + 0.1 = -6.85`; LED `LX1 - 0.04 .. LX1 + 0.02`; выноска `galLX = -7.4` | ✅ |
| **2.2** | Низ строительного ригеля под потолком — **6,65 м** (`d = 3,55` м, ширина `0,30` м) | [`config/dimensions.js:144`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L144) | `rigel: { d: 3.55, width: 0.3, bottomY: 6.65 }` | ✅ |
| **3.1** | Площадка узла подъёма в правом заднем углу — **1,85 × 1,85 м** (`x = 6,65..8,50`, `d = 7,35..9,20`, `y = 2,20`); обе лестницы (`sideLadder`, `vertLadder`) и проёмы перил пересчитаны от `PAD_X0` / `PAD_D0` | [`config/dimensions.js:78-85`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L78-L85)<br>[`build/architecture.js:26-27,359-363,411-424`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L411-L424) | `padSize: 1.85`; `sideLadder` `d = 7,05`; `vertLadder` `x = 6,60, d = 8,00`; проёмы перил привязаны к `PAD_X0`, `PAD_D0`, `LX1` | ✅ |
| **3.2** | Ниша грузовых ворот: `2,40` м от правой стены (`x = 3,15..6,10` м, ширина `2,95` м), глубина `1,10` м (`d = 9,20..10,30`), потолок `+2,40` м, пандус до `-0,35` м (`2,75` м у ворот), 2 створки `2,60` м + швеллер `0,15` м | [`config/dimensions.js:90-98,219-232`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L90-L98)<br>[`build/architecture.js:260-292`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L260-L292) | `gateNiche()` даёт `{ x0: 3.15, x1: 6.1, d0: 9.2, d1: 10.3, ceilY: 2.4, floorDrop: 0.35 }`; 2 створки `-0,35..+2,25` м + стальной швеллер `2,25..2,40` м | ✅ |
| **3.2а** | Нижняя галерея над воротами: поднята на **2,90 м** на `x = 3,15..6,10` м (обшивка `0,35` м → низ `2,55 > 2,40` м), переходы ступенями слева (`2,55..3,15`) и справа (`6,10..6,65` к площадке `2,20`) | [`config/dimensions.js:71-73`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L71-L73)<br>[`build/architecture.js:388-402`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L388-L402) | Отметки настила и обшивки точные (`2,55 > 2,40`), но **ступени маршей висят в воздухе без косоуров/подступенков, несимметричны по отметкам и лишены перил** (см. Важное № 2) | ⚠️ |
| **3.2б** | Ниша задней левой двери: `3,60` м от левой стены (`x = -4,90..-3,95` м, ширина `0,95` м), глубина `1,10` м (`d = 9,20..10,30`), потолок `+1,90` м, пандус до `-0,35` м (`2,25` м у двери), полотно `2,00` м + перемычка `0,25` м | [`config/dimensions.js:100-106,236-250`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L100-L106)<br>[`build/architecture.js:261-293`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L261-L293) | `doorNiche()` даёт `{ x0: -4.9, x1: -3.95, d0: 9.2, d1: 10.3, ceilY: 1.9, floorDrop: 0.35 }`; дверь `-0,35..+1,65` м + полоска стены `1,65..1,90` м | ✅ |
| **3.3** | Трапециевидный приямок у правой стены: `d = 1,35..4,75` м (длина `3,40` м), ширина `0,50` м (`x = 8,00`) у портала → `1,00` м (`x = 7,50`) у арьера, глубина **0,85 м**, 5 подъёмов по `0,17` м (`tread = 0,30`, `stepsAssumption: true`) | [`config/dimensions.js:114-123,206-216`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L114-L123)<br>[`build/architecture.js:162-170,306-329`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L306-L329)<br>[`build/floor.js:43-79`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/floor.js#L43-L79) | `pitEdgeX(d)` и `inPit(x, d)` используются единообразно в планшете, стенках/дне/ступенях приямка, сетке, шейдере пятен и трассировке лучей | ✅ |
| **3.3а** | Дверь в приямке (`sideDoor`): на глубине `-0,85` м в правой стене сразу за выступом (`0,9 × 2,1` м, `fromD: 1,40`, `assumption: true`) | [`config/dimensions.js:108`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L108)<br>[`build/architecture.js:234-242`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L234-L242) | Размеры и отметки верны; **в четверти `x = 8,50..8,58` м на уровне `-0,85` м пропущен порог пола** (см. Мелкое № 4) | ⚠️ |
| **3.3б** | Косая решётка над приямком: стойки от дна `-0,85` м до `5,64` м вдоль `pitEdgeX` (`postStepAssumption: true`), этажи `2,10` и `4,50` м с поперечинами к стене, лестница `0,44` м в плоскости решётки вместо 2-й стойки, верхняя связь крайней стойки `(7,50; 4,75)` к `7,60` | [`config/dimensions.js:126-133,193`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L126-L133)<br>[`build/architecture.js:429-459`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L429-L459) | Реализовано строго по спецификации: `ladderAlong` в плоскости косой кромки, 2 пары поперечин от тетив лестницы к `x = 8,50`, верхняя связь `7,47..7,60` м на `5,58..5,64` м | ✅ |
| **3.4** | Выступ правой стены `wallPier` за узлом `Ш1/С0/З`: `x = 8,00..8,50` м (`0,50` м), `d = 0,25..1,35` м (`1,10` м), от `0` (`-0,85` на стыке с приямком `d = 1,35`) до `5,64` м; кронштейн правой галереи на `d = 1,20` м опирается на `x = 8,00` | [`config/dimensions.js:187-192`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L187-L192)<br>[`build/architecture.js:313-315,371-376`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L313-L315) | Стык выступа с порталом (`d = 0,25`), торцом приямка (`d = 1,35`, `-0,85..5,64`) и кронштейном `d = 1,20` герметичен, в шейдере `floor.js:45` пятна на выступе обрезаются | ✅ |
| **3.4а** | Сдвиг узла `Ш1 / С0 / З` на `0,50` м к центру сцены (`cw = 7,86` м), ручные канаты вплотную к противовесам (`ropeGap = 0,20` → `rx = 7,66` м), стойки фиксаторов до пола и связи к выступу/стенам (в т. ч. у `Б2`), направляющие `guideTopY: 5,95` м «под передней галереей и лесенкой» | [`config/dimensions.js:136-141`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L136-L141)<br>[`config/rigging.js:114-127`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/rigging.js#L114-L127)<br>[`build/rigging.js:131-140,180-199`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/rigging.js#L131-L140) | Сдвиг по `X`, стойки фиксаторов до пола и привязки к `wallPier.x0 = 8,00` и `W = 8,50` выполнены отлично, **но задняя направляющая `Ш1` (`d = 0,935` м) насквозь пробивает плиту настила правой галереи `5,64..5,70` м, а головные блоки и канаты `З/С0/Ш1` тянутся сквозь галереи к `y = 8,30` м** (см. Важное № 1) | ❌ |
| **§5–6** | Синхронное обновление 2D DXF, 3D DXF/GLB, юнит-тестов и реестра `ASSUMPTIONS.md` | [`export/dxf2d.js`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/export/dxf2d.js), [`export/export3d.js`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/export/export3d.js)<br>[`tests/unit/config.test.js`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/tests/unit/config.test.js), [`ASSUMPTIONS.md:34-39`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/ASSUMPTIONS.md#L34-L39) | Все числа конфига, тесты и `ASSUMPTIONS.md` синхронизированы (убраны старые допущения ворот/задней двери/глубины приямка, внесены 4 новых); мелкие огрехи чертежей 2D DXF см. в Мелком № 5 | ✅ |

---

## 2. Подробный список замечаний

### Критичные замечания
**Нет.** Приложение собирается в пределах бюджетов, все 172 юнит-теста и E2E-наборы Большой сцены зелёные, общий код не затронут, паритет Камерной и Сцены под крышей составляет 100 %, в геометрии сцены и GLB нет `NaN`/вырожденных треугольников или вывернутых односторонних стен.

---

### Важные замечания (требуют правки перед слиянием в `master`)

#### В-1. Задняя направляющая противовеса `Ш1` (`d = 0,935` м) пробивает насквозь стальной настил правой галереи (`y = 5,64..5,70` м), а головные блоки и канаты узла `Ш1 / С0 / З` оторваны от `guideTopY = 5,95` м и прошивают галереи до `y = 8,30` м
- **Файлы и строки:**
  - [`app/src/venues/fest-big/build/rigging.js:131-140`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/rigging.js#L131-L140)
  - [`app/src/venues/fest-big/build/architecture.js:341`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L341)
  - [`app/src/venues/fest-big/export/export3d.js:450-458`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/export/export3d.js#L450-L458)
  - [`app/src/venues/fest-big/config/dimensions.js:140`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L140)
- **Снимки:**
  - `app/review/patch1/review/rev-sh1-guide-top-bp.png` (режим «Чертёж», наглядно видно пробитие плиты и поручня)
  - `app/review/patch1/review/rev-sh1-min-arbor-bp.png` (`З=2,0`, `С0=2,0`, `Ш1=1,5` — каретки в крайнем верхнем положении `y_top = 5,05..5,55` м)
  - `app/review/patch1/review/rev-sh1-guide-top.png`
- **Суть дефекта:**
  1. В §3.4 спецификации параметр `DIM.controls.rightFront.guideTopY = 5.95` вводился специально, чтобы после сдвига узла на `0,50` м направляющие останавливались *«под передней галереей и лесенкой»* и не протыкали конструкцию галереи на `x = 7,60..8,50, d = 0,80..1,60`.
  2. Однако в `architecture.js:341` горизонтальная плита настила правой галереи (`y = 5,64..5,70` м) строится от `FRONT_D1 = 0,80` м (`box(GX, W, UPY - DECK_T, UPY, FRONT_D1, BACK)`), продолжаясь под тремя ступенями `stairBlocks` (`d = 0,80..1,60` м). У `Ш1` (`ropeDepth = 0,85` м) задний Т-профиль направляющей стоит на `dd = 0,85 + 0,085 = 0,935 > 0,80` м (`x = 7,83..7,89` м) — поэтому он **протыкает насквозь стальную плиту `5,64..5,70` м** и торчит на `25` см над ней (`5,70..5,95` м) в зазоре под ступенью `5,983..6,033` м, обрываясь в воздухе без опоры.
  3. При этом головные блоки `blocks` для `right-front` в `build/rigging.js:137` и `export/export3d.js:456-458` остались на потолке `y = CEIL - 0.2 = 8,30` м (за `2,35` м пустого воздуха выше обреза направляющих `5,95` м), а ручные канаты `rx = 7,66` м (`build/rigging.js:139`) у всех трёх подъёмов (`З`, `С0`, `Ш1`) насквозь прошивают настил передней галереи (`6,14..6,20` м), настил правой галереи (`5,64..5,70` м) и поручни перил.
- **Проверка крайнего хода кареток:** при минимальных высотах (`З = 2,0` м, `С0 = 2,0` м, `Ш1 = 1,5` м) верх кареток противовесов равен `0,6 + (max - min) + 0,45 = 5,05` м (`З`) и `5,55` м (`С0`, `Ш1`) — то есть все три каретки гарантированно не поднимаются выше **`5,55` м** (`< 5,64` м низа правой галереи и верха выступа `wallPier.topY = 5,64` м).
- **Предложение исправления:**
  - **Вариант А (наиболее чистый конструктивно):** начинать горизонтальный настил боковых галерей `5,64..5,70` м в `architecture.js:339, 341` от `FRONT_D1 + STAIR_LEN` (`d = 1,60` м), заменив участок `d = 0,80..1,60` м полноценным лестничным маршем с косоурами от `6,20` к `5,70` м (тогда на `d = 0,935` м низ марша составит `≈ 6,06` м и `guideTopY = 5,95` м с кронштейном к низу марша/выступу встанет без единого пересечения), либо ограничить `guideTopY` отметкой `wallPier.topY = 5,64` м (каретки поднимаются максимум до `5,55` м, запас `9` см), уперев направляющие прямо в низ перекрытия `5,64` м / кронштейн от выступа `wallPier`.
  - Для `r.control === 'right-front'` также добавить верхний кронштейн направляющих к `wallPier` (`x = 7,86..8,00`) на уровне `guideTop` (чтобы направляющие не висели консольно на высоте 5,6–6,0 м) и согласовать положение обводного/головного блока в `build/rigging.js` и `export/export3d.js`.

---

#### В-2. Лестничные марши нижней галереи вокруг участка `2,90` м над воротами (`x = 2,55..3,15` и `x = 6,10..6,65` м): ступени висят в воздухе без косоуров/подступенков, несимметричны по высотам слева и справа и не имеют перил
- **Файлы и строки:**
  - [`app/src/venues/fest-big/build/architecture.js:149-156`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L149-L156)
  - [`app/src/venues/fest-big/build/architecture.js:388-400`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L388-L400)
- **Снимки:**
  - `app/review/patch1/review/rev-lower-gallery-gate-bp.png`
  - `app/review/patch1/review/gateNiche.png`
  - `app/review/patch1/review/liftPad.png`
- **Суть дефекта:**
  1. **Висящие в воздухе детали:** функция `stairBlocks()` генерирует три изолированные горизонтальные плиты толщиной `5` см (`top - 0.05 .. top`) без тетив/косоуров, подступенков или консолей к задней стене (`d = 9,20` м). На высоте `2,20..2,90` м посреди открытой задней стены эти 6 тонких прямоугольников отчётливо висят в пустоте на всех ракурсах сцены (`gateNiche.png`, `liftPad.png`, `01-overview.jpg`).
  2. **Асимметрия ступеней при подъёме и спуске:** `stairBlocks` считает `top = yFrom + (yTo - yFrom) * ((i + 1) / steps)` для `i = 0, 1, 2`.
     - Слева (`x = 2,55..3,15` м, `yFrom = 2,20 → yTo = 2,90` м) получаются плиты на отметках `2,433`, `2,667` и **`2,900` м** — то есть третья ступень (`2,95..3,15` м) лежит на уровне верхнего настила `2,90` м, но без обшивки `fascia` и без перил.
     - Справа (`x = 6,10..6,65` м, `yFrom = 2,90 → yTo = 2,20` м) получаются плиты на отметках `2,667`, `2,433` и **`2,200` м** — то есть третья ступень (`6,467..6,65` м) лежит уже на нижнем уровне `2,20` м (вровень с площадкой `1,85 × 1,85` м, но толщиной `5` см вместо `8` см), тогда как у `x = 6,10` м настил `2,90` м сразу обрывается вниз.
  3. **Отсутствие ограждения на маршах:** на участках `x = 2,55..3,15` м и `x = 6,10..6,65` м вдоль передней кромки `d = 8,30` м нет наклонных перил (тогда как на переходных маршах верхних галерей `architecture.js:367-369` ограждение предусмотрено).
- **Предложение исправления:**
  - Для марша из `N` промежуточных ступеней между двумя уже построенными площадками (`2,20` и `2,90` м) делать `N` ступеней на отметках `yLow + (k / (N + 1)) * (yHigh - yLow)` (`k = 1..N`, например при `2` промежуточных ступенях / `3` подъёмах по `0,233` м — отметки `2,433` и `2,667` м симметрично слева и справа!), связать ступени парой наклонных стальных тетив/косоуров (`cylBetween` от края нижнего настила к краю верхнего настила на `d = GB + 0,03` и `d = BACK - 0,03`) и добавить наклонный поручень ограждения между `LOWY` и `GATEY` на обоих маршах.

---

#### В-3. Внутренний тяж 4-й станции подвеса левой галереи (`d = 8,10` м) совпадает по глубине с прибором `№ 191` (`GAL_L`, `d = 8,10` м) и врезается в его корпус
- **Файлы и строки:**
  - [`app/src/venues/fest-big/config/dimensions.js:64-66`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/dimensions.js#L64-L66)
  - [`app/src/venues/fest-big/config/fixtures.js:147`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/config/fixtures.js#L147)
  - [`app/src/venues/fest-big/build/architecture.js:377-383`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L377-L383)
- **Снимки:**
  - `app/review/patch1/review/rev-left-gal-hanger191-bp.png`
  - `app/review/patch1/review/leftGallery.png`
- **Суть дефекта:**
  - Станции подвеса левой галереи выбраны как оценочное допущение (`leftHangersD: [2.35, 4.40, 6.10, 8.10]`, `leftHangersAssumption: true`). Первые три станции (`2,35`, `4,40`, `6,10`) проходят свободно между приборами `GAL_L` (`[187, 2.55], [188, 3.05], [189, 5.4], [192, 6.5], [190, 7.4], [191, 8.1]`), а **4-я станция (`d = 8,10` м) поставлена ровно в координату `d = 8,10` м прибора `№ 191`**.
  - Поскольку прибор `191` висит на `x = -6,85, y = 6,45, d = 8,10` и нацелен вниз-вправо в планшет (`aim.x = -1,5`), его задняя крышка/лира отклоняется влево-вверх в `x ≈ -7,02, y ≈ 6,65, d = 8,10` и напрямую пересекается с внутренним вертикальным тяжем `x = LX1 - 0,03 = -6,98` м (`Ø40` мм, `d = 8,10` м).
- **Предложение исправления:**
  - Сместить 4-ю станцию в `DIM.galleries.leftHangersD` с `8.10` на **`7.75`** м (ровно посередине между приборами `190` на `7,40` м и `191` на `8,10` м; с канатами левой стены `x = -7,88` м и трубами штанкетов `x = -6,75..+6,75` м тяжи на `x = -7,82` и `-6,98` м по оси `X` не пересекаются; синхронно обновить число в `ASSUMPTIONS.md:34` и тест в `tests/unit/config.test.js`).

---

### Мелкие замечания

#### М-1. Сквозная щель `0,08 × 0,90` м в полу дверного проёма приямка (`x = 8,50..8,58` м, `d = 1,40..2,30` м, `y = -0,85` м)
- **Файл и строки:** [`app/src/venues/fest-big/build/architecture.js:237-242, 317-325`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L237-L242)
- **Снимки:** `app/review/patch1/review/rev-pit-pier-bp.png` (правый нижний угол под полотном двери), `app/review/patch1/review/pitTop.png`
- **Суть:** Дверь `sideDoor` утоплена на `8` см за плоскость стены `x = 8,50` м (`x = 8,58` м), боковые и верхний откосы четверти построены, а нижний порог на отметке дна приямка `y = -0,85` м не закрыт (`pitBotGeo` заканчивается на `x = 8,50` м). При взгляде сверху в расширенный приямок под дверью видна сквозная белая/чёрная щель в пустоту.
- **Предложение исправления:** Добавить `rect('y', -pit.depth, W, W + SIDE_DOOR_RECESS, sdoor.fromD, sdoor.fromD + sdoor.width, 1)` в `M.stageEdge` (или `M.blackWall`).

---

#### М-2. Мелкие огрехи 2D DXF плана и разреза (`export/dxf2d.js`)
- **Файл и строки:** [`app/src/venues/fest-big/export/dxf2d.js:295, 297, 300-304, 624`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/export/dxf2d.js#L295-L304) (а также парный стык двух боксов в [`build/architecture.js:340, 342`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L340-L342))
- **Суть:**
  1. На 2D-плане (`dxf2d.js:295, 297`) задняя галерея `d = 8,30..9,20` м нарисована двумя прямоугольниками `[-W..-GX]` и `[-GX..GX]`, оставляя рудиментарную пунктирную перемычку на старой координате `x = -GX = -7,60` м (после сдвига левой галереи на `[-7,85; -6,95]` м координата `-7,60` больше ничего не означает; в `architecture.js:340, 342` этот же стык создаёт две лишние внутренние грани в едином настиле `-W..GX`).
  2. На 2D-плане не показаны контур поднятого участка нижней галереи над воротами (`x = 3,15..6,10` м, `+2,90`) и его боковые марши, а центрированная подпись `Узел подъёма 1,85×1,85 (+2,20)` (`x = 6,48..8,67` м) слегка выступает за границы площадки `6,65..8,50` м на правую стену.
  3. На 2D-разрезе (`dxf2d.js:624`) подпись `УРОВЕНЬ ПЛАНШЕТА СЦЕНЫ (±0,000)` стартует в `X = -12,00` (`y = 0,12`) и заходит вправо до `X ≈ -9,10`, пересекая вертикальную линию ворот ниши (`X = -10,30`) и пунктир задней стены (`X = -9,50..-9,20`).
- **Предложение исправления:** Объединить задний настил `-W..GX` в один прямоугольник (`architecture.js:340,342` и `dxf2d.js:295,297`), нанести пунктиром участок `+2,90` и ступени над воротами на слой `AR_GALLERIES` плана, уменьшить кегль/разбить в 2 строки подпись площадки `1,85×1,85`, а на разрезе сдвинуть подпись `УРОВЕНЬ ПЛАНШЕТА СЦЕНЫ (±0,000)` левее или поставить `align: 'right'` у `X(gn.d1) - 0.3`.

---

#### М-3. Габарит `GATE_STAIR_W = 0.6` и отдельные числовые литералы в построителях вместо `config/` / шапки файла
- **Файлы и строки:**
  - [`app/src/venues/fest-big/build/architecture.js:49, 237-241, 337`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/architecture.js#L49)
  - [`app/src/venues/fest-big/build/rigging.js:167, 169, 181, 192`](file:///d:/Antigravity%20Projects/fest-3dmodels-and-stages/app/src/venues/fest-big/build/rigging.js#L167-L192)
- **Суть:** По §1.3 `AGENTS.md` любая геометрия помещения и конструкций должна задаваться в `config/`, а визуальные зазоры деталей — именованными константами в шапке построителя. Ширина левого марша нижней галереи `GATE_STAIR_W = 0.6` задаёт реальный архитектурный обрез нижней галереи (`UP_X0 = 2,55` м) и нужна в том числе экспорту `dxf2d.js`, поэтому её место — в `DIM.galleries` (`config/dimensions.js`). Четверть боковой двери `0.08` (`architecture.js:237-241`) и вылеты/шаг стоек фиксаторов канатов `0.3`, `0.2`, `0.25`, `1.2` (`rigging.js:167-192`) стоит поднять в именованные константы шапки рядом с `LOCK_*`.

---

## 3. Принятые заказчиком особенности и известные пересечения до патча (дефектами НЕ считаются)

Проверены визуально и математически, зафиксированы отдельно согласно заданию и §7 спецификации:

1. **Приборы `187–192` (`GAL_L`) снаружи перил левой галереи (`x = -6,85` м) над `Б1` (`x = -6,80` м) «впритирку»** *(решение заказчика)* — при `Б1` на максимуме `6,30` м труба `Б1` проходит под точкой подвеса приборов (`y = 6,45` м) вплотную к нижней части тубусов; при опускании софитов `С1–С3` на `6,30` м их крайние приборы `WASHZOOM` (`x = ±6,50` м) и концы 13,5-м труб (`x = ±6,75` м) не задевают `Б1` (`x = -6,80` м, зазор по трубе `2,5` см между поверхностями Ø50 мм; см. `rev-c2-at-b1-bp.png`).
2. **Дорога занавеса `З` длиной `15,0` м** *(решение заказчика)* — на минимальной высоте `2,0` м правый конец фермы (`x = +7,50` м) проходит в `16` см левее ручного каната `З` (`rx = 7,66` м) и в `50` см левее выступа стены `wallPier` (`x = 8,00` м); левый конец (`x = -7,50` м) на `d = 0,55` м свободен от канатов левой стены (`d ≥ 0,95` м; см. `rev-true-min-left-bp.png`, `rev-true-min-right-bp.png`).
3. **Было до патча (§7 спецификации):**
   - Направляющие и каретка противовеса `Б2` (`x = 8,36` м, `d = 6,25` м) проходят сквозь правую верхнюю галерею (`x = 7,60..8,50` м; от площадки `1,85 × 1,85` м на `d = 7,35..9,20` м узел `Б2` теперь находится впереди на `1,10` м, пересекая только верхнюю галерею).
   - Вертикальная лестница косой решётки приямка упирается снизу в настил правой галереи `5,64` м без проёма-люка (`pit.png`, `rev-pit-pier-bp.png`).
   - Штанкеты `Ш4` (`d = 3,25` м) и `Ш5` (`d = 3,85` м) на максимальной высоте `6,70` м находятся по бокам строительного ригеля (`d = 3,40..3,70` м, низ `6,65` м) с горизонтальным зазором `12,5` см от поверхности трубы Ø50 мм до грани ригеля (`rev-true-max-rigel-b2-bp.png`).
   - Свес обшивки нижней галереи (`y = 1,85` м на `d = 8,30` м) и труба синих приборов дежурки (`y = 1,75` м на `d = 8,85` м) расположены ниже верха проёма ниши задней левой двери (`y = 1,90` м в стене `d = 9,20` м), на расстоянии `0,90` м и `0,35` м перед стеной (`doorNiche.png`).
   - На верхних боковых галереях (`d = 0,80..1,60` м) ступени `stairBlocks` построены без косоуров поверх продолжающейся горизонтальной плиты `5,64..5,70` м (см. пересечение с направляющей `Ш1` в В-1).

---

## 4. Аудит экспорта и правил проекта

- **2D DXF (`exportPlanDXF`, `exportSectionDXF`):** устаревших чисел до патча (`14,0`, `6,85`, `7,05`, `2,20×2,20`, `0,75`, `2,50` у ворот, старых ходов `6,5` у `Ш2–Ш6` и `Б1`) **не обнаружено** — все таблицы экспликации, высотные отметки (`-0,850`, `+2,200`, `+2,900`, `+5,150`, `+5,700`, `+6,650`, `+8,500`), подписи ворот (`2,95×2,60 м (-0,35)`, `проём +2,40, пол -0,35`), двери (`0,95×2,00 (-0,35)`), приямка (`-0,85`) и площадки (`1,85×1,85 (+2,20)`) формируются напрямую из `DIM` и `RIGGING`.
- **3D DXF и Binary glTF 2.0 (`.glb`):** `export3DDXF` охватывает `X ∈ [-9,0; +9,0]`, `d ∈ [-20,4; +10,3]` (включая ниши `10,30` м), `Z ∈ [-0,85; +8,50]` (включая дно приямка `-0,85` м). GLB (`3,35` МБ, glTF v2, `193` меша, `386` аксессоров) проходит `sanitizeGeometryForGLTF` без ошибок и без единой `NaN`-вершины.
- **Границы модулей и `ASSUMPTIONS.md`:** `boundaries.test.js` и `parity-config.test.js` зелёные; общий код не изменён ни одной строкой; в `ASSUMPTIONS.md` аккуратно удалены 3 закрытых замерами допущения (ворота, задняя дверь, глубина приямка) и добавлены 4 новых (`leftHangersD`, `pit.steps`/`tread`, `rack.postStep`, `controls.rightFront`) + обновлён `sideDoor`.

---

## Итоговый вердикт

**НУЖНЫ ПРАВКИ** — перед слиянием `big-patch-1` в `master` необходимо устранить 3 важных геометрических замечания (**В-1**, **В-2**, **В-3**) и желательно закрыть 3 попутных мелких замечания (**М-1**, **М-2**, **М-3**), после чего повторно прогнать `npm.cmd run check`, переснять эталонные кадры Большой сцены и обновить baseline паритета для `big`.
