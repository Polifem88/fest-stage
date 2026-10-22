// Общие построители наложений: размерные линии с подписями и переключение
// размеров/сетки по виду (план сверху / разрез сбоку). Список размеров и сетку даёт площадка.
import * as THREE from 'three';

/**
 * Размеры разложены по направлению: x — поперёк сцены, d — вглубь, y — по высоте.
 * На плане сверху высоты схлопываются в точку, а на разрезе сбоку — поперечные размеры,
 * и их подписи наезжают на соседние; такие размеры прячет setDimsView().
 * @param list [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1 (по умолчанию середина)]
 */
export function buildDimsFromList(labels, list) {
  const g = new THREE.Group();
  g.name = 'dims';
  const axes = {};
  const verts = { x: [], y: [], d: [] };
  for (const [a, b, text, t = 0.5] of list) {
    const A = new THREE.Vector3(a[0], a[1], -a[2]);
    const B = new THREE.Vector3(b[0], b[1], -b[2]);
    const dir = B.clone().sub(A).normalize();
    const axis = Math.abs(dir.y) > 0.9 ? 'y' : Math.abs(dir.x) > 0.9 ? 'x' : 'd';
    if (!axes[axis]) { axes[axis] = new THREE.Group(); axes[axis].name = `dims:${axis}`; g.add(axes[axis]); }
    const v = verts[axis];
    v.push(...A.toArray(), ...B.toArray());
    // засечки
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tick = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(0.12).add(up.clone().multiplyScalar(0.0));
    const t2 = up.clone().multiplyScalar(0.12);
    for (const P of [A, B]) {
      v.push(...P.clone().sub(t2).toArray(), ...P.clone().add(t2).toArray());
      v.push(...P.clone().sub(tick).toArray(), ...P.clone().add(tick).toArray());
    }
    if (labels) {
      const s = labels.make(text, { px: 13, color: '#111', bg: 'rgba(255,214,90,0.92)', kind: 'dim', depthTest: false });
      s.position.lerpVectors(A, B, t);
      axes[axis].add(s);
    }
  }
  const mat = new THREE.LineBasicMaterial({ color: 0xffc83a, depthTest: false, transparent: true });
  for (const [axis, v] of Object.entries(verts)) {
    if (!v.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const lines = new THREE.LineSegments(geo, mat);
    lines.renderOrder = 9;
    axes[axis].add(lines);
  }
  g.userData.axes = axes;
  return g;
}

/** Какие размеры видны в текущем виде: 'top' — план, 'side' — разрез, иначе все. */
export function setDimsView(g, dir) {
  const hide = dir === 'top' ? 'y' : dir === 'side' ? 'x' : null;
  for (const [axis, grp] of Object.entries(g.userData.axes || {})) grp.visible = axis !== hide;
}

/** Сетка по виду: на разрезе сбоку поперечные метки схлопываются в полосу — прячем (userData.xLabels). */
export function setGridView(g, dir) {
  if (g.userData.xLabels) g.userData.xLabels.visible = dir !== 'side';
}

/** «Шаговая» подпись метров: 2,5 м (без лишних нулей). */
export const fmtM = (m) => `${m.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} м`;
