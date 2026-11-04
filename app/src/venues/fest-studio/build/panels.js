// Раскладка UV для мелкоперфорированных ореховых панелей стен и потолка.
// В отличие от worldUV (один масштаб на обе оси), здесь модуль прямоугольный (1,22 × 2,42 или 1,22 × 0,62)
// и имеет заданное начало отсчёта (u0, v0) по швам нащельников.
import * as THREE from 'three';

/**
 * Проставляет UV по доминирующей нормали: u = (coordU − u0) / du, v = (coordV − v0) / dv.
 *  • горизонтальная грань (|ny| ≥ |nx|, |nz|): coordU = x, coordV = z (−d);
 *  • продольная стена (|nx| ≥ |nz|): coordU = z (−d), coordV = y;
 *  • поперечная стена (|nz| > |nx|): coordU = x, coordV = y.
 * Поддерживает одну геометрию или массив геометрий.
 */
export function panelUV(g, { du, dv, u0 = 0, v0 = 0 }) {
  if (Array.isArray(g)) return g.map((item) => panelUV(item, { du, dv, u0, v0 }));
  if (!g) return g;
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = (u - u0) / du;
    uv[i * 2 + 1] = (v - v0) / dv;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
