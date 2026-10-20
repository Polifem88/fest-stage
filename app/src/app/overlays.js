// Размерные линии с подписями и сетка на планшете.
import * as THREE from 'three';
import { DIM, BOX_HALF, HALL_HALF, rowFrontD } from '../config/dimensions.js';
import { HALL_BACK_FLOOR_Y } from '../build/architecture.js';

const fmt = (m) => `${m.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} м`;

/** Список размеров: [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1 (по умолчанию середина)] */
function dimList() {
  const W = BOX_HALF, PW2 = DIM.portal.width / 2, FS = DIM.forestage;
  return [
    [[-PW2, DIM.portal.height + 0.25, -0.05], [PW2, DIM.portal.height + 0.25, -0.05], `Портал ${fmt(DIM.portal.width)}`],
    [[-PW2 - 0.35, 0, -0.05], [-PW2 - 0.35, DIM.portal.height, -0.05], `${fmt(DIM.portal.height)}`, 0.35], // подпись ниже «Деко-потолка»
    [[-W, 0.03, DIM.box.backWallD - 0.4], [W, 0.03, DIM.box.backWallD - 0.4], `Коробка ${fmt(DIM.box.width)}`],
    [[0, 0.03, -FS.depth], [0, 0.03, DIM.box.backWallD], `До задней стены ${fmt(FS.depth + DIM.box.backWallD)} (≈12)`],
    // глубина авансцены: справа за концом С0, подпись ближе к краю (не на приборах С0); ниже пола зала (на разрезе не на ступенях)
    [[7.7, -FS.height - 0.45, -FS.depth], [7.7, -FS.height - 0.45, 0], `Авансцена ${fmt(FS.depth)}`, 0.15],
    [[-FS.frontWidth / 2, -FS.height + 0.02, -FS.depth - 0.25], [FS.frontWidth / 2, -FS.height + 0.02, -FS.depth - 0.25], `Перед авансцены ${fmt(FS.frontWidth)}`],
    [[W - 1.2, 0, 5.0], [W - 1.2, DIM.box.ceiling, 5.0], `Потолок ${fmt(DIM.box.ceiling)}`],
    [[-W + 1.2, 0, DIM.rigel.d], [-W + 1.2, DIM.rigel.bottomY, DIM.rigel.d], `Ригель ${fmt(DIM.rigel.bottomY)}`, 0.7],
    [[-W + 0.45, 0, 6.2], [-W + 0.45, DIM.galleries.upperY, 6.2], `Галерея ${fmt(DIM.galleries.upperY)}`],
    [[-1.5, 0, DIM.box.backWallD - 0.45], [-1.5, DIM.galleries.lowerY, DIM.box.backWallD - 0.45], `Нижняя галерея ${fmt(DIM.galleries.lowerY)}`],
    // высота сцены: у переднего края авансцены по оси (не на боковых ступенях)
    [[-3.5, -FS.height, -FS.depth - 0.1], [-3.5, 0, -FS.depth - 0.1], `Сцена ${fmt(FS.height)}`],
    [[2.5, -FS.height + 0.03, -FS.depth], [2.5, -FS.height + 0.03, rowFrontD(0)], `До 1-го ряда ${fmt(DIM.hall.firstRowGap)}`],
    [[-HALL_HALF, HALL_BACK_FLOOR_Y + 0.05, -DIM.hall.portalToBoothWall + 0.6], [HALL_HALF, HALL_BACK_FLOOR_Y + 0.05, -DIM.hall.portalToBoothWall + 0.6], `Зал ${fmt(DIM.hall.width)}`],
    // справа за стеной зала: слева на плане экспликация, и там же приборы лож
    [[HALL_HALF + 0.7, -FS.height + 0.05, 0], [HALL_HALF + 0.7, -FS.height + 0.05, -DIM.hall.portalToBoothWall], `Портал — операторская ${fmt(DIM.hall.portalToBoothWall)}`],
    // над авансценой, в 1 м от портала: на разрезе не сливается с высотой портала
    [[-PW2 + 0.5, 0, -1.0], [-PW2 + 0.5, DIM.decoCeilingY, -1.0], `Деко-потолок ${fmt(DIM.decoCeilingY)}`],
  ];
}

/**
 * Размеры разложены по направлению: x — поперёк сцены, d — вглубь, y — по высоте.
 * На плане сверху высоты схлопываются в точку, а на разрезе сбоку — поперечные размеры,
 * и их подписи наезжают на соседние; такие размеры прячет setDimsView().
 */
export function buildDims(labels) {
  const g = new THREE.Group();
  g.name = 'dims';
  const axes = {};
  const verts = { x: [], y: [], d: [] };
  for (const [a, b, text, t = 0.5] of dimList()) {
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
  for (const [axis, grp] of Object.entries(g.userData.axes)) grp.visible = axis !== hide;
}

export function buildGrid(labels) {
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  const W = BOX_HALF;
  const d0 = -DIM.forestage.depth, d1 = DIM.box.backWallD;
  for (let x = -8; x <= 8; x++) v.push(x, 0.006, -d0, x, 0.006, -d1);
  for (let d = Math.ceil(d0); d <= d1; d++) v.push(-W, 0.006, -d, W, 0.006, -d);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));
  // ось сцены и линия портала
  const ax = new THREE.BufferGeometry();
  ax.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.01, -d0, 0, 0.01, -d1, -W, 0.01, 0, W, 0.01, 0], 3));
  g.add(new THREE.LineSegments(ax, new THREE.LineBasicMaterial({ color: 0xff5a36 })));
  // оцифровка: поперёк — от оси сцены (через 2 м, за задней стеной: спереди тесно от размеров),
  // вглубь — от линии портала (слева за стеной). Поперечные метки на разрезе прячет setGridView.
  if (labels) {
    const xl = new THREE.Group();
    xl.name = 'grid:x';
    g.add(xl);
    g.userData.xLabels = xl;
    const mk = (parent, text, x, d, opts = {}) => {
      const s = labels.make(text, { px: 11, color: '#c8352a', bg: 'rgba(255,255,255,0.85)', kind: 'grid', depthTest: false, ...opts });
      s.position.set(x, 0.02, -d);
      s.renderOrder = 11;
      parent.add(s);
    };
    const num = (n) => String(n).replace('-', '−');
    for (let x = -8; x <= 8; x += 2) mk(xl, num(x), x, d1 + 0.5);
    mk(xl, 'м от оси сцены', W + 1.6, d1 + 0.5, { color: '#555' });
    for (let d = Math.ceil(d0); d <= Math.floor(d1); d++) mk(g, num(d), -W - 0.45, d);
    mk(g, 'м от портала', -W - 0.45, d0 - 0.55, { color: '#555' });
  }
  return g;
}

/** Сетка по виду: на разрезе сбоку поперечные метки схлопываются в полосу — прячем. */
export function setGridView(g, dir) {
  if (g.userData.xLabels) g.userData.xLabels.visible = dir !== 'side';
}
