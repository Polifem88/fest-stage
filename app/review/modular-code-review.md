# Код-ревью: модульный каталог сцен (ветка `modular`, 281b991..d8ce704)

Ревьюер — независимая копия агента, режим «только чтение». Прочитаны: `GEMINI.md`, `README.md`, весь `app/src/**`
(engine, systems, core, library, export, ui, venues/*), `app/tests/**`, `app/scripts/parity.mjs`, `app/*.html`,
`vite.config.js`, `playwright.config.js`, `.github/workflows/*.yml`, навык `venue-module-authoring`.
`npx vitest run` — 53/53 зелёные (сборку и e2e не запускал, как договорились).

## Краткое резюме

Архитектура разделена хорошо: движок не знает о сценах (кроме одной строки, см. R6), площадка — модуль с контрактом и
валидатором, пересборка панелей через `stage.scope()` сделана аккуратно (подписки снимаются на `venueloading`, `emit`
идёт по копии массива), освобождение WebGL продумано (`disposeTree` + `sharedSet`), ссылки v1 читаются с той же
раскладкой. **Блокеров нет.**

Главное, что стоит поправить до слияния:
- **R1** — найденная ошибка: после смены сцены с выключенной дежуркой LED-линейки и синие приборы Большой сцены
  получают материал лампы (неверный цвет);
- **R2** — если загрузка или сборка площадки падает, интерфейс остаётся без панелей, а плашка «Строим…» не исчезает;
- **R3** — приборы Камерной (`К1…К18`) на телефоне не найти поиском (на цифровой клавиатуре нет буквы «К»);
- **R4/R5** — доступность списка сцен; на телефоне подсказка «скоро» не видна под шторкой;
- **R6** — `'big'` зашит в движке (нарушение §1.3), тест границ этого не ловит;
- **R7/R8** — дыры в тестах (офлайн-проверка только Большой сцены, утечки подписок не меряются) и устаревшая
  документация для авторов площадок.

| Серьёзность | Количество | Замечания |
|---|---|---|
| блокер | 0 | — |
| важно | 8 | R1–R8 |
| мелочь | 14 | R9–R22 |

---

## Важно

### R1. После смены сцены с выключенной дежуркой LED-линейки и синие приборы Большой сцены перекрашиваются в цвет лампы
- **Серьёзность:** важно · **Категория:** ошибка (регрессия, появилась из-за переноса режимов между сценами)
- **Где:** [stage.js](../src/engine/stage.js) `_applyFlags` (стр. 461–464) и `matNameFor` (стр. 928–932)
- **Суть.** Чтобы включить светящийся меш обратно, `_applyFlags` берёт материал по *имени*, которое `matNameFor()`
  запоминает **при первом вызове**. Но этот вызов случается, только когда дежурка включена. Режимы (`flags.duty`) теперь
  переносятся на новую сцену, поэтому только что построенная Большая сцена может получить первый `_applyFlags` с
  `duty = false`: меши сразу получают `_offMat()` (у него пустое имя), имя не запомнено. Когда дежурку включают,
  `matNameFor` читает `''` и отдаёт запасной вариант `'dutyBulb'`. В итоге `ledStrip` и `blueLed`
  ([architecture.js](../src/venues/fest-big/build/architecture.js) стр. 601–613) светятся тёплым светом лампы.
  Как воспроизвести: Большая → выключить дежурку → Камерная → Большая → включить дежурку.
- **Почему это важно.** На экране неверная картинка, а в снимках «чертежа» и PNG — неверные цвета; e2e это не ловит.
- **Предложение:** запоминать «включённый» материал при сборке, а не по имени.

```diff
--- a/app/src/engine/stage.js
+++ b/app/src/engine/stage.js
@@ _buildVenue(venue)
     this.rigging = built.rigging || null;
     this.emitters = built.emitters || null;
+    // «включённый» материал светящихся мешей — сразу: первый _applyFlags может их погасить
+    // (режимы переносятся с прошлой площадки, например дежурка выключена)
+    for (const g of Object.values(this.emitters || {})) for (const m of g.children) if (m.userData.emitter) m.userData.matOn = m.material;
@@ _applyFlags()
     if (this.emitters) {
-      for (const m of this.emitters.duty.children) if (m.userData.emitter) m.material = f.duty ? this.M[m.userData.emitter === 'duty' ? matNameFor(m) : 'houseLamp'] : this._offMat();
-      for (const m of this.emitters.house.children) m.material = f.house ? this.M.houseLamp : this._offMat();
+      for (const m of this.emitters.duty.children) if (m.userData.emitter) m.material = f.duty ? m.userData.matOn : this._offMat();
+      for (const m of this.emitters.house.children) if (m.userData.emitter) m.material = f.house ? m.userData.matOn : this._offMat();
     }
@@
-function matNameFor(m) {
-  if (m.material === undefined) return 'dutyBulb';
-  const n = m.userData.matName || (m.userData.matName = m.material.name);
-  return n || 'dutyBulb';
-}
```
На обеих площадках у детей `house` с `userData.emitter` материал `houseLamp`, поэтому на эталон (parity) правка не
влияет. Тест — в `tests/e2e/venues.spec.js`:

```js
test('дежурка: LED и синие приборы сохраняют цвет после смены сцены', async ({ page }, info) => {
  const log = await openApp(page, pageOf(info));
  const names = () => page.evaluate(() => window.__fest.stage.emitters.duty.children
    .filter((m) => m.userData.emitter).map((m) => m.material.name));
  const before = await names(); // ['dutyBulb', 'ledStrip', 'blueLed']
  await page.evaluate(async () => { const f = window.__fest; f.flag('duty', false); await f.loadVenue('chamber'); await f.loadVenue('big'); f.flag('duty', true); });
  expect(await names()).toEqual(before);
  expectNoErrors(log);
});
```

### R2. Если загрузка или сборка площадки падает, остаются плашка «Строим…» и пустые панели
- **Серьёзность:** важно · **Категория:** надёжность / гонки переключения
- **Где:** [stage.js](../src/engine/stage.js) `_loadVenue` (стр. 135–159); [venuePicker.js](../src/ui/venuePicker.js) стр. 63–73 и 92–96;
  `desktop.js`/`mobile.js` стр. 135/108
- **Суть.** На `venueloading` интерфейс **сразу** снимает панели старой площадки, а плашка ждёт только событие
  `venue`. Если `entry.load()` отклонён или `_buildVenue`/`build(ctx)` бросает исключение (для черновиков, которые ещё
  пишутся, это вполне вероятно), событие `venue` не приходит никогда. На холсте остаётся плашка, левая панель пуста,
  а `pick()` даёт «Uncaught (in promise)». Если исключение случилось после `_teardownVenue()`, `this.venue` указывает
  на наполовину построенную сцену.
- **Предложение (минимально):** ввести событие `venueerror`. Если модуль не загрузился, прежнюю площадку вернуть в UI
  (повторное `venue` пересобирает её панели), плашку снимать по обоим событиям.

```diff
--- a/app/src/engine/stage.js
+++ b/app/src/engine/stage.js
@@ async _loadVenue(id, { state = null } = {}) {
     const entry = venueEntry(id);
     this.emit('venueloading', entry);
-    const venue = (await entry.load()).default;
-    // дать браузеру нарисовать плашку «Строим…» до тяжёлой сборки геометрии
-    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
+    let venue;
+    try {
+      venue = (await entry.load()).default;
+      // дать браузеру нарисовать плашку «Строим…» до тяжёлой сборки геометрии
+      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
+    } catch (e) {
+      this.emit('venueerror', entry, e);
+      if (this.venue) this.emit('venue', this.venue); // прежняя площадка цела — вернуть ей панели
+      throw e;
+    }
     if (this.venue) {
```
```diff
--- a/app/src/ui/venuePicker.js
+++ b/app/src/ui/venuePicker.js
@@ const pick = async (v) => {
     try {
       await stage.loadVenue(v.id);
       history.replaceState(null, '', stage.shareUrl());
       if (v.status === 'draft') toast(`${v.name}: черновик — размеры условные`, 2600);
-    } finally { btn.disabled = false; }
+    } catch { /* сообщение показал обработчик venueerror */ } finally { btn.disabled = false; }
   };
@@ stage.on('venueloading', (e) => {
     const veil = h('div', { class: 'loading venue-veil' }, `Строим: ${e.name}…`);
     stage.container.append(veil);
-    const off = stage.on('venue', () => { veil.remove(); off(); });
+    const done = () => { veil.remove(); offV(); offE(); };
+    const offV = stage.on('venue', done);
+    const offE = stage.on('venueerror', (en, err) => { done(); toast(`Не удалось открыть «${en.name}»`, 3500); console.error(err); });
   });
```
Ошибку `_buildVenue` после разбора старой сцены лучше всего обработать так: в `catch` вызвать `_teardownVenue()`,
выдать `venueerror` и открыть `DEFAULT_VENUE` (отдельная задача, если сочтёте нужным).

### R3. Приборы Камерной не найти поиском на телефоне; латинская «K» тоже не подходит
- **Серьёзность:** важно · **Категория:** функциональность / мобильная эргономика
- **Где:** [common.js](../src/ui/common.js) `fixtureSearch` (стр. 208–219); номера — [fest-chamber/config/fixtures.js](../src/venues/fest-chamber/config/fixtures.js) стр. 50 (`no: 'К1'…`)
- **Суть.** У поля `inputmode="numeric"`: iOS и Android показывают цифровую клавиатуру без букв, поэтому
  «К7» (кириллица) набрать нельзя, а «7» не находится (`byNo` хранит точную строку). На компьютере «K7» в латинской
  раскладке тоже даёт «не найден».
- **Предложение:** чуть более терпимый поиск, номера в конфиге не меняются.

```diff
--- a/app/src/ui/common.js
+++ b/app/src/ui/common.js
@@ export function fixtureSearch(stage, { compact = false } = {}) {
+  /** «53», «к7», «K7» (латиница), «7» — если на площадке такой номер один («К7»). */
+  const find = (q) => {
+    const F = stage.fixtures.byNo, up = q.toUpperCase().replace(/K/g, 'К');
+    const exact = F.get(q) || F.get(up);
+    if (exact || !/^\d+$/.test(q)) return exact || null;
+    const byDigits = stage.fixtures.list.filter((f) => String(f.no).replace(/\D/g, '') === q);
+    return byDigits.length === 1 ? byDigits[0] : null;
+  };
   const doFind = () => {
     const q = search.value.trim();
     if (!q) { search.focus(); return; }
-    const f = stage.fixtures.byNo.get(q) || stage.fixtures.byNo.get(q.toUpperCase());
+    const f = find(q);
```

### R4. В списке сцен у кнопок `role="listitem"` — пропадает роль кнопки
- **Серьёзность:** важно · **Категория:** доступность
- **Где:** [venuePicker.js](../src/ui/venuePicker.js) стр. 21 и 53
- **Суть.** `<button role="listitem">` заменяет роль `button`: экранный диктор зачитает «элемент списка» и не скажет,
  что его можно нажать. А это главный способ сменить сцену.
- **Предложение:** убрать обе роли: кнопки в `<div>` читаются как кнопки, а `aria-current`/`aria-disabled` остаются.
  Если структура списка нужна, сделать обёртку `<div role="listitem"><button>…</button></div>`.

```diff
--- a/app/src/ui/venuePicker.js
+++ b/app/src/ui/venuePicker.js
-  const list = h('div', { class: 'venue-list', role: 'list' });
+  const list = h('div', { class: 'venue-list' });
@@
-        class: `venue-item${v.id === cur ? ' current' : ''}${soon ? ' soon' : ''}`, type: 'button', role: 'listitem',
+        class: `venue-item${v.id === cur ? ' current' : ''}${soon ? ' soon' : ''}`, type: 'button',
```

### R5. На телефоне сообщение «модель пока готовится» не видно: тост под шторкой-диалогом
- **Серьёзность:** важно · **Категория:** мобильный UX / доступность
- **Где:** [venuePicker.js](../src/ui/venuePicker.js) стр. 64; стили `.toasts` (bottom: 24px) и `.mobile .venue-picker` (прижат к низу)
- **Суть.** Модальный `<dialog>` лежит в top layer поверх любых `z-index`, а всё вне его становится `inert`. Тост
  внизу экрана оказывается **под** шторкой списка: нажатие на «скоро» на телефоне выглядит как отсутствие реакции.
  Диктор этот тост тоже не прочитает (живая область inert). e2e-тест только нажимает и не проверяет обратную связь.
- **Предложение:** строка состояния внутри диалога.

```diff
--- a/app/src/ui/venuePicker.js
+++ b/app/src/ui/venuePicker.js
   const list = h('div', { class: 'venue-list' });
+  const note = h('p', { class: 'venue-note', role: 'status' });
   const dlg = h('dialog', { … },
     h('div', { class: 'venue-head' }, …),
     list,
+    note,
   );
@@ const pick = async (v) => {
-    if (v.status === 'soon' || !v.load) { toast(`«${v.name}» — модель пока готовится`, 2200); return; }
+    if (v.status === 'soon' || !v.load) { note.textContent = `«${v.name}» — модель пока готовится`; return; }
@@ function open() {
     onBefore?.();
+    note.textContent = '';
     render();
```
```css
.venue-note { margin: 0 16px 12px; min-height: 1.3em; color: var(--muted); font-size: 13px; }
.venue-note:empty { display: none; }
```
В тест «переключение сцены…» добавить
`await expect(page.locator('.venue-note')).toContainText('готовится')` после щелчка по `roof`.

### R6. В движке зашит id `'big'`; тест границ не ищет id площадок; `openState` принимает любой JSON
- **Серьёзность:** важно · **Категория:** нарушение GEMINI.md §1.3 + дыра в тесте
- **Где:** [stage.js](../src/engine/stage.js) стр. 860; [boundaries.test.js](../tests/unit/boundaries.test.js) стр. 66–76
- **Суть.** `id = strOrObj?.venue || 'big'` — id конкретной сцены в общем коде, хотя `LEGACY_VENUE` уже экспортируется
  реестром. Тест не замечает этого: регулярное выражение ищет названия, а не id, и `core/` в проверку названий не
  входит. Заодно любой JSON (`{}`, чужой файл) молча переключает на Большую сцену с тостом «Состояние загружено».
- **Предложение:**

```diff
--- a/app/src/engine/stage.js
+++ b/app/src/engine/stage.js
-import { DEFAULT_VENUE, venueEntry, isOpenable } from '../venues/registry.js';
+import { DEFAULT_VENUE, LEGACY_VENUE, venueEntry, isOpenable } from '../venues/registry.js';
@@ async openState(strOrObj) {
     let id;
     if (typeof strOrObj === 'string') id = peekVenue(strOrObj);
-    else id = strOrObj?.venue || 'big';
+    // файл до каталога сцен (без venue) — Большая сцена; объект без состояния — не наш файл
+    else if (strOrObj && (strOrObj.heights || strOrObj.fixturesOn)) id = strOrObj.venue || LEGACY_VENUE;
     if (!id || !isOpenable(id)) return false;
```
```diff
--- a/app/tests/unit/boundaries.test.js
+++ b/app/tests/unit/boundaries.test.js
+import { CATALOG } from '../../src/venues/catalog.js';
@@
+  it('в движке, системах, ядре, справочнике и экспорте нет id площадок', () => {
+    const ids = new RegExp(`['"\`](${CATALOG.map((v) => v.id).join('|')})['"\`]`);
+    const bad = [];
+    for (const f of files.filter((f) => ['engine', 'systems', 'core', 'library', 'export'].includes(top(f)))) {
+      readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
+        if (/^(\/\/|\/\*|\*)/.test(line.trim())) return;
+        if (ids.test(line)) bad.push(`${rel(f)}:${n + 1}: ${line.trim().slice(0, 90)}`);
+      });
+    }
+    expect(bad).toEqual([]);
+  });
```
(Проверено: сейчас правило срабатывает ровно на `stage.js:860`. `ui/` не включён из-за CSS-класса `'big'` в
`common.js:362`.)

### R7. Тесты: офлайн-проверка только по площадке по умолчанию; тест утечек не меряет подписки и DOM
- **Серьёзность:** важно · **Категория:** тесты
- **Где:** [perf.spec.js](../tests/e2e/perf.spec.js) стр. 107–119; [venues.spec.js](../tests/e2e/venues.spec.js) стр. 56–73
- **Суть.** (а) По §2.1 *все* площадки встроены в каждый HTML и открываются по `file://`. Тест «двойным кликом»
  открывает только Большую сцену, то есть ленивый `import()` в однофайловой сборке не проверяется. (б) Основной риск
  этой ветки — подписки `stage.scope()`, плашки и диалоги. Тест утечек считает только геометрии и текстуры WebGL.
- **Предложение:**

```diff
--- a/app/tests/e2e/perf.spec.js
+++ b/app/tests/e2e/perf.spec.js
     await applyShot(page, 'hall');
     expect(await page.evaluate(() => window.__fest.stats().calls)).toBeGreaterThan(10);
+    // все площадки встроены в тот же файл и открываются без сети
+    for (const v of await page.evaluate(() => window.__fest.venues.filter((e) => e.status !== 'soon').map((e) => e.id))) {
+      await page.evaluate((id) => window.__fest.loadVenue(id), v);
+      expect(await page.evaluate(() => window.__fest.venue())).toBe(v);
+    }
     expect(external, 'запросы в интернет').toEqual([]);
```
```diff
--- a/app/tests/e2e/venues.spec.js
+++ b/app/tests/e2e/venues.spec.js
   const mem = () => page.evaluate(async () => {
     await window.__fest.loadVenue('chamber');
     await window.__fest.loadVenue('big');
     window.__fest.renderNow();
-    const m = window.__fest.stage.renderer.info.memory;
-    return { g: m.geometries, t: m.textures };
+    const st = window.__fest.stage, i = st.renderer.info;
+    return {
+      g: i.memory.geometries, t: i.memory.textures, p: i.programs.length,
+      l: Object.values(st.listeners).reduce((n, a) => n + a.length, 0), // подписки панелей
+      dom: document.getElementsByTagName('*').length,                  // плашки, панели, диалоги
+    };
   });
@@
   expect(Math.abs(last.t - first.t), 'текстуры').toBeLessThanOrEqual(2);
+  expect(last.l, 'подписки на события stage').toBe(first.l);
+  expect(Math.abs(last.dom - first.dom), 'узлы DOM').toBeLessThanOrEqual(5);
+  expect(Math.abs(last.p - first.p), 'шейдерные программы').toBeLessThanOrEqual(2);
```

### R8. Документация для авторов площадок расходится с кодом
- **Серьёзность:** важно · **Категория:** документация / навык (по §7 GEMINI.md автор работает по ним)
- **Где и что:**
  1. [_template/README.md](../src/venues/_template/README.md) стр. 49–50: «добавьте строку
     `{ id, name, …, load: () => import(…) }` в registry.js». Это формат до разделения: теперь описание лежит в
     `catalog.js`, а в `registry.js` — только словарь `LOADERS`. Если сделать по README, `LOADERS` сломается.
  2. [SKILL.md](../../.agents/skills/venue-module-authoring/SKILL.md) стр. 89: формат прибора
     `{ pos, target, beam, … }` не совпадает с кодом. На самом деле `{ no, type, group, mount:{on,x,y,d}, aim:{x,y,d} }`,
     луч берётся из `TYPES[type].beam`, а `mount.d`/`mount.y` отсчитываются от `BAR_DEPTH[on]` и высоты трубы
     (`FixtureSystem.mountPos`).
  3. SKILL.md стр. 146: `batch.add(layerKey, geometry, materialKey)`, а в коде
     `add(layer, material, geometry|geometry[], {tag, shadow, uv})` (`core/geom.js:112`), причём material — объект.
  4. SKILL.md стр. 141–143 требует ключ кэша `'pool-<id>'`, а у Большой сцены `'pool-clip'`
     ([floor.js](../src/venues/fest-big/build/floor.js) стр. 47) — образец сам нарушает правило.
  5. SKILL.md стр. 257: «тест проверяет отсутствие id сцены» — не проверяет (см. R6).
  6. SKILL.md стр. 54: ссылка `file:///app/src/...` битая (абсолютный путь от корня диска).
- **Предложение:**

```diff
--- a/app/src/venues/_template/README.md
+++ b/app/src/venues/_template/README.md
-5. **Реестр** — добавьте строку в `venues/registry.js`:
-   `{ id: '<id>', name: '…', status: 'draft', type: 'Чёрный кабинет', seats: N, load: () => import('./<папка>/index.js') }`.
+5. **Каталог и реестр** — описание сцены в `venues/catalog.js`:
+   `{ id: '<id>', name: '…', short: '…', status: 'draft', type: 'Чёрный кабинет', seats: N }`;
+   загрузчик — в `LOADERS` файла `venues/registry.js`: `<id>: () => import('./<папка>/index.js')`.
```
```diff
--- a/.agents/skills/venue-module-authoring/SKILL.md
+++ b/.agents/skills/venue-module-authoring/SKILL.md
-- `FIXTURES`: массив приборов `{ no, type, group, pos: [x,y,d], target: [tx,ty,td], beam, mount: { on, ... } }`. Номера приборов `no` уникальны в пределах площадки. Приборы на подвижных подъёмах имеют `mount: { on: '<rig_id>' }`.
+- `FIXTURES`: массив `{ no, type, group, mount: { on, x, y, d }, aim: { x, y, d } }`; угол луча — из `TYPES[type].beam`.
+  На подвижной трубе `mount.on = '<rig_id>'`: `d` — от `BAR_DEPTH[on]`, `y` — от высоты трубы; на неподвижной
+  конструкции `on: null`, координаты абсолютные. Номера `no` уникальны в пределах площадки.
@@
-- `ctx.batch` — пакетный сборщик статики (`batch.add(layerKey, geometry, materialKey)`), склеивающий геометрию в минимальное число draw calls.
+- `ctx.batch` — пакетный сборщик статики: `batch.add(layerKey, material, geometry | geometry[], { tag?, shadow? })`,
+  material — объект из `ctx.M`; склеивает геометрию «слой + материал» в один меш.
@@
-  Используется параметрический шаблон `app/src/venues/_template/` (см. [README.md](file:///app/src/venues/_template/README.md)) …
+  Используется параметрический шаблон `app/src/venues/_template/` (см. [README.md](../../../app/src/venues/_template/README.md)) …
```
А в `floor.js:47` написать `mat.customProgramCacheKey = () => 'pool-big';`. Шейдер не меняется, сменится только ключ
кэша; на эталон не влияет.

---

## Мелочи

### R9. Регрессия в заголовке «Поделиться» (` — Камерная сцена`); «ФЭСТ» зашит в коде мимо `THEATRE_NAME`
- **Серьёзность:** мелочь · **Категория:** ошибка / SSOT
- **Где:** [common.js](../src/ui/common.js) стр. 340 (`THEATRE_NAME` импортирован в стр. 5, но не используется);
  `desktop.js:129`, `mobile.js:102`; `stage.js:798` (`fest-` в имени файлов); `glbGeneric.js:13` (`FEST_`);
  статичные `<title>` в `desktop.html`/`mobile.html` («ФЭСТ — Большая сцена…» видно до загрузки и по ссылке `#v=chamber`)
- **Суть.** При замене строки `'ФЭСТ — Большая сцена'` потерялось название театра: в системном окне «Поделиться» —
  заголовок с тире в начале.

```diff
--- a/app/src/ui/common.js
+++ b/app/src/ui/common.js
-    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: ` — ${stage.venue.name}`, url }); return; }
+    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: `${THEATRE_NAME} — ${stage.venue.name}`, url }); return; }
--- a/app/src/ui/desktop.js
+++ b/app/src/ui/desktop.js
-import { venueBrand } from './venuePicker.js';
+import { venueBrand } from './venuePicker.js';
+import { THEATRE_NAME } from '../venues/registry.js';
@@
-      document.title = `${stage.venue.name} · ФЭСТ (компьютер)`;
+      document.title = `${stage.venue.name} · ${THEATRE_NAME} (компьютер)`;
```
(То же в `mobile.js`. В `desktop.html`/`mobile.html`: `<title>ФЭСТ · 3D-каталог сцен (компьютер|телефон)</title>`.
Префиксы файлов `fest-`/`FEST_` по желанию вынести в `catalog.js` как `FILE_PREFIX = 'fest'`; на parity это не
влияет, там сравнивается содержимое.)

### R10. При запуске две надписи «Строим…» поверх друг друга
- **Серьёзность:** мелочь · **Категория:** UI
- **Где:** `desktop.js:12`/`mobile.js:12` (`.loading` на весь экран) + [venuePicker.js](../src/ui/venuePicker.js) стр. 92–96 (плашка на холсте)
- **Суть.** `boot()` тоже отправляет `venueloading`. На телефоне `.viewport` занимает весь экран, поэтому
  «Строим сцену…» и «Строим: Большая сцена…» ложатся одна на другую по центру; на компьютере — со сдвигом.

```diff
   stage.on('venueloading', (e) => {
+    if (!stage.venue) return; // первый запуск: уже есть общая заставка .loading
     const veil = h('div', { class: 'loading venue-veil' }, `Строим: ${e.name}…`);
```

### R11. Во время переключения старые панели кликабельны; после переключения теряется фокус
- **Серьёзность:** мелочь · **Категория:** гонки UI / доступность
- **Где:** `desktop.js:135`, `mobile.js:108`; [venuePicker.js](../src/ui/venuePicker.js) стр. 67–72
- **Суть.** (а) После `venueloading` панели отписаны, но остаются в DOM и нажимаются (плашка накрывает только холст):
  щелчки меняют сцену, которую сейчас разберут, а панели не обновляются. (б) `btn.disabled = true` у кнопки, куда
  диалог только что вернул фокус, — фокус улетает на `<body>`; пользователь клавиатуры теряет место.

```diff
--- a/app/src/ui/desktop.js
+++ b/app/src/ui/desktop.js
   const mountVenue = () => {
     unmount?.();
+    side.inert = false; quickSlot.inert = false;
@@
-  stage.on('venueloading', () => { unmount?.(); unmount = null; });
+  stage.on('venueloading', () => { unmount?.(); unmount = null; side.inert = true; quickSlot.inert = true; });
--- a/app/src/ui/venuePicker.js
+++ b/app/src/ui/venuePicker.js
-    btn.disabled = true;
+    btn.setAttribute('aria-busy', 'true'); btn.classList.add('busy'); // фокус остаётся на кнопке
@@
-    } finally { btn.disabled = false; }
+    } finally { btn.removeAttribute('aria-busy'); btn.classList.remove('busy'); }
```
(В `mobile.js` аналогично — `sheet.inert`. Очередь в `loadVenue` и так защищает от двойного запуска, `disabled` для
этого не нужен. Стиль `.brand-btn.busy` — как сейчас у `:disabled`.)

### R12. Неиспользуемая ветка `loadVenue(id, { state })`; событие `state` отправляется дважды
- **Серьёзность:** мелочь · **Категория:** мёртвый код / лишние перерисовки
- **Где:** [stage.js](../src/engine/stage.js) стр. 128–159, 262–274
- **Суть.** Опцию `state` никто не передаёт (поиск по `loadVenue(` это подтверждает). Ветка «та же площадка +
  state» и `_restore(…, { flags: true })` не исполняются никогда. Кроме того, `_restore → loadState` уже отправляет
  `state`, а `_loadVenue` отправляет его ещё раз: панели света и слоёв пересчитываются дважды на каждое переключение.

```diff
-  async loadVenue(id, opts = {}) {
+  async loadVenue(id) {
     // переключения выполняются строго по очереди (двойной щелчок не строит две сцены разом)
-    const run = () => this._loadVenue(id, opts);
+    const run = () => this._loadVenue(id);
@@
-  async _loadVenue(id, { state = null } = {}) {
+  async _loadVenue(id) {
     if (!isOpenable(id)) return false;
-    if (this.venue?.id === id) {
-      if (state) { this._restore(state, { flags: true }); this.emit('state'); }
-      return true;
-    }
+    if (this.venue?.id === id) return true;
@@
-    const mem = state || this._memory.get(venue.id);
-    if (mem) this._restore(mem, { flags: !!state });
+    const mem = this._memory.get(venue.id);
+    if (mem) this._restore(mem); // loadState сам шлёт 'state'
     this.emit('select', null, null); // выбор прежней площадки снят
-    this.emit('state');
+    if (!mem) this.emit('state');
```
(Если опция задумана на будущее — пусть её использует `openState`, тогда не будет двойного восстановления:
сначала из памяти, потом из файла.)

### R13. `scope()` теряет подписки при исключении; без защиты `ctx.add`/`batch.add` геометрия теряется молча
- **Серьёзность:** мелочь · **Категория:** надёжность (пригодится авторам новых площадок)
- **Где:** [stage.js](../src/engine/stage.js) стр. 65–70 и 188–202
- **Суть.** (а) Если сборка панелей бросает исключение, уже сделанные подписки остаются навсегда: функция снятия не
  возвращается. (б) Вызов `batch.add` после `commitBatch()`/`ctx.add()` молча пропадает. Слой, которого нет в
  `venue.layers`, в `batch` тоже пропадает, а в `ctx.add` даёт невнятное `Cannot read properties of undefined`.

```diff
   scope(fn) {
     const prev = this._scope;
     const list = (this._scope = []);
-    try { fn(); } finally { this._scope = prev; }
-    return () => { for (const [ev, f] of list) this.off(ev, f); list.length = 0; };
+    const dispose = () => { for (const [ev, f] of list) this.off(ev, f); list.length = 0; };
+    try { fn(); } catch (e) { dispose(); throw e; } finally { this._scope = prev; }
+    return dispose;
   }
@@ _buildVenue
     const commitBatch = () => {
       if (this.layerGroups) return;
       const built = batch.build();
+      for (const k of Object.keys(built)) if (!(k in this.layers)) throw new Error(`площадка ${venue.id}: слой «${k}» не описан в layers`);
+      batch.add = () => { throw new Error(`площадка ${venue.id}: batch.add после commitBatch()/add() — геометрия не попадёт в сцену`); };
@@
-    const add = (layer, ...objs) => { commitBatch(); this.layerGroups[layer].add(...objs); };
+    const add = (layer, ...objs) => {
+      commitBatch();
+      if (!this.layerGroups[layer]) throw new Error(`площадка ${venue.id}: слой «${layer}» не описан в layers`);
+      this.layerGroups[layer].add(...objs);
+    };
```

### R14. Дежурный и зальный свет переносятся между сценами, а по §2.2 «свет запоминается для каждой площадки»
- **Серьёзность:** мелочь (вопрос к владельцу) · **Категория:** соответствие правилам
- **Где:** [stage.js](../src/engine/stage.js) стр. 37 (`flags.duty/house`) и `_restore` (стр. 262–264)
- **Суть.** В §2.2 переносимые режимы перечислены (чертёж, дымка, подписи, сетка, размеры), а «механика, свет, слои…»
  должны храниться у каждой площадки отдельно. Но `duty`/`house` лежат во `flags` и переносятся. Из-за этого, кстати,
  и проявилась R1. Нужно выбрать одно: (а) уточнить §2.2 («дежурный/зальный свет — тоже режим») или (б) хранить их
  у площадки:

```diff
   _restore(st, { flags = false } = {}) {
-    const s = flags ? st : { ...st, flags: undefined };
+    // режимы отображения общие, а дежурный и зальный свет — свои у каждой площадки (GEMINI.md §2.2)
+    const own = st.flags ? { duty: st.flags.duty, house: st.flags.house } : undefined;
+    const s = flags ? st : { ...st, flags: own };
```
(`loadState` делает `Object.assign(this.flags, st.flags)`, поэтому остальные режимы не тронутся. В тест «память сцен»
добавить проверку `duty`.)

### R15. «Магические числа» в построителях шаблона и Большой сцены (§1.3)
- **Серьёзность:** мелочь, отчасти вкусовщина · **Категория:** правила
- **Где:** [_template/build.js](../src/venues/_template/build.js) стр. 69–73 (пропорции кресла), 114–116 (шнур
  0,008, патрон); [_template/overlays.js](../src/venues/_template/overlays.js) стр. 25–29 (камеры 1,9 / 0,27 / 1,7 / 1,3),
  43–59 (отступы размеров 0,35 / 0,4 / 2,5…); [fest-big/build/ambient.js](../src/venues/fest-big/build/ambient.js)
  стр. 35 (точки зального света `[[-4,-9],[4,-9],[0,-15]]` — это геометрия, у Камерной она в `config`)
- **Суть.** В шапке шаблона есть оговорка «кроме мелких визуальных зазоров и пропорций», а в правиле §1.3 исключений
  нет. Переносить все пропорции кресла в `config` — лишняя работа без пользы. Дешевле сделать так: (1) узаконить
  исключение в правиле; (2) геометрически значимые точки (зальный свет Большой сцены) перенести в `config/dimensions.js`.

```diff
--- a/GEMINI.md
+++ b/GEMINI.md
-   - В построителях площадок и в `systems/` **запрещены «магические числа»**: любая геометрия — из `config/` своей площадки.
+   - В построителях площадок и в `systems/` **запрещены «магические числа»**: любая геометрия — из `config/` своей площадки.
+     Исключение — визуальные пропорции и зазоры деталей (кресло, патрон лампы, отступы подписей), не влияющие на размеры
+     помещения и развес; они собраны в именованные константы в начале файла построителя.
```
(Для `ambient.js`: `DIM.hall.houseLights = { full: [[-4,-9],[4,-9],[0,-15]], lite: [[0,-11]] }`; parity сохранится.)

### R16. На телефоне у Камерной пустой раздел «Экспорт в CAD / 3D»
- **Серьёзность:** мелочь · **Категория:** UI
- **Где:** [common.js](../src/ui/common.js) `viewsPanel`, стр. 323–324
- **Суть.** На телефоне есть только 2D DXF, у Камерной DXF нет, поэтому `exportButtons` пуст, а заголовок остаётся.

```diff
-  return h('div', { class: 'panel-views' },
-    h('h4', {}, 'Точки обзора'), grid,
-    h('h4', {}, 'Экспорт в CAD / 3D'),
-    h('div', { class: 'grid-1 export-panel' }, exportButtons(stage)),
+  const exp = exportButtons(stage);
+  return h('div', { class: 'panel-views' },
+    h('h4', {}, 'Точки обзора'), grid,
+    exp.length ? [h('h4', {}, 'Экспорт в CAD / 3D'), h('div', { class: 'grid-1 export-panel' }, exp)] : null,
```

### R17. Общий экспорт GLB теряет цвета экземпляров (все приборы белые)
- **Серьёзность:** мелочь · **Категория:** экспорт
- **Где:** [glbGeneric.js](../src/export/glbGeneric.js) стр. 39–49
- **Суть.** Корпуса приборов — `InstancedMesh` с белым `bodyMat` и цветом в `instanceColor`. При разборе на отдельные
  меши берётся только материал, и в `.glb` Камерной все приборы белые.

```diff
   const matFor = (m, tint) => {
     const src = Array.isArray(m) ? m[0] : m;
-    if (!mats.has(src)) {
+    const key = tint ? `${src.uuid}:${tint.getHexString()}` : src;
+    if (!mats.has(key)) {
       const out = new THREE.MeshStandardMaterial({
         name: src.name || 'material',
-        color: src.color ? src.color.clone() : new THREE.Color(0x808080),
+        color: (src.color ? src.color.clone() : new THREE.Color(0x808080)).multiply(tint || new THREE.Color(1, 1, 1)),
@@
-      mats.set(src, out);
+      mats.set(key, out);
     }
-    return mats.get(src);
+    return mats.get(key);
   };
@@
         const m = new THREE.Matrix4();
+        const c = new THREE.Color();
         for (let i = 0; i < o.count; i++) {
           o.getMatrixAt(i, m);
           if (Math.abs(m.determinant()) < 1e-12) continue; // скрытые экземпляры (масштаб 0)
-          const mesh = new THREE.Mesh(o.geometry, matFor(mat));
+          if (o.instanceColor) o.getColorAt(i, c);
+          const mesh = new THREE.Mesh(o.geometry, matFor(mat, o.instanceColor ? c : null));
```

### R18. Неточные комментарии и JSDoc
- **Серьёзность:** мелочь · **Категория:** документация в коде
- **Где и что:**
  - `systems/lighting.js:4–5`: «дежурный/зальный свет (venue.ambientLights)», а на деле `built.ambient(plan)` из `build(ctx)`;
  - `venues/contract.js:13`: `meta` «для карточки в списке сцен» — список и стартовая страница берут данные из
    `catalog.js`, `meta` в UI не используется (`meta.note` никто не читает); стр. 20 `controlNames?` движок не читает;
  - `caps.counterweights` нигде не используется в UI и движке — пометить в JSDoc как информационный флаг;
  - `perf.spec.js:4` пишет «mobile.html ≤ 3 МБ», а `MOBILE_MAX_MB = 3` (стр. 16, 100) перекрывается бюджетом 1,3 МБ — убрать.

```diff
--- a/app/src/systems/lighting.js
+++ b/app/src/systems/lighting.js
-// Общая система для всех площадок: состав групповых источников (venue.lightPlans)
-// и дежурный/зальный свет (venue.ambientLights) приходят из модуля площадки.
+// Общая система для всех площадок: состав групповых источников (venue.lightPlans)
+// и дежурный/зальный свет (built.ambient(plan) — результат venue.build) приходят из модуля площадки.
--- a/app/src/venues/contract.js
+++ b/app/src/venues/contract.js
- * @property {{type:string, seats?:number, note?:string}} meta   — для карточки в списке сцен
+ * @property {{type:string, seats?:number, note?:string}} meta   — паспорт; type/seats сверяются тестом с catalog.js
+ *           (список сцен и стартовая страница берут данные из catalog.js)
- * @property {{list: RigCfg[], controlNames?: Record<string,string>, describe?: Function}|null} rigging
+ * @property {{list: RigCfg[], describe?: (cfg: RigCfg, stage) => Array<[string, string]>}|null} rigging
@@
- * @typedef {{rigging:boolean, counterweights:boolean, portable:boolean, duty:boolean, houseLight:boolean}} Capabilities
+ * @typedef {{rigging:boolean, counterweights:boolean, portable:boolean, duty:boolean, houseLight:boolean}} Capabilities
+ *           counterweights — информационный (противовесы строит сама площадка), интерфейс по нему ничего не скрывает
```

### R19. Отступления от GEMINI.md: вибрация 15 мс вместо 40; вотчер Vite не исключает `test-results/`
- **Серьёзность:** мелочь · **Категория:** правила §3.2, §4.4
- **Где:** [common.js](../src/ui/common.js) стр. 161; [vite.config.js](../vite.config.js) стр. 13

```diff
-        c.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; stage.setFixture(f.idx, !f.on); navigator.vibrate?.(15); …
+        c.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; stage.setFixture(f.idx, !f.on); navigator.vibrate?.(40); …
--- a/app/vite.config.js
+++ b/app/vite.config.js
-  server: { host: true, port: 5173, watch: { ignored: ['**/review/**', '**/dist/**'] } },
+  server: { host: true, port: 5173, watch: { ignored: ['**/review/**', '**/dist/**', '**/test-results/**'] } },
```

### R20. CI и снимки: двойной запуск для PR, бюджет размера не проверяется; `VENUE=chamber` всё равно снимает Большую
- **Серьёзность:** мелочь · **Категория:** CI / тестовая инфраструктура
- **Где:** `.github/workflows/check.yml` (`push: branches-ignore: [master]` + `pull_request`); [shots.spec.js](../tests/e2e/shots.spec.js) стр. 29, 123
- **Суть.** (а) Push в ветку с открытым PR запускает проверку дважды. (б) Бюджет 1,3 / 0,1 МБ (§2.1) проверяется
  только в e2e, а в CI e2e не запускается, поэтому раздувание сборки дойдёт до `master`. (в) GEMINI §4.2 обещает
  «для одной площадки — `VENUE=chamber`», но тест «снимки всех видов» (Большая) от `VENUE` не зависит.

```diff
--- a/.github/workflows/check.yml
+++ b/.github/workflows/check.yml
       - name: Сборка (три страницы — три html-файла)
         run: npm run build
+      - name: Бюджет размера (GEMINI.md §2.1)
+        run: node -e "const s=(f)=>require('fs').statSync('dist/'+f).size/1048576;const b={'index.html':0.1,'desktop.html':1.3,'mobile.html':1.3};let ok=true;for(const[f,m]of Object.entries(b)){console.log(f,s(f).toFixed(2),'МБ');if(s(f)>m)ok=false}process.exit(ok?0:1)"
--- a/app/tests/e2e/shots.spec.js
+++ b/app/tests/e2e/shots.spec.js
 test('снимки всех видов', async ({ page }, info) => {
+  test.skip(!!process.env.VENUE && process.env.VENUE !== 'big', 'снимается только площадка VENUE');
```
(Для (а): оставить `pull_request` только для PR из форков или добавить
`concurrency: { group: check-${{ github.ref }}, cancel-in-progress: true }`.)

### R21. Дубли: `meta.type`/`seats` и каталог, плотность дымки `?? 0.3`
- **Серьёзность:** мелочь · **Категория:** SSOT
- **Где:** `venues/*/index.js` `meta` и `catalog.js`; [common.js](../src/ui/common.js) стр. 115 (`?? 0.3` вместо `HAZE_DEFAULT`)
- **Суть.** Тип площадки записан дважды, а тест сверяет только `seats`. Значение плотности по умолчанию дублирует
  константу системы.

```diff
--- a/app/tests/unit/venues.contract.test.js
+++ b/app/tests/unit/venues.contract.test.js
     if (entry.seats != null && venue.meta.seats != null) expect(venue.meta.seats).toBe(entry.seats);
+    if (entry.type) expect(venue.meta.type).toBe(entry.type);
--- a/app/src/ui/common.js
+++ b/app/src/ui/common.js
+import { HAZE_DEFAULT } from '../systems/fixtures.js';
@@
-    const v = Math.round((stage.flags.hazeDensity ?? 0.3) * 100);
+    const v = Math.round((stage.flags.hazeDensity ?? HAZE_DEFAULT) * 100);
```

### R22. В списке сцен ↑ с кнопки «×» ведёт на предпоследний пункт
- **Серьёзность:** мелочь · **Категория:** клавиатура
- **Где:** [venuePicker.js](../src/ui/venuePicker.js) стр. 41–42
- **Суть.** При фокусе вне списка `i = -1`, поэтому `(-1 - 1 + n) % n = n - 2`.

```diff
     const i = items.indexOf(document.activeElement);
-    const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
+    const n = i < 0 ? items[e.key === 'ArrowDown' ? 0 : items.length - 1]
+      : items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
```

---

## Что сделано хорошо

- **Границы модулей.** Движок, системы и интерфейс ходят к площадкам только через `registry.js`/`catalog.js`;
  стартовая страница тянет лишь `catalog.js` без 3D-кода. Есть автоматический тест границ.
- **Контракт площадки.** `validateVenue()` содержательный: слои, виды, механика ↔ `caps`, приборы ↔ группы,
  `barDepth`, световые планы, лимит 30 бит маски слоёв. Тест прогоняет все открываемые площадки.
- **Переключение сцен.** Очередь `loadVenue` (`then(run, run)` переживает ошибку предыдущего шага); `emit` идёт по
  копии массива (отписка внутри обработчика безопасна); порядок «пересобрать панели → восстановить состояние →
  снять выбор» продуман; память по площадкам хранит даже точную камеру и тип вида.
- **Освобождение ресурсов.** `disposeTree` чистит геометрию, материалы, текстуры, `matOrig` чертежа и теневые карты;
  общие материалы защищены `sharedSet`; `renderLists.dispose()`. Есть e2e на 10 циклов.
- **Совместимость ссылок.** v2 с `vn`, v1 → `LEGACY_VENUE` с той же раскладкой; юнит-тест строит строку v1 так же,
  как старый кодировщик (сверено с `281b991:app/src/app/state.js`).
- **Шаблон «чёрный кабинет».** Чистая раскладка `layout.js` без Three.js, переиспользуется развесом и тестами;
  виды и размеры считаются из `cfg`; все допущения в `fest-chamber/config` помечены `assumption: true`.
- **Список сцен.** Нативный модальный `<dialog>` с `closedby="any"` и запасным вариантом для Safari, ↑/↓, фокус на
  текущей сцене; тест на 44 px.
- **Проверка без изменения поведения.** `scripts/parity.mjs` — сильный инструмент: DXF/GLB по SHA-256, состояние,
  старые ссылки, попиксельные снимки.
