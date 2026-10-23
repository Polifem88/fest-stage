// Размерные линии с подписями и метровая координатная сетка Камерной сцены.
import * as THREE from 'three';
import { CHAMBER, ALL_TRUSSES } from '../config/dimensions.js';
import { buildDimsFromList } from '../../../core/overlays.js';

const fmt = (m) => `${m.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} м`;

/** Список размеров: [p1(x,y,d), p2(x,y,d), подпись, положение подписи 0…1] */
export function dimList() {
  const S = CHAMBER.stage;
  const H = CHAMBER.hall;
  const RG = CHAMBER.rigels;
  const T = CHAMBER.trusses;
  const C = CHAMBER.columns;
  return [
    // Просвет между портальными колоннами и высота до ригеля
    [[C.frontLeft.x1, RG.bottomY + 0.15, -0.05], [C.frontRight.x0, RG.bottomY + 0.15, -0.05], `Просвет колонн ${fmt(S.portalWidth)}`],
    [[C.frontLeft.x1 + 0.35, 0, -0.05], [C.frontLeft.x1 + 0.35, RG.bottomY, -0.05], `Ригель ${fmt(RG.bottomY)}`, 0.45],
    // Ширина сцены (14,00 м, включая левый карман 2,50 м) и глубина сцены (9,75 м)
    [[S.x0, 0.03, S.d1 - 0.5], [S.x1, 0.03, S.d1 - 0.5], `Сцена с карманом ${fmt(S.width)}`],
    [[S.x0, 0.03, 0.35], [H.x0, 0.03, 0.35], `Карман ${fmt(H.x0 - S.x0)}`],
    [[0, 0.03, 0], [0, 0.03, S.d1], `Глубина сцены ${fmt(S.d1)}`, 0.55],
    // Пролёт между передними и задними колоннами (6,15 м)
    [[S.x1 - 0.4, 0.03, 0], [S.x1 - 0.4, 0.03, RG.back.d0], `Между колоннами ${fmt(RG.back.d0)}`],
    // Высота потолка (4,40 м) и высота нижнего пояса ферм (3,75 м)
    [[S.x1 - 0.85, 0, 3.35], [S.x1 - 0.85, S.ceiling, 3.35], `Потолок ${fmt(S.ceiling)}`],
    [[-3.2, 0, 1.85], [-3.2, T.bottomY, 1.85], `Фермы ${fmt(T.bottomY)}`, 0.65],
    // Ширина зала (11,70 м), глубина зала (6,65 м), верхний ярус (+1,50 м) и операторская (4,60 × 1,70 м)
    [[H.x0, H.topPlatformY + 0.04, H.backWallD + 0.35], [H.x1, H.topPlatformY + 0.04, H.backWallD + 0.35], `Зал ${fmt(H.width)}`],
    [[H.x1 - 0.45, 0.03, H.backWallD], [H.x1 - 0.45, 0.03, 0], `Зал ${fmt(-H.backWallD)}`, 0.35],
    [[2.8, 0, H.topPlatformD1], [2.8, H.topPlatformY, H.topPlatformD1], `Ярус 7-го ряда ${fmt(H.topPlatformY)}`],
    [[H.booth.x0, H.topPlatformY + 0.06, H.topPlatformD1 - 0.15], [H.booth.x1, H.topPlatformY + 0.06, H.topPlatformD1 - 0.15], `Операторская ${fmt(H.booth.x1 - H.booth.x0)}`],
  ];
}

export function buildDims(labels) {
  return buildDimsFromList(labels, dimList());
}

export function buildGrid(labels) {
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  const S = CHAMBER.stage;
  const H = CHAMBER.hall;

  // Продольные линии (постоянный X)
  for (let x = Math.ceil(S.x0); x <= Math.floor(H.x1); x++) {
    const dMin = x < H.x0 ? 0 : H.firstStepD;
    const dMax = x > S.x1 ? 0 : S.d1;
    if (dMax > dMin) v.push(x, 0.006, -dMin, x, 0.006, -dMax);
  }
  // Поперечные линии (постоянный d) на уровне планшета (d >= -0,45)
  for (let d = 0; d <= Math.floor(S.d1); d++) {
    v.push(S.x0, 0.006, -d, S.x1, 0.006, -d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));

  // Ось зала (X = 0) и нулевая линия портала (d = 0)
  const ax = new THREE.BufferGeometry();
  ax.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.01, -H.firstStepD, 0, 0.01, -S.d1,
    S.x0, 0.01, 0, H.x1, 0.01, 0,
  ], 3));
  g.add(new THREE.LineSegments(ax, new THREE.LineBasicMaterial({ color: 0xff5a36 })));

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
    for (let x = -8; x <= 4; x += 2) mk(xl, num(x), x, S.d1 + 0.45);
    mk(xl, 'м от оси зала', S.x1 + 1.1, S.d1 + 0.45, 0.02, { color: '#444' });
    for (let d = -6; d <= 9; d++) mk(g, num(d), S.x0 - 0.55, d);
    mk(g, CHAMBER.zeroLineLabel, S.x0 - 0.55, S.d1 + 1.05, 0.02, { color: '#444', cx: 0 });

    // Подписи ферм Ф1–Ф9 и ЗФ1–ЗФ3 справа за стеной на плане
    for (const tr of ALL_TRUSSES) {
      mk(g, `${tr.name} (${tr.d >= 0 ? '+' : ''}${num(tr.d.toFixed(2).replace('.', ','))})`, H.x1 + 0.65, tr.d, CHAMBER.trusses.bottomY, { color: '#2b4c7e' });
    }
  }
  return g;
}
