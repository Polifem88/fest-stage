// Дежурный свет Сцены под крышей — 20 купольных ламп на тросиках — и мольтон склада декораций.
// Светящиеся диски — один меш, прямой потомок groups.duty с userData.emitter = 'duty' (Stage._applyFlags
// обходит только прямых потомков). Зального света нет (houseLight: false) — groups.house пустая.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../../../core/geom.js';
import { ROOF } from '../config/dimensions.js';

// Визуальные константы
const DOME_SEG = 16;
const DISC_INSET = 0.004; // светящийся диск чуть выше кромки купола
const CABLE_R = 0.004;
const FOLD_AMP = 0.05; // складки мольтона (полуамплитуда)
const FOLD_PITCH = 0.3; // шаг складок

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

/** @returns {{ groups: { duty: THREE.Group, house: THREE.Group }, dutyPoints: THREE.Vector3[], dutyRows: THREE.Vector3[][] }} */
export function buildEmitters(M) {
  const D = ROOF.domes, C = ROOF.room.ceiling;
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';
  const shells = [], discs = [], cables = [];
  const dutyPoints = [];
  for (const p of D.list) {
    // купол — полусфера чашей вниз, кромка на bottomY
    shells.push(new THREE.SphereGeometry(D.r, DOME_SEG, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(p.x, D.bottomY, -p.d));
    discs.push(new THREE.CircleGeometry(D.r * 0.92, DOME_SEG).rotateX(Math.PI / 2).translate(p.x, D.bottomY + DISC_INSET, -p.d));
    cables.push(new THREE.CylinderGeometry(CABLE_R, CABLE_R, C - (D.bottomY + D.r), 4, 1, true).translate(p.x, (C + D.bottomY + D.r) / 2, -p.d));
    dutyPoints.push(P(p.x, D.bottomY, p.d));
  }
  // купол — металлическая чаша (снизу закрыта светящимся диском); в «чертеже» — цвет слоя «Свет (дежурка)» с рёбрами
  const shell = new THREE.Mesh(mergeAll(shells), M.steelGray);
  shell.name = 'dutyDomeShells';
  shell.userData.static = true;
  shell.userData.layer = 'duty';
  const glow = new THREE.Mesh(mergeAll(discs), M.dutyBulb);
  glow.userData.emitter = 'duty';
  glow.name = 'dutyDomes';
  const cableMesh = new THREE.Mesh(mergeAll(cables), M.steel);
  cableMesh.userData.static = true;
  cableMesh.userData.layer = 'duty';
  groups.duty.add(shell, cableMesh, glow);
  for (const g of Object.values(groups)) g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  // ряды куполов по 4 (для групповых источников LightingSystem)
  const dutyRows = [];
  for (let i = 0; i < dutyPoints.length; i += 4) dutyRows.push(dutyPoints.slice(i, i + 4));
  return { groups, dutyPoints, dutyRows };
}

/** Мольтон: вертикальное полотно с волной складок по плоскости d = molton.d. */
export function buildMolton(M) {
  const m = ROOF.molton;
  const w = m.x1 - m.x0, h = m.y1 - m.y0;
  const seg = Math.max(8, Math.round(w / (FOLD_PITCH / 4)));
  const g = new THREE.PlaneGeometry(w, h, seg, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, FOLD_AMP * Math.sin(((x + w / 2) / FOLD_PITCH) * Math.PI * 2));
  }
  g.computeVertexNormals();
  g.translate((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, -m.d);
  const mesh = new THREE.Mesh(g, M.molton);
  mesh.name = 'molton';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.layer = 'molton';
  return mesh;
}
