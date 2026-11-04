// Дежурный свет Студии мультимедиа — 12 круглых потолочных светильников, встроенных в панели потолка.
// Светящиеся диски — один меш, прямой потомок groups.duty с userData.emitter = 'duty'
// (Stage._applyFlags обходит только прямых потомков). Зального света нет — groups.house пустая.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../../../core/geom.js';
import { STUDIO } from '../config/dimensions.js';

// Визуальные константы
const DISC_SEG = 16;
const RIM_H = 0.014; // высота ободка врезного светильника под плоскостью потолка
const DISC_EPS = 0.002; // смещение светящегося диска ниже ободка

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

/** @returns {{ groups: { duty: THREE.Group, house: THREE.Group }, dutyPoints: THREE.Vector3[], dutyRows: THREE.Vector3[][] }} */
export function buildEmitters(M) {
  const D = STUDIO.duty, C = STUDIO.room.ceiling;
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';

  const rims = [], discs = [], dutyPoints = [];
  const yDisc = C - RIM_H - DISC_EPS;
  for (const p of D.list) {
    rims.push(
      new THREE.CylinderGeometry(D.r, D.r, RIM_H, DISC_SEG, 1, true).translate(p.x, C - RIM_H / 2, -p.d),
      new THREE.CircleGeometry(D.r, DISC_SEG).rotateX(Math.PI / 2).translate(p.x, C - RIM_H, -p.d),
    );
    discs.push(new THREE.CircleGeometry(D.r * 0.84, DISC_SEG).rotateX(Math.PI / 2).translate(p.x, yDisc, -p.d));
    dutyPoints.push(P(p.x, yDisc, p.d));
  }

  const rimMesh = new THREE.Mesh(mergeAll(rims), M.steelGray);
  rimMesh.name = 'dutyRims';
  rimMesh.userData.static = true;
  rimMesh.userData.layer = 'duty';

  const glowMesh = new THREE.Mesh(mergeAll(discs), M.dutyBulb);
  glowMesh.name = 'dutyDiscs';
  glowMesh.userData.emitter = 'duty';

  groups.duty.add(rimMesh, glowMesh);
  for (const g of Object.values(groups)) g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });

  // Группируем точки по глубине d (7 поперечных рядов) для источников LightingSystem
  const byD = new Map();
  for (let i = 0; i < D.list.length; i++) {
    const key = D.list[i].d;
    if (!byD.has(key)) byD.set(key, []);
    byD.get(key).push(dutyPoints[i]);
  }
  const dutyRows = [...byD.entries()].sort((a, b) => a[0] - b[0]).map(([, pts]) => pts);
  return { groups, dutyPoints, dutyRows };
}
