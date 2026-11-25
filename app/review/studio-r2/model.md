# Отчёт Архитектор / 3D-моделлер / Художник (Раунд 2)

**Роль:** Роль 1: Архитектор, 3D-моделлер, художник
**Тестируемые площадки и платформы:** Студия мультимедиа (`studio`), Desktop URL (`http://localhost:5173/desktop.html#v=studio`)
**Дата и коммит:** 2026-11-25, коммит `e210e22` (ветка `studio-ready`)

---

## 1. Кратко: что и как проверено

1. **Аудит внесённых правок по итогам `app/review/studio-r1/decisions.md`:**
   - Проверены обновлённые файлы `app/src/venues/fest-studio/config/dimensions.js`, `build/hall.js`, `build/rigging.js`, `build/overlays.js`, `index.js`.
2. **Визуальный аудит 11 свежих рендеров раунда `studio-r2`** (`app/review/shots/studio-r2/desktop/studio/`):
   - `01-overview.jpg`, `05-cycToExit.jpg`, `09-plan_bp_dims.jpg`, `10-section_bp_dims.jpg`, `14-overview_lo-unfolded.jpg`, `15-hall_lo-unfolded.jpg`, `16-cycToExit_lo-unfolded.jpg`, `17-plan_lo-unfolded_bp_dims.jpg`, `18-section_lo-unfolded_bp_dims.jpg`, `19-overview_lo-unfolded_mf2.jpg`, `21-overview_selMF.jpg`.
3. **Инструментальная проверка в живом браузере (`window.__fest.stage`):**
   - Выполнен скрипт `app/review/studio-r2/model-shots/verify-r2.mjs` (`0` ошибок консоли и `pageerror`), записан `verify-r2.json`.
   - Сняты и осмотрены 5 прицельных контрольных снимков в `app/review/studio-r2/model-shots/`: `01-r2-folded-left-rails-deck.png`, `02-r2-unfolded-curtains-deck.png`, `03-r2-row0-vs-mf0.png`, `04-r2-plan-bp-dims-grid.png`, `05-r2-section-bp-dims-grid.png`.

---

## 2. Проверка исправлений предыдущего раунда

| № (`decisions.md`) | Пункт исправлений | Статус (Работает / Не работает / Частично) | Комментарий и доказательства |
|---|---|---|---|
| **п. 1** | Развести пересечения подписей в режиме «Чертёж» (`Глубина 12,6 м`, `ФП 5 м`, шильдик `ФП`, `zeroLineLabel`, `VIEWS.plan`) | **Работает** | В `overlays.js:35,43,88` `Глубина 12,6 м` опущена на `Y = -0,42` м под пол (на `05-r2-section-bp-dims-grid.png` не пересекает красные метки сетки `-8…4`), `ФП 5 м` перенесена на `(x = 1,65, Y = 4,65, t = 0,25)` (на `04-r2-plan-bp-dims-grid.png` и `05-r2-section-bp-dims-grid.png` не задевает ветвь `МП-П`, лебёдки и сетку). В `rigging.js:91` шильдик `ФП` сдвинут в пролёт между `Ф3` и `Ф4` (`[-2.37, 0.15, 2.05]` в локальных координатах рамы — на `09-plan_bp_dims.jpg`, `17-plan_lo-unfolded_bp_dims.jpg` и `04-r2-plan-bp-dims-grid.png` полностью чистый). `zeroLineLabel` и `VIEWS.plan` (`height: 18.0, center: [0, 0, -2.85]`) на `04-r2-plan-bp-dims-grid.png` не обрезаются шапкой и не накладываются на сетку. |
| **п. 2** | Исправить растянутую UV-развёртку рифлёного алюминия `M.aluDeck` на настилах блитчера | **Работает** | В `build/hall.js:41` в `staticMesh()` добавлен `if (mat?.map) worldUV(geo, mat.userData?.uvScale \|\| 0.25)`, что покрывает `hallDeck` в `buildHall` (`hall.js:226`) и `tierDeck` / `exitStepDeck` в `animateHall` (`hall.js:311,349`). Замер `verify-r2.json` подтверждает шаг UV `0,25` м (`folded.deckUV: u[-11.6, 31.6]`, `unfolded.deckUV: u[-11.6, 31.6], v[0.465, 31.6]`). На `01-r2-folded-left-rails-deck.png` и `02-r2-unfolded-curtains-deck.png` рисунок «чечевицы» на всех 4 ярусах и полуступенях чёткий и равномерный без диагонального растяжения. |
| **п. 3** | Согласовать цвет боковых шторок `hallCurtains` с оранжевыми креслами | **Работает** | В `build/hall.js:58-60` `makeCurtainMat` задаёт `color: 0xc4602a`, `emissive: 0x6e2b0d`, `emissiveIntensity: 0.55` (подтверждено в `verify-r2.json`: `curtainMat = { color: "c4602a", emissive: "6e2b0d", emissiveIntensity: 0.55 }`). На `01-overview.jpg`, `14-overview_lo-unfolded.jpg` и `02-r2-unfolded-curtains-deck.png` боковины отчётливо читаются оранжевыми в тон кресел. |
| **п. 10** | Увеличить запас зазора у левой стены в `folded` и между `ФП` (`h = 0`) и 0-м рядом в `unfolded` | **Работает** | В `config/dimensions.js:137,141` `sideSplayDeg` снижен до `[5.5, 4.6, 3.8, 3]`, `row0D` сдвинут до `-3.60` м. По замерам `verify-r2.json`: в `folded` крайний поручень `steelBox.x[0] = -3.0175` отстоит от левой стены `x = -3.05` на **`32,5` мм** (`leftWallClearanceM = 0.0325`, видно на `01-r2-folded-left-rails-deck.png`); в `unfolded` передняя кромка 0-го ряда `seatsFabricBox.d[1] = -3.39` отстоит от раскосов `ФП` на `h = 0` (`movableAtH0.d[0] = -3.358`) на **`32` мм** (`row0ToMovableH0ClearanceM = 0.032`, видно на `03-r2-row0-vs-mf0.png`). |

---

## 3. Что работает хорошо

1. **Отсутствие регрессий во всех проверенных состояниях (`folded`, `unfolded`, `mf2`, `selMF`, `plan`, `section`):**
   - На `01-overview.jpg`, `05-cycToExit.jpg`, `14-overview_lo-unfolded.jpg`, `15-hall_lo-unfolded.jpg`, `16-cycToExit_lo-unfolded.jpg`, `19-overview_lo-unfolded_mf2.jpg`, `21-overview_selMF.jpg` геометрия павильона, циклорама `R = 0,70`, стационарные фермы, подвижная ферма `ФП` (`4,10 × 5,00` м) с 4 лебёдками и цепями, а также блитчер на 40 мест (`seatsCount = 40`) отображаются чисто, без z-fighting, висящих деталей и ошибок консоли (`errors: []`).
2. **Высокая визуальная согласованность материалов блитчера:**
   - После исправления `worldUV` и `makeCurtainMat` настилы ярусов, полуступени, оранжевые боковые шторки и 40 кресел/стульев выглядят цельно как единое изделие (`01-r2-folded-left-rails-deck.png`, `02-r2-unfolded-curtains-deck.png`).
3. **Читаемость чертежей плана и разреза:**
   - На `04-r2-plan-bp-dims-grid.png` и `05-r2-section-bp-dims-grid.png` размерные цепочки `Ширина 6,1 м`, `Глубина 12,6 м`, `Шаг ферм 2,5 м`, `ФП 5 м`, `ФП макс. 4,5 м`, `Блитчер 1,2 м`, `Циклорама 3,9 м`, красные метки сетки и синие подписи ферм `Ф1…Ф6` разнесены чисто.

---

## 4. Замечания и проблемы

### Высокий приоритет (Блокирует выпуск / Искажает данные)
- Замечаний высокого приоритета нет.

### Средний приоритет (Удобство / Визуальный шум)
- Замечаний среднего приоритета нет.

### Низкий приоритет (Полировка / На будущее)
1. **В виде `section` при `h = 4,50` м шильдик `ФП` перекрывается жёлтой размерной плашкой `ФП 5 м` (`build/rigging.js:91`, `build/overlays.js:43`):**
   - **Факт:** на `05-r2-section-bp-dims-grid.png` и `10-section_bp_dims.jpg` спрайт `ФП` (`d = -2,05`, `y = h + 0,15 = 4,65` м) оказывается в одной точке с плашкой размера `ФП 5 м` (`d = -3,20 + 0,25 × 5,00 = -1,95`, `y = 4,65` м), из-за чего в проекции разреза видна только плашка `ФП 5 м`. Наглядности разреза не мешает (контур уже подписан «ФП 5 м» и «ФП макс. 4,5 м»), но при желании `t` размерной подписи `ФП 5 м` можно сместить, например, с `0.25` на `0.62`.
