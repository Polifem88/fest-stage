// Архитектура: сценическая коробка, портал, авансцена, галереи, узел подъёма,
// приямок с решёткой, ригель, зрительный зал, конструкции для света в зале.
import * as THREE from 'three';
import { DIM, BOX_HALF, HALL_HALF, GALLERY_INNER_X, BACK_GALLERY_FRONT_D, RAKE, rowFrontD } from '../config/dimensions.js';
import { box, rect, wallWithHoles, cylBetween, P, prism } from '../../../core/geom.js';

const W = BOX_HALF; // 8.5
const HW = HALL_HALF; // 9
const CEIL = DIM.box.ceiling;
const BACK = DIM.box.backWallD; // 9.2
const PT = DIM.portal.thickness;
const PW2 = DIM.portal.width / 2;
const GW = DIM.galleries.width;
const GX = GALLERY_INNER_X; // 7.6
const GB = BACK_GALLERY_FRONT_D; // 8.3
const UPY = DIM.galleries.upperY;
const FRY = DIM.galleries.frontY;
const LOWY = DIM.galleries.lowerY;
const GATEY = DIM.galleries.overGateY;
const pad = DIM.liftNode;
const PAD_X0 = W - pad.padSize; // 6.5
const PAD_D0 = BACK - pad.padSize; // 7.2
const pit = DIM.pit;
const rack = DIM.rack;
const gate = DIM.openings.gate;
const GATE_X0 = gate.centerX - gate.width / 2;
const GATE_X1 = gate.centerX + gate.width / 2;
const bdoor = DIM.openings.backDoor;
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
export const HALL_BACK_FLOOR_Y = -FSH + (DIM.hall.rows - 1) * DIM.hall.rowPitch * RAKE;

/** Перила вдоль отрезка (x,d)→(x,d) на высоте пола y. gaps: [[t0,t1]] в долях длины. k — множитель сечения труб. */
function railing(out, x0, d0, x1, d1, y, { h = DIM.galleries.railH, postStep = 1.5, gaps = [], toe = true, k = 1 } = {}) {
  const len = Math.hypot(x1 - x0, d1 - d0);
  const segs = [];
  let t = 0;
  for (const [g0, g1] of gaps.sort((a, b) => a[0] - b[0])) { if (g0 > t) segs.push([t, g0]); t = g1; }
  if (t < 1) segs.push([t, 1]);
  const at = (s, yy) => P(x0 + (x1 - x0) * s, yy, d0 + (d1 - d0) * s);
  for (const [s0, s1] of segs) {
    out.push(cylBetween(at(s0, y + h), at(s1, y + h), 0.021 * k));
    out.push(cylBetween(at(s0, y + h * 0.5), at(s1, y + h * 0.5), 0.016 * k));
    if (toe) out.push(cylBetween(at(s0, y + 0.05), at(s1, y + 0.05), 0.012 * k, 4));
    const n = Math.max(1, Math.round(((s1 - s0) * len) / postStep));
    for (let i = 0; i <= n; i++) out.push(cylBetween(at(s0 + ((s1 - s0) * i) / n, y), at(s0 + ((s1 - s0) * i) / n, y + h), 0.02 * k, 5));
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

/** Лестничный марш из ступеней-блоков вдоль оси. */
function stairBlocks(out, { x0, x1, d0, d1, yFrom, yTo, steps, axis = 'x' }) {
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const top = yFrom + (yTo - yFrom) * t1;
    if (axis === 'x') out.push(box(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, top - 0.05, top, d0, d1));
    else out.push(box(x0, x1, top - 0.05, top, d0 + (d1 - d0) * t0, d0 + (d1 - d0) * t1));
  }
}

export function buildArchitecture(batch, M) {
  // ===========================================================================
  //  ПЛАНШЕТ (с вырезом под приямок)
  // ===========================================================================
  const floorPts = [
    [-W, 0], [W, 0], [W, pit.fromD], [GX, pit.fromD],
    [GX, pit.toD], [W, pit.toD], [W, BACK], [-W, BACK],
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
  // фронт и боковины (тёмные)
  batch.add('walls', M.stageEdge, prism(fsPts, -FSH, -0.02));

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
      batch.add('walls', M.stageEdge, prism(pts, -FSH, yTop));
    }
  }

  // ===========================================================================
  //  ПОРТАЛ
  // ===========================================================================
  const portalHole = [{ a0: -PW2, a1: PW2, b0: -1, b1: DIM.portal.height }];
  // сторона зала
  batch.add('walls', M.portal, wallWithHoles('d', 0, -HW, HW, -FSH, DIM.decoCeilingY, -1, portalHole));
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
  batch.add('walls', M.door, rect('x', W + 0.08, sdoor.fromD, sdoor.fromD + sdoor.width, -pit.depth, -pit.depth + sdoor.height, -1));
  batch.add('walls', M.blackWall, [
    rect('d', sdoor.fromD, W, W + 0.08, -pit.depth, -pit.depth + sdoor.height, 1),
    rect('d', sdoor.fromD + sdoor.width, W, W + 0.08, -pit.depth, -pit.depth + sdoor.height, -1),
    rect('y', -pit.depth + sdoor.height, W, W + 0.08, sdoor.fromD, sdoor.fromD + sdoor.width, -1),
  ]);
  // задняя стена: ворота и дверь. Под нижней галереей (до её настила: 2.2, над воротами — 2.9)
  // кирпич закрашен матовым чёрным, выше — обычная кладка.
  const backHoles = [
    { a0: GATE_X0, a1: GATE_X1, b0: -0.01, b1: gate.height },
    { a0: bdoor.centerX - bdoor.width / 2, a1: bdoor.centerX + bdoor.width / 2, b0: -0.01, b1: bdoor.height },
  ];
  const LOW_X0 = GATE_X0 - 0.6, LOW_X1 = GATE_X1; // участок нижней галереи на 2.9 (см. ниже UP_X0/UP_X1)
  const lowBands = [[-W, LOW_X0, LOWY], [LOW_X0, LOW_X1, GATEY], [LOW_X1, W, LOWY]];
  const brickHoles = [...backHoles, ...lowBands.map(([a0, a1, h]) => ({ a0, a1, b0: -0.01, b1: h }))];
  batch.add('walls', M.brickBack, wallWithHoles('d', BACK, -W, W, 0, CEIL, -1, brickHoles), { tag: 'wallB' });
  for (const [a0, a1, h] of lowBands) {
    const holes = backHoles.filter((h) => h.a1 > a0 && h.a0 < a1); // wallWithHoles не отсекает проёмы вне [a0, a1]
    batch.add('walls', M.brickBlack, wallWithHoles('d', BACK, a0, a1, 0, h, -1, holes), { tag: 'wallB' });
  }
  // створки ворот (закрыты) и дверь — в глубине проёма
  batch.add('walls', M.gate, [
    rect('d', BACK + 0.2, GATE_X0, gate.centerX - 0.01, 0, gate.height, -1),
    rect('d', BACK + 0.22, gate.centerX + 0.01, GATE_X1, 0, gate.height, -1),
  ]);
  batch.add('walls', M.door, rect('d', BACK + 0.12, bdoor.centerX - bdoor.width / 2, bdoor.centerX + bdoor.width / 2, 0, bdoor.height, -1));
  // откосы проёмов
  for (const [x0, x1, h, dd] of [[GATE_X0, GATE_X1, gate.height, 0.25], [bdoor.centerX - bdoor.width / 2, bdoor.centerX + bdoor.width / 2, bdoor.height, 0.15]]) {
    batch.add('walls', M.blackWall, [
      rect('x', x0, BACK, BACK + dd, 0, h, 1),
      rect('x', x1, BACK, BACK + dd, 0, h, -1),
      rect('y', h, x0, x1, BACK, BACK + dd, -1),
    ]);
  }
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
  //  ПРИЯМОК У ПРАВОЙ ДВЕРИ (0.9 × 3 м, глубина 1 м) и лестница вниз
  // ===========================================================================
  batch.add('walls', M.blackWall, [
    rect('x', GX, pit.fromD, pit.toD, -pit.depth, 0, 1),
    rect('d', pit.fromD, GX, W, -pit.depth, 0, 1),
    rect('d', pit.toD, GX, W, -pit.depth, 0, -1),
  ]);
  const tread = 0.3;
  const stepsStartD = pit.toD - (pit.steps - 1) * tread;
  batch.add('walls', M.stageEdge, rect('y', -pit.depth, GX, W, pit.fromD, stepsStartD, 1));
  const steps = [];
  for (let i = 0; i < pit.steps - 1; i++) {
    const yTop = -(i + 1) * (pit.depth / pit.steps);
    steps.push(box(GX, W, -pit.depth, yTop, pit.toD - (i + 1) * tread, pit.toD - i * tread));
  }
  batch.add('walls', M.stageEdge, steps);

  // ===========================================================================
  //  ВЕРХНЯЯ ГАЛЕРЕЯ (5.7 по бокам и сзади, 6.2 спереди над порталом)
  // ===========================================================================
  const deck = [];
  const steel = [];
  const FRONT_D1 = DIM.galleries.frontToD; // 0.8
  const STAIR_LEN = 0.8;
  // боковые и задняя
  deck.push(box(-W, -GX, UPY - 0.06, UPY, FRONT_D1, BACK));
  deck.push(box(GX, W, UPY - 0.06, UPY, FRONT_D1, BACK));
  deck.push(box(-GX, GX, UPY - 0.06, UPY, GB, BACK));
  // передняя над порталом
  deck.push(box(-W, W, FRY - 0.06, FRY, DIM.galleries.frontFromD, FRONT_D1));
  // кромочные балки
  steel.push(box(-GX - 0.02, -GX + 0.02, UPY - 0.22, UPY - 0.06, FRONT_D1, GB));
  steel.push(box(GX - 0.02, GX + 0.02, UPY - 0.22, UPY - 0.06, FRONT_D1, GB));
  steel.push(box(-GX, GX, UPY - 0.22, UPY - 0.06, GB - 0.02, GB + 0.02));
  steel.push(box(-W, W, FRY - 0.22, FRY - 0.06, FRONT_D1 - 0.02, FRONT_D1 + 0.02));
  // лесенки 6.2 → 5.7 в передних углах (по боковой галерее)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W : GX, x1 = s < 0 ? -GX : W;
    stairBlocks(steel, { x0, x1, d0: FRONT_D1, d1: FRONT_D1 + STAIR_LEN, yFrom: FRY, yTo: UPY, steps: 3, axis: 'd' });
  }
  // перила
  railing(steel, -GX, FRONT_D1 + STAIR_LEN, -GX, GB, UPY);
  // правая: проём над вертикальной лестницей узла подъёма не нужен (лестница у задней галереи)
  railing(steel, GX, FRONT_D1 + STAIR_LEN, GX, GB, UPY);
  const vlD = 8.0; // ось вертикальной лестницы (середина края площадки со стороны ворот, сдвинута к галерее)
  const vlX = PAD_X0 - 0.05;
  railing(steel, -GX, GB, GX, GB, UPY, { gaps: [[((vlX - 0.35) + GX) / (2 * GX), ((vlX + 0.35) + GX) / (2 * GX)]] });
  railing(steel, -GX, FRONT_D1, GX, FRONT_D1, FRY); // со стороны сцены
  railing(steel, -W, DIM.galleries.frontFromD, W, DIM.galleries.frontFromD, FRY); // со стороны зала
  railing(steel, -GX, FRONT_D1, -GX, FRONT_D1 + STAIR_LEN, UPY, { h: 1.2, postStep: 0.8 });
  railing(steel, GX, FRONT_D1, GX, FRONT_D1 + STAIR_LEN, UPY, { h: 1.2, postStep: 0.8 });
  // кронштейны под боковыми галереями (каждые ~2 м)
  for (let d = 1.2; d < BACK - 0.5; d += 2.0) {
    for (const s of [-1, 1]) steel.push(cylBetween(P(s * W, UPY - 1.0, d), P(s * GX, UPY - 0.15, d), 0.025, 4));
  }

  // ===========================================================================
  //  НИЖНЯЯ ГАЛЕРЕЯ (задняя стена, 2.2; над воротами — 2.9)
  // ===========================================================================
  const UP_X0 = GATE_X0 - 0.6, UP_X1 = GATE_X1; // участок 2.9
  deck.push(box(-W, UP_X0, LOWY - 0.06, LOWY, GB, BACK));
  deck.push(box(UP_X0 + 0.6, UP_X1, GATEY - 0.06, GATEY, GB, BACK));
  stairBlocks(steel, { x0: UP_X0, x1: UP_X0 + 0.6, d0: GB, d1: BACK, yFrom: LOWY, yTo: GATEY, steps: 3, axis: 'x' });
  stairBlocks(steel, { x0: UP_X1, x1: PAD_X0, d0: GB, d1: BACK, yFrom: GATEY, yTo: LOWY, steps: 3, axis: 'x' });
  // серая обшивка-кромка (как на фото)
  const fascia = [
    box(-W, UP_X0, LOWY - 0.35, LOWY + 0.12, GB - 0.03, GB),
    box(UP_X0 + 0.6, UP_X1, GATEY - 0.35, GATEY + 0.12, GB - 0.03, GB),
  ];
  batch.add('galleries', M.fascia, fascia);
  railing(steel, -W, GB, UP_X0, GB, LOWY);
  railing(steel, UP_X0 + 0.6, GB, UP_X1, GB, GATEY);
  // подвесы нижней галереи к верхней
  for (let x = -7.5; x < PAD_X0; x += 2.5) steel.push(cylBetween(P(x, x > UP_X0 ? GATEY : LOWY, GB + 0.03), P(x, UPY - 0.06, GB + 0.03), 0.022, 5));
  // труба под нижней галереей с синими приборами дежурки
  steel.push(cylBetween(P(-W, LOWY - 0.45, BACK - 0.35), P(UP_X0, LOWY - 0.45, BACK - 0.35), 0.024, 6));

  // ===========================================================================
  //  УЗЕЛ ПОДЪЁМА (задний правый угол)
  // ===========================================================================
  // трубы ограждения и лестниц узла — в 1.5 раза толще галерейных (на фото узел заметно массивнее)
  const LIFT_K = 1.5;
  deck.push(box(PAD_X0, W, pad.padY - 0.08, pad.padY, PAD_D0, BACK));
  railing(steel, PAD_X0, PAD_D0, W, PAD_D0, pad.padY, { gaps: [[0.72, 1]], k: LIFT_K }); // проход с технической лестницы у стены
  railing(steel, PAD_X0, PAD_D0, PAD_X0, GB, pad.padY, { gaps: [[0.55, 1]], k: LIFT_K }); // проход к вертикальной лестнице
  // стойки площадки
  steel.push(box(PAD_X0 - 0.03, PAD_X0 + 0.03, 0, pad.padY - 0.08, PAD_D0 - 0.03, PAD_D0 + 0.03));
  steel.push(box(W - 0.06, W, 0, pad.padY - 0.08, PAD_D0 - 0.03, PAD_D0 + 0.03));
  // техническая (приставная) лестница к правой стене перед площадкой — лезут лицом к стене
  const slD = PAD_D0 - 0.05 - pad.sideLadder.width / 2;
  ladder(steel, W - 0.12, slD, 0, pad.padY + 1.0, pad.sideLadder.width, 'd', LIFT_K);
  // вертикальная лестница без ограждения: с площадки на заднюю верхнюю галерею, лицом к сцене
  ladder(steel, vlX, vlD, pad.padY, UPY + 1.0, pad.vertLadder.width, 'd', LIFT_K);

  // ===========================================================================
  //  РЕШЁТКА НАД ПРИЯМКОМ (правая стена): 0.9 × 5.7 × 3 м, «этажи» 2.1 и 4.5
  // ===========================================================================
  for (let d = rack.fromD; d <= rack.toD + 1e-6; d += rack.postStep) {
    if (Math.abs(d - rack.ladderD) < 0.1) continue; // здесь стойку заменяет лестница
    steel.push(box(GX - 0.03, GX + 0.03, -pit.depth, rack.height, d - 0.03, d + 0.03));
    for (const ly of rack.levels) steel.push(box(GX, W, ly - 0.03, ly + 0.03, d - 0.025, d + 0.025));
  }
  for (const ly of rack.levels) steel.push(box(GX - 0.03, GX + 0.03, ly - 0.03, ly + 0.03, rack.fromD, rack.toD));
  ladder(steel, GX + 0.02, rack.ladderD, 0, rack.height, 0.44, 'd');
  for (const ly of rack.levels) for (const dd of [rack.ladderD - 0.22, rack.ladderD + 0.22]) steel.push(box(GX, W, ly - 0.025, ly + 0.025, dd - 0.02, dd + 0.02));

  batch.add('galleries', M.steel, deck);
  batch.add('galleries', M.steel, steel);

  // ===========================================================================
  //  ЗРИТЕЛЬНЫЙ ЗАЛ
  // ===========================================================================
  buildHall(batch, M);
}

function buildHall(batch, M) {
  const H = DIM.hall;
  const backD = -H.portalToBoothWall;
  const fy = -FSH;
  // пол перед рядами (вокруг авансцены)
  batch.add('hall', M.hallFloor, rect('y', fy, -HW, HW, rowFrontD(0), 0, 1), { tag: 'hallFloor' });
  // ряды на подступенках
  const risers = [];
  for (let i = 0; i < H.rows; i++) {
    const y = fy + i * H.rowPitch * RAKE;
    const d0 = rowFrontD(i), d1 = i === H.rows - 1 ? backD : rowFrontD(i) - H.rowPitch;
    if (i === 0) risers.push(rect('y', fy + 0.001, -HW, HW, d1, d0, 1));
    else risers.push(box(-HW, HW, fy - 0.01, y, d1, d0));
  }
  // задний проход
  batch.add('hall', M.hallFloor, risers, { tag: 'hallFloor' });

  // стены зала: профиль (d,y) — пол внизу, потолок вверху
  const backY = HALL_BACK_FLOOR_Y;
  const wallShape = (yTopFn) => {
    const pts = [];
    pts.push([0, fy], [backD, fy]);
    const prof = [...HALL_CEIL_PROFILE].reverse();
    for (const [d, y] of prof) pts.push([d, yTopFn ? yTopFn(d, y) : y]);
    return pts;
  };
  const woodTop = (d) => {
    const i = Math.max(0, Math.min(H.rows - 1, Math.floor((rowFrontD(0) - d) / H.rowPitch)));
    return fy + (d < rowFrontD(0) ? i * H.rowPitch * RAKE : 0) + 2.6;
  };
  for (const s of [-1, 1]) {
    // нижняя полоса — дерево (верх идёт по ступеням), верх — акустические панели
    const woodPts = [];
    const N = 40;
    for (let k = 0; k <= N; k++) { const d = (backD * k) / N; woodPts.push([d, woodTop(d)]); }
    const woodPoly = [[0, fy], ...woodPts, [backD, fy]];
    batch.add('hall', M.hallWood, sideWallPoly(s * HW, woodPoly, -s));
    batch.add('hall', M.hallAcoustic, sideWallPoly(s * HW, [...woodPts, ...HALL_CEIL_PROFILE.slice().reverse()], -s));
  }
  // задняя стена с окном операторской
  const win = DIM.hallRig.booth;
  const wy0 = backY + win.windowFromY, wy1 = wy0 + win.windowH;
  const backHoles = [{ a0: -win.windowW / 2, a1: win.windowW / 2, b0: wy0, b1: wy1 }];
  batch.add('hall', M.hallAcoustic, wallWithHoles('d', backD, -HW, HW, backY, DIM.hall.ceilingY, 1, backHoles));
  // двери в задних углах
  batch.add('hall', M.door, [
    rect('d', backD + 0.03, -HW + 0.4, -HW + 1.8, backY, backY + 2.2, 1),
    rect('d', backD + 0.03, HW - 1.8, HW - 0.4, backY, backY + 2.2, 1),
  ]);
  // выход слева у сцены
  batch.add('hall', M.door, rect('x', -HW + 0.03, -3.4, -4.6, fy, fy + 2.2, 1));
  // операторская за стеклом
  batch.add('hall', M.glass, rect('d', backD - 0.02, -win.windowW / 2, win.windowW / 2, wy0, wy1, 1), { shadow: false });
  batch.add('hall', M.booth, [
    rect('d', backD - 2.4, -win.windowW / 2 - 0.5, win.windowW / 2 + 0.5, backY + 1.0, backY + 3.6, 1),
    rect('y', backY + 1.0, -win.windowW / 2 - 0.5, win.windowW / 2 + 0.5, backD - 2.4, backD, 1),
    rect('y', backY + 3.6, -win.windowW / 2 - 0.5, win.windowW / 2 + 0.5, backD - 2.4, backD, -1),
    rect('x', -win.windowW / 2 - 0.5, backD - 2.4, backD, backY + 1.0, backY + 3.6, 1),
    rect('x', win.windowW / 2 + 0.5, backD - 2.4, backD, backY + 1.0, backY + 3.6, -1),
  ]);
  const mull = [];
  for (let x = -win.windowW / 2; x <= win.windowW / 2 + 1e-6; x += win.windowW / 4) mull.push(box(x - 0.04, x + 0.04, wy0, wy1, backD - 0.05, backD + 0.02));
  mull.push(box(-win.windowW / 2, win.windowW / 2, wy0 - 0.05, wy0, backD - 0.1, backD + 0.05));
  batch.add('hall', M.seatFrame, mull);

  // потолок зала: декоративный над авансценой + основной
  const prof = HALL_CEIL_PROFILE;
  batch.add('hall', M.decoCeiling, ceilQuad(prof[0], prof[1]), { tag: 'ceiling', shadow: false });
  batch.add('hall', M.hallCeiling, [ceilQuad(prof[1], prof[2]), ceilQuad(prof[2], prof[3])], { tag: 'ceiling', shadow: false });

  // --- конструкции для света в зале
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

function ceilQuad([d0, y0], [d1, y1]) {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -HW, y0, -d0, HW, y0, -d0, HW, y1, -d1,
    -HW, y0, -d0, HW, y1, -d1, -HW, y1, -d1,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) > 0) {
    // развернуть, чтобы смотрел вниз
    const a = g.attributes.position.array;
    for (let i = 0; i < 18; i += 9) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; }
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
    box(-GX - 0.04, -GX + 0.02, UPY - 0.25, UPY - 0.22, 1.8, 7.8),
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
  for (const g of Object.values(groups)) g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { groups, dutyPoints, housePoints, blueX: blueX.map((x) => P(x, LOWY - 0.66, BACK - 0.35)) };
}
