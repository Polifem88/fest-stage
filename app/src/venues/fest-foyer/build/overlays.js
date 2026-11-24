// Размерные линии и метровая координатная сетка Фойе.
import * as THREE from 'three';
import { FOYER } from '../config/dimensions.js';
import { buildDimsFromList, fmtM } from '../../../core/overlays.js';

// Визуальные константы: высоты и отступы размерных линий и подписей, м
const FLOOR_Y = 0.03;
const GRID_Y = 0.006;
const AXIS_Y = 0.01;
const LABEL_Y = 0.02;
const OFF = 0.45;
const LABEL_OFF = 0.65;
const TRUSS_LABEL_X_OFF = 1.05;
const LABEL_STEP = 2;

/** Список размеров: [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1]. */
export function dimList() {
  const R = FOYER.room;
  const C2 = FOYER.ceil2;
  const AT = FOYER.atrium;
  const xH = R.x0 + OFF * 2;
  const dShelfMid = (C2.shelfFromD + C2.rampFromD) / 2;
  const dAtrMid = (AT.westD + AT.eastD) / 2;

  return [
    // Горизонтальные габариты
    [[R.x0, FLOOR_Y, R.dGlass1 + OFF], [R.x1, FLOOR_Y, R.dGlass1 + OFF], `Ширина ${fmtM(R.x1 - R.x0)}`],
    [[R.x0 + OFF, FLOOR_Y, R.dGlass2], [R.x0 + OFF, FLOOR_Y, R.dWall2], `Глубина 2 эт. ${fmtM(R.dWall2 - R.dGlass2)}`, 0.34],
    [[AT.westX0 + OFF, R.y2 + FLOOR_Y, AT.westD], [AT.westX0 + OFF, R.y2 + FLOOR_Y, AT.eastD], `Второй свет ${fmtM(AT.eastD - AT.westD)}`],
    // Вертикальные отметки (разнесены по d для чистого чтения на разрезе сбоку)
    [[xH, 0, R.dGlass2 + OFF], [xH, C2.glassY, R.dGlass2 + OFF], `Витраж ВБ3 ${fmtM(C2.glassY)}`, 0.62],
    [[xH, 0, C2.shelfFromD], [xH, R.y2, C2.shelfFromD], `2-й этаж ${fmtM(R.y2)}`, 0.5],
    [[xH, 0, dShelfMid], [xH, C2.shelfY, dShelfMid], `Потолок окон ${fmtM(C2.shelfY)}`, 0.62],
    [[xH, 0, dAtrMid], [xH, C2.atriumY, dAtrMid], `Атриум ${fmtM(C2.atriumY)}`, 0.58],
    [[xH, 0, R.dWall2 - OFF], [xH, C2.wallY, R.dWall2 - OFF], `Галерея ${fmtM(C2.wallY)}`, 0.58],
  ];
}

export function buildDims(labels) {
  return buildDimsFromList(labels, dimList());
}

export function buildGrid(labels) {
  const R = FOYER.room;
  const g = new THREE.Group();
  g.name = 'grid';

  const v = [];
  for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) {
    if (x !== 0) v.push(x, GRID_Y, -R.dGlass2, x, GRID_Y, -R.dWall2);
  }
  for (let d = Math.ceil(R.dGlass2); d <= Math.floor(R.dWall2); d++) {
    if (d !== 0) v.push(R.x0, GRID_Y, -d, R.x1, GRID_Y, -d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));

  // Ось X = 0 (ось Г) и нулевая линия d = 0 (витраж ВБ6)
  const axg = new THREE.BufferGeometry();
  axg.setAttribute('position', new THREE.Float32BufferAttribute([
    0, AXIS_Y, -R.dGlass2, 0, AXIS_Y, -R.dWall2,
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
    const xStart = Math.ceil(R.x0 / LABEL_STEP) * LABEL_STEP;
    for (let x = xStart; x <= Math.floor(R.x1); x += LABEL_STEP) mk(xl, num(x), x, R.dWall2 + LABEL_OFF);
    mk(xl, 'м от оси Г', (R.x0 + R.x1) / 2 + 3.0, R.dWall2 + LABEL_OFF * 2, LABEL_Y, { color: '#444' });

    for (let d = 0; d <= Math.floor(R.dWall2); d += LABEL_STEP) mk(g, num(d), R.x0 - LABEL_OFF, d);
    mk(g, FOYER.zeroLineLabel, R.x0 - LABEL_OFF, R.dWall2 + LABEL_OFF * 2, LABEL_Y, { color: '#444', cx: 0 });

    for (const l of FOYER.trusses.longitudinal) {
      mk(
        g,
        `${l.id} (${l.at >= 0 ? '+' : ''}${num(l.at.toFixed(2).replace('.', ','))})`,
        R.x1 + TRUSS_LABEL_X_OFF,
        l.at,
        l.y0,
        { color: '#2b4c7e' },
      );
    }
  }
  return g;
}
