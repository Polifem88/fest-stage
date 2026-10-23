// =============================================================================
//  МОДУЛЬ 3D-ЭКСПОРТА КАМЕРНОЙ СЦЕНЫ ФЭСТ:
//    1. build3DDXF(stage) — Полная 3D-модель в формате AutoCAD DXF (WCS: Z = высота)
//    2. buildGLB(stage)   — Полная 3D-модель в формате Binary glTF 2.0 (.glb)
// =============================================================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CHAMBER, ALL_TRUSSES, chamberSeatLayout } from '../config/dimensions.js';
import { FIXTURES, TYPES } from '../config/fixtures.js';
import { StaticBatch } from '../../../core/geom.js';
import { buildArchitecture, buildSeats, buildEmitters } from '../build/architecture.js';
import { DxfWriter } from '../../../export/dxfWriter.js';

const toCad3D = (x, y, z) => [x, -z, y];

function createExportMaterials() {
  const std = (name, color, roughness = 0.75, metalness = 0.1) =>
    new THREE.MeshStandardMaterial({
      name,
      color,
      roughness,
      metalness,
      side: THREE.FrontSide,
    });
  return {
    floor: std('floor', 0x1d1f23, 0.88, 0.05),
    floorNarrow: std('floorNarrow', 0x1d1f23, 0.88, 0.05),
    wallPanel: std('wallPanel', 0x686c75, 0.85, 0.05),
    blackWall: std('blackWall', 0x181a1d, 0.9, 0.05),
    door: std('door', 0x282a2f, 0.75, 0.1),
    steel: std('steel', 0x3b404a, 0.5, 0.6),
    pipe: std('pipe', 0x6c737f, 0.4, 0.7),
    curtainTrack: std('curtainTrack', 0xb8bec7, 0.35, 0.65),
    acUnit: std('acUnit', 0x18191c, 0.75, 0.2),
    carpet: std('carpet', 0x34373d, 0.95, 0.02),
    carpetSide: std('carpetSide', 0x282b30, 0.95, 0.02),
    brass: std('brass', 0xb8923a, 0.35, 0.7),
    booth: std('booth', 0x1d2026, 0.85, 0.05),
    glass: new THREE.MeshStandardMaterial({
      name: 'glass', color: 0x88b5d6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.FrontSide,
    }),
    truss: std('truss', 0x2b2f38, 0.5, 0.6),
    seatFabric: std('seatFabric', 0xc4602a, 0.85, 0.05),
    seatFrame: std('seatFrame', 0x1d1a18, 0.6, 0.4),
    fixtureBody: std('fixtureBody', 0x252830, 0.45, 0.5),
    dutyBulb: std('dutyBulb', 0xffe0a3, 0.3, 0.1),
    houseLamp: std('houseLamp', 0xffd591, 0.3, 0.1),
  };
}

function getExportState(stage) {
  const fixtures = (stage?.fixtures?.list || FIXTURES).map((f, idx) => ({
    ...f,
    idx,
    on: f.on !== undefined ? !!f.on : true,
    hidden: !!f.hidden,
    worldPos: { x: f.mount.x, y: f.mount.y, d: f.mount.d },
    worldAim: { x: f.aim.x, y: f.aim.y, d: f.aim.d },
  }));
  return { fixtures };
}

function writeBufferGeometryTo3DDXF(dxf, geom, layer, matrix = null) {
  if (!geom || !geom.attributes?.position) return;
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.attributes.position;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const vD = new THREE.Vector3();

  for (let i = 0; i + 2 < pos.count; i += 3) {
    vA.fromBufferAttribute(pos, i);
    vB.fromBufferAttribute(pos, i + 1);
    vC.fromBufferAttribute(pos, i + 2);
    if (matrix) {
      vA.applyMatrix4(matrix);
      vB.applyMatrix4(matrix);
      vC.applyMatrix4(matrix);
    }
    if (i + 5 < pos.count) {
      const u1 = new THREE.Vector3().fromBufferAttribute(pos, i + 3);
      const u2 = new THREE.Vector3().fromBufferAttribute(pos, i + 4);
      const u3 = new THREE.Vector3().fromBufferAttribute(pos, i + 5);
      if (matrix) { u1.applyMatrix4(matrix); u2.applyMatrix4(matrix); u3.applyMatrix4(matrix); }
      if (u1.distanceToSquared(vA) < 1e-8 && u2.distanceToSquared(vC) < 1e-8) {
        vD.copy(u3);
        dxf.add3DFace(
          toCad3D(vA.x, vA.y, vA.z),
          toCad3D(vB.x, vB.y, vB.z),
          toCad3D(vC.x, vC.y, vC.z),
          toCad3D(vD.x, vD.y, vD.z),
          { layer },
        );
        i += 3;
        continue;
      }
    }
    const p1 = toCad3D(vA.x, vA.y, vA.z);
    const p2 = toCad3D(vB.x, vB.y, vB.z);
    const p3 = toCad3D(vC.x, vC.y, vC.z);
    dxf.add3DFace(p1, p2, p3, p3, { layer });
  }
}

// =============================================================================
//  1. ВСЯ СЦЕНА В 3D (.dxf) — fest-chamber-3d.dxf
// =============================================================================
export function build3DDXF(stage) {
  const { fixtures } = getExportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: true });

  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('3D_STAGE_FLOOR', { color: 33, ltype: 'CONTINUOUS' })
    .addLayer('3D_WALLS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('3D_OUTER_WALLS', { color: 8, ltype: 'CONTINUOUS', off: true })
    .addLayer('3D_HALL', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('3D_SEATS', { color: 12, ltype: 'CONTINUOUS' })
    .addLayer('3D_TRUSSES', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('3D_FIXTURES', { color: 8, ltype: 'CONTINUOUS' });

  const S = CHAMBER.stage;
  const H = CHAMBER.hall;
  dxf.addLine3D([0, H.backWallD, 0], [0, S.d1, 0], { layer: '0_AXES' });
  dxf.addLine3D([S.x0, 0, 0], [H.x1, 0, 0], { layer: '0_AXES' });

  const M = createExportMaterials();
  const batch = new StaticBatch();
  buildArchitecture(batch, M, { mobile: true });
  const staticLayers = batch.build();

  const outerShellTags = new Set(['wallL', 'wallR', 'wallB', 'ceiling']);
  const layerMap = {
    walls: '3D_WALLS',
    hall: '3D_HALL',
    trusses: '3D_TRUSSES',
  };

  for (const [k, dxfLayer] of Object.entries(layerMap)) {
    const grp = staticLayers[k];
    if (!grp) continue;
    grp.traverse((o) => {
      if (o.isMesh && o.geometry) {
        let targetLayer = dxfLayer;
        const matName = o.material?.name || '';
        const tag = o.userData?.tag || '';
        if (outerShellTags.has(tag)) {
          targetLayer = '3D_OUTER_WALLS';
        } else if (k === 'walls' && (matName === 'floorNarrow' || tag === 'stageFloor')) {
          targetLayer = '3D_STAGE_FLOOR';
        }
        writeBufferGeometryTo3DDXF(dxf, o.geometry, targetLayer);
      }
    });
  }

  // 102 кресла зрительного зала (компактные 3DFACE сиденья и спинки)
  const { seats } = chamberSeatLayout(CHAMBER);
  for (const s of seats) {
    const hw = (s.folding ? H.foldingPitch : H.seatPitch) * 0.4;
    const x0 = s.x - hw, x1 = s.x + hw;
    const dFront = s.d, dBack = s.d - 0.36;
    const ySeat = s.y + 0.42, yBack = s.y + 0.86;
    if (s.folding) {
      dxf.add3DFace([x0, dBack, s.y + 0.18], [x1, dBack, s.y + 0.18], [x1, dFront, s.y + 0.54], [x0, dFront, s.y + 0.54], { layer: '3D_SEATS' });
    } else {
      dxf.add3DFace([x0, dBack, ySeat], [x1, dBack, ySeat], [x1, dFront, ySeat], [x0, dFront, ySeat], { layer: '3D_SEATS' });
      dxf.add3DFace([x0, dBack, ySeat], [x1, dBack, ySeat], [x1, dBack - 0.06, yBack], [x0, dBack - 0.06, yBack], { layer: '3D_SEATS' });
    }
  }

  // Марки ферм в 3D
  for (const tr of ALL_TRUSSES) {
    dxf.addText(tr.x0 - 0.35, tr.d, `${tr.name} (+${CHAMBER.trusses.bottomY.toFixed(2)})`, {
      layer: '3D_TRUSSES', z: CHAMBER.trusses.bottomY + 0.12, height: 0.16,
    });
  }

  // 72 прибора в 3D
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scVec = new THREE.Vector3();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const mount = new THREE.Vector3(f.worldPos.x, f.worldPos.y, -f.worldPos.d);
    const head = mount.clone();
    head.y -= 0.24;
    const sc = t.scale || 1;
    m4.compose(head, q, scVec.set(sc, sc, sc));

    const boxG = new THREE.BoxGeometry(0.22, 0.22, 0.26);
    writeBufferGeometryTo3DDXF(dxf, boxG, '3D_FIXTURES', m4);
    boxG.dispose();

    dxf.addLine3D([mount.x, f.worldPos.d, mount.y], [head.x, f.worldPos.d, head.y], { layer: '3D_FIXTURES' });
    dxf.addText(mount.x, f.worldPos.d, String(f.no), {
      layer: '3D_FIXTURES', z: mount.y + 0.16, height: 0.13, align: 'center',
    });
  }

  return dxf.toString();
}

// =============================================================================
//  2. 3D-МОДЕЛЬ В ФОРМАТЕ BINARY glTF 2.0 (.glb) — fest-chamber-3d.glb
// =============================================================================
function sanitizeGeometryForGLTF(geom, matrix = null) {
  let g = geom.index ? geom.toNonIndexed() : geom.clone();
  if (matrix) g.applyMatrix4(matrix);

  const srcPos = g.attributes.position;
  if (!srcPos || srcPos.count < 3) return null;

  const cleanPos = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

  for (let i = 0; i + 2 < srcPos.count; i += 3) {
    vA.fromBufferAttribute(srcPos, i);
    vB.fromBufferAttribute(srcPos, i + 1);
    vC.fromBufferAttribute(srcPos, i + 2);
    if (
      !Number.isFinite(vA.x) || !Number.isFinite(vA.y) || !Number.isFinite(vA.z) ||
      !Number.isFinite(vB.x) || !Number.isFinite(vB.y) || !Number.isFinite(vB.z) ||
      !Number.isFinite(vC.x) || !Number.isFinite(vC.y) || !Number.isFinite(vC.z)
    ) continue;

    ab.subVectors(vB, vA);
    ac.subVectors(vC, vA);
    cross.crossVectors(ab, ac);
    if (cross.lengthSq() < 1e-10) continue;

    cleanPos.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
  }

  if (cleanPos.length < 9) return null;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(cleanPos, 3));
  out.computeVertexNormals();
  out.normalizeNormals();
  return out;
}

function makeFixtureGLBGeometry(shape) {
  const parts = [];
  const add = (g) => parts.push(g.index ? g.toNonIndexed() : g);
  switch (shape) {
    case 'spot':
      add(new THREE.BoxGeometry(0.26, 0.26, 0.42));
      add(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.25));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(-0.17, 0.08, 0));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(0.17, 0.08, 0));
      break;
    case 'wash':
      add(new THREE.CylinderGeometry(0.17, 0.15, 0.3, 14).rotateX(Math.PI / 2));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(-0.2, 0.08, 0));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(0.2, 0.08, 0));
      break;
    case 'beam':
      add(new THREE.BoxGeometry(0.24, 0.24, 0.26));
      add(new THREE.BoxGeometry(0.04, 0.3, 0.1).translate(-0.15, 0.07, 0));
      add(new THREE.BoxGeometry(0.04, 0.3, 0.1).translate(0.15, 0.07, 0));
      break;
    case 'ledpar':
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14).rotateX(Math.PI / 2));
      break;
    case 'profile':
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06));
      add(new THREE.BoxGeometry(0.2, 0.22, 0.2).translate(0, 0, -0.2));
      break;
    case 'fresnel':
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12).rotateX(Math.PI / 2));
      break;
    case 'par':
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.34, 12).rotateX(Math.PI / 2));
      break;
    default:
      add(new THREE.BoxGeometry(0.2, 0.2, 0.3));
  }
  return mergeGeometries(parts, false);
}

export function buildExportSceneForGLTF(stage) {
  const { fixtures } = getExportState(stage);
  const M = createExportMaterials();
  const root = new THREE.Scene();
  root.name = 'FEST_Chamber_Stage';

  // 1. Статическая архитектура и фермы
  const batch = new StaticBatch();
  buildArchitecture(batch, M);
  const builtLayers = batch.build();
  const groupNames = {
    walls: 'Architecture_Walls_Columns_Ducts',
    hall: 'Auditorium_Hall_And_Booth',
    trusses: 'Trusses_F1_F9_ZF1_ZF3_And_PA',
  };

  for (const [key, grp] of Object.entries(builtLayers)) {
    const cleanGroup = new THREE.Group();
    cleanGroup.name = groupNames[key] || `Layer_${key}`;
    grp.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const cleanG = sanitizeGeometryForGLTF(o.geometry);
      if (!cleanG) return;
      const mat = M[o.material?.name] || M.wallPanel;
      const mesh = new THREE.Mesh(cleanG, mat);
      mesh.name = o.name.replace(/[^a-zA-Z0-9_:-]/g, '_');
      cleanGroup.add(mesh);
    });
    root.add(cleanGroup);
  }

  // 2. Развёрнутые из InstancedMesh 102 места зрительного зала (100 кресел + 2 откидные боковушки)
  const seatMeshes = buildSeats(M);
  const seatsGroup = new THREE.Group();
  seatsGroup.name = 'Auditorium_Seats_102';
  const mTmp = new THREE.Matrix4();
  const bakedFabric = [], bakedFrame = [];
  for (const im of seatMeshes) {
    const isFabric = im.material?.name === 'seatFabric';
    const target = isFabric ? bakedFabric : bakedFrame;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, mTmp);
      const g = sanitizeGeometryForGLTF(im.geometry, mTmp);
      if (g) target.push(g);
    }
  }
  if (bakedFabric.length) {
    seatsGroup.add(new THREE.Mesh(mergeGeometries(bakedFabric, false), M.seatFabric));
    seatsGroup.children.at(-1).name = 'Seats_Upholstery';
  }
  if (bakedFrame.length) {
    seatsGroup.add(new THREE.Mesh(mergeGeometries(bakedFrame, false), M.seatFrame));
    seatsGroup.children.at(-1).name = 'Seats_Frames';
  }
  root.add(seatsGroup);

  // 3. Дежурное и зальное освещение (светильники)
  const em = buildEmitters(M);
  const emGroup = new THREE.Group();
  emGroup.name = 'House_And_Duty_Luminaires';
  for (const srcGrp of [em.groups.duty, em.groups.house]) {
    srcGrp.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const cg = sanitizeGeometryForGLTF(o.geometry);
      if (cg) {
        const mesh = new THREE.Mesh(cg, M[o.material?.name] || M.dutyBulb);
        mesh.name = o.name || 'LuminairePart';
        emGroup.add(mesh);
      }
    });
  }
  root.add(emGroup);

  // 4. 72 световых прибора
  const fixturesGroup = new THREE.Group();
  fixturesGroup.name = 'Stage_Lighting_Fixtures_72';
  const shapeTemplates = {};
  for (const sh of ['spot', 'wash', 'beam', 'ledpar', 'profile', 'fresnel', 'par']) {
    shapeTemplates[sh] = makeFixtureGLBGeometry(sh);
  }

  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));
  const sVec = new THREE.Vector3();
  const m4 = new THREE.Matrix4();

  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const mount = new THREE.Vector3(f.worldPos.x, f.worldPos.y, -f.worldPos.d);
    const head = mount.clone();
    head.y -= ['spot', 'wash', 'beam'].includes(t.shape) ? 0.32 : 0.22;
    const sc = t.scale || 1;
    m4.compose(head, q, sVec.set(sc, sc, sc));

    const tpl = shapeTemplates[t.shape] || shapeTemplates.spot;
    const parts = [];
    const headClean = sanitizeGeometryForGLTF(tpl, m4);
    if (headClean) parts.push(headClean);

    const clampRaw = new THREE.BoxGeometry(0.16, 0.12, 0.16);
    clampRaw.translate(mount.x, mount.y - 0.06, mount.z);
    const clampClean = sanitizeGeometryForGLTF(clampRaw);
    if (clampClean) parts.push(clampClean);

    if (parts.length) {
      const merged = mergeGeometries(parts, false);
      const fMesh = new THREE.Mesh(merged, M.fixtureBody);
      const safeNo = String(f.no)
        .replace(/ОП/g, 'FOH')
        .replace(/30А/g, '30A')
        .replace(/^П(\d+)$/g, 'SIDE_$1')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      fMesh.name = `Fixture_${safeNo}_${f.type}_${f.group}`;
      fMesh.userData = { no: String(f.no), type: f.type, group: f.group };
      fixturesGroup.add(fMesh);
    }
  }
  root.add(fixturesGroup);
  root.updateMatrixWorld(true);
  return root;
}

export function buildGLB(stage) {
  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReader {
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buf) => {
          this.result = buf;
          this.onloadend?.();
        });
      }
    };
  }
  const exportScene = buildExportSceneForGLTF(stage);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('GLTFExporter did not return a binary ArrayBuffer'));
      },
      (err) => reject(err || new Error('GLTFExporter failed')),
      { binary: true, onlyVisible: true },
    );
  });
}
