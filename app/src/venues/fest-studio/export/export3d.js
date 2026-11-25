// =============================================================================
//  3D-ЭКСПОРТ СТУДИИ МУЛЬТИМЕДИА — с текущей планировкой блитчера и высотой фермы ФП:
//    1. build3DDXF(stage) — 3D-модель в AutoCAD DXF (WCS: Z — высота), 3DFACE и LINE
//    2. buildGLB(stage)   — 3D-модель в Binary glTF 2.0 (.glb), материалы односторонние
//  Строится теми же построителями (build/*), без лучей, пятен и невидимых зон захвата.
// =============================================================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STUDIO } from '../config/dimensions.js';
import { TYPES } from '../config/fixtures.js';
import { StaticBatch, cylBetween, P } from '../../../core/geom.js';
import { DxfWriter } from '../../../export/dxfWriter.js';
import { buildArchitecture } from '../build/architecture.js';
import { buildCyclorama } from '../build/cyclorama.js';
import { buildTrusses } from '../build/trusses.js';
import { StudioRigging, hoistPoints } from '../build/rigging.js';
import { buildHall } from '../build/hall.js';
import { buildEmitters } from '../build/emitters.js';
import { exportState } from './dxf2d.js';

/** Three (x, y, z = −d) → AutoCAD WCS (X = x, Y = d, Z = высота). */
const toCad = (v) => [v.x, -v.z, v.y];

const COLORS = {
  floorPoured: 0x5c6066,
  walnutWall: 0x8d6749,
  walnutCeil: 0x8d6749,
  cyc: 0xf2f2ef,
  trussAlu: 0xc8cdd4,
  plasticWhite: 0xe8eaed,
  ventGrille: 0xc8cdd4,
  velvetOrange: 0xb85226,
  seatFabric: 0xc4602a,
  seatFrame: 0x1d1a18,
  aluDeck: 0x9a9ea3,
  steel: 0x2a2c30,
  steelGray: 0x5e6166,
  blackWall: 0x16181c,
  door: 0x24262b,
  glass: 0x1b2430,
  booth: 0x121418,
  fixtureBody: 0x252830,
  dutyBulb: 0xfff1c9,
};

/** Односторонние материалы по имени (doubleSided: false в GLB). */
function exportMaterials() {
  const cache = {};
  return new Proxy({}, {
    get: (_, name) => {
      const k = String(name);
      return (cache[k] ||= new THREE.MeshStandardMaterial({
        name: k,
        color: COLORS[k] ?? 0x808080,
        roughness: 0.75,
        metalness: k === 'trussAlu' || k === 'aluDeck' || k === 'steel' ? 0.45 : 0.08,
        side: THREE.FrontSide,
      }));
    },
  });
}

function staticLayers(M, mobile) {
  const batch = new StaticBatch();
  buildArchitecture(batch, M, { mobile });
  buildCyclorama(batch, M, { mobile });
  buildTrusses(batch, M, { mobile });
  return batch.build();
}

/** Внешняя оболочка стен и пола отправляется на отключаемый слой 3D_OUTER_WALLS. */
const isOuter = (mesh) => /^(floor|walls)$/.test(mesh.userData?.tag || '');

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

function eachMesh(root, fn) {
  if (!root) return;
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), w = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.userData?.noMeasure || o.material?.visible === false) return; // пропускаем невидимые hit-боксы
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        fn(o.geometry, w.multiplyMatrices(o.matrixWorld, m), o);
      }
    } else {
      fn(o.geometry, o.matrixWorld, o);
    }
  });
}

// =============================================================================
//  1. 3D DXF (AutoCAD WCS: Z — высота)
// =============================================================================
export function build3DDXF(stage) {
  const { layout, mfH, fixtures } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: true });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('3D_OUTER_WALLS', { color: 8, off: true })
    .addLayer('3D_WALLS', { color: 7 })
    .addLayer('3D_CEILING', { color: 9 })
    .addLayer('3D_CYC', { color: 4 })
    .addLayer('3D_TRUSSES', { color: 5 })
    .addLayer('3D_RIGGING', { color: 6 })
    .addLayer('3D_HALL', { color: 30 })
    .addLayer('3D_DUTY', { color: 2 })
    .addLayer('3D_FIXTURES', { color: 8 });

  const R = STUDIO.room;
  const MT = STUDIO.movableTruss;
  const T = STUDIO.trusses;
  dxf.addLine3D([0, R.d0, 0], [0, R.d1, 0], { layer: '0_AXES' });
  dxf.addLine3D([R.x0, 0, 0], [R.x1, 0, 0], { layer: '0_AXES' });

  const M = exportMaterials();
  const L = staticLayers(M, true);
  const layerMap = { walls: '3D_WALLS', ceiling: '3D_CEILING', cyc: '3D_CYC', trusses: '3D_TRUSSES' };
  for (const [k, targetLayer] of Object.entries(layerMap)) {
    if (!L[k]) continue;
    eachMesh(L[k], (g, mw, mesh) => writeGeometry(dxf, g, k === 'walls' && isOuter(mesh) ? '3D_OUTER_WALLS' : targetLayer, mw));
  }

  // Подвижная ферма ФП на высоте mfH, лебёдки со спансетами и 4 линии цепей
  const rig = new StudioRigging(M, { mobile: true });
  rig.setHeight('MF', mfH, { silent: true });
  const rigBatch = new StaticBatch();
  rig.buildStatic(rigBatch);
  const rigStatic = rigBatch.build().rigging;
  eachMesh(rigStatic, (g, mw) => writeGeometry(dxf, g, '3D_RIGGING', mw));
  eachMesh(rig.root, (g, mw) => writeGeometry(dxf, g, '3D_RIGGING', mw));
  for (const hp of hoistPoints()) {
    dxf.addLine3D([hp.x, hp.d, mfH + T.size], [hp.x, hp.d, MT.hoist.y0], { layer: '3D_RIGGING' });
  }

  // Блитчер и дежурный свет
  eachMesh(buildHall(layout, { M, profile: { name: 'mobile' } }), (g, mw) => writeGeometry(dxf, g, '3D_HALL', mw));
  eachMesh(buildEmitters(M).groups.duty, (g, mw) => writeGeometry(dxf, g, '3D_DUTY', mw));

  // Приборы постоянного развеса
  const fxBox = new THREE.BoxGeometry(0.22, 0.22, 0.26);
  const m4 = new THREE.Matrix4();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const sc = TYPES[f.type].scale || 1;
    const mount = new THREE.Vector3(f.mount.x, f.mount.y, -f.mount.d);
    const head = mount.clone().setY(mount.y - 0.24);
    m4.compose(head, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    writeGeometry(dxf, fxBox, '3D_FIXTURES', m4);
    dxf.addLine3D(toCad(mount), toCad(head), { layer: '3D_FIXTURES' });
    dxf.addText(f.mount.x, f.mount.d, String(f.no), { layer: '3D_FIXTURES', z: f.mount.y + 0.10, height: 0.12, align: 'center' });
  }
  fxBox.dispose();
  return dxf.toString();
}

// =============================================================================
//  2. GLB (Binary glTF 2.0)
// =============================================================================
function clean(geom, matrix) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  if (matrix) g.applyMatrix4(matrix);
  const p = g.attributes.position;
  const out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(posOr(p), i + 1); c.fromBufferAttribute(p, i + 2);
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
const posOr = (p) => p;

function bake(root, name, M) {
  const byMat = new Map();
  eachMesh(root, (g, mw, mesh) => {
    const rawName = mesh.material?.name || 'steel';
    const matKey = rawName.startsWith('rig:') ? 'trussAlu' : rawName;
    const c = clean(g, mw);
    if (!c) return;
    if (!byMat.has(matKey)) byMat.set(matKey, []);
    byMat.get(matKey).push(c);
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
  const { layout, mfH, fixtures, seats } = exportState(stage);
  const M = exportMaterials();
  const root = new THREE.Scene();
  root.name = 'FEST_Multimedia_Studio';

  const L = staticLayers(M, false);
  const staticNames = {
    walls: 'Architecture_Walls_Doors_Booth',
    ceiling: 'Ceiling_Panels_AC_Diffusers',
    cyc: 'Cyclorama_R070',
    trusses: 'Stationary_Trusses_30x30',
  };
  for (const [k, n] of Object.entries(staticNames)) if (L[k]) root.add(bake(L[k], n, M));

  // Подвижная ферма ФП + лебёдки + цилиндрические грузовые цепи
  const rig = new StudioRigging(M, { mobile: false });
  rig.setHeight('MF', mfH, { silent: true });
  const rigBatch = new StaticBatch();
  rig.buildStatic(rigBatch);
  const chainTop = STUDIO.movableTruss.hoist.y0;
  const chainBot = mfH + STUDIO.trusses.size;
  if (chainTop - chainBot > 0.01) {
    rigBatch.add('rigging', M.steel, hoistPoints().map((hp) => cylBetween(P(hp.x, chainBot, hp.d), P(hp.x, chainTop, hp.d), 0.008, 5)));
  }
  const rigSource = new THREE.Group();
  const rigBuilt = rigBatch.build().rigging;
  if (rigBuilt) rigSource.add(rigBuilt);
  rigSource.add(rig.root);

  const hTag = mfH.toFixed(2).replace('.', '_');
  const movWrap = new THREE.Group();
  movWrap.name = 'MovableTruss';
  movWrap.add(bake(rigSource, `MovableTruss_H${hTag}`, M));
  root.add(movWrap);

  // Блитчер в текущем состоянии и узел мест Seats_0 / Seats_40
  const hall = buildHall(layout, { M, profile: { name: 'desktop' } });
  const hallGrp = bake(hall, `Hall_${layout.id}`, M);
  const seatsNode = new THREE.Group();
  seatsNode.name = `Seats_${seats}`;
  hallGrp.add(seatsNode);
  root.add(hallGrp);

  // Дежурный свет и 15 приборов
  root.add(bake(buildEmitters(M).groups.duty, 'Duty_Lights_12', M));
  const fx = new THREE.Group();
  fx.name = `Stage_Lighting_Fixtures_${fixtures.filter((f) => !f.hidden).length}`;
  const m4 = new THREE.Matrix4();
  const boxGeo = new THREE.BoxGeometry(0.22, 0.22, 0.26);
  for (const f of fixtures) {
    if (f.hidden) continue;
    const sc = TYPES[f.type].scale || 1;
    m4.compose(new THREE.Vector3(f.mount.x, f.mount.y - 0.24, -f.mount.d), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    const g = clean(boxGeo, m4);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, M.fixtureBody);
    mesh.name = `Fixture_${String(f.no)}_${f.type}_${f.group}`;
    mesh.userData = { no: String(f.no), type: f.type, group: f.group };
    fx.add(mesh);
  }
  boxGeo.dispose();
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
