// =============================================================================
//  МОДУЛЬ 3D-ЭКСПОРТА СЦЕНЫ ФЭСТ:
//    1. build3DDXF(stage) — Полная 3D-модель в формате AutoCAD DXF (WCS: Z = высота)
//    2. buildGLB(stage)   — Полная 3D-модель в формате Binary glTF 2.0 (.glb)
// =============================================================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM, BOX_HALF, HALL_HALF, RAKE, rowFrontD } from '../config/dimensions.js';
import { RIGGING, ropeDepth, DUTY_ROWS } from '../config/rigging.js';
import { FIXTURES, TYPES, PORTABLE, portablePlacement, BAR_DEPTH } from '../config/fixtures.js';
import { StaticBatch } from '../core/geom.js';
import { buildArchitecture, buildSeats, buildEmitters } from '../build/architecture.js';
import { DxfWriter } from './dxfWriter.js';

/**
 * Перевод точки из координат Three.js (x, y_up, z = -d)
 * в стандартную мировую систему координат AutoCAD WCS (x, y_depth = d, z_up = y).
 */
const toCad3D = (x, y, z) => [x, -z, y];

/**
 * Создать набор материалов для экспорта.
 * Все внешние стены и потолки используют THREE.FrontSide (doubleSided: false в glTF),
 * чтобы снаружи коробки стены были прозрачными за счёт Backface Culling, а изнутри — непрозрачными,
 * один в один как в основной 3D-модели Three.js.
 */
function createExportMaterials() {
  const std = (name, color, roughness = 0.7, metalness = 0.1) => {
    const m = new THREE.MeshStandardMaterial({
      name,
      color,
      roughness,
      metalness,
      side: THREE.FrontSide,
    });
    return m;
  };
  return {
    floor: std('floor', 0x262320, 0.85, 0.05),
    stageEdge: std('stageEdge', 0x1a1816, 0.8, 0.05),
    portal: std('portal', 0x3b3530, 0.75, 0.05),
    brickSide: std('brickSide', 0x6e473b, 0.85, 0.05),
    brickBack: std('brickBack', 0x664238, 0.85, 0.05),
    brickBlack: std('brickBlack', 0x1d1e21, 0.9, 0.05),
    blackWall: std('blackWall', 0x181a1d, 0.9, 0.05),
    attic: std('attic', 0x22252a, 0.85, 0.05),
    rigel: std('rigel', 0x505660, 0.7, 0.2),
    door: std('door', 0x4a3525, 0.75, 0.1),
    gate: std('gate', 0x3c424d, 0.65, 0.3),
    steel: std('steel', 0x454c59, 0.5, 0.6),
    fascia: std('fascia', 0x5c6473, 0.6, 0.3),
    pipe: std('pipe', 0x8a929e, 0.4, 0.7),
    track: std('track', 0x7b52ab, 0.45, 0.5),
    counterweight: std('counterweight', 0x3a404d, 0.6, 0.5),
    mesh: std('mesh', 0x3a404a, 0.7, 0.4),
    hallFloor: std('hallFloor', 0x382c24, 0.8, 0.05),
    hallWood: std('hallWood', 0x7a4e32, 0.65, 0.08),
    hallAcoustic: std('hallAcoustic', 0x423833, 0.85, 0.05),
    hallCeiling: std('hallCeiling', 0x2c3038, 0.85, 0.05),
    decoCeiling: std('decoCeiling', 0x353942, 0.8, 0.1),
    booth: std('booth', 0x252830, 0.85, 0.05),
    glass: new THREE.MeshStandardMaterial({
      name: 'glass', color: 0x88b5d6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.FrontSide,
    }),
    truss: std('truss', 0x383e4a, 0.5, 0.6),
    seatFabric: std('seatFabric', 0x8c242b, 0.8, 0.05),
    seatFrame: std('seatFrame', 0x22252b, 0.5, 0.5),
    fixtureBody: std('fixtureBody', 0x252830, 0.45, 0.5),
    dutyBulb: std('dutyBulb', 0xffe0a3, 0.3, 0.1),
    ledStrip: std('ledStrip', 0xd6ecff, 0.3, 0.1),
    blueLight: std('blueLight', 0x2c6eff, 0.3, 0.1),
    houseLamp: std('houseLamp', 0xffd591, 0.3, 0.1),
  };
}

/** Считать снимок состояния высот, приборов и переносных прострелов. */
function getExportState(stage) {
  const heights = {};
  for (const r of RIGGING) heights[r.id] = stage?.rigging ? stage.rigging.height(r.id) : r.rest;
  const portable = stage?.fixtures?.portable ? { ...stage.fixtures.portable } : { ...PORTABLE.defaults };
  const fixtures = (stage?.fixtures?.list || FIXTURES).map((f, idx) => {
    let mount = { ...f.mount };
    let aim = { ...f.aim };
    let hidden = !!f.hidden;
    if (f.portable) {
      const p = portablePlacement(f.portable.side, f.portable.k, portable.mode, portable.count);
      mount = p.mount;
      aim = p.aim;
      hidden = !p.visible;
    }
    const y = mount.on ? heights[mount.on] + mount.y : mount.y;
    const d = mount.on ? BAR_DEPTH[mount.on] + mount.d : mount.d;
    const on = f.on !== undefined ? !!f.on : true;
    return { ...f, idx, on, hidden, worldPos: { x: mount.x, y, d }, worldAim: { x: aim.x, y: aim.y, d: aim.d } };
  });
  return { heights, portable, fixtures };
}

/** Записать треугольники BufferGeometry в DxfWriter как 3DFACE (с переводом в AutoCAD WCS). */
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
    // Если два соседних треугольника образуют плоский прямоугольник (как в BoxGeometry/PlaneGeometry),
    // можно записать их как один 4-угольный 3DFACE или два треугольных 3DFACE.
    if (i + 5 < pos.count) {
      const n1x = vA.x, n1y = vA.y, n1z = vA.z;
      const u1 = new THREE.Vector3().fromBufferAttribute(pos, i + 3);
      const u2 = new THREE.Vector3().fromBufferAttribute(pos, i + 4);
      const u3 = new THREE.Vector3().fromBufferAttribute(pos, i + 5);
      if (matrix) { u1.applyMatrix4(matrix); u2.applyMatrix4(matrix); u3.applyMatrix4(matrix); }
      // Проверка стандартной пары треугольников квада (A, B, C) и (A, C, D)
      if (u1.distanceToSquared(vA) < 1e-8 && u2.distanceToSquared(vC) < 1e-8) {
        vD.copy(u3);
        dxf.add3DFace(
          toCad3D(n1x, n1y, n1z),
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
//  1. ВСЯ СЦЕНА В 3D (.dxf) — fest-stage-3d.dxf
//     Система координат AutoCAD WCS: X_cad = X, Y_cad = d, Z_cad = Y (высота)
// =============================================================================
export function build3DDXF(stage) {
  const { heights, fixtures } = getExportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: true });

  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('3D_STAGE_FLOOR', { color: 33, ltype: 'CONTINUOUS' })
    .addLayer('3D_PORTAL', { color: 1, ltype: 'CONTINUOUS' })
    .addLayer('3D_WALLS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('3D_OUTER_WALLS', { color: 8, ltype: 'CONTINUOUS', off: true })
    .addLayer('3D_GALLERIES', { color: 4, ltype: 'CONTINUOUS' })
    .addLayer('3D_HALL', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('3D_SEATS', { color: 12, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_BATTENS', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_SOFFITS', { color: 30, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_TRACK', { color: 6, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_SIDE', { color: 3, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_CABLES', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('3D_RIG_COUNTERWEIGHTS', { color: 9, ltype: 'CONTINUOUS' })
    .addLayer('3D_FIXTURES', { color: 8, ltype: 'CONTINUOUS' });

  // 1. Оси сцены в 3D (Z = 0)
  dxf.addLine3D([0, -DIM.hall.portalToBoothWall, 0], [0, DIM.box.backWallD, 0], { layer: '0_AXES' });
  dxf.addLine3D([-HALL_HALF, 0, 0], [HALL_HALF, 0, 0], { layer: '0_AXES' });

  // 2. Статическая архитектура (внешние стены и потолок вынесены на отключённый по умолчанию слой 3D_OUTER_WALLS)
  const M = createExportMaterials();
  const batch = new StaticBatch();
  buildArchitecture(batch, M);
  const staticLayers = batch.build();

  const outerShellMats = new Set([
    'brickSide', 'brickBack', 'brickBlack', 'blackWall', 'attic',
    'hallWood', 'hallAcoustic', 'hallCeiling', 'decoCeiling', 'booth',
  ]);
  const outerShellTags = new Set(['wallL', 'wallR', 'wallB', 'ceiling']);

  const layerMap = {
    walls: '3D_WALLS',
    galleries: '3D_GALLERIES',
    hall: '3D_HALL',
  };
  for (const [k, dxfLayer] of Object.entries(layerMap)) {
    const grp = staticLayers[k];
    if (!grp) continue;
    grp.traverse((o) => {
      if (o.isMesh && o.geometry) {
        let targetLayer = dxfLayer;
        const matName = o.material?.name || '';
        const tag = o.userData?.tag || '';
        if (outerShellTags.has(tag) || outerShellMats.has(matName)) {
          targetLayer = '3D_OUTER_WALLS';
        } else if (k === 'walls') {
          if (['floor', 'stageEdge', 'forestage', 'stair', 'pit'].includes(matName)) targetLayer = '3D_STAGE_FLOOR';
          else if (matName === 'portal') targetLayer = '3D_PORTAL';
        }
        writeBufferGeometryTo3DDXF(dxf, o.geometry, targetLayer);
      }
    });
  }

  // 3. Кресла зрительного зала (390 мест: компактные 3D-грани сиденья и спинки на реальных высотах рядов)
  const H = DIM.hall;
  const SW = H.seatWidth;
  for (let r = 0; r < H.rows; r++) {
    const yFloor = -DIM.forestage.height + r * H.rowPitch * RAKE;
    const dSeat = rowFrontD(r) - 0.42;
    const ySeat = yFloor + 0.44;
    const yBack = yFloor + 0.88;
    for (let s = 0; s < H.seatsPerRow; s++) {
      const x = (s - (H.seatsPerRow - 1) / 2) * SW;
      const x0 = x - SW * 0.4, x1 = x + SW * 0.4;
      // Горизонтальная подушка сиденья
      dxf.add3DFace(
        [x0, dSeat - 0.18, ySeat],
        [x1, dSeat - 0.18, ySeat],
        [x1, dSeat + 0.18, ySeat],
        [x0, dSeat + 0.18, ySeat],
        { layer: '3D_SEATS' },
      );
      // Спинка кресла
      dxf.add3DFace(
        [x0, dSeat - 0.18, ySeat],
        [x1, dSeat - 0.18, ySeat],
        [x1, dSeat - 0.24, yBack],
        [x0, dSeat - 0.24, yBack],
        { layer: '3D_SEATS' },
      );
    }
  }

  // 4. Верхняя механика в 3D: трубы, ферма занавеса, тросы, каретки противовесов
  const W = BOX_HALF;
  const CEIL = DIM.box.ceiling;
  const pipeR = DIM.pipe.diameter / 2;

  for (const r of RIGGING) {
    const hVal = heights[r.id];
    const layer = r.kind === 'light'
      ? '3D_RIG_SOFFITS'
      : r.kind === 'track'
        ? '3D_RIG_TRACK'
        : r.kind === 'side'
          ? '3D_RIG_SIDE'
          : '3D_RIG_BATTENS';

    if (r.kind === 'side') {
      const len = r.dTo - r.dFrom;
      const g = new THREE.CylinderGeometry(pipeR, pipeR, len, 6).rotateX(Math.PI / 2);
      g.translate(r.x, hVal, -(r.dFrom + len / 2));
      writeBufferGeometryTo3DDXF(dxf, g, layer);
      dxf.addLine3D([r.x, r.dFrom, hVal], [r.x, r.dTo, hVal], { layer });
      g.dispose();
    } else if (r.kind === 'track') {
      const L = DIM.pipe.trackLength, s = DIM.pipe.trackWidth / 2;
      const g = new THREE.BoxGeometry(L, s * 2, s * 2);
      g.translate(0, hVal, -r.d);
      writeBufferGeometryTo3DDXF(dxf, g, layer);
      g.dispose();
    } else {
      const L = DIM.pipe.length;
      const g = new THREE.CylinderGeometry(pipeR, pipeR, L, 6).rotateZ(Math.PI / 2);
      g.translate(0, hVal, -r.d);
      writeBufferGeometryTo3DDXF(dxf, g, layer);
      dxf.addLine3D([-L / 2, r.d, hVal], [L / 2, r.d, hVal], { layer });
      g.dispose();
    }

    // Точки подвеса и вертикальные тросы до колосников
    const pickups = r.kind === 'side'
      ? [r.dFrom, (r.dFrom + r.dTo) / 2, r.dTo].map((d) => ({ x: r.x, d }))
      : DIM.pipe.pickupX.map((x) => ({ x, d: r.d }));
    const topY = (r.d ?? r.dFrom) < DIM.portal.thickness ? DIM.decoCeilingY : CEIL - 0.08;
    for (const p of pickups) {
      dxf.addLine3D([p.x, p.d, hVal], [p.x, p.d, topY], { layer: '3D_RIG_CABLES' });
    }

    // Каретка противовеса на реальной противофазной высоте
    const cwX = r.control === 'left' ? -W + 0.14 : W - 0.14;
    const cwY = 0.6 + (r.max - hVal);
    const rd = ropeDepth(r.id);
    const cwBox = new THREE.BoxGeometry(0.1, 0.9, 0.13);
    cwBox.translate(cwX, cwY, -rd);
    writeBufferGeometryTo3DDXF(dxf, cwBox, '3D_RIG_COUNTERWEIGHTS');
    cwBox.dispose();

    // 3D-марка подъёма
    const lx = r.kind === 'side' ? r.x : -DIM.pipe.length / 2 - 0.4;
    const ld = r.kind === 'side' ? r.dFrom : r.d;
    dxf.addText(lx, ld, `${r.name} (+${hVal.toFixed(2)})`, {
      layer, z: hVal + 0.12, height: 0.18,
    });
  }

  // 5. Корпуса световых приборов в 3D (всегда в выключенном нейтральном состоянии, без лучей света)
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scVec = new THREE.Vector3();

  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const layer = '3D_FIXTURES';
    const mount = new THREE.Vector3(f.worldPos.x, f.worldPos.y, -f.worldPos.d);
    const hang = !!f.mount.on || f.group.startsWith('BR');
    const head = mount.clone();
    if (hang) head.y -= 0.25;
    const sc = t.scale || 1;
    m4.compose(head, q, scVec.set(sc, sc, sc));

    // Нейтральный 3D-корпус прибора на подвесе
    const boxG = new THREE.BoxGeometry(0.24, 0.24, 0.28);
    writeBufferGeometryTo3DDXF(dxf, boxG, layer, m4);
    boxG.dispose();

    // Подвес или штатив
    if (hang) {
      dxf.addLine3D([mount.x, f.worldPos.d, mount.y], [head.x, f.worldPos.d, head.y], { layer });
    } else if (f.portable) {
      dxf.addLine3D([mount.x, f.worldPos.d, 0], [mount.x, f.worldPos.d, mount.y], { layer });
    }

    // 3D-номер прибора
    dxf.addText(mount.x, f.worldPos.d, String(f.no), {
      layer, z: mount.y + 0.18, height: 0.14, align: 'center',
    });
  }

  return dxf.toString();
}

// =============================================================================
//  2. 3D-МОДЕЛЬ В ФОРМАТЕ BINARY glTF 2.0 (.glb) — fest-stage-3d.glb
// =============================================================================

/**
 * Очистка и нормализация BufferGeometry перед экспортом в glTF 2.0:
 *  - Оставляем только валидные атрибуты position и normal (без кастомных шейдерных атрибутов вроде aZone);
 *  - Удаляем вырожденные треугольники нулевой площади и проверяем отсутствие NaN/Infinity;
 *  - Нормализуем нормали.
 */
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
    if (cross.lengthSq() < 1e-10) continue; // пропускаем вырожденные треугольники

    cleanPos.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
  }

  if (cleanPos.length < 9) return null;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(cleanPos, 3));
  out.computeVertexNormals();
  out.normalizeNormals();
  return out;
}

/** Геометрия корпуса прибора для экспорта в GLB. */
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
    case 'follow':
      add(new THREE.CylinderGeometry(0.13, 0.11, 0.9, 12).rotateX(Math.PI / 2));
      break;
    default:
      add(new THREE.BoxGeometry(0.2, 0.2, 0.3));
  }
  return mergeGeometries(parts, false);
}

/**
 * Собрать чистую экспортную сцену Three.js для GLB (без hit-боксов, спрайтов и кастомных шейдеров),
 * где все InstancedMesh развёрнуты в полноценные именованные узлы с применёнными мировыми координатами.
 */
export function buildExportSceneForGLTF(stage) {
  const { heights, portable, fixtures } = getExportState(stage);
  const M = createExportMaterials();
  const root = new THREE.Scene();
  root.name = 'FEST_Main_Stage';

  // 1. Статическая архитектура и статика механики
  const batch = new StaticBatch();
  buildArchitecture(batch, M);

  // Добавляем статическую механику (направляющие, блоки, ограждение противовесов)
  const W = BOX_HALF, CEIL = DIM.box.ceiling;
  const staticRigGeoms = [];
  for (const r of RIGGING) {
    const left = r.control === 'left';
    const x = left ? -W + 0.14 : W - 0.14;
    const d = ropeDepth(r.id);
    for (const dd of [d - 0.085, d + 0.085]) {
      const guide = new THREE.BoxGeometry(0.06, CEIL - 0.45, 0.02);
      guide.translate(x, (0.15 + CEIL - 0.3) / 2, -dd);
      staticRigGeoms.push(guide);
    }
    const blk = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateZ(Math.PI / 2);
    blk.translate(x, CEIL - 0.2, -d);
    staticRigGeoms.push(blk);
  }
  batch.add('rigging', M.steel, staticRigGeoms);

  const builtLayers = batch.build();
  const groupNames = {
    walls: 'Architecture_Walls_Portal',
    galleries: 'Architecture_Galleries',
    hall: 'Auditorium_Hall',
    rigging: 'Rigging_Static_Guides',
  };

  for (const [key, grp] of Object.entries(builtLayers)) {
    const cleanGroup = new THREE.Group();
    cleanGroup.name = groupNames[key] || `Layer_${key}`;
    grp.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const cleanG = sanitizeGeometryForGLTF(o.geometry);
      if (!cleanG) return;
      const mat = M[o.material?.name] || M.blackWall;
      const mesh = new THREE.Mesh(cleanG, mat);
      mesh.name = o.name.replace(/[^a-zA-Z0-9_:-]/g, '_');
      cleanGroup.add(mesh);
    });
    root.add(cleanGroup);
  }

  // 2. Развёрнутые из InstancedMesh кресла зрительного зала (390 мест)
  const [seatsF, seatsK] = buildSeats(M);
  const seatsGroup = new THREE.Group();
  seatsGroup.name = 'Auditorium_Seats_390';
  const mTmp = new THREE.Matrix4();
  const bakedFabric = [], bakedFrame = [];
  for (let i = 0; i < seatsF.count; i++) {
    seatsF.getMatrixAt(i, mTmp);
    const gf = sanitizeGeometryForGLTF(seatsF.geometry, mTmp);
    if (gf) bakedFabric.push(gf);
  }
  for (let i = 0; i < seatsK.count; i++) {
    seatsK.getMatrixAt(i, mTmp);
    const gk = sanitizeGeometryForGLTF(seatsK.geometry, mTmp);
    if (gk) bakedFrame.push(gk);
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
  const em = buildEmitters(M, DUTY_ROWS);
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

  // 4. Подвижная верхняя механика (трубы штанкетов, софиты, дорога занавеса, каретки противовесов)
  const rigGroup = new THREE.Group();
  rigGroup.name = 'Rigging_Pipes_And_Counterweights';
  const pipeR = DIM.pipe.diameter / 2;
  const battenMat = new THREE.MeshStandardMaterial({ name: 'rigBatten', color: 0x2f6fde, roughness: 0.4, metalness: 0.6, side: THREE.FrontSide });
  const soffitMat = new THREE.MeshStandardMaterial({ name: 'rigSoffit', color: 0xe8590c, roughness: 0.4, metalness: 0.6, side: THREE.FrontSide });
  const sideMat = new THREE.MeshStandardMaterial({ name: 'rigSide', color: 0x1a9e6a, roughness: 0.4, metalness: 0.6, side: THREE.FrontSide });

  for (const r of RIGGING) {
    const hVal = heights[r.id];
    const itemGroup = new THREE.Group();
    itemGroup.name = `Rig_${r.id}`;

    let rawGeo;
    if (r.kind === 'side') {
      const len = r.dTo - r.dFrom;
      rawGeo = new THREE.CylinderGeometry(pipeR, pipeR, len, 10).rotateX(Math.PI / 2);
      rawGeo.translate(r.x, hVal, -(r.dFrom + len / 2));
    } else if (r.kind === 'track') {
      rawGeo = new THREE.BoxGeometry(DIM.pipe.trackLength, DIM.pipe.trackWidth, DIM.pipe.trackWidth);
      rawGeo.translate(0, hVal, -r.d);
    } else {
      rawGeo = new THREE.CylinderGeometry(pipeR, pipeR, DIM.pipe.length, 10).rotateZ(Math.PI / 2);
      rawGeo.translate(0, hVal, -r.d);
    }
    const cleanPipe = sanitizeGeometryForGLTF(rawGeo);
    if (cleanPipe) {
      const mat = r.kind === 'light' ? soffitMat : r.kind === 'track' ? M.track : r.kind === 'side' ? sideMat : battenMat;
      const pipeMesh = new THREE.Mesh(cleanPipe, mat);
      pipeMesh.name = `Pipe_${r.id}`;
      pipeMesh.userData = { rigId: r.id, kind: r.kind, heightM: hVal };
      itemGroup.add(pipeMesh);
    }

    // Каретка противовеса на реальной высоте
    const cwX = r.control === 'left' ? -W + 0.14 : W - 0.14;
    const cwY = 0.6 + (r.max - hVal);
    const rd = ropeDepth(r.id);
    const cwRaw = new THREE.BoxGeometry(0.1, 0.9, 0.13);
    cwRaw.translate(cwX, cwY, -rd);
    const cleanCw = sanitizeGeometryForGLTF(cwRaw);
    if (cleanCw) {
      const cwMesh = new THREE.Mesh(cleanCw, M.counterweight);
      cwMesh.name = `Counterweight_${r.id}`;
      cwMesh.userData = { rigId: r.id, arborY: cwY };
      itemGroup.add(cwMesh);
    }
    rigGroup.add(itemGroup);
  }
  root.add(rigGroup);

  // 5. Корпуса световых приборов (всегда в выключенном состоянии, единый нейтральный цвет корпуса)
  const fixturesGroup = new THREE.Group();
  fixturesGroup.name = 'Stage_Lighting_Fixtures';
  const shapeTemplates = {};
  for (const sh of ['spot', 'wash', 'beam', 'ledpar', 'profile', 'fresnel', 'par', 'follow']) {
    shapeTemplates[sh] = makeFixtureGLBGeometry(sh);
  }

  const q = new THREE.Quaternion();
  const sVec = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const downDir = new THREE.Vector3(0, -1, 0);
  q.setFromUnitVectors(zAxis, downDir);

  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const mount = new THREE.Vector3(f.worldPos.x, f.worldPos.y, -f.worldPos.d);
    const hang = !!f.mount.on || f.group.startsWith('BR');
    const head = mount.clone();
    if (hang) head.y -= ['spot', 'wash', 'beam'].includes(t.shape) ? 0.32 : 0.22;
    const sc = t.scale || 1;
    m4.compose(head, q, sVec.set(sc, sc, sc));

    const tpl = shapeTemplates[t.shape] || shapeTemplates.spot;
    const parts = [];
    const headClean = sanitizeGeometryForGLTF(tpl, m4);
    if (headClean) parts.push(headClean);

    if (hang) {
      const clampRaw = new THREE.BoxGeometry(0.18, 0.14, 0.18);
      clampRaw.translate(mount.x, mount.y - 0.07, mount.z);
      const clampClean = sanitizeGeometryForGLTF(clampRaw);
      if (clampClean) parts.push(clampClean);
    } else if (f.portable) {
      const standH = portable.mode === 'stand' ? PORTABLE.standY : PORTABLE.floorY;
      const poleRaw = new THREE.CylinderGeometry(0.025, 0.035, standH, 8);
      poleRaw.translate(mount.x, standH / 2, mount.z);
      const poleClean = sanitizeGeometryForGLTF(poleRaw);
      if (poleClean) parts.push(poleClean);
    }

    if (parts.length) {
      const merged = mergeGeometries(parts, false);
      const fMesh = new THREE.Mesh(merged, M.fixtureBody);
      const safeNo = String(f.no)
        .replace(/УФ-Л/g, 'UV_L')
        .replace(/УФ-П/g, 'UV_R')
        .replace(/^П$/g, 'GUN')
        .replace(/^Н(\d+)$/g, 'FLOOR_$1')
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

/**
 * Экспортировать сцену в бинарный буфер ArrayBuffer формата .glb (glTF 2.0).
 * @param {object} stage Экземпляр Stage (опционально)
 * @returns {Promise<ArrayBuffer>}
 */
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
