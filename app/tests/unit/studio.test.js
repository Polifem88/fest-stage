// Студия мультимедиа: геометрия помещения, циклорамы, ферм, потолка и сборка.
import { describe, it, expect } from 'vitest';
import { STUDIO, ceilingItems, trussFootprints } from '../../src/venues/fest-studio/config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS } from '../../src/venues/fest-studio/config/fixtures.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const overlap = (a, b, eps = 1e-6) => a[0] < b[1] - eps && a[1] > b[0] + eps && a[2] < b[3] - eps && a[3] > b[2] + eps;

describe('Студия · геометрия', () => {
  it('габариты помещения: ширина 6,10, глубина слева 12,60, справа до полотна выхода 12,95, потолок 5,65', () => {
    const R = STUDIO.room;
    expect(near(R.x1 - R.x0, 6.10)).toBe(true);
    expect(near(R.d1 - R.d0, 12.60)).toBe(true);
    const exit = STUDIO.doors.find((d) => d.id === 'exit');
    expect(near(R.d1 - exit.d0, 12.95)).toBe(true);
    expect(R.ceiling).toBe(5.65);
    expect(STUDIO.canopy).toEqual({ d0: -8.60, d1: -7.90, y: 2.40 });
  });

  it('верхняя решётка ферм: 4,00 + 7,90 = 0,20 + 0,15 + 11,20 + 0,15 + 0,20; шаги Ф1–Ф2 и Ф5–Ф6 = 1,85, Ф2…Ф5 = 2,50', () => {
    const T = STUDIO.trusses, s = T.size / 2;
    const cross = T.upper.lines.filter((l) => l.axis === 'd');
    expect(cross).toHaveLength(6);
    const ds = cross.map((l) => l.at);
    expect(ds).toEqual([-7.55, -5.70, -3.20, -0.70, 1.80, 3.65]);
    expect(near(ds[5] - ds[0], 11.20)).toBe(true);
    expect(near(STUDIO.room.d1 - STUDIO.canopy.d1, 0.20 + s + (ds[5] - ds[0]) + s + 0.20)).toBe(true);
    expect(near(ds[1] - ds[0], 1.85)).toBe(true);
    expect(near(ds[5] - ds[4], 1.85)).toBe(true);
    for (let i = 1; i < 4; i++) expect(near(ds[i + 1] - ds[i], 2.50)).toBe(true);
  });

  it('отступы граней ферм: продольные — 0,20 от стен; верхние — 0,20 от козырька и стены за циклорамой; нижняя у козырька — 0,05', () => {
    const R = STUDIO.room, T = STUDIO.trusses, s = T.size / 2;
    const uLong = T.upper.lines.filter((l) => l.axis === 'x');
    expect(uLong).toHaveLength(2);
    for (const l of uLong) {
      expect(near(Math.abs(l.at) + s, R.x1 - 0.20)).toBe(true);
      expect(near(l.a0 - STUDIO.canopy.d1, 0.20)).toBe(true);
      expect(near(R.d1 - l.a1, 0.20)).toBe(true);
    }
    const uCross = T.upper.lines.filter((l) => l.axis === 'd');
    for (const l of uCross) {
      expect(near(l.a0, -2.70 + s)).toBe(true);
      expect(near(l.a1, 2.70 - s)).toBe(true);
    }
    const lCanopy = T.lower.lines.find((l) => l.axis === 'd');
    expect(near(lCanopy.at - s - STUDIO.canopy.d1, 0.05)).toBe(true);
    expect(near(lCanopy.a0, -2.70 - s)).toBe(true);
    expect(near(lCanopy.a1, 2.70 + s)).toBe(true);
    const lSide = T.lower.lines.filter((l) => l.axis === 'x');
    expect(lSide).toHaveLength(2);
    for (const l of lSide) {
      expect(near(Math.abs(l.at) + s, R.x1 - 0.20)).toBe(true);
      expect(near(l.a0, lCanopy.at + s)).toBe(true);
      expect(l.a1).toBe(0);
    }
  });

  it('нижние боковые фермы кончаются на d = 0; вставки у циклорамы — передняя грань d = 0; все вставки 3,55…5,20', () => {
    const T = STUDIO.trusses, s = T.size / 2;
    expect(T.posts).toHaveLength(3);
    for (const p of T.posts) {
      expect(p.y0).toBe(T.lower.y1);
      expect(p.y1).toBe(T.upper.y0);
      expect([p.y0, p.y1]).toEqual([3.55, 5.20]);
    }
    const cycPosts = T.posts.filter((p) => p.d > 0);
    expect(cycPosts).toHaveLength(2);
    for (const p of cycPosts) expect(near(p.d - s, 0)).toBe(true);
    const cornerPost = T.posts.find((p) => p.d < 0);
    expect([cornerPost.x, cornerPost.d]).toEqual([-2.70, -7.55]);
  });

  it('циклорама: ширина 6,05, зазоры 0,025 к боковым стенам и к стене за ней, r = 0,70, h = 3,90', () => {
    const C = STUDIO.cyc, R = STUDIO.room;
    expect(near(C.x1 - C.x0, 6.05)).toBe(true);
    expect(near(C.x0 - R.x0, 0.025)).toBe(true);
    expect(near(R.x1 - C.x1, 0.025)).toBe(true);
    expect(near(R.d1 - C.d1, 0.025)).toBe(true);
    expect(C.d0).toBe(0);
    expect(C.r).toBe(0.70);
    expect(C.h).toBe(3.90);
    expect(C.hAssumption).toBe(true);
  });

  it('двери: ниша выхода вплотную к правой стене (1,80 × 0,35); углубление тех. двери 1,05 × 0,45, d −4,45…−3,40', () => {
    const R = STUDIO.room;
    const exit = STUDIO.doors.find((d) => d.id === 'exit');
    expect(exit.x1).toBe(R.x1);
    expect(near(exit.x1 - exit.x0, 1.80)).toBe(true);
    expect(near(exit.d1 - exit.d0, 0.35)).toBe(true);
    expect(exit.h).toBe(2.15);
    expect(exit.double).toBe(true);
    const tech = STUDIO.doors.find((d) => d.id === 'tech');
    expect(tech.x0).toBe(R.x1);
    expect(near(tech.x1 - tech.x0, 0.45)).toBe(true);
    expect([tech.d0, tech.d1]).toEqual([-4.45, -3.40]);
    expect(near(tech.d1 - tech.d0, 1.05)).toBe(true);
    expect(tech.h).toBe(2.15);
  });

  it('дежурный свет: 12 точек (5 + 5 + 2), все в центрах столбцов панелей x ∈ {−1,22; 0; 1,22}', () => {
    const list = STUDIO.duty.list;
    expect(list).toHaveLength(12);
    expect(list.filter((p) => near(p.x, -1.22))).toHaveLength(5);
    expect(list.filter((p) => near(p.x, 1.22))).toHaveLength(5);
    expect(list.filter((p) => near(p.x, 0))).toHaveLength(2);
    expect(list.filter((p) => near(p.x, 0)).map((p) => p.d)).toEqual([-4.99, 1.21]);
  });

  it('элементы потолка (светильники, кассеты, диффузоры) не перекрываются друг с другом и с верхними фермами', () => {
    const items = ceilingItems();
    expect(items).toHaveLength(12 + 2 + 4);
    const R = STUDIO.room;
    for (const it of items) {
      expect(it.x0 >= R.x0 && it.x1 <= R.x1 && it.d0 >= STUDIO.canopy.d1 && it.d1 <= R.d1, JSON.stringify(it)).toBe(true);
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = [items[i].x0, items[i].x1, items[i].d0, items[i].d1];
        const b = [items[j].x0, items[j].x1, items[j].d0, items[j].d1];
        expect(overlap(a, b), `${items[i].kind}#${i} ↔ ${items[j].kind}#${j}`).toBe(false);
      }
    }
    const trusses = trussFootprints('upper');
    expect(trusses).toHaveLength(8);
    for (const it of items) {
      const a = [it.x0, it.x1, it.d0, it.d1];
      for (const tr of trusses) {
        expect(overlap(a, tr), `${it.kind} (${it.x0}..${it.x1}, ${it.d0}..${it.d1}) ↔ ферма ${JSON.stringify(tr)}`).toBe(false);
      }
    }
  });

  it('развес приборов в черновике пуст', () => {
    expect(FIXTURES).toEqual([]);
    expect(TYPES).toEqual({});
    expect(SPECS).toEqual({});
    expect(GROUPS).toEqual({});
    expect(GROUP_SETS).toEqual([]);
    expect(LIGHT_PLANS).toEqual({ full: [], lite: [] });
  });
});
