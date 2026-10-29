---
name: playwright-webgl-qa
description: >-
  Automates visual regression, WebGL headless rendering, raycast picking tests, performance benchmarking, and touch target validation for Three.js web apps.
  Use this skill when setting up or debugging Playwright tests with WebGL/SwiftShader, capturing automated screenshots across views and devices, measuring FPS under CPU throttling, or validating offline bundle loading.
---

# Playwright WebGL & 3D Performance Testing

Руководство по автоматизированному тестированию 3D-приложений на Three.js с помощью Playwright в среде без дискретного GPU.

## 1. Запуск WebGL в Headless-режиме (SwiftShader)

На серверах CI (GitHub Actions) или локальных машинах без аппаратного ускорения запуск Chromium требует передачи флагов программной эмуляции WebGL:

```javascript
// playwright.config.js
use: {
  launchOptions: {
    args: [
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox'
    ]
  }
}
```

## 2. Программный мост между тестами и сценой (`window.__fest`)

Для управления 3D-сценой в автотестах и сценариях проверки используется глобальный пульт `window.__fest` (`app/src/engine/testapi.js`):

```javascript
// Текущая площадка и каталог
window.__fest.venue();                  // текущий id ('big', 'chamber')
await window.__fest.loadVenue('chamber'); // асинхронное переключение площадки
window.__fest.venues;                   // список площадок каталога [{ id, name, status }]
window.__fest.views;                    // массив доступных ключей видов текущей площадки

// Управление ракурсом и камерой
window.__fest.setView('overview');      // моментальное переключение на ракурс
window.__fest.setCamera([x, y, d], [tx, ty, td], fov); // произвольная камера

// Механика и оборудование
window.__fest.setHeight('Sh5', 2.0);    // установить высоту подъёма (в метрах)
window.__fest.height('Sh5');            // получить текущую высоту
window.__fest.light('all', true);       // включить весь свет
window.__fest.portable('floor', 6);     // переносные приборы: режим и количество
window.__fest.layout();                 // трансформируемый зал: { id, rows, shift } или null
window.__fest.setLayout({ id: 'arena' }); // сменить планировку ({ id?, rows?, shift? } или строка id)
window.__fest.flag('blueprint', true);  // переключение флагов (чертёж, сетка, размеры)
window.__fest.layer('lights', false);   // включение/выключение слоёв

// Выделение и состояние
window.__fest.selectFixture('38');      // выбор прибора по номеру
window.__fest.getState();               // текущее состояние для сериализации
window.__fest.renderNow();              // принудительный синхронный кадр рендера
const { fps } = await window.__fest.fps(3000); // замер FPS под нагрузкой
```

## 3. Снятие скриншотов по матрице ракурсов и площадок

Тестовый сценарий `tests/e2e/shots.spec.js` снимает скриншоты для проверки визуальной регрессии. Набор видов для каждой сцены динамически берётся из её паспорта (`window.__fest.views`):

| Платформа | Разрешение | Ракурсы | Проверки |
|---|---|---|---|
| **Desktop** | 1920×1080 | Все ракурсы сцены (зал, пульт, план-чертёж, план крупно, разрез, галереи) | Читаемость текста, отсутствие наложений, окраска экспликации по типам, корректность обрезки световых пятен |
| **Mobile (Portrait)** | 390×844 (iPhone 14) | Общий вид, план, карточка прибора, открытая шторка | Положение шторки, портретный откат камеры (`portraitPullback`), размер кнопок $\ge 44$ px, всплывающие тосты |
| **Mobile (Landscape)** | 844×390 | Общий вид, план | Перемещение шторки в правую боковую колонку, видимость сцены |
| **Android** | 360×800 | Общий вид, план | Отсутствие горизонтального скролла на узких экранах |

### Запуск скриншотов по площадкам:
```powershell
# Снять снимки для всех площадок каталога
npm run shots

# Снять снимки только для конкретной площадки
$env:VENUE='chamber'; npm run shots
$env:VENUE='big'; npm run shots
```

Модификаторы снимков (`applyShot` в `tests/e2e/helpers.js`; те же коды использует `parity.mjs`): перед каждым кадром сцена сбрасывается (механика на `rest`, свет включён, флаги чертежа выключены, выбор снят, трансформируемый зал — к планировке по умолчанию), затем применяются модификаторы через `+`: `bp`, `dims`, `grid`, `off`, `house`, `noduty`, `nums`, `haze`/`nohaze`, `pfloor`/`pstand`, `low`, `sel53`, `selSh5` и `lo-<id>` — планировка зала (`overview+lo-traverse`, `plan+lo-arena`). Дополнительные снимки площадки — словарь `EXTRA_SHOTS` в `shots.spec.js`.

Перед захватом кадра тесты всегда дожидаются стабилизации 3D-движка:
```javascript
await page.waitForFunction(() => window.__fest && window.__fest.ready);
await page.evaluate(() => window.__fest.renderNow());
```

## 4. Тестирование каталога площадок (`venues.spec.js`)

Специализированный сценарий `app/tests/e2e/venues.spec.js` верифицирует:
1. **Переключение площадок в UI:** переключение через заголовок `ФЭСТ · <сцена> ▾` (выпадающий список на десктопе, модальный диалог на мобильных).
2. **Адаптивность интерфейса под возможности (`caps`):** при открытии площадки без подвижной механики (`fest-chamber`) скрываются вкладка механики, ползунки штанкетов и блок переносных приборов.
3. **Память состояний:** при переключении сцен общие флаги отображения (чертёж, дымка) сохраняются, а высоты механики, наборы света и ракурсы сохраняются индивидуально для каждой площадки.
4. **Отсутствие утечек памяти Three.js:** 10 циклов переключения между площадками не должны увеличивать количество геометрий и текстур в памяти (`stage.renderer.info.memory`). У трансформируемого зала — то же при 10 циклах смены планировок (`std → traverse → empty → arena`): дельта геометрий, текстур и шейдерных программ ≤ 2; при включённом «чертеже» новые меши зала сразу получают его материалы.
5. **Поддержка форматов ссылок:**
   - Новые ссылки каталога: `#v=chamber&s=...`; у трансформируемого зала в данных поле `lo` (без `lo` — планировка по умолчанию).
   - Попытка перехода на площадку «скоро» (`#v=foyer`) открывает главную сцену с объясняющим тостом.
   - Старые ссылки формата v1 (`#s=...`) корректно открывают Большую сцену с восстановлением высот и света.
6. **Размер тач-таргетов:** все элементы меню выбора площадок на мобильных имеют размер не менее $44 \times 44$ px.

## 5. Паритет-харнесс готовых площадок (`scripts/parity.mjs`)

Гарантия 100 % стабильности готовых площадок (`status: 'ready'`, сейчас Большая, Камерная и Сцена под крышей) при доработках общего кода, экспорта и рефакторинге. Площадки и их сценарии — объект `VENUES` в `app/scripts/parity.mjs`; что все `ready` из `catalog.js` есть в `VENUES`, проверяет `tests/unit/parity-config.test.js`.

```powershell
# 1. Эталон — со СВЕЖЕЙ сборки master (или до правок); capture без каталога не запускается
npm run build
Copy-Item -Recurse dist review/modular/baseline/dist-<метка>
node scripts/parity.mjs capture review/modular/baseline/dist-<метка>

# 2. Обязательная самопроверка эталона — должно быть 100 %
node scripts/parity.mjs compare review/modular/baseline/dist-<метка>

# 3. После правок — сравнить текущую сборку dist с эталоном (код возврата 0)
npm run build
node scripts/parity.mjs compare
# отчёт: review/modular/parity-report.md (+ .json): площадки, коммит и каталог эталона
```

Харнесс по каждой площадке из `VENUES` сверяет:
- **Экспорт:** SHA-256 2D DXF (план, разрез), 3D DXF и бинарного GLB; при расхождении — первые 20 различающихся строк DXF.
- **Состояние и ссылки:** `getState()` по ключам `heights, fixturesOn, flags, layers, portable, view` (+ `layout` у площадок с `layouts: true` в `VENUES`) и восстановление по ссылке эталона на свежей странице.
- **Снимки** desktop 1920×1080 и iPhone 13 (dpr 1): у Большой — 22 вида, у остальных — все виды площадки, орто с `bp+dims` и `bp+grid`, `off+house`, `nums`; список снимков фиксируется в эталоне. Пиксель «другой» при max |Δ| > 24, кадр проходит при ≤ 0,5 % таких пикселей; для провалов — картинка разницы в `review/modular/compare/<площадка>/diff/`. Тосты `.toast` и подсказка жестов `.mhint` (гаснет сама через 3 с — гонка по времени) перед снимком скрываются.

Правила (GEMINI.md §4 п. 3):
- Меняется формат экспорта, состояние, виды или общий код — в том же изменении правится и проверяется `parity.mjs` (сценарии, ключи состояния).
- Площадка в `draft` в паритет не входит; в коммите перевода в `ready` добавляется в `VENUES`, эталон переснимается целиком с собранной версии этого коммита, с самопроверкой.
- Старые замороженные сборки (`review/modular/baseline/dist-master` от 22.10) для эталона не использовать.

## 6. Замер FPS под троттлингом (Stress Test)

Чтобы приложение работало стабильно на мобильных устройствах:
1. В Playwright сессии подключается CDP (Chrome DevTools Protocol) с замедлением процессора:
   ```javascript
   const client = await page.context().newCDPSession(page);
   await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
   ```
2. Выполняется непрерывная анимация (облёт камеры или движение софитов) в течение 5 секунд.
3. Допустимый критерий: средний FPS $\ge 50$, минимальный $1\%$ low $\ge 30$ FPS, отсутствие утечек памяти (геометрии и текстуры удаляются через `.dispose()`).

## 7. Валидация мобильных кликабельных зон ($\ge 44 \times 44$ px)

Playwright сканирует все интерактивные селекторы (`button`, `input`, `.touch-target`, `.venue-item`):
```javascript
const elements = await page.$$('button, .clickable, input[type="range"], .venue-item');
for (const el of elements) {
  const box = await el.boundingBox();
  if (box && (box.width < 44 || box.height < 44)) {
    throw new Error(`Element ${await el.evaluate(e => e.outerHTML)} is smaller than 44x44: ${box.width}x${box.height}`);
  }
}
```

## 8. Тесты экспорта DXF (кодировка Windows-1251)

`app/src/export/dxfWriter.js` (`cleanText`) заменяет символы вне Windows-1251: «—» и «–» → «-», «≈» → «~», «×» → «x», «Ø» → «d=». В юнит-тестах (`tests/unit/export.test.js`) ожидайте уже заменённый текст: `expect(dxf).toMatch(/\* [-—] номер по допущению/)`, `expect(dxf).toMatch(/[~≈] 13,0 кВт/)`. Сущности DXF разбирайте парами «код — значение» (строку `'\n0\n'` для разбиения не использовать: значение «0» встречается и внутри сущностей, например `30\n0`).
