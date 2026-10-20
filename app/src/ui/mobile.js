// Мобильная версия: полноэкранная сцена, выдвижная шторка снизу, крупные кнопки.
import './style.css';
import { Stage } from '../app/stage.js';
import { h, rigPanel, lightPanel, layersPanel, viewsPanel, infoCard, quickBar, toast } from './common.js';
import { exposeTestApi } from '../app/testapi.js';

export function startMobile() {
  document.body.classList.add('mobile');
  const viewport = h('div', { class: 'viewport' });
  const loading = h('div', { class: 'loading' }, 'Строим сцену…');
  document.body.append(viewport, loading);
  const stage = new Stage(viewport, 'mobile');
  loading.remove();

  // шторка
  const tabs = [
    ['rig', '⚙', 'Механика', () => rigPanel(stage, { compact: true })],
    ['light', '💡', 'Свет', () => lightPanel(stage, { compact: true })],
    ['views', '👁', 'Виды', () => viewsPanel(stage, { onPicked: () => setSheet('peek') })],
    ['layers', '🗂', 'Ещё', () => layersPanel(stage)],
  ];
  const content = h('div', { class: 'sheet-body' });
  const panes = {};
  let current = null;
  const sheet = h('section', { class: 'sheet', 'data-state': 'peek' });
  const setSheet = (state) => { sheet.dataset.state = state; document.body.dataset.sheet = state; stage.resize(); };
  const tabBtns = tabs.map(([id, ico, name, make]) => {
    panes[id] = make();
    panes[id].hidden = true;
    content.append(panes[id]);
    return h('button', { class: 'mtab', 'data-tab': id, onclick: () => {
      if (current === id && sheet.dataset.state === 'open') { setSheet('peek'); current = null; }
      else { current = id; setSheet('open'); }
      for (const b of tabBtns) b.classList.toggle('on', b.dataset.tab === current);
      for (const [k, p] of Object.entries(panes)) p.hidden = k !== current;
    } }, h('span', { class: 'ico' }, ico), h('span', {}, name));
  });
  const handle = h('button', { class: 'handle', 'aria-label': 'Свернуть/развернуть панель', onclick: () => setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open') });
  // жест «потянуть шторку»
  let sy = null;
  handle.addEventListener('pointerdown', (e) => { sy = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => {
    if (sy == null) return;
    const dy = e.clientY - sy; sy = null;
    if (dy > 30) setSheet('peek'); else if (dy < -30) setSheet('open');
  });
  sheet.append(handle, h('nav', { class: 'mtabs' }, tabBtns), content);

  const top = h('header', { class: 'mtop' },
    h('div', { class: 'brand' }, h('b', {}, 'ФЭСТ'), h('span', {}, ' Большая сцена')),
    quickBar(stage, { withLabels: false }),
  );
  const card = infoCard(stage);
  const hint = h('div', { class: 'mhint' }, 'Один палец — вращать · два — масштаб и сдвиг · тап — выбрать, потом тянуть');
  setTimeout(() => hint.classList.add('hide'), 6000);
  document.body.append(top, card, sheet, hint);
  setSheet('peek');

  stage.on('select', (sel) => {
    if (sel?.kind === 'rig') toast(`${stage.describe().title}: теперь можно тянуть пальцем`, 1800);
    if (sel) setSheet('peek');
  });
  exposeTestApi(stage);
  return stage;
}
