// Десктопная версия: панель слева с вкладками, карточка справа, быстрые кнопки сверху.
// Оболочка (шапка, карточка, поиск) живёт всё время; панели площадки пересобираются при смене сцены.
import './style.css';
import { Stage } from '../engine/stage.js';
import { h, rigPanel, lightPanel, layersPanel, viewsPanel, infoCard, quickBar, shareLink, toast, fixtureSearch, dragBadge, exportButtons } from './common.js';
import { venueBrand } from './venuePicker.js';
import { THEATRE_NAME } from '../venues/registry.js';
import { exposeTestApi } from '../engine/testapi.js';

export async function startDesktop() {
  document.body.classList.add('desktop');
  const viewport = h('div', { class: 'viewport' });
  const loading = h('div', { class: 'loading' }, 'Строим сцену…');
  document.body.append(viewport, loading);
  const stage = new Stage(viewport, 'desktop');

  // --- постоянная оболочка
  const body = h('div', { class: 'side-body' });
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Разделы панели' });
  let tabBtns = [];
  let panes = {};
  let currentTab = 'rig';
  const openTab = (id, focus = false) => {
    currentTab = id;
    for (const b of tabBtns) {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== id;
  };
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

  const helpList = h('ul', {});
  const help = h('div', { class: 'help', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Управление' },
    h('b', {}, 'Управление'),
    helpList,
    h('button', { class: 'btn', onclick: () => setHelp(false) }, 'Понятно'),
  );
  const backdrop = h('div', { class: 'backdrop', hidden: true, onclick: () => setHelp(false) });
  const setHelp = (on) => { help.hidden = !on; backdrop.hidden = !on; if (on) help.querySelector('.btn').focus(); };

  const exportMenu = h('div', { class: 'export-menu', hidden: true, role: 'menu', 'aria-label': 'Экспорт чертежей и 3D-модели' });
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

  const quickSlot = h('div', { class: 'quick-slot' });
  const top = h('header', { class: 'topbar' },
    venueBrand(stage, { onBefore: () => { setExport(false); setHelp(false); } }),
    quickSlot,
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
    const ortho = stage.views[stage.view]?.type === 'ortho';
    const drag = stage.venue?.caps.rigging ? ` · ${stage.venue.texts?.rigDrag || 'механику можно тянуть мышью'}` : '';
    status.textContent = ortho
      ? `ЛКМ или ПКМ — сдвигать · колесо — масштаб${drag}`
      : `ЛКМ — вращать · ПКМ — сдвигать · колесо — масштаб${drag}`;
  };
  stage.on('view', updStatus);
  document.body.append(top, exportBackdrop, exportMenu, side, collapse, card, backdrop, help, status, dragBadge(stage));

  // --- панели площадки (пересобираются при смене сцены)
  let unmount = null;
  const mountVenue = () => {
    unmount?.();
    side.inert = false;
    quickSlot.inert = false;
    unmount = stage.scope(() => {
      const caps = stage.venue.caps;
      const tabs = [
        caps.rigging ? ['rig', '⚙', 'Механика', () => rigPanel(stage)] : null,
        ['light', '💡', 'Свет', () => lightPanel(stage)],
        ['layers', '🗂', 'Слои', () => layersPanel(stage)],
        ['views', '👁', 'Виды', () => viewsPanel(stage)],
      ].filter(Boolean);
      body.replaceChildren();
      panes = {};
      if (!tabs.some(([id]) => id === currentTab)) currentTab = tabs[0][0];
      tabBtns = tabs.map(([id, ico, name, make]) => {
        panes[id] = make();
        panes[id].setAttribute('role', 'tabpanel');
        body.append(panes[id]);
        return h('button', { class: 'tab', role: 'tab', 'data-tab': id, onclick: () => openTab(id) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), ' ', name);
      });
      tablist.replaceChildren(...tabBtns);
      openTab(currentTab);
      quickSlot.replaceChildren(quickBar(stage));
      exportMenu.replaceChildren(...exportButtons(stage, { onAction: () => setExport(false), role: 'menuitem' }));
      // replaceChildren превращает null в текст «null» — пустые пункты отфильтровываем
      helpList.replaceChildren(...[
        h('li', {}, 'Левая кнопка мыши — вращать, правая — сдвигать, колесо — приближать.'),
        caps.rigging ? h('li', {}, 'Наведите на штанкет или софит (он подсветится) и тяните вверх-вниз — он поедет. Стрелки ↑/↓ двигают выбранный штанкет на 5 см, с Shift — на 50 см.') : null,
        h('li', {}, 'Щелчок по прибору — карточка с номером и типом, его можно выключить.'),
        h('li', {}, 'Вкладка «Виды» — готовые ракурсы, план, разрез, сохранение и ссылка.'),
        h('li', {}, 'Заголовок слева вверху — выбор сцены театра.'),
        h('li', {}, 'Esc — снять выбор, выключить рулетку, закрыть это окно.'),
      ].filter(Boolean));
      updStatus();
      const can = stage.exportFormats();
      exportBtn.title = can.planDXF || can.sectionDXF ? 'Экспорт чертежей (.dxf) и 3D-модели (.glb)' : 'Экспорт 3D-модели (.glb)';
      document.title = `${stage.venue.name} · ${THEATRE_NAME} (компьютер)`;
    });
  };
  stage.on('venue', mountVenue);
  // панели прежней площадки отписываются до её разбора: события новой площадки
  // (select/state/lights) не должны доходить до панелей со старым списком приборов
  // панели прежней площадки отписываются до её разбора и на время сборки не нажимаются
  stage.on('venueloading', () => { unmount?.(); unmount = null; side.inert = true; quickSlot.inert = true; });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !exportMenu.hidden) { setExport(false); return; }
    if (e.key === 'Escape' && !help.hidden) { setHelp(false); return; }
    if (document.querySelector('dialog[open]')) return; // список сцен сам закрывается по Esc
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { stage.select(null); if (stage.measure.active) stage.setMeasure(false); }
    const sel = stage.selected;
    if (sel?.kind === 'rig' && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.target.closest?.('[role=tablist]')) {
      e.preventDefault();
      stage.setHeight(sel.id, stage.rigging.height(sel.id) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.5 : 0.05));
    }
  });

  const { notice } = await stage.boot();
  loading.remove();
  stage.resize();
  if (notice) toast(notice, 4000);
  exposeTestApi(stage);
  return stage;
}
