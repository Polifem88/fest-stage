// Сцена под крышей: геометрия помещения и конструкции, планировки зала, свет, сборка.
import { describe, it, expect } from 'vitest';
import { ROOF, insideRoom, wallEnds, CEIL_RECTS, OBSTACLES } from '../../src/venues/fest-roof/config/dimensions.js';
import { clipSegmentToRects } from '../../src/core/geom.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const wall = (id) => ROOF.walls.find((w) => w.id === id && !w.part);
const len = (w) => Math.abs(w.a1 - w.a0);
const segDist = ([px, pd], [ax, ad], [bx, bd]) => {
  const dx = bx - ax, dd = bd - ad;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pd - ad) * dd) / (dx * dx + dd * dd)));
  return Math.hypot(px - (ax + t * dx), pd - (ad + t * dd));
};
const lineEnds = (l) => (l.axis === 'x' ? [[l.at, l.a0], [l.at, l.a1]] : [[l.a0, l.at], [l.a1, l.at]]);

describe('Сцена под крышей · геометрия', () => {
  it('контур замкнут, углы 90°, ширина 14,60, глубина 17,40', () => {
    // обход по порядку стен: конец каждой совпадает с началом следующей (в любом направлении), с проёмом коридора
    const pts = [];
    let cur = null;
    const W = ROOF.walls;
    for (let i = 0; i < W.length; i++) {
      let [a, b] = wallEnds(W[i]);
      // ориентация по ближнему к предыдущему концу (перед стеной 13 — проём)
      if (cur && Math.hypot(b[0] - cur[0], b[1] - cur[1]) < Math.hypot(a[0] - cur[0], a[1] - cur[1])) [a, b] = [b, a];
      if (cur) {
        const gap = Math.hypot(a[0] - cur[0], a[1] - cur[1]);
        if (W[i].id === '13') {
          // перед стеной 13 — проём коридора 2,25 по той же линии
          expect(near(gap, ROOF.corridor.x1 - ROOF.corridor.x0), 'проём 2,25').toBe(true);
          expect(near(a[1], cur[1])).toBe(true);
        } else expect(gap, `стена ${W[i].id}${W[i].part ? ` (${W[i].part})` : ''} примыкает к предыдущей`).toBeLessThan(1e-6);
      }
      pts.push(a);
      cur = b;
    }
    const [s] = wallEnds(W[0]);
    expect(Math.hypot(cur[0] - s[0], cur[1] - s[1]), 'обход вернулся к началу').toBeLessThan(1e-6);
    for (const w of W) expect(['x', 'd']).toContain(w.axis); // только оси — углы 90°
    expect(near(ROOF.room.x1 - ROOF.room.x0, 14.6)).toBe(true);
    expect(near(ROOF.room.d1 - ROOF.room.d0, 17.4)).toBe(true);
  });

  it('цепочки стен: 1+13+проём = 5+7+8+9 = 14,60; 14+2+3+4+6+7.1 = 12+11+10+8.1 = 17,40', () => {
    const c = ROOF.corridor;
    const w9 = ROOF.walls.filter((w) => w.id === '9').reduce((s, w) => s + len(w), 0);
    expect(near(len(wall('1')) + len(wall('13')) + (c.x1 - c.x0), 14.6)).toBe(true);
    expect(near(len(wall('5')) + len(wall('7')) + len(wall('8')) + w9, 14.6)).toBe(true);
    const w11 = len(wall('11'));
    expect(near(len(wall('14')) + len(wall('2')) + len(wall('3')) + len(wall('4')) + len(wall('6')) + len(wall('7.1')), 17.4)).toBe(true);
    expect(near(len(wall('12')) + w11 + len(wall('10')) + len(wall('8.1')), 17.4)).toBe(true);
    expect(near(w9, 6.35) && near(len(wall('6')), 4.5)).toBe(true);
  });

  it('колонны: левые x 5,70 (грань 2,25 от стены 2), правые x −6,45; d 3,85 и −2,65; шаг 6,5', () => {
    const vis = ROOF.columns.filter((c) => !c.embedded);
    expect(vis).toHaveLength(4);
    expect(new Set(vis.map((c) => c.x))).toEqual(new Set([5.7, -6.45]));
    expect(new Set(vis.map((c) => c.d))).toEqual(new Set([3.85, -2.65]));
    expect(near(wall('2').at - (5.7 + 0.2), 2.25)).toBe(true);
    expect(near(wall('1').at - 3.85, 2.9)).toBe(true);
    const ds = [...new Set(ROOF.columns.map((c) => c.d))].sort((a, b) => a - b);
    for (let i = 1; i < ds.length; i++) expect(near(ds[i] - ds[i - 1], 6.5)).toBe(true);
  });

  it('фермы: зазор 0,10 до короба 11 (x −5,25) и до стены 13 (d 7,75); 7 поперечных и 5 продольных линий; добавка до x 7,35; обрубок d −2,5 до x 5,5; смещённая d −2,25', () => {
    const T = ROOF.trusses, s = T.size / 2;
    const main = T.lines.filter((l) => !l.extra);
    expect(main.filter((l) => l.axis === 'd')).toHaveLength(7);
    expect(main.filter((l) => l.axis === 'x')).toHaveLength(5);
    const minX = Math.min(...T.lines.flatMap((l) => (l.axis === 'x' ? [l.at] : [l.a0, l.a1])));
    expect(near(minX - s - ROOF.vent11.x1, 0.1)).toBe(true);
    const maxD = Math.max(...T.lines.flatMap((l) => (l.axis === 'd' ? [l.at] : [l.a0, l.a1])));
    expect(near(ROOF.room.d1 - (maxD + s), 0.1)).toBe(true);
    const ex = T.lines.filter((l) => l.extra);
    for (const d of [5, 2.5, 0]) expect(ex.some((l) => l.axis === 'd' && l.at === d && l.a0 === 5 && l.a1 === 7.35), `добавка d ${d}`).toBe(true);
    expect(ex.some((l) => l.axis === 'x' && l.at === 7.35)).toBe(true);
    const stub = ex.find((l) => l.axis === 'd' && l.at === -2.5);
    expect(stub.a1).toBe(5.5);
    expect(near(stub.a1, 5.7 - 0.2), 'обрубок упирается в грань колонны').toBe(true);
    const off = ex.find((l) => l.axis === 'd' && l.at === -2.25);
    expect([off.a0, off.a1]).toEqual([5.15, 7.35]);
    expect(off.at - s, 'смещённая проходит перед колонной').toBeGreaterThan(-2.65 + 0.2);
    expect(near(wall('3').at - (7.35 + s), 0.1), 'зазор до стены 3').toBe(true);
  });

  it('3 стойки: (7,35;5), (−5;−7,5), (−3,05;7,5)', () => {
    expect(ROOF.trusses.legs).toEqual([{ x: 7.35, d: 5 }, { x: -5, d: -7.5 }, { x: -3.05, d: 7.5 }]);
    // у стены 13: ось −3,05, ближняя грань −3,20 — в 1,0 от края проёма −4,20
    expect(near(-3.05 - ROOF.trusses.size / 2 - ROOF.corridor.x1, 1.0)).toBe(true);
  });

  it('20 куполов: внутри ячеек, ≥ 0,35 в плане от осей капитальных балок и диагоналей', () => {
    const D = ROOF.domes;
    expect(D.list).toHaveLength(20);
    const caps = ROOF.capital.lines.map(lineEnds);
    for (const p of D.list) {
      const dist = Math.min(...caps.map(([a, b]) => segDist([p.x, p.d], a, b)), ...ROOF.diagonals.bays.map(([a, b]) => segDist([p.x, p.d], a, b)));
      expect(dist, `купол (${p.x}; ${p.d})`).toBeGreaterThanOrEqual(D.clear - 1e-9);
      // внутри ячейки ферм 2,5 × 2,5 (не на линии) и в пределах сетки
      expect(Math.abs(p.x % 2.5)).toBeGreaterThan(D.r);
      expect(Math.abs(p.d % 2.5)).toBeGreaterThan(D.r);
      expect(p.x > -5 && p.x < 5 && p.d > -7.5 && p.d < 7.5).toBe(true);
    }
    // сдвиг только вдоль d, от исходного центра ячейки
    const xs = [-3.75, -1.25, 1.25, 3.75];
    expect(D.list.every((p) => xs.includes(p.x))).toBe(true);
  });

  it('все концы капитальных балок, диагоналей и ферм — внутри помещения (insideRoom)', () => {
    const hi = ROOF.capital.y0;
    for (const l of ROOF.capital.lines) {
      const [a, b] = lineEnds(l);
      const parts = clipSegmentToRects(a, b, CEIL_RECTS);
      expect(parts.length, `балка ${l.axis}=${l.at}`).toBeGreaterThan(0);
      for (const [p, q] of parts) { expect(insideRoom(...p, hi)).toBe(true); expect(insideRoom(...q, hi)).toBe(true); }
    }
    for (const [a, b] of ROOF.diagonals.bays) for (const [p, q] of clipSegmentToRects(a, b, CEIL_RECTS)) { expect(insideRoom(...p, hi)).toBe(true); expect(insideRoom(...q, hi)).toBe(true); }
    for (const l of ROOF.trusses.lines) for (const p of lineEnds(l)) expect(insideRoom(...p), `ферма ${l.id}`).toBe(true);
    for (const l of ROOF.trusses.legs) expect(insideRoom(l.x, l.d)).toBe(true);
    for (const p of ROOF.domes.list) expect(insideRoom(p.x, p.d)).toBe(true);
  });

  it('высоты: потолок 4,70; швеллеры 4,45–4,70; балки 3,45–4,45; фермы 3,15–3,45', () => {
    expect(ROOF.room.ceiling).toBe(4.7);
    expect([ROOF.channels.y0, ROOF.channels.y1]).toEqual([4.45, 4.7]);
    expect([ROOF.capital.y0, ROOF.capital.y1]).toEqual([3.45, 4.45]);
    expect([ROOF.trusses.y0, ROOF.trusses.y1]).toEqual([3.15, 3.45]);
    expect(ROOF.diagonals.y0).toBe(ROOF.capital.y0);
    expect(ROOF.vFrames.every((v) => v.topY === ROOF.capital.y0 && v.w === 0.15 && v.node.y === 2.5 && v.node.off === 1)).toBe(true);
  });

  it('контур пола: ≤ 8 прямоугольников, внутри габарита, площадь = площади многоугольника стен', () => {
    expect(ROOF.rects.length).toBeLessThanOrEqual(8);
    // площадь многоугольника по обходу (формула шнурования) против площади объединения (растр 5 см)
    const poly = [];
    let cur = null;
    for (const w of ROOF.walls) {
      let [a, b] = wallEnds(w);
      if (cur && Math.hypot(b[0] - cur[0], b[1] - cur[1]) < Math.hypot(a[0] - cur[0], a[1] - cur[1])) [a, b] = [b, a];
      if (cur && !(near(a[0], cur[0]) && near(a[1], cur[1]))) poly.push(cur); // проём коридора
      poly.push(a);
      cur = b;
    }
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; area += x1 * y2 - x2 * y1; }
    area = Math.abs(area) / 2;
    const h = 0.05;
    let n = 0;
    for (let x = ROOF.room.x0 + h / 2; x < ROOF.room.x1; x += h) for (let d = ROOF.room.d0 + h / 2; d < ROOF.room.d1; d += h) if (insideRoom(x, d)) n++;
    expect(Math.abs(n * h * h - area)).toBeLessThan(0.2);
  });

  it('преграды для зала: колонны, ноги V-косынок, стойки, цоколи, короб, двери, проём, мольтон', () => {
    const kinds = new Set(OBSTACLES.map((o) => o.kind.split(' ')[0]));
    for (const k of ['колонна', 'нога', 'стойка', 'цоколь', 'короб', 'дверь', 'проём', 'мольтон']) expect(kinds.has(k), k).toBe(true);
    // зоны дверей — внутри помещения
    for (const o of OBSTACLES.filter((x) => x.kind.startsWith('дверь'))) {
      const [x0, x1, d0, d1] = o.r;
      expect(insideRoom((x0 + x1) / 2, (d0 + d1) / 2), o.kind).toBe(true);
    }
  });
});
