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
4. **Отсутствие утечек памяти Three.js:** 10 циклов переключения между площадками не должны увеличивать количество геометрий и текстур в памяти (`stage.renderer.info.memory`).
5. **Поддержка форматов ссылок:**
   - Новые ссылки каталога: `#v=chamber&s=...`.
   - Попытка перехода на площадку «скоро» (`#v=roof`) открывает главную сцену с объясняющим тостом.
   - Старые ссылки формата v1 (`#s=...`) корректно открывают Большую сцену с восстановлением высот и света.
6. **Размер тач-таргетов:** все элементы меню выбора площадок на мобильных имеют размер не менее $44 \times 44$ px.

## 5. Паритет-харнесс Большой сцены (`scripts/parity.mjs`)

Для гарантии 100% стабильности при масштабных доработках ядра и рефакторинге используется инструмент проверки паритета:

```powershell
# 1. Зафиксировать эталонное состояние с рабочей сборки:
node scripts/parity.mjs capture

# 2. Сравнить текущую сборку с эталоном:
node scripts/parity.mjs compare
```

Харнесс автоматически сверяет:
- **Экспортные файлы:** побайтовое совпадение SHA-256 для 2D DXF (план, разрез), 3D DXF и бинарного GLB.
- **Состояние и ссылки:** корректность десериализации старых ссылок v1 и эквивалентность `getState()`.
- **Рендер кадра:** попиксельное сравнение 22 снимков Большой сцены на Desktop и iPhone (порог расхождения $\le 0{,}5\%$ пикселей).

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
