// Десктопная версия: панель слева с вкладками, карточка справа, быстрые кнопки сверху.
import './style.css';
import { Stage, VIEWS } from '../app/stage.js';
import { h, rigPanel, lightPanel, layersPanel, viewsPanel, infoCard, quickBar, shareLink, toast, fixtureSearch, dragBadge, exportButtons } from './common.js';
import { exposeTestApi } from '../app/testapi.js';

export function startDesktop() {
  document.body.classList.add('desktop');
  const viewport = h('div', { class: 'viewport' });
  const loading = h('div', { class: 'loading' }, 'Строим сцену…');
  document.body.append(viewport, loading);
  const stage = new Stage(viewport, 'desktop');
  loading.remove();

  const tabs = [
    ['rig', '⚙', 'Механика', () => rigPanel(stage)],
    ['light', '💡', 'Свет', () => lightPanel(stage)],
    ['layers', '🗂', 'Слои', () => layersPanel(stage)],
    ['views', '👁', 'Виды', () => viewsPanel(stage)],
  ];
  const body = h('div', { class: 'side-body' });
  const panes = {};
  const openTab = (id, focus = false) => {
    for (const b of tabBtns) {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== id;
  };
  const tabBtns = tabs.map(([id, ico, name, make]) => {
    panes[id] = make();
    panes[id].hidden = id !== 'rig';
    panes[id].setAttribute('role', 'tabpanel');
    body.append(panes[id]);
    return h('button', { class: `tab${id === 'rig' ? ' on' : ''}`, role: 'tab', 'aria-selected': String(id === 'rig'), tabindex: id === 'rig' ? 0 : -1, 'data-tab': id, onclick: () => openTab(id) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), ' ', name);
  });
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Разделы панели' }, tabBtns);
  // стрелки влево/вправо листают вкладки (как принято для role=tablist)
  tablist.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = tabBtns.findIndex((b) => b.classList.contains('on'));
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabBtns.length) % tabBtns.length;
    openTab(tabBtns[n].dataset.tab, true);
    e.preventDefault();
  });
  const side = h('aside', { class: 'side' }, tablist, body);
  const collapse = h('button', { class: 'collapse', title: 'Скрыть/показать панель', 'aria-label': 'Скрыть/показать панель', onclick: () => { document.body.classList.toggle('side-hidden'); setTimeout(() => stage.resize(), 220); } }, '⟨');

  const help = h('div', { class: 'help', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Управление' },
    h('b', {}, 'Управление'),
    h('ul', {},
      h('li', {}, 'Левая кнопка мыши — вращать, правая — сдвигать, колесо — приближать.'),
      h('li', {}, 'Наведите на штанкет или софит (он подсветится) и тяните вверх-вниз — он поедет. Стрелки ↑/↓ двигают выбранный штанкет на 5 см, с Shift — на 50 см.'),
      h('li', {}, 'Щелчок по прибору — карточка с номером и типом, его можно выключить.'),
      h('li', {}, 'Вкладка «Виды» — готовые ракурсы, план, разрез, сохранение и ссылка.'),
      h('li', {}, 'Esc — снять выбор, выключить рулетку, закрыть это окно.'),
    ),
    h('button', { class: 'btn', onclick: () => setHelp(false) }, 'Понятно'),
  );
  const backdrop = h('div', { class: 'backdrop', hidden: true, onclick: () => setHelp(false) });
  const setHelp = (on) => { help.hidden = !on; backdrop.hidden = !on; if (on) help.querySelector('.btn').focus(); };

  const exportMenu = h('div', { class: 'export-menu', hidden: true, role: 'menu', 'aria-label': 'Экспорт чертежей и 3D-модели' },
    exportButtons(stage, { onAction: () => setExport(false), role: 'menuitem' }),
  );
  const exportBackdrop = h('div', { class: 'export-backdrop', hidden: true, onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); setExport(false); } });
  const exportBtn = h('button', {
    class: 'btn export-menu-btn',
    title: 'Экспорт чертежей (.dxf) и 3D-модели (.glb)',
    'aria-label': 'Экспорт в CAD и 3D',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    onclick: () => setExport(exportMenu.hidden),
  }, '📐 Экспорт ▾');
  const setExport = (on) => {
    exportMenu.hidden = !on;
    exportBackdrop.hidden = !on;
    exportBtn.classList.toggle('on', on);
    exportBtn.setAttribute('aria-expanded', String(on));
  };

  const top = h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, h('b', {}, 'ФЭСТ'), h('span', {}, ' · Большая сцена')),
    quickBar(stage),
    h('div', { class: 'top-actions' },
      h('div', { class: 'top-search' }, fixtureSearch(stage)),
      exportBtn,
      h('button', { class: 'btn', title: 'Скриншот в PNG', onclick: () => { stage.screenshot(); toast('Скриншот сохранён в «Загрузки»'); } }, '📷 PNG'),
      h('button', { class: 'btn', title: 'Скопировать ссылку с текущим состоянием', onclick: () => shareLink(stage) }, '🔗 Ссылка'),
      h('button', { class: 'btn', title: 'Подсказка по управлению', 'aria-label': 'Подсказка по управлению', onclick: () => setHelp(help.hidden) }, '?'),
    ),
  );
  const card = infoCard(stage);
  // подсказка внизу зависит от вида: на плане и разрезе вращения нет
  const status = h('div', { class: 'status' });
  const updStatus = () => {
    const ortho = VIEWS[stage.view]?.type === 'ortho';
    status.textContent = ortho
      ? 'ЛКМ или ПКМ — сдвигать · колесо — масштаб · штанкет можно тянуть мышью'
      : 'ЛКМ — вращать · ПКМ — сдвигать · колесо — масштаб · штанкет можно тянуть мышью';
  };
  stage.on('view', updStatus);
  updStatus();
  document.body.append(top, exportBackdrop, exportMenu, side, collapse, card, backdrop, help, status, dragBadge(stage));
  stage.resize();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !exportMenu.hidden) { setExport(false); return; }
    if (e.key === 'Escape' && !help.hidden) { setHelp(false); return; }
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { stage.select(null); if (stage.measure.active) stage.setMeasure(false); }
    const sel = stage.selected;
    if (sel?.kind === 'rig' && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.target.closest?.('[role=tablist]')) {
      e.preventDefault();
      stage.setHeight(sel.id, stage.rigging.height(sel.id) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.5 : 0.05));
    }
  });
  exposeTestApi(stage);
  return stage;
}
