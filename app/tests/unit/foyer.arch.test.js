// Фойе (этап 1 — черновик): юнит-тесты архитектуры, потолков, витражей и ломаной лестницы.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { FOYER, foyerCeilY } from '../../src/venues/fest-foyer/config/dimensions.js';
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
    expect(b.min.x).toBeLessThanOrEqual(FOYER.room.x0 + 0.05);
    expect(b.max.x).toBeGreaterThanOrEqual(FOYER.room.x1 - 0.05);
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
