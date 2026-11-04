// Студия мультимедиа: геометрия помещения, циклорамы, ферм, потолка и сборка.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch, rect } from '../../src/core/geom.js';
import { STUDIO, ceilingItems, trussFootprints } from '../../src/venues/fest-studio/config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS } from '../../src/venues/fest-studio/config/fixtures.js';
import { panelUV } from '../../src/venues/fest-studio/build/panels.js';
import { buildArchitecture } from '../../src/venues/fest-studio/build/architecture.js';
import { cycPatches, buildCyclorama, FLOOR_LIFT } from '../../src/venues/fest-studio/build/cyclorama.js';

const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshBasicMaterial({ name: String(p) })) });
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

function meshArea(mesh) {
  const pos = mesh.geometry.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    sum += ab.cross(ac).length() * 0.5;
  }
  return sum;
}

describe('Студия · архитектура и панели', () => {
  it('buildArchitecture: слои walls и ceiling, без NaN, все вершины в пределах коробки с нишами', () => {
    const batch = new StaticBatch();
    buildArchitecture(batch, fakeM());
    const L = batch.build();
    expect(L.walls).toBeTruthy();
    expect(L.ceiling).toBeTruthy();
    for (const k of ['walls', 'ceiling']) {
      L[k].traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position;
        expect(p.count).toBeGreaterThan(0);
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), d = -p.getZ(i);
          expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(d)).toBe(true);
          expect(x >= -3.05 - 1e-5 && x <= 3.50 + 1e-5, `${o.name} x=${x}`).toBe(true);
          expect(d >= -8.95 - 1e-5 && d <= 4.00 + 1e-5, `${o.name} d=${d}`).toBe(true);
          expect(y >= -1e-5 && y <= 5.65 + 1e-5, `${o.name} y=${y}`).toBe(true);
        }
      });
    }
  });

  it('panelUV: на поперечной стене x = −0,61 даёт целый u, y = 2,42 даёт v = 1; на продольной d = 4,00 − 1,22 даёт u = 1', () => {
    const g = panelUV(rect('d', 4.00, -0.61, 0.61, 0, 2.42, -1), { u0: -0.61, du: 1.22, v0: 0, dv: 2.42 });
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      if (near(pos.getX(i), -0.61)) expect(near(uv.getX(i), Math.round(uv.getX(i)))).toBe(true);
      if (near(pos.getY(i), 2.42)) expect(near(uv.getY(i), 1)).toBe(true);
    }
    const gx = panelUV(rect('x', -3.05, 4.00 - 1.22, 4.00, 0, 2.42, 1), { u0: -4.00, du: 1.22, v0: 0, dv: 2.42 });
    const px = gx.attributes.position, uvx = gx.attributes.uv;
    for (let i = 0; i < px.count; i++) {
      if (near(-px.getZ(i), 4.00 - 1.22)) expect(near(uvx.getX(i), 1)).toBe(true);
    }
  });

  it('в слое walls площадь полотен дверей (M.door) ≈ 1,80 × 2,15 + 1,05 × 2,15 (±2 %)', () => {
    const batch = new StaticBatch();
    buildArchitecture(batch, fakeM());
    const L = batch.build();
    let area = 0;
    L.walls.traverse((o) => {
      if (o.isMesh && o.material.name === 'door') area += meshArea(o);
    });
    const expected = 1.80 * 2.15 + 1.05 * 2.15;
    expect(Math.abs(area - expected) / expected).toBeLessThan(0.02);
  });
});

/**
 * Отклонение точки (x, y, d) от теоретической поверхности циклорамы
 * (плоские грани + четверти цилиндров R + две ⅛ сферы R в углах, пол поднят на FLOOR_LIFT).
 */
function cycSurfaceDeviation(x, y, d, c = STUDIO.cyc, lift = FLOOR_LIFT) {
  const r = c.r, ry = r - lift;
  const cx = x < c.x0 + r ? c.x0 + r : x > c.x1 - r ? c.x1 - r : x;
  const cd = d > c.d1 - r ? c.d1 - r : d;
  const cy = y < r ? r : y;
  const dx = (x - cx) / r;
  const dd = (d - cd) / r;
  const dy = y < r ? (r - y) / ry : 0;
  // На плоских участках одна из координат на границе (|dx|=1, dd=1 или dy=1), остальные = 0;
  // на дугах и сферах вектор (dx, dy, dd) имеет единичную длину (нормированный радиус = 1) -> масштаб * r.
  return Math.abs(Math.hypot(dx, dy, dd) - 1) * r;
}

describe('Студия · циклорама', () => {
  it('все вершины и середины рёбер cycPatches лежат на поверхности, в пределах габаритов, нормали — внутрь', () => {
    const c = STUDIO.cyc, arc = 16;
    const patches = cycPatches(c, { arc });
    expect(patches).toHaveLength(11);
    const maxChordErr = c.r * (1 - Math.cos(Math.PI / (4 * arc))) + 1e-6;
    const center = new THREE.Vector3(0, c.h / 2, -(c.d0 + c.d1) / 2);
    for (const g of patches) {
      const pos = g.attributes.position, nor = g.attributes.normal;
      expect(pos.count).toBeGreaterThan(0);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), d = -pos.getZ(i);
        expect(y >= FLOOR_LIFT - 1e-6 && y <= c.h + 1e-6).toBe(true);
        expect(d >= c.d0 - 1e-6 && d <= c.d1 + 1e-6).toBe(true);
        expect(Math.abs(x) <= c.x1 + 1e-6).toBe(true);
        expect(cycSurfaceDeviation(x, y, d, c)).toBeLessThanOrEqual(1e-6);
        // нормаль смотрит внутрь циклорамы
        const toCenter = center.clone().sub(new THREE.Vector3(x, y, -d));
        const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i));
        expect(n.dot(toCenter)).toBeGreaterThan(0);
      }
      // середины треугольников отклоняются не более чем на стрелку хорды дуги (в сферическом углу — по двум осям кривизны)
      for (let i = 0; i < pos.count; i += 3) {
        const mx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const my = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const md = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        expect(cycSurfaceDeviation(mx, my, md, c)).toBeLessThanOrEqual(maxChordErr * 2);
      }
    }
  });

  it('сумма площадей треугольников совпадает с аналитической площадью циклорамы (допуск 1 % при arc = 16)', () => {
    const c = STUDIO.cyc, r = c.r;
    const W = (c.x1 - c.x0) - 2 * r; // плоская ширина между дугами: 6,05 − 1,40 = 4,65
    const D = (c.d1 - c.d0) - r;     // плоская глубина боковых стенок: 3,975 − 0,70 = 3,275
    const H = c.h - r;               // плоская высота выше нижнего скругления: 3,90 − 0,70 = 3,20
    const flatArea = W * D + W * H + 2 * (D * H);
    const cylArea = (Math.PI * r / 2) * (W + 2 * D + 2 * H);
    const sphArea = Math.PI * r * r; // две ⅛ сферы (площадь сферы 4πr²) = 2 × (πr²/2) = πr²
    const analytic = flatArea + cylArea + sphArea;

    const batch = new StaticBatch();
    buildCyclorama(batch, fakeM(), { mobile: false });
    const L = batch.build();
    let meshSum = 0;
    L.cyc.traverse((o) => { if (o.isMesh) meshSum += meshArea(o); });
    expect(Math.abs(meshSum - analytic) / analytic).toBeLessThan(0.01);
  });

  it('кромки соседних участков совпадают: вершины на линии y = r у задней стенки и задней дуги идентичны', () => {
    const c = STUDIO.cyc;
    const patches = cycPatches(c, { arc: 16 });
    const key = (x, y, d) => `${x.toFixed(6)},${y.toFixed(6)},${d.toFixed(6)}`;
    // Находим заднюю стенку (все вершины d = d1, y >= r) и заднюю нижнюю дугу (x ∈ [x0+r, x1-r], y <= r, d >= d1-r)
    const ptsAtYr = (g) => {
      const pos = g.attributes.position, set = new Set();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), d = -pos.getZ(i);
        if (near(y, c.r, 1e-5) && near(d, c.d1, 1e-5)) set.add(key(x, y, d));
      }
      return [...set].sort();
    };
    const withSeam = patches.map(ptsAtYr).filter((a) => a.length >= 2);
    expect(withSeam).toHaveLength(2);
    expect(withSeam[0]).toEqual(withSeam[1]);
  });
});


