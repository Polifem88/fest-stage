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

## 2. Мост между тестами и 3D-сценой (`testapi.js`)

Чтобы тесты могли взаимодействовать с внутренней сценой Three.js без хрупких симуляций мыши, в приложение встраивается глобальный интерфейс:
```javascript
// app/src/app/testapi.js
window.STAGE = {
  getPipeHeight: (pipeId) => { /* возвращает Y в метрах */ },
  setPipeHeight: (pipeId, h) => { /* двигает штанкет */ },
  getFixture: (fixtureId) => { /* возвращает состояние прибора */ },
  toggleFixture: (fixtureId) => { /* переключает состояние */ },
  setView: (viewName) => { /* 'hall', 'foh', 'plan', 'section', 'flyGallery' */ },
  getFps: () => { /* замер среднего FPS */ },
  raycastPick: (screenX, screenY) => { /* возвращает объект под курсором */ }
};
```

## 3. Снятие скриншотов по матрице ракурсов и устройств

Тестовый сценарий `shots.spec.js` должен проверять сцену в ключевых конфигурациях:

| Платформа | Разрешение | Ракурсы | Проверки |
|---|---|---|---|
| **Desktop** | 1920×1080 | Зал, Пульт, План (чертёж), План сцены крупно, Разрез, Галерея | Читаемость текста, отсутствие наложений, окраска экспликации, работа зума |
| **Mobile (Portrait)** | 390×844 (iPhone 14) | Зал, План, Карточка прибора, Bottom Sheet | Положение шторки, читаемость кнопок $\ge 44$ px, всплывающие тосты |
| **Mobile (Landscape)** | 844×390 | Зал, План | Перемещение шторки в боковую панель, сохранение видимости сцены |
| **Android** | 360×800 | Зал | Работа на компактных экранах |

Перед скриншотом всегда дожидаться стабильного кадра:
```javascript
await page.waitForFunction(() => window.STAGE && window.STAGE.isReady);
await page.waitForTimeout(200); // стабилизация рендера и анимаций
```

## 4. Верификация света и цвета пикселей (Luma & PickCheck)

Для проверки того, что включение прибора действительно меняет сцену, а не только UI:
* **Замер яркости (Luma):** Скрипты `luma.ps1` / `smoke.mjs` вырезают контрольную область планшета сцены до и после включения софита и сравнивают среднюю яркость пикселей:
  $$\text{Luma} = 0{,}2126 \cdot R + 0{,}7152 \cdot G + 0{,}0722 \cdot B$$
* **Проверка Raycasting (`pickcheck.mjs`):** Клик по центру экрана в ракурсе `hall` должен вернуть целевой объект (например, `proscenium` или трубу штанкета `pipe_0`), подтверждая точность хитбоксов.

## 5. Замер FPS под троттлингом (Stress Test)

Чтобы приложение работало плавно на недорогих смартфонах:
1. В Playwright сессии подключается CDP (Chrome DevTools Protocol) с замедлением процессора:
   ```javascript
   const client = await page.context().newCDPSession(page);
   await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
   ```
2. Выполняется непрерывная анимация (например, свободный облет камеры или опускание всех софитов) в течение 5 секунд.
3. Допустимый критерий: средний FPS $\ge 50$, минимальный $1\%$ low $\ge 30$ FPS, отсутствие утечек памяти (геометрии и текстуры удаляются через `.dispose()`).

## 6. Валидация мобильных кликабельных зон ($\ge 44 \times 44$ px)

Playwright сканирует все интерактивные селекторы (`button`, `input`, `.touch-target`):
```javascript
const elements = await page.$$('button, .clickable, input[type="range"]');
for (const el of elements) {
  const box = await el.boundingBox();
  if (box && (box.width < 44 || box.height < 44)) {
    throw new Error(`Element ${await el.evaluate(e => e.outerHTML)} is smaller than 44x44: ${box.width}x${box.height}`);
  }
}
```
