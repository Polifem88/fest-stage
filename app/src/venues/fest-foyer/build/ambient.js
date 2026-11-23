// Точечные источники дежурного света Фойе для LightingSystem.
// Размещаются ниже потолка 1-го этажа и ниже плоскости ферм 2-го этажа,
// чтобы конструкции не перекрывали свет дежурки.
import * as THREE from 'three';
import { P } from '../../../core/geom.js';
import { FOYER } from '../config/dimensions.js';

// Визуальные отступы точечных источников вниз от потолка/ферм, м
const BELOW_CEIL_1F = 0.38;
const BELOW_TRUSS_2F = 0.60;
const QUARTER_SPAN = 0.25;

/**
 * @param {'full'|'lite'} plan
 * @param {{ dutyPoints?: THREE.Vector3[] }} em  результат buildEmitters
 * @returns {{ duty: THREE.PointLight[], blue: THREE.Light[], house: THREE.Light[] }}
 */
export function ambientLights(plan, em) {
  void em;
  const A = FOYER.ambient.duty;
  const R = FOYER.room;
  const AT = FOYER.atrium;
  const C1 = FOYER.ceil1;
  const T = FOYER.trusses;

  const xMid = (R.x0 + R.x1) / 2;
  const xSpan = R.x1 - R.x0;
  const xLeft = R.x0 + xSpan * QUARTER_SPAN;
  const xRight = R.x1 - xSpan * QUARTER_SPAN;

  const dWin = (R.dGlass1 + AT.westD) / 2;
  const dAtr = (AT.westD + AT.eastD) / 2;
  const dGal = (AT.eastD + R.dWall2) / 2;

  const y1f = C1.reception - BELOW_CEIL_1F;
  const y2fWin = T.windowY0 - BELOW_TRUSS_2F;
  const y2fAtr = T.atriumY0 - BELOW_TRUSS_2F;
  const y2fGal = T.wallY0 - BELOW_TRUSS_2F;

  const positions = plan === 'full'
    ? [
        P(xLeft, y1f, dWin),   // 1-й этаж: оконная галерея / зона отдыха и стойка B1
        P(xMid, y1f, dAtr),    // 1-й этаж: атриум и парадная лестница
        P(xMid, y2fWin, dWin), // 2-й этаж: оконная галерея у витража ВБ3
        P(xLeft, y2fAtr, dAtr), // 2-й этаж: атриум и верх лестницы / мостик буфета
        P(xMid, y2fGal, dGal), // 2-й этаж: галерея витрин и коридоров
        P(xRight, y2fAtr, dAtr), // 2-й этаж: терраса LED-экрана
      ]
    : [
        P(xMid, y1f, (dWin + dAtr) / 2), // 1-й этаж (центр)
        P(xMid, y2fAtr, dAtr),           // 2-й этаж (центр)
      ];

  const base = plan === 'full' ? A.full : A.lite;
  const duty = positions.map((pos) => {
    const L = new THREE.PointLight(A.color, 0, 0, A.decay);
    L.position.copy(pos);
    L.userData.base = base;
    return L;
  });

  return { duty, blue: [], house: [] };
}
