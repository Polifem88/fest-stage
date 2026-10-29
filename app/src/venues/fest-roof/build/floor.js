// Пол Сцены под крышей для световых пятен и лучей:
//  • зона 0 — чистый пол (Y = 0) в контуре помещения (объединение прямоугольников ROOF.rects);
//  • зона 1 — верх станков и пультовых подиумов текущей планировки (движок сообщает её через setLayout);
//  • стены — лучи не уходят сквозь них наружу.
// Обрезка пятен в шейдере: зона 0 — по ROOF.rects, зона 1 — по верхам станков (uniform-массивы, обновляются
// при смене планировки без перекомпиляции). Ключ кэша шейдера уникален: 'pool-roof'.
import * as THREE from 'three';
import { ROOF, insideRoom } from '../config/dimensions.js';
import { placed } from '../config/layouts.js';

const MAX_DIST = 30;
const MAX_TOPS = 12; // рядов на станках + пультов в любой планировке (≤ 7 + 2)
const H_TOL = 0.03; // допуск по высоте при сопоставлении пикселя пятна с верхом станка

/** Верхи станков и подиумов текущей планировки: [{x0,x1,d0,d1,h}]. */
let tops = [];

const U = {
  uRoom: { value: ROOF.rects.map(([x0, x1, d0, d1]) => new THREE.Vector4(x0, x1, d0, d1)) },
  uTops: { value: Array.from({ length: MAX_TOPS }, () => new THREE.Vector4()) },
  uTopH: { value: new Float32Array(MAX_TOPS) },
  uTopN: { value: 0 },
};

/** Планировка зала → верхи станков (ряды с h > 0 и подиумы пультов). */
export function setLayout(st) {
  const p = placed(st);
  tops = [...p.rows.filter((r) => r.h > 0), ...p.pults].map(({ x0, x1, d0, d1, h }) => ({ x0, x1, d0, d1, h }));
  if (tops.length > MAX_TOPS) throw new Error(`площадка roof: верхов станков ${tops.length} > ${MAX_TOPS}`);
  tops.forEach((t, i) => { U.uTops.value[i].set(t.x0, t.x1, t.d0, t.d1); U.uTopH.value[i] = t.h; });
  U.uTopN.value = tops.length;
}

/** 0 — пол, 1 — верх станка. */
export function poolZone(point) {
  return point.y > 0.02 ? 1 : 0;
}

/** Все приборы — на фермах. */
export function hangs() {
  return true;
}

/** Относительная яркость пятна. */
export function poolK(f) {
  return f.group === 'STORAGE' ? 0.4 : 0.5;
}

/** Стены для трассировки: стены помещения и тупик коридора за проёмом. */
const CR = ROOF.corridor;
const TRACE_WALLS = [
  ...ROOF.walls,
  { axis: 'x', at: CR.x0, a0: CR.d0, a1: CR.d1 },
  { axis: 'x', at: CR.x1, a0: CR.d0, a1: CR.d1 },
  { axis: 'd', at: CR.d1, a0: CR.x0, a1: CR.x1 },
];

/** Ближайшее пересечение луча с полом, верхом станка или стеной. */
export function traceToFloor(p, dir) {
  let best = { dist: MAX_DIST, floor: false, point: null };
  if (dir.y < -0.02) {
    for (const t of tops) {
      const s = (t.h - p.y) / dir.y;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      const d = -q.z;
      if (q.x >= t.x0 && q.x <= t.x1 && d >= t.d0 && d <= t.d1) best = { dist: s, floor: true, point: q };
    }
    const s = -p.y / dir.y;
    if (s > 0 && s < best.dist) {
      const q = p.clone().addScaledVector(dir, s);
      if (insideRoom(q.x, -q.z)) best = { dist: s, floor: true, point: q };
    }
  }
  // стены (с проёмами не считаемся — луч останавливается на плоскости стены в её пролёте и высоте)
  for (const w of TRACE_WALLS) {
    const h = w.h ?? ROOF.room.ceiling;
    const lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1);
    if (w.axis === 'x') {
      if (Math.abs(dir.x) < 1e-4) continue;
      const s = (w.at - p.x) / dir.x;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      const d = -q.z;
      if (d >= lo && d <= hi && q.y >= 0 && q.y <= h) best = { dist: s, floor: false, point: q };
    } else {
      if (Math.abs(dir.z) < 1e-4) continue;
      const s = (-w.at - p.z) / dir.z;
      if (s <= 0 || s >= best.dist) continue;
      const q = p.clone().addScaledVector(dir, s);
      if (q.x >= lo && q.x <= hi && q.y >= 0 && q.y <= h) best = { dist: s, floor: false, point: q };
    }
  }
  return best;
}

/** Обрезка пятен: пол — по контуру помещения, верх станка — по станкам этой высоты. */
export function clipPoolsToFloor(mat) {
  const nRoom = ROOF.rects.length;
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
  mat.customProgramCacheKey = () => 'pool-roof';
}

export const FLOOR = { trace: traceToFloor, zone: poolZone, clip: clipPoolsToFloor, setLayout };
