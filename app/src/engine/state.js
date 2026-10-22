// Сохранение/загрузка состояния: высоты механики, свет, режимы — в ссылку (#v=<площадка>&s=...) и в файл.
// Формат v2 (каталог сцен): { v:2, vn:<id площадки>, h, fx, f, l, view, p?, hd? } — массивы в порядке
// конфига площадки (механика, приборы, слои). Формат v1 (до каталога) — всегда Большая сцена,
// раскладка та же, что у v2 для Большой сцены. Старые ссылки обязаны открываться.
import { LEGACY_VENUE } from '../venues/catalog.js';

const FLAGS = ['duty', 'house', 'haze', 'blueprint', 'labels', 'fixtureLabels', 'grid', 'dims'];
const PORT_MODES = ['off', 'floor', 'stand'];

/** Разобрать хэш ссылки: #v=chamber&s=… (старые ссылки: #s=…). */
export function parseHash(hash = '') {
  const v = hash.match(/(?:^#|[#&])v=([\w-]+)/)?.[1] || null;
  const s = hash.match(/(?:^#|[#&])s=([\w-]+)/)?.[1] || null;
  return { v, s };
}

/** Площадка, к которой относится строка состояния (v1 — Большая сцена); null — строка не читается. */
export function peekVenue(str) {
  const obj = parse(str);
  if (!obj) return null;
  return obj.v === 1 ? LEGACY_VENUE : obj.vn || null;
}

/**
 * state: { heights:{id:h}, fixturesOn:boolean[], flags:{}, layers:{}, portable, view }
 * venue: модуль площадки (порядок механики, приборов и слоёв).
 */
export function encodeState(st, venue) {
  const rig = venue.rigging?.list || [];
  const h = rig.map((r) => Math.round((st.heights[r.id] ?? r.rest) * 100));
  // приборы — битовая маска
  const bytes = new Uint8Array(Math.ceil(venue.fixtures.list.length / 8));
  st.fixturesOn.forEach((on, i) => { if (on) bytes[i >> 3] |= 1 << (i & 7); });
  let f = 0;
  FLAGS.forEach((k, i) => { if (st.flags[k]) f |= 1 << i; });
  let l = 0;
  venue.layers.forEach(([k], i) => { if (st.layers[k] !== false) l |= 1 << i; });
  const obj = { v: 2, vn: venue.id, h, fx: b64(bytes), f, l, view: st.view || '' };
  if (venue.fixtures.portable && st.portable && st.portable.mode !== 'off') obj.p = [PORT_MODES.indexOf(st.portable.mode), st.portable.count];
  if (st.flags.hazeDensity != null) obj.hd = Math.round(st.flags.hazeDensity * 100); // плотность дымки, %
  return b64(new TextEncoder().encode(JSON.stringify(obj)));
}

/** Разобрать строку состояния для площадки venue (строки другой площадки → null). */
export function decodeState(str, venue) {
  try {
    const obj = parse(str);
    if (!obj) return null;
    const vn = obj.v === 1 ? LEGACY_VENUE : obj.vn;
    if (vn !== venue.id) return null;
    const heights = {};
    (venue.rigging?.list || []).forEach((r, i) => { if (obj.h?.[i] != null) heights[r.id] = obj.h[i] / 100; });
    const bytes = unb64(obj.fx);
    const fixturesOn = venue.fixtures.list.map((_, i) => !!(bytes[i >> 3] & (1 << (i & 7))));
    const flags = {};
    FLAGS.forEach((k, i) => { flags[k] = !!(obj.f & (1 << i)); });
    if (typeof obj.hd === 'number') flags.hazeDensity = obj.hd / 100;
    const layers = {};
    venue.layers.forEach(([k], i) => { layers[k] = !!(obj.l & (1 << i)); });
    const defaults = venue.fixtures.portable?.defaults || { mode: 'off', count: 0 };
    const portable = Array.isArray(obj.p) ? { mode: PORT_MODES[obj.p[0]] || 'off', count: obj.p[1] } : { ...defaults };
    return { venue: vn, heights, fixturesOn, flags, layers, portable, view: obj.view };
  } catch {
    return null;
  }
}

function parse(str) {
  try {
    const obj = JSON.parse(new TextDecoder().decode(unb64(str)));
    return obj && (obj.v === 1 || obj.v === 2) ? obj : null;
  } catch {
    return null;
  }
}

function b64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
