import { describe, it, expect, beforeAll } from 'vitest';
import { VENUES, isOpenable } from '../../src/venues/registry.js';
import { validateVenue } from '../../src/venues/contract.js';

// Каждая площадка реестра, которую можно открыть, обязана соблюдать контракт (venues/contract.js).
const openable = VENUES.filter((e) => isOpenable(e.id));

describe('Реестр площадок', () => {
  it('id уникальны, открываемые площадки есть', () => {
    expect(new Set(VENUES.map((e) => e.id)).size).toBe(VENUES.length);
    expect(openable.length).toBeGreaterThan(0);
  });
  it('у площадок «скоро» нет модуля', () => {
    for (const e of VENUES) if (e.status === 'soon') expect(isOpenable(e.id), e.id).toBe(false);
  });
});

describe.each(openable.map((e) => [e.id, e]))('Площадка %s', (id, entry) => {
  it('модуль соблюдает контракт, id и статус совпадают с реестром', async () => {
    const venue = (await entry.load()).default;
    expect(validateVenue(venue)).toEqual([]);
    expect(venue.id).toBe(id);
    expect(venue.status).toBe(entry.status);
    expect(venue.name).toBe(entry.name);
    if (entry.seats != null && venue.meta.seats != null) expect(venue.meta.seats).toBe(entry.seats);
    if (entry.type) expect(venue.meta.type, 'тип площадки в каталоге и в модуле').toBe(entry.type);
  });
});

describe('Контракт: трансформируемый зал (caps.layouts)', () => {
  const okLayouts = () => ({
    list: [{ id: 'a', name: 'А', rowsMax: 5 }, { id: 'b', name: 'Б', rowsMax: 0 }],
    default: 'a',
    shiftStep: 0.5,
    range: () => [0, 0],
    seats: () => 0,
    build: () => null,
  });
  let base;
  const with_ = (caps, layouts) => ({ ...base, caps: { ...base.caps, layouts: caps }, layouts });
  const has = (v, re) => validateVenue(v).some((e) => re.test(e));

  beforeAll(async () => { base = (await import('../../src/venues/fest-chamber/index.js')).default; });

  it('корректная площадка с планировками проходит', () => {
    expect(validateVenue(with_(true, okLayouts()))).toEqual([]);
  });
  it('caps.layouts обязателен и совпадает с наличием layouts', () => {
    const { layouts: _drop, ...noCap } = base.caps;
    expect(has({ ...base, caps: noCap }, /caps\.layouts/)).toBe(true);
    expect(has(with_(true, null), /caps\.layouts/)).toBe(true);
    expect(has(with_(false, okLayouts()), /caps\.layouts/)).toBe(true);
  });
  it('default из списка, id уникальны, есть build/range/seats', () => {
    expect(has(with_(true, { ...okLayouts(), default: 'z' }), /layouts\.default/)).toBe(true);
    const dup = okLayouts(); dup.list[1].id = 'a';
    expect(has(with_(true, dup), /повторяются id планировок/)).toBe(true);
    for (const k of ['build', 'range', 'seats']) {
      const l = okLayouts(); delete l[k];
      expect(has(with_(true, l), new RegExp(`layouts\\.${k}`)), k).toBe(true);
    }
  });
});
