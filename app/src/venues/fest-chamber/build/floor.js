// Пол Камерной сцены для световых пятен и лучей:
//  • планшет сцены и уровень 1-го ряда (y = 0, d = −0,45..+9,75 м, с учётом левого кармана d >= 0);
//  • ступенчатый амфитеатр зрительного зала (d = −6,65..−0,45 м, 6 ступеней по +0,25 м до +1,50 м);
//  • стены сценической коробки и зала (чтобы лучи прострелов не уходили сквозь стены).
import { CHAMBER, hallFloorY } from '../config/dimensions.js';

const S = CHAMBER.stage;
const H = CHAMBER.hall;
const N = CHAMBER.niche;

/** Зона пятна для обрезки в шейдере: 0 — планшет и 1-й ряд (y = 0), 1 — ступени зала. */
export function poolZone(point) {
  const stageLevel = Math.abs(point.y) < 0.02 && -point.z >= H.firstStepD - 0.01;
  return stageLevel ? 0 : 1;
}

/** Все приборы Камерной сцены подвешены на фермах, рамках прострелов или у окна операторской. */
export function hangs() {
  return true;
}

/** Относительная яркость пятна на полу. */
export function poolK(f) {
  return f.group === 'FOH' || f.group.startsWith('HALL') ? 0.42 : 0.52;
}

/**
 * Обрезка пятен по границам пола Камерной сцены (в шейдере):
 *  aZone = 0: планшет сцены (x ∈ [−8,35..+5,65] при d >= 0; x ∈ [−5,85..+5,65] при d ∈ [−0,45..0]);
 *  aZone = 1: амфитеатр зрительного зала (x ∈ [−5,85..+5,85], d ∈ [−6,65..−0,45]).
 */
export function clipPoolsToFloor(mat) {
  const c = (v) => v.toFixed(4);
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aZone;\nvarying float vZone;\nvarying vec3 vPoolW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvZone = aZone;\nvPoolW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vZone;\nvarying vec3 vPoolW;')
      .replace('void main() {', `void main() {
  float pd = -vPoolW.z;
  float px = vPoolW.x;
  if (vZone < 0.5) {
    if (pd > ${c(N.d1)} || pd < ${c(H.firstStepD)} || px > ${c(S.x1)} || px < ${c(S.x0)}) discard;
    if (pd > ${c(S.d1)} && px > ${c(N.x1)}) discard;
    if (pd < 0.0 && px < ${c(H.x0)}) discard;
  } else {
    if (pd < ${c(H.backWallD)} || pd > ${c(H.firstStepD + 0.05)} || px < ${c(H.x0)} || px > ${c(H.x1)}) discard;
  }`);
  };
  mat.customProgramCacheKey = () => 'pool-chamber';
}

/** Пересечение луча с планшетом сцены, ступенчатым полом зала или стенами. */
export function traceToFloor(p, dir) {
  const maxD = 25;
  let best = { dist: maxD, floor: false, point: null };

  if (dir.y < -0.02) {
    const t = -p.y / dir.y;
    const q = p.clone().addScaledVector(dir, t);
    const d = -q.z;
    const xMinStage = d >= 0 ? S.x0 : H.x0;
    const onStage = t > 0 && d >= H.firstStepD && d <= S.d1 && q.x >= xMinStage && q.x <= S.x1;
    if (onStage && t < best.dist) {
      best = { dist: t, floor: true, point: q };
    } else if (d < H.firstStepD) {
      let tt = t;
      for (let k = 0; k < 4; k++) {
        const qq = p.clone().addScaledVector(dir, tt);
        const fy = hallFloorY(-qq.z, qq.x);
        tt = (fy - p.y) / dir.y;
      }
      const qq = p.clone().addScaledVector(dir, tt);
      const dd = -qq.z;
      if (tt > 0 && tt < best.dist && dd >= H.backWallD && qq.x >= H.x0 && qq.x <= H.x1) {
        best = { dist: tt, floor: true, point: qq };
      }
    }
  }

  // Боковые и торцевые стены
  if (Math.abs(dir.x) > 1e-3) {
    for (const wx of [S.x0, H.x0, S.x1, H.x1]) {
      const t = (wx - p.x) / dir.x;
      if (t <= 0 || t >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, t);
      const d = -q.z;
      if (wx === S.x0 && d >= 0 && d <= S.d1) best = { dist: t, floor: false, point: q };
      if (wx === H.x0 && d < 0 && d >= H.backWallD) best = { dist: t, floor: false, point: q };
      if (wx === S.x1 && d >= 0 && d <= S.d1) best = { dist: t, floor: false, point: q };
      if (wx === H.x1 && d < 0 && d >= H.backWallD) best = { dist: t, floor: false, point: q };
    }
  }
  if (Math.abs(dir.z) > 1e-3) {
    for (const wd of [S.d1, H.backWallD]) {
      const t = (-wd - p.z) / dir.z;
      if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
    }
  }

  return best;
}

export const FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor };
