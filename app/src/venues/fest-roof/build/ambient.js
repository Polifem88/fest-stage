// Дежурный свет Сцены под крышей — настоящие источники для LightingSystem (зального света нет).
import * as THREE from 'three';
import { ROOF } from '../config/dimensions.js';

/** Опустить точечный источник под купол, м (визуальная константа). */
const BELOW_DOME = 0.25;

/**
 * @param {'full'|'lite'} plan
 * @param {{ dutyRows: THREE.Vector3[][] }} em  результат buildEmitters
 * @returns {{ duty: THREE.Light[], blue: THREE.Light[], house: THREE.Light[] }}
 */
export function ambientLights(plan, em) {
  const A = ROOF.ambient.duty;
  const rows = em?.dutyRows || [];
  // full — по источнику на ряд куполов, lite — два (передний и задний ряды)
  const picked = plan === 'full' ? rows : rows.length ? [rows[1] || rows[0], rows[rows.length - 1]] : [];
  const duty = picked.map((pts) => {
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const L = new THREE.PointLight(A.color, 0, 0, A.decay);
    L.position.copy(c).add(new THREE.Vector3(0, -BELOW_DOME, 0));
    L.userData.base = plan === 'full' ? A.full : A.lite;
    return L;
  });
  return { duty, blue: [], house: [] };
}
