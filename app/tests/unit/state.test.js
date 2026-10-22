// Ссылка с состоянием: формат v2 (каталог сцен) и совместимость со старыми ссылками v1.
import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, peekVenue, parseHash } from '../../src/engine/state.js';
import big from '../../src/venues/fest-big/index.js';
import chamber from '../../src/venues/fest-chamber/index.js';

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Строка в старом формате v1 (как её писала версия до каталога сцен). */
function legacyV1({ heights = {}, offIdx = [], view = 'hall', portable = null }) {
  const h = big.rigging.list.map((r) => Math.round((heights[r.id] ?? r.rest) * 100));
  const bytes = new Uint8Array(Math.ceil(big.fixtures.list.length / 8));
  big.fixtures.list.forEach((_, i) => { if (!offIdx.includes(i)) bytes[i >> 3] |= 1 << (i & 7); });
  const fx = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const obj = { v: 1, h, fx, f: 0b10111, l: 0b11011, view };
  if (portable) obj.p = portable;
  return b64(JSON.stringify(obj));
}

const stateOf = (venue, patch = {}) => ({
  heights: Object.fromEntries((venue.rigging?.list || []).map((r) => [r.id, r.rest])),
  fixturesOn: venue.fixtures.list.map(() => true),
  flags: { duty: true, house: false, haze: true, blueprint: false, labels: true, fixtureLabels: false, grid: false, dims: false, hazeDensity: 0.3 },
  layers: Object.fromEntries(venue.layers.map(([k]) => [k, true])),
  portable: venue.fixtures.portable ? { ...venue.fixtures.portable.defaults } : { mode: 'off', count: 0 },
  view: venue.defaultView,
  ...patch,
});

describe('Ссылка: старый формат v1 (до каталога сцен)', () => {
  const s = legacyV1({ heights: { Sh5: 2, C2: 3 }, offIdx: [0, 5], portable: [2, 6] });
  it('относится к Большой сцене', () => expect(peekVenue(s)).toBe('big'));
  it('раскрывается в состояние Большой сцены без потерь', () => {
    const st = decodeState(s, big);
    expect(st.venue).toBe('big');
    expect(st.heights.Sh5).toBe(2);
    expect(st.heights.C2).toBe(3);
    expect(st.fixturesOn[0]).toBe(false);
    expect(st.fixturesOn[1]).toBe(true);
    expect(st.fixturesOn[5]).toBe(false);
    expect(st.portable).toEqual({ mode: 'stand', count: 6 });
    expect(st.view).toBe('hall');
    expect(st.layers).toEqual({ hall: true, walls: true, galleries: false, rigging: true, lights: true });
  });
  it('не применяется к другой площадке', () => expect(decodeState(s, chamber)).toBeNull());
});

describe('Ссылка: формат v2', () => {
  for (const venue of [big, chamber]) {
    it(`${venue.name}: туда и обратно без потерь`, () => {
      const lights = venue.fixtures.list.map((_, i) => i % 3 !== 0);
      const st = stateOf(venue, { fixturesOn: lights, view: Object.keys(venue.views).at(-1), layers: { ...stateOf(venue).layers, lights: false } });
      if (venue.rigging) st.heights[venue.rigging.list[3].id] = 2.35;
      const s = encodeState(st, venue);
      expect(peekVenue(s)).toBe(venue.id);
      const back = decodeState(s, venue);
      expect(back.venue).toBe(venue.id);
      expect(back.fixturesOn).toEqual(lights);
      expect(back.layers).toEqual(st.layers);
      expect(back.view).toBe(st.view);
      expect(back.heights).toEqual(st.heights);
      expect(back.flags.hazeDensity).toBe(0.3);
    });
  }
  it('строка одной площадки не применяется к другой', () => {
    expect(decodeState(encodeState(stateOf(chamber), chamber), big)).toBeNull();
  });
  it('мусор не ломает разбор', () => {
    expect(peekVenue('!!!')).toBeNull();
    expect(decodeState('abc', big)).toBeNull();
  });
});

describe('Хэш ссылки', () => {
  it('#v=…&s=… и старый #s=…', () => {
    expect(parseHash('#v=chamber&s=abc_-1')).toEqual({ v: 'chamber', s: 'abc_-1' });
    expect(parseHash('#s=xyz')).toEqual({ v: null, s: 'xyz' });
    expect(parseHash('')).toEqual({ v: null, s: null });
  });
});
