import { describe, it, expect } from 'vitest';
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
