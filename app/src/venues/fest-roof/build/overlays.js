// Размерные линии и метровая сетка Сцены под крышей.
import * as THREE from 'three';
import { ROOF } from '../config/dimensions.js';
import { buildDimsFromList, fmtM } from '../../../core/overlays.js';
import { clipSegmentToRects } from '../../../core/geom.js';

// Визуальные константы: отступы размерных линий и подписей от стен, м
const OFF = 0.35;
const LABEL_OFF = 0.55;
const FLOOR_Y = 0.03;

/** Список размеров: [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1]. */
export function dimList() {
  const R = ROOF.room, T = ROOF.trusses, K = ROOF.capital;
  const col = ROOF.columns.filter((c) => !c.embedded && c.x > 0).map((c) => c.d).sort((a, b) => a - b);
  const wall1 = ROOF.walls.find((w) => w.id === '1');
  return [
    // габарит помещения: ширина (стена 13 / стена 1) и глубина (стена 13 → стена 8)
    [[R.x0, FLOOR_Y, wall1.at - OFF], [R.x1, FLOOR_Y, wall1.at - OFF], `Ширина ${fmtM(R.x1 - R.x0)}`],
    [[2, FLOOR_Y, R.d0], [2, FLOOR_Y, R.d1], `Глубина ${fmtM(R.d1 - R.d0)}`, 0.4],
    // шаг колонн
    [[5.2, FLOOR_Y, col[0]], [5.2, FLOOR_Y, col[1]], `Колонны ${fmtM(col[1] - col[0])}`],
    // отметки: потолок, капитальные балки, низ ферм
    [[-4, 0, 6.5], [-4, R.ceiling, 6.5], `Потолок ${fmtM(R.ceiling)}`],
    [[-3.4, 0, 6.5], [-3.4, K.y0, 6.5], `Балки ${fmtM(K.y0)}`, 0.6],
    [[-2.8, 0, 6.5], [-2.8, T.y0, 6.5], `Фермы ${fmtM(T.y0)}`, 0.35],
    // сетка ферм
    [[-2.5, T.y0 - 0.1, 7.5], [0, T.y0 - 0.1, 7.5], `Ячейка ${fmtM(2.5)}`],
  ];
}

export function buildDims(labels) {
  return buildDimsFromList(labels, dimList());
}

export function buildGrid(labels) {
  const R = ROOF.room;
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  const seg = (a, b, y) => { for (const [p, q] of clipSegmentToRects(a, b, ROOF.rects)) v.push(p[0], y, -p[1], q[0], y, -q[1]); };
  for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) if (x !== 0) seg([x, R.d0], [x, R.d1], 0.006);
  for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) if (d !== 0) seg([R.x0, d], [R.x1, d], 0.006);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));

  // ось X = 0 и нулевая линия d = 0
  const ax = [];
  for (const [p, q] of clipSegmentToRects([0, R.d0], [0, R.d1], ROOF.rects)) ax.push(p[0], 0.01, -p[1], q[0], 0.01, -q[1]);
  for (const [p, q] of clipSegmentToRects([R.x0, 0], [R.x1, 0], ROOF.rects)) ax.push(p[0], 0.01, -p[1], q[0], 0.01, -q[1]);
  const axg = new THREE.BufferGeometry();
  axg.setAttribute('position', new THREE.Float32BufferAttribute(ax, 3));
  g.add(new THREE.LineSegments(axg, new THREE.LineBasicMaterial({ color: 0xff5a36 })));

  if (labels) {
    const xl = new THREE.Group();
    xl.name = 'grid:x';
    g.add(xl);
    g.userData.xLabels = xl;
    const mk = (parent, text, x, d, y = 0.02, opts = {}) => {
      const s = labels.make(text, { px: 22, color: '#c8352a', bg: 'rgba(255,255,255,0.92)', kind: 'grid', depthTest: false, ...opts });
      s.position.set(x, y, -d);
      s.renderOrder = 11;
      parent.add(s);
    };
    const num = (n) => String(n).replace('-', '−');
    for (let x = Math.ceil(R.x0 / 2) * 2; x <= R.x1; x += 2) mk(xl, num(x), x, R.d1 + LABEL_OFF);
    mk(xl, 'м от оси рядов', R.x1 + 1.2, R.d1 + LABEL_OFF, 0.02, { color: '#444' });
    for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) mk(g, num(d), R.x0 - LABEL_OFF, d);
    mk(g, ROOF.zeroLineLabel, R.x0 - LABEL_OFF, R.d1 + LABEL_OFF * 2, 0.02, { color: '#444', cx: 0 });
    // подписи поперечных линий ферм справа за стеной
    for (const l of ROOF.trusses.lines.filter((t) => t.axis === 'd' && !t.extra)) {
      mk(g, `ферма d ${l.at >= 0 ? '+' : ''}${num(String(l.at).replace('.', ','))}`, R.x1 + 0.9, l.at, ROOF.trusses.y0, { color: '#2b4c7e' });
    }
  }
  return g;
}
