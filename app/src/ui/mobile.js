// Мобильная версия: полноэкранная сцена, выдвижная шторка снизу, крупные кнопки.
// Оболочка (шапка, шторка, карточка) живёт всё время; вкладки площадки пересобираются при смене сцены.
import './style.css';
import { Stage } from '../engine/stage.js';
import { h, rigPanel, lightPanel, layoutPanel, layersPanel, viewsPanel, infoCard, quickBar, toast, shareLink, dragBadge, exportButtons } from './common.js';
import { venueBrand } from './venuePicker.js';
import { THEATRE_NAME } from '../venues/registry.js';
import { exposeTestApi } from '../engine/testapi.js';

export async function startMobile() {
  document.body.classList.add('mobile');
  const viewport = h('div', { class: 'viewport' });
  const loading = h('div', { class: 'loading' }, 'Строим сцену…');
  document.body.append(viewport, loading);
  const stage = new Stage(viewport, 'mobile');

  // шторка
  const content = h('div', { class: 'sheet-body' });
  const nav = h('nav', { class: 'mtabs' });
  let panes = {};
  let tabBtns = [];
  let current = null;
  const sheet = h('section', { class: 'sheet', 'data-state': 'peek' });
  const setSheet = (state) => { sheet.dataset.state = state; document.body.dataset.sheet = state; stage.resize(); };
  const showTab = () => {
    for (const b of tabBtns) b.classList.toggle('on', b.dataset.tab === current);
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== current;
  };
  const handle = h('button', { class: 'handle', 'aria-label': 'Свернуть/развернуть панель', onclick: () => setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open') });
  // жест «потянуть шторку»
  let sy = null;
  handle.addEventListener('pointerdown', (e) => { sy = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => {
    if (sy == null) return;
    const dy = e.clientY - sy; sy = null;
    if (dy > 30) setSheet('peek'); else if (dy < -30) setSheet('open');
  });
  sheet.append(handle, nav, content);

  // «Поделиться»: PNG, ссылка и 2D-чертежи DXF (если они есть у площадки)
  const exportSlot = h('div', { class: 'quick-slot' });
  const shareMenu = h('div', { class: 'share-menu', hidden: true, role: 'menu' },
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { setShare(false); shareLink(stage); } }, '🔗 Ссылка на это состояние'),
    h('button', { class: 'btn', role: 'menuitem', onclick: () => { setShare(false); stage.screenshot(); toast('Скриншот сохранён'); } }, '📷 Скриншот в PNG'),
    exportSlot,
  );
  // прозрачная подложка: тап мимо меню только закрывает его и не нажимает кнопки под ним
  const shareBackdrop = h('div', { class: 'share-backdrop', hidden: true, onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); setShare(false); } });
  // при открытии меню убираем тосты: они на той же высоте и закрыли бы верхний пункт меню
  const setShare = (on) => { shareMenu.hidden = !on; shareBackdrop.hidden = !on; if (on) document.querySelectorAll('.toast').forEach((t) => t.remove()); };
  const shareBtn = h('button', { class: 'tgl share-btn', 'aria-label': 'Поделиться: ссылка или скриншот', title: 'Поделиться', onclick: () => setShare(shareMenu.hidden) }, h('span', { class: 'ico' }, '📤'));

  const quickSlot = h('div', { class: 'quick-slot' });
  const top = h('header', { class: 'mtop' },
    venueBrand(stage, { compact: true, onBefore: () => setShare(false) }),
    h('div', { class: 'mtop-right' }, quickSlot, shareBtn),
  );
  const card = infoCard(stage);
  const hint = h('div', { class: 'mhint' });
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

  // --- вкладки площадки (пересобираются при смене сцены)
  let unmount = null;
  const mountVenue = () => {
    unmount?.();
    sheet.inert = false;
    quickSlot.inert = false;
    unmount = stage.scope(() => {
      const caps = stage.venue.caps;
      const tabs = [
        caps.rigging ? ['rig', '⚙', 'Механика', () => rigPanel(stage, { compact: true })] : null,
        ['light', '💡', 'Свет', () => lightPanel(stage, { compact: true })],
        caps.layouts ? ['hall', '🪑', 'Зал', () => layoutPanel(stage, { compact: true })] : null,
        ['views', '👁', 'Виды', () => viewsPanel(stage, { onPicked: () => setSheet('peek') })],
        ['layers', '🗂', 'Ещё', () => layersPanel(stage)],
      ].filter(Boolean);
      if (current && !tabs.some(([id]) => id === current)) { current = null; if (sheet.dataset.state === 'open') setSheet('peek'); }
      content.replaceChildren();
      panes = {};
      tabBtns = tabs.map(([id, ico, name, make]) => {
        panes[id] = make();
        content.append(panes[id]);
        return h('button', { class: 'mtab', 'data-tab': id, onclick: () => {
          if (current === id && sheet.dataset.state === 'open') { setSheet('peek'); current = null; }
          else { current = id; setSheet('open'); }
          showTab();
        } }, h('span', { class: 'ico' }, ico), h('span', {}, name));
      });
      nav.replaceChildren(...tabBtns);
      showTab();
      quickSlot.replaceChildren(quickBar(stage, { withLabels: false }));
      exportSlot.replaceChildren(...exportButtons(stage, { onAction: () => setShare(false), role: 'menuitem' }));
      hint.textContent = caps.rigging
        ? 'Один палец — вращать · два — масштаб и сдвиг · тап — выбрать, потом тянуть'
        : 'Один палец — вращать · два — масштаб и сдвиг · тап — выбрать прибор';
      document.title = `${stage.venue.name} · ${THEATRE_NAME} (телефон)`;
    });
  };
  stage.on('venue', mountVenue);
  // панели прежней площадки отписываются до её разбора: события новой площадки
  // (select/state/lights) не должны доходить до панелей со старым списком приборов
  // панели прежней площадки отписываются до её разбора и на время сборки не нажимаются
  stage.on('venueloading', () => { unmount?.(); unmount = null; sheet.inert = true; quickSlot.inert = true; });

  const { notice } = await stage.boot();
  loading.remove();
  stage.resize();
  if (notice) toast(notice, 4000);
  exposeTestApi(stage);
  return stage;
}
