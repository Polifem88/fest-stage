// Сцена под крышей: геометрия помещения и конструкции, планировки зала, свет, сборка.
import { describe, it, expect, beforeAll } from 'vitest';
import { ROOF, insideRoom, wallEnds, CEIL_RECTS, OBSTACLES } from '../../src/venues/fest-roof/config/dimensions.js';
import { clipSegmentToRects } from '../../src/core/geom.js';
import { LAYOUTS, STOCK, SEAT_PITCH, placed, shiftRange, seatCount, rowsMax, CLEAR } from '../../src/venues/fest-roof/config/layouts.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, countByType, onTruss } from '../../src/venues/fest-roof/config/fixtures.js';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { buildArchitecture } from '../../src/venues/fest-roof/build/architecture.js';
import { buildTrusses } from '../../src/venues/fest-roof/build/trusses.js';
import { buildEmitters, buildMolton } from '../../src/venues/fest-roof/build/emitters.js';

/** Материалы-заглушки (имя = ключ), как в chamber.test.js. */
const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshBasicMaterial({ name: String(p) })) });
const triCount = (group) => { let n = 0; group?.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; };

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
    // венткороб 8.1 + 9: сегмент B и бок 8.1 — до 2,50, выше — ниша до плоскости стены 8
    expect(wall('8.1').h).toBe(2.5);
    expect(ROOF.walls.find((w) => w.id === '9' && w.part === 'B').h).toBe(2.5);
    expect(insideRoom(-1.5, -9.0, 3.0) && !insideRoom(-1.5, -9.0, 1.0)).toBe(true);
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

describe('Сцена под крышей · планировки зала', () => {
  const ids = LAYOUTS.map((l) => l.id);
  const all = (fn) => {
    for (const l of LAYOUTS) {
      const rm = rowsMax(l.id);
      for (let rows = Math.min(1, rm); rows <= rm; rows++) {
        const [s0, s1] = shiftRange(l.id, rows);
        for (let shift = s0; shift <= s1; shift++) fn({ id: l.id, rows, shift }, l);
      }
    }
  };
  const overlap = (a, b) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];
  const grow = ([x0, x1, d0, d1], e) => [x0 - e, x1 + e, d0 - e, d1 + e];
  const rectInRoom = ([x0, x1, d0, d1]) => {
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.02) pts.push([x0 + (x1 - x0) * t, d0], [x0 + (x1 - x0) * t, d1], [x0, d0 + (d1 - d0) * t], [x1, d0 + (d1 - d0) * t]);
    return pts.every(([x, d]) => insideRoom(x, d));
  };
  const footprints = (p) => [...p.rows.map((r) => [r.x0, r.x1, r.d0, r.d1]), ...p.pults.map((r) => [r.x0, r.x1, r.d0, r.d1])];

  it('порядок планировок (формат ссылки): std, empty, cross, crossRev, traverse, arena', () => {
    expect(ids).toEqual(['std', 'empty', 'cross', 'crossRev', 'traverse', 'arena']);
    expect(SEAT_PITCH).toBeCloseTo(10 / 18, 12);
  });
  it('места: std 90, empty 0, cross 90, crossRev 90, traverse 84, arena 82', () => {
    const full = (id) => seatCount({ id, rows: rowsMax(id), shift: 0 });
    expect(Object.fromEntries(ids.map((id) => [id, full(id)]))).toEqual({ std: 90, empty: 0, cross: 90, crossRev: 90, traverse: 84, arena: 82 });
    for (const id of ids) expect(placed({ id, rows: rowsMax(id), shift: 0 }).seats).toHaveLength(full(id));
  });
  it('инвентарь: станков ≤ 20, пультовых ≤ 2, стульев ≤ 90 — в каждой планировке', () => {
    const stands = { std: 20, empty: 0, cross: 20, crossRev: 20, traverse: 16, arena: 14 };
    for (const l of LAYOUTS) {
      const p = placed({ id: l.id, rows: rowsMax(l.id), shift: 0 });
      expect(p.stands.length, l.id).toBe(stands[l.id]);
      expect(p.stands.length).toBeLessThanOrEqual(STOCK.stands);
      expect(p.pults.length).toBeLessThanOrEqual(STOCK.pultStands);
      expect(p.seats.length).toBeLessThanOrEqual(STOCK.chairs);
    }
    expect(placed({ id: 'empty', rows: 0, shift: 0 }).pults, 'в «Пустом зале» пультов нет').toEqual([]);
  });
  it('станки 2×1, высоты из STOCK.heights; ряд 1 на полу', () => {
    all((st) => {
      const p = placed(st);
      for (const s of p.stands) {
        const a = s.x1 - s.x0, b = s.d1 - s.d0;
        expect([Math.min(a, b), Math.max(a, b)].map((v) => +v.toFixed(6)), st.id).toEqual([1, 2]);
        expect(STOCK.heights).toContain(s.h);
      }
      for (const r of p.rows) if (r.rank === 1) expect(r.h).toBe(0);
      for (const pu of p.pults) { expect(STOCK.heights).toContain(pu.h); expect(+((pu.x1 - pu.x0) * (pu.d1 - pu.d0)).toFixed(6)).toBe(2); }
      // места стоят на верхе станка своего ряда (или на полу)
      for (const s of p.seats) expect([0, ...STOCK.heights]).toContain(s.y);
    });
  });
  it(`зазор ≥ ${0.05} до всех преград — для каждой планировки, каждого rows 1..rowsMax и каждого сдвига из shiftRange`, () => {
    expect(CLEAR).toBe(0.05);
    all((st) => {
      for (const f of footprints(placed(st))) for (const o of OBSTACLES) expect(overlap(grow(f, CLEAR - 1e-9), o.r), `${JSON.stringify(st)} ↔ ${o.kind}`).toBe(false);
    });
  });
  it('все станки и места внутри помещения', () => {
    all((st) => {
      const p = placed(st);
      for (const f of footprints(p)) expect(rectInRoom(grow(f, CLEAR - 1e-9)), JSON.stringify(st)).toBe(true);
      for (const s of p.seats) expect(insideRoom(s.x, s.d)).toBe(true);
    });
  });
  it('shiftRange содержит 0; у std минимум 0 (мольтон); |шаг| ≤ 10', () => {
    for (const l of LAYOUTS) for (let rows = Math.min(1, rowsMax(l.id)); rows <= rowsMax(l.id); rows++) {
      const [a, b] = shiftRange(l.id, rows);
      expect(a <= 0 && b >= 0 && a >= -10 && b <= 10, `${l.id}/${rows}`).toBe(true);
    }
    expect(shiftRange('std', 5)[0]).toBe(0);
    expect(shiftRange('empty', 0), 'пустой зал не двигается').toEqual([0, 0]);
  });
  it('rows=2 у std оставляет ранги 1–2 (пол и 0,2), пульты на месте', () => {
    const p = placed({ id: 'std', rows: 2, shift: 0 });
    expect(p.rows.map((r) => r.h)).toEqual([0, 0.2]);
    expect(p.pults).toEqual(placed({ id: 'std', rows: 5, shift: 0 }).pults);
    expect(seatCount({ id: 'std', rows: 2, shift: 0 })).toBe(36);
  });
  it('сдвиг двигает весь зал (ряды и пульты) вдоль оси планировки на 0,5 за шаг', () => {
    const [, max] = shiftRange('std', 5);
    expect(max).toBeGreaterThan(0);
    const a = placed({ id: 'std', rows: 5, shift: 0 }), b = placed({ id: 'std', rows: 5, shift: 1 });
    expect(b.rows[0].d0 - a.rows[0].d0).toBeCloseTo(0.5, 9);
    expect(b.pults[0].d0 - a.pults[0].d0).toBeCloseTo(0.5, 9);
    expect(b.rows[0].x0).toBe(a.rows[0].x0);
  });
});

describe('Сцена под крышей · свет', () => {
  const byNo = (n) => FIXTURES.find((f) => String(f.no) === String(n));
  it('49 приборов по схеме цеха, состав по типам', () => {
    expect(FIXTURES).toHaveLength(49);
    expect(countByType()).toEqual({ FRESNEL100: 7, PROF100_CW: 9, PROF_RGB: 2, P7X40: 9, BEYE640: 9, RAVEN150: 4, COMPC500: 8, LEDPAR933: 1 });
  });
  it('номера уникальны и идут по порядку 1…29, 50…62, 101…109 (формат ссылки); №13 есть, 8 и 10 — Q400 RGBALC', () => {
    const nos = FIXTURES.map((f) => f.no);
    expect(new Set(nos).size).toBe(49);
    const want = [...Array.from({ length: 24 }, (_, i) => i + 1), 26, 28, 29, ...Array.from({ length: 13 }, (_, i) => i + 50), ...Array.from({ length: 9 }, (_, i) => i + 101)];
    expect(nos).toEqual(want.filter((n) => ![25, 27].includes(n)));
    expect(byNo(13)).toBeTruthy();
    expect(byNo(8).type).toBe('PROF_RGB');
    expect(byNo(10).type).toBe('PROF_RGB');
    expect(byNo(109).type).toBe('LEDPAR933');
  });
  it('координаты по схеме: № 1 (−3,43; 0), № 50 (−2,5; 0), № 58 (2,5; 5), № 104 (1,72; 2,5), № 109 (−5; −5,95)', () => {
    const at = (n) => [byNo(n).mount.x, byNo(n).mount.d];
    expect(at(1)).toEqual([-3.43, 0]);
    expect(at(50)).toEqual([-2.5, 0]);
    expect(at(52)).toEqual([2.5, 0]);
    expect(at(58)).toEqual([2.5, 5]);
    expect(at(104)).toEqual([1.72, 2.5]);
    expect(at(109)).toEqual([-5, -5.95]);
    expect(at(28)).toEqual([6.27, 2.5]);
  });
  it('каждое крепление — в 0,03 от нижнего пояса какой-либо линии ферм и внутри её пролёта; все on: null', () => {
    const T = ROOF.trusses;
    for (const f of FIXTURES) {
      expect(f.mount.on).toBeNull();
      expect(Math.abs(f.mount.y - T.y0), `№ ${f.no}: высота`).toBeLessThanOrEqual(0.03);
      const hit = T.lines.some((l) => (l.axis === 'd'
        ? Math.abs(f.mount.d - l.at) < 1e-9 && f.mount.x >= l.a0 - 1e-9 && f.mount.x <= l.a1 + 1e-9
        : Math.abs(f.mount.x - l.at) < 1e-9 && f.mount.d >= l.a0 - 1e-9 && f.mount.d <= l.a1 + 1e-9));
      expect(hit, `№ ${f.no} на ферме`).toBe(true);
    }
    expect(onTruss('П0', 1.5)).toEqual({ on: null, x: 1.5, y: T.y0 - 0.02, d: 0 });
  });
  it('каждая группа входит в набор; все типы есть в справочнике и паспортах', () => {
    const inSets = new Set(GROUP_SETS.flatMap((s) => s.groups));
    for (const g of Object.keys(GROUPS)) expect(inSets.has(g), g).toBe(true);
    for (const f of FIXTURES) { expect(TYPES[f.type], f.type).toBeTruthy(); expect(SPECS[f.type], f.type).toBeTruthy(); expect(GROUPS[f.group]).toBeTruthy(); }
    expect(Object.keys(GROUPS)).toEqual(['FRONT', 'SIDE_L', 'SIDE_R', 'FRESNEL', 'COMPC', 'BEYE', 'RAVEN', 'BACK', 'SIDE_WASH', 'STORAGE']);
  });
});

describe('Сцена под крышей · сборка', () => {
  const build = (mobile = false) => {
    const batch = new StaticBatch();
    const M = fakeM();
    buildArchitecture(batch, M, { mobile });
    buildTrusses(batch, M, { mobile });
    return batch.build();
  };
  /** Допустимая зона вершин: пол помещения, коридор, ниша над стеной 9 (выше 2,50). */
  const outside = (x, y, d) => {
    const zones = [...ROOF.rects, [ROOF.corridor.x0, ROOF.corridor.x1, ROOF.corridor.d0, ROOF.corridor.d1]];
    if (y > ROOF.vent9.y - 1e-6) zones.push([ROOF.vent9.x0, ROOF.vent9.x1, ROOF.vent9.d0, ROOF.vent9.d1]);
    return Math.min(...zones.map(([x0, x1, d0, d1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(d0 - d, 0, d - d1))));
  };
  const WALL_T = 0.1; // наружу — не больше толщины откоса/полузаделанной балки

  it('слои walls, ceiling, trusses; ни одна вершина не выходит за контур помещения больше чем на толщину стены', () => {
    const L = build();
    for (const k of ['walls', 'ceiling', 'trusses']) expect(L[k], k).toBeTruthy();
    let worst = 0, where = null;
    for (const k of ['walls', 'ceiling', 'trusses']) {
      L[k].traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), d = -p.getZ(i);
          const e = outside(x, y, d);
          if (e > worst) { worst = e; where = `${o.name} (${x.toFixed(2)}; ${y.toFixed(2)}; ${d.toFixed(2)})`; }
        }
      });
    }
    expect(worst, `дальше всех: ${where}`).toBeLessThanOrEqual(WALL_T + 1e-6);
    // и до потолка, не выше
    let maxY = 0;
    for (const k of ['walls', 'ceiling', 'trusses']) L[k].traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); maxY = Math.max(maxY, o.geometry.boundingBox.max.y); } });
    expect(maxY).toBeLessThanOrEqual(ROOF.room.ceiling + 1e-6);
  });

  it('стены: кирпич — рыжий (brickRed), чёрные — blackWall; настил потолка — deckRibbed', () => {
    const L = build();
    const mats = new Set();
    for (const k of ['walls', 'ceiling']) L[k].children.forEach((m) => mats.add(m.material.name));
    for (const m of ['brickRed', 'blackWall', 'deckRibbed', 'floor', 'door']) expect(mats.has(m), m).toBe(true);
  });

  it('20 куполов: светящиеся меши — прямые потомки groups.duty с userData.emitter = "duty"; house — пустая', () => {
    const em = buildEmitters(fakeM());
    expect(em.dutyPoints).toHaveLength(20);
    const glow = em.groups.duty.children.filter((m) => m.userData.emitter === 'duty');
    expect(glow.length).toBeGreaterThan(0);
    let deep = 0;
    em.groups.duty.traverse((o) => { if (o.userData.emitter && o.parent !== em.groups.duty) deep++; });
    expect(deep, 'светящиеся меши только прямые потомки').toBe(0);
    // у каждого купола есть светящийся диск
    for (const p of ROOF.domes.list) {
      const hit = glow.some((m) => { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) if (Math.hypot(a.getX(i) - p.x, -a.getZ(i) - p.d) <= ROOF.domes.r + 1e-6 && Math.abs(a.getY(i) - ROOF.domes.bottomY) < 0.05) return true; return false; });
      expect(hit, `купол (${p.x}; ${p.d})`).toBe(true);
    }
    expect(em.groups.house.children.filter((m) => m.userData.emitter)).toHaveLength(0);
  });

  it('мольтон: на d −5,15, от x −6,30 до 6,15, высота 3,45, двусторонний', () => {
    const M = fakeM();
    const m = buildMolton(M);
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    expect(b.min.x).toBeCloseTo(ROOF.molton.x0, 2);
    expect(b.max.x).toBeCloseTo(ROOF.molton.x1, 2);
    expect(b.max.y).toBeCloseTo(ROOF.molton.y1, 2);
    expect(Math.abs(-(b.min.z + b.max.z) / 2 - ROOF.molton.d)).toBeLessThan(0.1);
    expect(m.material.name).toBe('molton');
  });

  it('mobile: треугольников ферм меньше, чем на компьютере', () => {
    expect(triCount(build(true).trusses)).toBeLessThan(triCount(build(false).trusses));
  });

  it('конструкция под потолком без граней «вверх» — сверху (план, общий вид) не закрывает зал', () => {
    const L = build();
    const st = L.ceiling.children.find((m) => m.userData.tag === 'structure');
    const n = st.geometry.attributes.normal;
    let up = 0;
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.9) up++;
    expect(up).toBe(0);
    expect(n.count).toBeGreaterThan(0);
  });
});

describe('Сцена под крышей · паспорт, зал, пол пятен', () => {
  let roof, FLOOR, buildHall, validateVenue, CATALOG;
  beforeAll(async () => {
    roof = (await import('../../src/venues/fest-roof/index.js')).default;
    ({ FLOOR } = await import('../../src/venues/fest-roof/build/floor.js'));
    ({ buildHall } = await import('../../src/venues/fest-roof/build/hall.js'));
    ({ validateVenue } = await import('../../src/venues/contract.js'));
    ({ CATALOG } = await import('../../src/venues/catalog.js'));
  });
  const down = (x, d, y = 3.13) => [new THREE.Vector3(x, y, -d), new THREE.Vector3(0, -1, 0)];

  it('validateVenue(roof) — без ошибок', () => {
    expect(validateVenue(roof)).toEqual([]);
    expect(roof.id).toBe('roof');
    expect(roof.caps).toEqual({ rigging: false, counterweights: false, portable: false, duty: true, houseLight: false, layouts: true });
    expect(roof.layers.map((l) => l[0])).toEqual(['hall', 'walls', 'ceiling', 'trusses', 'lights', 'molton']);
    expect(Object.keys(roof.views)).toEqual(['overview', 'hall', 'booth', 'stageToHall', 'ceiling', 'storage', 'plan', 'section']);
    expect(roof.layouts.list.map((l) => [l.id, l.rowsMax])).toEqual([['std', 5], ['empty', 0], ['cross', 5], ['crossRev', 5], ['traverse', 3], ['arena', 3]]);
    expect(roof.layouts.default).toBe('std');
    expect(roof.texts.extraEquipment).toMatch(/Phoenix Wash 760z/);
  });
  it('meta.type/seats совпадают с catalog.js', () => {
    const e = CATALOG.find((c) => c.id === 'roof');
    expect(e.status).toBe(roof.status);
    expect(e.type).toBe(roof.meta.type);
    expect(e.seats).toBe(roof.meta.seats);
    expect(roof.meta.seats).toBe(90);
  });
  it('trace: луч вниз над станком h 0,8 std → y 0,8, zone 1; при empty → y 0, zone 0', () => {
    FLOOR.setLayout({ id: 'std', rows: 5, shift: 0 });
    let hit = FLOOR.trace(...down(0, -4.5));
    expect(hit.floor).toBe(true);
    expect(hit.point.y).toBeCloseTo(0.8, 6);
    expect(FLOOR.zone(hit.point)).toBe(1);
    hit = FLOOR.trace(...down(0, -0.5)); // ряд 1 — на полу
    expect(hit.point.y).toBeCloseTo(0, 6);
    expect(FLOOR.zone(hit.point)).toBe(0);
    FLOOR.setLayout({ id: 'empty', rows: 0, shift: 0 });
    hit = FLOOR.trace(...down(0, -4.5));
    expect(hit.point.y).toBeCloseTo(0, 6);
    expect(FLOOR.zone(hit.point)).toBe(0);
    FLOOR.setLayout({ id: 'std', rows: 5, shift: 0 });
  });
  it('trace: луч в стену не выходит за контур', () => {
    const dirs = [[1, -0.05, 0], [-1, -0.05, 0], [0, -0.05, 1], [0, -0.05, -1], [1, -0.1, 1], [-1, -0.02, -1]];
    for (const [x, y, z] of dirs) {
      const hit = FLOOR.trace(new THREE.Vector3(0.5, 3.1, -1), new THREE.Vector3(x, y, z).normalize());
      expect(hit.point, JSON.stringify([x, y, z])).toBeTruthy();
      const [px, pd] = [hit.point.x, -hit.point.z];
      const zones = [...ROOF.rects, [ROOF.corridor.x0, ROOF.corridor.x1, ROOF.corridor.d0, ROOF.corridor.d1]];
      expect(zones.some(([x0, x1, d0, d1]) => px >= x0 - 1e-6 && px <= x1 + 1e-6 && pd >= d0 - 1e-6 && pd <= d1 + 1e-6), `(${px}; ${pd})`).toBe(true);
    }
  });
  it('clip: уникальный ключ кэша шейдера pool-roof', () => {
    const mat = new THREE.MeshBasicMaterial();
    FLOOR.clip(mat);
    expect(mat.customProgramCacheKey()).toBe('pool-roof');
  });
  it('buildHall: число экземпляров стульев = seatCount для каждой планировки; мешей ≤ 8', () => {
    const M = fakeM();
    for (const l of LAYOUTS) for (let rows = Math.min(1, rowsMax(l.id)); rows <= rowsMax(l.id); rows++) {
      const st = { id: l.id, rows, shift: 0 };
      const g = buildHall(st, { M });
      const seats = g.children.find((c) => c.name === 'seatsFabric');
      expect(seats.count, JSON.stringify(st)).toBe(seatCount(st));
      let meshes = 0;
      g.traverse((o) => { if (o.isMesh) meshes++; });
      expect(meshes).toBeLessThanOrEqual(8);
      g.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) expect(o.geometry.attributes.position.count).toBeGreaterThan(0); });
    }
  });
});
