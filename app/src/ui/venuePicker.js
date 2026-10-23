// Выбор площадки: заголовок «ФЭСТ · <сцена> ▾» в шапке открывает список сцен театра.
// Компьютер — выпадающая панель под заголовком, телефон — шторка снизу. Обе — модальный <dialog>
// (фокус внутри, Esc закрывает, щелчок мимо закрывает). Сцены «скоро» видны, но не открываются.
import { h, toast } from './common.js';
import { THEATRE_NAME, VENUES, venueEntry } from '../venues/registry.js';
import { seatsLabel } from '../venues/catalog.js';

const STATUS = { draft: 'черновик', soon: 'скоро' };

/**
 * @param opts.compact  телефон: шторка снизу, в заголовке короткое название сцены
 * @param opts.onBefore вызвать перед открытием (закрыть другие меню)
 */
export function venueBrand(stage, { compact = false, onBefore } = {}) {
  const name = h('span', { class: 'brand-name' });
  const caret = h('span', { class: 'brand-caret', 'aria-hidden': 'true' }, '▾');
  const btn = h('button', {
    class: 'brand brand-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    title: 'Выбрать сцену', onclick: () => open(),
  }, h('b', {}, THEATRE_NAME), name, caret);

  const list = h('div', { class: 'venue-list' });
  // ответ на нажатие «скоро» — внутри диалога: тост под модальной шторкой не виден и не читается диктором
  const note = h('p', { class: 'venue-note', role: 'status' });
  const dlg = h('dialog', { class: `venue-picker${compact ? ' sheet-picker' : ''}`, closedby: 'any', 'aria-label': `Сцены театра ${THEATRE_NAME}` },
    h('div', { class: 'venue-head' }, h('b', {}, `Сцены театра ${THEATRE_NAME}`),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Закрыть', onclick: () => dlg.close() }, '×')),
    list,
    note,
  );
  // запасной вариант «щелчок мимо закрывает» для браузеров без closedby (Safari)
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      if (r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right) return;
      dlg.close();
    });
  }
  dlg.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
  // стрелки ↑/↓ — между сценами (с крестика: ↓ — на первую, ↑ — на последнюю)
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...list.querySelectorAll('.venue-item')];
    const i = items.indexOf(document.activeElement);
    const down = e.key === 'ArrowDown';
    const n = i < 0 ? items[down ? 0 : items.length - 1] : items[(i + (down ? 1 : -1) + items.length) % items.length];
    n?.focus();
    e.preventDefault();
  });

  const render = () => {
    const cur = stage.venue?.id;
    list.replaceChildren(...VENUES.map((v) => {
      const soon = v.status === 'soon' || !v.load;
      const meta = [v.type, seatsLabel(v.seats)].filter(Boolean).join(' · ') || 'модель готовится';
      return h('button', {
        class: `venue-item${v.id === cur ? ' current' : ''}${soon ? ' soon' : ''}`, type: 'button',
        'data-venue': v.id, 'aria-current': v.id === cur ? 'true' : null, 'aria-disabled': soon ? 'true' : null,
        onclick: () => pick(v),
      },
      h('span', { class: 'venue-name' }, v.name, STATUS[v.status] ? h('span', { class: `venue-badge ${v.status}` }, STATUS[v.status]) : null),
      h('span', { class: 'venue-meta' }, meta));
    }));
  };

  const pick = async (v) => {
    if (v.status === 'soon' || !v.load) { note.textContent = `«${v.name}» — модель пока готовится`; return; }
    dlg.close();
    if (v.id === stage.venue?.id) return;
    // кнопку не отключаем (disabled увёл бы фокус с неё); повторный выбор встанет в очередь движка
    btn.setAttribute('aria-busy', 'true');
    try {
      if (await stage.loadVenue(v.id)) {
        history.replaceState(null, '', stage.shareUrl());
        if (v.status === 'draft') toast(`${v.name}: черновик — размеры условные`, 2600);
      }
    } finally { btn.removeAttribute('aria-busy'); }
  };

  function open() {
    onBefore?.();
    note.textContent = '';
    render();
    dlg.showModal();
    btn.setAttribute('aria-expanded', 'true');
    (list.querySelector('.venue-item.current') || list.querySelector('.venue-item'))?.focus();
  }

  // на телефоне в шапке — короткое название (полное — в подсказке и в списке)
  const upd = () => {
    const v = stage.venue;
    name.textContent = compact ? (venueEntry(v?.id)?.short || v?.name || '') : ` · ${v?.name || ''}`;
    btn.title = v ? `Сцена: ${v.name} — выбрать другую` : 'Выбрать сцену';
  };
  stage.on('venue', upd);
  upd();
  // плашка «Строим …» поверх холста, пока собирается новая площадка (при первом запуске есть общая заставка)
  stage.on('venueloading', (e) => {
    if (!stage.venue) return;
    const veil = h('div', { class: 'loading venue-veil' }, `Строим: ${e.name}…`);
    stage.container.append(veil);
    const done = () => { veil.remove(); offV(); offE(); };
    const offV = stage.on('venue', done);
    const offE = stage.on('venueerror', done);
  });
  stage.on('venueerror', (e) => toast(`Не удалось открыть «${e.name}» — подробности в консоли браузера`, 4000));
  document.body.append(dlg);
  btn.picker = dlg;
  return btn;
}
