// Параметрическая циклорама Студии мультимедиа (слой cyc):
// 11 сопряжённых без щелей участков — плоский пол, 3 четверти цилиндра R = 0,70 внизу,
// две ⅛ сферы R = 0,70 в нижних задних углах, задняя и две боковые стенки, две вертикальные дуги R = 0,70.
// Лицевая сторона и аналитические нормали обращены внутрь циклорамы.
import * as THREE from 'three';
import { STUDIO } from '../config/dimensions.js';

// Визуальные константы
export const FLOOR_LIFT = 0.003; // подъём белого пола циклорамы над серым полом против z-fighting
const ARC_SEG = { desktop: 16, mobile: 8 };

/** Аналитическая внутренняя нормаль в точке (x, y, d) скруглённой оболочки циклорамы. */
function inwardNormal(x, y, d, c, lift = FLOOR_LIFT) {
  const r = c.r, ry = r - lift;
  const cx = x < c.x0 + r ? c.x0 + r : x > c.x1 - r ? c.x1 - r : x;
  const cd = d > c.d1 - r ? c.d1 - r : d;
  const cy = y < r ? r : y;
  const vx = cx - x;
  const vy = ((cy - y) * r) / ry;
  const vz = d - cd; // в Three.js z = −d, вектор к центру −cd − (−d) = d − cd
  const len = Math.hypot(vx, vy, vz) || 1;
  return [vx / len, vy / len, vz / len];
}

/**
 * Строит неиндексированную сетку по параметрической функции pt(u, v) → [x, y, d] (u, v ∈ [0, 1]).
 * Обход треугольников выбирается так, чтобы геометрическая нормаль смотрела внутрь циклорамы.
 */
function buildPatch(nu, nv, pt, c, lift) {
  const grid = [];
  for (let j = 0; j <= nv; j++) {
    const row = [];
    for (let i = 0; i <= nu; i++) row.push(pt(i / nu, j / nv));
    grid.push(row);
  }
  const pos = [];
  const nor = [];
  const pushVert = ([x, y, d]) => {
    pos.push(x, y, -d);
    nor.push(...inwardNormal(x, y, d, c, lift));
  };
  const pushTri = (a, b, dPt) => {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = -b[2] - (-a[2]);
    const acx = dPt[0] - a[0], acy = dPt[1] - a[1], acz = -dPt[2] - (-a[2]);
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    const [nx, ny, nz] = inwardNormal(
      (a[0] + b[0] + dPt[0]) / 3,
      (a[1] + b[1] + dPt[1]) / 3,
      (a[2] + b[2] + dPt[2]) / 3,
      c,
      lift,
    );
    if (cx * nx + cy * ny + cz * nz >= 0) {
      pushVert(a); pushVert(b); pushVert(dPt);
    } else {
      pushVert(a); pushVert(dPt); pushVert(b);
    }
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const p00 = grid[j][i], p10 = grid[j][i + 1];
      const p01 = grid[j + 1][i], p11 = grid[j + 1][i + 1];
      pushTri(p00, p10, p11);
      pushTri(p00, p11, p01);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Возвращает 11 сопряжённых участков циклорамы:
 *  1) плоский пол; 2–3) левая и правая нижние дуги; 4) задняя нижняя дуга;
 *  5–6) левый и правый сферические углы (⅛ сферы); 7) задняя стенка;
 *  8–9) левая и правая боковые стенки; 10–11) левая и правая вертикальные дуги.
 */
export function cycPatches(c = STUDIO.cyc, { arc = ARC_SEG.desktop, lift = FLOOR_LIFT } = {}) {
  const r = c.r, ry = r - lift;
  const cx0 = c.x0 + r, cx1 = c.x1 - r, cd1 = c.d1 - r;
  const lerp = (a, b, t) => a + (b - a) * t;
  const H = Math.PI / 2;
  // точка на нижней дуге по параметру v ∈ [0, 1]: v = 0 — уровень пола (lift), v = 1 — шов y = r
  const yArc = (v) => r - ry * Math.cos(v * H);
  const rArc = (v) => r * Math.sin(v * H);

  return [
    // 1. Плоский пол: x ∈ [cx0, cx1], d ∈ [d0, cd1]
    buildPatch(1, 1, (u, v) => [lerp(cx0, cx1, u), lift, lerp(c.d0, cd1, v)], c, lift),

    // 2. Левая нижняя дуга: x от cx0 до x0, d ∈ [d0, cd1]
    buildPatch(arc, 1, (u, v) => [cx0 - rArc(u), yArc(u), lerp(c.d0, cd1, v)], c, lift),

    // 3. Правая нижняя дуга: x от cx1 до x1, d ∈ [d0, cd1]
    buildPatch(arc, 1, (u, v) => [cx1 + rArc(u), yArc(u), lerp(c.d0, cd1, v)], c, lift),

    // 4. Задняя нижняя дуга: x ∈ [cx0, cx1], d от cd1 до d1
    buildPatch(1, arc, (u, v) => [lerp(cx0, cx1, u), yArc(v), cd1 + rArc(v)], c, lift),

    // 5. Левый нижний задний угол (⅛ сферы, центр (cx0, r, cd1))
    buildPatch(arc, arc, (u, v) => {
      const th = u * H, rr = rArc(v);
      return [cx0 - rr * Math.cos(th), yArc(v), cd1 + rr * Math.sin(th)];
    }, c, lift),

    // 6. Правый нижний задний угол (⅛ сферы, центр (cx1, r, cd1))
    buildPatch(arc, arc, (u, v) => {
      const th = u * H, rr = rArc(v);
      return [cx1 + rr * Math.sin(th), yArc(v), cd1 + rr * Math.cos(th)];
    }, c, lift),

    // 7. Задняя стенка: x ∈ [cx0, cx1], y ∈ [r, h], d = d1
    buildPatch(1, 1, (u, v) => [lerp(cx0, cx1, u), lerp(r, c.h, v), c.d1], c, lift),

    // 8. Левая боковая стенка: x = x0, d ∈ [d0, cd1], y ∈ [r, h]
    buildPatch(1, 1, (u, v) => [c.x0, lerp(r, c.h, v), lerp(c.d0, cd1, u)], c, lift),

    // 9. Правая боковая стенка: x = x1, d ∈ [d0, cd1], y ∈ [r, h]
    buildPatch(1, 1, (u, v) => [c.x1, lerp(r, c.h, v), lerp(c.d0, cd1, u)], c, lift),

    // 10. Левая вертикальная дуга: центр (cx0, cd1), y ∈ [r, h]
    buildPatch(arc, 1, (u, v) => {
      const th = u * H;
      return [cx0 - r * Math.cos(th), lerp(r, c.h, v), cd1 + r * Math.sin(th)];
    }, c, lift),

    // 11. Правая вертикальная дуга: центр (cx1, cd1), y ∈ [r, h]
    buildPatch(arc, 1, (u, v) => {
      const th = u * H;
      return [cx1 + r * Math.sin(th), lerp(r, c.h, v), cd1 + r * Math.cos(th)];
    }, c, lift),
  ];
}

/**
 * Белое заполнение торцов под передними нижними закруглёнными углами циклорамы (d = d0):
 * два криволинейных треугольника между боковой дугой R = 0,70, полом и внешней боковой кромкой.
 */
export function cycFrontCaps(c = STUDIO.cyc, { arc = ARC_SEG.desktop, lift = FLOOR_LIFT } = {}) {
  const r = c.r, ry = r - lift;
  const cx0 = c.x0 + r, cx1 = c.x1 - r;
  const H = Math.PI / 2;
  const yArc = (u) => r - ry * Math.cos(u * H);
  const rArc = (u) => r * Math.sin(u * H);
  const z0 = -c.d0;

  const makeCap = (cornerX, ptX, reverse) => {
    const pos = [], nor = [];
    for (let i = 0; i < arc; i++) {
      const u0 = i / arc, u1 = (i + 1) / arc;
      const xA = ptX(u0), yA = yArc(u0);
      const xB = ptX(u1), yB = yArc(u1);
      if (reverse) {
        pos.push(cornerX, lift, z0, xB, yB, z0, xA, yA, z0);
      } else {
        pos.push(cornerX, lift, z0, xA, yA, z0, xB, yB, z0);
      }
      // нормаль наклонена вверх к потолочным светильникам, чтобы торец освещался в тон дуге циклорамы
      nor.push(0, 0.82, 0.57, 0, 0.82, 0.57, 0, 0.82, 0.57);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  };

  return [
    makeCap(c.x0, (u) => cx0 - rArc(u), false),
    makeCap(c.x1, (u) => cx1 + rArc(u), true),
  ];
}

export function buildCyclorama(batch, M, { mobile = false } = {}) {
  const arc = mobile ? ARC_SEG.mobile : ARC_SEG.desktop;
  batch.add('cyc', M.cyc, [
    ...cycPatches(STUDIO.cyc, { arc }),
    ...cycFrontCaps(STUDIO.cyc, { arc }),
  ], { tag: 'cyc' });
}
