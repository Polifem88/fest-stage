// =============================================================================
//  ГЕНЕРАТОР 2D-ЧЕРТЕЖЕЙ СЦЕНЫ В ФОРМАТЕ AUTOCAD DXF:
//    1. buildPlanDXF(stage)    — План сцены, зрительного зала и развеса света
//    2. buildSectionDXF(stage) — Продольный разрез сцены и зрительного зала
//
//  Все габариты берутся из единого источника правды (config/*.js),
//  а высоты подъёмов, вкл/выкл приборов и режим переносных — из состояния stage.
// =============================================================================
import {
  DIM, BOX_HALF, HALL_HALF, GALLERY_INNER_X, BACK_GALLERY_FRONT_D,
  RAKE, rowFrontD, hallFloorY,
} from '../config/dimensions.js';
import { RIGGING, RIG_BY_ID, SPACING, LEFT_RAIL_ORDER, RIGHT_FRONT_ORDER, ropeDepth, DUTY_ROWS } from '../config/rigging.js';
import { FIXTURES, TYPES, GROUPS, PORTABLE, portablePlacement, BAR_DEPTH } from '../config/fixtures.js';
import { SPECS } from '../config/fixtures.js';
import { HALL_CEIL_PROFILE, HALL_BACK_FLOOR_Y } from '../build/architecture.js';
import { DxfWriter } from '../../../export/dxfWriter.js';

/** Основная надпись чертежей этой сцены. */
const SHEET_TITLE = 'МЫТИЩИНСКИЙ ТЕАТР ДРАМЫ И КОМЕДИИ «ФЭСТ» · БОЛЬШАЯ СЦЕНА';

const fmtM = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');

/** Получить актуальное состояние высот и приборов (работает как с живым Stage, так и без него в юнит-тестах). */
function extractSnapshot(stage) {
  const heights = {};
  for (const r of RIGGING) {
    heights[r.id] = stage?.rigging ? stage.rigging.height(r.id) : r.rest;
  }
  const portable = stage?.fixtures?.portable
    ? { ...stage.fixtures.portable }
    : { ...PORTABLE.defaults };

  const fixtures = (stage?.fixtures?.list || FIXTURES).map((f, idx) => {
    const isPort = !!f.portable;
    let mount = { ...f.mount };
    let aim = { ...f.aim };
    let hidden = !!f.hidden;
    if (isPort) {
      const p = portablePlacement(f.portable.side, f.portable.k, portable.mode, portable.count);
      mount = p.mount;
      aim = p.aim;
      hidden = !p.visible;
    }
    const y = mount.on ? heights[mount.on] + mount.y : mount.y;
    const d = mount.on ? BAR_DEPTH[mount.on] + mount.d : mount.d;
    const on = f.on !== undefined ? !!f.on : true;
    return {
      ...f,
      idx,
      on,
      hidden,
      worldPos: { x: mount.x, y, d },
      worldAim: { x: aim.x, y: aim.y, d: aim.d },
    };
  });

  return { heights, portable, fixtures };
}

/** Регистрация нейтральных CAD-блоков корпусов световых приборов (всегда в выключенном состоянии, без лучей и стрелок). */
function registerFixtureBlocks(dxf) {
  // SPOT: поворотная голова Spot (прямоугольная база + корпус)
  dxf.addBlock('FX_SPOT', (b) => {
    b.addRect(-0.13, -0.13, 0.13, 0.13);
    b.addRect(-0.08, -0.08, 0.08, 0.08);
  });

  // WASH: поворотная голова Wash
  dxf.addBlock('FX_WASH', (b) => {
    b.addRect(-0.14, -0.11, 0.14, 0.11);
    b.addRect(-0.09, -0.07, 0.09, 0.07);
  });

  // BEAM: компактная голова B-Eye
  dxf.addBlock('FX_BEAM', (b) => {
    b.addRect(-0.12, -0.12, 0.12, 0.12);
    b.addRect(-0.07, -0.07, 0.07, 0.07);
  });

  // LEDPAR: прожектор на лире
  dxf.addBlock('FX_LEDPAR', (b) => {
    b.addRect(-0.13, -0.1, 0.13, 0.1);
    b.addLine(-0.16, 0, 0.16, 0);
  });

  // PROFILE: профильный прожектор (тубус)
  dxf.addBlock('FX_PROFILE', (b) => {
    b.addRect(-0.09, -0.16, 0.09, 0.16);
    b.addLine(-0.12, 0, 0.12, 0);
  });

  // FRESNEL: линзовый прожектор Френеля
  dxf.addBlock('FX_FRESNEL', (b) => {
    b.addRect(-0.12, -0.13, 0.12, 0.13);
    b.addLine(-0.12, 0.08, 0.12, 0.08);
  });

  // PAR: классический PAR-64
  dxf.addBlock('FX_PAR', (b) => {
    b.addRect(-0.11, -0.11, 0.11, 0.11);
  });

  // FOLLOW: следящая пушка
  dxf.addBlock('FX_FOLLOW', (b) => {
    b.addRect(-0.12, -0.28, 0.12, 0.28);
    b.addLine(-0.18, 0, 0.18, 0);
  });
}

const SHAPE_BLOCK = {
  spot: 'FX_SPOT',
  wash: 'FX_WASH',
  beam: 'FX_BEAM',
  ledpar: 'FX_LEDPAR',
  profile: 'FX_PROFILE',
  fresnel: 'FX_FRESNEL',
  par: 'FX_PAR',
  follow: 'FX_FOLLOW',
};

// =============================================================================
//  1. ПЛАН СЦЕНЫ 2D (fest-stage-plan-2d.dxf)
//     X_cad = X (поперёк сцены), Y_cad = d (глубина от красной линии портала)
// =============================================================================
export function buildPlanDXF(stage) {
  const { heights, portable, fixtures } = extractSnapshot(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });

  // Регистрация слоёв по утверждённому плану (1-А, 2-А, 3-А)
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_WALLS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('AR_RIGEL', { color: 9, ltype: 'DASHED' })
    .addLayer('AR_GALLERIES', { color: 4, ltype: 'DASHED' })
    .addLayer('AR_HALL', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_HALL_SEATS', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('RIG_BATTENS', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('RIG_SOFFITS', { color: 30, ltype: 'CONTINUOUS' })
    .addLayer('RIG_TRACK', { color: 6, ltype: 'CONTINUOUS' })
    .addLayer('RIG_SIDE', { color: 3, ltype: 'CONTINUOUS' })
    .addLayer('FIXTURES', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('FIXTURE_LABELS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('DIMS', { color: 2, ltype: 'CONTINUOUS' })
    .addLayer('SHEET_LEGEND', { color: 7, ltype: 'CONTINUOUS' });

  registerFixtureBlocks(dxf);

  const W = BOX_HALF; // 8.5
  const HW = HALL_HALF; // 9.0
  const BACK = DIM.box.backWallD; // 9.2
  const PT = DIM.portal.thickness; // 0.25
  const PW2 = DIM.portal.width / 2; // 6.25
  const FS = DIM.forestage;
  const FW2 = FS.frontWidth / 2; // 5.625
  const BREAK_D = -FS.depth + FS.sideStraight; // -0.85
  const GX = GALLERY_INNER_X; // 7.6
  const GB = BACK_GALLERY_FRONT_D; // 8.3
  const HALL_BACK_D = -DIM.hall.portalToBoothWall; // -18.0

  // --- 1. Оси и метровая сетка (0_AXES, 0_GRID) ------------------------------
  dxf.addLine(0, HALL_BACK_D - 2.8, 0, BACK + 1.2, { layer: '0_AXES' });
  dxf.addLine(-HW - 1.2, 0, HW + 1.2, 0, { layer: '0_AXES' });
  dxf.addText(0.15, BACK + 0.85, 'ОСЬ СЦЕНЫ (X = 0)', { layer: '0_AXES', height: 0.18 });
  dxf.addText(-HW - 1.1, 0.12, 'КРАСНАЯ ЛИНИЯ ПОРТАЛА (d = 0)', { layer: '0_AXES', height: 0.18 });

  const pit = DIM.pit;
  for (let x = -8; x <= 8; x++) {
    if (x !== 0) {
      if (x > GX) {
        dxf.addLine(x, -FS.depth, x, pit.fromD, { layer: '0_GRID' });
        dxf.addLine(x, pit.toD, x, BACK, { layer: '0_GRID' });
      } else {
        dxf.addLine(x, -FS.depth, x, BACK, { layer: '0_GRID' });
      }
    }
    if (x % 2 === 0) {
      dxf.addText(x, BACK + 0.35, `${x > 0 ? '+' : ''}${x}`, { layer: '0_GRID', height: 0.18, align: 'center', valign: 'bottom' });
    }
  }
  for (let d = Math.ceil(-FS.depth); d <= Math.floor(BACK); d++) {
    if (d !== 0) {
      const xMax = d > pit.fromD && d < pit.toD ? GX : W;
      dxf.addLine(-W, d, xMax, d, { layer: '0_GRID' });
    }
    dxf.addText(-W - 0.35, d, `${d > 0 ? '+' : ''}${d} м`, { layer: '0_GRID', height: 0.16, align: 'right', valign: 'middle' });
  }

  // --- 2. Стены коробки, портал, проёмы, авансцена, приямок (AR_WALLS) -------
  const wallT = 0.35; // условная толщина наружных стен на плане
  // Левая и правая стены коробки
  dxf.addRect(-W - wallT, PT, -W, BACK + wallT, { layer: 'AR_WALLS' });
  const sd = DIM.openings.sideDoor;
  dxf.addRect(W, PT, W + wallT, sd.fromD, { layer: 'AR_WALLS' });
  dxf.addRect(W, sd.fromD + sd.width, W + wallT, BACK + wallT, { layer: 'AR_WALLS' });
  // Дверь в приямке справа
  dxf.addLine(W, sd.fromD, W + 0.75, sd.fromD + sd.width * 0.6, { layer: 'AR_WALLS' });
  dxf.addText(W + 0.45, sd.fromD + sd.width / 2, 'Дверь (-1,00)', { layer: 'AR_WALLS', height: 0.15 });

  // Задняя стена с грузовыми воротами и дверью
  const gate = DIM.openings.gate;
  const gX0 = gate.centerX - gate.width / 2, gX1 = gate.centerX + gate.width / 2;
  const bd = DIM.openings.backDoor;
  const bdX0 = bd.centerX - bd.width / 2, bdX1 = bd.centerX + bd.width / 2;
  dxf.addRect(-W, BACK, bdX0, BACK + wallT, { layer: 'AR_WALLS' });
  dxf.addRect(bdX1, BACK, gX0, BACK + wallT, { layer: 'AR_WALLS' });
  dxf.addRect(gX1, BACK, W, BACK + wallT, { layer: 'AR_WALLS' });
  // Створки ворот и задней двери
  dxf.addLine(bdX0, BACK, bdX1, BACK + 0.65, { layer: 'AR_WALLS' });
  dxf.addLine(gX0, BACK, gate.centerX, BACK + 0.9, { layer: 'AR_WALLS' });
  dxf.addLine(gX1, BACK, gate.centerX, BACK + 0.9, { layer: 'AR_WALLS' });
  dxf.addText(gate.centerX, BACK + 0.42, `Ворота ${fmtM(gate.width, 1)}×${fmtM(gate.height, 1)} м`, { layer: 'AR_WALLS', height: 0.17, align: 'center' });
  dxf.addText(bd.centerX, BACK + 0.42, 'Дверь', { layer: 'AR_WALLS', height: 0.16, align: 'center' });

  // Пилоны портала
  dxf.addRect(-HW, 0, -PW2, PT, { layer: 'AR_WALLS' });
  dxf.addRect(PW2, 0, HW, PT, { layer: 'AR_WALLS' });
  // Линия зеркала портала (пунктир)
  dxf.addLine(-PW2, 0, PW2, 0, { layer: 'AR_WALLS', ltype: 'DASHED' });
  dxf.addLine(-PW2, PT, PW2, PT, { layer: 'AR_WALLS', ltype: 'DASHED' });

  // Контур авансцены и боковых маршей ступеней
  dxf.addPolyline([
    [-PW2, 0], [-FW2, BREAK_D], [-FW2, -FS.depth],
    [FW2, -FS.depth], [FW2, BREAK_D], [PW2, 0],
  ], { layer: 'AR_WALLS' });
  // Ступени в нишах авансцены (параллельно скосу авансцены от его излома до линии портала d = 0)
  for (const side of [-1, 1]) {
    const ax = side * PW2, ay = 0;
    const bx = side * FW2, by = BREAK_D;
    const cy = -FS.depth;
    const rises = FS.stairs.steps;
    for (let k = 1; k < rises; k++) {
      const t = k / (rises - 1);
      const p1x = bx;
      const p1y = by + (cy - by) * t;
      const p0x = bx + (p1y / by) * (ax - bx);
      const p0y = ay;
      dxf.addLine(p0x, p0y, p1x, p1y, { layer: 'AR_WALLS' });
    }
  }

  // Приямок у правой стены (0.9 × 3.0 м, глубина -1.0 м)
  dxf.addRect(GX, pit.fromD, W, pit.toD, { layer: 'AR_WALLS' });
  for (let i = 1; i < pit.steps; i++) {
    const stepD = pit.toD - i * 0.3;
    dxf.addLine(GX, stepD, W, stepD, { layer: 'AR_WALLS' });
  }
  dxf.addText((GX + W) / 2, (pit.fromD + pit.toD) / 2, 'Приямок -1,00', {
    layer: 'AR_WALLS', height: 0.14, rotation: 90, align: 'center', valign: 'middle',
  });

  // --- 3. Строительный ригель (AR_RIGEL) -------------------------------------
  const rg0 = DIM.rigel.d - DIM.rigel.width / 2, rg1 = DIM.rigel.d + DIM.rigel.width / 2;
  dxf.addRect(-W, rg0, W, rg1, { layer: 'AR_RIGEL', ltype: 'DASHED' });
  dxf.addText(0, DIM.rigel.d, `РИГЕЛЬ d=${fmtM(DIM.rigel.d)} м (низ +${fmtM(DIM.rigel.bottomY)} м)`, {
    layer: 'AR_RIGEL', height: 0.17, align: 'center', valign: 'middle',
  });

  // --- 4. Галереи, узел подъёма и решётка (AR_GALLERIES) ---------------------
  const fToD = DIM.galleries.frontToD;
  // Левая, правая, задняя и передняя галереи
  dxf.addRect(-W, fToD, -GX, BACK, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  dxf.addRect(GX, fToD, W, BACK, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  dxf.addRect(-GX, GB, GX, BACK, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  dxf.addRect(-W, DIM.galleries.frontFromD, W, fToD, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  // Площадка узла подъёма (2.0 × 2.0 м в правом заднем углу)
  const padX0 = W - DIM.liftNode.padSize, padD0 = BACK - DIM.liftNode.padSize;
  dxf.addRect(padX0, padD0, W, BACK, { layer: 'AR_GALLERIES' });
  dxf.addText((padX0 + W) / 2, (padD0 + BACK) / 2, 'Узел подъёма (+2,20)', {
    layer: 'AR_GALLERIES', height: 0.14, align: 'center', valign: 'middle',
  });

  // --- 5. Зрительный зал, ряды кресел, мосты, ложи, операторская (AR_HALL) ---
  dxf.addLine(-HW, 0, -HW, HALL_BACK_D, { layer: 'AR_HALL' });
  dxf.addLine(HW, 0, HW, HALL_BACK_D, { layer: 'AR_HALL' });
  dxf.addLine(-HW, HALL_BACK_D, HW, HALL_BACK_D, { layer: 'AR_HALL' });
  // Операторская за окном
  const winW2 = DIM.hallRig.booth.windowW / 2;
  dxf.addRect(-winW2 - 0.5, HALL_BACK_D - 2.4, winW2 + 0.5, HALL_BACK_D, { layer: 'AR_HALL' });
  dxf.addLine(-winW2, HALL_BACK_D, winW2, HALL_BACK_D, { layer: 'AR_WALLS' });
  dxf.addText(0, HALL_BACK_D - 1.2, 'ОПЕРАТОРСКАЯ (световая / звуковая)', {
    layer: 'AR_HALL', height: 0.22, align: 'center', valign: 'middle',
  });

  // Ряды кресел (15 рядов по 26 мест = 390 мест)
  const H = DIM.hall;
  const SW = H.seatWidth;
  for (let r = 0; r < H.rows; r++) {
    const dFront = rowFrontD(r);
    const dSeat = dFront - 0.42;
    const rowHalfW = (H.seatsPerRow * SW) / 2;
    // Линия ступени ряда
    dxf.addLine(-HW, dFront, HW, dFront, { layer: 'AR_HALL' });
    // Контуры кресел в ряду (вынесены на подслой AR_HALL_SEATS для удобства отключения мебели в САПР)
    for (let s = 0; s < H.seatsPerRow; s++) {
      const sx = (s - (H.seatsPerRow - 1) / 2) * SW;
      dxf.addRect(sx - SW * 0.42, dSeat - 0.22, sx + SW * 0.42, dSeat + 0.18, { layer: 'AR_HALL_SEATS' });
    }
    const rowY = -FS.height + r * H.rowPitch * RAKE;
    dxf.addText(HW + 0.35, dSeat, `Р${r + 1} (${rowY >= 0 ? '+' : ''}${fmtM(rowY)})`, {
      layer: 'AR_HALL', height: 0.14, align: 'left', valign: 'middle',
    });
  }

  // Выносные мосты М1 и М2
  for (const [bName, br] of [['1-й выносной мост (+6,40 м)', DIM.hallRig.bridge1], ['2-й выносной мост (+6,80 м)', DIM.hallRig.bridge2]]) {
    dxf.addRect(-br.length / 2, br.d - 0.15, br.length / 2, br.d + 0.15, { layer: 'AR_HALL', ltype: 'DASHED' });
    dxf.addText(-br.length / 2 - 0.2, br.d + 0.22, bName, { layer: 'AR_HALL', height: 0.15, align: 'left', valign: 'bottom' });
  }

  // Боковые ложи Л1, Л2, П1, П2 и башни прострелов
  for (const [key, bx] of Object.entries(DIM.hallRig.boxes)) {
    const x0 = bx.side < 0 ? -HW : HW - 0.5;
    const x1 = bx.side < 0 ? -HW + 0.5 : HW;
    dxf.addRect(x0, bx.d - bx.w / 2, x1, bx.d + bx.w / 2, { layer: 'AR_HALL' });
    const label = { L1: 'Ложа Л1', L2: 'Ложа Л2', R1: 'Ложа П1', R2: 'Ложа П2' }[key];
    dxf.addText(bx.side * (HW - 0.25), bx.d + bx.w / 2 + 0.22, label, {
      layer: 'AR_HALL', height: 0.16, align: 'center', valign: 'bottom',
    });
  }
  for (const [key, tw] of Object.entries(DIM.hallRig.sideTowers)) {
    const x0 = tw.side < 0 ? -HW : HW - 0.35;
    const x1 = tw.side < 0 ? -HW + 0.35 : HW;
    dxf.addRect(x0, tw.d - 0.22, x1, tw.d + 0.22, { layer: 'AR_HALL' });
    dxf.addText(tw.side * (HW + 0.25), tw.d, key === 'L' ? 'Прострел Л' : 'Прострел П', {
      layer: 'AR_HALL', height: 0.17, align: tw.side < 0 ? 'right' : 'left', valign: 'middle',
    });
  }

  // --- 6. Верхняя механика: штанкеты, софиты, дорога занавеса, боковые -------
  const pipeHalf = DIM.pipe.length / 2; // 7.0
  const trackHalf = DIM.pipe.trackLength / 2; // 7.5
  const barDepthHalf = DIM.pipe.lightBarDepth / 2; // 0.25

  // Сортируем поперечные подъёмы по глубине d для разведения выносных полок «лесенкой»
  const crossRigs = RIGGING.filter((r) => r.kind !== 'side').sort((a, b) => a.d - b.d);
  crossRigs.forEach((r, idx) => {
    const hVal = heights[r.id];
    const layer = r.kind === 'light' ? 'RIG_SOFFITS' : r.kind === 'track' ? 'RIG_TRACK' : 'RIG_BATTENS';
    const halfL = r.kind === 'track' ? trackHalf : pipeHalf;

    // Основная труба / ферма
    dxf.addLine(-halfL, r.d, halfL, r.d, { layer });
    if (r.kind === 'light') {
      dxf.addRect(-halfL, r.d - barDepthHalf, halfL, r.d + barDepthHalf, { layer, ltype: 'DASHED' });
    } else if (r.kind === 'track') {
      dxf.addRect(-halfL, r.d - DIM.pipe.trackWidth / 2, halfL, r.d + DIM.pipe.trackWidth / 2, { layer });
    }

    // 4 точки подвеса
    for (const px of DIM.pipe.pickupX) {
      dxf.addCircle(px, r.d, 0.06, { layer });
    }

    // Разведение выносок «лесенкой» чередованием влево/вправо и в 2 эшелона
    const side = idx % 2 === 0 ? -1 : 1;
    const tier = Math.floor(idx / 2) % 2;
    const xStart = side * halfL;
    const xShelf = side * (W + 1.4 + tier * 2.4);
    const labelStr = `${r.name} (d=${fmtM(r.d)}, H=+${fmtM(hVal)})`;
    dxf.addLeaderLabel(xStart, r.d, xShelf, r.d, labelStr, {
      layer, textHeight: 0.16, shelfLen: 2.1,
    });
  });

  // Боковые штанкеты Б1 и Б2
  for (const r of RIGGING.filter((it) => it.kind === 'side')) {
    const hVal = heights[r.id];
    dxf.addLine(r.x, r.dFrom, r.x, r.dTo, { layer: 'RIG_SIDE' });
    for (const pd of [r.dFrom, (r.dFrom + r.dTo) / 2, r.dTo]) {
      dxf.addCircle(r.x, pd, 0.06, { layer: 'RIG_SIDE' });
    }
    dxf.addText(
      r.x - Math.sign(r.x) * 0.22,
      (r.dFrom + r.dTo) / 2,
      `${r.name} (x=${fmtM(r.x, 1)}, H=+${fmtM(hVal)})`,
      { layer: 'RIG_SIDE', height: 0.16, rotation: 90, align: 'center', valign: 'middle' },
    );
  }

  // Каретки противовесов у левой и правой стен
  for (const r of RIGGING) {
    const rd = ropeDepth(r.id);
    const cwX = r.control === 'left' ? -W + 0.14 : W - 0.14;
    dxf.addRect(cwX - 0.06, rd - 0.07, cwX + 0.06, rd + 0.07, { layer: 'RIG_SIDE' });
  }

  // Линии дежурного освещения (ДО1–ДО3)
  for (const dr of DUTY_ROWS) {
    for (const dx of [-5.25, -1.75, 1.75, 5.25]) {
      dxf.addCircle(dx, dr.d, 0.08, { layer: 'AR_GALLERIES' });
    }
    dxf.addText(5.65, dr.d, dr.name, { layer: 'AR_GALLERIES', height: 0.14, valign: 'middle' });
  }

  // --- 7. Корпуса световых приборов и их номера (всегда в выключенном состоянии, без лучей и кругов) ---
  const planStackCounts = new Map();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const blockName = SHAPE_BLOCK[t.shape] || 'FX_SPOT';
    const x = f.worldPos.x, y = f.worldPos.d;
    const sc = t.scale || 1;

    dxf.addInsert(blockName, x, y, { layer: 'FIXTURES', scaleX: sc, scaleY: sc, scaleZ: sc, rotation: 0 });

    // Подпись номера прибора (разносим как по трубе софита, так и по вертикальным башням/ложам с одинаковым X,d)
    const stackKey = `${x.toFixed(2)}_${y.toFixed(2)}`;
    const stackRank = planStackCounts.get(stackKey) || 0;
    planStackCounts.set(stackKey, stackRank + 1);

    const isBar = !!f.mount.on || f.group.startsWith('BR');
    const lblX = isBar ? x : x + (x < 0 ? 0.34 : -0.34);
    const lblY = isBar
      ? y + (f.idx % 2 === 0 ? 0.26 : -0.34)
      : y + 0.28 - stackRank * 0.22;
    dxf.addText(lblX, lblY, String(f.no), {
      layer: 'FIXTURE_LABELS', height: 0.14, align: 'center', valign: 'middle',
    });
  }

  // --- 8. Размерные цепочки (DIMS) -------------------------------------------
  // Горизонтальные размеры: портал, перед авансцены, ширина коробки, ширина зала
  dxf.addLinearDim(-PW2, 0, PW2, 0, { offset: -0.65, label: `Портал ${fmtM(DIM.portal.width)} м`, layer: 'DIMS' });
  dxf.addLinearDim(-FW2, -FS.depth, FW2, -FS.depth, { offset: -0.75, label: `Перед авансцены ${fmtM(FS.frontWidth)} м`, layer: 'DIMS' });
  dxf.addLinearDim(-W, BACK, W, BACK, { offset: 1.55, label: `Ширина сценической коробки ${fmtM(DIM.box.width)} м`, layer: 'DIMS' });
  dxf.addLinearDim(-HW, HALL_BACK_D, HW, HALL_BACK_D, { offset: -2.95, label: `Ширина зрительного зала ${fmtM(DIM.hall.width)} м`, layer: 'DIMS' });

  // Вертикальные размеры: глубина коробки, авансцены, зала (вынесены левее полок штанкетов)
  dxf.addLinearDim(-W, 0, -W, BACK, { offset: 6.8, label: `Глубина сцены ${fmtM(BACK)} м`, layer: 'DIMS' });
  dxf.addLinearDim(-W, -FS.depth, -W, 0, { offset: 6.8, label: `Авансцена ${fmtM(FS.depth)} м`, layer: 'DIMS' });
  dxf.addLinearDim(-HW, HALL_BACK_D, -HW, 0, { offset: 6.3, label: `Зал до операторской ${fmtM(DIM.hall.portalToBoothWall)} м`, layer: 'DIMS' });

  // --- 9. Таблицы экспликации, высот механики, групп и штамп (SHEET_LEGEND) --
  const legX = 16.8;
  let curY = BACK + 1.5;

  // Таблица 1: Экспликация светового оборудования по типам
  const typeRows = [];
  let totalFix = 0;
  for (const [tKey, tDef] of Object.entries(TYPES)) {
    const allOfType = fixtures.filter((f) => f.type === tKey && !f.hidden);
    if (!allOfType.length) continue;
    totalFix += allOfType.length;
    const sp = SPECS[tKey] || {};
    typeRows.push([
      tKey,
      tDef.name,
      String(allOfType.length),
      sp.power || '-',
      sp.zoom || `${tDef.beam}°`,
      sp.weight || '-',
    ]);
  }
  typeRows.push(['ИТОГО', 'Всего приборов на плане', String(totalFix), '', '', '']);

  const t1 = dxf.addTable(legX, curY, {
    title: 'ЭКСПЛИКАЦИЯ СВЕТОВОГО ОБОРУДОВАНИЯ',
    headers: [
      { label: 'Код', width: 2.0, align: 'center' },
      { label: 'Модель прибора', width: 7.4, align: 'left' },
      { label: 'Шт', width: 1.9, align: 'center' },
      { label: 'Мощность', width: 4.5, align: 'center' },
      { label: 'Угол / Зум', width: 4.0, align: 'center' },
      { label: 'Вес', width: 4.0, align: 'center' },
    ],
    rows: typeRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t1.bottomY - 0.8;

  // Таблица 2: Ведомость подъёмов верхней механики (с текущими высотами)
  const kindLabel = { batten: 'Штанкет', light: 'Софит', track: 'Дорога занавеса', side: 'Боковой штанкет' };
  const rigRows = RIGGING.map((r) => [
    r.name,
    kindLabel[r.kind] || r.kind,
    r.kind === 'side' ? `x=${fmtM(r.x, 1)} (${fmtM(r.dFrom)}..${fmtM(r.dTo)})` : `${fmtM(r.d)} м`,
    `+${fmtM(heights[r.id])} м`,
    `${fmtM(r.min, 1)}..${fmtM(r.max, 1)} м`,
    r.control === 'left' ? 'Левая стена (рабочая галерея)' : r.control === 'right-front' ? 'Правый передний угол' : 'Узел подъёма (справа сзади)',
  ]);

  const t2 = dxf.addTable(legX, curY, {
    title: 'ВЕДОМОСТЬ ПОДЪЁМОВ ВЕРХНЕЙ МЕХАНИКИ (ТЕКУЩЕЕ ПОЛОЖЕНИЕ)',
    headers: [
      { label: '№', width: 1.6, align: 'center' },
      { label: 'Назначение', width: 4.2, align: 'left' },
      { label: 'От портала d', width: 4.0, align: 'center' },
      { label: 'Высота H', width: 3.0, align: 'center' },
      { label: 'Ход min..max', width: 3.4, align: 'center' },
      { label: 'Управление', width: 7.6, align: 'left' },
    ],
    rows: rigRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t2.bottomY - 0.8;

  // Таблица 3: Группы приборов и линии подключения (D / S)
  const grpRows = Object.entries(GROUPS).map(([gid, g]) => {
    const fl = fixtures.filter((f) => f.group === gid && !f.hidden);
    return [g.name, String(fl.length), g.ds];
  });
  const t3 = dxf.addTable(legX, curY, {
    title: 'ГРУППЫ ПРИБОРОВ И ЛИНИИ ПИТАНИЯ (D - ДИММЕРЫ, S - СВИТЧЕРЫ)',
    headers: [
      { label: 'Группа подвеса', width: 6.5, align: 'left' },
      { label: 'Приборов', width: 2.5, align: 'center' },
      { label: 'Номера линий по схеме', width: 14.8, align: 'left' },
    ],
    rows: grpRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t3.bottomY - 0.8;

  // Угловой штамп
  dxf.addTitleBlock(legX, curY - 2.2, {
    title: SHEET_TITLE,
    subtitle: 'План сцены, верхней механики и развеса светового оборудования (2D)',
    extra: `Приборов на плане: ${totalFix} шт. · Переносные: ${portable.mode === 'off' ? 'нет' : `${portable.count} шт. (${portable.mode === 'stand' ? 'на штативах' : 'на полу'})`}`,
    width: 23.8,
  });

  return dxf.toString();
}

// =============================================================================
//  2. ПРОДОЛЬНЫЙ РАЗРЕЗ 2D (fest-stage-section-2d.dxf)
//     X_cad = -d (слева арьер сцены -9.2, в центре портал 0, справа зал +18.0),
//     Y_cad = Y  (высота над уровнем планшета сцены 0,000)
// =============================================================================
export function buildSectionDXF(stage) {
  const { heights, portable, fixtures } = extractSnapshot(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });

  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_SECTION', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('AR_GALLERIES', { color: 4, ltype: 'DASHED' })
    .addLayer('RIG_SECTION', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('RIG_SOFFITS', { color: 30, ltype: 'CONTINUOUS' })
    .addLayer('RIG_CABLES', { color: 8, ltype: 'DASHED' })
    .addLayer('FIXTURES_SECTION', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('DIMS_SECTION', { color: 2, ltype: 'CONTINUOUS' })
    .addLayer('SHEET_LEGEND', { color: 7, ltype: 'CONTINUOUS' });

  // Перевод глубины d в горизонтальную координату разреза X_cad = -d
  const X = (d) => -d;

  const CEIL = DIM.box.ceiling; // 8.5
  const BACK = DIM.box.backWallD; // 9.2
  const PT = DIM.portal.thickness; // 0.25
  const FS = DIM.forestage; // depth 2.75, height 0.75
  const FSH = FS.height;
  const H = DIM.hall;
  const HALL_BACK_D = -H.portalToBoothWall; // -18.0
  const UPY = DIM.galleries.upperY; // 5.7
  const FRY = DIM.galleries.frontY; // 6.2
  const LOWY = DIM.galleries.lowerY; // 2.2
  const GATEY = DIM.galleries.overGateY; // 2.9
  const RAIL_H = DIM.galleries.railH; // 1.0

  // --- 1. Оси и координатная сетка разреза (0_AXES, 0_GRID) ------------------
  // Красная линия портала (d = 0 -> X_cad = 0) и уровень чистого пола планшета (Y = 0)
  dxf.addLine(0, -2.5, 0, CEIL + 3.2, { layer: '0_AXES' });
  dxf.addLine(X(BACK) - 1.5, 0, X(HALL_BACK_D - 2.6) + 1.2, 0, { layer: '0_AXES' });
  dxf.addText(0.12, CEIL + 2.8, 'КРАСНАЯ ЛИНИЯ ПОРТАЛА (d = 0)', { layer: '0_AXES', height: 0.18 });
  dxf.addText(X(BACK) - 1.4, 0.12, 'УРОВЕНЬ ПЛАНШЕТА СЦЕНЫ (±0,000)', { layer: '0_AXES', height: 0.17 });

  // Вертикальные линии сетки по глубине сцены (каждый 1 м)
  for (let d = -18; d <= 9; d++) {
    if (d !== 0) {
      dxf.addLine(X(d), -1.2, X(d), d >= 0 ? CEIL : DIM.hall.ceilingY, { layer: '0_GRID' });
    }
    if (d >= -3 || d % 2 === 0) {
      dxf.addText(X(d), -1.55, `${d > 0 ? '+' : ''}${d}`, {
        layer: '0_GRID', height: 0.15, align: 'center', valign: 'top',
      });
    }
  }
  // Горизонтальные линии сетки по высоте (каждый 1 м в пределах сцены)
  for (let y = 1; y <= 8; y++) {
    dxf.addLine(X(BACK), y, X(-FS.depth), y, { layer: '0_GRID' });
  }

  // --- 2. Архитектурный контур разреза (AR_SECTION) --------------------------
  // Планшет сцены (Y = 0 от задней стены d=9.2 до переднего края авансцены d=-2.75, без пола над приямком d=1.0..4.0)
  const pit = DIM.pit;
  dxf.addLine(X(BACK), 0, X(pit.toD), 0, { layer: 'AR_SECTION' });
  dxf.addLine(X(BACK), -0.08, X(pit.toD), -0.08, { layer: 'AR_SECTION' });
  dxf.addLine(X(pit.fromD), 0, X(-FS.depth), 0, { layer: 'AR_SECTION' });
  dxf.addLine(X(pit.fromD), -0.08, X(-FS.depth), -0.08, { layer: 'AR_SECTION' });

  // Приямок у правой стены в разрезе (d = 1.0..4.0, глубина -1.0 м)
  dxf.addPolyline([
    [X(pit.toD), 0], [X(pit.toD), -pit.depth],
    [X(pit.fromD), -pit.depth], [X(pit.fromD), 0],
  ], { layer: 'AR_SECTION' });
  for (let i = 1; i < pit.steps; i++) {
    const stepD = pit.toD - i * 0.3;
    const stepY = -(i * pit.depth) / pit.steps;
    dxf.addLine(X(stepD), -pit.depth, X(stepD), stepY, { layer: 'AR_SECTION' });
  }
  dxf.addText(X((pit.fromD + pit.toD) / 2), -pit.depth + 0.15, 'Приямок -1,00 м', {
    layer: 'AR_SECTION', height: 0.15, align: 'center',
  });

  // Срез авансцены и боковая лестница (5 ступеней от -0.75 до 0)
  dxf.addLine(X(-FS.depth), 0, X(-FS.depth), -FSH, { layer: 'AR_SECTION' });
  const stSteps = FS.stairs.steps;
  for (let k = 0; k < stSteps; k++) {
    const d0 = -FS.depth + (k * 1.2) / stSteps;
    const d1 = -FS.depth + ((k + 1) * 1.2) / stSteps;
    const yTop = -FSH + ((k + 1) * FSH) / stSteps;
    dxf.addPolyline([[X(d0), yTop - FSH / stSteps], [X(d0), yTop], [X(d1), yTop]], { layer: 'AR_SECTION', ltype: 'DASHED' });
  }

  // Пол зрительного зала: ровный участок перед 1-м рядом + гребёнка 15 рядов (уклон 9°)
  const dRow0 = rowFrontD(0);
  dxf.addLine(X(-FS.depth), -FSH, X(dRow0), -FSH, { layer: 'AR_SECTION' });
  const hallProfilePts = [[X(-FS.depth), -FSH], [X(dRow0), -FSH]];
  for (let r = 0; r < H.rows; r++) {
    const yRow = -FSH + r * H.rowPitch * RAKE;
    const d0 = rowFrontD(r);
    const d1 = r === H.rows - 1 ? HALL_BACK_D : rowFrontD(r) - H.rowPitch;
    hallProfilePts.push([X(d0), yRow], [X(d1), yRow]);
    // Силуэт кресла в разрезе
    const dSeat = d0 - 0.42;
    dxf.addRect(X(dSeat + 0.18), yRow, X(dSeat - 0.18), yRow + 0.44, { layer: 'AR_GALLERIES' });
    dxf.addLine(X(dSeat - 0.16), yRow + 0.44, X(dSeat - 0.24), yRow + 0.92, { layer: 'AR_GALLERIES' });
    if ((r + 1) % 2 === 1 || r === H.rows - 1) {
      dxf.addText(X(dSeat), yRow - 0.22, `Р${r + 1}`, { layer: 'AR_SECTION', height: 0.14, align: 'center' });
    }
  }
  dxf.addPolyline(hallProfilePts, { layer: 'AR_SECTION' });

  // Задняя стена сцены (d = 9.2), ворота (H = 2.6) и потолок сценической коробки (Y = 8.5)
  dxf.addRect(X(BACK) - 0.3, 0, X(BACK), CEIL, { layer: 'AR_SECTION' });
  dxf.addRect(X(BACK) - 0.3, 0, X(BACK), DIM.openings.gate.height, { layer: 'AR_GALLERIES' });
  dxf.addText(X(BACK) - 0.4, DIM.openings.gate.height / 2, `Ворота В=${fmtM(DIM.openings.gate.height, 1)} м`, {
    layer: 'AR_SECTION', height: 0.16, align: 'right', valign: 'middle',
  });
  // Потолок сцены (от d = 9.2 до чердака над авансценой d = -2.9)
  dxf.addRect(X(BACK) - 0.3, CEIL, X(-2.9), CEIL + 0.25, { layer: 'AR_SECTION' });
  dxf.addLine(X(-2.9), DIM.decoCeilingY, X(-2.9), CEIL, { layer: 'AR_SECTION' });

  // Портальная стена (d = 0..0.25): зеркало портала до +5.15, перемычка от +5.15 до +6.10 / +8.50
  dxf.addLine(X(0), 0, X(0), DIM.portal.height, { layer: 'AR_SECTION', ltype: 'DASHED' });
  dxf.addLine(X(PT), 0, X(PT), DIM.portal.height, { layer: 'AR_SECTION', ltype: 'DASHED' });
  dxf.addRect(X(PT), DIM.portal.height, X(0), CEIL, { layer: 'AR_SECTION' });
  dxf.addText(X(PT / 2), DIM.portal.height - 0.28, `Зеркало портала +${fmtM(DIM.portal.height)} м`, {
    layer: 'AR_SECTION', height: 0.17, align: 'center',
  });

  // Строительный ригель (d = 3.55, ширина 0.30, низ +6.40 до потолка +8.50)
  const rg0 = DIM.rigel.d - DIM.rigel.width / 2, rg1 = DIM.rigel.d + DIM.rigel.width / 2;
  dxf.addRect(X(rg1), DIM.rigel.bottomY, X(rg0), CEIL, { layer: 'AR_SECTION' });
  // Диагональная штриховка сечения ригеля
  dxf.addLine(X(rg1), DIM.rigel.bottomY, X(rg0), CEIL, { layer: 'AR_SECTION' });
  dxf.addLine(X(rg0), DIM.rigel.bottomY, X(rg1), CEIL, { layer: 'AR_SECTION' });
  dxf.addText(X(DIM.rigel.d) - 0.25, 7.65, `Ригель +${fmtM(DIM.rigel.bottomY)} м`, {
    layer: 'AR_SECTION', height: 0.15, align: 'right',
  });

  // Профиль потолка зрительного зала (деко-потолок +6.10 -> подъём к +7.50 -> стена операторской)
  const ceilPts = HALL_CEIL_PROFILE.map(([d, y]) => [X(d), y]);
  dxf.addPolyline(ceilPts, { layer: 'AR_SECTION' });

  // Задняя стена зала (d = -18.0) и будка операторской со световым окном
  const backY = HALL_BACK_FLOOR_Y;
  const win = DIM.hallRig.booth;
  const wy0 = backY + win.windowFromY, wy1 = wy0 + win.windowH;
  dxf.addLine(X(HALL_BACK_D), backY, X(HALL_BACK_D), wy0, { layer: 'AR_SECTION' });
  dxf.addLine(X(HALL_BACK_D), wy1, X(HALL_BACK_D), DIM.hall.ceilingY, { layer: 'AR_SECTION' });
  // Стекло окна операторской
  dxf.addRect(X(HALL_BACK_D) - 0.04, wy0, X(HALL_BACK_D) + 0.04, wy1, { layer: 'AR_GALLERIES' });
  // Комната операторской (глубина 2.4 м за стеной зала)
  dxf.addRect(X(HALL_BACK_D), backY + 1.0, X(HALL_BACK_D - 2.4), backY + 3.6, { layer: 'AR_SECTION' });
  dxf.addText(X(HALL_BACK_D - 1.2), backY + 2.3, 'Операторская', {
    layer: 'AR_SECTION', height: 0.18, align: 'center', valign: 'middle',
  });

  // --- 3. Галереи, мостики, ложи и выносные мосты в разрезе (AR_GALLERIES) ---
  const GB = BACK_GALLERY_FRONT_D; // 8.3
  const fToD = DIM.galleries.frontToD; // 0.8
  // Задняя верхняя галерея (+5.70) и её ограждение (+6.70)
  dxf.addRect(X(BACK), UPY - 0.12, X(GB), UPY, { layer: 'AR_GALLERIES' });
  dxf.addLine(X(GB), UPY, X(GB), UPY + RAIL_H, { layer: 'AR_GALLERIES' });
  // Боковые верхние галереи в проекции (+5.70 от d=0.8 до d=8.3)
  dxf.addLine(X(GB), UPY, X(fToD), UPY, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  dxf.addLine(X(GB), UPY + RAIL_H, X(fToD), UPY + RAIL_H, { layer: 'AR_GALLERIES', ltype: 'DASHED' });

  // Передний мостик над порталом (+6.20, d=0..0.8)
  dxf.addRect(X(fToD), FRY - 0.12, X(0), FRY, { layer: 'AR_GALLERIES' });
  dxf.addLine(X(fToD), FRY, X(fToD), FRY + RAIL_H, { layer: 'AR_GALLERIES' });

  // Нижняя задняя галерея (+2.20 и участок над воротами +2.90)
  dxf.addRect(X(BACK), LOWY - 0.1, X(GB), LOWY, { layer: 'AR_GALLERIES' });
  dxf.addLine(X(GB), LOWY, X(GB), LOWY + RAIL_H, { layer: 'AR_GALLERIES' });
  dxf.addRect(X(BACK), GATEY - 0.1, X(GB), GATEY, { layer: 'AR_GALLERIES', ltype: 'DASHED' });

  // Площадка узла подъёма (+2.20, d=7.2..9.2) и решётка над приямком (d=1.0..4.0, этажи 2.1 и 4.5)
  const padD0 = BACK - DIM.liftNode.padSize;
  dxf.addRect(X(BACK), DIM.liftNode.padY - 0.08, X(padD0), DIM.liftNode.padY, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  for (const ly of DIM.rack.levels) {
    dxf.addLine(X(DIM.rack.toD), ly, X(DIM.rack.fromD), ly, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  }

  // Выносные мосты в зале М1 (d=-7.0, Y=6.4) и М2 (d=-12.0, Y=6.8)
  for (const [lbl, br] of [['Мост 1 (+6,40)', DIM.hallRig.bridge1], ['Мост 2 (+6,80)', DIM.hallRig.bridge2]]) {
    dxf.addRect(X(br.d + 0.15), br.y - 0.15, X(br.d - 0.15), br.y + 0.15, { layer: 'AR_GALLERIES' });
    dxf.addText(X(br.d), br.y + 0.32, lbl, { layer: 'AR_GALLERIES', height: 0.16, align: 'center' });
  }
  // Рамы лож Л1/П1 (d=-6.2, Y=4.2) и Л2/П2 (d=-12.5, Y=4.6), прострелы (d=-1.6, Y=1.2..4.2)
  for (const [lbl, bx] of [['Ложа 1', DIM.hallRig.boxes.L1], ['Ложа 2', DIM.hallRig.boxes.L2]]) {
    dxf.addRect(X(bx.d + bx.w / 2), bx.y - bx.h / 2, X(bx.d - bx.w / 2), bx.y + bx.h / 2, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
    dxf.addText(X(bx.d), bx.y + bx.h / 2 + 0.18, lbl, { layer: 'AR_GALLERIES', height: 0.15, align: 'center' });
  }
  const tw = DIM.hallRig.sideTowers.L;
  dxf.addRect(X(tw.d + 0.2), tw.y, X(tw.d - 0.2), tw.y + tw.h, { layer: 'AR_GALLERIES', ltype: 'DASHED' });
  dxf.addText(X(tw.d), tw.y + tw.h + 0.18, 'Прострелы', { layer: 'AR_GALLERIES', height: 0.15, align: 'center' });

  // --- 4. Верхняя механика в разрезе на ТЕКУЩИХ высотах ----------------------
  const crossRigs = RIGGING.filter((r) => r.kind !== 'side').sort((a, b) => a.d - b.d);
  crossRigs.forEach((r, idx) => {
    const hVal = heights[r.id];
    const rx = X(r.d);
    const layer = r.kind === 'light' ? 'RIG_SOFFITS' : 'RIG_SECTION';
    const topY = r.d < PT ? DIM.decoCeilingY : CEIL - 0.08;

    // Вертикальный трос подвеса от колосников до текущей высоты трубы
    dxf.addLine(rx, hVal, rx, topY, { layer: 'RIG_CABLES', ltype: 'DASHED' });
    // Засечки нижнего и верхнего пределов хода (min / max)
    dxf.addLine(rx - 0.08, r.min, rx + 0.08, r.min, { layer: 'RIG_CABLES' });
    dxf.addLine(rx - 0.08, r.max, rx + 0.08, r.max, { layer: 'RIG_CABLES' });

    // Сечение трубы / софита / фермы занавеса на текущей высоте hVal
    if (r.kind === 'light') {
      dxf.addCircle(rx, hVal, 0.07, { layer });
      dxf.addRect(rx - 0.18, hVal - 0.36, rx + 0.18, hVal + 0.05, { layer });
    } else if (r.kind === 'track') {
      dxf.addRect(rx - 0.1, hVal - 0.1, rx + 0.1, hVal + 0.1, { layer });
    } else {
      dxf.addCircle(rx, hVal, 0.05, { layer });
    }

    // Разведение выносных флажков над потолком в 4 яруса («лесенкой»), чтобы подписи не слипались
    const tier = idx % 4;
    const labelY = CEIL + 0.65 + tier * 0.55;
    dxf.addLine(rx, topY, rx, labelY, { layer });
    dxf.addCircle(rx, labelY, 0.04, { layer });
    dxf.addText(rx, labelY + 0.08, `${r.name} (+${fmtM(hVal)})`, {
      layer, height: 0.15, align: 'center', valign: 'bottom',
    });
  });

  // Боковые штанкеты Б1 и Б2 в разрезе (продольные трубы вдоль глубины сцены)
  // Разносим их подписи вдоль продольной трубы (Б1 ближе к порталу сверху, Б2 ближе к арьеру снизу),
  // чтобы исключить взаимное наложение текста.
  RIGGING.filter((it) => it.kind === 'side').forEach((r, sIdx) => {
    const hVal = heights[r.id];
    dxf.addLine(X(r.dTo), hVal, X(r.dFrom), hVal, { layer: 'RIG_SECTION', ltype: 'DASHED' });
    const labelD = sIdx === 0 ? r.dFrom + 1.25 : r.dTo - 1.25;
    const labelY = sIdx === 0 ? hVal + 0.16 : hVal - 0.28;
    dxf.addText(X(labelD), labelY, `${r.name} (+${fmtM(hVal)} м)`, {
      layer: 'RIG_SECTION', height: 0.15, align: 'center',
    });
  });

  // --- 5. Корпуса световых приборов в продольном разрезе (всегда в выключенном состоянии, без лучей) ---
  const drawnPos = new Set();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const posKey = `${f.worldPos.d.toFixed(2)}|${f.worldPos.y.toFixed(2)}`;
    if (drawnPos.has(posKey)) continue;
    drawnPos.add(posKey);
    const px = X(f.worldPos.d), py = f.worldPos.y;
    dxf.addRect(px - 0.12, py - 0.18, px + 0.12, py + 0.08, { layer: 'FIXTURES_SECTION' });
  }

  // Переносные приборы на планшете в разрезе (если включены)
  if (portable.mode !== 'off') {
    dxf.addText(
      X((PORTABLE.dFrom + PORTABLE.dTo) / 2),
      (portable.mode === 'stand' ? PORTABLE.standY : PORTABLE.floorY) + 0.25,
      `Переносные ETC 50° (${portable.count} шт., ${portable.mode === 'stand' ? 'на штативах +1,90 м' : 'на полу +0,24 м'})`,
      { layer: 'FIXTURES_SECTION', height: 0.16, align: 'center' },
    );
  }

  // --- 6. Высотные отметки (▽) и размерные цепочки разреза (DIMS_SECTION) ----
  const elevXLeft = X(BACK) - 1.8;
  const elevXRight = X(HALL_BACK_D - 2.4) + 1.0;

  // Отметки по сценической коробке (слева) — близкие уровни разнесены по высоте полки
  dxf.addElevationMark(elevXLeft, -pit.depth, '-1,000 (Приямок)', { side: 'left' });
  dxf.addElevationMark(elevXLeft, 0, '±0,000 (Планшет)', { side: 'left' });
  dxf.addElevationMark(elevXLeft, LOWY, '+2,200 (Ниж. галерея)', { side: 'left', stemH: 0.22 });
  dxf.addElevationMark(elevXLeft, GATEY, '+2,900 (Над воротами)', { side: 'left', stemH: 0.32 });
  dxf.addElevationMark(elevXLeft, DIM.portal.height, '+5,150 (Портал)', { side: 'left', stemH: 0.2 });
  dxf.addElevationMark(elevXLeft, UPY, '+5,700 (Верх. галерея)', { side: 'left', stemH: 0.25 });
  dxf.addElevationMark(elevXLeft, DIM.rigel.bottomY, '+6,400 (Низ ригеля)', { side: 'left', stemH: 0.35 });
  dxf.addElevationMark(elevXLeft, CEIL, '+8,500 (Потолок сцены)', { side: 'left' });

  // Отметки по зрительному залу (справа)
  dxf.addElevationMark(elevXRight, -FSH, '-0,750 (Пол зала 1 р.)', { side: 'right' });
  dxf.addElevationMark(elevXRight, HALL_BACK_FLOOR_Y, `+${fmtM(HALL_BACK_FLOOR_Y, 3)} (Пол 15 р.)`, { side: 'right' });
  dxf.addElevationMark(elevXRight, DIM.decoCeilingY, '+6,100 (Деко-потолок)', { side: 'right' });
  dxf.addElevationMark(elevXRight, DIM.hall.ceilingY, '+7,500 (Потолок зала)', { side: 'right' });

  // Габаритные горизонтальные размеры внизу разреза
  dxf.addLinearDim(X(BACK), -1.8, X(0), -1.8, {
    offset: -1.1, label: `Глубина сцены от портала ${fmtM(BACK)} м`, layer: 'DIMS_SECTION',
  });
  dxf.addLinearDim(X(0), -1.8, X(-FS.depth), -1.8, {
    offset: -1.1, label: `Авансцена ${fmtM(FS.depth)} м`, layer: 'DIMS_SECTION',
  });
  dxf.addLinearDim(X(-FS.depth), -1.8, X(HALL_BACK_D), -1.8, {
    offset: -1.1, label: `Зрительный зал ${fmtM(DIM.hall.portalToBoothWall - FS.depth)} м`, layer: 'DIMS_SECTION',
  });
  dxf.addLinearDim(X(BACK), -3.1, X(-FS.depth), -3.1, {
    offset: -0.9, label: `Общая глубина сцены с авансценой ${fmtM(BACK + FS.depth)} м (≈12 м)`, layer: 'DIMS_SECTION',
  });

  // --- 7. Ведомость высот подъёмов и штамп чертежа (SHEET_LEGEND) ------------
  const tableX = X(HALL_BACK_D - 2.4) + 5.2;
  const kindLabel = { batten: 'Штанкет', light: 'Софит', track: 'Дорога занавеса', side: 'Боковой штанкет' };
  const rigRows = RIGGING.map((r) => [
    r.name,
    kindLabel[r.kind] || r.kind,
    r.kind === 'side' ? `${fmtM(r.dFrom)}..${fmtM(r.dTo)} м` : `${fmtM(r.d)} м`,
    `+${fmtM(heights[r.id])} м`,
    `${fmtM(r.min, 1)}..${fmtM(r.max, 1)} м`,
  ]);

  const tbl = dxf.addTable(tableX, CEIL + 2.5, {
    title: 'ВЕДОМОСТЬ ВЫСОТ ПОДЪЁМОВ НА РАЗРЕЗЕ',
    headers: [
      { label: '№', width: 1.4, align: 'center' },
      { label: 'Тип подъёма', width: 3.6, align: 'left' },
      { label: 'Глубина d', width: 2.8, align: 'center' },
      { label: 'Текущая H', width: 2.6, align: 'center' },
      { label: 'Пределы хода', width: 2.8, align: 'center' },
    ],
    rows: rigRows,
    layer: 'SHEET_LEGEND',
  });

  dxf.addTitleBlock(tableX, tbl.bottomY - 3.0, {
    title: SHEET_TITLE,
    subtitle: 'Продольный разрез сцены и зрительного зала по центральной оси (2D)',
    extra: 'Отметки высот от уровня чистого пола планшета сцены (±0,000)',
    width: 13.2,
  });

  return dxf.toString();
}
