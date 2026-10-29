// Геометрические помощники и «упаковщик» статической геометрии.
// Всё, что не двигается, склеивается в один меш на пару (слой, материал) —
// так на телефоне остаётся всего несколько десятков вызовов отрисовки.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Z = (d) => -d;

/** Параллелепипед по границам: x0..x1, y0..y1, d0..d1 (d — глубина сцены). */
export function box(x0, x1, y0, y1, d0, d1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(d1 - d0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, Z((d0 + d1) / 2));
  return g;
}

/**
 * Прямоугольник в вертикальной/горизонтальной плоскости, видимый с одной стороны.
 * axis: 'x' (стена с нормалью ±X), 'd' (стена с нормалью ±d), 'y' (пол/потолок).
 * facing: +1 / −1 — куда смотрит лицевая сторона (по оси axis, для 'd' — по глубине).
 */
export function rect(axis, at, a0, a1, b0, b1, facing) {
  const g = new THREE.PlaneGeometry(Math.abs(a1 - a0), Math.abs(b1 - b0));
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  if (axis === 'x') {
    // a = d, b = y
    g.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(at, cb, Z(ca));
  } else if (axis === 'd') {
    // a = x, b = y; facing +1 = лицом вглубь сцены (−Z)
    if (facing > 0) g.rotateY(Math.PI);
    g.translate(ca, cb, Z(at));
  } else {
    // a = x, b = d; facing +1 = вверх
    g.rotateX(facing > 0 ? -Math.PI / 2 : Math.PI / 2);
    g.translate(ca, at, Z(cb));
  }
  return g;
}

/** Стена-прямоугольник с прямоугольными проёмами (holes: [{a0,a1,b0,b1}]). */
export function wallWithHoles(axis, at, a0, a1, b0, b1, facing, holes = []) {
  // разрезаем на полосы по координате a
  const cuts = new Set([a0, a1]);
  for (const h of holes) { cuts.add(Math.max(a0, h.a0)); cuts.add(Math.min(a1, h.a1)); }
  const xs = [...cuts].sort((p, q) => p - q);
  const parts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const s0 = xs[i], s1 = xs[i + 1];
    if (s1 - s0 < 1e-4) continue;
    const mid = (s0 + s1) / 2;
    const hs = holes.filter((h) => mid > h.a0 && mid < h.a1).sort((p, q) => p.b0 - q.b0);
    let y = b0;
    for (const h of hs) {
      if (h.b0 > y + 1e-4) parts.push(rect(axis, at, s0, s1, y, h.b0, facing));
      y = Math.max(y, h.b1);
    }
    if (b1 > y + 1e-4) parts.push(rect(axis, at, s0, s1, y, b1, facing));
  }
  return parts;
}

/** Цилиндр между двумя точками (точки — THREE.Vector3 в мировых координатах). */
export function cylBetween(p, q, r, seg = 6) {
  const len = p.distanceTo(q);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  const mid = p.clone().add(q).multiplyScalar(0.5);
  const dir = q.clone().sub(p).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)));
  return g;
}

/** Точка в мировых координатах из (x, y, d). */
export const P = (x, y, d) => new THREE.Vector3(x, y, Z(d));

/** Призма из многоугольника в плоскости (x, d), от y0 до y1. pts: [[x,d],...] против часовой (вид сверху). */
export function prism(pts, y0, y1) {
  const shape = new THREE.Shape(pts.map(([x, d]) => new THREE.Vector2(x, d)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  // Shape лежит в XY (y = d), выдавливание по +Z → поворачиваем: Z→Y, Y(d)→ −Z
  g.rotateX(-Math.PI / 2);
  // после поворота: (x, d, h) → (x, h, −d); нужно z = −d ✓, y = h + y0
  g.translate(0, y0, 0);
  return g;
}

/**
 * Части отрезка a→b (точки [x, d]) внутри объединения прямоугольников rects = [[x0, x1, d0, d1], …]
 * (ортогональный контур помещения). Куски — по ходу отрезка от a к b; смежные и перекрытые — слиты.
 * Нужна, чтобы балки и диагонали, уходящие в стены, не торчали снаружи помещения.
 * @returns {Array<[[number, number], [number, number]]>}
 */
export function clipSegmentToRects(a, b, rects) {
  const EPS = 1e-9;
  const dx = b[0] - a[0], dd = b[1] - a[1];
  const spans = [];
  for (const [x0, x1, d0, d1] of rects) {
    // Лианг — Барски: параметр t ∈ [0, 1] внутри прямоугольника
    let t0 = 0, t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < EPS) return q >= -EPS;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (clip(-dx, a[0] - x0) && clip(dx, x1 - a[0]) && clip(-dd, a[1] - d0) && clip(dd, d1 - a[1]) && t1 - t0 > EPS) spans.push([t0, t1]);
  }
  spans.sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s[0] <= last[1] + EPS) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const r9 = (v) => Math.round(v * 1e9) / 1e9 + 0; // + 0: без «−0»
  const at = (t) => [r9(a[0] + dx * t), r9(a[1] + dd * t)];
  return merged.map(([t0, t1]) => [at(t0), at(t1)]);
}

/** UV в метрах по доминирующей нормали (простая «коробочная» развёртка). */
export function worldUV(g, scale = 1) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Упаковщик статики. add(layer, material, geometry | geometry[], opts)
 * opts.uv: true — пересчитать UV в метрах по material.userData.uvScale
 * opts.tag — метка для особых групп (напр. 'ceiling'), видна в userData.
 */
export class StaticBatch {
  constructor() { this.buckets = new Map(); }
  add(layer, material, geoms, opts = {}) {
    const list = Array.isArray(geoms) ? geoms : [geoms];
    const key = `${layer}|${material.uuid}|${opts.tag || ''}|${opts.shadow === false ? 'ns' : ''}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { layer, material, tag: opts.tag, shadow: opts.shadow !== false, geoms: [] });
    const b = this.buckets.get(key);
    for (let g of list) {
      if (!g) continue;
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (opts.uv !== false && (material.map || material.alphaMap)) worldUV(g, material.userData.uvScale || 1);
      if (!g.attributes.uv) worldUV(g, 1);
      // оставляем только общие атрибуты
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      b.geoms.push(g);
    }
  }
  /** Возвращает { layerName: THREE.Group } */
  build() {
    const layers = {};
    for (const b of this.buckets.values()) {
      if (!b.geoms.length) continue;
      const merged = mergeGeometries(b.geoms, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.name = `${b.layer}:${b.material.name}${b.tag ? ':' + b.tag : ''}`;
      mesh.userData.layer = b.layer;
      mesh.userData.tag = b.tag;
      mesh.userData.static = true;
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      (layers[b.layer] ||= new THREE.Group()).add(mesh);
      for (const g of b.geoms) g.dispose();
    }
    for (const [k, g] of Object.entries(layers)) g.name = `layer:${k}`;
    return layers;
  }
}
