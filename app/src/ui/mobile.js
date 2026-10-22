// Мобильная версия: полноэкранная сцена, выдвижная шторка снизу, крупные кнопки.
import './style.css';
import { Stage } from '../app/stage.js';
import { h, rigPanel, lightPanel, layersPanel, viewsPanel, infoCard, quickBar, toast, shareLink, dragBadge, exportButtons } from './common.js';
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

  // «Поделиться»: PNG, ссылка и 2D-чертежи DXF (План сцены и Продольный разрез)
  const shareMenu = h('div', { class: 'share-menu', hidden: true, role: 'menu' },
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { setShare(false); shareLink(stage); } }, '🔗 Ссылка на это состояние'),
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { setShare(false); stage.screenshot(); toast('Скриншот сохранён'); } }, '📷 Скриншот в PNG'),
    exportButtons(stage, { onAction: () => setShare(false), role: 'menuitem' }),
  );
  // прозрачная подложка: тап мимо меню только закрывает его и не нажимает кнопки под ним
  const shareBackdrop = h('div', { class: 'share-backdrop', hidden: true, onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); setShare(false); } });
  const setShare = (on) => { shareMenu.hidden = !on; shareBackdrop.hidden = !on; };
  const shareBtn = h('button', { class: 'tgl share-btn', 'aria-label': 'Поделиться: ссылка или скриншот', title: 'Поделиться', onclick: () => setShare(shareMenu.hidden) }, h('span', { class: 'ico' }, '📤'));

  const top = h('header', { class: 'mtop' },
    h('div', { class: 'brand' }, h('b', {}, 'ФЭСТ'), h('span', {}, ' Большая сцена')),
    h('div', { class: 'mtop-right' }, quickBar(stage, { withLabels: false }), shareBtn),
  );
  const card = infoCard(stage);
  const hint = h('div', { class: 'mhint' }, 'Один палец — вращать · два — масштаб и сдвиг · тап — выбрать, потом тянуть');
  // подсказка уходит при первом касании или через 3 с
  const hideHint = () => hint.classList.add('hide');
  setTimeout(hideHint, 3000);
  window.addEventListener('pointerdown', hideHint, { once: true });
  document.body.append(top, shareBackdrop, shareMenu, card, sheet, hint, dragBadge(stage));
  setSheet('peek');

  stage.on('select', (sel, req) => {
    if (sel?.kind === 'rig') toast(`${stage.describe().title}: теперь можно тянуть пальцем`, 1800);
    // выбор из панели «Свет» (фишки приборов) шторку не сворачивает
    if (sel && !req?.keepSheet) setSheet('peek');
  });
  exposeTestApi(stage);
  return stage;
}
