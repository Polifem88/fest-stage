// Паритет и каталог: каждая готовая площадка (status 'ready') проверяется харнессом паритета
// (app/scripts/parity.mjs, список VENUES), черновики и «скоро» — нет. См. GEMINI.md §4 п. 3.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATALOG } from '../../src/venues/catalog.js';

const src = readFileSync(new URL('../../scripts/parity.mjs', import.meta.url), 'utf8');
/** Ключи объекта VENUES в parity.mjs (верхний уровень блока). */
function parityVenues() {
  const start = src.indexOf('const VENUES = {');
  expect(start, 'в parity.mjs нет const VENUES = {').toBeGreaterThan(-1);
  const end = src.indexOf('\n};', start);
  return [...src.slice(start, end).matchAll(/^ {2}([a-z][a-z0-9-]*): \{/gm)].map((m) => m[1]);
}

describe('Паритет: площадки харнесса и каталог', () => {
  it('все площадки со статусом ready есть в VENUES скрипта паритета', () => {
    const venues = parityVenues();
    for (const v of CATALOG.filter((c) => c.status === 'ready')) {
      expect(venues, `площадка «${v.id}» готова — добавьте её в VENUES app/scripts/parity.mjs и переснимите эталон`).toContain(v.id);
    }
  });
  it('черновики и «скоро» в паритет не входят', () => {
    const venues = parityVenues();
    for (const v of CATALOG.filter((c) => c.status !== 'ready')) expect(venues, v.id).not.toContain(v.id);
  });
  it('эталон снимается только с явно указанной сборки (без старого dist-master по умолчанию)', () => {
    expect(src).not.toMatch(/mode === 'capture' \? 'review\/modular\/baseline\/dist-master'/);
  });
});
