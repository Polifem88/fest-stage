// Десктопная версия: панель слева с вкладками, карточка справа, быстрые кнопки сверху.
import './style.css';
import { Stage } from '../app/stage.js';
import { h, rigPanel, lightPanel, layersPanel, viewsPanel, infoCard, quickBar, shareLink, toast } from './common.js';
import { exposeTestApi } from '../app/testapi.js';

export function startDesktop() {
  document.body.classList.add('desktop');
  const viewport = h('div', { class: 'viewport' });
  const loading = h('div', { class: 'loading' }, 'Строим сцену…');
  document.body.append(viewport, loading);
  const stage = new Stage(viewport, 'desktop');
  loading.remove();

  const tabs = [
    ['rig', '⚙ Механика', () => rigPanel(stage)],
    ['light', '💡 Свет', () => lightPanel(stage)],
    ['layers', '🗂 Слои', () => layersPanel(stage)],
    ['views', '👁 Виды', () => viewsPanel(stage)],
  ];
  const body = h('div', { class: 'side-body' });
  const panes = {};
  const tabBtns = tabs.map(([id, name, make]) => {
    panes[id] = make();
    panes[id].hidden = id !== 'rig';
    body.append(panes[id]);
    return h('button', { class: `tab${id === 'rig' ? ' on' : ''}`, role: 'tab', 'data-tab': id, onclick: (e) => {
      for (const b of tabBtns) b.classList.toggle('on', b === e.currentTarget);
      for (const [k, p] of Object.entries(panes)) p.hidden = k !== id;
    } }, name);
  });
  const side = h('aside', { class: 'side' }, h('div', { class: 'tabs', role: 'tablist' }, tabBtns), body);
  const collapse = h('button', { class: 'collapse', title: 'Скрыть/показать панель', onclick: () => document.body.classList.toggle('side-hidden') }, '⟨');

  const top = h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, h('b', {}, 'ФЭСТ'), h('span', {}, ' · Большая сцена')),
    quickBar(stage),
    h('div', { class: 'top-actions' },
      h('button', { class: 'btn', title: 'Скриншот в PNG', onclick: () => { stage.screenshot(); toast('Скриншот сохранён в «Загрузки»'); } }, '📷 PNG'),
      h('button', { class: 'btn', title: 'Скопировать ссылку с текущим состоянием', onclick: () => shareLink(stage) }, '🔗 Ссылка'),
      h('button', { class: 'btn', title: 'Подсказка', onclick: () => help.toggleAttribute('hidden') }, '?'),
    ),
  );
  const help = h('div', { class: 'help', hidden: true },
    h('b', {}, 'Управление'),
    h('ul', {},
      h('li', {}, 'Левая кнопка мыши — вращать, правая — сдвигать, колесо — приближать.'),
      h('li', {}, 'Наведите на штанкет или софит и тяните вверх-вниз — он поедет.'),
      h('li', {}, 'Щелчок по прибору — карточка с номером и типом, его можно выключить.'),
      h('li', {}, 'Вкладка «Виды» — готовые ракурсы, план, разрез, сохранение и ссылка.'),
    ),
    h('button', { class: 'btn', onclick: () => help.setAttribute('hidden', '') }, 'Понятно'),
  );
  const card = infoCard(stage);
  const status = h('div', { class: 'status' }, 'ЛКМ — вращать · ПКМ — сдвигать · колесо — масштаб · штанкет можно тянуть мышью');
  document.body.append(top, side, collapse, card, help, status);
  stage.resize();

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { stage.select(null); if (stage.measure.active) stage.setMeasure(false); }
    const sel = stage.selected;
    if (sel?.kind === 'rig' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      stage.setHeight(sel.id, stage.rigging.height(sel.id) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.5 : 0.05));
    }
  });
  exposeTestApi(stage);
  return stage;
}
