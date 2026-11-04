// Размерные линии и метровая координатная сетка Студии мультимедиа.
import * as THREE from 'three';
import { STUDIO } from '../config/dimensions.js';
import { buildDimsFromList, fmtM } from '../../../core/overlays.js';

// Визуальные константы: высоты и отступы размерных линий и подписей, м
const FLOOR_Y = 0.03;
const GRID_Y = 0.006;
const AXIS_Y = 0.01;
const LABEL_Y = 0.02;
const OFF = 0.35;
const LABEL_OFF = 0.55;
const DIM_X_STEP = 0.6;
const TRUSS_DIM_OFF = 0.1;
const TRUSS_LABEL_X_OFF = 0.9;

/** Список размеров: [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1]. */
export function dimList() {
  const R = STUDIO.room;
  const T = STUDIO.trusses;
  const C = STUDIO.cyc;
  const f2 = T.upper.lines.find((l) => l.id === 'Ф2');
  const f3 = T.upper.lines.find((l) => l.id === 'Ф3');
  const xCeil = R.x0 + OFF * 2;
  const xUpper = xCeil + DIM_X_STEP;
  const xLower = xUpper + DIM_X_STEP;
  const xCyc = R.x1 - OFF * 2;
  const dVert = (f2.at + f3.at) / 2;
  return [
    [[R.x0, FLOOR_Y, R.d0 + OFF], [R.x1, FLOOR_Y, R.d0 + OFF], `Ширина ${fmtM(R.x1 - R.x0)}`],
    [[R.x0 + OFF, FLOOR_Y, R.d0], [R.x0 + OFF, FLOOR_Y, R.d1], `Глубина ${fmtM(R.d1 - R.d0)}`, 0.45],
    [[xCeil, 0, dVert], [xCeil, R.ceiling, dVert], `Потолок ${fmtM(R.ceiling)}`],
    [[xUpper, 0, dVert], [xUpper, T.upper.y0, dVert], `Верхние фермы ${fmtM(T.upper.y0)}`, 0.6],
    [[xLower, 0, dVert], [xLower, T.lower.y0, dVert], `Нижние фермы ${fmtM(T.lower.y0)}`, 0.4],
    [[xCyc, 0, C.d1 - C.r], [xCyc, C.h, C.d1 - C.r], `Циклорама ${fmtM(C.h)}`, 0.55],
    [[0, T.upper.y0 - TRUSS_DIM_OFF, f2.at], [0, T.upper.y0 - TRUSS_DIM_OFF, f3.at], `Шаг ферм ${fmtM(f3.at - f2.at)}`],
  ];
}

export function buildDims(labels) {
  return buildDimsFromList(labels, dimList());
}

export function buildGrid(labels) {
  const R = STUDIO.room;
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) {
    if (x !== 0) v.push(x, GRID_Y, -R.d0, x, GRID_Y, -R.d1);
  }
  for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) {
    if (d !== 0) v.push(R.x0, GRID_Y, -d, R.x1, GRID_Y, -d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));

  // Ось X = 0 и нулевая линия d = 0
  const axg = new THREE.BufferGeometry();
  axg.setAttribute('position', new THREE.Float32BufferAttribute([
    0, AXIS_Y, -R.d0, 0, AXIS_Y, -R.d1,
    R.x0, AXIS_Y, 0, R.x1, AXIS_Y, 0,
  ], 3));
  g.add(new THREE.LineSegments(axg, new THREE.LineBasicMaterial({ color: 0xff5a36 })));

  if (labels) {
    const xl = new THREE.Group();
    xl.name = 'grid:x';
    g.add(xl);
    g.userData.xLabels = xl;
    const mk = (parent, text, x, d, y = LABEL_Y, opts = {}) => {
      const s = labels.make(text, { px: 22, color: '#c8352a', bg: 'rgba(255,255,255,0.92)', kind: 'grid', depthTest: false, ...opts });
      s.position.set(x, y, -d);
      s.renderOrder = 11;
      parent.add(s);
    };
    const num = (n) => String(n).replace('-', '−');
    for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) mk(xl, num(x), x, R.d1 + LABEL_OFF);
    mk(xl, 'м от оси павильона', R.x1 + TRUSS_LABEL_X_OFF, R.d1 + LABEL_OFF, LABEL_Y, { color: '#444' });
    for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) mk(g, num(d), R.x0 - LABEL_OFF, d);
    mk(g, STUDIO.zeroLineLabel, R.x0 - LABEL_OFF, R.d1 + LABEL_OFF * 2, LABEL_Y, { color: '#444', cx: 0 });
    for (const l of STUDIO.trusses.upper.lines.filter((t) => t.axis === 'd')) {
      mk(g, `${l.id} (${l.at >= 0 ? '+' : ''}${num(l.at.toFixed(2).replace('.', ','))})`, R.x1 + TRUSS_LABEL_X_OFF, l.at, STUDIO.trusses.upper.y0, { color: '#2b4c7e' });
    }
  }
  return g;
}
