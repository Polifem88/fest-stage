// Дежурный свет Фойе (Этап 1): встроенные потолочные светильники 1-го и 2-го этажей,
// 4 настенных бра на белой стене за лестницей и 6 линейных подвесов над стойкой буфета.
// Светящиеся элементы — один меш, прямой потомок groups.duty с userData.emitter = 'duty'
// (Stage._applyFlags обходит только прямых потомков). Зального света нет — groups.house пустая.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, P } from '../../../core/geom.js';
import { FOYER, foyerCeilY } from '../config/dimensions.js';

// Визуальные пропорции светильников, м
const DISC_SEG = 12;
const CORD_SEG = 6;
const RIM_H = 0.014;
const DISC_EPS = 0.002;
const DISC_RATIO = 0.84;
const SLOPE_EPS = 0.05;

const SCONCE_W = 0.08;
const SCONCE_H = 0.28;
const SCONCE_DEPTH = 0.06;
const SCONCE_GLOW_W = 0.055;
const SCONCE_GLOW_H = 0.24;
const SCONCE_GLOW_T = 0.012;

const CORD_R = 0.005;
const PENDANT_R = 0.035;
const PENDANT_H = 0.22;

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

function pushDownlight(rims, discs, x, y, d, r, tiltX = 0) {
  const rimSide = new THREE.CylinderGeometry(r, r, RIM_H, DISC_SEG, 1, true).translate(0, -RIM_H / 2, 0);
  const rimCap = new THREE.CircleGeometry(r, DISC_SEG).rotateX(Math.PI / 2).translate(0, -RIM_H, 0);
  const glow = new THREE.CircleGeometry(r * DISC_RATIO, DISC_SEG).rotateX(Math.PI / 2).translate(0, -RIM_H - DISC_EPS, 0);
  if (tiltX !== 0) {
    rimSide.rotateX(tiltX);
    rimCap.rotateX(tiltX);
    glow.rotateX(tiltX);
  }
  rimSide.translate(x, y, -d);
  rimCap.translate(x, y, -d);
  glow.translate(x, y, -d);
  rims.push(rimSide, rimCap);
  discs.push(glow);
}

/** @returns {{ groups: { duty: THREE.Group, house: THREE.Group }, dutyPoints: THREE.Vector3[] }} */
export function buildEmitters(M) {
  const D = FOYER.duty;
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';

  const statics = [];
  const glows = [];
  const dutyPoints = [];

  // 1. Потолочные светильники 1-го этажа (горизонтальный подвесной потолок)
  for (const p of D.downlights1f) {
    pushDownlight(statics, glows, p.x, p.y, p.d, D.r, 0);
    dutyPoints.push(P(p.x, p.y - RIM_H - DISC_EPS, p.d));
  }

  // 2. Потолочные светильники 2-го этажа (высота и наклон строго по foyerCeilY(d))
  for (const p of D.downlights2f) {
    const y = foyerCeilY(p.d);
    const slope = (foyerCeilY(p.d + SLOPE_EPS) - foyerCeilY(p.d - SLOPE_EPS)) / (2 * SLOPE_EPS);
    pushDownlight(statics, glows, p.x, y, p.d, D.r, Math.atan(slope));
    dutyPoints.push(P(p.x, y - RIM_H - DISC_EPS, p.d));
  }

  // 3. 4 настенных бра на белой стене 1-го этажа (d = 14,13, лицом в −d)
  for (const p of D.sconces) {
    statics.push(box(
      p.x - SCONCE_W / 2, p.x + SCONCE_W / 2,
      p.y - SCONCE_H / 2, p.y + SCONCE_H / 2,
      p.d - SCONCE_DEPTH, p.d,
    ));
    glows.push(box(
      p.x - SCONCE_GLOW_W / 2, p.x + SCONCE_GLOW_W / 2,
      p.y - SCONCE_GLOW_H / 2, p.y + SCONCE_GLOW_H / 2,
      p.d - SCONCE_DEPTH - SCONCE_GLOW_T, p.d - SCONCE_DEPTH,
    ));
    dutyPoints.push(P(p.x, p.y, p.d - SCONCE_DEPTH));
  }

  // 4. 6 линейных подвесов над стойкой буфета B2
  for (const p of D.pendants) {
    const yShadeTop = p.yBottom + PENDANT_H;
    const cordLen = Math.max(0.05, p.yTop - yShadeTop);
    statics.push(
      new THREE.CylinderGeometry(CORD_R, CORD_R, cordLen, CORD_SEG, 1, true)
        .translate(p.x, yShadeTop + cordLen / 2, -p.d),
      new THREE.CylinderGeometry(PENDANT_R, PENDANT_R, PENDANT_H, DISC_SEG)
        .translate(p.x, p.yBottom + PENDANT_H / 2, -p.d),
    );
    glows.push(
      new THREE.CircleGeometry(PENDANT_R * DISC_RATIO, DISC_SEG)
        .rotateX(Math.PI / 2)
        .translate(p.x, p.yBottom - DISC_EPS, -p.d),
    );
    dutyPoints.push(P(p.x, p.yBottom - DISC_EPS, p.d));
  }

  const staticMesh = new THREE.Mesh(mergeAll(statics), M.steelGray);
  staticMesh.name = 'dutyFixtures';
  staticMesh.userData.static = true;
  staticMesh.userData.layer = 'duty';

  const glowMesh = new THREE.Mesh(mergeAll(glows), M.dutyBulb);
  glowMesh.name = 'dutyGlow';
  glowMesh.userData.emitter = 'duty';

  groups.duty.add(staticMesh, glowMesh);
  for (const g of Object.values(groups)) {
    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }

  return { groups, dutyPoints };
}
