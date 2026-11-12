import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { DIM, HALL_HALF, STEP_HALF_X, rowFrontD, rowBackD, rowFloorY } from '../../src/venues/fest-big/config/dimensions.js';
import { DUTY_ROWS } from '../../src/venues/fest-big/config/rigging.js';
import {
  HALL_CONTOUR_RIGHT,
  HALL_CEIL_SEGMENTS,
  hallLedCorners,
  hallFloorY,
  hallCanopyY,
  hallCeilingY,
  hallCeilingNiche,
  hallExitFlatRange,
  inHallFloor,
} from '../../src/venues/fest-big/config/hallGeometry.js';
import { buildArchitecture, buildSeats, buildEmitters } from '../../src/venues/fest-big/build/architecture.js';
import { ambientLights } from '../../src/venues/fest-big/build/ambient.js';
import { traceToFloor, clipPoolsToFloor } from '../../src/venues/fest-big/build/floor.js';
import { buildDims } from '../../src/venues/fest-big/build/overlays.js';
import bigVenue from '../../src/venues/fest-big/index.js';

describe('Большая сцена · геометрия зрительного зала (Патч 1, часть 2)', () => {
  it('верхняя ширина зала 16,0 м; проход 1,50 м от пика «ёлочки» до ступеней ±6,70 м под 26 креслами', () => {
    expect(DIM.hall.width).toBe(16.0);
    expect(HALL_HALF).toBe(8.0);
    expect(STEP_HALF_X).toBeCloseTo(6.7, 4);
    expect(HALL_HALF + DIM.hall.nicheMinDepth - STEP_HALF_X).toBeCloseTo(1.5, 4);
    expect(DIM.hall.seatWidth).toBeCloseTo(0.5123, 4);
    expect(DIM.hall.seatsPerRow * DIM.hall.rows).toBe(390);
  });

  it('ступени по 0,90 м с подъёмом 0,15 м; первая ступень в 2,45 м от авансцены; 15-я — до операторской', () => {
    expect(DIM.hall.rowPitch).toBe(0.9);
    expect(DIM.hall.stepRise).toBe(0.15);
    expect(-rowFrontD(1) - DIM.forestage.depth).toBeCloseTo(2.45, 6);
    expect(rowBackD(DIM.hall.rows - 1)).toBe(-18.0);
    expect(rowBackD(DIM.hall.rows - 1) - rowBackD(DIM.hall.rows - 2)).toBeCloseTo(-1.1, 6);
    for (let r = 1; r < DIM.hall.rows; r++) {
      expect(rowFloorY(r) - rowFloorY(r - 1)).toBeCloseTo(0.15, 6);
      expect(hallFloorY(rowFrontD(r) - 0.05, 0)).toBeCloseTo(rowFloorY(r), 6);
    }
    expect(rowFloorY(DIM.hall.rows - 1)).toBeCloseTo(1.35, 6);
    expect(hallFloorY(-17.95, 0)).toBeCloseTo(1.35, 6);
  });

  it('потолок: 6,10 у портала, 1,5 м горизонт, 5 × (0,6 наклон −0,2 + 2,4), большой наклон до 3,00 м над 15-м рядом', () => {
    const segs = HALL_CEIL_SEGMENTS;
    expect(segs.map((sg) => sg.kind).join(',')).toBe('front,slope,flat,slope,flat,slope,flat,slope,flat,slope,flat,back');
    expect(hallCeilingY(0)).toBeCloseTo(6.1, 6);
    expect(hallCeilingY(-1.5)).toBeCloseTo(6.1, 6);
    for (const sg of segs) {
      if (sg.kind === 'slope') {
        expect(sg.arc1 - sg.arc0).toBeCloseTo(0.6, 6); // ровно 1 полоса панелей 0,6 м
        expect(sg.y0 - sg.y1).toBeCloseTo(0.2, 6);
        expect(sg.arc0 / 0.6).toBeCloseTo(Math.round(sg.arc0 / 0.6), 6); // наклоны не режут панели
      }
      if (sg.kind === 'flat') {
        expect(sg.arc1 - sg.arc0).toBeCloseTo(2.4, 6); // ровно 4 полосы
        expect(sg.y0).toBeCloseTo(sg.y1, 6);
      }
    }
    expect(segs.at(-1).d1).toBe(-18.0);
    expect(hallCeilingY(-18.0) - rowFloorY(DIM.hall.rows - 1)).toBeCloseTo(3.0, 6);
    // монотонно вниз от портала к операторской
    for (let d = 0; d > -18; d -= 0.1) expect(hallCeilingY(d - 0.1)).toBeLessThanOrEqual(hallCeilingY(d) + 1e-9);
    // ниши мостов — в наклонах № 2 и № 4; мосты над потолком, фермы ДО — вплотную под ним
    for (const key of ['bridge1', 'bridge2']) {
      const br = DIM.hallRig[key];
      const n = hallCeilingNiche(br.niche);
      expect(br.d).toBeLessThan(n.dA);
      expect(br.d).toBeGreaterThan(n.backD);
      expect(br.y).toBeGreaterThan(hallCeilingY(br.d));
      expect(br.y).toBeLessThan(n.topY);
    }
    for (const t of DIM.hallRig.dutyTrusses.list) {
      expect(t.y + DIM.hallRig.dutyTrusses.size / 2).toBeCloseTo(hallCeilingY(t.d), 6);
    }
  });

  it('контур нижних стен, ёлочки, кишок и операторской замыкается без невязки', () => {
    const byId = Object.fromEntries(HALL_CONTOUR_RIGHT.map((p) => [p.id, p]));
    expect(byId.P0).toMatchObject({ x: 8.2, d: 0 });
    expect(Math.hypot(byId.P1.x - byId.P0.x, byId.P1.d - byId.P0.d)).toBeCloseTo(1.75, 4);
    expect(byId.Z0.x).toBeCloseTo(8.2, 4);
    expect(byId.Z0.d).toBeCloseTo(-2.3, 4);
    for (let k = 1; k <= 4; k++) {
      const zPrev = byId[`Z${k - 1}`], v = byId[`V${k}`], zNext = byId[`Z${k}`];
      expect(v.x).toBeCloseTo(8.7, 4);
      expect(zNext.x).toBeCloseTo(8.2, 4);
      expect(Math.hypot(v.x - zPrev.x, v.d - zPrev.d)).toBeCloseTo(2.25, 4);
      expect(Math.hypot(zNext.x - v.x, zNext.d - v.d)).toBeCloseTo(0.85, 4);
    }
    expect(byId.Z4.d).toBeCloseTo(-13.8245, 3);
    expect(Math.hypot(byId.E1.x - byId.Z4.x, byId.E1.d - byId.Z4.d)).toBeCloseTo(5.25, 4);
    expect(byId.E1.x).toBeCloseTo(11.9123, 3);
    expect(byId.E1.d).toBeCloseTo(-17.5368, 3);
    expect(byId.E1.d - byId.E2.d).toBeCloseTo(2.65, 4);
    expect(byId.E2.x - byId.B3.x).toBeCloseTo(2.6, 4);
    expect(byId.B2.d - byId.B3.d).toBeCloseTo(1.7, 4);
    expect(byId.B1.x).toBeCloseTo(8.25, 4);
    expect(byId.B1.d).toBeCloseTo(-18.0, 4);
    // нестыковка глубины операторской и 18,00 м снята углом скоса с дверью (≈ 1,17 м)
    expect(Math.hypot(byId.B2.x - byId.B1.x, byId.B2.d - byId.B1.d)).toBeCloseTo(1.1685, 3);
  });

  it('карниз C1-гладкий от +1,45 м у портала до +2,00 м у 2-го ряда и 2,75 м над полом «кишки»', () => {
    expect(hallCanopyY(0)).toBeCloseTo(1.45, 4);
    expect(hallCanopyY(rowFrontD(1))).toBeCloseTo(2.0, 4);
    const eps = 1e-4;
    const slopeLeft = (hallCanopyY(rowFrontD(1) - eps) - hallCanopyY(rowFrontD(1))) / eps;
    const slopeRight = (hallCanopyY(rowFrontD(1)) - hallCanopyY(rowFrontD(1) + eps)) / eps;
    expect(slopeRight).toBeCloseTo(slopeLeft, 3);
    expect(hallCanopyY(-19.5) - hallFloorY(-19.5, 10.5)).toBeCloseTo(2.75, 3);
  });

  it('пол зала: ступени по центру, гладкий пандус в проходах, -0,85 у передних дверей, горизонт у выходов', () => {
    expect(hallFloorY(0, 8.0)).toBeCloseTo(-0.85, 4);
    expect(hallFloorY(-1.5, 8.45)).toBeCloseTo(-0.85, 3);
    expect(hallFloorY(-2.75, 7.5)).toBeCloseTo(-0.75, 4);
    expect(hallFloorY(-5.1, 0)).toBeCloseTo(-0.75, 4); // 1-й ряд без ступени (первая ступень на -5,20)
    // в середине 5-го ряда центр ступенчатый, а проход выше переднего края ступени по гладкому уклону
    const dMid = rowFrontD(4) - 0.4;
    expect(hallFloorY(dMid, 0)).toBeGreaterThan(hallFloorY(dMid, 7.8));
    expect(hallFloorY(rowFrontD(4) - DIM.hall.rowPitch + 1e-5, 0)).toBeCloseTo(hallFloorY(rowFrontD(4) - DIM.hall.rowPitch, 7.8), 3);
    // пандус «кишки» плавно (C¹) выходит в горизонталь за 0,70 м до торцевой двери
    const { blendD, flatD } = hallExitFlatRange();
    expect(flatD - HALL_CONTOUR_RIGHT.find((p) => p.id === 'E2').d).toBeCloseTo(0.7, 6);
    expect(hallFloorY(flatD, 10.5)).toBeCloseTo(hallFloorY(-20.1, 10.5), 6);
    expect(hallFloorY(-18.0, 10.5)).toBeLessThan(hallFloorY(flatD, 10.5));
    const e = 1e-4;
    const k0 = (hallFloorY(blendD - e, 10.5) - hallFloorY(blendD, 10.5)) / e;
    const k1 = (hallFloorY(blendD, 10.5) - hallFloorY(blendD + e, 10.5)) / e;
    expect(k0).toBeCloseTo(k1, 3);
    expect((hallFloorY(flatD - e, 10.5) - hallFloorY(flatD, 10.5)) / e).toBeCloseTo(0, 3);
    expect(inHallFloor(10.5, -19.5)).toBe(true);
    expect(inHallFloor(0, -19.5)).toBe(false); // внутри операторской пола зала нет
  });

  it('по 4 LED-ленты с каждой стороны от пола пандуса до низа карниза', () => {
    for (const side of [-1, 1]) {
      const leds = hallLedCorners(side);
      expect(leds).toHaveLength(4);
      for (const c of leds) {
        expect(Math.abs(c.x)).toBeCloseTo(8.7, 4);
        expect(c.y0).toBeCloseTo(hallFloorY(c.d, c.x), 4);
        expect(c.y1).toBeCloseTo(hallCanopyY(c.d), 4);
        expect(c.nx * side).toBeLessThan(0); // биссектриса направлена внутрь зала
        expect(Math.hypot(c.nx, c.nd)).toBeCloseTo(1, 5);
      }
      // V1 (d ≈ -4.55) попадает на плавный переход карниза (+1.45 → +2.00), а V2..V4 — на участок полной высоты 2.75 м
      expect(leds[0].y1 - leds[0].y0).toBeGreaterThan(2.5);
      expect(leds[0].y1 - leds[0].y0).toBeLessThan(2.75);
      for (const c of leds.slice(1)) {
        expect(c.y1 - c.y0).toBeCloseTo(2.75, 4);
      }
    }
  });
});

function fakeMats() {
  return new Proxy({}, {
    get(t, k) {
      if (!(k in t)) t[k] = new THREE.MeshStandardMaterial({ name: String(k) });
      return t[k];
    },
  });
}

describe('Большая сцена · 3D-сборка зала и свет', () => {
  it('потолок зала использует wallPanel с метрическими UV, ниши мостов — тёмные (blackWall)', () => {
    const M = fakeMats();
    const batch = new StaticBatch();
    buildArchitecture(batch, M);
    const built = batch.build();
    let ceilFound = false;
    let nicheFound = false;
    built.hall.traverse((o) => {
      if (o.isMesh && o.userData?.tag === 'ceiling') {
        expect(['wallPanel', 'blackWall']).toContain(o.material.name);
        if (o.material.name === 'wallPanel') {
          ceilFound = true;
          expect(o.geometry.getAttribute('uv')).toBeTruthy();
        } else {
          nicheFound = true;
        }
      }
    });
    expect(ceilFound).toBe(true);
    expect(nicheFound).toBe(true);
  });

  it('нижние бежевые стены, карниз и ступени с щёчками присутствуют и ориентированы внутрь зала (FrontSide)', () => {
    const M = fakeMats();
    const batch = new StaticBatch();
    buildArchitecture(batch, M);
    const built = batch.build();
    const mats = new Set();
    built.hall.traverse((o) => {
      if (!o.isMesh) return;
      mats.add(o.material.name);
      if (o.material.name === 'hallCanopy') {
        expect(o.material.side).toBe(THREE.FrontSide);
        expect(o.material.color.getHex()).toBe(0xcfb896);
      }
      if (o.material.name === 'hallBeigePanel') {
        expect(o.material.userData.uvScale).toBeCloseTo(1.15, 3);
      }
      if (o.material.name === 'booth') {
        const pos = o.geometry.getAttribute('position');
        let minZ = Infinity;
        for (let i = 0; i < pos.count; i++) minZ = Math.min(minZ, pos.getZ(i));
        // Внутренняя коробка рубки утоплена за плоскость стены d = -18,00 м (z >= 18,015), исключая z-fighting
        expect(minZ).toBeGreaterThanOrEqual(18.015);
      }
    });
    expect(mats.has('hallBeigePanel')).toBe(true);
    expect(mats.has('hallCanopy')).toBe(true);
    expect(mats.has('wallPanel')).toBe(true);

    // Боковые лестницы авансцены и лицевая грань портала опущены до -0,85 м
    let portalMinY = Infinity;
    let stairMinY = Infinity;
    built.walls.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.getAttribute('position');
      if (o.material.name === 'portal') {
        for (let i = 0; i < pos.count; i++) portalMinY = Math.min(portalMinY, pos.getY(i));
      }
      if (o.material.name === 'stageEdge') {
        for (let i = 0; i < pos.count; i++) {
          if (pos.getZ(i) > 0.05) stairMinY = Math.min(stairMinY, pos.getY(i));
        }
      }
    });
    expect(portalMinY).toBeCloseTo(-0.85, 3);
    expect(stairMinY).toBeCloseTo(-0.85, 3);
  });

  it('emitters.house содержит прямым потомком меш 8 вертикальных LED-лент с userData.emitter = house', () => {
    const M = fakeMats();
    const em = buildEmitters(M, DUTY_ROWS);
    const houseEmitters = em.groups.house.children.filter((c) => c.userData?.emitter === 'house');
    expect(houseEmitters.length).toBeGreaterThanOrEqual(2); // потолочные лампы + 8 LED-лент в углах ёлочки
    const ambFull = ambientLights('full', em);
    const ambLite = ambientLights('lite', em);
    expect(ambFull.house.length).toBe(7); // 3 потолочных SpotLight + 4 безтеневых PointLight ниш
    expect(ambLite.house.length).toBe(1); // мобильный профиль без утяжеления
    // дежурный свет: 3 линии ДО сцены + по источнику под каждой фермой зала (только на компьютере)
    expect(em.hallDutyPoints).toHaveLength(DIM.hallRig.dutyTrusses.list.length);
    expect(ambFull.duty.length).toBe(3 + DIM.hallRig.dutyTrusses.list.length);
    expect(ambLite.duty.length).toBe(1);
    const dutyEmitters = em.groups.duty.children.filter((c) => c.userData?.emitter === 'duty');
    expect(dutyEmitters.length).toBeGreaterThanOrEqual(4); // лампы ДО, LED-линейки, синие + светильники ферм зала
  });

  it('buildSeats строит 390 кресел внутри ±6,70 м на ступенях рядов', () => {
    const M = fakeMats();
    const [iF] = buildSeats(M);
    expect(iF.count).toBe(390);
    const p = new THREE.Vector3();
    const m = new THREE.Matrix4();
    for (let i = 0; i < iF.count; i++) {
      iF.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(Math.abs(p.x) + DIM.hall.seatWidth / 2).toBeLessThanOrEqual(STEP_HALF_X + 1e-4);
      expect(p.y).toBeCloseTo(hallFloorY(-p.z, p.x), 6);
    }
  });
});

describe('Большая сцена · трассировка лучей, пятна света, оверлеи и виды зала', () => {
  const down = new THREE.Vector3(0, -1, 0);

  it('луч на сцене при |x| = 8,2 м (между 8,0 м зала и 8,5 м коробки) попадает в планшет, а не в стену зала', () => {
    const hitLeft = traceToFloor(new THREE.Vector3(-7.0, 5.0, -3.0), new THREE.Vector3(-1.2, -5.0, 0).normalize());
    expect(hitLeft.floor).toBe(true);
    expect(hitLeft.point.y).toBeCloseTo(0, 3);
    expect(hitLeft.point.x).toBeCloseTo(-8.2, 3);

    const hitRight = traceToFloor(new THREE.Vector3(7.0, 5.0, -6.0), new THREE.Vector3(1.2, -5.0, 0).normalize());
    expect(hitRight.floor).toBe(true);
    expect(hitRight.point.y).toBeCloseTo(0, 3);
    expect(hitRight.point.x).toBeCloseTo(8.2, 3);
  });

  it('вертикальные и наклонные лучи в зале попадают точно в ступень, пандус, порог -0,85 и тамбур выхода', () => {
    expect(traceToFloor(new THREE.Vector3(8.3, 3.0, 0.5), down).point.y).toBeCloseTo(-0.85, 3);
    expect(traceToFloor(new THREE.Vector3(8.0, 3.0, 0.5), down).point.y).toBeCloseTo(hallFloorY(-0.5, 8.0), 4);
    expect(traceToFloor(new THREE.Vector3(7.8, 4.0, 10.0), down).point.y).toBeCloseTo(hallFloorY(-10.0, 7.8), 3);
    expect(traceToFloor(new THREE.Vector3(10.5, 5.0, 19.5), down).point.y).toBeCloseTo(hallFloorY(-19.5, 10.5), 3);
    expect(traceToFloor(new THREE.Vector3(11.5, 5.0, 10.0), down).floor).toBe(false);
    expect(traceToFloor(new THREE.Vector3(0, 5.0, 19.5), down).floor).toBe(false);
    // луч в переднюю стену операторской обрезается на d = -18,0 м (z = +18,0)
    const toBooth = traceToFloor(new THREE.Vector3(0, 2.5, 14.0), new THREE.Vector3(0, 0, 1));
    expect(toBooth.floor).toBe(false);
    expect(toBooth.point.z).toBeCloseTo(18.0, 3);
  });

  it('clipPoolsToFloor встраивает кусочно-линейный контур зала с кишками и вырезом операторской', () => {
    const mat = new THREE.MeshBasicMaterial();
    clipPoolsToFloor(mat);
    const sh = { vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n}' };
    mat.onBeforeCompile(sh);
    expect(sh.fragmentShader).toContain('11.9123');
    expect(sh.fragmentShader).toContain('-20.1868');
    expect(sh.fragmentShader).toContain('9.3123');
  });

  it('размерные выноски и ортографические виды учитывают ширину 16 м и выходы до -20,34 м', () => {
    const made = [];
    const fakeLabels = {
      make(text) {
        const obj = new THREE.Object3D();
        obj.userData.text = text;
        made.push(obj);
        return obj;
      },
    };
    buildDims(fakeLabels);
    const texts = made.map((o) => o.userData.text);
    expect(texts).toContain('Зал 16 м');
    const longDim = made.find((o) => o.userData.text.startsWith('Портал — операторская'));
    expect(longDim).toBeTruthy();
    expect(longDim.position.x).toBeGreaterThan(12.2);
    expect(bigVenue.views.plan.height).toBeGreaterThanOrEqual(33);
    expect(bigVenue.views.plan.center[2]).toBeCloseTo(-5.0, 3);
  });
});
