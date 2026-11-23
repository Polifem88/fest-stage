// Фойе (этап 1 — черновик): проверка системы алюминиевых ферм Q25/31
// (сетка, вертикальные опуски, наклонный участок, вертикальные стойки и Г-образный периметр).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { FOYER } from '../../src/venues/fest-foyer/config/dimensions.js';
import { angledTrussTubes, buildTrusses } from '../../src/venues/fest-foyer/build/trusses.js';

const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshBasicMaterial({ name: String(p) })) });

const triCount = (group) => {
  let n = 0;
  group?.traverse((o) => {
    if (o.isMesh) {
      const idx = o.geometry.index;
      n += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
    }
  });
  return n;
};

const geomsBBox = (geoms) => {
  const box = new THREE.Box3();
  for (const g of geoms) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  return box;
};

const groupBBox = (group) => {
  const box = new THREE.Box3();
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox);
    }
  });
  return box;
};

const hasVertexNear = (group, { x, y, d, tolX = 0.2, tolY = 0.2, tolD = 0.2 }) => {
  let found = false;
  group.traverse((o) => {
    if (found || !o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vd = -p.getZ(i);
      if (Math.abs(vx - x) <= tolX && Math.abs(vy - y) <= tolY && Math.abs(vd - d) <= tolD) {
        found = true;
        return;
      }
    }
  });
  return found;
};

describe('Фойе · система ферм Q25/31', () => {
  it('angledTrussTubes на наклонном участке галереи: 4 пояса на mobile, пояса + раскосы + торцы на desktop, габариты Y ∈ [6.00, 7.25] и d ∈ [14.10, 19.55]', () => {
    const T = FOYER.trusses;
    const p0 = [0.25, T.atriumY0, T.bendD]; // [0.25, 7.00, 14.10]
    const p1 = [0.25, T.wallY0, T.wallD];   // [0.25, 6.00, 19.55]

    const mob = angledTrussTubes(p0, p1, T, { mobile: true });
    const desk = angledTrussTubes(p0, p1, T, { mobile: false });

    expect(mob).toHaveLength(4);
    // 4 пояса + 4*n раскосов + 8 торцевых стоек
    expect(desk.length).toBeGreaterThan(4 + 8);

    // Проверка на mobile: каждый пояс — 6-гранный открытый цилиндр (12 треугольников)
    const mobTris = mob.reduce((acc, g) => acc + (g.index ? g.index.count / 3 : g.attributes.position.count / 3), 0);
    expect(mobTris).toBe(4 * 12);

    const bb = geomsBBox(desk);
    // Низ на p1 = 6.00, верх на p0 = 7.00 + 0.25 * cos(10.4°) ≈ 7.246
    expect(bb.min.y).toBeGreaterThanOrEqual(5.99);
    expect(bb.min.y).toBeLessThanOrEqual(6.02);
    expect(bb.max.y).toBeGreaterThanOrEqual(7.22);
    expect(bb.max.y).toBeLessThanOrEqual(7.26);

    // d = -z: от 14.10 до ~19.59 (с учётом ортогонального сечения 0.25 на уклоне)
    const minD = -bb.max.z;
    const maxD = -bb.min.z;
    expect(minD).toBeGreaterThanOrEqual(14.05);
    expect(minD).toBeLessThanOrEqual(14.12);
    expect(maxD).toBeGreaterThanOrEqual(19.53);
    expect(maxD).toBeLessThanOrEqual(19.62);

    // X центрирован вокруг 0.25 ± 0.125
    expect(bb.min.x).toBeCloseTo(0.25 - T.size / 2, 2);
    expect(bb.max.x).toBeCloseTo(0.25 + T.size / 2, 2);

    for (const g of [...mob, ...desk]) g.dispose();
  });

  it('angledTrussTubes на скошенном горизонтальном луче периметра держит Y ∈ [2.70, 2.95]', () => {
    const T = FOYER.trusses;
    const [[sx0, sd0], [sx1, sd1]] = T.perimeter.south;
    const tubes = angledTrussTubes([sx0, T.perimeter.y0, sd0], [sx1, T.perimeter.y0, sd1], T, { mobile: false });
    expect(tubes.length).toBeGreaterThan(12);
    const bb = geomsBBox(tubes);
    expect(bb.min.y).toBeCloseTo(2.70, 2);
    expect(bb.max.y).toBeCloseTo(2.95, 2);
    for (const g of tubes) g.dispose();
  });

  it('angledTrussTubes возвращает пустой массив на вырожденном сегменте нулевой длины', () => {
    expect(angledTrussTubes([0, 7, 10], [0, 7, 10], FOYER.trusses)).toEqual([]);
  });

  it('buildTrusses: строго слой trusses, материал M.trussAlu, габариты Y ∈ [2.70, 8.25] и X ∈ [-11.5, +11.5]', () => {
    const batch = new StaticBatch();
    const M = fakeM();
    buildTrusses(batch, M, { mobile: false });
    const layers = batch.build();

    expect(Object.keys(layers)).toEqual(['trusses']);
    const group = layers.trusses;
    expect(group.children.length).toBeGreaterThan(0);
    for (const mesh of group.children) {
      expect(mesh.material).toBe(M.trussAlu);
      expect(mesh.userData.tag).toBe('trusses');
    }

    const bb = groupBBox(group);
    expect(bb.min.y).toBeCloseTo(2.70, 2);
    expect(bb.max.y).toBeCloseTo(8.25, 2);
    expect(bb.min.x).toBeGreaterThanOrEqual(-11.5);
    expect(bb.min.x).toBeLessThanOrEqual(-11.35);
    expect(bb.max.x).toBeLessThanOrEqual(11.5);
    expect(bb.max.x).toBeGreaterThanOrEqual(11.35);
    // Глубина d = -z внутри помещения
    expect(-bb.max.z).toBeGreaterThanOrEqual(-0.2);
    expect(-bb.min.z).toBeLessThanOrEqual(FOYER.room.dWall2);
  });

  it('buildTrusses включает все конструктивные элементы: опуски, стойки С-1/С-2 + вынос, уклон, ФВ-2М и Г-периметр', () => {
    const batch = new StaticBatch();
    buildTrusses(batch, fakeM(), { mobile: true });
    const group = batch.build().trusses;
    const T = FOYER.trusses;

    // 6 вертикальных опусков на d = 5.70 (Y = 7.00..8.00)
    for (const x of T.transverseX) {
      expect(hasVertexNear(group, { x, y: 7.00, d: T.stepD, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), `опуск x=${x}`).toBe(true);
      expect(hasVertexNear(group, { x, y: 8.00, d: T.stepD, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), `верх опуска x=${x}`).toBe(true);
    }

    // Опорные стойки С-1 (x=-5, d=19.55, y=3..6) и С-2 (x=11.25, d=0.50, y=3..8) + вынос к [11.00, 8.00, 0.00]
    expect(hasVertexNear(group, { x: -5.00, y: 3.00, d: 19.55, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'С-1 низ').toBe(true);
    expect(hasVertexNear(group, { x: 11.25, y: 3.00, d: 0.50, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'С-2 низ').toBe(true);
    expect(hasVertexNear(group, { x: 11.25, y: 8.23, d: 0.50, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'С-2 вынос верх').toBe(true);

    // Периметральная Г-образная ферма (западный луч и южный скошенный луч)
    expect(hasVertexNear(group, { x: -10.25, y: 2.72, d: 5.98, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'ПФ-З').toBe(true);
    expect(hasVertexNear(group, { x: 2.68, y: 2.72, d: 14.00, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'ПФ-Ю конец').toBe(true);

    // ФВ-2М только на правой половине (x = 0.25..11.00, d = 9.00)
    expect(hasVertexNear(group, { x: 11.00, y: 7.02, d: 9.00, tolX: 0.15, tolY: 0.05, tolD: 0.15 }), 'ФВ-2М правый край').toBe(true);
    expect(hasVertexNear(group, { x: -2.50, y: 7.12, d: 9.00, tolX: 0.50, tolY: 0.20, tolD: 0.20 }), 'нет ФВ-2М на x < 0').toBe(false);
  });

  it('бюджет треугольников на mobile: mobileTris < 35 000 и строго меньше desktop', () => {
    const bDesk = new StaticBatch();
    buildTrusses(bDesk, fakeM(), { mobile: false });
    const desktopTris = triCount(bDesk.build().trusses);

    const bMob = new StaticBatch();
    buildTrusses(bMob, fakeM(), { mobile: true });
    const mobileTris = triCount(bMob.build().trusses);

    expect(mobileTris).toBeGreaterThan(0);
    expect(mobileTris).toBeLessThan(35_000);
    expect(mobileTris).toBeLessThan(desktopTris);
  });

  it('общий шаблон _template/trusses.js не модифицирован (паритет fest-roof и fest-studio)', () => {
    const repoRoot = resolve(__dirname, '../../..');
    const diff = execFileSync('git', ['diff', '--', 'app/src/venues/_template/trusses.js'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(diff.trim()).toBe('');
  });
});
