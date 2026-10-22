// Общие компоненты интерфейса (используются и в десктопной, и в мобильной версии).
// Всё, что относится к площадке (механика, группы приборов, слои, виды, экспорт), берётся
// из stage.venue: панели пересобираются при смене сцены (см. desktop.js / mobile.js).
import { RIG_KINDS, kindsPresent } from '../library/rigKinds.js';
import { THEATRE_NAME } from '../venues/registry.js';

export const fmt = (v, n = 2) => Number(v).toFixed(n).replace('.', ',');

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

/** Всплывающее сообщение; action = { label, fn } — кнопка в сообщении (например, «Отменить»). */
export function toast(text, ms = 2200, { action } = {}) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: `toast${action ? ' act' : ''}` }, text);
  if (action) t.append(h('button', { class: 'btn toast-btn', onclick: () => { action.fn(); t.remove(); } }, action.label));
  box.append(t);
  setTimeout(() => t.classList.add('hide'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** «Всё вверх / вниз / исходное» с возможностью отменить в течение 4 с. */
function allToWithUndo(stage, which) {
  const before = stage.rigging.snapshot();
  stage.allTo(which);
  const label = { up: 'Всё поднято', down: 'Всё опущено', rest: 'Исходные высоты' }[which];
  toast(label, 4000, { action: { label: '↺ Отменить', fn: () => { for (const [id, v] of Object.entries(before)) stage.setHeight(id, v); } } });
}

/** Панель механики: список спереди назад со слайдерами (только если на площадке есть механика). */
export function rigPanel(stage, { compact = false } = {}) {
  const RIGGING = stage.venue.rigging?.list || [];
  const rows = new Map();
  const list = h('div', { class: 'rig-list' });
  // поле высоты всегда показывает два знака (6,40 / 6,00) — как карточка и плашка при перетаскивании,
  // как бы ни поменялось значение: ползунком, стрелками поля, вводом с клавиатуры или из ссылки
  const num = (v) => fmt(v).replace(',', '.');
  for (const r of RIGGING) {
    const cur = stage.rigging.height(r.id);
    const val = h('input', { type: 'number', class: 'num', min: r.min, max: r.max, step: '0.05', value: num(cur), 'aria-label': `Высота ${r.name}, м` });
    const slider = h('input', { type: 'range', min: r.min, max: r.max, step: compact ? '0.05' : '0.01', value: cur, 'aria-label': `Высота ${r.name}` });
    const name = h('button', { class: `rig-name k-${r.kind}`, title: 'Выбрать и показать', onclick: () => stage.select({ kind: 'rig', id: r.id }) }, r.name);
    slider.addEventListener('input', () => stage.setHeight(r.id, +slider.value));
    val.addEventListener('change', () => {
      const v = +String(val.value).replace(',', '.');
      if (Number.isFinite(v)) stage.setHeight(r.id, v);
      val.value = num(stage.rigging.height(r.id)); // в т. ч. после стрелок поля и ввода «6,4»
    });
    val.addEventListener('blur', () => { val.value = num(stage.rigging.height(r.id)); });
    const row = h('div', { class: 'rig-row', 'data-id': r.id }, name, slider, h('span', { class: 'num-wrap' }, val, h('span', { class: 'unit' }, 'м')));
    rows.set(r.id, { row, slider, val });
    list.append(row);
  }
  const sync = (id, v) => {
    const r = rows.get(id);
    if (!r) return;
    r.slider.value = v;
    if (document.activeElement !== r.val) r.val.value = num(v);
  };
  stage.on('rig', sync);
  stage.on('state', () => { for (const r of RIGGING) sync(r.id, stage.rigging.height(r.id)); });
  stage.on('select', (sel) => {
    for (const [id, r] of rows) r.row.classList.toggle('sel', !!sel && sel.kind === 'rig' && sel.id === id);
    if (sel?.kind === 'rig') rows.get(sel.id)?.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const bar = h('div', { class: 'btn-row' },
    h('button', { class: 'btn', onclick: () => allToWithUndo(stage, 'up') }, '⤒ Всё вверх'),
    h('button', { class: 'btn', onclick: () => allToWithUndo(stage, 'down') }, '⤓ Всё вниз'),
    h('button', { class: 'btn', onclick: () => allToWithUndo(stage, 'rest') }, '↺ Исходное'),
  );
  const legend = h('div', { class: 'legend' },
    kindsPresent(RIGGING).map((k) => h('span', { class: `k-${k}` }, RIG_KINDS[k].short)),
  );
  return h('div', { class: 'panel-rig' }, bar, compact ? null : legend, h('div', { class: 'hint' }, 'Порядок — спереди назад. Высота трубы над планшетом.'), list);
}

/** Переключатель-«пилюля». */
export function toggle(label, get, set, { icon = '', id } = {}) {
  const b = h('button', { class: 'tgl', role: 'switch', 'data-id': id }, icon ? h('span', { class: 'ico' }, icon) : null, h('span', { class: 'lbl' }, label));
  const upd = () => { const v = get(); b.setAttribute('aria-checked', v === true ? 'true' : v === 'mixed' ? 'mixed' : 'false'); b.classList.toggle('on', v === true); b.classList.toggle('mixed', v === 'mixed'); };
  b.addEventListener('click', () => { set(!(get() === true)); upd(); });
  b._upd = upd;
  upd();
  return b;
}

/** Панель света. */
export function lightPanel(stage, { compact = false } = {}) {
  const V = stage.venue;
  const { groups: GROUPS, groupSets: GROUP_SETS, types: TYPES, portable: PORT } = V.fixtures;
  const toggles = [];
  const T = (...a) => { const t = toggle(...a); toggles.push(t); return t; };
  const master = h('div', { class: 'grid-2 master' },
    T('Сценический свет', () => { const s = stage.stageState(); return s === 'on' ? true : s === 'mixed' ? 'mixed' : false; }, (v) => stage.setAllStage(v), { icon: '🎭', id: 'stage' }),
    V.caps.duty ? T('Дежурный свет', () => stage.flags.duty, (v) => stage.setFlag('duty', v), { icon: '💡', id: 'duty' }) : null,
    V.caps.houseLight ? T('Свет в зале', () => stage.flags.house, (v) => stage.setFlag('house', v), { icon: '🏛', id: 'house' }) : null,
    T('Лучи (дымка)', () => stage.flags.haze, (v) => stage.setFlag('haze', v), { icon: '🌫', id: 'haze' }),
  );
  // плотность дымки: насколько видны лучи в воздухе
  const hazeVal = h('span', { class: 'unit' });
  const hazeSlider = h('input', { type: 'range', min: 0, max: 100, step: 5, 'aria-label': 'Плотность дымки, %' });
  const updHaze = () => {
    const v = Math.round((stage.flags.hazeDensity ?? 0.3) * 100);
    hazeSlider.value = v;
    hazeVal.textContent = `${v} %`;
    hazeRow.classList.toggle('dim', !stage.flags.haze);
  };
  hazeSlider.addEventListener('input', () => { if (!stage.flags.haze) stage.setFlag('haze', true); stage.setFlag('hazeDensity', +hazeSlider.value / 100); });
  const hazeRow = h('label', { class: 'haze-row' }, h('span', {}, '🌫 Плотность дымки'), hazeSlider, hazeVal);
  const groups = h('div', { class: `groups ${compact ? 'grid-2' : 'grid-1'}` },
    GROUP_SETS.map((s) => {
      const n = stage.fixtures.list.filter((f) => s.groups.includes(f.group)).length;
      const full = `${[...new Set(s.groups.map((g) => GROUPS[g]?.name).filter(Boolean))].join(', ')} — ${n} приб.`;
      const t = T(`${s.name} · ${n}`, () => { const st = stage.groupSetState(s.id); return st === 'on' ? true : st === 'mixed' ? 'mixed' : false; }, (v) => stage.setGroupSet(s.id, v), { id: `g-${s.id}` });
      t.title = `${full}. Нажмите — вкл/выкл группу`;
      // «Соло»: только эта группа, остальной сценический свет гаснет
      const solo = h('button', { class: 'solo', 'data-id': `solo-${s.id}`, title: `Только ${s.name}: остальной сценический свет выключить`, 'aria-label': `Соло: только ${s.name}`, onclick: () => { stage.soloGroupSet(s.id); toast(`Горит только: ${s.name}`); } }, 'соло');
      return h('div', { class: 'grp-cell' }, t, solo);
    }),
  );
  // переносные приборы (если есть на площадке): нет / на полу / на штативах, и сколько
  const portBtns = [];
  const PB = (label, isOn, act) => { const b = h('button', { class: 'btn', onclick: act }, label); b._isOn = isOn; portBtns.push(b); return b; };
  const P = () => stage.fixtures.portable;
  const portable = PORT ? h('div', {},
    h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Как стоят переносные приборы' },
      PB('Нет', () => P().mode === 'off', () => stage.setPortable('off')),
      PB('На полу', () => P().mode === 'floor', () => stage.setPortable('floor')),
      PB('На штативах', () => P().mode === 'stand', () => stage.setPortable('stand')),
    ),
    h('div', { class: 'btn-row', role: 'group', 'aria-label': 'Сколько переносных приборов' },
      PORT.counts.map((n) => PB(`${n} шт.`, () => P().count === n, () => stage.setPortable(P().mode === 'off' ? 'floor' : P().mode, n))),
    ),
  ) : null;
  const updPortable = () => { for (const b of portBtns) { const on = b._isOn(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
  // поиск прибора
  const searchRow = fixtureSearch(stage);
  // приборы по группам (фишки)
  const chips = new Map();
  const groupDetails = new Map();
  const details = Object.entries(GROUPS).map(([gid, g]) => {
    const fl = stage.fixtures.list.filter((f) => f.group === gid);
    if (!fl.length) return null;
    const wrap = h('div', { class: 'chips' }, fl.map((f) => {
      const c = h('button', { class: 'chip', title: compact ? `${TYPES[f.type].name} — тап: выбрать; долгое нажатие: вкл/выкл` : `${TYPES[f.type].name} — нажмите, чтобы выбрать; двойной щелчок — вкл/выкл` }, String(f.no));
      if (compact) {
        // телефон: тап — выбрать (шторка остаётся открытой), долгое нажатие — вкл/выкл
        let timer = null, long = false;
        c.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; stage.setFixture(f.idx, !f.on); navigator.vibrate?.(15); toast(`№ ${f.no} ${f.on ? 'включён' : 'выключен'}`, 1200); }, 500); });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) c.addEventListener(ev, () => clearTimeout(timer));
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        c.addEventListener('click', () => { if (long) return; stage.select({ kind: 'fixture', idx: f.idx, keepSheet: true }); toast(`№ ${f.no} выбран · долгое нажатие — вкл/выкл`, 1600); });
      } else {
        c.addEventListener('click', () => stage.select({ kind: 'fixture', idx: f.idx }));
        c.addEventListener('dblclick', () => stage.setFixture(f.idx, !f.on));
      }
      chips.set(f.idx, c);
      return c;
    }));
    const d = h('details', { class: 'grp' }, h('summary', {}, `${g.name}`, h('small', {}, ` ${fl.length} шт.${g.ds ? ` · ${g.ds}` : ''}`)), wrap);
    groupDetails.set(gid, d);
    return d;
  });
  const updChips = () => { for (const [i, c] of chips) { const f = stage.fixtures.list[i]; c.hidden = !!f.hidden; c.classList.toggle('off', !f.on); c.classList.toggle('sel', !!f.selected); c.classList.toggle('unk', !!TYPES[f.type].unknown); } };
  const updAll = () => { toggles.forEach((t) => t._upd()); updChips(); updPortable(); updHaze(); };
  stage.on('lights', updAll);
  stage.on('flags', updAll);
  stage.on('state', updAll);
  stage.on('portable', updAll);
  stage.on('select', (sel) => {
    updChips();
    // выбранный прибор показываем в его группе: раскрываем и прокручиваем к нему
    if (sel?.kind !== 'fixture') return;
    const f = stage.fixtures.list[sel.idx];
    const d = groupDetails.get(f.group);
    if (d) d.open = true;
    chips.get(f.idx)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  updChips();
  updPortable();
  updHaze();
  const anyUnknown = stage.fixtures.list.some((f) => TYPES[f.type].unknown);
  return h('div', { class: 'panel-light' },
    h('h4', {}, 'Найти прибор'), searchRow,
    h('h4', {}, 'Свет'), master, hazeRow,
    h('h4', {}, 'Группы приборов'), groups,
    h('div', { class: 'hint' }, compact ? 'Кнопка группы — вкл/выкл, «соло» — горит только она.' : 'Кнопка группы — вкл/выкл; «соло» — горит только эта группа, остальной сценический свет гаснет.'),
    PORT ? [h('h4', {}, PORT.title || 'Переносные приборы'), portable] : null,
    h('h4', {}, 'Приборы по группам'),
    compact ? h('div', { class: 'hint' }, 'Тап по номеру — выбрать, долгое нажатие — вкл/выкл.') : h('div', { class: 'hint' }, `Щелчок по номеру — выбрать, двойной — вкл/выкл.${anyUnknown ? ' Фиолетовые — тип не указан в легенде.' : ''}`),
    details,
  );
}

/** Поиск прибора по номеру: поле + кнопка (в панели «Свет» и в верхней панели десктопа). */
export function fixtureSearch(stage, { compact = false } = {}) {
  const search = h('input', { type: 'search', class: 'search', placeholder: compact ? '№ прибора' : 'Найти прибор №…', inputmode: 'numeric', enterkeyhint: 'search', 'aria-label': 'Найти прибор по номеру' });
  const doFind = () => {
    const q = search.value.trim();
    if (!q) { search.focus(); return; }
    const f = stage.fixtures.byNo.get(q) || stage.fixtures.byNo.get(q.toUpperCase());
    if (!f) { toast(`Прибор № ${q} не найден`); return; }
    if (f.hidden) { toast(`№ ${f.no} — переносной прибор, сейчас не показан. Включите его в разделе «${stage.venue.fixtures.portable?.short || 'Переносные приборы'}»`, 3500); return; }
    search.blur();
    stage.select({ kind: 'fixture', idx: f.idx });
    stage.focusFixture?.(f.idx);
  };
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFind(); });
  // телефон: экранная клавиатура не должна закрывать поле и кнопку
  search.addEventListener('focus', () => setTimeout(() => search.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
  const findBtn = h('button', { class: 'btn', onclick: doFind }, compact ? '🔍' : 'Найти');
  if (compact) findBtn.setAttribute('aria-label', 'Найти');
  return h('div', { class: 'search-row' }, search, findBtn);
}

/** Слои (по площадке) и инструменты. */
export function layersPanel(stage) {
  const L = stage.venue.layers;
  const ts = [];
  const T = (...a) => { const t = toggle(...a); ts.push(t); return t; };
  const layers = h('div', { class: 'grid-1' }, L.map(([k, n]) => T(n, () => stage.layers[k], (v) => stage.setLayer(k, v), { id: `l-${k}` })));
  const tools = h('div', { class: 'grid-1' },
    stage.venue.caps.rigging ? T('Подписи механики', () => stage.flags.labels, (v) => stage.setFlag('labels', v), { icon: '🏷' }) : null,
    T('Номера приборов', () => stage.flags.fixtureLabels, (v) => stage.setFlag('fixtureLabels', v), { icon: '#' }),
    T('Размеры', () => stage.flags.dims, (v) => stage.setFlag('dims', v), { icon: '📏' }),
    T('Сетка 1 м и ось сцены', () => stage.flags.grid, (v) => stage.setFlag('grid', v), { icon: '▦' }),
    T('Рулетка (2 щелчка)', () => stage.measure.active, (v) => { stage.setMeasure(v); if (v) toast('Рулетка: щёлкните две точки'); }, { icon: '📐', id: 'measure' }),
    T('Режим «чертёж»', () => stage.flags.blueprint, (v) => stage.setFlag('blueprint', v), { icon: '📄', id: 'blueprint' }),
  );
  const upd = () => ts.forEach((t) => t._upd());
  stage.on('flags', upd); stage.on('layers', upd); stage.on('state', upd); stage.on('measure', upd);
  return h('div', { class: 'panel-layers' }, h('h4', {}, 'Слои'), layers, h('h4', {}, 'Инструменты'), tools);
}

/** Кнопки экспорта чертежей (.dxf) и 3D-модели (.glb) — те, что есть у площадки (на телефоне — только 2D). */
export function exportButtons(stage, { onAction, role } = {}) {
  const isMobile = stage.profile?.name === 'mobile';
  const items = [
    {
      id: 'plan-dxf',
      label: '📐 План сцены (2D .dxf)',
      title: 'Экспорт 2D-плана сцены, зала и развеса света в AutoCAD DXF',
      fmt: 'planDXF',
      run: () => { stage.exportPlanDXF(); toast('Чертёж «План сцены» (.dxf) сохранён'); },
    },
    {
      id: 'section-dxf',
      label: '📏 Продольный разрез (2D .dxf)',
      title: 'Экспорт 2D продольного разреза с текущими высотами механики в AutoCAD DXF',
      fmt: 'sectionDXF',
      run: () => { stage.exportSectionDXF(); toast('Чертёж «Продольный разрез» (.dxf) сохранён'); },
    },
  ];
  if (!isMobile) {
    items.push(
      {
        id: '3d-dxf',
        label: '🧊 Вся сцена в 3D (.dxf)',
        title: 'Экспорт полной трёхмерной модели сцены в 3D AutoCAD DXF (WCS)',
        fmt: 'dxf3d',
        run: () => { stage.export3DDXF(); toast('3D-чертёж сцены (.dxf) сохранён'); },
      },
      {
        id: '3d-glb',
        label: '📦 3D-модель (.glb)',
        title: 'Экспорт полигональной 3D-модели сцены в Binary glTF 2.0 (.glb)',
        fmt: 'glb',
        run: async () => {
          toast('Подготовка 3D-модели (.glb)…', 1400);
          await stage.exportGLB();
          toast('3D-модель (.glb) сохранена');
        },
      },
    );
  }
  const can = stage.exportFormats();
  return items.filter((it) => can[it.fmt]).map((it) => h(
    'button',
    {
      class: 'btn export-item',
      'data-export': it.id,
      title: it.title,
      role,
      onclick: async () => {
        onAction?.(it.id);
        await it.run();
      },
    },
    it.label,
  ));
}

/** Виды и сохранение. */
export function viewsPanel(stage, { onPicked } = {}) {
  const btns = new Map();
  const grid = h('div', { class: 'grid-2' }, Object.entries(stage.views).map(([k, v]) => {
    const b = h('button', { class: `btn view${k === stage.view ? ' on' : ''}`, onclick: () => { stage.setView(k); onPicked?.(k); } }, v.name);
    btns.set(k, b);
    return b;
  }));
  stage.on('view', (k) => { for (const [kk, b] of btns) b.classList.toggle('on', kk === k); });
  const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try { (await stage.openState(JSON.parse(await f.text()))) ? toast('Состояние загружено') : toast('Не удалось прочитать файл'); } catch { toast('Не удалось прочитать файл'); }
    file.value = '';
  });
  return h('div', { class: 'panel-views' },
    h('h4', {}, 'Точки обзора'), grid,
    h('h4', {}, 'Экспорт в CAD / 3D'),
    h('div', { class: 'grid-1 export-panel' }, exportButtons(stage)),
    h('h4', {}, 'Сохранить / поделиться'),
    h('div', { class: 'grid-1' },
      h('button', { class: 'btn', onclick: () => shareLink(stage) }, '🔗 Скопировать ссылку с текущим состоянием'),
      h('button', { class: 'btn', onclick: () => stage.downloadState() }, '💾 Сохранить состояние в файл'),
      h('button', { class: 'btn', onclick: () => file.click() }, '📂 Загрузить состояние из файла'),
      h('button', { class: 'btn', onclick: () => { stage.screenshot(); toast('Скриншот сохранён в «Загрузки»'); } }, '📷 Скриншот в PNG'),
    ),
    file,
  );
}

export async function shareLink(stage) {
  const url = stage.shareUrl();
  history.replaceState(null, '', url);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: ` — ${stage.venue.name}`, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('Ссылка скопирована');
  } catch {
    prompt('Скопируйте ссылку:', url);
  }
}

/** Карточка выбранного объекта. */
export function infoCard(stage, { onClose } = {}) {
  const card = h('div', { class: 'card', hidden: true, role: 'dialog', 'aria-label': 'Выбранный объект' });
  let slider = null, val = null, cur = null;
  const render = () => {
    const d = stage.describe();
    card.hidden = !d;
    card.innerHTML = '';
    cur = d;
    if (!d) return;
    const close = h('button', { class: 'x', 'aria-label': 'Закрыть', onclick: () => { stage.select(null); onClose?.(); } }, '×');
    card.append(h('div', { class: 'card-head' }, h('b', {}, d.title), close));
    if (d.kind === 'rig') {
      slider = h('input', { type: 'range', min: d.min, max: d.max, step: '0.01', value: d.value, 'aria-label': 'Высота' });
      val = h('output', { class: 'big' }, `${fmt(d.value)} м`);
      slider.addEventListener('input', () => stage.setHeight(d.id, +slider.value));
      card.append(h('div', { class: 'card-slider' }, slider, val));
      card.append(h('div', { class: 'btn-row card-btns' },
        h('button', { class: 'btn', title: 'Поднять до верха', onclick: () => stage.setHeight(d.id, d.max) }, `⤒ ${fmt(d.max, 1)}`),
        h('button', { class: 'btn', title: 'Выше на 10 см', onclick: () => stage.setHeight(d.id, stage.rigging.height(d.id) + 0.1) }, '+0,1'),
        h('button', { class: 'btn', title: 'Исходная высота', 'aria-label': 'Исходная высота', onclick: () => stage.setHeight(d.id, stage.rigging.get(d.id).cfg.rest) }, '↺'),
        h('button', { class: 'btn', title: 'Ниже на 10 см', onclick: () => stage.setHeight(d.id, stage.rigging.height(d.id) - 0.1) }, '−0,1'),
        h('button', { class: 'btn', title: 'Опустить до низа', onclick: () => stage.setHeight(d.id, d.min) }, `⤓ ${fmt(d.min, 1)}`),
      ));
    } else {
      const t = toggle('Включён', () => stage.fixtures.list[d.idx].on, (v) => stage.setFixture(d.idx, v), { icon: '💡' });
      card.append(t);
    }
    card.append(h('dl', {}, d.rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])));
  };
  stage.on('select', render);
  stage.on('rig', (id, v) => {
    if (cur && cur.kind === 'rig' && cur.id === id && slider) { slider.value = v; val.textContent = `${fmt(v)} м`; const dd = card.querySelectorAll('dd')[1]; if (dd) dd.textContent = `${fmt(v)} м`; }
    else if (cur && cur.kind === 'fixture') render();
  });
  stage.on('lights', () => { if (cur && cur.kind === 'fixture') render(); });
  return card;
}

/** Быстрые кнопки (верхняя панель); дежурный и зальный свет — если они есть на площадке. */
export function quickBar(stage, { withLabels = true } = {}) {
  const caps = stage.venue.caps;
  const ts = [];
  const T = (label, icon, get, set, id) => { const t = toggle(withLabels ? label : '', get, set, { icon, id }); t.title = label; t.setAttribute('aria-label', label); ts.push(t); return t; };
  const bar = h('div', { class: 'quick' },
    caps.duty ? T('Дежурка', '💡', () => stage.flags.duty, (v) => stage.setFlag('duty', v), 'q-duty') : null,
    T('Сцена', '🎭', () => { const s = stage.stageState(); return s === 'on' ? true : s === 'mixed' ? 'mixed' : false; }, (v) => stage.setAllStage(v), 'q-stage'),
    caps.houseLight ? T('Зал', '🏛', () => stage.flags.house, (v) => stage.setFlag('house', v), 'q-house') : null,
    T('Дымка', '🌫', () => stage.flags.haze, (v) => stage.setFlag('haze', v), 'q-haze'),
    T('Чертёж', '📄', () => stage.flags.blueprint, (v) => stage.setFlag('blueprint', v), 'q-bp'),
  );
  const upd = () => ts.forEach((t) => t._upd());
  stage.on('flags', upd); stage.on('lights', upd); stage.on('state', upd);
  return bar;
}

/** Плашка с высотой рядом с курсором/пальцем, пока штанкет тянут в 3D. */
export function dragBadge(stage) {
  const b = h('div', { class: 'drag-badge', hidden: true, 'aria-hidden': 'true' });
  stage.on('drag', ({ id, h: v, x, y, touch }) => {
    b.hidden = false;
    b.textContent = `${stage.rigging.get(id).cfg.name}: ${fmt(v)} м`;
    // над пальцем (чтобы не закрывал) или справа от курсора
    b.style.left = `${touch ? x : x + 18}px`;
    b.style.top = `${touch ? y - 70 : y - 14}px`;
    b.classList.toggle('touch', !!touch);
  });
  stage.on('dragend', () => { b.hidden = true; });
  return b;
}
