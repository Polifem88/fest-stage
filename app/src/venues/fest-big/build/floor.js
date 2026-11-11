// Пол Большой сцены для световых пятен и лучей: планшет с вырезом приямка,
// трапеция авансцены, ступенчатый пол зала с пандусами 9° и тамбурами выходов,
// зубчатые стены «ёлочки», операторская и задняя стена сцены.
// Подключается к общей системе приборов (systems/fixtures.js) через venue.fixtures.floor.
import { DIM, BOX_HALF, HALL_HALF, hallFloorY, hallCanopyY, forestageHalfWidth, inPit } from '../config/dimensions.js';
import {
  HALL_CONTOUR_BY_ID,
  HALL_OUTER_BREAKS,
  hallSideWallSegments,
  inHallFloor,
} from '../config/hallGeometry.js';

const FLOOR_ITERATIONS = 6;
const FLOOR_TRACE_MARGIN_Y = 0.05;

/** Зона пятна для обрезки в шейдере: 0 — планшет и авансцена, 1 — зал. */
export function poolZone(point) {
  const stageLevel = Math.abs(point.y) < 0.02 && -point.z >= -DIM.forestage.depth - 0.01;
  return stageLevel ? 0 : 1;
}

/** Висит ли прибор (на софите или выносном мосту): тогда голова ниже точки крепления. */
export function hangs(f) {
  return !!f.mount.on || f.group.startsWith('BR');
}

/** Относительная яркость пятна: от приборов в зале (на сцену издалека) — слабее. */
export function poolK(f) {
  return f.group.startsWith('BR') || f.group.startsWith('BOX') ? 0.35 : f.group === 'FOH' ? 0.6 : 0.5;
}

function buildHallOuterGlsl(c) {
  const pts = HALL_OUTER_BREAKS;
  const lines = [`float hallMaxX = ${c(pts[pts.length - 1].x)};`];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const cond = i === 0 ? `if (pd >= ${c(b.d)})` : `else if (pd >= ${c(b.d)})`;
    if (Math.abs(b.x - a.x) < 1e-6) {
      lines.push(`    ${cond} hallMaxX = ${c(a.x)};`);
    } else {
      const slope = (b.x - a.x) / (a.d - b.d);
      lines.push(`    ${cond} hallMaxX = ${c(a.x)} + (${c(a.d)} - pd) * ${c(slope)};`);
    }
  }
  return lines.join('\n');
}

/**
 * Обрезка пятен по границам пола (в шейдере): вытянутое пятно у стены или края авансцены
 * не должно «висеть» за стеной коробки или в воздухе над залом.
 * aZone = 0: планшет (|x| ≤ полуширины коробки, до задней стены, вне щёк портала) и трапеция авансцены;
 * aZone = 1: зал (фактический контур нижних стен с «ёлочкой», «кишками» выходов и вырезом операторской).
 */
export function clipPoolsToFloor(mat) {
  const fs = DIM.forestage;
  const pit = DIM.pit;
  const pier = DIM.wallPier;
  const pitSlope = (pit.toW - pit.fromW) / (pit.toD - pit.fromD);
  const stairSlope = (fs.backWidth / 2 - fs.frontWidth / 2) / (fs.depth - fs.sideStraight);
  const B1 = HALL_CONTOUR_BY_ID.B1;
  const B2 = HALL_CONTOUR_BY_ID.B2;
  const B3 = HALL_CONTOUR_BY_ID.B3;
  const E2 = HALL_CONTOUR_BY_ID.E2;
  const boothChamferSlope = (B2.x - B1.x) / (B1.d - B2.d);
  const c = (v) => v.toFixed(4);
  const hallOuterGlsl = buildHallOuterGlsl(c);

  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aZone;\nvarying float vZone;\nvarying vec3 vPoolW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvZone = aZone;\nvPoolW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vZone;\nvarying vec3 vPoolW;')
      .replace('void main() {', `void main() {
  float pd = -vPoolW.z;
  float ax = abs(vPoolW.x);
  if (vZone < 0.5) {
    if (pd > ${c(DIM.box.backWallD)} || ax > ${c(BOX_HALF)} || pd < ${c(-fs.depth)}) discard;
    if (pd >= 0.0 && pd < ${c(DIM.portal.thickness)} && ax > ${c(DIM.portal.width / 2)}) discard;
    if (pd > ${c(pier.fromD)} && pd <= ${c(pier.toD)} && vPoolW.x > ${c(pier.x0)}) discard;
    float pitEdge = ${c(BOX_HALF - pit.fromW)} - (pd - ${c(pit.fromD)}) * ${c(pitSlope)};
    if (pd > ${c(pit.fromD)} && pd < ${c(pit.toD)} && vPoolW.x > pitEdge) discard;
    if (pd < 0.0 && ax > max(${c(fs.frontWidth / 2)}, ${c(fs.frontWidth / 2)} + (pd - ${c(fs.sideStraight - fs.depth)}) / ${c(fs.depth - fs.sideStraight)} * ${c((fs.backWidth - fs.frontWidth) / 2)})) discard;
  } else {
    if (pd > 0.0 || pd < ${c(E2.d)}) discard;
    ${hallOuterGlsl}
    if (ax > hallMaxX) discard;
    if (pd > ${c(-fs.depth)} && ax < ${c(fs.frontWidth / 2)} + (${c(fs.depth)} + pd) * ${c(stairSlope)}) discard;
    if (pd <= ${c(B1.d)}) {
      float boothMinX = pd >= ${c(B2.d)} ? (${c(B1.x)} + (${c(B1.d)} - pd) * ${c(boothChamferSlope)}) : ${c(B3.x)};
      if (ax < boothMinX) discard;
    }
  }`);
  };
  mat.customProgramCacheKey = () => 'pool-big';
}

/** Пересечение 2D-луча (ox, od) + t·(dx, dd) с отрезком (x0, d0)→(x1, d1); возвращает t > 0 или Infinity. */
function raySegmentHitT(ox, od, dx, dd, x0, d0, x1, d1) {
  const sx = x1 - x0, sd = d1 - d0;
  const det = dx * sd - dd * sx;
  if (Math.abs(det) < 1e-8) return Infinity;
  const rx = x0 - ox, rd = d0 - od;
  const t = (rx * sd - rd * sx) / det;
  if (t <= 1e-4) return Infinity;
  const u = (rx * dd - rd * dx) / det;
  return u >= -1e-5 && u <= 1 + 1e-5 ? t : Infinity;
}

/** Пересечение луча с полом сцены/зала/стенами коробки и зала. */
export function traceToFloor(p, dir) {
  const maxD = 30;
  let best = { dist: maxD, floor: false, point: null };
  const pw2 = DIM.portal.width / 2;

  // 1. Планшет сцены (y = 0), авансцена и пол зрительного зала
  if (dir.y < -0.02) {
    const t = -p.y / dir.y;
    const q = p.clone().addScaledVector(dir, t);
    const d = -q.z;
    const inPortalCheek = d >= 0 && d < DIM.portal.thickness && Math.abs(q.x) > pw2;
    const pitHit = Math.abs(q.x) <= BOX_HALF && inPit(q.x, d);
    const onStage = d >= 0 && d <= DIM.box.backWallD && Math.abs(q.x) <= BOX_HALF && !pitHit && !inPortalCheek;
    const onFs = d < 0 && d >= -DIM.forestage.depth && Math.abs(q.x) <= forestageHalfWidth(d);
    if ((onStage || onFs) && t > 0 && t < best.dist) {
      best = { dist: t, floor: true, point: q };
    } else if (pitHit) {
      const tPit = (-DIM.pit.depth - p.y) / dir.y;
      if (tPit > 0 && tPit < best.dist) best = { dist: tPit, floor: false, point: p.clone().addScaledVector(dir, tPit) };
    } else if (d < 0 && !onFs) {
      let tt = Math.max(0.05, t);
      for (let k = 0; k < FLOOR_ITERATIONS; k++) {
        const qq = p.clone().addScaledVector(dir, tt);
        const fy = hallFloorY(-qq.z, qq.x);
        tt = (fy - p.y) / dir.y;
      }
      const qq = p.clone().addScaledVector(dir, tt);
      if (tt > 0 && tt < best.dist && inHallFloor(qq.x, -qq.z)) {
        best = { dist: tt, floor: true, point: qq };
      }
    }
  }

  // 2. Боковые стены сценической коробки (±8,50 м при d ≥ 0) и верхние стены зала (±8,00 м при d < 0 выше карниза)
  if (Math.abs(dir.x) > 1e-4) {
    const s = dir.x > 0 ? 1 : -1;
    const tStage = (s * BOX_HALF - p.x) / dir.x;
    if (tStage > 0 && tStage < best.dist) {
      const q = p.clone().addScaledVector(dir, tStage);
      if (-q.z >= 0) best = { dist: tStage, floor: false, point: q };
    }
    const tHallUp = (s * HALL_HALF - p.x) / dir.x;
    if (tHallUp > 0 && tHallUp < best.dist) {
      const q = p.clone().addScaledVector(dir, tHallUp);
      const hd = -q.z;
      if (hd < 0 && hd >= -DIM.hall.portalToBoothWall && q.y >= hallCanopyY(hd)) {
        best = { dist: tHallUp, floor: false, point: q };
      }
    }
  }

  // 3. Нижний пояс стен зала («ёлочка», «кишки» выходов и скосы операторской)
  const ox = p.x, od = -p.z, dx = dir.x, dd = -dir.z;
  if (Math.hypot(dx, dd) > 1e-4) {
    for (const side of [-1, 1]) {
      for (const seg of hallSideWallSegments(side)) {
        const tSeg = raySegmentHitT(ox, od, dx, dd, seg.x0, seg.d0, seg.x1, seg.d1);
        if (tSeg < best.dist) {
          const q = p.clone().addScaledVector(dir, tSeg);
          const hd = -q.z;
          if (q.y >= hallFloorY(hd, q.x) - FLOOR_TRACE_MARGIN_Y && q.y <= hallCanopyY(hd) + DIM.hall.canopyFasciaH) {
            best = { dist: tSeg, floor: false, point: q };
          }
        }
      }
    }
  }

  // 4. Продольные стены: задняя стена сцены (d = +9,20) и передняя стена операторской (d = -18,00)
  if (dir.z < -1e-4) {
    const t = (-DIM.box.backWallD - p.z) / dir.z;
    if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
  }
  if (dir.z > 1e-4) {
    const boothD = -DIM.hall.portalToBoothWall;
    const t = (-boothD - p.z) / dir.z;
    if (t > 0 && t < best.dist) {
      const q = p.clone().addScaledVector(dir, t);
      const maxBoothX = q.y >= hallCanopyY(boothD) ? HALL_HALF : HALL_CONTOUR_BY_ID.B1.x;
      if (Math.abs(q.x) <= maxBoothX + 1e-4) best = { dist: t, floor: false, point: q };
    }
  }

  return best;
}

export const FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor };
