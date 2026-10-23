// =============================================================================
//  ГЕНЕРАТОР 2D-ЧЕРТЕЖЕЙ КАМЕРНОЙ СЦЕНЫ ФЭСТ В ФОРМАТЕ AUTOCAD DXF:
//    1. buildPlanDXF(stage)    — План сцены, зрительного зала, ферм и развеса света
//    2. buildSectionDXF(stage) — Продольный разрез сцены и зрительного зала
//
//  Все габариты берутся из единого источника правды (config/dimensions.js, config/fixtures.js).
// =============================================================================
import {
  CHAMBER, ALL_TRUSSES, rowFloorY, rowFrontD, chamberSeatLayout, triHeight,
} from '../config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, DMX_BOXES } from '../config/fixtures.js';
import { DxfWriter } from '../../../export/dxfWriter.js';

const SHEET_TITLE = 'МЫТИЩИНСКИЙ ТЕАТР ДРАМЫ И КОМЕДИИ «ФЭСТ» · КАМЕРНАЯ СЦЕНА';

const fmtM = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');

function extractSnapshot(stage) {
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

function registerFixtureBlocks(dxf) {
  dxf.addBlock('FX_SPOT', (b) => {
    b.addRect(-0.13, -0.13, 0.13, 0.13);
    b.addRect(-0.08, -0.08, 0.08, 0.08);
  });
  dxf.addBlock('FX_WASH', (b) => {
    b.addRect(-0.14, -0.11, 0.14, 0.11);
    b.addRect(-0.09, -0.07, 0.09, 0.07);
  });
  dxf.addBlock('FX_BEAM', (b) => {
    b.addRect(-0.12, -0.12, 0.12, 0.12);
    b.addRect(-0.07, -0.07, 0.07, 0.07);
  });
  dxf.addBlock('FX_LEDPAR', (b) => {
    b.addRect(-0.13, -0.1, 0.13, 0.1);
    b.addLine(-0.16, 0, 0.16, 0);
  });
  dxf.addBlock('FX_PROFILE', (b) => {
    b.addRect(-0.09, -0.16, 0.09, 0.16);
    b.addLine(-0.12, 0, 0.12, 0);
  });
  dxf.addBlock('FX_FRESNEL', (b) => {
    b.addRect(-0.12, -0.13, 0.12, 0.13);
    b.addLine(-0.12, 0.08, 0.12, 0.08);
  });
  dxf.addBlock('FX_PAR', (b) => {
    b.addRect(-0.11, -0.11, 0.11, 0.11);
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
};

// =============================================================================
//  1. ПЛАН СЦЕНЫ 2D (fest-chamber-plan-2d.dxf)
//     X_cad = X (поперёк зала), Y_cad = d (глубина от линии портала d = 0)
// =============================================================================
export function buildPlanDXF(stage) {
  const { fixtures } = extractSnapshot(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });

  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_WALLS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('AR_RIGEL', { color: 9, ltype: 'DASHED' })
    .addLayer('AR_DUCTS', { color: 4, ltype: 'CONTINUOUS' })
    .addLayer('AR_HALL', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_HALL_SEATS', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('TRUSSES', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('TRUSS_EQUIPMENT', { color: 6, ltype: 'CONTINUOUS' })
    .addLayer('FIXTURES', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('FIXTURE_LABELS', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('DIMS', { color: 2, ltype: 'CONTINUOUS' })
    .addLayer('SHEET_LEGEND', { color: 7, ltype: 'CONTINUOUS' });

  registerFixtureBlocks(dxf);

  const S = CHAMBER.stage;
  const H = CHAMBER.hall;
  const COL = CHAMBER.columns;
  const RG = CHAMBER.rigels;
  const DUCT = CHAMBER.ducts;
  const NICHE = CHAMBER.niche;
  const DOORS = CHAMBER.doors;
  const EQ = CHAMBER.equipment;

  // --- 1. Оси и метровая сетка (0_AXES, 0_GRID) ------------------------------
  dxf.addLine(0, H.backWallD - 1.5, 0, NICHE.d1 + 1.0, { layer: '0_AXES' });
  dxf.addLine(S.x0 - 1.2, 0, H.x1 + 1.2, 0, { layer: '0_AXES' });
  dxf.addText(0.15, NICHE.d1 + 0.65, 'ОСЬ ЗАЛА (X = 0)', { layer: '0_AXES', height: 0.18 });
  dxf.addText(S.x0 - 1.1, 0.12, 'НУЛЕВАЯ ЛИНИЯ ПОРТАЛА (d = 0)', { layer: '0_AXES', height: 0.18 });

  for (let x = -8; x <= 5; x++) {
    if (x !== 0) {
      const dMin = x < H.x0 ? 0 : H.firstStepD;
      dxf.addLine(x, dMin, x, S.d1, { layer: '0_GRID' });
    }
    if (x % 2 === 0) {
      dxf.addText(x, S.d1 + 0.35, `${x > 0 ? '+' : ''}${x}`, { layer: '0_GRID', height: 0.16, align: 'center', valign: 'bottom' });
    }
  }
  for (let d = -6; d <= 9; d++) {
    if (d !== 0) {
      const xMin = d >= 0 ? S.x0 : H.x0;
      const xMax = d >= 0 ? S.x1 : H.x1;
      dxf.addLine(xMin, d, xMax, d, { layer: '0_GRID' });
    }
    dxf.addText(S.x0 - 0.35, d, `${d > 0 ? '+' : ''}${d} м`, { layer: '0_GRID', height: 0.15, align: 'right', valign: 'middle' });
  }

  // --- 2. Стены коробки, карман, задняя ниша, колонны, двери (AR_WALLS) ------
  const wallT = 0.25;
  // Левая стена сцены (x = -8,35, d = 0..11,10)
  dxf.addRect(S.x0 - wallT, 0, S.x0, NICHE.d1 + wallT, { layer: 'AR_WALLS' });
  // Передняя стенка левого кармана (d = 0, x = -8,35..-5,85) с дверью 2,00 м
  dxf.addRect(DOORS.pocket.a1, -wallT, H.x0, 0, { layer: 'AR_WALLS' });
  dxf.addLine(DOORS.pocket.a0, 0, DOORS.pocket.a1, 0.55, { layer: 'AR_WALLS' });
  dxf.addText((DOORS.pocket.a0 + DOORS.pocket.a1) / 2, -0.28, 'Дверь кармана 2,0×2,15', { layer: 'AR_WALLS', height: 0.14, align: 'center' });

  // Правая стена сцены (x = +5,65, d = 0..9,75)
  dxf.addRect(S.x1, 0, S.x1 + wallT, S.d1 + wallT, { layer: 'AR_WALLS' });

  // Задняя стена сцены (d = +9,75) и задняя левая ниша (x = -8,35..-6,10, d = 9,75..11,10)
  dxf.addRect(NICHE.x1, S.d1, DOORS.stageBackRight.a0, S.d1 + wallT, { layer: 'AR_WALLS' });
  dxf.addRect(DOORS.stageBackRight.a1, S.d1, S.x1, S.d1 + wallT, { layer: 'AR_WALLS' });
  dxf.addLine(DOORS.stageBackRight.a0, S.d1, DOORS.stageBackRight.a1, S.d1 + 0.5, { layer: 'AR_WALLS' });
  dxf.addText((DOORS.stageBackRight.a0 + DOORS.stageBackRight.a1) / 2, S.d1 + 0.35, 'Дверь 0,9×1,9', { layer: 'AR_WALLS', height: 0.14, align: 'center' });

  // Контур задней левая ниши и 3 двери в ней
  dxf.addRect(NICHE.x0 - wallT, NICHE.d1, NICHE.x1 + wallT, NICHE.d1 + wallT, { layer: 'AR_WALLS' });
  dxf.addRect(NICHE.x1, S.d1, NICHE.x1 + wallT, NICHE.d1 + wallT, { layer: 'AR_WALLS' });
  dxf.addText((NICHE.x0 + NICHE.x1) / 2, (NICHE.d0 + NICHE.d1) / 2, 'Ниша выхода (3 двери)', { layer: 'AR_WALLS', height: 0.14, align: 'center', valign: 'middle' });

  // 4 несущие колонны
  for (const [cName, c] of [
    ['Кол. ПЛ', COL.frontLeft],
    ['Кол. ЗЛ', COL.backLeft],
    ['Кол. ПП', COL.frontRight],
    ['Кол. ЗП', COL.backRight],
  ]) {
    dxf.addRect(c.x0, c.d0, c.x1, c.d1, { layer: 'AR_WALLS' });
    dxf.addLine(c.x0, c.d0, c.x1, c.d1, { layer: 'AR_WALLS' });
    dxf.addLine(c.x0, c.d1, c.x1, c.d0, { layer: 'AR_WALLS' });
    dxf.addText((c.x0 + c.x1) / 2, c.d1 + 0.15, cName, { layer: 'AR_WALLS', height: 0.13, align: 'center' });
  }

  // --- 3. Ригели (AR_RIGEL) и инженерные короба + кондиционеры (AR_DUCTS) ----
  dxf.addRect(RG.front.x0, RG.front.d0, RG.front.x1, RG.front.d1, { layer: 'AR_RIGEL', ltype: 'DASHED' });
  dxf.addText(0, (RG.front.d0 + RG.front.d1) / 2, 'ПЕРЕДНИЙ РИГЕЛЬ (низ +3,60 м)', { layer: 'AR_RIGEL', height: 0.15, align: 'center', valign: 'middle' });
  dxf.addRect(RG.back.x0, RG.back.d0, RG.back.x1, RG.back.d1, { layer: 'AR_RIGEL', ltype: 'DASHED' });
  dxf.addRect(RG.back.pocketX0, RG.back.d0, RG.back.pocketX1, RG.back.d1, { layer: 'AR_RIGEL', ltype: 'DASHED' });
  dxf.addText(0, (RG.back.d0 + RG.back.d1) / 2, 'ЗАДНИЙ РИГЕЛЬ d=6,15..6,60 м (низ +3,60 м)', { layer: 'AR_RIGEL', height: 0.15, align: 'center', valign: 'middle' });

  // Венткороб и электрокороб
  dxf.addRect(DUCT.vent.x0, DUCT.vent.d0, DUCT.vent.x1, DUCT.vent.d1, { layer: 'AR_DUCTS' });
  dxf.addText((DUCT.vent.x0 + DUCT.vent.x1) / 2, (DUCT.vent.d0 + DUCT.vent.d1) / 2, 'Венткороб (H=4,40)', { layer: 'AR_DUCTS', height: 0.13, rotation: 90, align: 'center', valign: 'middle' });
  dxf.addRect(DUCT.elecHigh.x0, DUCT.elecHigh.d0, DUCT.elecHigh.x1, DUCT.elecHigh.d1, { layer: 'AR_DUCTS' });
  dxf.addRect(DUCT.elecLow.x0, DUCT.elecLow.d0, DUCT.elecLow.x1, DUCT.elecLow.d1, { layer: 'AR_DUCTS' });
  dxf.addText(DUCT.elecHigh.x1 + 0.15, (DUCT.elecHigh.d0 + DUCT.elecLow.d1) / 2, 'Электрокороб', { layer: 'AR_DUCTS', height: 0.13, rotation: 90, align: 'center', valign: 'middle' });

  // Потолочные кондиционеры
  for (const ac of EQ.acUnits) {
    dxf.addRect(ac.x0, ac.d0, ac.x1, ac.d1, { layer: 'AR_DUCTS', ltype: 'DASHED' });
    dxf.addText((ac.x0 + ac.x1) / 2, (ac.d0 + ac.d1) / 2, 'Кондиционер 1×1 м', { layer: 'AR_DUCTS', height: 0.12, align: 'center', valign: 'middle' });
  }

  // --- 4. Зрительный зал, ступени амфитеатра, 102 кресла, лестница и операторская (AR_HALL) ---
  dxf.addLine(H.x0, 0, H.x0, H.backWallD, { layer: 'AR_HALL' });
  dxf.addLine(H.x1, COL.frontRight.d0, H.x1, H.backWallD, { layer: 'AR_HALL' });
  dxf.addLine(H.x0, H.backWallD, H.x1, H.backWallD, { layer: 'AR_HALL' });
  // Входная дверь в зал слева (d = -4,15..-2,75) и дверь в заднем правом углу зала (d = -6,65, x = 4,75..5,65)
  dxf.addLine(H.x0, DOORS.hallEntry.a0, H.x0 - 0.6, DOORS.hallEntry.a1, { layer: 'AR_HALL' });
  dxf.addText(H.x0 - 0.25, (DOORS.hallEntry.a0 + DOORS.hallEntry.a1) / 2, 'Вход 1,4×2,0', { layer: 'AR_HALL', height: 0.14, rotation: 90, align: 'center' });
  dxf.addLine(DOORS.hallBackRight.a0, H.backWallD, DOORS.hallBackRight.a1, H.backWallD - 0.45, { layer: 'AR_HALL' });
  dxf.addText((DOORS.hallBackRight.a0 + DOORS.hallBackRight.a1) / 2, H.backWallD - 0.3, 'Дверь 0,9×1,9', { layer: 'AR_HALL', height: 0.13, align: 'center' });

  // Боковая лестница слева (x = -5,85..-4,85, d = -4,15..-5,65)
  const st = H.sideStairs;
  dxf.addRect(st.x0, st.dEnd, st.x1, st.dStart, { layer: 'AR_HALL' });
  const stStep = (st.dStart - st.dEnd) / (st.steps - 1);
  for (let k = 1; k < st.steps - 1; k++) {
    const sd = st.dStart - k * stStep;
    dxf.addLine(st.x0, sd, st.x1, sd, { layer: 'AR_HALL' });
  }
  dxf.addLine(H.tierX0, H.firstStepD, H.tierX0, H.topPlatformD1, { layer: 'AR_HALL' });

  // Линии ступеней рядов 2–7 и подписи рядов
  for (let r = 0; r < H.rows; r++) {
    const yRow = rowFloorY(r);
    const dStep = r === 0 ? H.firstStepD : H.firstStepD - (r - 1) * H.stepDepth;
    if (r >= 1) dxf.addLine(H.tierX0, dStep, H.tierX1, dStep, { layer: 'AR_HALL' });
    const dRowText = rowFrontD(r) - 0.35;
    dxf.addText(H.x1 + 0.3, dRowText, `Р${r + 1} (+${fmtM(yRow)})`, { layer: 'AR_HALL', height: 0.14, align: 'left', valign: 'middle' });
  }

  // Контуры всех 102 кресел (AR_HALL_SEATS)
  const { seats } = chamberSeatLayout(CHAMBER);
  for (const s of seats) {
    const hw = (s.folding ? H.foldingPitch : H.seatPitch) * 0.42;
    dxf.addRect(s.x - hw, s.d - 0.38, s.x + hw, s.d, { layer: 'AR_HALL_SEATS' });
  }

  // Операторская будка (x = -2,30..+2,30, d = -6,65..-4,95, уровень +1,50 м)
  const B = H.booth;
  dxf.addRect(B.x0, B.d0, B.x1, B.d1, { layer: 'AR_HALL' });
  dxf.addLine(-B.windowW / 2, B.d1, B.windowW / 2, B.d1, { layer: 'AR_WALLS' });
  dxf.addText(0, (B.d0 + B.d1) / 2, 'ОПЕРАТОРСКАЯ (4,60×1,70 м, +1,50 м)', { layer: 'AR_HALL', height: 0.18, align: 'center', valign: 'middle' });

  // --- 5. Подвесные фермы Ф1–Ф9 и ЗФ1–ЗФ3 + П-образный подвес авансцены, дорога занавеса и акустика
  const halfSide = CHAMBER.trusses.side / 2;
  ALL_TRUSSES.forEach((tr, idx) => {
    dxf.addRect(tr.x0, tr.d - halfSide, tr.x1, tr.d + halfSide, { layer: 'TRUSSES' });
    dxf.addLine(tr.x0, tr.d, tr.x1, tr.d, { layer: 'TRUSSES', ltype: 'DASHED' });
    const side = idx % 2 === 0 ? -1 : 1;
    const xStart = side < 0 ? tr.x0 : tr.x1;
    const xShelf = side < 0 ? S.x0 - 1.5 : H.x1 + 1.5;
    dxf.addLeaderLabel(xStart, tr.d, xShelf, tr.d, `${tr.name} (d=${fmtM(tr.d)}, H=+${fmtM(CHAMBER.trusses.bottomY)})`, {
      layer: 'TRUSSES', textHeight: 0.15, shelfLen: 2.2,
    });
  });

  // Прямоугольные рамки-крепления сразу за передними колоннами (d = +0,08 м) для приборов 17+122 и 19+123
  const pf = CHAMBER.trusses.prosceniumFrame;
  for (const sx of [pf.leftX, pf.rightX]) {
    dxf.addRect(sx - pf.dropHalfW, pf.d - 0.08, sx + pf.dropHalfW, pf.d + 0.08, { layer: 'TRUSSES' });
  }
  dxf.addLeaderLabel(pf.rightX + pf.dropHalfW, pf.d, H.x1 + 1.5, pf.d, `Крепления за колоннами (d=+${fmtM(pf.d)}, H=+2,65..3,60)`, {
    layer: 'TRUSSES', textHeight: 0.14, shelfLen: 2.8,
  });

  // Дорога занавеса и мониторы на Ф1, портальные колонки на Ф3
  const ct = EQ.curtainTrack;
  dxf.addLine(ct.x0, ct.d - 0.04, ct.x1, ct.d - 0.04, { layer: 'TRUSS_EQUIPMENT' });
  for (const x of EQ.monitors.xs) {
    dxf.addRect(x - 0.13, EQ.monitors.d - 0.12, x + 0.13, EQ.monitors.d + 0.12, { layer: 'TRUSS_EQUIPMENT' });
  }
  for (const x of EQ.paSpeakers.xs) {
    dxf.addRect(x - 0.21, EQ.paSpeakers.d - 0.19, x + 0.21, EQ.paSpeakers.d + 0.19, { layer: 'TRUSS_EQUIPMENT' });
  }
  // Узловые коробки сплиттеров DMX-1..DMX-5
  for (const db of DMX_BOXES) {
    dxf.addRect(db.x - 0.18, db.d - 0.12, db.x + 0.18, db.d + 0.12, { layer: 'TRUSS_EQUIPMENT' });
    dxf.addText(db.x, db.d + 0.2, db.id, { layer: 'TRUSS_EQUIPMENT', height: 0.11, align: 'center' });
  }

  // --- 6. Корпуса 72 световых приборов и их номера (FIXTURES, FIXTURE_LABELS)
  const planStackCounts = new Map();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const blockName = SHAPE_BLOCK[t.shape] || 'FX_SPOT';
    const x = f.worldPos.x, y = f.worldPos.d;
    const sc = t.scale || 1;
    dxf.addInsert(blockName, x, y, { layer: 'FIXTURES', scaleX: sc, scaleY: sc, scaleZ: sc, rotation: 0 });

    const stackKey = `${x.toFixed(2)}_${y.toFixed(2)}`;
    const stackRank = planStackCounts.get(stackKey) || 0;
    planStackCounts.set(stackKey, stackRank + 1);
    const isPros = f.group.startsWith('PROS');
    const isSide = f.group.startsWith('SIDE') || isPros;
    const lblX = isPros ? x + (x < 0 ? -0.45 : 0.45) : isSide ? x + (x < 0 ? -0.32 : 0.32) : x;
    const lblY = isSide ? y + 0.18 - stackRank * 0.24 : y + (f.idx % 2 === 0 ? 0.25 : -0.3);
    const lblText = isPros ? `${f.no} (+${fmtM(f.worldPos.y)})` : String(f.no);
    dxf.addText(lblX, lblY, lblText, { layer: 'FIXTURE_LABELS', height: 0.13, align: 'center', valign: 'middle' });
  }

  // --- 7. Размерные цепочки (DIMS) -------------------------------------------
  dxf.addLinearDim(COL.frontLeft.x1, 0, COL.frontRight.x0, 0, { offset: -0.55, label: `Просвет колонн ${fmtM(S.portalWidth)} м`, layer: 'DIMS' });
  dxf.addLinearDim(S.x0, S.d1, S.x1, S.d1, { offset: 1.75, label: `Ширина сценической коробки ${fmtM(S.width)} м`, layer: 'DIMS' });
  dxf.addLinearDim(H.x0, H.backWallD, H.x1, H.backWallD, { offset: -1.1, label: `Ширина зрительного зала ${fmtM(H.width)} м`, layer: 'DIMS' });
  dxf.addLinearDim(S.x0, 0, S.x0, S.d1, { offset: 4.2, label: `Глубина сцены ${fmtM(S.d1)} м`, layer: 'DIMS' });
  dxf.addLinearDim(H.x0, H.backWallD, H.x0, 0, { offset: 6.7, label: `Глубина зала ${fmtM(-H.backWallD)} м`, layer: 'DIMS' });

  // --- 8. Таблицы экспликации, ведомость ферм, групп и штамп (SHEET_LEGEND) --
  const legX = 11.2;
  let curY = S.d1 + 1.5;

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
      { label: 'Код', width: 3.2, align: 'center' },
      { label: 'Модель прибора', width: 8.6, align: 'left' },
      { label: 'Шт', width: 2.0, align: 'center' },
      { label: 'Мощность', width: 4.5, align: 'center' },
      { label: 'Угол / Зум', width: 4.5, align: 'center' },
      { label: 'Вес', width: 4.2, align: 'center' },
    ],
    rows: typeRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t1.bottomY - 0.7;

  const trussRows = ALL_TRUSSES.map((tr) => [
    tr.name,
    tr.zone === 'hall' ? 'Ферма зрительного зала' : 'Ферма сцены',
    `${tr.d >= 0 ? '+' : ''}${fmtM(tr.d)} м`,
    `${fmtM(tr.x1 - tr.x0)} м`,
    `+${fmtM(CHAMBER.trusses.bottomY)} м`,
  ]);
  const t2 = dxf.addTable(legX, curY, {
    title: 'ВЕДОМОСТЬ ПОДВЕСНЫХ ТРЕУГОЛЬНЫХ ФЕРМ (20×20×20 СМ, Ø32 ММ)',
    headers: [
      { label: 'Марка', width: 2.8, align: 'center' },
      { label: 'Зона размещения', width: 8.6, align: 'left' },
      { label: 'Координата d', width: 5.2, align: 'center' },
      { label: 'Длина L', width: 5.0, align: 'center' },
      { label: 'Низ фермы H', width: 5.4, align: 'center' },
    ],
    rows: trussRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t2.bottomY - 0.7;

  const grpRows = Object.entries(GROUPS).map(([gid, g]) => {
    const fl = fixtures.filter((f) => f.group === gid && !f.hidden);
    return [g.name, String(fl.length), g.ds];
  });
  const t3 = dxf.addTable(legX, curY, {
    title: 'ГРУППЫ ПРИБОРОВ И ЛИНИИ ПИТАНИЯ (D - ДИММЕРЫ, S - СВИТЧЕРЫ)',
    headers: [
      { label: 'Группа подвеса', width: 10.8, align: 'left' },
      { label: 'Приборов', width: 2.6, align: 'center' },
      { label: 'Номера линий по схеме', width: 13.6, align: 'left' },
    ],
    rows: grpRows,
    layer: 'SHEET_LEGEND',
  });
  curY = t3.bottomY - 0.7;

  dxf.addTitleBlock(legX, curY - 2.2, {
    title: SHEET_TITLE,
    subtitle: 'План сцены, зрительного зала, ферм и развеса светового оборудования (2D)',
    extra: `Приборов на плане: ${totalFix} шт. · Зрительских мест: ${H.seatsTotal} шт.`,
    width: 27.0,
  });

  return dxf.toString();
}

// =============================================================================
//  2. ПРОДОЛЬНЫЙ РАЗРЕЗ 2D (fest-chamber-section-2d.dxf)
//     X_cad = -d (слева арьер сцены -9,75, в центре линия портала 0, справа зал +6,65),
//     Y_cad = Y  (высота над уровнем планшета сцены 0,000)
// =============================================================================
export function buildSectionDXF(stage) {
  const { fixtures } = extractSnapshot(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });

  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('AR_SECTION', { color: 7, ltype: 'CONTINUOUS' })
    .addLayer('AR_DUCTS', { color: 4, ltype: 'DASHED' })
    .addLayer('TRUSSES_SECTION', { color: 5, ltype: 'CONTINUOUS' })
    .addLayer('FIXTURES_SECTION', { color: 8, ltype: 'CONTINUOUS' })
    .addLayer('DIMS_SECTION', { color: 2, ltype: 'CONTINUOUS' })
    .addLayer('SHEET_LEGEND', { color: 7, ltype: 'CONTINUOUS' });

  const X = (d) => -d;
  const S = CHAMBER.stage;
  const H = CHAMBER.hall;
  const RG = CHAMBER.rigels;
  const NICHE = CHAMBER.niche;
  const T = CHAMBER.trusses;
  const CEIL = S.ceiling;

  // --- 1. Оси и координатная сетка разреза -----------------------------------
  dxf.addLine(0, -1.2, 0, CEIL + 2.6, { layer: '0_AXES' });
  dxf.addLine(X(NICHE.d1) - 1.2, 0, X(H.backWallD) + 1.5, 0, { layer: '0_AXES' });
  dxf.addText(0.12, CEIL + 2.2, 'НУЛЕВАЯ ЛИНИЯ ПОРТАЛА (d = 0)', { layer: '0_AXES', height: 0.16 });
  dxf.addText(X(NICHE.d1) - 1.1, 0.12, 'УРОВЕНЬ ПЛАНШЕТА СЦЕНЫ (±0,000)', { layer: '0_AXES', height: 0.16 });

  for (let d = -6; d <= 11; d++) {
    if (d !== 0) dxf.addLine(X(d), -0.6, X(d), CEIL, { layer: '0_GRID' });
    dxf.addText(X(d), -0.85, `${d > 0 ? '+' : ''}${d}`, { layer: '0_GRID', height: 0.14, align: 'center', valign: 'top' });
  }
  for (let y = 1; y <= 4; y++) {
    dxf.addLine(X(S.d1), y, X(H.backWallD), y, { layer: '0_GRID' });
  }

  // --- 2. Архитектурный контур разреза (AR_SECTION) --------------------------
  // Планшет сцены и пол 1-го ряда (d = -0,45..+9,75, ниша до +11,10)
  dxf.addLine(X(NICHE.d1), 0, X(H.firstStepD), 0, { layer: 'AR_SECTION' });
  dxf.addLine(X(NICHE.d1), -0.06, X(H.firstStepD), -0.06, { layer: 'AR_SECTION' });

  // Задняя стена сцены (d = 9,75) и ниша выхода во всю высоту помещения (+4,40 м, d = 9,75..11,10)
  dxf.addRect(X(S.d1) - 0.2, 0, X(S.d1), CEIL, { layer: 'AR_SECTION' });
  dxf.addPolyline([
    [X(S.d1), CEIL],
    [X(NICHE.d1), CEIL],
    [X(NICHE.d1), 0],
  ], { layer: 'AR_SECTION', ltype: 'DASHED' });

  // Единый потолок (+4,40 м от задней ниши сцены до задней стены зала)
  dxf.addRect(X(NICHE.d1) - 0.2, CEIL, X(H.backWallD) + 0.2, CEIL + 0.2, { layer: 'AR_SECTION' });

  // Передний и задний ригели (низ +3,60 м, верх +4,40 м)
  for (const [rName, rg] of [['Передний ригель (+3,60)', RG.front], ['Задний ригель (+3,60)', RG.back]]) {
    dxf.addRect(X(rg.d1), RG.bottomY, X(rg.d0), RG.topY, { layer: 'AR_SECTION' });
    dxf.addLine(X(rg.d1), RG.bottomY, X(rg.d0), RG.topY, { layer: 'AR_SECTION' });
    dxf.addLine(X(rg.d0), RG.bottomY, X(rg.d1), RG.topY, { layer: 'AR_SECTION' });
    dxf.addText(X((rg.d0 + rg.d1) / 2), RG.bottomY - 0.22, rName, { layer: 'AR_SECTION', height: 0.14, align: 'center' });
  }

  // Гребёнка ступеней зрительного зала (ряды 1–7, шаг подъёма 0,25 м до +1,50 м)
  const hallPts = [[X(H.firstStepD), 0]];
  for (let s = 1; s <= 5; s++) {
    const yTop = s * H.stepHeight;
    const d0 = H.firstStepD - (s - 1) * H.stepDepth;
    const d1 = H.firstStepD - s * H.stepDepth;
    hallPts.push([X(d0), yTop], [X(d1), yTop]);
  }
  hallPts.push([X(H.topPlatformD1), H.topPlatformY], [X(H.backWallD), H.topPlatformY]);
  dxf.addPolyline(hallPts, { layer: 'AR_SECTION' });

  // Кресла в разрезе по всем 7 рядам
  for (let r = 0; r < H.rows; r++) {
    const yRow = rowFloorY(r);
    const dSeat = rowFrontD(r) - 0.35;
    dxf.addRect(X(dSeat + 0.18), yRow, X(dSeat - 0.18), yRow + 0.42, { layer: 'AR_DUCTS' });
    dxf.addLine(X(dSeat - 0.16), yRow + 0.42, X(dSeat - 0.24), yRow + 0.88, { layer: 'AR_DUCTS' });
    dxf.addText(X(dSeat), yRow - 0.2, `Р${r + 1}`, { layer: 'AR_SECTION', height: 0.13, align: 'center' });
  }

  // Задняя стена зала (d = -6,65) и операторская будка (d = -6,65..-4,95, y = +1,50..+4,40)
  const B = H.booth;
  dxf.addRect(X(B.d1), B.y0, X(B.d0), B.y1, { layer: 'AR_SECTION' });
  dxf.addRect(X(B.d1) - 0.04, B.windowY0, X(B.d1) + 0.04, B.windowY1, { layer: 'AR_DUCTS' });
  dxf.addText(X((B.d0 + B.d1) / 2), (B.y0 + B.y1) / 2, 'Операторская (+1,50)', { layer: 'AR_SECTION', height: 0.16, align: 'center', valign: 'middle' });

  // Контур венткороба, электрокороба и кондиционеров в проекции
  const DUCT = CHAMBER.ducts;
  dxf.addRect(X(DUCT.vent.d1), 0, X(DUCT.vent.d0), CEIL, { layer: 'AR_DUCTS', ltype: 'DASHED' });
  dxf.addRect(X(DUCT.elecLow.d1), 0, X(DUCT.elecLow.d0), DUCT.elecLow.y1, { layer: 'AR_DUCTS', ltype: 'DASHED' });
  const ac = CHAMBER.equipment.acUnits[0];
  dxf.addRect(X(ac.d1), ac.y0, X(ac.d0), ac.y1, { layer: 'AR_DUCTS' });

  // --- 3. Сечения 12 треугольных ферм (ЗФ1–ЗФ3, Ф1–Ф9) на высоте +3,75 м -----
  const hTri = triHeight(T.side);
  ALL_TRUSSES.forEach((tr, idx) => {
    const cx = X(tr.d);
    const hs = T.side / 2;
    dxf.addPolyline([
      [cx - hs, T.bottomY],
      [cx + hs, T.bottomY],
      [cx, T.bottomY + hTri],
      [cx - hs, T.bottomY],
    ], { layer: 'TRUSSES_SECTION' });
    dxf.addLine(cx, T.bottomY + hTri, cx, CEIL, { layer: 'TRUSSES_SECTION', ltype: 'DASHED' });

    const tier = idx % 3;
    const labelY = CEIL + 0.45 + tier * 0.48;
    dxf.addLine(cx, CEIL, cx, labelY, { layer: 'TRUSSES_SECTION' });
    dxf.addCircle(cx, labelY, 0.035, { layer: 'TRUSSES_SECTION' });
    dxf.addText(cx, labelY + 0.07, `${tr.name} (+${fmtM(T.bottomY)})`, {
      layer: 'TRUSSES_SECTION', height: 0.14, align: 'center', valign: 'bottom',
    });
  });

  // Единственная П-образная конструкция за передними колоннами (d = +0,18 м, H = +2,65..3,65 м)
  const pf = T.prosceniumFrame;
  const pfx = X(pf.d);
  dxf.addRect(pfx - 0.04, pf.bottomY, pfx + 0.04, pf.topY, { layer: 'TRUSSES_SECTION' });
  dxf.addLine(pfx, pf.topY, pfx, CEIL, { layer: 'TRUSSES_SECTION', ltype: 'DASHED' });

  // --- 4. Корпуса световых приборов в разрезе (FIXTURES_SECTION) -------------
  const drawnPos = new Set();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const posKey = `${f.worldPos.d.toFixed(2)}|${f.worldPos.y.toFixed(2)}`;
    if (drawnPos.has(posKey)) continue;
    drawnPos.add(posKey);
    const px = X(f.worldPos.d), py = f.worldPos.y;
    dxf.addRect(px - 0.11, py - 0.18, px + 0.11, py + 0.06, { layer: 'FIXTURES_SECTION' });
  }

  // --- 5. Высотные отметки и размерные цепочки разреза (DIMS_SECTION) --------
  const elevXLeft = X(NICHE.d1) - 0.8;
  dxf.addElevationMark(elevXLeft, 0, '±0,000 (Планшет сцены)', { layer: 'DIMS_SECTION' });
  dxf.addElevationMark(elevXLeft, H.topPlatformY, '+1,500 (7-й ряд / Операторская)', { layer: 'DIMS_SECTION' });
  dxf.addElevationMark(elevXLeft, RG.bottomY, '+3,600 (Низ ригелей)', { layer: 'DIMS_SECTION' });
  dxf.addElevationMark(elevXLeft, T.bottomY, '+3,750 (Низ ферм)', { layer: 'DIMS_SECTION' });
  dxf.addElevationMark(elevXLeft, CEIL, '+4,400 (Потолок)', { layer: 'DIMS_SECTION' });

  dxf.addLinearDim(X(S.d1), 0, X(0), 0, { offset: -1.45, label: `Глубина сцены ${fmtM(S.d1)} м`, layer: 'DIMS_SECTION' });
  dxf.addLinearDim(X(0), 0, X(H.backWallD), 0, { offset: -1.45, label: `Глубина зала ${fmtM(-H.backWallD)} м`, layer: 'DIMS_SECTION' });

  dxf.addTitleBlock(X(S.d1), -4.2, {
    title: SHEET_TITLE,
    subtitle: 'Продольный разрез сцены и зрительного зала по оси (2D)',
    extra: `Потолок: +4,40 м · Фермы: +3,75 м · Ригели: +3,60 м · Приборов: ${fixtures.length} шт.`,
    width: 17.5,
  });

  return dxf.toString();
}
