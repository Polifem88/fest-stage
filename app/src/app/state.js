// Сохранение/загрузка состояния: высоты механики, свет, режимы — в ссылку (#s=...) и в файл.
import { RIGGING } from '../config/rigging.js';
import { FIXTURES } from '../config/fixtures.js';

const FLAGS = ['duty', 'house', 'haze', 'blueprint', 'labels', 'fixtureLabels', 'grid', 'dims'];
const LAYERS = ['hall', 'walls', 'galleries', 'rigging', 'lights'];

/** state: { heights:{id:h}, fixturesOn:boolean[], flags:{}, layers:{}, view } */
export function encodeState(st) {
  const h = RIGGING.map((r) => Math.round((st.heights[r.id] ?? r.rest) * 100));
  // приборы — битовая маска
  const bytes = new Uint8Array(Math.ceil(FIXTURES.length / 8));
  st.fixturesOn.forEach((on, i) => { if (on) bytes[i >> 3] |= 1 << (i & 7); });
  let f = 0;
  FLAGS.forEach((k, i) => { if (st.flags[k]) f |= 1 << i; });
  let l = 0;
  LAYERS.forEach((k, i) => { if (st.layers[k] !== false) l |= 1 << i; });
  const obj = { v: 1, h, fx: b64(bytes), f, l, view: st.view || '' };
  return b64(new TextEncoder().encode(JSON.stringify(obj)));
}

export function decodeState(str) {
  try {
    const obj = JSON.parse(new TextDecoder().decode(unb64(str)));
    if (obj.v !== 1) return null;
    const heights = {};
    RIGGING.forEach((r, i) => { if (obj.h[i] != null) heights[r.id] = obj.h[i] / 100; });
    const bytes = unb64(obj.fx);
    const fixturesOn = FIXTURES.map((_, i) => !!(bytes[i >> 3] & (1 << (i & 7))));
    const flags = {};
    FLAGS.forEach((k, i) => { flags[k] = !!(obj.f & (1 << i)); });
    const layers = {};
    LAYERS.forEach((k, i) => { layers[k] = !!(obj.l & (1 << i)); });
    return { heights, fixturesOn, flags, layers, view: obj.view };
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
