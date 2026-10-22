import { describe, it, expect } from 'vitest';
import chamber from '../../src/venues/fest-chamber/index.js';
import { CHAMBER } from '../../src/venues/fest-chamber/config/dimensions.js';
import { FIXTURES } from '../../src/venues/fest-chamber/config/fixtures.js';
import { validateVenue } from '../../src/venues/contract.js';
import { TYPES } from '../../src/library/fixtureTypes.js';
import { SPECS } from '../../src/library/specs.js';
import { trussDs, trussXRange, trussChords, trussTopY, hangerXs, seatCount, seatLayout, lastRowBackD, rowFrontD } from '../../src/venues/_template/layout.js';
import { blackBoxDims } from '../../src/venues/_template/overlays.js';

const R = CHAMBER.room, T = CHAMBER.trusses;

describe('Камерная сцена: контракт', () => {
  it('validateVenue без ошибок', () => {
    expect(validateVenue(chamber)).toEqual([]);
  });
  it('черновик без механики и переносных приборов', () => {
    expect(chamber.status).toBe('draft');
    expect(chamber.rigging).toBeNull();
    expect(chamber.caps.rigging).toBe(false);
    expect(chamber.fixtures.portable).toBeNull();
    expect(chamber.meta).toMatchObject({ type: 'Чёрный кабинет', seats: 100 });
  });
  it('все виды из ТЗ на месте, ортогональные вмещают зал', () => {
    expect(Object.keys(chamber.views)).toEqual(expect.arrayContaining(['overview', 'hall', 'stageToHall', 'trusses', 'plan', 'section']));
    expect(chamber.views.plan.height).toBeGreaterThan(R.d1 - R.d0);
    expect(chamber.views.section.height).toBeGreaterThan(R.ceiling);
  });
});

describe('Камерная сцена: зал и фермы', () => {
  it('зал 12 × 9 м, потолок 4,4 м', () => {
    expect(R.x1 - R.x0).toBeCloseTo(12, 6);
    expect(R.d1 - R.d0).toBeCloseTo(9, 6);
    expect(R.ceiling).toBe(4.4);
  });
  it('9 ферм, равный шаг, все внутри зала', () => {
    const ds = trussDs(CHAMBER);
    expect(ds).toHaveLength(9);
    for (let i = 1; i < ds.length; i++) expect(ds[i] - ds[i - 1]).toBeCloseTo(T.step, 6);
    const [x0, x1] = trussXRange(CHAMBER);
    expect(x0).toBeGreaterThan(R.x0);
    expect(x1).toBeLessThan(R.x1);
    for (const d of ds) {
      const c = trussChords(CHAMBER, d);
      for (const [, dd] of [...c.bottom, ...c.top]) {
        expect(dd).toBeGreaterThan(R.d0);
        expect(dd).toBeLessThan(R.d1);
      }
    }
  });
  it('треугольник 20 см из трубы 32 мм, вершиной вверх; низ — 3,75, верх ниже потолка 4,4', () => {
    expect(T.side).toBe(0.2);
    expect(T.tube).toBe(0.032);
    const c = trussChords(CHAMBER, 0);
    expect(c.bottom).toHaveLength(2);
    expect(c.top).toHaveLength(1);
    for (const [y] of c.bottom) expect(y).toBe(3.75);
    expect(c.top[0][0]).toBeCloseTo(3.75 + 0.1732, 4);
    expect(c.bottom[1][1] - c.bottom[0][1]).toBeCloseTo(0.2, 6);
    expect(trussTopY(CHAMBER)).toBeLessThan(R.ceiling);
  });
  it('жёсткие подвесы к потолку не реже чем через 3 м', () => {
    const xs = hangerXs(CHAMBER);
    expect(xs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(3);
  });
});

describe('Камерная сцена: места', () => {
  it('100 мест, все в зрительской части, ряды не заходят на площадку и в стены', () => {
    expect(seatCount(CHAMBER)).toBe(100);
    const { seats } = seatLayout(CHAMBER);
    expect(seats).toHaveLength(100);
    const half = CHAMBER.hall.seatPitch / 2;
    for (const s of seats) {
      expect(s.x - half).toBeGreaterThanOrEqual(R.x0);
      expect(s.x + half).toBeLessThanOrEqual(R.x1);
      expect(s.d).toBeLessThan(CHAMBER.stage.d0);
    }
    expect(rowFrontD(CHAMBER, 0)).toBeCloseTo(CHAMBER.stage.d0 - CHAMBER.hall.firstRowGap, 6);
    expect(lastRowBackD(CHAMBER)).toBeGreaterThan(R.d0);
  });
});

describe('Камерная сцена: приборы', () => {
  it('14–18 приборов, номера уникальны, типы из справочника театра (с паспортом)', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(14);
    expect(FIXTURES.length).toBeLessThanOrEqual(18);
    expect(new Set(FIXTURES.map((f) => String(f.no))).size).toBe(FIXTURES.length);
    for (const f of FIXTURES) {
      expect(TYPES[f.type], f.no).toBeTruthy();
      expect(SPECS[f.type], f.no).toBeTruthy();
    }
  });
  it('все приборы неподвижны (mount.on = null), висят на фермах внутри зала', () => {
    const ds = trussDs(CHAMBER);
    for (const f of FIXTURES) {
      expect(f.mount.on, f.no).toBeNull();
      expect(chamber.fixtures.hangs(f), f.no).toBe(true);
      expect(f.mount.x).toBeGreaterThan(R.x0);
      expect(f.mount.x).toBeLessThan(R.x1);
      expect(f.mount.d).toBeGreaterThan(R.d0);
      expect(f.mount.d).toBeLessThan(R.d1);
      expect(f.mount.y).toBeLessThan(R.ceiling);
      // крепление — на нижнем поясе своей фермы
      const chords = trussChords(CHAMBER, ds[f.truss]).bottom;
      expect(chords.some(([y, d]) => Math.abs(d - f.mount.d) < 1e-9 && Math.abs(y - f.mount.y) < 0.05), f.no).toBe(true);
      // цель — на полу зала
      expect(f.aim.d).toBeGreaterThanOrEqual(R.d0);
      expect(f.aim.d).toBeLessThanOrEqual(R.d1);
    }
  });
  it('у каждой группы есть набор кнопок и групповой источник в обоих профилях', () => {
    for (const g of Object.keys(chamber.fixtures.groups)) {
      expect(chamber.fixtures.groupSets.some((s) => s.groups.includes(g)), g).toBe(true);
      for (const plan of ['full', 'lite']) expect(chamber.lightPlans[plan].some((p) => p.members.includes(g)), `${plan}:${g}`).toBe(true);
    }
  });
});

describe('Шаблон «чёрный кабинет»: размеры', () => {
  it('размерные линии лежат в пределах зала (по X и по глубине)', () => {
    for (const [a, b] of blackBoxDims(CHAMBER)) {
      for (const p of [a, b]) {
        expect(p[0]).toBeGreaterThanOrEqual(R.x0);
        expect(p[0]).toBeLessThanOrEqual(R.x1);
        expect(p[2]).toBeGreaterThanOrEqual(R.d0);
        expect(p[2]).toBeLessThanOrEqual(R.d1);
      }
    }
  });
});
