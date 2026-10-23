// Размерные линии с подписями и сетка на планшете.
import * as THREE from 'three';
import { DIM, BOX_HALF, HALL_HALF, GALLERY_INNER_X, rowFrontD } from '../config/dimensions.js';
import { HALL_BACK_FLOOR_Y } from './architecture.js';
import { buildDimsFromList } from '../../../core/overlays.js';

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

/** Размерные линии Большой сцены (общий построитель — core/overlays.js). */
export function buildDims(labels) {
  return buildDimsFromList(labels, dimList());
}

export function buildGrid(labels) {
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  const W = BOX_HALF;
  const GX = GALLERY_INNER_X;
  const pit = DIM.pit;
  const d0 = -DIM.forestage.depth, d1 = DIM.box.backWallD;
  for (let x = -8; x <= 8; x++) {
    if (x > GX) {
      v.push(x, 0.006, -d0, x, 0.006, -pit.fromD);
      v.push(x, 0.006, -pit.toD, x, 0.006, -d1);
    } else {
      v.push(x, 0.006, -d0, x, 0.006, -d1);
    }
  }
  for (let d = Math.ceil(d0); d <= d1; d++) {
    const xMax = d > pit.fromD && d < pit.toD ? GX : W;
    v.push(-W, 0.006, -d, xMax, 0.006, -d);
  }
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
      const s = labels.make(text, { px: 22, color: '#c8352a', bg: 'rgba(255,255,255,0.92)', kind: 'grid', depthTest: false, ...opts });
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
