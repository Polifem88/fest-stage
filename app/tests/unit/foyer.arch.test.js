// Фойе (этап 1 — черновик): юнит-тесты архитектуры, потолков, витражей и ломаной лестницы.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { FOYER, foyerCeilY, foyerEndWallStepD } from '../../src/venues/fest-foyer/config/dimensions.js';
import { buildArchitecture } from '../../src/venues/fest-foyer/build/architecture.js';
import { buildStairs } from '../../src/venues/fest-foyer/build/stairs.js';
import { buildWindows } from '../../src/venues/fest-foyer/build/windows.js';

/** Материалы-заглушки (имя = ключ, с честным side как в core/materials.js). */
const fakeM = () =>
  new Proxy(
    {},
    {
      get: (t, p) => {
        const key = String(p);
        if (!t[key]) {
          const doubleSided = key === 'grilyato' || key === 'velvetOrange' || key === 'molton';
          t[key] = new THREE.MeshBasicMaterial({
            name: key,
            side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
          });
        }
        return t[key];
      },
    },
  );

const triCount = (group) => {
  let n = 0;
  group?.traverse((o) => {
    if (o.isMesh) n += o.geometry.attributes.position.count / 3;
  });
  return n;
};

const groupBox = (group) => {
  const b = new THREE.Box3();
  group?.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    b.union(o.geometry.boundingBox);
  });
  return b;
};

/** Проверка попадания 2D-точки (px, pd) внутрь треугольника (ax, ad)-(bx, bd)-(cx, cd). */
function pointInTri2D(px, pd, ax, ad, bx, bd, cx, cd) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, pd, ax, ad, bx, bd);
  const d2 = sign(px, pd, bx, bd, cx, cd);
  const d3 = sign(px, pd, cx, cd, ax, ad);
  const hasNeg = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
  const hasPos = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
  return !(hasNeg && hasPos);
}

describe('Фойе · архитектура и потолки (buildArchitecture)', () => {
  const build = (mobile = false) => {
    const batch = new StaticBatch();
    buildArchitecture(batch, fakeM(), { mobile });
    return batch.build();
  };

  it('строит непустые меши в слоях walls и ceiling без пустых геометрий', () => {
    const L = build();
    expect(Object.keys(L).sort()).toEqual(['ceiling', 'walls']);
    for (const k of ['walls', 'ceiling']) {
      expect(L[k].children.length, `слой ${k}`).toBeGreaterThan(0);
      L[k].traverse((o) => {
        if (o.isMesh) expect(o.geometry.attributes.position.count, o.name).toBeGreaterThan(0);
      });
    }
    const wallMats = new Set(L.walls.children.map((m) => m.material.name));
    for (const name of ['tileFloorDark', 'brickRed', 'plasterLight', 'grilyato', 'steelGray', 'steel', 'glass', 'door']) {
      expect(wallMats.has(name), `материал ${name} в walls`).toBe(true);
    }
    const ceilMats = new Set(L.ceiling.children.map((m) => m.material.name));
    expect(ceilMats.has('ceilPerfGray')).toBe(true);
  });

  it('Review Focus #2: каждый треугольник слоя ceiling направлен вниз (ny < -0.35) и односторонний (FrontSide)', () => {
    const L = build();
    let totalTris = 0;
    let rampTris = 0;
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();

    L.ceiling.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.material.side, `${o.name}: только FrontSide`).toBe(THREE.FrontSide);
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        va.fromBufferAttribute(pos, i);
        vb.fromBufferAttribute(pos, i + 1);
        vc.fromBufferAttribute(pos, i + 2);
        e1.subVectors(vb, va);
        e2.subVectors(vc, va);
        n.crossVectors(e1, e2).normalize();
        // Геометрическая нормаль (по порядку обхода вершин) и вершинная нормаль обе направлены вниз
        expect(n.y, `${o.name} tri #${i / 3} geometric ny`).toBeLessThan(-0.35);
        expect(nor.getY(i), `${o.name} tri #${i / 3} vertex ny`).toBeLessThan(-0.35);
        totalTris++;
        const midD = -(va.z + vb.z + vc.z) / 3;
        const midY = (va.y + vb.y + vc.y) / 3;
        if (midD > FOYER.ceil2.rampFromD && midD < FOYER.ceil2.rampToD && midY > FOYER.ceil2.atriumY) {
          rampTris++;
          // наклонная подшивка 4,10 → 5,03 (8,50 → 7,45) по разрезу 1-1 ТХ3: ny = −0,93 / √(0,93² + 1,05²)
          expect(n.y).toBeCloseTo(-0.6630, 3);
        }
      }
    });
    expect(totalTris).toBeGreaterThan(10);
    expect(rampTris, 'наклонная подшивка d = 4,10→5,03 присутствует в ceiling').toBeGreaterThanOrEqual(2);
  });

  it('перекрытие 2-го этажа (Y = 3,00) имеет точный трапециевидный вырез второго света и не перекрывает центр атриума', () => {
    const L = build();
    const floorHits = (px, pd) => {
      let hits = 0;
      L.walls.traverse((o) => {
        if (!o.isMesh || o.material.name !== 'tileFloorDark') return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          const y0 = pos.getY(i);
          const y1 = pos.getY(i + 1);
          const y2 = pos.getY(i + 2);
          if (
            Math.abs(y0 - FOYER.room.y2) > 0.02 ||
            Math.abs(y1 - FOYER.room.y2) > 0.02 ||
            Math.abs(y2 - FOYER.room.y2) > 0.02
          ) {
            continue;
          }
          if (
            pointInTri2D(
              px,
              pd,
              pos.getX(i),
              -pos.getZ(i),
              pos.getX(i + 1),
              -pos.getZ(i + 1),
              pos.getX(i + 2),
              -pos.getZ(i + 2),
            )
          ) {
            hits++;
          }
        }
      });
      return hits;
    };

    // Внутри проёма второго света (центр атриума и северная зона у кирпичной стены) — пусто
    expect(floorHits(-2, 10), 'центр атриума (-2, 10)').toBe(0);
    expect(floorHits(0, 8), 'атриум (0, 8)').toBe(0);
    expect(floorHits(-11, 8), 'север атриума (-11, 8)').toBe(0);

    // На полу 2-го этажа (оконная галерея, балкон экрана, галерея витрин, мостик буфета) — перекрыто
    expect(floorHits(0, 2), 'оконная галерея 2 эт.').toBeGreaterThan(0);
    expect(floorHits(8, 10), 'балкон экрана 2 эт.').toBeGreaterThan(0);
    expect(floorHits(0, 17), 'галерея витрин 2 эт.').toBeGreaterThan(0);
    expect(floorHits(-9, 15), 'мостик буфета 2 эт.').toBeGreaterThan(0);
  });

  it('B2: проход 1,15 м уходит коридором сквозь проём в белой стене d = 14,13 (кирпич / штукатурка / потолок 2,45 / молтон)', () => {
    const L = build();
    const P = FOYER.zones.passage;
    const R = FOYER.room;
    const tris = (grp, mat) => {
      const out = [];
      grp.traverse((o) => {
        if (!o.isMesh || o.material.name !== mat) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          out.push({
            x: (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
            y: (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
            d: -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
          });
        }
      });
      return out;
    };
    // Белая стена d = 14,13 не перекрывает проём прохода ниже 2,45
    const inHole = tris(L.walls, 'plasterLight').filter((c) =>
      Math.abs(c.d - R.dWhite1) < 0.02 && c.x > P.x0 + 0.02 && c.x < P.x1 - 0.02 && c.y < P.h - 0.02);
    expect(inHole, 'белая стена в проёме прохода').toHaveLength(0);
    // ... но есть над проёмом
    expect(tris(L.walls, 'plasterLight').some((c) => Math.abs(c.d - R.dWhite1) < 0.02 && c.x > P.x0 && c.x < P.x1 && c.y > P.h)).toBe(true);
    // Левая стенка коридора — кирпич на X = x0, правая — штукатурка на X = x1 (d = 14,13 … 16,00)
    const inCorr = (c) => c.d > R.dWhite1 && c.d < P.d1;
    expect(tris(L.walls, 'brickRed').some((c) => Math.abs(c.x - P.x0) < 0.01 && inCorr(c))).toBe(true);
    expect(tris(L.walls, 'plasterLight').some((c) => Math.abs(c.x - P.x1) < 0.01 && inCorr(c))).toBe(true);
    // Потолок коридора на 2,45 в слое ceiling
    expect(tris(L.ceiling, 'ceilPerfGray').some((c) => Math.abs(c.y - P.h) < 0.01 && inCorr(c) && c.x > P.x0 && c.x < P.x1)).toBe(true);
    // Чёрная штора в торце d = 16,00
    const molton = tris(L.walls, 'molton');
    expect(molton.length).toBeGreaterThan(0);
    for (const c of molton) {
      expect(Math.abs(c.d - P.d1)).toBeLessThan(0.06);
      expect(c.x).toBeGreaterThanOrEqual(P.x0 - 0.01);
      expect(c.x).toBeLessThanOrEqual(P.x1 + 0.01);
      expect(c.y).toBeLessThanOrEqual(P.h);
    }
  });

  it('C1: гардероб — грильято строго внутри контура, кремовые стены, короба противопожарных штор, без чёрной стены', () => {
    const L = build();
    const W = FOYER.zones.wardrobe;
    const C1 = FOYER.ceil1;
    const mats = new Set(L.walls.children.map((m) => m.material.name));
    expect(mats.has('blackWall'), 'старая чёрная стена гардероба').toBe(false);
    expect(mats.has('plasterCream')).toBe(true);

    const meshBox = (name) => {
      const b = new THREE.Box3();
      L.walls.traverse((o) => {
        if (o.isMesh && o.material.name === name) {
          o.geometry.computeBoundingBox();
          b.union(o.geometry.boundingBox);
        }
      });
      return b;
    };
    const g = meshBox('grilyato');
    expect(g.min.x).toBeCloseTo(W.x0, 3);
    expect(g.max.x).toBeCloseTo(W.x1, 3);
    expect(-g.max.z).toBeCloseTo(W.d0, 3);
    expect(-g.min.z).toBeCloseTo(W.d1, 3);
    expect(g.min.y).toBeCloseTo(C1.wardrobeGrilyato, 3);

    const cream = meshBox('plasterCream');
    expect(cream.min.x).toBeCloseTo(W.armD.x0, 2);
    expect(cream.max.x).toBeLessThanOrEqual(W.x1 + 1e-4);
    expect(cream.max.x).toBeGreaterThanOrEqual(W.x1 - 0.02);
    expect(-cream.min.z).toBeCloseTo(W.d1, 2);
    expect(-cream.max.z).toBeCloseTo(W.d0, 2);

    // Короба противопожарных штор Y = 2,35..2,65 (steelGray) над обоими плечами стойки
    const fire = [];
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'steelGray') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        if (y > C1.wardrobeGrilyato - 0.01 && y < C1.wardrobeSlab + 0.01) {
          fire.push({ x: (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, d: -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 });
        }
      }
    });
    expect(fire.some((c) => c.x < W.x0 && c.d > W.armD.d0 && c.d < W.armD.d1), 'короб над плечом по d').toBe(true);
    expect(fire.some((c) => c.x > W.x0 && c.d < W.armX.d0), 'короб над плечом по X').toBe(true);
    // короб не проходит сквозь колонну К1-Б
    const kb = FOYER.columns.extraB;
    expect(fire.some((c) => c.x > kb.x0 + 0.01 && c.x < kb.x1 - 0.01 && c.d > kb.d0 && c.d < kb.d1)).toBe(false);
  });

  it('C1: рамы вешалок развёрнуты вдоль d и стоят внутри гардероба', () => {
    const L = build();
    const W = FOYER.zones.wardrobe;
    const tops = [];
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'steel') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getY(i) - W.rackH) < 1e-3) tops.push({ x: pos.getX(i), d: -pos.getZ(i) });
      }
    });
    for (const rx of W.rackRowsX) {
      const row = tops.filter((p) => Math.abs(p.x - rx) < 0.05);
      expect(row.length, `ряд X = ${rx}`).toBeGreaterThan(0);
      expect(Math.min(...row.map((p) => p.d))).toBeCloseTo(W.rackD0, 2);
      expect(Math.max(...row.map((p) => p.d))).toBeCloseTo(W.rackD1, 2);
    }
  });

  it('C4: белая стена d = 14,13 от X = −6,15 до 5,56 с проёмом правого коридора; коридор со светлыми стенками и потолком 2,45', () => {
    const L = build();
    const R = FOYER.room;
    const SC = FOYER.zones.sideCorridor;
    let maxX = -Infinity;
    const inHole = [];
    const sideWalls = [];
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'plasterLight') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const d = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        if (Math.abs(d - R.dWhite1) < 0.005) {
          maxX = Math.max(maxX, pos.getX(i), pos.getX(i + 1), pos.getX(i + 2));
          if (x > SC.x0 + 0.02 && x < SC.x1 - 0.02 && y < SC.h - 0.02) inHole.push({ x, y });
        }
        if (d > SC.d0 + 0.01 && d < SC.d1 - 0.01 && (Math.abs(x - SC.x0) < 0.005 || Math.abs(x - SC.x1) < 0.005)) sideWalls.push(x);
      }
    });
    expect(maxX).toBeCloseTo(R.whiteX1, 3);
    expect(inHole).toHaveLength(0);
    expect(sideWalls.some((x) => Math.abs(x - SC.x0) < 0.005)).toBe(true);
    expect(sideWalls.some((x) => Math.abs(x - SC.x1) < 0.005)).toBe(true);
    let ceil = false;
    L.ceiling.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const d = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        if (Math.abs(y - SC.h) < 0.005 && x > SC.x0 && x < SC.x1 && d > SC.d0 && d < SC.d1) ceil = true;
      }
    });
    expect(ceil, 'потолок правого коридора').toBe(true);
  });

  it('F1: кирпичные торцы — основная плоскость за линией уступа, расширенная (±0,30) — в оконной зоне', () => {
    const L = build();
    const R = FOYER.room;
    const S = FOYER.endWallStep;
    const planes = { [R.x0]: [], [S.xWin0]: [], [R.x1]: [], [S.xWin1]: [] };
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'brickRed') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const xs = [pos.getX(i), pos.getX(i + 1), pos.getX(i + 2)];
        if (Math.max(...xs) - Math.min(...xs) > 1e-4) continue; // только плоскости x = const
        for (const k of Object.keys(planes)) {
          if (Math.abs(xs[0] - Number(k)) < 1e-4) {
            planes[k].push({
              y: (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
              d: -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
            });
          }
        }
      }
    });
    for (const k of [S.xWin0, S.xWin1]) {
      expect(planes[k].length, `оконная плоскость X = ${k}`).toBeGreaterThan(0);
      for (const c of planes[k]) expect(c.d, `X = ${k}: (${c.d}; ${c.y})`).toBeLessThanOrEqual(foyerEndWallStepD(c.y) + 1e-3);
    }
    for (const k of [R.x0, R.x1]) {
      const main = planes[k].filter((c) => c.d < R.dWall2); // без стен коридоров
      expect(main.length, `основная плоскость X = ${k}`).toBeGreaterThan(0);
      for (const c of main) expect(c.d, `X = ${k}: (${c.d}; ${c.y})`).toBeGreaterThanOrEqual(foyerEndWallStepD(c.y) - 1e-3);
    }
  });

  it('F1: наклонная ступенька уступа 0,30 м (steelGray) от пола до потолка 8,50 вдоль d_step(Y)', () => {
    const L = build();
    const R = FOYER.room;
    const S = FOYER.endWallStep;
    let found0 = 0;
    let found1 = 0;
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'steelGray') return;
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        const pts = [0, 1, 2].map((k) => ({ x: pos.getX(i + k), y: pos.getY(i + k), d: -pos.getZ(i + k) }));
        const onLine = pts.every((p) => Math.abs(p.d - foyerEndWallStepD(p.y)) < 1e-3);
        if (!onLine || nor.getZ(i) <= 0.5) continue; // лицом к фасаду (−d)
        const ys = pts.map((p) => p.y);
        if (pts.every((p) => p.x >= S.xWin0 - 1e-4 && p.x <= R.x0 + 1e-4)) found0 += Math.max(...ys) > 8.49 && Math.min(...ys) < 0.01 ? 1 : 0.5;
        if (pts.every((p) => p.x >= R.x1 - 1e-4 && p.x <= S.xWin1 + 1e-4)) found1 += Math.max(...ys) > 8.49 && Math.min(...ys) < 0.01 ? 1 : 0.5;
      }
    });
    expect(found0, 'уступ торца И').toBeGreaterThanOrEqual(1);
    expect(found1, 'уступ торца А').toBeGreaterThanOrEqual(1);
  });

  it('F1: полы и потолки доведены до расширенных торцов в оконной зоне без щелей', () => {
    const L = build();
    const S = FOYER.endWallStep;
    const hits = (grp, mat, y, px, pd) => {
      let n = 0;
      grp.traverse((o) => {
        if (!o.isMesh || o.material.name !== mat) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          if ([0, 1, 2].some((k) => Math.abs(pos.getY(i + k) - y) > 0.01)) continue;
          if (pointInTri2D(px, pd, pos.getX(i), -pos.getZ(i), pos.getX(i + 1), -pos.getZ(i + 1), pos.getX(i + 2), -pos.getZ(i + 2))) n++;
        }
      });
      return n;
    };
    const xs = [S.xWin0 + 0.1, S.xWin1 - 0.1];
    for (const x of xs) {
      expect(hits(L.walls, 'tileFloorDark', 0, x, 1.0), `пол 1 эт. X = ${x}`).toBeGreaterThan(0);
      expect(hits(L.walls, 'tileFloorDark', 0, x, 3.2), `за уступом 1 эт. X = ${x}`).toBe(0);
      expect(hits(L.walls, 'tileFloorDark', FOYER.room.y2, x, 2.0), `пол 2 эт. X = ${x}`).toBeGreaterThan(0);
      expect(hits(L.walls, 'tileFloorDark', FOYER.room.y2, x, 3.6), `за уступом 2 эт. X = ${x}`).toBe(0);
      expect(hits(L.ceiling, 'ceilPerfGray', FOYER.ceil1.reception, x, 1.0), `потолок 1 эт. X = ${x}`).toBeGreaterThan(0);
      expect(hits(L.ceiling, 'ceilPerfGray', FOYER.ceil2.shelfY, x, 3.0), `потолок 2 эт. X = ${x}`).toBeGreaterThan(0);
    }
  });

  it('колонны, пилястры и стены не выходят выше линии потолка foyerCeilY(d)', () => {
    const L = build();
    let worst = -Infinity;
    L.walls.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const d = -pos.getZ(i);
        if (d < FOYER.room.dGlass2 - 0.05 || d > FOYER.room.dWall2 + 0.05) continue;
        const cap = foyerCeilY(Math.max(FOYER.room.dGlass2, Math.min(FOYER.room.dWall2, d)));
        worst = Math.max(worst, y - cap);
      }
    });
    expect(worst).toBeLessThanOrEqual(0.02);
  });
});

describe('Фойе · ломаная лестница, малая лестница и ограждения ОГ-2 (buildStairs)', () => {
  const build = (mobile = false) => {
    const batch = new StaticBatch();
    buildStairs(batch, fakeM(), { mobile });
    return batch.build();
  };

  it('генерирует геометрию строго в слое stairs без пустых геометрий, Y ∈ [0, 4.85]', () => {
    const L = build(false);
    expect(Object.keys(L)).toEqual(['stairs']);
    L.stairs.traverse((o) => {
      if (o.isMesh) expect(o.geometry.attributes.position.count, o.name).toBeGreaterThan(0);
    });
    const mats = new Set(L.stairs.children.map((m) => m.material.name));
    for (const name of ['tileFloorDark', 'steel', 'brass', 'plasterLight']) {
      expect(mats.has(name), `материал ${name} в stairs`).toBe(true);
    }
    const b = groupBox(L.stairs);
    expect(b.min.y).toBeCloseTo(0, 2);
    expect(b.max.y).toBeGreaterThanOrEqual(FOYER.smallStairs.y1 + FOYER.railing.h - 0.02);
    expect(b.max.y).toBeLessThanOrEqual(4.85);
  });

  it('Review Focus #3: 13 нижних + 9 верхних ступеней парадной лестницы + 5 ступеней малой лестницы', () => {
    const L = build(false);
    // Собираем уникальные отметки верхних горизонтальных граней тёмных ступеней (ny > 0.9)
    const treadYs = new Set();
    L.stairs.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'tileFloorDark') return;
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        if (nor.getY(i) > 0.9) {
          treadYs.add(Number(pos.getY(i).toFixed(3)));
        }
      }
    });
    // 13 нижних (последняя = 1.750, совпадает с площадкой), 9 верхних (последняя = 3.000), 5 малых (последняя = 3.840)
    // Итого уникальных отметок: 13 + 9 + 5 = 27!
    expect(treadYs.size).toBe(FOYER.stairs.lower.risers + FOYER.stairs.upper.risers + FOYER.smallStairs.risers);
    expect(treadYs.has(Number(FOYER.stairs.landingY.toFixed(3)))).toBe(true);
    expect(treadYs.has(Number(FOYER.room.y2.toFixed(3)))).toBe(true);
    expect(treadYs.has(Number(FOYER.smallStairs.y1.toFixed(3)))).toBe(true);
  });

  it('под верхним маршем остаётся открытый проход 1,15 м за кирпичным столбом буфета', () => {
    const L = build(false);
    const p = FOYER.zones.passage;
    let blocking = 0;
    L.stairs.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const mx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const my = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const md = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        // Проход x ∈ (-5.90, -4.85), d ∈ (12.0, 13.9), y < 1.90 должен быть свободен
        if (mx > p.x0 + 0.05 && mx < p.x1 - 0.05 && md > 12.0 && md < 13.9 && my < 1.90) {
          blocking++;
        }
      }
    });
    expect(blocking).toBe(0);
  });

  /** Центры треугольников слоя stairs с заданным материалом. */
  const triCenters = (L, matName) => {
    const out = [];
    L.stairs.traverse((o) => {
      if (!o.isMesh || (matName && o.material.name !== matName)) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        out.push({
          x: (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
          y: (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
          d: -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
          mat: o.material.name,
        });
      }
    });
    return out;
  };

  it('B1: под площадкой и верхним маршем нет сплошных светлых тел — только тонкая подшивка и молтон кладовой', () => {
    const L = build(false);
    const S = FOYER.stairs;
    // Внутренний объём под площадкой (Y 0,2 … 1,2) и под верхним маршем у площадки — пуст, кроме молтона
    const inside = triCenters(L).filter((c) =>
      c.mat !== 'molton' && c.y > 0.2 && c.y < 1.2 && c.x > -4.60 && c.x < -2.0 && c.d > 11.7 && c.d < 13.6);
    expect(inside, 'тела в кладовой').toHaveLength(0);
    // Тонкая светлая подшивка под площадкой: низ на landingY − TREAD_CAP − slabThick
    const ySoffit = S.landingY - 0.05 - S.slabThick;
    const soffit = triCenters(L, 'plasterLight').filter((c) =>
      Math.abs(c.y - ySoffit) < 0.01 && c.x > -3.6 && c.x < -2.0 && c.d > 11.6 && c.d < 13.4);
    expect(soffit.length, 'подшивка площадки').toBeGreaterThan(0);
  });

  it('B1: молтон кладовой — по правой границе прохода X = −4,79 и по задней кромке площадки, от пола до подшивки', () => {
    const L = build(false);
    const U = FOYER.stairs.underStorage;
    const molton = triCenters(L, 'molton');
    expect(molton.length).toBeGreaterThan(0);
    const side = molton.filter((c) => Math.abs(c.x - U.side[0][0]) < 0.06);
    expect(side.length, 'молтон по X = −4,79').toBeGreaterThan(0);
    for (const c of side) {
      expect(c.d).toBeGreaterThanOrEqual(U.side[0][1] - 0.01);
      expect(c.d).toBeLessThanOrEqual(U.side[1][1] + 0.01);
    }
    const [[bx0, bd0], [bx1, bd1]] = U.back;
    const back = molton.filter((c) => c.x > bx0 + 0.1 && c.x < bx1 - 0.1);
    expect(back.length, 'молтон по задней кромке площадки').toBeGreaterThan(0);
    for (const c of back) {
      const t = (c.x - bx0) / (bx1 - bx0);
      expect(Math.abs(c.d - (bd0 + (bd1 - bd0) * t))).toBeLessThan(0.06);
      expect(c.y).toBeLessThan(FOYER.stairs.landingY - 0.05 - FOYER.stairs.slabThick);
    }
    let maxY = -Infinity;
    L.stairs.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'molton') return;
      o.geometry.computeBoundingBox();
      maxY = Math.max(maxY, o.geometry.boundingBox.max.y);
      expect(o.geometry.boundingBox.min.y).toBeCloseTo(0, 3);
    });
    expect(maxY).toBeLessThan(FOYER.room.y2 - 0.3);
  });

  it('B3: ступени — тёмный корпус (booth) + накладка проступи (tileFloorDark); у перил нет нижней связки', () => {
    const L = build(false);
    const mats = new Set(L.stairs.children.map((m) => m.material.name));
    expect(mats.has('booth')).toBe(true);
    // Нижняя связка балясин была на 0,08 м над полом 2-го этажа вдоль западной кромки атриума
    const lowRail = triCenters(L, 'steel').filter((c) =>
      c.y > FOYER.room.y2 + 0.04 && c.y < FOYER.room.y2 + 0.12 && c.d > 5.5 && c.d < 5.8 && c.x > -9 && c.x < 2);
    expect(lowRail, 'нижняя горизонтальная связка').toHaveLength(0);
  });

  it('D1: малая лестница — площадка у x1 (у стойки С-1), ступени растут от x0, корпус тёмный', () => {
    const L = build(false);
    const SS = FOYER.smallStairs;
    const landX0 = SS.x1 - SS.landingW;
    const treadTops = [];
    let lightBody = 0;
    let darkBody = 0;
    L.stairs.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const d = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        if (d < SS.d0 || d > SS.d1 || x < SS.x0 || x > SS.x1 || y < SS.y0 || y > SS.y1 + 0.01) continue;
        if (o.material.name === 'tileFloorDark' && nor.getY(i) > 0.9) treadTops.push({ x, y });
        if (o.material.name === 'plasterLight') lightBody++;
        if (o.material.name === 'steelGray') darkBody++;
      }
    });
    expect(lightBody, 'белый цоколь малой лестницы').toBe(0);
    expect(darkBody).toBeGreaterThan(0);
    // площадка на +X-конце
    const land = treadTops.filter((t) => Math.abs(t.y - SS.y1) < 1e-3 && t.x > landX0);
    expect(land.length).toBeGreaterThan(0);
    // ступени ниже площадки растут с ростом X
    const steps = treadTops.filter((t) => t.y < SS.y1 - 1e-3).sort((a, b) => a.x - b.x);
    expect(steps.length).toBeGreaterThan(0);
    for (let i = 1; i < steps.length; i++) expect(steps[i].y).toBeGreaterThanOrEqual(steps[i - 1].y - 1e-6);
    expect(Math.max(...steps.map((t) => t.x))).toBeLessThan(landX0);
  });

  it('D1: дверь операторской на стене витрин стоит над площадкой малой лестницы (у x1)', () => {
    const batch = new StaticBatch();
    buildArchitecture(batch, fakeM(), { mobile: false });
    const L = batch.build();
    const SS = FOYER.smallStairs;
    const landX0 = SS.x1 - SS.landingW;
    let found = false;
    L.walls.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'door') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const d = -pos.getZ(i);
        if (Math.abs(d - (FOYER.room.dWall2 - 0.025)) < 0.01 && Math.abs(pos.getY(i) - SS.y1) < 1e-3) {
          if (pos.getX(i) > landX0 - 1e-3 && pos.getX(i) < SS.x1 + 1e-3) found = true;
          else expect(pos.getX(i), 'дверь вне площадки').toBeGreaterThan(landX0);
        }
      }
    });
    expect(found).toBe(true);
  });

  it('Review Focus #1: mobile-сборка лестницы и перил экономична (mobile < desktop * 0.65 и mobile < 45 000 tris)', () => {
    const desktopTris = triCount(build(false).stairs);
    const mobileTris = triCount(build(true).stairs);
    expect(desktopTris).toBeGreaterThan(2000);
    expect(mobileTris).toBeLessThan(desktopTris * 0.65);
    expect(mobileTris).toBeLessThan(45_000);
  });
});

describe('Фойе · панорамные витражи, тамбур и торцевые окна (buildWindows)', () => {
  const build = (mobile = false) => {
    const batch = new StaticBatch();
    buildWindows(batch, fakeM(), { mobile });
    return batch.build();
  };

  it('строит витражи строго в слое windows в пределах d ∈ [-0.85, 2.75] и Y ∈ [0, 9.20]', () => {
    const L = build(false);
    expect(Object.keys(L)).toEqual(['windows']);
    L.windows.traverse((o) => {
      if (o.isMesh) expect(o.geometry.attributes.position.count, o.name).toBeGreaterThan(0);
    });
    const mats = new Set(L.windows.children.map((m) => m.material.name));
    for (const name of ['steel', 'glass', 'steelGray']) {
      expect(mats.has(name), `материал ${name} в windows`).toBe(true);
    }
    const b = groupBox(L.windows);
    const minD = -b.max.z;
    const maxD = -b.min.z;
    expect(b.min.y).toBeCloseTo(0, 2);
    expect(b.max.y).toBeCloseTo(FOYER.windows.vb3.y1, 2);
    expect(minD).toBeGreaterThanOrEqual(-0.85);
    expect(maxD).toBeLessThanOrEqual(2.75);
    // окна ОК16* стоят в плоскостях расширенных торцов (±0,30 м)
    expect(b.min.x).toBeCloseTo(FOYER.endWallStep.xWin0, 3);
    expect(b.max.x).toBeCloseTo(FOYER.endWallStep.xWin1, 3);
  });

  it('M9: ВБ3 — рёбра до d = −0,55, подоконная полка 3,90..3,95 и ригели 5,05..5,10 / 9,15..9,20 глубиной 0,12', () => {
    const L = build(false);
    const V = FOYER.windows.vb3;
    const verts = [];
    L.windows.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'steel') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) verts.push({ x: pos.getX(i), y: pos.getY(i), d: -pos.getZ(i) });
    });
    const has = (y, d) => verts.some((v) => Math.abs(v.y - y) < 1e-3 && Math.abs(v.d - d) < 1e-3 && v.x > V.x0 && v.x < V.x1);
    // рёбра-импосты: глубина 0,25 от стекла внутрь галереи на всю высоту витража
    const ribEnd = verts.filter((v) => Math.abs(v.d - (V.d + V.ribDepth)) < 1e-3 && v.y > V.y0 && v.y < V.y1);
    expect(ribEnd.length, 'торцы рёбер на d = −0,55').toBeGreaterThan(20);
    expect(verts.every((v) => v.d <= V.d + V.ribDepth + 1e-3 || v.d > 0 - 0.1)).toBe(true);
    for (const p of [V.sill, ...V.rails]) {
      expect(has(p.y0, V.d + p.depth), `низ ${p.y0}`).toBe(true);
      expect(has(p.y1, V.d + p.depth), `верх ${p.y1}`).toBe(true);
    }
    // кассеты рулонных штор под нижним и верхним ригелем (steelGray)
    const blinds = [];
    L.windows.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'steelGray') return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) blinds.push(pos.getY(i));
    });
    for (const r of V.rails) expect(blinds.some((y) => Math.abs(y - r.y0) < 1e-3), `кассета у ${r.y0}`).toBe(true);
  });

  it('все три построителя совместимы с EdgesGeometry (режим чертежа +bp без пустых мешей)', () => {
    const batch = new StaticBatch();
    const M = fakeM();
    buildArchitecture(batch, M, { mobile: false });
    buildStairs(batch, M, { mobile: false });
    buildWindows(batch, M, { mobile: false });
    const L = batch.build();
    let meshCount = 0;
    for (const grp of Object.values(L)) {
      grp.traverse((o) => {
        if (!o.isMesh) return;
        meshCount++;
        const eg = new THREE.EdgesGeometry(o.geometry, 25);
        expect(eg.attributes.position.count, `EdgesGeometry(${o.name})`).toBeGreaterThan(0);
        eg.dispose();
      });
    }
    expect(meshCount).toBeGreaterThanOrEqual(12);
  });
});
