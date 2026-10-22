// Пол Большой сцены для световых пятен и лучей: планшет с вырезом приямка,
// трапеция авансцены, ступенчатый пол зала, стены зала и задняя стена сцены.
// Подключается к общей системе приборов (systems/fixtures.js) через venue.fixtures.floor.
import { DIM, BOX_HALF, HALL_HALF, GALLERY_INNER_X, hallFloorY, forestageHalfWidth } from '../config/dimensions.js';

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

/**
 * Обрезка пятен по границам пола (в шейдере): вытянутое пятно у стены или края авансцены
 * не должно «висеть» за стеной коробки или в воздухе над залом.
 * aZone = 0: планшет (|x| ≤ полуширины коробки, до задней стены) и трапеция авансцены;
 * aZone = 1: зал (|x| ≤ полуширины зала). Координата d = −z.
 */
export function clipPoolsToFloor(mat) {
  const fs = DIM.forestage;
  const pit = DIM.pit;
  const c = (v) => v.toFixed(4);
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
    if (vPoolW.x > ${c(GALLERY_INNER_X)} && pd > ${c(pit.fromD)} && pd < ${c(pit.toD)}) discard;
    if (pd < 0.0 && ax > max(${c(fs.frontWidth / 2)}, ${c(fs.frontWidth / 2)} + (pd - ${c(fs.sideStraight - fs.depth)}) / ${c(fs.depth - fs.sideStraight)} * ${c((fs.backWidth - fs.frontWidth) / 2)})) discard;
  } else if (ax > ${c(HALL_HALF)}) discard;`);
  };
  mat.customProgramCacheKey = () => 'pool-clip';
}

/** Пересечение луча с полом сцены/зала/стенами зала. */
export function traceToFloor(p, dir) {
  const maxD = 30;
  let best = { dist: maxD, floor: false, point: null };
  // планшет сцены (y = 0): коробка и авансцена
  if (dir.y < -0.02) {
    const t = -p.y / dir.y;
    const q = p.clone().addScaledVector(dir, t);
    const d = -q.z;
    const inPit = q.x > GALLERY_INNER_X && d > DIM.pit.fromD && d < DIM.pit.toD;
    const onStage = d >= 0 && d <= DIM.box.backWallD && Math.abs(q.x) <= BOX_HALF && !inPit;
    const onFs = d < 0 && d >= -DIM.forestage.depth && Math.abs(q.x) <= forestageHalfWidth(d);
    if ((onStage || onFs) && t < best.dist) best = { dist: t, floor: true, point: q };
    else if (inPit) {
      const tPit = (-DIM.pit.depth - p.y) / dir.y;
      if (tPit > 0 && tPit < best.dist) best = { dist: tPit, floor: false, point: p.clone().addScaledVector(dir, tPit) };
    } else if (d < 0 && !onFs) {
      // пол зала (ступенчатый) — несколько итераций
      let tt = t;
      for (let k = 0; k < 4; k++) {
        const qq = p.clone().addScaledVector(dir, tt);
        const fy = hallFloorY(-qq.z);
        tt = (fy - p.y) / dir.y;
      }
      const qq = p.clone().addScaledVector(dir, tt);
      if (tt > 0 && tt < best.dist && Math.abs(qq.x) <= HALL_HALF) best = { dist: tt, floor: true, point: qq };
    }
  }
  // боковые стены
  if (Math.abs(dir.x) > 1e-3) {
    const wx = dir.x > 0 ? HALL_HALF : -HALL_HALF;
    const t = (wx - p.x) / dir.x;
    if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
  }
  // задняя стена сцены
  if (dir.z < -1e-3) {
    const t = (-DIM.box.backWallD - p.z) / dir.z;
    if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
  }
  return best;
}

export const FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor };
