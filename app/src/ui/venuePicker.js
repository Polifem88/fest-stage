// Выбор площадки: заголовок «ФЭСТ · <сцена> ▾» в шапке открывает список сцен театра.
// Компьютер — выпадающая панель под заголовком, телефон — шторка снизу. Обе — модальный <dialog>
// (фокус внутри, Esc закрывает, щелчок мимо закрывает). Сцены «скоро» видны, но не открываются.
import { h, toast } from './common.js';
import { THEATRE_NAME, VENUES, venueEntry } from '../venues/registry.js';

const STATUS = { draft: 'черновик', soon: 'скоро' };

/**
 * @param opts.compact  телефон: шторка снизу, в заголовке без точки-разделителя
 * @param opts.onBefore вызвать перед открытием (закрыть другие меню)
 */
export function venueBrand(stage, { compact = false, onBefore } = {}) {
  const name = h('span', { class: 'brand-name' });
  const caret = h('span', { class: 'brand-caret', 'aria-hidden': 'true' }, '▾');
  const btn = h('button', {
    class: 'brand brand-btn', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    title: 'Выбрать сцену', onclick: () => open(),
  }, h('b', {}, THEATRE_NAME), name, caret);

  const list = h('div', { class: 'venue-list', role: 'list' });
  const dlg = h('dialog', { class: `venue-picker${compact ? ' sheet-picker' : ''}`, closedby: 'any', 'aria-label': 'Сцены театра' },
    h('div', { class: 'venue-head' }, h('b', {}, `Сцены театра ${THEATRE_NAME}`),
      h('button', { class: 'x', type: 'button', 'aria-label': 'Закрыть', onclick: () => dlg.close() }, '×')),
    list,
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
  // стрелки ↑/↓ — между сценами
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...list.querySelectorAll('.venue-item')];
    const i = items.indexOf(document.activeElement);
    const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    n?.focus();
    e.preventDefault();
  });

  const render = () => {
    const cur = stage.venue?.id;
    list.replaceChildren(...VENUES.map((v) => {
      const soon = v.status === 'soon' || !v.load;
      const meta = [v.type, v.seats ? `${v.seats} мест` : null].filter(Boolean).join(' · ') || 'модель готовится';
      const it = h('button', {
        class: `venue-item${v.id === cur ? ' current' : ''}${soon ? ' soon' : ''}`, type: 'button', role: 'listitem',
        'data-venue': v.id, 'aria-current': v.id === cur ? 'true' : null, 'aria-disabled': soon ? 'true' : null,
        onclick: () => pick(v),
      },
      h('span', { class: 'venue-name' }, v.name, STATUS[v.status] ? h('span', { class: `venue-badge ${v.status}` }, STATUS[v.status]) : null),
      h('span', { class: 'venue-meta' }, meta));
      return it;
    }));
  };

  const pick = async (v) => {
    if (v.status === 'soon' || !v.load) { toast(`«${v.name}» — модель пока готовится`, 2200); return; }
    dlg.close();
    if (v.id === stage.venue?.id) return;
    btn.disabled = true;
    try {
      await stage.loadVenue(v.id);
      history.replaceState(null, '', stage.shareUrl());
      if (v.status === 'draft') toast(`${v.name}: черновик — размеры условные`, 2600);
    } finally { btn.disabled = false; }
  };

  function open() {
    onBefore?.();
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
  // плашка «Строим …» поверх холста, пока собирается новая площадка
  stage.on('venueloading', (e) => {
    const veil = h('div', { class: 'loading venue-veil' }, `Строим: ${e.name}…`);
    stage.container.append(veil);
    const off = stage.on('venue', () => { veil.remove(); off(); });
  });
  document.body.append(dlg);
  btn.picker = dlg;
  return btn;
}
