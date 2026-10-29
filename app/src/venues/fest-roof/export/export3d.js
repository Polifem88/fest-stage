// =============================================================================
//  3D-ЭКСПОРТ СЦЕНЫ ПОД КРЫШЕЙ — с текущей планировкой зала:
//    1. build3DDXF(stage) — 3D-модель в AutoCAD DXF (WCS: Z — высота), 3DFACE и LINE
//    2. buildGLB(stage)   — 3D-модель в Binary glTF 2.0 (.glb), материалы односторонние
//  Строится теми же построителями, что и сцена (build/*), без лучей и пятен.
// =============================================================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOF } from '../config/dimensions.js';
import { TYPES } from '../config/fixtures.js';
import { seatCount } from '../config/layouts.js';
import { StaticBatch } from '../../../core/geom.js';
import { DxfWriter } from '../../../export/dxfWriter.js';
import { buildArchitecture } from '../build/architecture.js';
import { buildTrusses } from '../build/trusses.js';
import { buildEmitters, buildMolton } from '../build/emitters.js';
import { buildHall } from '../build/hall.js';
import { exportState } from './dxf2d.js';

/** Three (x, y, z = −d) → AutoCAD WCS (X = x, Y = d, Z = высота). */
const toCad = (v) => [v.x, -v.z, v.y];

// Цвета материалов выгрузки (без текстур — DXF/GLB открываются где угодно)
const COLORS = {
  floor: 0x1d1f23, brickRed: 0x8e4a2e, blackWall: 0x181a1d, door: 0x282a2f, attic: 0x0e0e0f, mesh: 0x55575a,
  steel: 0x3b404a, steelGray: 0x6d7076, deckRibbed: 0x2b2d31, truss: 0x2b2f38, aluDeck: 0x9a9ea3,
  seatFabric: 0xc4602a, seatFrame: 0x1d1a18, fixtureBody: 0x252830, dutyBulb: 0xffe0a3, molton: 0x0e0e10,
};
/** Материалы по имени (как в core/materials.js), односторонние. */
function exportMaterials() {
  const cache = {};
  return new Proxy({}, {
    get: (_, name) => (cache[name] ||= new THREE.MeshStandardMaterial({ name: String(name), color: COLORS[name] ?? 0x808080, roughness: 0.8, metalness: 0.1, side: THREE.FrontSide })),
  });
}

/** Статика площадки: { walls, ceiling, trusses } группы. */
function staticLayers(M, mobile) {
  const batch = new StaticBatch();
  buildArchitecture(batch, M, { mobile });
  buildTrusses(batch, M, { mobile });
  return batch.build();
}

/** Внешняя оболочка (стены, пол, настил) — на отключаемый слой 3D_OUTER_WALLS. */
const isOuter = (mesh) => /^(wall|floor|deck)/.test(mesh.userData?.tag || '');

function writeGeometry(dxf, geom, layer, matrix = null) {
  if (!geom?.attributes?.position) return;
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    if (matrix) { a.applyMatrix4(matrix); b.applyMatrix4(matrix); c.applyMatrix4(matrix); }
    dxf.add3DFace(toCad(a), toCad(b), toCad(c), toCad(c), { layer });
  }
  if (g !== geom) g.dispose();
}

/** Меши группы (InstancedMesh — по экземплярам) → callback(geometry, matrixWorld, mesh). */
function eachMesh(root, fn) {
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), w = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); fn(o.geometry, w.multiplyMatrices(o.matrixWorld, m), o); }
    } else fn(o.geometry, o.matrixWorld, o);
  });
}

// =============================================================================
//  1. 3D DXF
// =============================================================================
export function build3DDXF(stage) {
  const { layout, fixtures } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: true });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('3D_OUTER_WALLS', { color: 8, off: true })
    .addLayer('3D_WALLS', { color: 7 })
    .addLayer('3D_CEILING', { color: 9 })
    .addLayer('3D_TRUSSES', { color: 5 })
    .addLayer('3D_HALL', { color: 30 })
    .addLayer('3D_DOMES', { color: 2 })
    .addLayer('3D_MOLTON', { color: 8 })
    .addLayer('3D_FIXTURES', { color: 8 });
  const R = ROOF.room;
  dxf.addLine3D([0, R.d0, 0], [0, R.d1, 0], { layer: '0_AXES' });
  dxf.addLine3D([R.x0, 0, 0], [R.x1, 0, 0], { layer: '0_AXES' });

  const M = exportMaterials();
  const L = staticLayers(M, true);
  const map = { walls: '3D_WALLS', ceiling: '3D_CEILING', trusses: '3D_TRUSSES' };
  for (const [k, layer] of Object.entries(map)) {
    if (!L[k]) continue;
    eachMesh(L[k], (g, mw, mesh) => writeGeometry(dxf, g, isOuter(mesh) ? '3D_OUTER_WALLS' : layer, mw));
  }
  eachMesh(buildHall(layout, { M }), (g, mw) => writeGeometry(dxf, g, '3D_HALL', mw));
  eachMesh(buildEmitters(M).groups.duty, (g, mw) => writeGeometry(dxf, g, '3D_DOMES', mw));
  eachMesh(buildMolton(M), (g, mw) => writeGeometry(dxf, g, '3D_MOLTON', mw));

  // приборы: корпус-коробка под точкой подвеса, подвес и номер
  const box = new THREE.BoxGeometry(0.22, 0.22, 0.26);
  const m4 = new THREE.Matrix4();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const sc = TYPES[f.type].scale || 1;
    const mount = new THREE.Vector3(f.mount.x, f.mount.y, -f.mount.d);
    const head = mount.clone().setY(mount.y - 0.24);
    m4.compose(head, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    writeGeometry(dxf, box, '3D_FIXTURES', m4);
    dxf.addLine3D(toCad(mount), toCad(head), { layer: '3D_FIXTURES' });
    dxf.addText(f.mount.x, f.mount.d, String(f.no), { layer: '3D_FIXTURES', z: f.mount.y + 0.12, height: 0.13, align: 'center' });
  }
  box.dispose();
  return dxf.toString();
}

// =============================================================================
//  2. GLB
// =============================================================================
/** Геометрия без NaN и вырожденных треугольников (в мировых координатах). */
function clean(geom, matrix) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  if (matrix) g.applyMatrix4(matrix);
  const p = g.attributes.position;
  const out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    if (![a, b, c].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))) continue;
    if (ab.subVectors(b, a).cross(ac.subVectors(c, a)).lengthSq() < 1e-12) continue;
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  g.dispose();
  if (out.length < 9) return null;
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  r.computeVertexNormals();
  return r;
}

/** Слить меши группы по материалу → группа с именем name. */
function bake(root, name, M) {
  const byMat = new Map();
  eachMesh(root, (g, mw, mesh) => {
    const c = clean(g, mw);
    if (!c) return;
    const k = mesh.material?.name || 'steel';
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(c);
  });
  const grp = new THREE.Group();
  grp.name = name;
  for (const [k, list] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), M[k]);
    mesh.name = `${name}_${k}`;
    grp.add(mesh);
    for (const g of list) g.dispose();
  }
  return grp;
}

export function buildExportSceneForGLTF(stage) {
  const { layout, fixtures } = exportState(stage);
  const M = exportMaterials();
  const root = new THREE.Scene();
  root.name = 'FEST_Roof_Stage';
  const L = staticLayers(M, false);
  const names = { walls: 'Architecture_Walls_Columns_Braces', ceiling: 'Ceiling_Capital_Beams_Diagonals', trusses: 'Trusses_30x30_And_Legs' };
  for (const [k, n] of Object.entries(names)) if (L[k]) root.add(bake(L[k], n, M));
  const hall = buildHall(layout, { M });
  const hallGrp = bake(hall, `Hall_${layout.id}`, M);
  const seats = new THREE.Group();
  seats.name = `Seats_${seatCount(layout)}`;
  hallGrp.add(seats);
  root.add(hallGrp);
  root.add(bake(buildEmitters(M).groups.duty, 'Duty_Domes_20', M));
  root.add(bake(buildMolton(M), 'Molton', M));

  // приборы: упрощённые корпуса под точками подвеса
  const fx = new THREE.Group();
  fx.name = `Stage_Lighting_Fixtures_${fixtures.filter((f) => !f.hidden).length}`;
  const m4 = new THREE.Matrix4();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const sc = TYPES[f.type].scale || 1;
    m4.compose(new THREE.Vector3(f.mount.x, f.mount.y - 0.24, -f.mount.d), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    const g = clean(new THREE.BoxGeometry(0.22, 0.22, 0.26), m4);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, M.fixtureBody);
    mesh.name = `Fixture_${String(f.no)}_${f.type}_${f.group}`;
    mesh.userData = { no: String(f.no), type: f.type, group: f.group };
    fx.add(mesh);
  }
  root.add(fx);
  root.updateMatrixWorld(true);
  return root;
}

export function buildGLB(stage) {
  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReader {
      readAsArrayBuffer(blob) { blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); }); }
    };
  }
  const scene = buildExportSceneForGLTF(stage);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => (result instanceof ArrayBuffer ? resolve(result) : reject(new Error('GLTFExporter: не бинарный результат'))),
      (err) => reject(err || new Error('GLTFExporter: ошибка')),
      { binary: true, onlyVisible: true },
    );
  });
}
