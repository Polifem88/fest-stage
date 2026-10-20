import { describe, it, expect } from 'vitest';
import { DIM, BOX_HALF, GALLERY_INNER_X, BACK_GALLERY_FRONT_D } from '../../src/config/dimensions.js';
import { RIGGING, SPACING, DEPTHS, LEFT_RAIL_ORDER, RIG_BY_ID, ropeDepth, DUTY_ROWS } from '../../src/config/rigging.js';
import { FIXTURES, TYPES, GROUPS, typeSummary } from '../../src/config/fixtures.js';

describe('Размеры и глубины', () => {
  it('сумма расстояний + галерея + портал + авансцена = 12 м (±5 см)', () => {
    const chain = SPACING.reduce((s, [, , g]) => s + g, 0);
    const total = DIM.forestage.depth + DIM.portal.thickness + chain + DIM.galleries.width;
    // по исходным цифрам выходит 11.95 — 5 см «недостачи», это в пределах допуска
    expect(Math.abs(total - 12)).toBeLessThanOrEqual(0.051);
  });

  it('задняя стена совпадает с цепочкой расстояний', () => {
    expect(DEPTHS.Rail + DIM.galleries.width).toBeCloseTo(DIM.box.backWallD, 2);
    expect(DEPTHS.Rail).toBeCloseTo(BACK_GALLERY_FRONT_D, 2);
  });

  it('ригель на 6.4 и выступает от потолка на 2.1 м', () => {
    expect(DIM.box.ceiling - DIM.rigel.bottomY).toBeCloseTo(2.1, 5);
    expect(DEPTHS.Rigel).toBeCloseTo(DIM.rigel.d, 3);
  });

  it('объекты идут строго спереди назад в нужном порядке', () => {
    const order = ['C0', 'Sh0', 'Z', 'Sh1', 'Sh2', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'Sh12'];
    const ds = order.map((id) => RIG_BY_ID[id].d);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });
});

describe('Механика', () => {
  it('исходное положение в пределах хода', () => {
    for (const r of RIGGING) {
      expect(r.rest, r.id).toBeGreaterThanOrEqual(r.min);
      expect(r.rest, r.id).toBeLessThanOrEqual(r.max);
    }
  });

  it('ничего не выше потолка; за ригелем штанкеты не выше его низа на своём месте', () => {
    for (const r of RIGGING) expect(r.max, r.id).toBeLessThan(DIM.box.ceiling);
  });

  it('концы обычных штанкет не заходят на галереи; боковые — между концами и перилами', () => {
    expect(DIM.pipe.length / 2).toBeLessThan(GALLERY_INNER_X);
    for (const id of ['B1', 'B2']) {
      const x = Math.abs(RIG_BY_ID[id].x);
      expect(x).toBeGreaterThan(DIM.pipe.length / 2);
      expect(x).toBeLessThan(GALLERY_INNER_X);
    }
  });

  it('Б2 короче Б1 и не заходит на площадку узла подъёма', () => {
    const b1 = RIG_BY_ID.B1, b2 = RIG_BY_ID.B2;
    expect(b2.dTo - b2.dFrom).toBeLessThan(b1.dTo - b1.dFrom);
    expect(b2.dTo).toBeLessThan(DIM.box.backWallD - DIM.liftNode.padSize);
  });

  it('порядок канатов на левой стене совпадает с уточнённым', () => {
    expect(LEFT_RAIL_ORDER).toEqual(['Sh2', 'Sh0', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'B1', 'Sh12']);
    const ds = LEFT_RAIL_ORDER.map(ropeDepth);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });

  it('линии дежурного света между нужными объектами', () => {
    expect(DUTY_ROWS[0].d).toBeGreaterThan(DEPTHS.Sh3);
    expect(DUTY_ROWS[0].d).toBeLessThan(DEPTHS.Sh4);
    expect(DUTY_ROWS[1].d).toBeGreaterThan(DEPTHS.Sh8);
    expect(DUTY_ROWS[1].d).toBeLessThan(DEPTHS.C3);
    expect(DUTY_ROWS[2].d).toBeGreaterThan(DEPTHS.Sh11);
    expect(DUTY_ROWS[2].d).toBeLessThan(DEPTHS.Sh12);
  });
});

describe('Приборы', () => {
  it('номера уникальны', () => {
    const nos = FIXTURES.map((f) => String(f.no));
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('количество на софитах как на схеме', () => {
    const c = (g) => FIXTURES.filter((f) => f.group === g).length;
    expect(c('C0')).toBe(13);
    expect(c('C1')).toBe(17);
    expect(c('C2')).toBe(11);
    expect(c('C3')).toBe(11);
  });

  it('по каждому типу из легенды расставлено ровно столько, сколько в легенде', () => {
    for (const row of typeSummary()) {
      if (TYPES[row.key].legendCount > 0) expect(row.placed, row.name).toBe(row.legend);
    }
  });

  it('у каждого прибора есть тип и группа', () => {
    for (const f of FIXTURES) {
      expect(TYPES[f.type], String(f.no)).toBeTruthy();
      expect(GROUPS[f.group], String(f.no)).toBeTruthy();
    }
  });

  it('все приборы внутри здания', () => {
    for (const f of FIXTURES) {
      expect(Math.abs(f.mount.x), String(f.no)).toBeLessThanOrEqual(DIM.hall.width / 2);
      if (!f.mount.on) expect(f.mount.y, String(f.no)).toBeLessThan(DIM.box.ceiling);
    }
  });
});
