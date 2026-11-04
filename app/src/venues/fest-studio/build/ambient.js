// Точечные источники дежурного света Студии мультимедиа для LightingSystem.
// Размещаются ниже плоскости низа верхних ферм (5,20), чтобы фермы не отбрасывали теней от дежурки.
import * as THREE from 'three';
import { STUDIO } from '../config/dimensions.js';

/** Смещение точечного источника вниз от светильника на потолке (5,65 − 0,55 ≈ 5,10 < 5,20). */
const BELOW_DISC = 0.55;

/**
 * @param {'full'|'lite'} plan
 * @param {{ dutyRows: THREE.Vector3[][] }} em  результат buildEmitters
 * @returns {{ duty: THREE.PointLight[], blue: THREE.Light[], house: THREE.Light[] }}
 */
export function ambientLights(plan, em) {
  const A = STUDIO.ambient.duty;
  const rows = em?.dutyRows || [];
  const picked = plan === 'full' ? rows : rows.length ? [rows[1] || rows[0], rows[rows.length - 2] || rows[rows.length - 1]] : [];
  const duty = picked.map((pts) => {
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const L = new THREE.PointLight(A.color, 0, 0, A.decay);
    L.position.copy(c).add(new THREE.Vector3(0, -BELOW_DISC, 0));
    L.userData.base = plan === 'full' ? A.full : A.lite;
    return L;
  });
  return { duty, blue: [], house: [] };
}
