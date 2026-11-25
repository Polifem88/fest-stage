// Пол Студии мультимедиа для световых пятен и лучей ('pool-studio'):
//  • зона 0 — чистый пол Y = 0 павильона и дверных ниш, в циклораме (d ≥ 0) ограниченный плоским дном
//    до начала скруглений R = 0,70 ([-2,325..+2,325] × [0..3,275]), чтобы плоские пятна не прорезали дуги;
//  • зона 1 — настилы 4 ярусов разложенного блитчера (обновляются в setLayout без перекомпиляции шейдера);
//  • трассировка лучей останавливает конусы на ярусах блитчера, плоском полу, выкружках/стенках циклорамы и стенах.
import * as THREE from 'three';
import { STUDIO } from '../config/dimensions.js';
import { placed } from '../config/layouts.js';

const MAX_DIST = 25;
const MAX_TOPS = 4;
const H_TOL = 0.03;
const CYC_STEPS = 48;
const CYC_BISECT = 16;

const R = STUDIO.room;
const C = STUDIO.cyc;
const CN = STUDIO.canopy;
const EXIT = STUDIO.doors.find((d) => d.id === 'exit');
const TECH = STUDIO.doors.find((d) => d.id === 'tech');

/** Прямоугольники зоны 0 [x0, x1, d0, d1] на уровне пола Y = 0. */
export const FLOOR_RECTS = [
  [R.x0, R.x1, R.d0, C.d0],
  [C.x0 + C.r, C.x1 - C.r, C.d0, C.d1 - C.r],
  [EXIT.x0, EXIT.x1, EXIT.d0, EXIT.d1],
  [TECH.x0, TECH.x1, TECH.d0, TECH.d1],
];

let tops = [];

const U = {
  uRoom: { value: FLOOR_RECTS.map(([x0, x1, d0, d1]) => new THREE.Vector4(x0, x1, d0, d1)) },
  uTops: { value: Array.from({ length: MAX_TOPS }, () => new THREE.Vector4()) },
  uTopH: { value: new Float32Array(MAX_TOPS) },
  uTopN: { value: 0 },
};

export function setLayout(st) {
  if (st?.id === 'unfolded') {
    tops = placed(st).tiers.map(({ x0, x1, d0, d1, h }) => ({ x0, x1, d0, d1, h }));
  } else {
    tops = [];
  }
  tops.forEach((t, i) => {
    U.uTops.value[i].set(t.x0, t.x1, t.d0, t.d1);
    U.uTopH.value[i] = t.h;
  });
  U.uTopN.value = tops.length;
}

export function poolZone(point) {
  return point.y > 0.02 ? 1 : 0;
}

export function hangs() {
  return true;
}

export function poolK(f) {
  return f.group === 'CYC' ? 0.45 : 0.5;
}

function inRects(x, d, rects) {
  for (const [x0, x1, d0, d1] of rects) {
    if (x >= x0 && x <= x1 && d >= d0 && d <= d1) return true;
  }
  return false;
}

/**
 * Неявная функция криволинейных участков и стенок циклорамы (вне плоского дна):
 * < 0 — внутри воздушного объёма циклорамы, >= 0 — за/на оболочке скруглений R = 0,70 или стенок.
 */
function cycShellSigned(x, y, d) {
  const cx0 = C.x0 + C.r, cx1 = C.x1 - C.r, cd1 = C.d1 - C.r;
  const ux = Math.max(0, cx0 - x, x - cx1);
  const ud = Math.max(0, d - cd1);
  if (ux === 0 && ud === 0) return -1; // над плоским дном циклорамы (обрабатывается полом Y = 0)
  const uy = Math.max(0, C.r - y);
  return ux * ux + uy * uy + ud * ud - C.r * C.r;
}

const TRACE_WALLS = [
  // левая и правая стены, задняя стена под козырьком, лицевая грань козырька, стена за циклорамой, торцы ниш
  { axis: 'x', at: R.x0, a0: R.d0, a1: R.d1, y0: 0, y1: R.ceiling },
  { axis: 'x', at: R.x1, a0: R.d0, a1: TECH.d0, y0: 0, y1: R.ceiling },
  { axis: 'x', at: R.x1, a0: TECH.d1, a1: R.d1, y0: 0, y1: R.ceiling },
  { axis: 'x', at: R.x1, a0: TECH.d0, a1: TECH.d1, y0: TECH.h, y1: R.ceiling },
  { axis: 'x', at: TECH.x1, a0: TECH.d0, a1: TECH.d1, y0: 0, y1: TECH.h },
  { axis: 'd', at: R.d0, a0: R.x0, a1: EXIT.x0, y0: 0, y1: CN.y },
  { axis: 'd', at: EXIT.d0, a0: EXIT.x0, a1: EXIT.x1, y0: 0, y1: EXIT.h },
  { axis: 'd', at: CN.d1, a0: R.x0, a1: R.x1, y0: CN.y, y1: R.ceiling },
  { axis: 'd', at: R.d1, a0: R.x0, a1: R.x1, y0: 0, y1: R.ceiling },
];

export function traceToFloor(p, dir) {
  let best = { dist: MAX_DIST, floor: false, point: null };

  // 1. Ярусы разложенного блитчера (зона 1) и плоский пол (зона 0)
  if (dir.y < -0.02) {
    for (const t of tops) {
      const s = (t.h - p.y) / dir.y;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      const d = -q.z;
      if (q.x >= t.x0 && q.x <= t.x1 && d >= t.d0 && d <= t.d1) {
        best = { dist: s, floor: true, point: q };
      }
    }
    const s = -p.y / dir.y;
    if (s > 0 && s < best.dist) {
      const q = p.clone().addScaledVector(dir, s);
      if (inRects(q.x, -q.z, FLOOR_RECTS)) {
        best = { dist: s, floor: true, point: q };
      }
    }
  }

  // 2. Криволинейная оболочка и стенки циклорамы (d ∈ [0; 3,975], y ∈ [0; 3,90])
  const sMax = best.dist;
  let prevS = null, prevVal = -1;
  for (let i = 1; i <= CYC_STEPS; i++) {
    const s = (sMax * i) / CYC_STEPS;
    const x = p.x + dir.x * s, y = p.y + dir.y * s, d = -(p.z + dir.z * s);
    if (d < C.d0 || y > C.h || y < -0.05) {
      prevS = s;
      prevVal = -1;
      continue;
    }
    const val = cycShellSigned(x, y, d);
    if (val >= 0) {
      let lo = prevS ?? Math.max(0, s - sMax / CYC_STEPS), hi = s;
      for (let k = 0; k < CYC_BISECT; k++) {
        const mid = (lo + hi) * 0.5;
        const mx = p.x + dir.x * mid, my = p.y + dir.y * mid, md = -(p.z + dir.z * mid);
        if (md >= C.d0 && my <= C.h && cycShellSigned(mx, my, md) >= 0) hi = mid;
        else lo = mid;
      }
      if (hi < best.dist) {
        best = { dist: hi, floor: false, point: p.clone().addScaledVector(dir, hi) };
      }
      break;
    }
    prevS = s;
    prevVal = val;
    void prevVal;
  }

  // 3. Внешние стены павильона и козырёк операторской
  for (const w of TRACE_WALLS) {
    const lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1);
    if (w.axis === 'x') {
      if (Math.abs(dir.x) < 1e-5) continue;
      const s = (w.at - p.x) / dir.x;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      const d = -q.z;
      if (d >= lo && d <= hi && q.y >= w.y0 && q.y <= w.y1) best = { dist: s, floor: false, point: q };
    } else {
      if (Math.abs(dir.z) < 1e-5) continue;
      const s = (-w.at - p.z) / dir.z;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      if (q.x >= lo && q.x <= hi && q.y >= w.y0 && q.y <= w.y1) best = { dist: s, floor: false, point: q };
    }
  }

  return best;
}

export function clipPoolsToFloor(mat) {
  const nRoom = FLOOR_RECTS.length;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aZone;\nvarying float vZone;\nvarying vec3 vPoolW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvZone = aZone;\nvPoolW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vZone;
varying vec3 vPoolW;
uniform vec4 uRoom[${nRoom}];
uniform vec4 uTops[${MAX_TOPS}];
uniform float uTopH[${MAX_TOPS}];
uniform int uTopN;
bool inR(vec4 r, float x, float d) { return x >= r.x && x <= r.y && d >= r.z && d <= r.w; }`)
      .replace('void main() {', `void main() {
  float px = vPoolW.x;
  float pd = -vPoolW.z;
  bool ok = false;
  if (vZone < 0.5) {
    for (int i = 0; i < ${nRoom}; i++) if (inR(uRoom[i], px, pd)) ok = true;
  } else {
    for (int i = 0; i < ${MAX_TOPS}; i++) if (i < uTopN && abs(vPoolW.y - 0.012 - uTopH[i]) < ${H_TOL.toFixed(3)} && inR(uTops[i], px, pd)) ok = true;
  }
  if (!ok) discard;`);
  };
  mat.customProgramCacheKey = () => 'pool-studio';
}

export const FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor, setLayout };
