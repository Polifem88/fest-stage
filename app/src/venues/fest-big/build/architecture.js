// Архитектура: сценическая коробка, портал, авансцена, галереи, узел подъёма,
// приямок с решёткой, ригель, зрительный зал, конструкции для света в зале.
import * as THREE from 'three';
import {
  DIM, BOX_HALF, HALL_HALF, STEP_HALF_X, GALLERY_INNER_X, LEFT_GALLERY, BACK_GALLERY_FRONT_D, B2_SHAFT,
  RAKE, rowFrontD, pitEdgeX, gateNiche, doorNiche, hallFloorY, hallCanopyY,
} from '../config/dimensions.js';
import {
  HALL_CONTOUR_BY_ID, HALL_OUTER_BREAKS, hallSideWallSegments, hallLedCorners,
  hallOuterXAtD, stairBottomX, hallRampY,
} from '../config/hallGeometry.js';
import { getHallMaterials } from './hallMaterials.js';
import { box, rect, wallWithHoles, cylBetween, P, prism } from '../../../core/geom.js';

const W = BOX_HALF; // 8.5
const HW = HALL_HALF; // 8.0
const CEIL = DIM.box.ceiling;
const BACK = DIM.box.backWallD; // 9.2
const PT = DIM.portal.thickness;
const PW2 = DIM.portal.width / 2;
const GW = DIM.galleries.width;
const GX = GALLERY_INNER_X; // 7.60 — правая галерея
const LX0 = LEFT_GALLERY.x0; // -7.85 — внешняя кромка левой галереи
const LX1 = LEFT_GALLERY.x1; // -6.95 — внутренняя кромка левой галереи
const GB = BACK_GALLERY_FRONT_D; // 8.3
const UPY = DIM.galleries.upperY;
const FRY = DIM.galleries.frontY;
const LOWY = DIM.galleries.lowerY;
const GATEY = DIM.galleries.overGateY;
const pad = DIM.liftNode;
const PAD_X0 = W - pad.padSize; // 6.65
const PAD_D0 = BACK - pad.padSize; // 7.35

// Визуальные пропорции и зазоры конструктивных узлов галерей и площадки подъёма
const DECK_T = 0.06;
const EDGE_BEAM_DROP = 0.22;
const EDGE_BEAM_W = 0.04;
const STAIR_TREAD_T = 0.05;
const STAIR_STRINGER_R = 0.026;
const STAIR_STRINGER_INSET = 0.025;
const HANGER_INSET = 0.03;
const HANGER_R = 0.02;
const HANGER_BEAM_DROP = 0.16;
const HANGER_BEAM_HALF = 0.025;
const VERT_LADDER_OFFSET_X = 0.05;
const VERT_LADDER_GAP_MARGIN = 0.1;
const SIDE_LADDER_WALL_INSET = 0.12;
const SIDE_LADDER_GAP_W = 0.56;
const SIDE_DOOR_RECESS = 0.08;
const RACK_POST_HALF = 0.03;
const RACK_BAR_HALF = 0.025;
const RACK_RAIL_R = 0.028;
const RACK_TIE_DROP = 0.06;
const FASCIA_DROP = DIM.galleries.fasciaDrop;
const FASCIA_RISE = 0.12;
const FASCIA_THICK = 0.03;
const GATE_STAIR_W = DIM.galleries.gateStairW;
const GATE_SEAM_HALF = 0.01;
const GATE_LEAF_OFFSET = 0.015;
const GATE_CHANNEL_DEPTH = 0.06;
// Визуальные пропорции дверей и фасок зрительного зала
const HALL_DOOR_RECESS = 0.025;
const HALL_DOOR_SEAM = 0.01;
const HALL_DOOR_TRIM_W = 0.045;
const HALL_DOOR_TRIM_OUT = 0.006;
const HALL_HANDLE_Y0 = 0.88;
const HALL_HANDLE_Y1 = 1.18;
const HALL_HANDLE_R = 0.011;
const HALL_HANDLE_OFFSET = 0.065;
const HALL_HANDLE_OUT = 0.028;
const WALL_PANEL_UV_DEFAULT = 1.2;
const pit = DIM.pit;
const pier = DIM.wallPier;
const rack = DIM.rack;
const gate = DIM.openings.gate;
const bdoor = DIM.openings.backDoor;
const gn = gateNiche();
const dn = doorNiche();
const sdoor = DIM.openings.sideDoor;
const FS = DIM.forestage;
const FSH = FS.height;

// Профиль потолка зала (d, y)
export const HALL_CEIL_PROFILE = [
  [0, DIM.decoCeilingY],
  [-2.9, DIM.decoCeilingY],
  [DIM.hall.ceilingSlopeTo, DIM.hall.ceilingY],
  [-DIM.hall.portalToBoothWall, DIM.hall.ceilingY],
];
export function hallCeilingY(d) {
  const p = HALL_CEIL_PROFILE;
  for (let i = 0; i < p.length - 1; i++) {
    const [d0, y0] = p[i], [d1, y1] = p[i + 1];
    if (d <= d0 && d >= d1) return y0 + ((d - d0) / (d1 - d0)) * (y1 - y0);
  }
  return DIM.hall.ceilingY;
}
const lastRowBackD = rowFrontD(DIM.hall.rows - 1) - DIM.hall.rowPitch;
export const HALL_BACK_FLOOR_Y = hallFloorY(-DIM.hall.portalToBoothWall, 0);

/** Перила вдоль отрезка (x,d)→(x,d) на высоте пола y (число или [y0, y1] для маршей). gaps: [[t0,t1]] в долях длины. */
function railing(out, x0, d0, x1, d1, y, { h = DIM.galleries.railH, postStep = 1.5, gaps = [], toe = true, k = 1 } = {}) {
  const [y0, y1] = Array.isArray(y) ? y : [y, y];
  const len = Math.hypot(x1 - x0, d1 - d0);
  const segs = [];
  let t = 0;
  for (const [g0, g1] of gaps.sort((a, b) => a[0] - b[0])) { if (g0 > t) segs.push([t, g0]); t = g1; }
  if (t < 1) segs.push([t, 1]);
  const at = (s, dy) => P(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s + dy, d0 + (d1 - d0) * s);
  for (const [s0, s1] of segs) {
    out.push(cylBetween(at(s0, h), at(s1, h), 0.021 * k));
    out.push(cylBetween(at(s0, h * 0.5), at(s1, h * 0.5), 0.016 * k));
    if (toe) out.push(cylBetween(at(s0, 0.05), at(s1, 0.05), 0.012 * k, 4));
    const n = Math.max(1, Math.round(((s1 - s0) * len) / postStep));
    for (let i = 0; i <= n; i++) out.push(cylBetween(at(s0 + ((s1 - s0) * i) / n, 0), at(s0 + ((s1 - s0) * i) / n, h), 0.02 * k, 5));
  }
}

/** Вертикальная лестница: плоскость лестницы вдоль оси 'd' или 'x'. k — множитель сечения. */
function ladder(out, cx, cd, y0, y1, width, along = 'd', k = 1) {
  const h = width / 2;
  const a = along === 'd' ? [P(cx, y0, cd - h), P(cx, y1, cd - h)] : [P(cx - h, y0, cd), P(cx - h, y1, cd)];
  const b = along === 'd' ? [P(cx, y0, cd + h), P(cx, y1, cd + h)] : [P(cx + h, y0, cd), P(cx + h, y1, cd)];
  out.push(cylBetween(a[0], a[1], 0.022 * k, 5), cylBetween(b[0], b[1], 0.022 * k, 5));
  for (let y = y0 + 0.3; y < y1 - 0.05; y += 0.3) {
    out.push(along === 'd' ? cylBetween(P(cx, y, cd - h), P(cx, y, cd + h), 0.014 * k, 4) : cylBetween(P(cx - h, y, cd), P(cx + h, y, cd), 0.014 * k, 4));
  }
}

/** Вертикальная лестница в произвольной вертикальной плоскости вдоль единичного вектора [ux, ud]. */
function ladderAlong(out, [cx, cd], [ux, ud], y0, y1, width, k = 1) {
  const h = width / 2;
  const ax = cx - ux * h, ad = cd - ud * h;
  const bx = cx + ux * h, bd = cd + ud * h;
  out.push(
    cylBetween(P(ax, y0, ad), P(ax, y1, ad), 0.022 * k, 5),
    cylBetween(P(bx, y0, bd), P(bx, y1, bd), 0.022 * k, 5),
  );
  for (let y = y0 + 0.3; y < y1 - 0.05; y += 0.3) {
    out.push(cylBetween(P(ax, y, ad), P(bx, y, bd), 0.014 * k, 4));
  }
}

/** Вертикальный четырёхугольник от (x0, d0) до (x1, d1), по высоте y0..y1 (facing > 0 — нормаль вправо по ходу 0→1). */
function vQuad(x0, d0, x1, d1, y0, y1, facing = 1) {
  const p0 = P(x0, y0, d0), p1 = P(x1, y0, d1), p2 = P(x1, y1, d1), p3 = P(x0, y1, d0);
  const verts = facing > 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2];
  const pos = new Float32Array(18);
  verts.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Наклонная плита-пандус от (x0..x1, y0, d0) к (x0..x1, y1, d1), видимая сверху (+Y). */
function rampQuad(x0, x1, d0, y0, d1, y1) {
  const p0 = P(x0, y0, d0), p1 = P(x1, y0, d0), p2 = P(x1, y1, d1), p3 = P(x0, y1, d1);
  const verts = [p0, p1, p2, p0, p2, p3];
  const pos = new Float32Array(18);
  verts.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Лестничный марш между двумя площадками (yFrom → yTo): парные наклонные косоуры и симметричные промежуточные ступени. */
function stairFlight(out, { x0, x1, d0, d1, yFrom, yTo, steps, axis = 'x' }) {
  const yStr0 = yFrom - DECK_T, yStr1 = yTo - DECK_T;
  if (axis === 'x') {
    for (const dd of [d0 + STAIR_STRINGER_INSET, d1 - STAIR_STRINGER_INSET]) {
      out.push(cylBetween(P(x0, yStr0, dd), P(x1, yStr1, dd), STAIR_STRINGER_R, 5));
    }
  } else {
    for (const xx of [x0 + STAIR_STRINGER_INSET, x1 - STAIR_STRINGER_INSET]) {
      out.push(cylBetween(P(xx, yStr0, d0), P(xx, yStr1, d1), STAIR_STRINGER_R, 5));
    }
  }
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const top = yFrom + (yTo - yFrom) * ((i + 1) / (steps + 1));
    if (axis === 'x') out.push(box(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, top - STAIR_TREAD_T, top, d0, d1));
    else out.push(box(x0, x1, top - STAIR_TREAD_T, top, d0 + (d1 - d0) * t0, d0 + (d1 - d0) * t1));
  }
}

export function buildArchitecture(batch, M) {
  // ===========================================================================
  //  ПЛАНШЕТ (с трапециевидным вырезом под приямок)
  // ===========================================================================
  const pitX0 = pitEdgeX(pit.fromD); // 8.00
  const pitX1 = pitEdgeX(pit.toD); // 7.50
  const floorPts = [
    [-W, PT], [-PW2, PT], [-PW2, 0], [PW2, 0], [PW2, PT], [W, PT],
    [W, pit.fromD], [pitX0, pit.fromD],
    [pitX1, pit.toD], [W, pit.toD], [W, BACK], [-W, BACK],
  ];
  const floorGeo = new THREE.ShapeGeometry(new THREE.Shape(floorPts.map(([x, d]) => new THREE.Vector2(x, d))));
  floorGeo.rotateX(-Math.PI / 2);
  batch.add('walls', M.floor, floorGeo, { tag: 'stageFloor' });

  // ===========================================================================
  //  АВАНСЦЕНА: перед + бока под прямым углом на sideStraight, далее скос к порталу;
  //  в нишах между скосом, прямым боком и порталом — трапециевидные лестницы
  // ===========================================================================
  const FW2 = FS.frontWidth / 2;
  const BREAK_D = -FS.depth + FS.sideStraight; // точка «излома» бока
  const fsPts = [[-PW2, 0], [-FW2, BREAK_D], [-FW2, -FS.depth], [FW2, -FS.depth], [FW2, BREAK_D], [PW2, 0]];
  // верх
  const top = prism(fsPts, -0.02, 0);
  batch.add('walls', M.floor, top, { tag: 'stageFloor' });
  // фронт и боковины (тёмные, опущены до уровня передних углов зала -0,85 м)
  const cornerFloorY = DIM.hall.frontCornerFloorY;
  batch.add('walls', M.stageEdge, prism(fsPts, cornerFloorY, -0.02));

  for (const side of [-1, 1]) {
    // верхнее основание трапеции = скос авансцены: внутренний угол портала A → излом B
    const A = new THREE.Vector2(side * PW2, 0), B = new THREE.Vector2(side * FW2, BREAK_D);
    const eu = B.clone().sub(A).normalize();
    // нормаль наружу (от авансцены, в сторону зала/стены)
    const n = new THREE.Vector2(-eu.y, eu.x);
    if (n.x * side < 0) n.negate();
    // нижнее основание параллельно скосу и проходит через передний угол авансцены
    const C = new THREE.Vector2(side * FW2, -FS.depth);
    const total = C.clone().sub(A).dot(n); // полная ширина марша
    const rises = FS.stairs.steps; // последний подъём — на саму авансцену
    const tread = total / (rises - 1);
    // точки линии со смещением s: пересечение с плоскостью портала (d = 0) и с прямым боком (x = ±FW2)
    const lineAt = (s) => {
      const base = A.clone().add(n.clone().multiplyScalar(s));
      const atD0 = base.clone().add(eu.clone().multiplyScalar(-base.y / eu.y));
      const atSide = base.clone().add(eu.clone().multiplyScalar((side * FW2 - base.x) / eu.x));
      return [atD0, atSide];
    };
    for (let k = 0; k < rises - 1; k++) {
      const yTop = -FSH * (k + 1) / rises;
      const [a0, a1] = lineAt(k * tread), [b0, b1] = lineAt((k + 1) * tread);
      const pts = [[a0.x, a0.y], [a1.x, a1.y], [b1.x, b1.y], [b0.x, b0.y]];
      batch.add('walls', M.stageEdge, prism(pts, cornerFloorY, yTop));
    }
  }

  // ===========================================================================
  //  ПОРТАЛ
  // ===========================================================================
  const portalHole = [{ a0: -PW2, a1: PW2, b0: -1, b1: DIM.portal.height }];
  const portalP0X = HALL_CONTOUR_BY_ID.P0.x;
  const canopyY0 = hallCanopyY(0);
  // сторона зала (опущена до -0,85 м и закрывает ниши ±8,00..8,20 м под карнизом без выступания наружу зала)
  batch.add('walls', M.portal, [
    ...wallWithHoles('d', 0, -HW, HW, cornerFloorY, DIM.decoCeilingY, -1, portalHole),
    rect('d', 0, -portalP0X, -HW, cornerFloorY, canopyY0, -1),
    rect('d', 0, HW, portalP0X, cornerFloorY, canopyY0, -1),
  ]);
  // сторона сцены
  batch.add('walls', M.portal, wallWithHoles('d', PT, -W, W, 0, DIM.decoCeilingY, 1, portalHole));
  // откосы и верх проёма
  batch.add('walls', M.portal, [
    rect('x', -PW2, 0, PT, 0, DIM.portal.height, 1),
    rect('x', PW2, 0, PT, 0, DIM.portal.height, -1),
    rect('y', DIM.portal.height, -PW2, PW2, 0, PT, -1),
    rect('y', DIM.decoCeilingY, -W, W, 0, PT, 1),
  ]);

  // ===========================================================================
  //  СЦЕНИЧЕСКАЯ КОРОБКА (стены видны изнутри — снаружи «прозрачны», как в кукольном домике)
  // ===========================================================================
  // левая стена
  batch.add('walls', M.brickSide, rect('x', -W, PT, BACK, 0, CEIL, 1), { tag: 'wallL' });
  // правая стена с проёмом двери в приямке
  const sideDoorHole = [{ a0: sdoor.fromD, a1: sdoor.fromD + sdoor.width, b0: -pit.depth - 0.01, b1: -pit.depth + sdoor.height }];
  batch.add('walls', M.brickSide, wallWithHoles('x', W, PT, BACK, 0, CEIL, -1, sideDoorHole), { tag: 'wallR' });
  batch.add('walls', M.brickSide, wallWithHoles('x', W, pit.fromD, pit.toD, -pit.depth, 0, -1, sideDoorHole), { tag: 'wallR' });
  batch.add('walls', M.door, rect('x', W + SIDE_DOOR_RECESS, sdoor.fromD, sdoor.fromD + sdoor.width, -pit.depth, -pit.depth + sdoor.height, -1));
  batch.add('walls', M.blackWall, [
    rect('d', sdoor.fromD, W, W + SIDE_DOOR_RECESS, -pit.depth, -pit.depth + sdoor.height, 1),
    rect('d', sdoor.fromD + sdoor.width, W, W + SIDE_DOOR_RECESS, -pit.depth, -pit.depth + sdoor.height, -1),
    rect('y', -pit.depth + sdoor.height, W, W + SIDE_DOOR_RECESS, sdoor.fromD, sdoor.fromD + sdoor.width, -1),
  ]);
  batch.add('walls', M.stageEdge, rect('y', -pit.depth, W, W + SIDE_DOOR_RECESS, sdoor.fromD, sdoor.fromD + sdoor.width, 1));
  // задняя стена: проёмы в ниши ворот (2,40) и двери (1,90). Под нижней галереей (2,20; над нишей ворот — 2,90)
  // кирпич закрашен матовым чёрным, выше — обычная кладка.
  const backHoles = [
    { a0: gn.x0, a1: gn.x1, b0: -0.01, b1: gn.ceilY },
    { a0: dn.x0, a1: dn.x1, b0: -0.01, b1: dn.ceilY },
  ];
  const lowBands = [[-W, gn.x0, LOWY], [gn.x0, gn.x1, GATEY], [gn.x1, W, LOWY]];
  const brickHoles = [...backHoles, ...lowBands.map(([a0, a1, h]) => ({ a0, a1, b0: -0.01, b1: h }))];
  batch.add('walls', M.brickBack, wallWithHoles('d', BACK, -W, W, 0, CEIL, -1, brickHoles), { tag: 'wallB' });
  for (const [a0, a1, h] of lowBands) {
    const holes = backHoles.filter((hole) => hole.a1 > a0 && hole.a0 < a1); // wallWithHoles не отсекает проёмы вне [a0, a1]
    batch.add('walls', M.brickBlack, wallWithHoles('d', BACK, a0, a1, 0, h, -1, holes), { tag: 'wallB' });
  }
  // ниши задних ворот и двери (d = 9,20..10,30 м, пандус 0 → -0,35 м, ровный потолок ниши)
  const gMid = (gn.x0 + gn.x1) / 2;
  const gLeafTop = -gn.floorDrop + gate.height; // 2.25
  const dLeafTop = -dn.floorDrop + bdoor.height; // 1.65
  const nicheWalls = [];
  for (const n of [gn, dn]) {
    const sidePts = [[n.d0, 0], [n.d1, -n.floorDrop], [n.d1, n.ceilY], [n.d0, n.ceilY]];
    nicheWalls.push(
      sideWallPoly(n.x0, sidePts, 1),
      sideWallPoly(n.x1, sidePts, -1),
      rect('y', n.ceilY, n.x0, n.x1, n.d0, n.d1, -1),
    );
  }
  // тёмная подложка за левой створкой и швом ворот + полоска стены 0,25 м над задней дверью
  nicheWalls.push(
    rect('d', gn.d1, gn.x0, gMid + GATE_SEAM_HALF, -gn.floorDrop, gLeafTop, -1),
    rect('d', dn.d1, dn.x0, dn.x1, dLeafTop, dn.ceilY, -1),
  );
  batch.add('walls', M.blackWall, nicheWalls, { tag: 'wallB' });
  // пандусы ниш (лицом вверх)
  batch.add('walls', M.stageEdge, [
    rampQuad(gn.x0, gn.x1, gn.d0, 0, gn.d1, -gn.floorDrop),
    rampQuad(dn.x0, dn.x1, dn.d0, 0, dn.d1, -dn.floorDrop),
  ]);
  // створки ворот (2 шт., стык по оси ниши), швеллер-направляющая 0,15 м над ними и полотно задней двери
  batch.add('walls', M.gate, [
    rect('d', gn.d1 - GATE_LEAF_OFFSET, gn.x0, gMid - GATE_SEAM_HALF, -gn.floorDrop, gLeafTop, -1),
    rect('d', gn.d1, gMid + GATE_SEAM_HALF, gn.x1, -gn.floorDrop, gLeafTop, -1),
  ]);
  batch.add('walls', M.steel, [
    rect('d', gn.d1 - GATE_CHANNEL_DEPTH, gn.x0, gn.x1, gLeafTop, gn.ceilY, -1),
    rect('y', gLeafTop, gn.x0, gn.x1, gn.d1 - GATE_CHANNEL_DEPTH, gn.d1, -1),
  ]);
  batch.add('walls', M.door, rect('d', dn.d1, dn.x0, dn.x1, -dn.floorDrop, dLeafTop, -1));
  // потолок коробки (виден только снизу) + чердак над авансценой
  batch.add('walls', M.blackWall, rect('y', CEIL, -W, W, -2.9, BACK, -1), { tag: 'ceiling', shadow: false });
  batch.add('walls', M.attic, [
    rect('d', -2.9, -W, W, DIM.decoCeilingY, CEIL, 1),
    rect('x', -W, -2.9, PT, DIM.decoCeilingY, CEIL, 1),
    rect('x', W, -2.9, PT, DIM.decoCeilingY, CEIL, -1),
  ], { tag: 'ceiling', shadow: false });

  // ригель
  batch.add('walls', M.rigel, box(-W, W, DIM.rigel.bottomY, CEIL, DIM.rigel.d - DIM.rigel.width / 2, DIM.rigel.d + DIM.rigel.width / 2));

  // ===========================================================================
  //  ПРИЯМОК У ПРАВОЙ СТЕНЫ (трапеция 0,5 → 1,0 м, глубина 0,85 м) И ВЫСТУП СТЕНЫ
  // ===========================================================================
  batch.add('walls', M.blackWall, [
    // косая стенка приямка (лицом внутрь приямка) и задний подступенок у d = pit.toD
    vQuad(pitX0, pit.fromD, pitX1, pit.toD, -pit.depth, 0, 1),
    rect('d', pit.toD, pitX1, W, -pit.depth, 0, -1),
    // выступ стены за узлом Ш1/С0/З: лицевая грань к сцене, общий торец с узким концом приямка (-0,85..5,64) и верх 5,64
    rect('x', pier.x0, pier.fromD, pier.toD, 0, pier.topY, -1),
    rect('d', pier.toD, pier.x0, W, -pit.depth, pier.topY, 1),
    rect('y', pier.topY, pier.x0, W, pier.fromD, pier.toD, 1),
  ]);
  const stepsStartD = pit.toD - (pit.steps - 1) * pit.tread;
  const pitBotPts = [
    [pitX0, pit.fromD], [W, pit.fromD],
    [W, stepsStartD], [pitEdgeX(stepsStartD), stepsStartD],
  ];
  const pitBotGeo = new THREE.ShapeGeometry(new THREE.Shape(pitBotPts.map(([x, d]) => new THREE.Vector2(x, d))));
  pitBotGeo.rotateX(-Math.PI / 2);
  pitBotGeo.translate(0, -pit.depth, 0);
  batch.add('walls', M.stageEdge, pitBotGeo);
  const steps = [];
  for (let i = 0; i < pit.steps - 1; i++) {
    const dA = pit.toD - (i + 1) * pit.tread;
    const dB = pit.toD - i * pit.tread;
    const yTop = -(i + 1) * (pit.depth / pit.steps);
    steps.push(prism([[pitEdgeX(dA), dA], [W, dA], [W, dB], [pitEdgeX(dB), dB]], -pit.depth, yTop));
  }
  batch.add('walls', M.stageEdge, steps);

  // ===========================================================================
  //  ВЕРХНЯЯ ГАЛЕРЕЯ (5.7 по бокам и сзади, 6.2 спереди над порталом)
  // ===========================================================================
  const deck = [];
  const steel = [];
  const FRONT_D1 = DIM.galleries.frontToD; // 0.8
  const STAIR_LEN = DIM.galleries.upperStairLen; // 0.8
  const STAIR_D1 = FRONT_D1 + STAIR_LEN; // 1.6
  // боковые (горизонтальный настил начинается за переходной лесенкой 6,20 → 5,70, в правом заднем углу вырез 0,5 × 0,5 под Б2) и единая задняя галерея (-W..GX)
  deck.push(box(LX0, LX1, UPY - DECK_T, UPY, STAIR_D1, GB));
  deck.push(box(GX, W, UPY - DECK_T, UPY, STAIR_D1, B2_SHAFT.d0));
  deck.push(box(GX, B2_SHAFT.x0, UPY - DECK_T, UPY, B2_SHAFT.d0, BACK));
  deck.push(box(-W, GX, UPY - DECK_T, UPY, GB, BACK));
  // передняя над порталом
  deck.push(box(-W, W, FRY - DECK_T, FRY, DIM.galleries.frontFromD, FRONT_D1));
  // кромочные балки
  steel.push(box(LX0, LX0 + EDGE_BEAM_W, UPY - EDGE_BEAM_DROP, UPY - DECK_T, STAIR_D1, GB));
  steel.push(box(LX1 - EDGE_BEAM_W, LX1, UPY - EDGE_BEAM_DROP, UPY - DECK_T, STAIR_D1, GB));
  steel.push(box(GX - EDGE_BEAM_W / 2, GX + EDGE_BEAM_W / 2, UPY - EDGE_BEAM_DROP, UPY - DECK_T, STAIR_D1, GB));
  steel.push(box(-W, LX0, UPY - EDGE_BEAM_DROP, UPY - DECK_T, GB - EDGE_BEAM_W / 2, GB + EDGE_BEAM_W / 2));
  steel.push(box(LX1, GX, UPY - EDGE_BEAM_DROP, UPY - DECK_T, GB - EDGE_BEAM_W / 2, GB + EDGE_BEAM_W / 2));
  steel.push(box(-W, W, FRY - EDGE_BEAM_DROP, FRY - DECK_T, FRONT_D1 - EDGE_BEAM_W / 2, FRONT_D1 + EDGE_BEAM_W / 2));
  // лесенки 6.2 → 5.7 в передних углах (по боковым галереям, на наклонных косоурах)
  stairFlight(steel, { x0: LX0, x1: LX1, d0: FRONT_D1, d1: STAIR_D1, yFrom: FRY, yTo: UPY, steps: 3, axis: 'd' });
  stairFlight(steel, { x0: GX, x1: W, d0: FRONT_D1, d1: STAIR_D1, yFrom: FRY, yTo: UPY, steps: 3, axis: 'd' });
  // перила: левая галерея (внутренняя и внешняя кромки) и правая галерея
  railing(steel, LX1, STAIR_D1, LX1, GB, UPY);
  railing(steel, LX0, STAIR_D1, LX0, GB, UPY);
  railing(steel, GX, STAIR_D1, GX, GB, UPY);
  const vlD = pad.vertLadder.d;
  const vlX = PAD_X0 - VERT_LADDER_OFFSET_X;
  const vlUpperGapW = pad.vertLadder.upperGapW;
  const backSpan = GX - LX1;
  railing(steel, -W, GB, LX0, GB, UPY); // над зазором у заднего левого угла
  railing(steel, LX1, GB, GX, GB, UPY, { gaps: [[(vlX - LX1) / backSpan, (vlX + vlUpperGapW - LX1) / backSpan]] });
  // перила вокруг отверстия 0,5 × 0,5 м в углу верхней галереи под узел Б2
  railing(steel, B2_SHAFT.x0, B2_SHAFT.d0, B2_SHAFT.x0, BACK, UPY);
  railing(steel, B2_SHAFT.x0, B2_SHAFT.d0, W, B2_SHAFT.d0, UPY);
  railing(steel, -W, FRONT_D1, LX0, FRONT_D1, FRY); // передняя галерея над зазором
  railing(steel, LX1, FRONT_D1, GX, FRONT_D1, FRY); // передняя галерея со стороны сцены
  railing(steel, -W, DIM.galleries.frontFromD, W, DIM.galleries.frontFromD, FRY); // со стороны зала
  railing(steel, LX1, FRONT_D1, LX1, STAIR_D1, [FRY, UPY], { postStep: 0.8 });
  railing(steel, LX0, FRONT_D1, LX0, STAIR_D1, [FRY, UPY], { postStep: 0.8 });
  railing(steel, GX, FRONT_D1, GX, STAIR_D1, [FRY, UPY], { postStep: 0.8 });
  // опоры боковых галерей: справа — кронштейны к стене (на d = 1,2 — от лицевой грани выступа к косоуру), слева — 4 станции вертикальных тяжей к потолку
  for (let d = 1.2; d < BACK - 0.5; d += 2.0) {
    const onPier = d >= pier.fromD && d <= pier.toD;
    const xWall = onPier ? pier.x0 : W;
    const yEdge = d < STAIR_D1
      ? FRY + (UPY - FRY) * ((d - FRONT_D1) / STAIR_LEN) - DECK_T
      : UPY - 0.15;
    const yWall = (yEdge - 0.85) + ((W - xWall) / (W - GX)) * 0.85;
    steel.push(cylBetween(P(xWall, yWall, d), P(GX + (d < STAIR_D1 ? STAIR_STRINGER_INSET : 0), yEdge, d), 0.025, 4));
  }
  for (const d of DIM.galleries.leftHangersD) {
    steel.push(
      box(LX0, LX1, UPY - HANGER_BEAM_DROP, UPY - DECK_T, d - HANGER_BEAM_HALF, d + HANGER_BEAM_HALF),
      cylBetween(P(LX0 + HANGER_INSET, UPY - DECK_T, d), P(LX0 + HANGER_INSET, CEIL, d), HANGER_R, 6),
      cylBetween(P(LX1 - HANGER_INSET, UPY - DECK_T, d), P(LX1 - HANGER_INSET, CEIL, d), HANGER_R, 6),
    );
  }

  // ===========================================================================
  //  НИЖНЯЯ ГАЛЕРЕЯ (задняя стена, 2.2; над нишей ворот — 2.9)
  // ===========================================================================
  const UP_X0 = gn.x0 - GATE_STAIR_W, UP_X1 = gn.x1; // участок 2,90 ровно над нишей ворот (x = 3,15..6,10)
  deck.push(box(-W, UP_X0, LOWY - DECK_T, LOWY, GB, BACK));
  deck.push(box(gn.x0, UP_X1, GATEY - DECK_T, GATEY, GB, BACK));
  stairFlight(steel, { x0: UP_X0, x1: gn.x0, d0: GB, d1: BACK, yFrom: LOWY, yTo: GATEY, steps: 3, axis: 'x' });
  stairFlight(steel, { x0: UP_X1, x1: PAD_X0, d0: GB, d1: BACK, yFrom: GATEY, yTo: LOWY, steps: 3, axis: 'x' });
  // серая обшивка-кромка (как на фото)
  const fascia = [
    box(-W, UP_X0, LOWY - FASCIA_DROP, LOWY + FASCIA_RISE, GB - FASCIA_THICK, GB),
    box(gn.x0, UP_X1, GATEY - FASCIA_DROP, GATEY + FASCIA_RISE, GB - FASCIA_THICK, GB),
  ];
  batch.add('galleries', M.fascia, fascia);
  railing(steel, -W, GB, UP_X0, GB, LOWY);
  railing(steel, UP_X0, GB, gn.x0, GB, [LOWY, GATEY], { postStep: 0.6 });
  railing(steel, gn.x0, GB, UP_X1, GB, GATEY);
  railing(steel, UP_X1, GB, PAD_X0, GB, [GATEY, LOWY], { postStep: 0.6 });
  // подвесы нижней галереи к верхней
  for (let x = -7.5; x < PAD_X0; x += 2.5) steel.push(cylBetween(P(x, x >= gn.x0 && x <= UP_X1 ? GATEY : LOWY, GB + 0.03), P(x, UPY - DECK_T, GB + 0.03), 0.022, 5));
  // труба под нижней галереей с синими приборами дежурки
  steel.push(cylBetween(P(-W, LOWY - 0.45, BACK - 0.35), P(UP_X0, LOWY - 0.45, BACK - 0.35), 0.024, 6));

  // ===========================================================================
  //  УЗЕЛ ПОДЪЁМА (задний правый угол)
  // ===========================================================================
  // трубы ограждения и лестниц узла — в 1.5 раза толще галерейных (на фото узел заметно массивнее); в углу вырез 0,5 × 0,5 под Б2
  const LIFT_K = 1.5;
  deck.push(box(PAD_X0, W, pad.padY - 0.08, pad.padY, PAD_D0, B2_SHAFT.d0));
  deck.push(box(PAD_X0, B2_SHAFT.x0, pad.padY - 0.08, pad.padY, B2_SHAFT.d0, BACK));
  const slGapT0 = (pad.padSize - SIDE_LADDER_GAP_W) / pad.padSize;
  const vlGapD0 = vlD - pad.vertLadder.width / 2 - VERT_LADDER_GAP_MARGIN;
  const vlGapT0 = (vlGapD0 - PAD_D0) / (GB - PAD_D0);
  railing(steel, PAD_X0, PAD_D0, W, PAD_D0, pad.padY, { gaps: [[slGapT0, 1]], k: LIFT_K }); // проход с технической лестницы у стены
  railing(steel, PAD_X0, PAD_D0, PAD_X0, GB, pad.padY, { gaps: [[vlGapT0, 1]], k: LIFT_K }); // проход к вертикальной лестнице
  // стойки площадки
  steel.push(box(PAD_X0 - 0.03, PAD_X0 + 0.03, 0, pad.padY - 0.08, PAD_D0 - 0.03, PAD_D0 + 0.03));
  steel.push(box(W - 0.06, W, 0, pad.padY - 0.08, PAD_D0 - 0.03, PAD_D0 + 0.03));
  // техническая (приставная) лестница к правой стене перед площадкой — лезут лицом к стене
  const slD = PAD_D0 - pad.sideLadder.gapToPad - pad.sideLadder.width / 2;
  ladder(steel, W - SIDE_LADDER_WALL_INSET, slD, 0, pad.padY + 1.0, pad.sideLadder.width, 'd', LIFT_K);
  // вертикальная лестница без ограждения: с площадки на заднюю верхнюю галерею, лицом к сцене
  ladder(steel, vlX, vlD, pad.padY, pad.vertLadder.topY + 1.0, pad.vertLadder.width, 'd', LIFT_K);

  // ===========================================================================
  //  КОСАЯ РЕШЁТКА НАД ПРИЯМКОМ (по кромке pitEdgeX, этажи 2,10 и 4,50, верх 5,64)
  // ===========================================================================
  const rackLen = Math.hypot(pitX1 - pitX0, pit.toD - pit.fromD);
  const rackUx = (pitX1 - pitX0) / rackLen;
  const rackUd = (pit.toD - pit.fromD) / rackLen;
  const rackSpans = Math.max(1, Math.round(rackLen / rack.postStep));
  for (let k = 0; k <= rackSpans; k++) {
    const t = k / rackSpans;
    const px = pitX0 + (pitX1 - pitX0) * t;
    const pd = pit.fromD + (pit.toD - pit.fromD) * t;
    if (k === rack.ladderPost) {
      ladderAlong(steel, [px, pd], [rackUx, rackUd], -pit.depth, rack.topY, rack.ladderWidth);
      const hw = rack.ladderWidth / 2;
      for (const ly of rack.levels) {
        for (const s of [-1, 1]) {
          const sx = px + rackUx * hw * s, sd = pd + rackUd * hw * s;
          steel.push(box(sx, W, ly - RACK_BAR_HALF, ly + RACK_BAR_HALF, sd - RACK_BAR_HALF, sd + RACK_BAR_HALF));
        }
      }
      continue;
    }
    steel.push(box(px - RACK_POST_HALF, px + RACK_POST_HALF, -pit.depth, rack.topY, pd - RACK_POST_HALF, pd + RACK_POST_HALF));
    for (const ly of rack.levels) {
      steel.push(box(px, W, ly - RACK_BAR_HALF, ly + RACK_BAR_HALF, pd - RACK_BAR_HALF, pd + RACK_BAR_HALF));
    }
  }
  for (const ly of rack.levels) {
    steel.push(cylBetween(P(pitX0, ly, pit.fromD), P(pitX1, ly, pit.toD), RACK_RAIL_R, 4));
  }
  // крайняя стойка у d = 4,75 (x = 7,50, вне настила) привязана короткой связью к кромочной балке галереи (x = 7,60)
  if (pitX1 < GX) {
    steel.push(box(pitX1 - RACK_POST_HALF, GX, rack.topY - RACK_TIE_DROP, rack.topY, pit.toD - RACK_BAR_HALF, pit.toD + RACK_BAR_HALF));
  }

  batch.add('galleries', M.steel, deck);
  batch.add('galleries', M.steel, steel);

  // ===========================================================================
  //  ЗРИТЕЛЬНЫЙ ЗАЛ
  // ===========================================================================
  buildHall(batch, M);
}

function buildHall(batch, M) {
  const H = DIM.hall;
  const { hallBeigePanel, hallCanopy } = getHallMaterials(M);
  const beigeScale = hallBeigePanel.userData?.uvScale || 0.575;
  const panelScale = M.wallPanel?.userData?.uvScale || WALL_PANEL_UV_DEFAULT;
  const backD = -H.portalToBoothWall;
  const fy = -FSH;
  const secondRowD = rowFrontD(1); // -5.70
  const B1 = HALL_CONTOUR_BY_ID.B1;
  const B2 = HALL_CONTOUR_BY_ID.B2;
  const B3 = HALL_CONTOUR_BY_ID.B3;
  const E1 = HALL_CONTOUR_BY_ID.E1;
  const E2 = HALL_CONTOUR_BY_ID.E2;

  // Цепочка внешних узлов контура на [dBack, dFront] (dFront > dBack) для стороны side ∈ {-1, 1}
  const outerChain = (dFront, dBack, side = 1) => {
    const pts = [[side * hallOuterXAtD(dFront), dFront]];
    for (const p of HALL_OUTER_BREAKS) {
      if (p.d < dFront - 1e-6 && p.d > dBack + 1e-6) pts.push([side * p.x, p.d]);
    }
    pts.push([side * hallOuterXAtD(dBack), dBack]);
    return pts;
  };

  // ===========================================================================
  //  1. ПОЛ ЗАЛА (криволинейные передние углы -0,85..-0,75, партер, ступени ±7,06
  //     с треугольными щёчками, гладкие пандусы 9° и горизонтальные тамбуры выходов)
  // ===========================================================================
  const floorGeoms = [];

  // 1а. Передние боковые карманы d ∈ [-FS.depth, 0] снаружи лестниц авансцены
  const cornerCuts = subdivideSortedD([0, HALL_CONTOUR_BY_ID.P1.d, HALL_CONTOUR_BY_ID.Z0.d, -FS.depth], 0.14);
  for (const side of [-1, 1]) {
    floorGeoms.push(buildCornerFloorGrid(side, cornerCuts, 8));
  }

  // 1б. Горизонтальный партер и 1-й ряд кресел d ∈ [-5,70; -2,75]
  const rightParterre = outerChain(-FS.depth, secondRowD, 1);
  const leftParterre = outerChain(-FS.depth, secondRowD, -1).reverse();
  floorGeoms.push(hallPlanPoly([...rightParterre, ...leftParterre], () => fy, true));

  // 1в. Центральные ступени рядов 2..15 (i = 1..14) на [-STEP_HALF_X, +STEP_HALF_X] + треугольные боковые щёчки
  for (let i = 1; i < H.rows; i++) {
    const yPrev = fy + (i - 1) * H.rowPitch * RAKE;
    const yRow = fy + i * H.rowPitch * RAKE;
    const dFront = rowFrontD(i);
    const dBack = dFront - H.rowPitch;
    floorGeoms.push(
      rect('y', yRow, -STEP_HALF_X, STEP_HALF_X, dBack, dFront, 1),
      rect('d', dFront, -STEP_HALF_X, STEP_HALF_X, yPrev, yRow, 1),
    );
    for (const s of [-1, 1]) {
      floorGeoms.push(sideWallPoly(s * STEP_HALF_X, [[dFront, yPrev], [dBack, yRow], [dFront, yRow]], s));
    }
  }

  // 1г. Гладкие боковые пандусы 9° (|X| ≥ STEP_HALF_X, d ∈ [lastRowBackD, -5,70]) + общий задний пандус до E1.d
  for (const s of [-1, 1]) {
    const outer = outerChain(secondRowD, lastRowBackD, s);
    const inner = [[s * STEP_HALF_X, lastRowBackD], [s * STEP_HALF_X, secondRowD]];
    floorGeoms.push(hallPlanPoly([...outer, ...inner], (_x, d) => hallRampY(d), true));
  }
  const rearRampRight = outerChain(lastRowBackD, E1.d, 1);
  const rearRampLeft = outerChain(lastRowBackD, E1.d, -1).reverse();
  floorGeoms.push(hallPlanPoly([...rearRampRight, ...rearRampLeft], (_x, d) => hallRampY(d), true));

  // 1д. Горизонтальная площадка перед операторской и в тамбурах «кишок» d ∈ [E2.d, E1.d]
  const exitLandingPoly = [
    [-E1.x, E1.d], [E1.x, E1.d], [E2.x, E2.d], [B3.x, B3.d], [B2.x, B2.d], [B1.x, B1.d],
    [-B1.x, B1.d], [-B2.x, B2.d], [-B3.x, B3.d], [-E2.x, E2.d],
  ];
  const exitY = hallRampY(E1.d);
  floorGeoms.push(hallPlanPoly(exitLandingPoly, () => exitY, true));

  batch.add('hall', M.hallFloor, floorGeoms, { tag: 'hallFloor' });

  // ===========================================================================
  //  2. НИЖНИЙ ПОЯС СТЕН («ЁЛОЧКА», ВЫХОДЫ, СКОСЫ ОПЕРАТОРСКОЙ) И 6 ДВЕРЕЙ
  // ===========================================================================
  const beigeWallGeoms = [];
  const lowerPanelGeoms = [];
  const doorLeafGeoms = [];
  const doorTrimGeoms = [];
  const doorHandleGeoms = [];

  for (const side of [-1, 1]) {
    for (const seg of hallSideWallSegments(side)) {
      const target = seg.kind === 'beige' ? beigeWallGeoms : lowerPanelGeoms;
      const uvScale = seg.kind === 'beige' ? beigeScale : panelScale;
      buildHallSegmentWithDoor(seg, side, uvScale, target, doorLeafGeoms, doorTrimGeoms, doorHandleGeoms);
    }
  }
  batch.add('hall', hallBeigePanel, beigeWallGeoms, { tag: 'hallWall', uv: false });
  batch.add('hall', M.wallPanel, lowerPanelGeoms, { tag: 'hallWall', uv: false });
  batch.add('hall', M.door, doorLeafGeoms);
  batch.add('hall', M.seatFrame, doorTrimGeoms);
  batch.add('hall', M.steel, doorHandleGeoms);

  // ===========================================================================
  //  3. ПОДШИВ КАРНИЗА, ФАСКА ±8,00 м И ПОТОЛОК ВЫХОДНЫХ ТАМБУРОВ (hallCanopy)
  // ===========================================================================
  const canopyGeoms = [];
  const canopySeeds = [0, secondRowD, E1.d, ...HALL_OUTER_BREAKS.filter((p) => p.d >= E1.d).map((p) => p.d)];
  const canopyD = subdivideSortedD(canopySeeds, 0.25);
  for (const s of [-1, 1]) {
    for (let i = 0; i < canopyD.length - 1; i++) {
      const dA = canopyD[i], dB = canopyD[i + 1];
      const yA = hallCanopyY(dA), yB = hallCanopyY(dB);
      const xOutA = s * hallOuterXAtD(dA), xOutB = s * hallOuterXAtD(dB);
      const xIn = s * HW;
      canopyGeoms.push(orientedHorizQuad(xIn, yA, dA, xOutA, yA, dA, xOutB, yB, dB, xIn, yB, dB, false));
    }
    // Вертикальная фаска карниза высотой 0,16 м по линии верхних серых стен X = ±8,00 м (от d = 0 до d = -18,00)
    const fasciaD = [...canopyD, backD].sort((a, b) => b - a);
    for (let i = 0; i < fasciaD.length - 1; i++) {
      const dA = fasciaD[i], dB = fasciaD[i + 1];
      if (dA - dB < 1e-5) continue;
      const yA = hallCanopyY(dA), yB = hallCanopyY(dB);
      canopyGeoms.push(orientedWallQuad(
        s * HW, dA, s * HW, dB,
        yA, yA + H.canopyFasciaH, yB, yB + H.canopyFasciaH,
        -dA, -dB, 1, [-s, 0],
      ));
    }
    // Горизонтальный потолок выходного тамбура (+3,9072 м) на d ∈ [E2.d, E1.d]
    const pocketCeilPoly = [
      [s * HW, E1.d], [s * E1.x, E1.d], [s * E2.x, E2.d], [s * B3.x, B3.d],
      [s * B2.x, B2.d], [s * B1.x, B1.d], [s * HW, B1.d],
    ];
    const pocketCeilY = hallCanopyY(E1.d);
    canopyGeoms.push(hallPlanPoly(pocketCeilPoly, () => pocketCeilY, false));
  }
  batch.add('hall', hallCanopy, canopyGeoms, { tag: 'hallCanopy' });

  // ===========================================================================
  //  4. ВЕРХНИЕ ПРОДОЛЬНЫЕ СТЕНЫ (±8,00 м), ФРОНТ ОПЕРАТОРСКОЙ (16,50 м) И ПОТОЛОК
  // ===========================================================================
  const upperWallGeoms = [];
  for (const s of [-1, 1]) {
    const botPts = [];
    const N = 48;
    for (let k = 0; k <= N; k++) {
      const d = (backD * k) / N;
      botPts.push([d, hallCanopyY(d) + H.canopyFasciaH]);
    }
    upperWallGeoms.push(sideWallPoly(s * HW, [...botPts, ...HALL_CEIL_PROFILE.slice().reverse()], -s));
  }

  // Передняя стена операторской с окном (между -8,00 и +8,00 до потолка 7,50 м + крылья ±8,00..8,25 под потолком тамбура)
  const backY = HALL_BACK_FLOOR_Y;
  const win = DIM.hallRig.booth;
  const wy0 = backY + win.windowFromY, wy1 = wy0 + win.windowH;
  const backHoles = [{ a0: -win.windowW / 2, a1: win.windowW / 2, b0: wy0, b1: wy1 }];
  upperWallGeoms.push(
    ...wallWithHoles('d', backD, -HW, HW, backY, H.ceilingY, 1, backHoles),
    rect('d', backD, -B1.x, -HW, backY, hallCanopyY(backD), 1),
    rect('d', backD, HW, B1.x, backY, hallCanopyY(backD), 1),
  );
  batch.add('hall', M.wallPanel, upperWallGeoms, { tag: 'hallWall' });

  // Остекление и внутренняя камера операторской (строго внутри контура B3..B2..B1)
  const boothBackD = E2.d;
  const boothHalfW = win.windowW / 2 + 0.5;
  batch.add('hall', M.glass, rect('d', backD - 0.02, -win.windowW / 2, win.windowW / 2, wy0, wy1, 1), { shadow: false });
  batch.add('hall', M.booth, [
    rect('d', boothBackD, -boothHalfW, boothHalfW, backY + 1.0, backY + 3.6, 1),
    rect('y', backY + 1.0, -boothHalfW, boothHalfW, boothBackD, backD, 1),
    rect('y', backY + 3.6, -boothHalfW, boothHalfW, boothBackD, backD, -1),
    rect('x', -boothHalfW, boothBackD, backD, backY + 1.0, backY + 3.6, 1),
    rect('x', boothHalfW, boothBackD, backD, backY + 1.0, backY + 3.6, -1),
  ]);
  const mull = [];
  for (let x = -win.windowW / 2; x <= win.windowW / 2 + 1e-6; x += win.windowW / 4) {
    mull.push(box(x - 0.04, x + 0.04, wy0, wy1, backD - 0.05, backD + 0.02));
  }
  mull.push(box(-win.windowW / 2, win.windowW / 2, wy0 - 0.05, wy0, backD - 0.1, backD + 0.05));
  batch.add('hall', M.seatFrame, mull);

  // Потолок зала: все секции из серых панелей M.wallPanel с метрической развёрткой вдоль ската
  const prof = HALL_CEIL_PROFILE;
  const ceilGeoms = [];
  let ceilArc = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    const segArc = Math.hypot(b[0] - a[0], b[1] - a[1]);
    ceilGeoms.push(ceilQuad(a, b, ceilArc, ceilArc + segArc, panelScale));
    ceilArc += segArc;
  }
  batch.add('hall', M.wallPanel, ceilGeoms, { tag: 'ceiling', shadow: false, uv: false });

  // --- конструкции для света в зале (мосты, ложи и прострелы на стенах ±8,00 м)
  const truss = [];
  for (const br of [DIM.hallRig.bridge1, DIM.hallRig.bridge2]) {
    trussBox(truss, -br.length / 2, br.length / 2, br.y, br.d, 0.3);
    const cy = hallCeilingY(br.d);
    for (const x of [-br.length / 2 + 0.5, 0, br.length / 2 - 0.5]) truss.push(cylBetween(P(x, br.y + 0.15, br.d), P(x, cy, br.d), 0.012, 4));
  }
  // ложи — рамы на боковых стенах
  for (const bx of Object.values(DIM.hallRig.boxes)) {
    const wx = bx.side * HW, ix = bx.side * (HW - 0.5);
    const y0 = bx.y - bx.h / 2, y1 = bx.y + bx.h / 2;
    for (const dd of [bx.d - bx.w / 2, bx.d + bx.w / 2]) {
      truss.push(box(Math.min(wx, ix), Math.max(wx, ix), y0 - 0.03, y0 + 0.03, dd - 0.03, dd + 0.03));
      truss.push(box(Math.min(wx, ix), Math.max(wx, ix), y1 - 0.03, y1 + 0.03, dd - 0.03, dd + 0.03));
      truss.push(box(ix - 0.03, ix + 0.03, y0, y1, dd - 0.03, dd + 0.03));
    }
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = y1 - 0.15 - (r * (bx.h - 0.3)) / (rows - 1);
      truss.push(cylBetween(P(ix, y, bx.d - bx.w / 2), P(ix, y, bx.d + bx.w / 2), 0.022, 5));
    }
  }
  // прострелы — вертикальные стойки у углов авансцены
  for (const t of Object.values(DIM.hallRig.sideTowers)) {
    const ix = t.side * (HW - 0.3);
    truss.push(box(ix - 0.03, ix + 0.03, t.y, t.y + t.h, t.d - 0.2, t.d - 0.16));
    truss.push(box(ix - 0.03, ix + 0.03, t.y, t.y + t.h, t.d + 0.16, t.d + 0.2));
    for (const y of [t.y, t.y + t.h]) truss.push(box(Math.min(ix, t.side * HW), Math.max(ix, t.side * HW), y - 0.03, y + 0.03, t.d - 0.2, t.d + 0.2));
  }
  batch.add('hall', M.truss, truss);
}

/** Упорядоченный по убыванию список точек d с шагом не крупнее maxStep. */
function subdivideSortedD(seeds, maxStep) {
  const uniq = [...new Set(seeds.map((v) => +v.toFixed(6)))].sort((a, b) => b - a);
  const out = [uniq[0]];
  for (let i = 0; i < uniq.length - 1; i++) {
    const a = uniq[i], b = uniq[i + 1];
    const n = Math.max(1, Math.ceil((a - b) / maxStep));
    for (let k = 1; k <= n; k++) out.push(a + ((b - a) * k) / n);
  }
  return out;
}

/** Криволинейная сетка пола переднего кармана d ∈ [-FS.depth, 0] снаружи лестницы авансцены. */
function buildCornerFloorGrid(side, dList, nU) {
  const pos = [];
  for (let i = 0; i < dList.length - 1; i++) {
    const d0 = dList[i], d1 = dList[i + 1];
    const xIn0 = side * stairBottomX(d0), xOut0 = side * hallOuterXAtD(d0);
    const xIn1 = side * stairBottomX(d1), xOut1 = side * hallOuterXAtD(d1);
    for (let j = 0; j < nU; j++) {
      const u0 = j / nU, u1 = (j + 1) / nU;
      const xa0 = xIn0 + (xOut0 - xIn0) * u0, xb0 = xIn0 + (xOut0 - xIn0) * u1;
      const xa1 = xIn1 + (xOut1 - xIn1) * u0, xb1 = xIn1 + (xOut1 - xIn1) * u1;
      const p00 = P(xa0, hallFloorY(d0, xa0), d0);
      const p10 = P(xb0, hallFloorY(d0, xb0), d0);
      const p11 = P(xb1, hallFloorY(d1, xb1), d1);
      const p01 = P(xa1, hallFloorY(d1, xa1), d1);
      pushTriWithUpNormal(pos, p00, p10, p11, true);
      pushTriWithUpNormal(pos, p00, p11, p01, true);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function pushTriWithUpNormal(out, a, b, c, faceUp) {
  const e1x = b.x - a.x, e1z = b.z - a.z;
  const e2x = c.x - a.x, e2z = c.z - a.z;
  // y-компонента (b - a) × (c - a) равна e1z * e2x - e1x * e2z
  const ny = e1z * e2x - e1x * e2z;
  const [p1, p2, p3] = (faceUp ? ny >= 0 : ny <= 0) ? [a, b, c] : [a, c, b];
  out.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
}

/** Четырёхугольник пола/карниза с принудительной ориентацией вверх (faceUp = true) или вниз (false). */
function orientedHorizQuad(x0, y0, d0, x1, y1, d1, x2, y2, d2, x3, y3, d3, faceUp) {
  const pos = [];
  const p0 = P(x0, y0, d0), p1 = P(x1, y1, d1), p2 = P(x2, y2, d2), p3 = P(x3, y3, d3);
  pushTriWithUpNormal(pos, p0, p1, p2, faceUp);
  pushTriWithUpNormal(pos, p0, p2, p3, faceUp);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Многоугольник в плане (x, d), поднятый на высоту yFn(x, d), с нормалью вверх или вниз. */
function hallPlanPoly(ptsXD, yFn, faceUp = true) {
  const shape = new THREE.Shape(ptsXD.map(([x, d]) => new THREE.Vector2(x, d)));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), d = pos.getY(i);
    pos.setXYZ(i, x, yFn(x, d), -d);
  }
  g.computeVertexNormals();
  const ny = g.attributes.normal.getY(0);
  if ((faceUp && ny < 0) || (!faceUp && ny > 0)) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t;
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Вертикальный четырёхугольник с касательными метрическими UV и гарантированной нормалью вдоль inwardXD = [ix, id]. */
function orientedWallQuad(x0, d0, x1, d1, y0a, y1a, y0b, y1b, u0, u1, uvScale, [ix, id]) {
  const p0 = P(x0, y0a, d0), p1 = P(x1, y0b, d1), p2 = P(x1, y1b, d1), p3 = P(x0, y1a, d0);
  const uv0 = [u0 / uvScale, y0a / uvScale];
  const uv1 = [u1 / uvScale, y0b / uvScale];
  const uv2 = [u1 / uvScale, y1b / uvScale];
  const uv3 = [u0 / uvScale, y1a / uvScale];

  const ab = p1.clone().sub(p0);
  const ac = p2.clone().sub(p0);
  const nrm = ab.cross(ac);
  const inVec = new THREE.Vector3(ix, 0, -id);
  const order = nrm.dot(inVec) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const pts = [p0, p1, p2, p3];
  const uvs = [uv0, uv1, uv2, uv3];

  const posArr = new Float32Array(18);
  const uvArr = new Float32Array(12);
  order.forEach((vi, k) => {
    posArr[k * 3] = pts[vi].x;
    posArr[k * 3 + 1] = pts[vi].y;
    posArr[k * 3 + 2] = pts[vi].z;
    uvArr[k * 2] = uvs[vi][0];
    uvArr[k * 2 + 1] = uvs[vi][1];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  g.computeVertexNormals();
  return g;
}

/** Построить сегмент нижней стены зала вместе с проёмом двери, коробкой, створками и ручками. */
function buildHallSegmentWithDoor(seg, side, uvScale, wallOut, leafOut, trimOut, handleOut) {
  const dx = seg.x1 - seg.x0, dd = seg.d1 - seg.d0;
  const L = Math.hypot(dx, dd);
  const tx = dx / L, td = dd / L;
  // Единичная нормаль внутрь зала/тамбура в координатах (x, d)
  const ix = (side * dd) / L, id = (-side * dx) / L;

  const emitWallSpan = (uA, uB, yBotOverride = null) => {
    if (uB - uA < 1e-4) return;
    const steps = Math.max(1, Math.ceil((uB - uA) / 0.25));
    for (let k = 0; k < steps; k++) {
      const ua = uA + ((uB - uA) * k) / steps;
      const ub = uA + ((uB - uA) * (k + 1)) / steps;
      const xa = seg.x0 + tx * ua, da = seg.d0 + td * ua;
      const xb = seg.x0 + tx * ub, db = seg.d0 + td * ub;
      const y0a = yBotOverride !== null ? yBotOverride : hallFloorY(da, xa);
      const y0b = yBotOverride !== null ? yBotOverride : hallFloorY(db, xb);
      const y1a = hallCanopyY(da);
      const y1b = hallCanopyY(db);
      if (Math.max(y1a - y0a, y1b - y0b) < 1e-4) continue;
      wallOut.push(orientedWallQuad(xa, da, xb, db, y0a, y1a, y0b, y1b, ua, ub, uvScale, [ix, id]));
    }
  };

  if (!seg.door) {
    emitWallSpan(0, L);
    return;
  }

  const { width, height, leaves, sillY } = seg.door;
  const u0 = Math.max(0, (L - width) * 0.5);
  const u1 = Math.min(L, (L + width) * 0.5);
  const doorTop = sillY + height;

  emitWallSpan(0, u0);
  emitWallSpan(u1, L);
  emitWallSpan(u0, u1, doorTop);

  // Откосы проёма и тонкий наличник коробки (M.seatFrame)
  const atUD = (u, nOff) => [seg.x0 + tx * u + ix * nOff, seg.d0 + td * u + id * nOff];
  const [jx0a, jd0a] = atUD(u0, HALL_DOOR_TRIM_OUT);
  const [jx0b, jd0b] = atUD(u0, -HALL_DOOR_RECESS);
  const [jx1a, jd1a] = atUD(u1, HALL_DOOR_TRIM_OUT);
  const [jx1b, jd1b] = atUD(u1, -HALL_DOOR_RECESS);
  trimOut.push(
    orientedWallQuad(jx0a, jd0a, jx0b, jd0b, sillY, doorTop, sillY, doorTop, 0, HALL_DOOR_RECESS, 1, [tx, td]),
    orientedWallQuad(jx1a, jd1a, jx1b, jd1b, sillY, doorTop, sillY, doorTop, 0, HALL_DOOR_RECESS, 1, [-tx, -td]),
    orientedHorizQuad(jx0a, doorTop, jd0a, jx1a, doorTop, jd1a, jx1b, doorTop, jd1b, jx0b, doorTop, jd0b, false),
  );
  // Лицевая планка коробки сверху (и по бокам, если вокруг двери остаётся простенок)
  const trimU0 = Math.max(0, u0 - HALL_DOOR_TRIM_W);
  const trimU1 = Math.min(L, u1 + HALL_DOOR_TRIM_W);
  const [tx0, td0] = atUD(trimU0, HALL_DOOR_TRIM_OUT);
  const [tx1, td1] = atUD(trimU1, HALL_DOOR_TRIM_OUT);
  trimOut.push(orientedWallQuad(tx0, td0, tx1, td1, doorTop, doorTop + HALL_DOOR_TRIM_W, doorTop, doorTop + HALL_DOOR_TRIM_W, trimU0, trimU1, 1, [ix, id]));
  if (u0 - trimU0 > 0.01) {
    const [la, lda] = atUD(trimU0, HALL_DOOR_TRIM_OUT);
    const [lb, ldb] = atUD(u0, HALL_DOOR_TRIM_OUT);
    trimOut.push(orientedWallQuad(la, lda, lb, ldb, sillY, doorTop, sillY, doorTop, trimU0, u0, 1, [ix, id]));
  }
  if (trimU1 - u1 > 0.01) {
    const [ra, rda] = atUD(u1, HALL_DOOR_TRIM_OUT);
    const [rb, rdb] = atUD(trimU1, HALL_DOOR_TRIM_OUT);
    trimOut.push(orientedWallQuad(ra, rda, rb, rdb, sillY, doorTop, sillY, doorTop, u1, trimU1, 1, [ix, id]));
  }

  // Створки двери (в нише -HALL_DOOR_RECESS) и вертикальные стальные ручки
  const halfSeam = HALL_DOOR_SEAM * 0.5;
  if (leaves === 2) {
    const uMid = (u0 + u1) * 0.5;
    for (const [la, lb] of [[u0 + halfSeam, uMid - halfSeam], [uMid + halfSeam, u1 - halfSeam]]) {
      const [paX, paD] = atUD(la, -HALL_DOOR_RECESS);
      const [pbX, pbD] = atUD(lb, -HALL_DOOR_RECESS);
      leafOut.push(orientedWallQuad(paX, paD, pbX, pbD, sillY, doorTop, sillY, doorTop, la, lb, 1, [ix, id]));
    }
    for (const hu of [uMid - HALL_HANDLE_OFFSET, uMid + HALL_HANDLE_OFFSET]) {
      const [hx, hd] = atUD(hu, -HALL_DOOR_RECESS + HALL_HANDLE_OUT);
      handleOut.push(cylBetween(P(hx, sillY + HALL_HANDLE_Y0, hd), P(hx, sillY + HALL_HANDLE_Y1, hd), HALL_HANDLE_R, 6));
    }
  } else {
    const [paX, paD] = atUD(u0 + halfSeam, -HALL_DOOR_RECESS);
    const [pbX, pbD] = atUD(u1 - halfSeam, -HALL_DOOR_RECESS);
    leafOut.push(orientedWallQuad(paX, paD, pbX, pbD, sillY, doorTop, sillY, doorTop, u0, u1, 1, [ix, id]));
    const [hx, hd] = atUD(u1 - HALL_HANDLE_OFFSET * 1.4, -HALL_DOOR_RECESS + HALL_HANDLE_OUT);
    handleOut.push(cylBetween(P(hx, sillY + HALL_HANDLE_Y0, hd), P(hx, sillY + HALL_HANDLE_Y1, hd), HALL_HANDLE_R, 6));
  }
}

function sideWallPoly(x, pts, facing) {
  // pts: [[d,y]...] — многоугольник в плоскости стены
  const shape = new THREE.Shape(pts.map(([d, y]) => new THREE.Vector2(d, y)));
  const g = new THREE.ShapeGeometry(shape);
  // ShapeGeometry в XY: (d, y, 0) → нужно (x, y, −d) с нормалью facing·X
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const d = pos.getX(i), y = pos.getY(i);
    pos.setXYZ(i, x, y, -d);
  }
  g.computeVertexNormals();
  // проверяем, куда смотрит нормаль
  const nx = g.attributes.normal.getX(0);
  if (Math.sign(nx) !== Math.sign(facing)) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

function ceilQuad([d0, y0], [d1, y1], vArc0, vArc1, uvScale = WALL_PANEL_UV_DEFAULT) {
  // Так как d0 > d1 (-d0 < -d1), обход (A, B, C) и (A, C, D) сразу даёт нормаль вниз (-Y)
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -HW, y0, -d0, HW, y0, -d0, HW, y1, -d1,
    -HW, y0, -d0, HW, y1, -d1, -HW, y1, -d1,
  ]);
  const u0 = -HW / uvScale, u1 = HW / uvScale;
  const sv0 = vArc0 / uvScale, sv1 = vArc1 / uvScale;
  const uv = new Float32Array([
    u0, sv0, u1, sv0, u1, sv1,
    u0, sv0, u1, sv1, u0, sv1,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) > 0) {
    const a = g.attributes.position.array;
    const tUv = g.attributes.uv.array;
    for (let i = 0; i < 6; i += 3) {
      for (let k = 0; k < 3; k++) {
        const tmp = a[(i + 1) * 3 + k]; a[(i + 1) * 3 + k] = a[(i + 2) * 3 + k]; a[(i + 2) * 3 + k] = tmp;
      }
      for (let k = 0; k < 2; k++) {
        const tmp = tUv[(i + 1) * 2 + k]; tUv[(i + 1) * 2 + k] = tUv[(i + 2) * 2 + k]; tUv[(i + 2) * 2 + k] = tmp;
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

function trussBox(out, x0, x1, y, d, s) {
  const h = s / 2;
  const chords = [[-h, -h], [-h, h], [h, -h], [h, h]];
  for (const [dy, dd] of chords) out.push(cylBetween(P(x0, y + dy, d + dd), P(x1, y + dy, d + dd), 0.025, 5));
  const n = Math.round((x1 - x0) / s);
  for (let i = 0; i < n; i++) {
    const a = x0 + (i * (x1 - x0)) / n, b = x0 + ((i + 1) * (x1 - x0)) / n;
    out.push(cylBetween(P(a, y - h, d - h), P(b, y + h, d - h), 0.01, 3));
    out.push(cylBetween(P(a, y - h, d + h), P(b, y + h, d + h), 0.01, 3));
    out.push(cylBetween(P(a, y - h, d - h), P(b, y - h, d + h), 0.01, 3));
  }
}

/**
 * Кресла: два InstancedMesh (обивка + каркас) — 390 мест за 2 вызова отрисовки.
 * Кресло: сиденье, спинка со скруглённым верхом (наклон назад), боковина с подлокотником.
 * Боковина общая для соседних кресел; спинки и сиденья разделены зазорами, чтобы ряд читался креслами.
 * Невидимые грани (низ сиденья, низ боковины) не строятся — ~54 треугольника на кресло.
 */
export function buildSeats(M) {
  const H = DIM.hall;
  const SW = H.seatWidth; // шаг кресел
  const fabric = [], frame = [];
  // одно кресло в локальных координатах (смотрит на сцену = в −Z, спинка — в +Z)
  // сиденье: без нижней и задней граней (сзади его закрывает спинка)
  fabric.push(cuboid(-SW / 2 + 0.045, SW / 2 - 0.045, 0.4, 0.48, -0.27, 0.15, ['-y', '+z']));
  // спинка: контур со скруглёнными верхними углами, толщина 8 см, наклон назад ~10°
  const bw = SW / 2 - 0.04, bh = 0.6;
  const outline = [[-bw, 0], [bw, 0], [bw, 0.48], [bw - 0.025, 0.565], [bw - 0.09, bh], [-bw + 0.09, bh], [-bw + 0.025, 0.565], [-bw, 0.48]];
  const back = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.08, bevelEnabled: false });
  back.translate(0, 0, -0.04).rotateX(0.17).translate(0, 0.4, 0.19);
  fabric.push(back);
  // боковина (на левой границе места) и подлокотник поверх неё
  const sx = -SW / 2;
  frame.push(cuboid(sx - 0.025, sx + 0.025, 0, 0.62, -0.2, 0.22, ['-y', '+y']));
  frame.push(cuboid(sx - 0.03, sx + 0.03, 0.62, 0.67, -0.3, 0.16, ['-y']));
  const gF = mergeAll(fabric), gK = mergeAll(frame);
  const n = H.rows * H.seatsPerRow;
  const iF = new THREE.InstancedMesh(gF, M.seatFabric, n);
  const iK = new THREE.InstancedMesh(gK, M.seatFrame, n + H.rows); // + замыкающая боковина в конце каждого ряда
  const m = new THREE.Matrix4();
  let k = 0, e = n;
  for (let r = 0; r < H.rows; r++) {
    const y = -FSH + r * H.rowPitch * RAKE;
    const d = rowFrontD(r) - 0.42;
    for (let s = 0; s < H.seatsPerRow; s++) {
      const x = (s - (H.seatsPerRow - 1) / 2) * SW;
      m.makeTranslation(x, y, -d);
      iF.setMatrixAt(k, m);
      iK.setMatrixAt(k, m);
      k++;
    }
    m.makeTranslation(((H.seatsPerRow + 1) / 2) * SW, y, -d);
    iK.setMatrixAt(e++, m);
  }
  for (const im of [iF, iK]) { im.castShadow = true; im.receiveShadow = true; im.userData.layer = 'hall'; im.userData.seats = true; im.computeBoundingSphere(); }
  iF.name = 'seatsFabric';
  iK.name = 'seatsFrame';
  return [iF, iK];
}

/** Параллелепипед (локальные x, y, z) без лишних граней: skip — список из '+x','-x','+y','-y','+z','-z'. */
function cuboid(x0, x1, y0, y1, z0, z1, skip = []) {
  const pos = [], nor = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const faces = {
    '+x': [V(1, 0, 0), [V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)]],
    '-x': [V(-1, 0, 0), [V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1)]],
    '+y': [V(0, 1, 0), [V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)]],
    '-y': [V(0, -1, 0), [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)]],
    '+z': [V(0, 0, 1), [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)]],
    '-z': [V(0, 0, -1), [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)]],
  };
  for (const [key, [nrm, q]] of Object.entries(faces)) {
    if (skip.includes(key)) continue;
    // порядок обхода — против часовой стрелки, если смотреть снаружи
    const c = q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));
    const [a, b, cc, d] = c.dot(nrm) > 0 ? q : [q[0], q[3], q[2], q[1]];
    for (const p of [a, b, cc, a, cc, d]) { pos.push(p.x, p.y, p.z); nor.push(nrm.x, nrm.y, nrm.z); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of out) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of out) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Геометрия «декоративных» источников: лампы дежурки, LED-линейки, синие приборы, светильники зала. */
export function buildEmitters(M, dutyRows) {
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';
  const cord = [];
  const bulbs = [];
  const xs = [-5.25, -1.75, 1.75, 5.25];
  const dutyPoints = [];
  for (const row of dutyRows) {
    for (const x of xs) {
      const yb = CEIL - DIM.duty.dropFromCeiling;
      cord.push(cylBetween(P(x, CEIL, row.d), P(x, yb + 0.2, row.d), 0.008, 4));
      cord.push(new THREE.CylinderGeometry(0.06, 0.04, 0.08, 10).translate(x, yb + 0.22, -row.d)); // патрон
      const bulb = new THREE.SphereGeometry(0.07, 14, 10);
      bulb.scale(1, 1.35, 1);
      bulb.translate(x, yb + 0.09, -row.d);
      bulbs.push(bulb);
      dutyPoints.push(P(x, yb + 0.09, row.d));
    }
  }
  const cordMesh = new THREE.Mesh(mergeAll(cord), M.pipe);
  const bulbMesh = new THREE.Mesh(mergeAll(bulbs), M.dutyBulb);
  bulbMesh.userData.emitter = 'duty';
  groups.duty.add(cordMesh, bulbMesh);
  // LED-линейки под верхними галереями
  const leds = [
    box(LX1 - 0.04, LX1 + 0.02, UPY - 0.25, UPY - 0.22, 1.8, 7.8),
    box(GX - 0.02, GX + 0.04, UPY - 0.25, UPY - 0.22, 1.8, 7.8),
    box(-6, 6, UPY - 0.25, UPY - 0.22, GB - 0.02, GB + 0.04),
  ];
  const ledMesh = new THREE.Mesh(mergeAll(leds), M.ledStrip);
  ledMesh.userData.emitter = 'duty';
  groups.duty.add(ledMesh);
  // синие приборы под нижней галереей
  const blueX = [-6.6, -2.4, 1.2];
  const blueBodies = [], blueLens = [];
  for (const x of blueX) {
    blueBodies.push(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12).translate(x, LOWY - 0.6, -(BACK - 0.35)));
    blueLens.push(new THREE.CircleGeometry(0.075, 14).rotateX(Math.PI / 2).translate(x, LOWY - 0.665, -(BACK - 0.35)));
  }
  const bb = new THREE.Mesh(mergeAll(blueBodies), M.fixtureBody);
  const bl = new THREE.Mesh(mergeAll(blueLens), M.blueLed);
  bl.userData.emitter = 'duty';
  groups.duty.add(bb, bl);
  // светильники в потолке зала
  const lamps = [];
  const housePoints = [];
  for (let d = -7.5; d > -17.5; d -= 2.4) {
    for (let x = -7.2; x <= 7.21; x += 2.4) {
      const y = hallCeilingY(d) - 0.01;
      lamps.push(new THREE.CircleGeometry(0.1, 14).rotateX(Math.PI / 2).translate(x, y, -d));
      housePoints.push(P(x, y, d));
    }
  }
  const hl = new THREE.Mesh(mergeAll(lamps), M.houseLamp);
  hl.userData.emitter = 'house';
  groups.house.add(hl);

  // 8 вертикальных светодиодных полос во внутренних углах «ёлочки» (включаются кнопкой «Зал»)
  const { hallLedStrip } = getHallMaterials(M);
  const hallLeds = [];
  const ledHalfW = DIM.hall.ledStripW * 0.5;
  const ledDepth = DIM.hall.ledStripD;
  for (const side of [-1, 1]) {
    for (const c of hallLedCorners(side)) {
      const c0 = [c.x - c.nd * ledHalfW, c.d + c.nx * ledHalfW];
      const c1 = [c.x + c.nd * ledHalfW, c.d - c.nx * ledHalfW];
      const c2 = [c1[0] + c.nx * ledDepth, c1[1] + c.nd * ledDepth];
      const c3 = [c0[0] + c.nx * ledDepth, c0[1] + c.nd * ledDepth];
      hallLeds.push(prism([c0, c1, c2, c3], c.y0, c.y1));
    }
  }
  const hallLedMesh = new THREE.Mesh(mergeAll(hallLeds), hallLedStrip);
  hallLedMesh.name = 'hallLedStrips';
  hallLedMesh.userData.emitter = 'house';
  groups.house.add(hallLedMesh);

  for (const g of Object.values(groups)) g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { groups, dutyPoints, housePoints, blueX: blueX.map((x) => P(x, LOWY - 0.66, BACK - 0.35)) };
}
