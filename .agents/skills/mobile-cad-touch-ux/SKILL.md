---
name: mobile-cad-touch-ux
description: >-
  Provides UX patterns and technical implementations for complex mobile CAD, 3D, and engineering tools on touch devices.
  Use this skill when developing mobile bottom sheets, handling portrait vs landscape layout switching,
  implementing touch gestures (pinch-zoom, two-finger pan, long-press with haptics), or enforcing touch target sizing standards.
---

# Mobile CAD & 3D Touch UX Engineering

Руководство по разработке мобильных интерфейсов для сложных 3D-приложений, инженерных планов и САПР-инструментов.

## 1. Компоновка экрана: Портрет vs Альбомная ориентация

В инженерных 3D-инструментах экран смартфона имеет критически мало полезного пространства. Панели управления не должны перекрывать ключевую область сцены:

### Портретный режим (`portrait`)
* **Паттерн:** Нижняя вытяжная шторка (Bottom Sheet).
* **Состояния шторки:**
  1. `peek` (минимальное): виден только заголовок и основные кнопки быстрого действия (свернуть/развернуть). Сцена открыта на $85\%$.
  2. `half` (половина экрана): доступ к основным тумблерам групп и ракурсам.
  3. `full` (во весь экран): детальная настройка, списки штанкетов и карточки приборов.
* **Язычок шторки:** Высота не менее 44 px для уверенного захвата пальцем.

### Альбомный режим (`landscape`)
* **Паттерн:** Боковая колонка (Side Drawer).
* При повороте экрана шторка автоматически перестаёт быть нижней и превращается в боковую панель фиксированной ширины (например, 320 px) у правого края экрана.
* Центральная и левая часть экрана полностью отдаются под 3D-вьюпорт. Всплывающие карточки и тосты привязываются к правому верхнему углу.

```css
@media (orientation: landscape) and (max-height: 500px) {
  .mobile-sheet {
    top: 52px;
    bottom: 0;
    right: 0;
    left: auto;
    width: 320px;
    border-radius: 0;
    transform: none;
  }
}
```

## 2. Изоляция холста от паразитных жестов браузера

Чтобы манипуляции с 3D-моделью не вызывали случайное обновление страницы (pull-to-refresh) или системный зум страницы:

```css
html, body {
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
  -webkit-touch-callout: none;
  user-select: none;
}

canvas#stage-canvas {
  touch-action: none;
  display: block;
  width: 100%;
  height: 100%;
}
```

## 3. Жесты и тактильный отклик (Haptic Feedback)

### Долгое нажатие (Long-Press 500 мс)
Для второстепенных быстрых действий (например, включение/выключение конкретного прибора без открытия его полной карточки):

```javascript
let pressTimer = null;
let startX = 0, startY = 0;

element.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  
  pressTimer = setTimeout(() => {
    // Вызов виброотклика
    if (navigator.vibrate) {
      navigator.vibrate(40); // короткий чёткий импульс 40 мс
    }
    onLongPress(element);
    pressTimer = null;
  }, 500);
}, { passive: true });

element.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  // Отмена при смещении пальца более чем на 10 px
  if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 10) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}, { passive: true });

element.addEventListener('touchend', () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
});
```

## 4. Стандарт интерактивных зон ($\ge 44 \times 44$ px)

1. Все интерактивные кнопки, табы, значки и переключатели должны иметь размер кликабельной зоны не менее $44 \times 44$ px.
2. Для визуально компактных иконок (например, $20 \times 20$ px) кликабельная область расширяется с помощью прозрачного псевдоэлемента:
   ```css
   .small-icon-btn {
     position: relative;
     width: 24px;
     height: 24px;
   }
   .small-icon-btn::before {
     content: '';
     position: absolute;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
     min-width: 44px;
     min-height: 44px;
   }
   ```
3. Ползунки штанкетов и софитов должны поддерживать кнопки точной подстройки «$\pm 0{,}1 \text{ м}$» рядом со слайдером, так как попасть пальцем в точности до сантиметра на узком экране затруднительно.

## 5. Всплывающие уведомления (Toasts)

* Не должны перекрывать активные управляющие элементы.
* В портретном режиме: выводятся сверху под панелью заголовка (`top: 60px; left: 50%; transform: translateX(-50%)`).
* В альбомном режиме: сдвигаются вправо (`right: 330px; left: auto`).
* Время жизни: 1500–2500 мс с плавной анимацией затухания.
