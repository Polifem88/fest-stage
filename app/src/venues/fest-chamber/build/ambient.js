// Дежурный и зальный свет Камерной сцены — настоящие источники для LightingSystem.
// Положения светильников приходят из buildEmitters (architecture.js) и CHAMBER.ambient.
import * as THREE from 'three';
import { CHAMBER } from '../config/dimensions.js';

/**
 * @param {'full'|'lite'} plan Профиль устройства
 * @param {{ dutyRows: THREE.Vector3[][] }} em Результат buildEmitters
 * @returns {{ duty: THREE.Light[], blue: THREE.Light[], house: THREE.Light[] }}
 */
export function ambientLights(plan, em) {
  const A = CHAMBER.ambient;
  const rows = em?.dutyRows || [];
  const picked = plan === 'full' ? rows : rows.length ? [rows[0]] : [];
  const duty = picked.map((pts) => {
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const L = new THREE.PointLight(A.duty.color, 0, 0, A.duty.decay);
    L.position.copy(c).add(new THREE.Vector3(0, -0.25, 0));
    L.userData.base = plan === 'full' ? A.duty.full : A.duty.lite;
    return L;
  });

  const housePts = A.house.points[plan === 'full' ? 'full' : 'lite'];
  const house = housePts.map(([x, d]) => {
    const L = new THREE.SpotLight(A.house.color, 0, 0, A.house.angle, 0.9, A.house.decay);
    L.position.set(x, CHAMBER.room.ceiling - 0.12, -d);
    L.target.position.set(x, -1, -d);
    L.userData.base = plan === 'full' ? A.house.full : A.house.lite;
    return L;
  });

  return { duty, blue: [], house };
}
