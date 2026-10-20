// Общие компоненты интерфейса (используются и в десктопной, и в мобильной версии).
import { RIGGING } from '../config/rigging.js';
import { GROUP_SETS, GROUPS, TYPES } from '../config/fixtures.js';
import { VIEWS } from '../app/stage.js';

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

export function toast(text, ms = 2200) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, text);
  box.append(t);
  setTimeout(() => t.classList.add('hide'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

const KIND = { batten: 'Ш', light: 'С', track: 'З', side: 'Б' };

/** Панель механики: список спереди назад со слайдерами. */
export function rigPanel(stage, { compact = false } = {}) {
  const rows = new Map();
  const list = h('div', { class: 'rig-list' });
  for (const r of RIGGING) {
    const val = h('input', { type: 'number', class: 'num', min: r.min, max: r.max, step: '0.05', value: r.rest, 'aria-label': `Высота ${r.name}, м` });
    const slider = h('input', { type: 'range', min: r.min, max: r.max, step: '0.01', value: r.rest, 'aria-label': `Высота ${r.name}` });
    const name = h('button', { class: `rig-name k-${r.kind}`, title: 'Выбрать и показать', onclick: () => stage.select({ kind: 'rig', id: r.id }) }, r.name);
    slider.addEventListener('input', () => stage.setHeight(r.id, +slider.value));
    val.addEventListener('change', () => stage.setHeight(r.id, +String(val.value).replace(',', '.')));
    const row = h('div', { class: 'rig-row', 'data-id': r.id }, name, slider, h('span', { class: 'num-wrap' }, val, h('span', { class: 'unit' }, 'м')));
    rows.set(r.id, { row, slider, val });
    list.append(row);
  }
  const sync = (id, v) => {
    const r = rows.get(id);
    if (!r) return;
    r.slider.value = v;
    if (document.activeElement !== r.val) r.val.value = fmt(v).replace(',', '.');
  };
  stage.on('rig', sync);
  stage.on('state', () => { for (const r of RIGGING) sync(r.id, stage.rigging.height(r.id)); });
  stage.on('select', (sel) => {
    for (const [id, r] of rows) r.row.classList.toggle('sel', !!sel && sel.kind === 'rig' && sel.id === id);
    if (sel?.kind === 'rig') rows.get(sel.id)?.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const bar = h('div', { class: 'btn-row' },
    h('button', { class: 'btn', onclick: () => stage.allTo('up') }, '⤒ Всё вверх'),
    h('button', { class: 'btn', onclick: () => stage.allTo('down') }, '⤓ Всё вниз'),
    h('button', { class: 'btn', onclick: () => stage.allTo('rest') }, '↺ Исходное'),
  );
  const legend = h('div', { class: 'legend' },
    h('span', { class: 'k-batten' }, 'Ш — штанкет'), h('span', { class: 'k-light' }, 'С — софит'),
    h('span', { class: 'k-track' }, 'З — дорога занавеса'), h('span', { class: 'k-side' }, 'Б — боковой'),
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
  const toggles = [];
  const T = (...a) => { const t = toggle(...a); toggles.push(t); return t; };
  const master = h('div', { class: 'grid-2' },
    T('Сценический свет', () => { const s = stage.stageState(); return s === 'on' ? true : s === 'mixed' ? 'mixed' : false; }, (v) => stage.setAllStage(v), { icon: '🎭', id: 'stage' }),
    T('Дежурный свет', () => stage.flags.duty, (v) => stage.setFlag('duty', v), { icon: '💡', id: 'duty' }),
    T('Свет в зале', () => stage.flags.house, (v) => stage.setFlag('house', v), { icon: '🏛', id: 'house' }),
    T('Лучи (дымка)', () => stage.flags.haze, (v) => stage.setFlag('haze', v), { icon: '🌫', id: 'haze' }),
  );
  const groups = h('div', { class: 'grid-3' },
    GROUP_SETS.map((s) => {
      const n = stage.fixtures.list.filter((f) => s.groups.includes(f.group)).length;
      return T(`${s.name} · ${n}`, () => { const st = stage.groupSetState(s.id); return st === 'on' ? true : st === 'mixed' ? 'mixed' : false; }, (v) => stage.setGroupSet(s.id, v), { id: `g-${s.id}` });
    }),
  );
  // поиск прибора
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Найти прибор №…', inputmode: 'numeric', 'aria-label': 'Найти прибор по номеру' });
  const doFind = () => {
    const q = search.value.trim();
    const f = stage.fixtures.byNo.get(q) || stage.fixtures.byNo.get(q.toUpperCase());
    if (!f) { toast(`Прибор № ${q} не найден`); return; }
    stage.select({ kind: 'fixture', idx: f.idx });
    stage.focusFixture?.(f.idx);
  };
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFind(); });
  const findBtn = h('button', { class: 'btn', onclick: doFind }, 'Найти');
  // приборы по группам (фишки)
  const chips = new Map();
  const details = Object.entries(GROUPS).map(([gid, g]) => {
    const fl = stage.fixtures.list.filter((f) => f.group === gid);
    const wrap = h('div', { class: 'chips' }, fl.map((f) => {
      const c = h('button', { class: 'chip', title: `${TYPES[f.type].name} — нажмите, чтобы выбрать; двойной щелчок — вкл/выкл` }, String(f.no));
      c.addEventListener('click', () => stage.select({ kind: 'fixture', idx: f.idx }));
      c.addEventListener('dblclick', () => stage.setFixture(f.idx, !f.on));
      chips.set(f.idx, c);
      return c;
    }));
    return h('details', { class: 'grp' }, h('summary', {}, `${g.name}`, h('small', {}, ` ${fl.length} шт. · ${g.ds}`)), wrap);
  });
  const updChips = () => { for (const [i, c] of chips) { const f = stage.fixtures.list[i]; c.classList.toggle('off', !f.on); c.classList.toggle('sel', !!f.selected); c.classList.toggle('unk', !!TYPES[f.type].unknown); } };
  const updAll = () => { toggles.forEach((t) => t._upd()); updChips(); };
  stage.on('lights', updAll);
  stage.on('flags', updAll);
  stage.on('state', updAll);
  stage.on('select', updChips);
  updChips();
  return h('div', { class: 'panel-light' },
    h('h4', {}, 'Свет'), master,
    h('h4', {}, 'Группы приборов'), groups,
    h('h4', {}, 'Приборы'), h('div', { class: 'search-row' }, search, findBtn),
    compact ? h('div', { class: 'hint' }, 'Тап по номеру — выбрать прибор.') : h('div', { class: 'hint' }, 'Щелчок по номеру — выбрать, двойной — вкл/выкл. Фиолетовые — тип не указан в легенде.'),
    details,
  );
}

/** Слои и инструменты. */
export function layersPanel(stage) {
  const L = [['hall', 'Зрительный зал'], ['walls', 'Стены и потолок коробки'], ['galleries', 'Галереи'], ['rigging', 'Механика'], ['lights', 'Свет (приборы)']];
  const ts = [];
  const T = (...a) => { const t = toggle(...a); ts.push(t); return t; };
  const layers = h('div', { class: 'grid-1' }, L.map(([k, n]) => T(n, () => stage.layers[k], (v) => stage.setLayer(k, v), { id: `l-${k}` })));
  const tools = h('div', { class: 'grid-1' },
    T('Подписи механики', () => stage.flags.labels, (v) => stage.setFlag('labels', v), { icon: '🏷' }),
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

/** Виды и сохранение. */
export function viewsPanel(stage, { onPicked } = {}) {
  const btns = new Map();
  const grid = h('div', { class: 'grid-2' }, Object.entries(VIEWS).map(([k, v]) => {
    const b = h('button', { class: 'btn view', onclick: () => { stage.setView(k); onPicked?.(k); } }, v.name);
    btns.set(k, b);
    return b;
  }));
  stage.on('view', (k) => { for (const [kk, b] of btns) b.classList.toggle('on', kk === k); });
  const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try { stage.loadState(JSON.parse(await f.text())) ? toast('Состояние загружено') : toast('Не удалось прочитать файл'); } catch { toast('Не удалось прочитать файл'); }
    file.value = '';
  });
  return h('div', { class: 'panel-views' },
    h('h4', {}, 'Точки обзора'), grid,
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
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'ФЭСТ — Большая сцена', url }); return; }
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
      card.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => stage.setHeight(d.id, d.max) }, `⤒ ${fmt(d.max, 1)}`),
        h('button', { class: 'btn', onclick: () => stage.setHeight(d.id, stage.rigging.get(d.id).cfg.rest) }, '↺'),
        h('button', { class: 'btn', onclick: () => stage.setHeight(d.id, d.min) }, `⤓ ${fmt(d.min, 1)}`),
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

/** Быстрые кнопки (верхняя панель). */
export function quickBar(stage, { withLabels = true } = {}) {
  const ts = [];
  const T = (label, icon, get, set, id) => { const t = toggle(withLabels ? label : '', get, set, { icon, id }); t.title = label; t.setAttribute('aria-label', label); ts.push(t); return t; };
  const bar = h('div', { class: 'quick' },
    T('Дежурка', '💡', () => stage.flags.duty, (v) => stage.setFlag('duty', v), 'q-duty'),
    T('Сцена', '🎭', () => { const s = stage.stageState(); return s === 'on' ? true : s === 'mixed' ? 'mixed' : false; }, (v) => stage.setAllStage(v), 'q-stage'),
    T('Зал', '🏛', () => stage.flags.house, (v) => stage.setFlag('house', v), 'q-house'),
    T('Дымка', '🌫', () => stage.flags.haze, (v) => stage.setFlag('haze', v), 'q-haze'),
    T('Чертёж', '📄', () => stage.flags.blueprint, (v) => stage.setFlag('blueprint', v), 'q-bp'),
  );
  const upd = () => ts.forEach((t) => t._upd());
  stage.on('flags', upd); stage.on('lights', upd); stage.on('state', upd);
  return bar;
}
