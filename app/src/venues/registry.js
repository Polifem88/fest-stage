// =============================================================================
//  РЕЕСТР ПЛОЩАДОК — единственная точка, через которую общий код (engine/, ui/)
//  узнаёт о сценах. Модуль площадки подключается лениво: load() → { default: VenueModule }.
//  В однофайловой сборке все модули встроены в тот же HTML, строится только выбранный.
//
//  status: 'ready' — готова; 'draft' — черновик (условные размеры, открывается);
//          'soon'  — видна в списке, но не открывается (модели ещё нет).
// =============================================================================

export const THEATRE_NAME = 'ФЭСТ';
export const APP_TITLE = 'ФЭСТ · 3D-каталог сцен';

export const VENUES = [
  { id: 'big', name: 'Большая сцена', status: 'ready', type: 'Сцена-коробка с порталом', seats: 390, load: () => import('./fest-big/index.js') },
  { id: 'chamber', name: 'Камерная сцена', status: 'draft', type: 'Чёрный кабинет', seats: 100, load: () => import('./fest-chamber/index.js') },
  { id: 'roof', name: 'Сцена под крышей', status: 'soon' },
  { id: 'foyer', name: 'Фойе', status: 'soon' },
  { id: 'studio', name: 'Студия мультимедиа', status: 'soon' },
];

export const DEFAULT_VENUE = 'big';
/** Ссылки до каталога (формат v1) не содержат площадки — это всегда Большая сцена. */
export const LEGACY_VENUE = 'big';

export function venueEntry(id) {
  return VENUES.find((v) => v.id === id) || null;
}

/** Можно ли открыть площадку (есть модуль и статус не «скоро»). */
export function isOpenable(id) {
  const e = venueEntry(id);
  return !!(e && e.load && e.status !== 'soon');
}
