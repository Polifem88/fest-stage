// Дежурный и зальный свет Большой сцены — настоящие источники для LightingSystem.
// Положения ламп приходят из buildEmitters (architecture.js), высота потолка зала — из DIM.
import * as THREE from 'three';
import { DIM } from '../config/dimensions.js';

const DUTY_GAIN = 0.6;

/**
 * @param plan 'full' | 'lite' (профиль устройства)
 * @param em   результат buildEmitters: { dutyPoints (по 4 на линию ДО), blueX }
 * @returns { duty, blue, house } — массивы THREE-источников (яркость включения — userData.base)
 */
export function ambientLights(plan, em) {
  // дежурный свет: по одной «лампе» на линию ДО (в лёгком профиле — одна на все)
  const dp = em.dutyPoints;
  const rows = plan === 'full' ? [0, 1, 2] : [1];
  const duty = rows.map((r) => {
    const pts = dp.slice(r * 4, r * 4 + 4);
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const L = new THREE.PointLight(0xffe2b0, 0, 0, 1.4);
    L.position.copy(c).add(new THREE.Vector3(0, -0.3, 0));
    L.userData.base = (plan === 'full' ? 34 : 70) * DUTY_GAIN;
    return L;
  });
  // синие приборы у задней стены
  const bluePts = plan === 'full' ? em.blueX : [em.blueX[1]];
  const blue = bluePts.map((p) => {
    const L = new THREE.SpotLight(0x3348ff, 0, 7, Math.PI / 3.2, 0.8, 1.5);
    L.position.copy(p);
    L.target.position.set(p.x, 0, p.z + 0.15);
    L.userData.base = plan === 'full' ? 9 : 22;
    return L;
  });
  // свет в зале
  const hallPts = plan === 'full' ? [[-4, -9], [4, -9], [0, -15]] : [[0, -11]];
  const house = hallPts.map(([x, d]) => {
    const L = new THREE.SpotLight(0xfff0d6, 0, 0, Math.PI / 2.6, 0.9, 1.3);
    L.position.set(x, DIM.hall.ceilingY - 0.2, -d);
    L.target.position.set(x, -1, -d);
    L.userData.base = plan === 'full' ? 120 : 260;
    return L;
  });
  return { duty, blue, house };
}
