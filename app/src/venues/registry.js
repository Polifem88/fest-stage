// =============================================================================
//  РЕЕСТР ПЛОЩАДОК — единственная точка, через которую общий код (engine/, ui/)
//  узнаёт о сценах. Описание сцен — catalog.js; здесь к нему добавлены загрузчики модулей.
//  Модуль площадки подключается лениво: load() → { default: VenueModule }.
//  В однофайловой сборке все модули встроены в тот же HTML, строится только выбранный.
// =============================================================================
import { CATALOG } from './catalog.js';

export { THEATRE_NAME, APP_TITLE, DEFAULT_VENUE, LEGACY_VENUE } from './catalog.js';

const LOADERS = {
  big: () => import('./fest-big/index.js'),
  chamber: () => import('./fest-chamber/index.js'),
  roof: () => import('./fest-roof/index.js'),
};

export const VENUES = CATALOG.map((v) => ({ ...v, load: v.status !== 'soon' ? LOADERS[v.id] || null : null }));

export function venueEntry(id) {
  return VENUES.find((v) => v.id === id) || null;
}

/** Можно ли открыть площадку (есть модуль и статус не «скоро»). */
export function isOpenable(id) {
  const e = venueEntry(id);
  return !!(e && e.load && e.status !== 'soon');
}
