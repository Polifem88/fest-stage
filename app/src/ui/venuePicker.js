// Заголовок с названием площадки «ФЭСТ · <сцена>» (обновляется при смене сцены).
import { h } from './common.js';
import { THEATRE_NAME } from '../venues/registry.js';

/** @param opts { compact: телефон (без точки-разделителя), onBefore: вызвать перед открытием списка } */
export function venueBrand(stage, { compact = false } = {}) {
  const name = h('span', {});
  const el = h('div', { class: 'brand' }, h('b', {}, THEATRE_NAME), name);
  const upd = () => { name.textContent = `${compact ? ' ' : ' · '}${stage.venue?.name || ''}`; };
  stage.on('venue', upd);
  upd();
  return el;
}
