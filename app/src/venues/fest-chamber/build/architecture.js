// Архитектура и конструкции Камерной сцены ФЭСТ:
//  • сценическая коробка с левым карманом, задней левой нишей выхода, колоннами, ригелями,
//    вентиляционным и электрическим коробами, потолочными кондиционерами;
//  • зрительный зал с 7-рядным амфитеатром (102 места), боковой лестницей, перилами и операторской;
//  • 12 треугольных ферм (Ф1–Ф9 над сценой, ЗФ1–ЗФ3 над залом), дорога занавеса на Ф1,
//    мониторы на Ф1, портальная акустика на Ф3 и П-образные рамки прострелов;
//  • светильники дежурного освещения (6 шт.) и освещения зала (20 шт.).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, rect, wallWithHoles, cylBetween, P } from '../../../core/geom.js';
import { trussGeometry, tubeBetween } from '../../_template/build.js';
import {
  CHAMBER, ALL_TRUSSES, trussChordsAt, hangerXsFor,
  rowFloorY, rowFrontD, chamberSeatLayout,
} from '../config/dimensions.js';
import { DMX_BOXES } from '../config/fixtures.js';

// Визуальные константы мелких деталей (не влияют на габариты помещения)
const DOOR_RECESS = 0.08;
const NOSING_H = 0.018;
const NOSING_D = 0.035;
const RAIL_R = 0.018;

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return merged;
}

/** Добавить дверь в проёме стены (полотно + откосы). */
function addDoorWithReveals(batch, layer, M, dCfg, facing) {
  const { axis, at, a0, a1, y0, y1 } = dCfg;
  const shift = -facing * DOOR_RECESS;
  if (axis === 'd') {
    const dLeaf = at + shift;
    const dMin = Math.min(at, dLeaf), dMax = Math.max(at, dLeaf);
    batch.add(layer, M.door, rect('d', dLeaf, a0, a1, y0, y1, facing));
    batch.add(layer, M.blackWall, [
      rect('x', a0, dMin, dMax, y0, y1, 1),
      rect('x', a1, dMin, dMax, y0, y1, -1),
      rect('y', y1, a0, a1, dMin, dMax, -1),
    ]);
  } else {
    const xLeaf = at + shift;
    const xMin = Math.min(at, xLeaf), xMax = Math.max(at, xLeaf);
    batch.add(layer, M.door, rect('x', xLeaf, a0, a1, y0, y1, facing));
    batch.add(layer, M.blackWall, [
      rect('d', a0, xMin, xMax, y0, y1, 1),
      rect('d', a1, xMin, xMax, y0, y1, -1),
      rect('y', y1, xMin, xMax, a0, a1, -1),
    ]);
  }
}

/** Построить перила вдоль отрезка (x0,y0,d0) -> (x1,y1,d1). */
function addHandrail(out, x0, y0, d0, x1, y1, d1, h = 0.9, posts = 3) {
  const pTop0 = P(x0, y0 + h, d0), pTop1 = P(x1, y1 + h, d1);
  const pMid0 = P(x0, y0 + h * 0.5, d0), pMid1 = P(x1, y1 + h * 0.5, d1);
  out.push(cylBetween(pTop0, pTop1, RAIL_R, 6));
  out.push(cylBetween(pMid0, pMid1, RAIL_R * 0.75, 5));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const pd = d0 + (d1 - d0) * t;
    out.push(cylBetween(P(px, py, pd), P(px, py + h, pd), RAIL_R * 0.9, 5));
  }
}

export function buildArchitecture(batch, M, { mobile = false } = {}) {
  const S = CHAMBER.stage;
  const H = CHAMBER.hall;
  const RG = CHAMBER.rigels;
  const COL = CHAMBER.columns;
  const DUCT = CHAMBER.ducts;
  const NICHE = CHAMBER.niche;
  const DOORS = CHAMBER.doors;
  const CEIL = S.ceiling;

  // ===========================================================================
  //  1. ПЛАНШЕТ СЦЕНЫ (доска 10 см графитового цвета) И СТЕНЫ КОРОБКИ
  // ===========================================================================
  batch.add('walls', M.floorNarrow, [
    // Основной планшет сцены (d = 0..9,75 м, x = −8,35..+5,65 м)
    rect('y', 0, S.x0, S.x1, S.d0, S.d1, 1),
    // Пол в задней левой нише выхода (d = 9,75..11,10 м, x = −8,35..−6,10 м)
    rect('y', 0, NICHE.x0, NICHE.x1, NICHE.d0, NICHE.d1, 1),
    // Полоса планшета под 1-м рядом кресел перед первой ступенью (d = −0,45..0,00 м)
    rect('y', 0, H.x0, S.x1, H.firstStepD, S.d0, 1),
  ], { tag: 'stageFloor' });

  // Левая стена сцены (x = −8,35 м, d = 0..9,75 м) — видна изнутри
  batch.add('walls', M.wallPanel, rect('x', S.x0, S.d0, S.d1, 0, CEIL, 1), { tag: 'wallL' });

  // Передняя торцевая стенка левого кармана (d = 0,00 м, от левой стены x = −8,35 до передней левой колонны x = −6,475 м) с дверью 2,00 × 2,15 м
  const pocketHole = [{ a0: DOORS.pocket.a0, a1: DOORS.pocket.a1, b0: -0.01, b1: DOORS.pocket.y1 }];
  batch.add('walls', M.wallPanel, wallWithHoles('d', S.d0, S.x0, COL.frontLeft.x0, 0, CEIL, 1, pocketHole), { tag: 'wallB' });
  addDoorWithReveals(batch, 'walls', M, DOORS.pocket, 1);

  // Правая стена сцены (x = +5,65 м, d = 0..9,75 м)
  batch.add('walls', M.wallPanel, rect('x', S.x1, S.d0, S.d1, 0, CEIL, -1), { tag: 'wallR' });

  // Задняя стена сцены (d = +9,75 м): от x = −6,10 до x = +5,65 м во всю высоту (4,40 м) с проёмом правой двери (4,55..5,45 × 1,90 м)
  const backDoorHole = [{ a0: DOORS.stageBackRight.a0, a1: DOORS.stageBackRight.a1, b0: -0.01, b1: DOORS.stageBackRight.y1 }];
  batch.add('walls', M.wallPanel, wallWithHoles('d', S.d1, NICHE.x1, S.x1, 0, CEIL, -1, backDoorHole), { tag: 'wallB' });
  addDoorWithReveals(batch, 'walls', M, DOORS.stageBackRight, -1);

  // Задняя левая ниша выхода со сцены (x = −8,35..−6,10 м, d = 9,75..11,10 м, высота во всё помещение 4,40 м) и 3 двери в ней
  batch.add('walls', M.wallPanel, [
    ...wallWithHoles('x', NICHE.x0, NICHE.d0, NICHE.d1, 0, CEIL, 1, [{ a0: DOORS.nicheLeft.a0, a1: DOORS.nicheLeft.a1, b0: -0.01, b1: DOORS.nicheLeft.y1 }]),
    ...wallWithHoles('d', NICHE.d1, NICHE.x0, NICHE.x1, 0, CEIL, -1, [{ a0: DOORS.nicheBack.a0, a1: DOORS.nicheBack.a1, b0: -0.01, b1: DOORS.nicheBack.y1 }]),
    ...wallWithHoles('x', NICHE.x1, NICHE.d0, NICHE.d1, 0, CEIL, -1, [{ a0: DOORS.nicheRight.a0, a1: DOORS.nicheRight.a1, b0: -0.01, b1: DOORS.nicheRight.y1 }]),
  ], { tag: 'wallB' });
  addDoorWithReveals(batch, 'walls', M, DOORS.nicheLeft, 1);
  addDoorWithReveals(batch, 'walls', M, DOORS.nicheBack, -1);
  addDoorWithReveals(batch, 'walls', M, DOORS.nicheRight, -1);

  // Потолок сцены, ниши выхода и зрительного зала (единая отметка +4,40 м, матовый чёрный, виден снизу)
  batch.add('walls', M.blackWall, [
    rect('y', CEIL, S.x0, S.x1, S.d0, S.d1, -1),
    rect('y', CEIL, NICHE.x0, NICHE.x1, NICHE.d0, NICHE.d1, -1),
    rect('y', CEIL, H.x0, H.x1, H.backWallD, S.d0, -1),
  ], { tag: 'ceiling', shadow: false });

  // ===========================================================================
  //  2. КОЛОННЫ, РИГЕЛИ, ИНЖЕНЕРНЫЕ КОРОБА И КОНДИЦИОНЕРЫ
  // ===========================================================================
  const colRigelGeoms = [
    // 4 несущие колонны
    box(COL.frontLeft.x0, COL.frontLeft.x1, 0, CEIL, COL.frontLeft.d0, COL.frontLeft.d1),
    box(COL.backLeft.x0, COL.backLeft.x1, 0, CEIL, COL.backLeft.d0, COL.backLeft.d1),
    box(COL.frontRight.x0, COL.frontRight.x1, 0, CEIL, COL.frontRight.d0, COL.frontRight.d1),
    box(COL.backRight.x0, COL.backRight.x1, 0, CEIL, COL.backRight.d0, COL.backRight.d1),
    // Передний и задний ригели (низ на +3,60 м, верх до потолка +4,40 м) + участок заднего ригеля в кармане
    box(RG.front.x0, RG.front.x1, RG.bottomY, RG.topY, RG.front.d0, RG.front.d1),
    box(RG.back.x0, RG.back.x1, RG.bottomY, RG.topY, RG.back.d0, RG.back.d1),
    box(RG.back.pocketX0, RG.back.pocketX1, RG.bottomY, RG.topY, RG.back.d0, RG.back.d1),
    // Вентиляционный и электрический короба у левой стены сцены
    box(DUCT.vent.x0, DUCT.vent.x1, DUCT.vent.y0, DUCT.vent.y1, DUCT.vent.d0, DUCT.vent.d1),
    box(DUCT.elecHigh.x0, DUCT.elecHigh.x1, DUCT.elecHigh.y0, DUCT.elecHigh.y1, DUCT.elecHigh.d0, DUCT.elecHigh.d1),
    box(DUCT.elecLow.x0, DUCT.elecLow.x1, DUCT.elecLow.y0, DUCT.elecLow.y1, DUCT.elecLow.d0, DUCT.elecLow.d1),
  ];
  batch.add('walls', M.wallPanel, colRigelGeoms);

  // 2 потолочных блока кондиционеров (1,0 × 1,0 × 0,25 м перед Ф3)
  const acGeoms = CHAMBER.equipment.acUnits.map((u) => box(u.x0, u.x1, u.y0, u.y1, u.d0, u.d1));
  batch.add('walls', M.acUnit, acGeoms);

  // ===========================================================================
  //  3. ЗРИТЕЛЬНЫЙ ЗАЛ, АМФИТЕАТР, ЛЕСТНИЦА И ОПЕРАТОРСКАЯ БУДКА
  // ===========================================================================
  buildHall(batch, M);

  // ===========================================================================
  //  4. ТРЕУГОЛЬНЫЕ ФЕРМЫ (Ф1–Ф9, ЗФ1–ЗФ3), ДОРОГА ЗАНАВЕСА, АКУСТИКА И РАМКИ
  // ===========================================================================
  buildTrussesAndEquipment(batch, M, mobile);
}

function buildHall(batch, M) {
  const H = CHAMBER.hall;
  const DOORS = CHAMBER.doors;
  const CEIL = CHAMBER.stage.ceiling;

  // Внешние стены зрительного зала (серые панели, видны изнутри)
  const hallEntryHole = [{ a0: DOORS.hallEntry.a0, a1: DOORS.hallEntry.a1, b0: -0.01, b1: DOORS.hallEntry.y1 }];
  const hallBackRightHole = [{ a0: DOORS.hallBackRight.a0, a1: DOORS.hallBackRight.a1, b0: DOORS.hallBackRight.y0 - 0.01, b1: DOORS.hallBackRight.y1 }];
  batch.add('hall', M.wallPanel, [
    ...wallWithHoles('x', H.x0, H.backWallD, 0, 0, CEIL, 1, hallEntryHole),
    rect('x', H.x1, H.backWallD, CHAMBER.columns.frontRight.d0, 0, CEIL, -1),
    ...wallWithHoles('d', H.backWallD, H.x0, H.x1, H.topPlatformY, CEIL, 1, hallBackRightHole),
  ], { tag: 'wallB' });
  addDoorWithReveals(batch, 'hall', M, DOORS.hallEntry, 1);
  addDoorWithReveals(batch, 'hall', M, DOORS.hallBackRight, 1);

  // Площадка пола перед боковой лестницей у входа в зал (x = −5,85..−4,85 м, d = −4,15..−0,45 м, уровень 0,00 м)
  batch.add('hall', M.floorNarrow, rect('y', 0, H.x0, H.tierX0, H.sideStairs.dStart, H.firstStepD, 1), { tag: 'hallFloor' });

  // Ступени амфитеатра (ряды 2–6: 5 ступеней по 0,90 м и 0,25 м; ряд 7 и операторская: площадка 1,70 м на +1,50 м)
  const treads = [], risers = [], nosings = [];
  for (let s = 1; s <= 5; s++) {
    const yTop = s * H.stepHeight;
    const yBot = (s - 1) * H.stepHeight;
    const dFront = H.firstStepD - (s - 1) * H.stepDepth;
    const dBack = H.firstStepD - s * H.stepDepth;
    // Горизонтальная проступь ступени (серый ковролин)
    treads.push(rect('y', yTop, H.tierX0, H.tierX1, dBack, dFront, 1));
    // Вертикальный подступенок и левый торец ступени со стороны лестницы (тёмно-серый ковролин)
    risers.push(rect('d', dFront, H.tierX0, H.tierX1, yBot, yTop, 1));
    risers.push(rect('x', H.tierX0, dBack, dFront, 0, yTop, -1));
    // Латунный порожек на передней кромке ступени
    nosings.push(box(H.tierX0, H.tierX1, yTop - NOSING_H, yTop + 0.002, dFront - NOSING_D, dFront));
  }

  // Верхняя площадка 7-го ряда и операторской (d = −6,65..−4,95 м, уровень +1,50 м)
  const yTop7 = H.topPlatformY;
  const dFront7 = H.topPlatformD1; // −4,95 м
  treads.push(rect('y', yTop7, H.tierX0, H.tierX1, H.topPlatformD0, dFront7, 1));
  // Верхняя площадка перед выходом с боковой лестницы (x = −5,85..−4,85 м, d = −6,65..−5,65 м)
  treads.push(rect('y', yTop7, H.x0, H.tierX0, H.topPlatformD0, H.sideStairs.dEnd, 1));
  risers.push(rect('d', dFront7, H.tierX0, H.tierX1, 5 * H.stepHeight, yTop7, 1));
  nosings.push(box(H.tierX0, H.tierX1, yTop7 - NOSING_H, yTop7 + 0.002, dFront7 - NOSING_D, dFront7));

  // Боковая лестница вдоль левой стены зала (x = −5,85..−4,85 м, от d = −4,15 до d = −5,65 м, 6 подъёмов по 0,25 м)
  const st = H.sideStairs;
  const stDepth = (st.dStart - st.dEnd) / (st.steps - 1); // 1,50 / 5 = 0,30 м проступь
  for (let k = 0; k < st.steps - 1; k++) {
    const yTop = (k + 1) * H.stepHeight;
    const d0 = st.dStart - k * stDepth;
    const d1 = st.dStart - (k + 1) * stDepth;
    treads.push(rect('y', yTop, st.x0, st.x1, d1, d0, 1));
    risers.push(box(st.x0, st.x1, 0, yTop, d1, d0));
    nosings.push(box(st.x0, st.x1, yTop - NOSING_H, yTop + 0.002, d0 - NOSING_D, d0));
  }
  risers.push(box(st.x0, st.x1, 0, yTop7, H.topPlatformD0, st.dEnd));
  nosings.push(box(st.x0, st.x1, yTop7 - NOSING_H, yTop7 + 0.002, st.dEnd - NOSING_D, st.dEnd));

  batch.add('hall', M.carpet, treads, { tag: 'hallFloor' });
  batch.add('hall', M.carpetSide, risers, { tag: 'hallFloor' });
  batch.add('hall', M.brass, nosings);

  // Металлические перила вдоль боковой лестницы и левого края рядов амфитеатра
  const rails = [];
  addHandrail(rails, H.tierX0 + 0.03, 0, H.firstStepD, H.tierX0 + 0.03, 0, st.dStart, st.railH, 3);
  addHandrail(rails, H.tierX0 + 0.03, 0.25, st.dStart, H.tierX0 + 0.03, yTop7, st.dEnd, st.railH, 3);
  batch.add('hall', M.steel, rails);

  // Операторская будка на верхнем ярусе (x = −2,30..+2,30 м, d = −6,65..−4,95 м, y = +1,50..+4,40 м)
  const B = H.booth;
  const winHole = [{ a0: -B.windowW / 2, a1: B.windowW / 2, b0: B.windowY0, b1: B.windowY1 }];
  const doorHoleL = [{ a0: DOORS.boothLeft.a0, a1: DOORS.boothLeft.a1, b0: DOORS.boothLeft.y0 - 0.01, b1: DOORS.boothLeft.y1 }];
  const doorHoleR = [{ a0: DOORS.boothRight.a0, a1: DOORS.boothRight.a1, b0: DOORS.boothRight.y0 - 0.01, b1: DOORS.boothRight.y1 }];
  batch.add('hall', M.wallPanel, [
    ...wallWithHoles('d', B.d1, B.x0, B.x1, B.y0, B.y1, 1, winHole),
    ...wallWithHoles('x', B.x0, B.d0, B.d1, B.y0, B.y1, -1, doorHoleL),
    ...wallWithHoles('x', B.x1, B.d0, B.d1, B.y0, B.y1, 1, doorHoleR),
  ]);
  addDoorWithReveals(batch, 'hall', M, DOORS.boothLeft, -1);
  addDoorWithReveals(batch, 'hall', M, DOORS.boothRight, 1);

  // Окно операторской и интерьер будки за стеклом
  batch.add('hall', M.glass, rect('d', B.d1 - 0.02, -B.windowW / 2, B.windowW / 2, B.windowY0, B.windowY1, 1), { shadow: false });
  batch.add('hall', M.booth, [
    rect('d', B.d0 + 0.02, B.x0 + 0.05, B.x1 - 0.05, B.y0, B.y1 - 0.05, 1),
    rect('y', B.y0 + 0.78, -B.windowW / 2 - 0.2, B.windowW / 2 + 0.2, B.d1 - 0.65, B.d1 - 0.02, 1), // стол пульта
  ]);
  const mull = [
    box(-B.windowW / 2 - 0.04, B.windowW / 2 + 0.04, B.windowY0 - 0.04, B.windowY0, B.d1 - 0.06, B.d1 + 0.03),
    box(-B.windowW / 2 - 0.04, B.windowW / 2 + 0.04, B.windowY1, B.windowY1 + 0.04, B.d1 - 0.06, B.d1 + 0.03),
    box(-0.025, 0.025, B.windowY0, B.windowY1, B.d1 - 0.05, B.d1 + 0.02),
  ];
  batch.add('hall', M.seatFrame, mull);
}

function buildTrussesAndEquipment(batch, M, mobile) {
  const T = CHAMBER.trusses;
  const EQ = CHAMBER.equipment;
  const CEIL = CHAMBER.stage.ceiling;
  const seg = (mobile && T.segMobile) || T.seg;
  const trusses = [], hangers = [], plates = [];
  const plate = T.plate;

  // 1. Все 12 треугольных ферм (ЗФ1–ЗФ3 и Ф1–Ф9) с вертикальными подвесами к потолку
  for (const tr of ALL_TRUSSES) {
    trusses.push(trussGeometry({
      x0: tr.x0,
      x1: tr.x1,
      d: tr.d,
      bottomY: T.bottomY,
      side: T.side,
      tube: T.tube,
      pitch: T.lacingPitch,
      apexUp: T.apexUp,
      seg,
    }));
    const top = trussChordsAt(tr.d, CHAMBER).top;
    const yTop = top[0][0] + T.tube / 2;
    for (const x of hangerXsFor(tr.x0, tr.x1, CHAMBER)) {
      hangers.push(tubeBetween(P(x, yTop, tr.d), P(x, CEIL - plate.thick, tr.d), T.hangerTube / 2, seg.chord));
      plates.push(box(x - plate.size / 2, x + plate.size / 2, CEIL - plate.thick, CEIL, tr.d - plate.size / 2, tr.d + plate.size / 2));
    }
  }

  // 2. Прямоугольные рамки-крепления для боковых прострелов авансцены (17+122 слева на x = −6,05 м, 19+123 справа на x = +5,40 м)
  //    сразу за передними портальными колоннами (d = +0,08 м)
  const pf = T.prosceniumFrame;
  const rDrop = T.tube / 2;
  for (const sd of T.sideDrops) {
    const hw = pf.dropHalfW || 0.22;
    trusses.push(
      tubeBetween(P(sd.x - hw, sd.y0, sd.d), P(sd.x - hw, sd.y1, sd.d), rDrop, seg.lacing),
      tubeBetween(P(sd.x + hw, sd.y0, sd.d), P(sd.x + hw, sd.y1, sd.d), rDrop, seg.lacing),
      tubeBetween(P(sd.x - hw, sd.y0, sd.d), P(sd.x + hw, sd.y0, sd.d), rDrop, seg.lacing),
      tubeBetween(P(sd.x - hw, pf.midY, sd.d), P(sd.x + hw, pf.midY, sd.d), rDrop, seg.lacing),
      tubeBetween(P(sd.x - hw, sd.y1, sd.d), P(sd.x + hw, sd.y1, sd.d), rDrop, seg.lacing),
    );
  }

  batch.add('trusses', M.truss, trusses);
  batch.add('trusses', M.truss, hangers);
  batch.add('trusses', M.steel, plates, { shadow: false });

  // 3. Лёгкая алюминиевая дорога занавеса по всей длине Ф1 (d = +0,85 м)
  const ct = EQ.curtainTrack;
  batch.add('trusses', M.curtainTrack, box(ct.x0, ct.x1, ct.y - ct.h / 2, ct.y + ct.h / 2, ct.d - ct.w / 2, ct.d + ct.w / 2));

  // 4. Акустические системы на Ф1 (2 монитора) и Ф3 (2 портальные колонки, направленные в центр зала)
  const spkGeoms = [];
  const mon = EQ.monitors;
  for (const x of mon.xs) {
    const [w, h, d] = mon.size;
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateX(0.32); // наклон монитора вниз на сцену
    g.translate(x, mon.y, -mon.d);
    spkGeoms.push(g);
  }
  const pa = EQ.paSpeakers;
  const aimVec = P(pa.aim[0], pa.aim[1], pa.aim[2]);
  for (const x of pa.xs) {
    const [w, h, d] = pa.size;
    const pos = P(x, pa.y, pa.d);
    const dir = aimVec.clone().sub(pos).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1)));
    spkGeoms.push(g);
  }
  // 5 узловых коробок сплиттеров DMX-1..DMX-5 на фермах ЗФ2, Ф2, Ф5, Ф8
  for (const db of DMX_BOXES) {
    spkGeoms.push(box(db.x - 0.11, db.x + 0.11, T.bottomY + 0.02, T.bottomY + 0.12, db.d - 0.08, db.d + 0.08));
  }
  batch.add('trusses', M.acUnit, spkGeoms);
}

/** Кресло в локальных координатах: передняя кромка сиденья в z = 0, зритель смотрит в −Z (в +d). */
function seatGeometry(pitch) {
  const B = (w, hh, dd, x, y, z) => new THREE.BoxGeometry(w, hh, dd).translate(x, y, z);
  const back = new THREE.BoxGeometry(pitch - 0.08, 0.56, 0.08).translate(0, 0.28, 0).rotateX(0.16).translate(0, 0.4, 0.46);
  const fabric = [B(pitch - 0.09, 0.08, 0.42, 0, 0.42, 0.22), back];
  const frame = [
    B(0.045, 0.58, 0.42, -pitch / 2, 0.29, 0.26),
    B(0.055, 0.045, 0.45, -pitch / 2, 0.6, 0.22),
  ];
  return [mergeAll(fabric), mergeAll(frame)];
}

/**
 * Откидная боковушка (место № 16 справа в 1-м и 2-м рядах):
 * сложенная вертикально подушка сиденья без спинки + чёрный защитный кожух и стойка-кронштейн
 * на правой боковине 15-го кресла (как на фото правого прохода зала).
 */
function foldingSideSeatGeometry() {
  const B = (w, hh, dd, x, y, z) => new THREE.BoxGeometry(w, hh, dd).translate(x, y, z);
  const fabric = [
    // вертикально сложенная мягкая подушка сиденья (оранжевая обивка обращена влево и вверх)
    B(0.068, 0.36, 0.38, -0.012, 0.36, 0.25),
  ];
  const frame = [
    // наружный чёрный защитный кожух сложенного сиденья (справа со стороны прохода)
    B(0.022, 0.37, 0.39, 0.032, 0.355, 0.25),
    // поворотный кронштейн к боковине 15-го кресла и опорная стойка с пятой на полу
    B(0.11, 0.12, 0.16, -0.01, 0.22, 0.25),
    B(0.042, 0.24, 0.06, 0.015, 0.12, 0.25),
    B(0.14, 0.012, 0.2, 0.01, 0.006, 0.25),
  ];
  return [mergeAll(fabric), mergeAll(frame)];
}

/**
 * Построить все 102 места зрительного зала:
 *  - 100 стационарных кресел со спинками (2 InstancedMesh: обивка + каркас);
 *  - 2 откидные боковушки без спинок справа в 1-м и 2-м рядах (2 InstancedMesh: обивка + каркас).
 */
export function buildSeats(M) {
  const H = CHAMBER.hall;
  const { seats, blockEdges } = chamberSeatLayout(CHAMBER);
  const regular = seats.filter((s) => !s.folding);
  const folding = seats.filter((s) => s.folding);

  const [gF, gK] = seatGeometry(H.seatPitch);
  const iF = new THREE.InstancedMesh(gF, M.seatFabric, regular.length);
  const iK = new THREE.InstancedMesh(gK, M.seatFrame, regular.length + blockEdges.length);
  const [gFoldF, gFoldK] = foldingSideSeatGeometry();
  const foldF = new THREE.InstancedMesh(gFoldF, M.seatFabric, folding.length);
  const foldK = new THREE.InstancedMesh(gFoldK, M.seatFrame, folding.length);

  const m = new THREE.Matrix4();
  regular.forEach((s, k) => {
    m.makeTranslation(s.x, s.y, -s.d);
    iF.setMatrixAt(k, m);
    iK.setMatrixAt(k, m);
  });

  blockEdges.forEach((e, k) => {
    m.makeTranslation(e.x + H.seatPitch / 2, e.y, -e.d);
    iK.setMatrixAt(regular.length + k, m);
  });

  folding.forEach((s, k) => {
    m.makeTranslation(s.x, s.y, -s.d);
    foldF.setMatrixAt(k, m);
    foldK.setMatrixAt(k, m);
  });

  const all = [iF, iK, foldF, foldK];
  for (const im of all) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.userData.layer = 'hall';
    im.userData.seats = true;
    im.computeBoundingSphere();
  }
  iF.name = 'seatsFabric';
  iK.name = 'seatsFrame';
  foldF.name = 'foldingSeatsFabric';
  foldK.name = 'foldingSeatsFrame';
  return all;
}

/**
 * Светильники дежурного света сцены (6 прямоугольных прожекторов) и света зала (20 цилиндрических ламп).
 */
export function buildEmitters(M) {
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';
  const E = CHAMBER.emitters;
  const CEIL = CHAMBER.stage.ceiling;

  // 1. 6 мощных прямоугольных светильников дежурного света (по 3 между Ф3–Ф4 и между Ф8–Ф9)
  const [dw, dh, dd] = E.duty.size;
  const dutyHousings = [], dutyPanels = [], dutyRows = [];
  for (const d of E.duty.ds) {
    const row = [];
    for (const x of E.duty.xs) {
      dutyHousings.push(box(x - dw / 2, x + dw / 2, E.duty.y, CEIL, d - dd / 2, d + dd / 2));
      dutyPanels.push(rect('y', E.duty.y - 0.003, x - dw * 0.42, x + dw * 0.42, d - dd * 0.4, d + dd * 0.4, -1));
      row.push(P(x, E.duty.y, d));
    }
    dutyRows.push(row);
  }
  const dutyBulbMesh = new THREE.Mesh(mergeAll(dutyPanels), M.dutyBulb);
  dutyBulbMesh.userData.emitter = 'duty';
  groups.duty.add(new THREE.Mesh(mergeAll(dutyHousings), M.fixtureBody), dutyBulbMesh);

  // 2. 20 маленьких цилиндрических ламп зального света (включаются кнопкой «Зал»)
  const houseCans = [], houseDiscs = [];
  const hr = E.house.r, hh = E.house.h;
  for (const d of E.house.ds) {
    for (const x of E.house.xs) {
      houseCans.push(new THREE.CylinderGeometry(hr, hr, hh, 12).translate(x, CEIL - hh / 2, -d));
      houseDiscs.push(new THREE.CircleGeometry(hr * 0.85, 12).rotateX(Math.PI / 2).translate(x, CEIL - hh - 0.002, -d));
    }
  }
  const houseLampMesh = new THREE.Mesh(mergeAll(houseDiscs), M.houseLamp);
  houseLampMesh.userData.emitter = 'house';
  groups.house.add(new THREE.Mesh(mergeAll(houseCans), M.fixtureBody), houseLampMesh);

  for (const g of Object.values(groups)) {
    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }
  return { groups, dutyRows };
}
