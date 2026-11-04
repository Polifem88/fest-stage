// Общий построитель квадратных ферм 30 × 30: линия и вертикальная вставка.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { trussLineTubes, trussPostTubes, LACE_PITCH } from '../../src/venues/_template/trusses.js';
import { buildTrusses } from '../../src/venues/fest-roof/build/trusses.js';

const T = { y0: 5.2, y1: 5.5, size: 0.3, tube: 0.05, brace: 0.016 };
const bbox = (gs) => {
  const b = new THREE.Box3();
  for (const g of gs) { g.computeBoundingBox(); b.union(g.boundingBox); }
  return b;
};
const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshBasicMaterial({ name: String(p) })) });
const triCount = (group) => {
  let n = 0;
  group?.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; });
  return n;
};

describe('Общий построитель ферм 30 × 30', () => {
  it('линия вдоль X: 4 пояса на телефоне, решётка на компьютере, габарит по сечению', () => {
    const l = { axis: 'd', at: -0.7, a0: -2.55, a1: 2.55 };
    expect(trussLineTubes(l, T, { mobile: true })).toHaveLength(4);
    const n = Math.round(5.1 / LACE_PITCH);
    expect(trussLineTubes(l, T)).toHaveLength(4 + 4 * n + 8);
    const b = bbox(trussLineTubes(l, T));
    expect(b.min.y).toBeCloseTo(5.2, 3);
    expect(b.max.y).toBeCloseTo(5.5, 3);
    expect(-b.max.z).toBeCloseTo(-0.85, 3);
    expect(-b.min.z).toBeCloseTo(-0.55, 3); // z = −d
  });

  it('вставка от y0 до y1 не выходит за свои отметки', () => {
    const bMob = bbox(trussPostTubes({ x: -2.7, d: -7.55, y0: 3.55, y1: 5.2 }, T, { mobile: true }));
    expect(bMob.min.y).toBeCloseTo(3.55, 3);
    expect(bMob.max.y).toBeCloseTo(5.2, 3);
    const bDesk = bbox(trussPostTubes({ x: -2.7, d: -7.55, y0: 3.55, y1: 5.2 }, T));
    expect(bDesk.min.y).toBeGreaterThanOrEqual(3.55 - T.brace / 2);
    expect(bDesk.max.y).toBeLessThanOrEqual(5.2 + T.brace / 2);
  });

  it('Сцена под крышей: число треугольников ферм не изменилось', () => {
    const run = (mobile) => {
      const batch = new StaticBatch();
      buildTrusses(batch, fakeM(), { mobile });
      return triCount(batch.build().trusses);
    };
    expect(run(false)).toBe(26188);
    expect(run(true)).toBe(1140);
  });
});
