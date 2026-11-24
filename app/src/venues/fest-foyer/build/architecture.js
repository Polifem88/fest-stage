// Архитектура Фойе театра «ФЭСТ» (Этап 1 — черновик):
//  • слой walls — полы 1-го и 2-го этажей (с трапециевидным проёмом второго света и торцом плиты 0,30 м),
//    кирпичные торцевые стены с вырезами окон ОК16*, пилястрами и дверями 2-го этажа,
//    единые светлые оштукатуренные внутренние стены 1-го и 2-го этажей (с проёмами коридоров и дверью операторской),
//    два ряда колонн (1 эт. тёмная плитка, 2 эт. светлая штукатурка до foyerCeilY),
//    шахта стеклянного подъёмника МГН, каркас тамбура, оболочка гардероба (грильято + рамы вешалок),
//    ниша буфета с кирпичным столбом и рамой служебного проёма, два коридора 2-го этажа в Большой зал;
//  • слой ceiling — строго односторонние (FrontSide, ny < -0.35) потолки 1-го и 2-го этажей
//    (включая крутой скат d = 5,10→5,58), чтобы виды сверху («Общий вид», «План сверху») не перекрывались.
// Все габариты — строго из config/dimensions.js (FOYER, foyerCeilY); здесь лишь визуальные пропорции деталей.
import * as THREE from 'three';
import { box, rect, wallWithHoles, P } from '../../../core/geom.js';
import { FOYER, foyerCeilY } from '../config/dimensions.js';

// Визуальные константы деталей (не влияют на габариты помещения)
const DOOR_FRAME_W = 0.06;      // ширина коробки двери
const DOOR_PROTRUDE = 0.025;    // выступ полотна/коробки накладной двери от кирпича (без z-fighting)
const DOOR_SEAM = 0.012;        // щель между створками двустворчатой двери
const DOOR_DOUBLE_MIN = 1.20;   // порог ширины для отрисовки двустворчатой двери
const PORTHOLE_R = 0.18;        // радиус круглого иллюминатора в дверях ДВ5Б* / ДВ1Б**
const PORTHOLE_RING = 0.025;    // толщина рамки иллюминатора
const PORTHOLE_Y_OFF = 1.45;    // высота центра иллюминатора от низа двери
const ELEV_POST = 0.06;         // сечение алюминиевого профиля шахты подъёмника МГН
const ELEV_GLASS_T = 0.006;     // смещение стёкол шахты внутрь от рамы
const VEST_FRAME = 0.06;        // сечение несущего каркаса тамбура
const RACK_BAR = 0.035;         // сечение стоек и перекладин схематичных вешалок гардероба
const RACK_POST_STEP = 1.80;    // шаг вертикальных стоек вешалок гардероба
const RACK_MID_RATIO = 0.52;    // относительная высота нижней штанги вешалки
const SERVICE_RECESS = 0.12;    // глубина ниши служебного проёма буфета
const CURTAIN_ROD_H = 0.04;     // высота карниза в проёме служебного входа буфета
const GLASS_SPLIT = 0.004;      // разнесение двусторонней пары плоскостей стекла
const MOLTON_PLEAT = 0.24;      // шаг складок чёрной шторы в торце прохода
const MOLTON_AMP = 0.035;       // глубина складок шторы
const MOLTON_SUBDIV = { desktop: 4, mobile: 2 };

/** Односторонний четырёхугольник с явной геометрической нормалью по правилу правой руки (p0→p1 × p0→p2). */
function quad(p0, p1, p2, p3) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([
    p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z,
    p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
  ]);
  const e1 = new THREE.Vector3().subVectors(p1, p0);
  const e2 = new THREE.Vector3().subVectors(p2, p0);
  const n = new THREE.Vector3().crossVectors(e1, e2).normalize();
  const nor = new Float32Array([
    n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z,
    n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Горизонтальный многоугольник в плоскости (x, d) на отметке y; facing +1 вверх, −1 вниз. */
function horizontalShape(pts, y, facing = 1) {
  const mapped = facing > 0
    ? pts.map(([x, d]) => new THREE.Vector2(x, d))
    : pts.map(([x, d]) => new THREE.Vector2(x, -d));
  const shape = new THREE.Shape(mapped);
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(facing > 0 ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Односторонняя полоса потолка (лицом строго вниз, ny < 0) от (d0, y0) к (d1, y1) на ширине x0..x1. */
function slopedCeilStrip(x0, x1, d0, y0, d1, y1) {
  return quad(P(x0, y0, d0), P(x0, y1, d1), P(x1, y1, d1), P(x1, y0, d0));
}

/** Упорядоченный список точек перелома потолка 2-го этажа, попадающих строго внутрь (d0, d1). */
function ceilBreaksInside(d0, d1) {
  const C2 = FOYER.ceil2;
  const breaks = [C2.shelfFromD, C2.rampFromD, C2.rampToD, C2.bendD];
  return [d0, ...breaks.filter((d) => d > d0 + 1e-4 && d < d1 - 1e-4), d1];
}

/**
 * Колонна или пилястра с верхом, точно повторяющим профиль потолка foyerCeilY(d):
 * нигде не оставляет щели до потолка и нигде не пробивает скат вверх.
 */
function columnWithCeilTop(x0, x1, y0, d0, d1, { skipLeft = false, skipRight = false } = {}) {
  const ds = ceilBreaksInside(d0, d1);
  const parts = [];
  for (let i = 0; i < ds.length - 1; i++) {
    const da = ds[i], db = ds[i + 1];
    const ya = foyerCeilY(da), yb = foyerCeilY(db);
    // Левая грань (−X), правая грань (+X), верхняя грань (вверх)
    if (!skipLeft) parts.push(quad(P(x0, y0, da), P(x0, ya, da), P(x0, yb, db), P(x0, y0, db)));
    if (!skipRight) parts.push(quad(P(x1, y0, da), P(x1, y0, db), P(x1, yb, db), P(x1, ya, da)));
    parts.push(quad(P(x0, ya, da), P(x1, ya, da), P(x1, yb, db), P(x0, yb, db)));
  }
  parts.push(
    rect('d', d0, x0, x1, y0, foyerCeilY(d0), -1),
    rect('d', d1, x0, x1, y0, foyerCeilY(d1), 1),
    rect('y', y0, x0, x1, d0, d1, -1),
  );
  return parts;
}

/** Торцевая кирпичная стена (x = at) с точным верхним контуром foyerCeilY(d) и проёмом окна ОК16*. */
function brickEndWall(at, facing, okWin) {
  const R = FOYER.room;
  const C1 = FOYER.ceil1;
  const C2 = FOYER.ceil2;
  const cutSet = new Set([
    R.dGlass2,
    R.dGlass1,
    okWin.d0,
    okWin.d1,
    C2.shelfFromD,
    C2.rampFromD,
    C2.rampToD,
    C2.bendD,
    R.dWhite1,
    R.dWall2,
  ]);
  const ds = [...cutSet].sort((a, b) => a - b);
  const parts = [];

  const emitStrip = (da, db, yBotA, yBotB, yTopA, yTopB) => {
    if (facing > 0) {
      parts.push(quad(P(at, yBotA, da), P(at, yBotB, db), P(at, yTopB, db), P(at, yTopA, da)));
    } else {
      parts.push(quad(P(at, yBotA, da), P(at, yTopA, da), P(at, yTopB, db), P(at, yBotB, db)));
    }
  };

  for (let i = 0; i < ds.length - 1; i++) {
    const da = ds[i], db = ds[i + 1];
    if (db - da < 1e-4) continue;
    const mid = (da + db) / 2;
    let yBot;
    if (mid < R.dGlass1) yBot = C1.cantileverSoffit;
    else if (mid < R.dWhite1) yBot = 0;
    else yBot = R.y2;
    const yTopA = foyerCeilY(da);
    const yTopB = foyerCeilY(db);

    if (mid > okWin.d0 && mid < okWin.d1) {
      if (okWin.y0 > yBot + 1e-4) emitStrip(da, db, yBot, yBot, okWin.y0, okWin.y0);
      if (Math.min(yTopA, yTopB) > okWin.y1 + 1e-4) emitStrip(da, db, okWin.y1, okWin.y1, yTopA, yTopB);
    } else {
      emitStrip(da, db, yBot, yBot, yTopA, yTopB);
    }
  }
  return parts;
}

/** Отрезок [a, b] за вычетом интервалов obstacles = [[o0, o1], ...]. */
function subtractSpans1D(a, b, obstacles) {
  let spans = [[a, b]];
  for (const [o0, o1] of obstacles) {
    spans = spans.flatMap(([s0, s1]) => {
      if (o1 <= s0 || o0 >= s1) return [[s0, s1]];
      const out = [];
      if (o0 > s0 + 1e-4) out.push([s0, o0]);
      if (o1 < s1 - 1e-4) out.push([o1, s1]);
      return out;
    });
  }
  return spans;
}

/** Двусторонняя пара плоскостей стекла вдоль X (нормали ±X) или вдоль d (нормали ±d). */
function glassPair(axis, at, a0, a1, b0, b1) {
  return [
    rect(axis, at - GLASS_SPLIT, a0, a1, b0, b1, -1),
    rect(axis, at + GLASS_SPLIT, a0, a1, b0, b1, 1),
  ];
}

/** Чёрная штора со складками в плоскости d = at (лицом в −d), от y0 до y1 на ширине x0..x1. */
function pleatedCurtainD(at, x0, x1, y0, y1, mobile) {
  const w = x1 - x0;
  const seg = Math.max(6, Math.round(w / (MOLTON_PLEAT / (mobile ? MOLTON_SUBDIV.mobile : MOLTON_SUBDIV.desktop))));
  const g = new THREE.PlaneGeometry(w, y1 - y0, seg, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, MOLTON_AMP * Math.sin(((x + w / 2) / MOLTON_PLEAT) * Math.PI * 2));
  }
  g.computeVertexNormals();
  // PlaneGeometry смотрит в +Z (= −d); складки ±MOLTON_AMP вокруг плоскости d = at
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, -at);
  return g;
}

export function buildArchitecture(batch, M, { mobile = false } = {}) {
  const R = FOYER.room;
  const C1 = FOYER.ceil1;
  const C2 = FOYER.ceil2;
  const A = FOYER.atrium;
  const Z = FOYER.zones;
  const ySlabBot = R.y2 - R.slabThick;

  // ===========================================================================
  //  1. ПОЛЫ 1-ГО И 2-ГО ЭТАЖЕЙ (керамогранит 0,597 × 0,597 м)
  // ===========================================================================
  // Единый простой 12-вершинный контур пола 2-го этажа без вырожденного отверстия у X = −11,93
  const floor2Poly = [
    [R.x0, R.dGlass2],
    [R.x1, R.dGlass2],
    [R.x1, R.dWall2],
    [R.x0, R.dWall2],
    ...[...A.cutout].reverse(),
  ];
  const floors = [
    rect('y', 0, R.x0, R.x1, R.dGlass1, R.dWhite1, 1),
    // пол коридора прохода за белой стеной и правого коридора у дивана
    rect('y', 0, Z.passage.x0, Z.passage.x1, R.dWhite1, Z.passage.d1, 1),
    rect('y', 0, Z.sideCorridor.x0, Z.sideCorridor.x1, Z.sideCorridor.d0, Z.sideCorridor.d1, 1),
    horizontalShape(floor2Poly, R.y2, 1),
    ...Z.corridors.map((c) => rect('y', c.y0, c.x0, c.x1, c.d0, c.d1, 1)),
  ];
  batch.add('walls', M.tileFloorDark, floors, { tag: 'floors' });

  // ===========================================================================
  //  2. ТОРЕЦ ПЛИТЫ ПЕРЕКРЫТИЯ 2-ГО ЭТАЖА (0,30 м) И ПОДШИВКА КОНСОЛИ
  // ===========================================================================
  const fascia = [];
  // 7 внутренних кромок трапециевидного выреза второго света (без кромки по кирпичной стене X = −11,93)
  for (let i = 0; i < A.cutout.length - 1; i++) {
    const [ax, ad] = A.cutout[i];
    const [bx, bd] = A.cutout[i + 1];
    fascia.push(quad(P(ax, ySlabBot, ad), P(ax, R.y2, ad), P(bx, R.y2, bd), P(bx, ySlabBot, bd)));
  }
  // Внешний торец консольной плиты у витража ВБ3 (d = −0,80) и подшивка консоли снизу (Y = 2,70)
  fascia.push(
    rect('d', R.dGlass2, R.x0, R.x1, ySlabBot, R.y2, -1),
    rect('y', C1.cantileverSoffit, R.x0, R.x1, R.dGlass2, R.dGlass1, -1),
    // Вертикальные окантовки, закрывающие стык потолков 1-го этажа с низом плиты 2,70
    rect('d', R.dGlass1, R.x0, R.x1, C1.reception, C1.cantileverSoffit, -1),
    rect('d', A.westD, Z.elevator.x1, A.westX1, C1.reception, ySlabBot, 1),
    quad(
      P(A.southEdge[0][0], C1.wardrobeSlab, A.southEdge[0][1]),
      P(A.southEdge[0][0], ySlabBot, A.southEdge[0][1]),
      P(A.southEdge[1][0], ySlabBot, R.dWhite1),
      P(A.southEdge[1][0], C1.wardrobeSlab, R.dWhite1),
    ),
  );
  batch.add('walls', M.plasterLight, fascia, { tag: 'slabFascia' });

  // ===========================================================================
  //  3. КИРПИЧНЫЕ ТОРЦЕВЫЕ СТЕНЫ (X = −11,93 и X = +11,56), ПИЛЯСТРЫ И СТОЛБ БУФЕТА
  // ===========================================================================
  const okX0 = FOYER.windows.ok16.find((w) => w.wall === 'x0');
  const okX1 = FOYER.windows.ok16.find((w) => w.wall === 'x1');
  const brickGeoms = [
    ...brickEndWall(R.x0, 1, okX0),
    ...brickEndWall(R.x1, -1, okX1),
  ];

  // Кирпичные пилястры вдоль торцевых стен (без скрытой тыльной грани на самой стене)
  const pDepth = FOYER.columns.pilasters.depth;
  for (const p of FOYER.columns.pilasters.items) {
    const x0 = p.wall === 'x0' ? R.x0 : R.x1 - pDepth;
    const x1 = p.wall === 'x0' ? R.x0 + pDepth : R.x1;
    const opts = { skipLeft: p.wall === 'x0', skipRight: p.wall === 'x1' };
    if (p.d1 <= R.dWhite1) {
      brickGeoms.push(...columnWithCeilTop(x0, x1, 0, p.d0, p.d1, opts));
    } else {
      // Пилястра за линией 1-го этажа (d = 14,10..14,65): не выступает за белую стену 1 эт.
      brickGeoms.push(...columnWithCeilTop(x0, x1, R.y2, p.d0, p.d1, opts));
    }
  }

  // Кирпичный столб с южного края буфета (за ним остаётся проход 1,15 м под лестницей)
  const bp = Z.buffet.pier;
  brickGeoms.push(box(bp.x0, bp.x1, 0, C1.buffet, bp.d0, bp.d1));
  // Левая (кирпичная) стенка коридора прохода за белой стеной (181052.jpg)
  brickGeoms.push(rect('x', Z.passage.x0, R.dWhite1, Z.passage.d1, 0, Z.passage.h, 1));

  // Наружные кирпичные стены двух коридоров 2-го этажа в Большой зал
  for (const c of Z.corridors) {
    if (c.id === 'north') brickGeoms.push(rect('x', c.x0, c.d0, c.d1, c.y0, c.y0 + c.h, 1));
    else brickGeoms.push(rect('x', c.x1, c.d0, c.d1, c.y0, c.y0 + c.h, -1));
  }
  batch.add('walls', M.brickRed, brickGeoms, { tag: 'brickWalls' });

  // ===========================================================================
  //  4. ВНУТРЕННИЕ СТЕНЫ 1-ГО И 2-ГО ЭТАЖЕЙ (единая светлая штукатурка) + КОРИДОРЫ
  // ===========================================================================
  const plasterWalls = [];
  const creamWalls = [];

  // 1-й этаж: светлая оштукатуренная стена за лестницей, диваном и 4 бра (X = −6,15 … 5,56)
  // с проёмами прохода 1,15 м под лестницей и правого коридора у дивана
  const PS = Z.passage;
  const SC = Z.sideCorridor;
  plasterWalls.push(...wallWithHoles('d', R.dWhite1, Z.buffet.x1, R.whiteX1, 0, R.y2, -1, [
    { a0: PS.x0, a1: PS.x1, b0: 0, b1: PS.h },
    { a0: SC.x0, a1: SC.x1, b0: 0, b1: SC.h },
  ]));
  // Коридор прохода за белой стеной: правая стенка — штукатурка (левая — кирпич, см. brickGeoms)
  plasterWalls.push(rect('x', PS.x1, R.dWhite1, PS.d1, 0, PS.h, -1));
  // Правый коридор у дивана: светлые стенки и торец (143643.jpg)
  plasterWalls.push(
    rect('x', SC.x0, SC.d0, SC.d1, 0, SC.h, 1),
    rect('x', SC.x1, SC.d0, SC.d1, 0, SC.h, -1),
    rect('d', SC.d1, SC.x0, SC.x1, 0, SC.h, -1),
  );
  // Линия X = 5,56 со стороны открытой полосы под балконом: светлая грань от конца стойки гардероба до белой стены
  plasterWalls.push(rect('x', Z.wardrobe.sideX, Z.wardrobe.armD.d1, R.dWhite1, 0, C1.wardrobeSlab, -1));

  // 2-й этаж: стена витрин (d = 20,22) с двумя проёмами коридоров и проёмом двери малой лестницы
  const SS = FOYER.smallStairs;
  const smallDoorX0 = SS.x0 + (SS.landingW - SS.doorW) / 2;
  const smallDoorX1 = smallDoorX0 + SS.doorW;
  const wall2Holes = [
    ...Z.corridors.map((c) => ({ a0: c.x0, a1: c.x1, b0: c.y0, b1: c.y0 + c.h })),
    { a0: smallDoorX0, a1: smallDoorX1, b0: SS.y1, b1: SS.y1 + SS.doorH },
  ];
  plasterWalls.push(...wallWithHoles('d', R.dWall2, R.x0, R.x1, R.y2, C2.wallY, -1, wall2Holes));

  // Внутренние и торцевые стены коридоров 2-го этажа
  const darkDoors = [];
  const grayDoors = [];
  const steelFrames = [];
  const glassPanels = [];
  const boothRecesses = [];

  for (const c of Z.corridors) {
    if (c.id === 'north') plasterWalls.push(rect('x', c.x1, c.d0, c.d1, c.y0, c.y0 + c.h, -1));
    else plasterWalls.push(rect('x', c.x0, c.d0, c.d1, c.y0, c.y0 + c.h, 1));
    const cx = (c.x0 + c.x1) / 2;
    const dx0 = cx - c.doorW / 2;
    const dx1 = cx + c.doorW / 2;
    const dy1 = c.y0 + c.doorH;
    plasterWalls.push(...wallWithHoles('d', c.d1, c.x0, c.x1, c.y0, c.y0 + c.h, -1, [
      { a0: dx0, a1: dx1, b0: c.y0, b1: dy1 },
    ]));
    // Двустворчатая тёмная дверь в Большой зал + рама
    darkDoors.push(
      rect('d', c.d1 - DOOR_PROTRUDE, dx0, cx - DOOR_SEAM / 2, c.y0, dy1, -1),
      rect('d', c.d1 - DOOR_PROTRUDE, cx + DOOR_SEAM / 2, dx1, c.y0, dy1, -1),
    );
    steelFrames.push(
      box(dx0 - DOOR_FRAME_W, dx0, c.y0, dy1 + DOOR_FRAME_W, c.d1 - DOOR_FRAME_W, c.d1),
      box(dx1, dx1 + DOOR_FRAME_W, c.y0, dy1 + DOOR_FRAME_W, c.d1 - DOOR_FRAME_W, c.d1),
      box(dx0, dx1, dy1, dy1 + DOOR_FRAME_W, c.d1 - DOOR_FRAME_W, c.d1),
    );
  }

  // Дверь к операторской Большого зала на площадке малой 5-ступенчатой лестницы
  darkDoors.push(rect('d', R.dWall2 - DOOR_PROTRUDE, smallDoorX0, smallDoorX1, SS.y1, SS.y1 + SS.doorH, -1));
  steelFrames.push(
    box(smallDoorX0 - DOOR_FRAME_W, smallDoorX0, SS.y1, SS.y1 + SS.doorH + DOOR_FRAME_W, R.dWall2 - DOOR_FRAME_W, R.dWall2),
    box(smallDoorX1, smallDoorX1 + DOOR_FRAME_W, SS.y1, SS.y1 + SS.doorH + DOOR_FRAME_W, R.dWall2 - DOOR_FRAME_W, R.dWall2),
    box(smallDoorX0, smallDoorX1, SS.y1 + SS.doorH, SS.y1 + SS.doorH + DOOR_FRAME_W, R.dWall2 - DOOR_FRAME_W, R.dWall2),
  );

  // Двери на кирпичных торцевых стенах 2-го этажа (ДВ5Б*, ДВ5*, ДВ1Б**, ДВ1**)
  const portSeg = mobile ? 10 : 16;
  for (const d of Z.doors) {
    const isX0 = d.wall === 'x0';
    const xWall = isX0 ? R.x0 : R.x1;
    const xLeaf = isX0 ? xWall + DOOR_PROTRUDE : xWall - DOOR_PROTRUDE;
    const xF0 = isX0 ? xWall : xWall - DOOR_FRAME_W;
    const xF1 = isX0 ? xWall + DOOR_FRAME_W : xWall;
    const facing = isX0 ? 1 : -1;
    const y1 = d.y0 + d.h;
    const target = d.gray ? grayDoors : darkDoors;

    if (d.d1 - d.d0 >= DOOR_DOUBLE_MIN) {
      const dm = (d.d0 + d.d1) / 2;
      target.push(
        rect('x', xLeaf, d.d0, dm - DOOR_SEAM / 2, d.y0, y1, facing),
        rect('x', xLeaf, dm + DOOR_SEAM / 2, d.d1, d.y0, y1, facing),
      );
    } else {
      target.push(rect('x', xLeaf, d.d0, d.d1, d.y0, y1, facing));
    }

    steelFrames.push(
      box(xF0, xF1, d.y0, y1 + DOOR_FRAME_W, d.d0 - DOOR_FRAME_W, d.d0),
      box(xF0, xF1, d.y0, y1 + DOOR_FRAME_W, d.d1, d.d1 + DOOR_FRAME_W),
      box(xF0, xF1, y1, y1 + DOOR_FRAME_W, d.d0, d.d1),
    );

    if (d.porthole) {
      const dc = (d.d0 + d.d1) / 2;
      const yc = d.y0 + PORTHOLE_Y_OFF;
      const xPort = isX0 ? xLeaf + GLASS_SPLIT : xLeaf - GLASS_SPLIT;
      const glassDisc = new THREE.CircleGeometry(PORTHOLE_R, portSeg);
      glassDisc.rotateY(isX0 ? Math.PI / 2 : -Math.PI / 2);
      glassDisc.translate(xPort, yc, -dc);
      glassPanels.push(glassDisc);

      const ring = new THREE.RingGeometry(PORTHOLE_R, PORTHOLE_R + PORTHOLE_RING, portSeg);
      ring.rotateY(isX0 ? Math.PI / 2 : -Math.PI / 2);
      ring.translate(xPort + (isX0 ? 0.002 : -0.002), yc, -dc);
      steelFrames.push(ring);
    }
  }

  batch.add('walls', M.plasterLight, plasterWalls, { tag: 'plasterWalls' });
  batch.add('walls', M.molton, pleatedCurtainD(PS.d1, PS.x0, PS.x1, 0, PS.h, mobile), { tag: 'passageMolton', shadow: false });
  if (darkDoors.length) batch.add('walls', M.door, darkDoors, { tag: 'doors' });
  if (grayDoors.length) batch.add('walls', M.steelGray, grayDoors, { tag: 'doorsGray' });

  // ===========================================================================
  //  5. ДВА РЯДА КОЛОНН (1 эт. — тёмная плитка, 2 эт. — светлая штукатурка до foyerCeilY)
  // ===========================================================================
  const allCols = [...FOYER.columns.outer, ...FOYER.columns.inner, FOYER.columns.extraB];
  const cols1f = [];
  const cols2f = [];
  for (const c of allCols) {
    cols1f.push(box(c.x0, c.x1, 0, R.y2, c.d0, c.d1));
    cols2f.push(...columnWithCeilTop(c.x0, c.x1, R.y2, c.d0, c.d1));
  }
  batch.add('walls', M.tileFloorDark, cols1f, { tag: 'columns1f' });
  batch.add('walls', M.plasterLight, cols2f, { tag: 'columns2f' });

  // ===========================================================================
  //  6. ПРИМЫКАЮЩИЕ ЗОНЫ: БУФЕТ, ГАРДЕРОБ, ПОДЪЁМНИК МГН, КАРКАС ТАМБУРА
  // ===========================================================================
  // --- Ниша буфета (задняя плиточная стена с проёмом служебного входа и карнизом) ---
  const B = Z.buffet;
  const sd = B.serviceDoor;
  batch.add(
    'walls',
    M.tileFloorDark,
    wallWithHoles('d', B.d1, B.x0, B.x1, 0, C1.buffet, -1, [{ a0: sd.x0, a1: sd.x1, b0: 0, b1: sd.h }]),
    { tag: 'buffetWall' },
  );
  // Каркас и тёмная глубина служебного проёма буфета (со штангой для шторы)
  steelFrames.push(
    box(sd.x0 - DOOR_FRAME_W, sd.x0, 0, sd.h + DOOR_FRAME_W, sd.d - DOOR_FRAME_W, sd.d),
    box(sd.x1, sd.x1 + DOOR_FRAME_W, 0, sd.h + DOOR_FRAME_W, sd.d - DOOR_FRAME_W, sd.d),
    box(sd.x0, sd.x1, sd.h, sd.h + DOOR_FRAME_W, sd.d - DOOR_FRAME_W, sd.d),
    box(sd.x0, sd.x1, sd.h - CURTAIN_ROD_H, sd.h, sd.d - DOOR_FRAME_W, sd.d - DOOR_FRAME_W * 0.4),
  );
  boothRecesses.push(
    rect('d', sd.d + SERVICE_RECESS, sd.x0, sd.x1, 0, sd.h, -1),
    rect('x', sd.x0, sd.d, sd.d + SERVICE_RECESS, 0, sd.h, 1),
    rect('x', sd.x1, sd.d, sd.d + SERVICE_RECESS, 0, sd.h, -1),
    rect('y', sd.h, sd.x0, sd.x1, sd.d, sd.d + SERVICE_RECESS, -1),
  );

  // --- Гардероб (M1): кремовые стены внутри, чёрная решётка грильято Y = 2,35 строго внутри контура,
  //     короба противопожарных штор над обоими плечами стойки и схематичные рамы вешалок вдоль d ---
  const W = Z.wardrobe;
  creamWalls.push(
    rect('d', W.d1, W.sideX, W.x1, 0, C1.wardrobeSlab, -1),            // задняя стена d = 13,11
    rect('x', W.sideX, W.armD.d1, W.d1, 0, C1.wardrobeSlab, 1),        // боковая X = 5,56 за концом стойки
    rect('x', W.liningX, W.d0, W.d1, 0, C1.wardrobeGrilyato, -1),      // обшивка кирпичного торца
  );
  batch.add('walls', M.plasterCream, creamWalls, { tag: 'wardrobeCream' });
  batch.add('walls', M.grilyato, rect('y', C1.wardrobeGrilyato, W.x0, W.x1, W.d0, W.d1, -1), {
    tag: 'wardrobeGrilyato',
    shadow: false,
  });

  // Короба противопожарных штор (разрываются на колоннах, через которые проходили бы)
  const allColsFire = [...FOYER.columns.outer, ...FOYER.columns.inner, FOYER.columns.extraB];
  const fireBoxGeoms = [];
  for (const fb of W.fireBoxes) {
    const hits = allColsFire
      .filter((c) => c.d0 < fb.d1 && c.d1 > fb.d0 && c.x0 < fb.x1 && c.x1 > fb.x0)
      .map((c) => [c.x0, c.x1]);
    for (const [xa, xb] of subtractSpans1D(fb.x0, fb.x1, hits)) {
      fireBoxGeoms.push(box(xa, xb, C1.wardrobeGrilyato, C1.wardrobeSlab, fb.d0, fb.d1));
    }
  }

  const rackHalf = RACK_BAR / 2;
  const rackMidY = W.rackH * RACK_MID_RATIO;
  const rackPostCount = Math.max(2, Math.round((W.rackD1 - W.rackD0) / RACK_POST_STEP) + 1);
  for (const rx of W.rackRowsX) {
    // Верхняя и средняя штанги вешалки (вдоль d)
    steelFrames.push(
      box(rx - rackHalf, rx + rackHalf, W.rackH - RACK_BAR, W.rackH, W.rackD0, W.rackD1),
      box(rx - rackHalf, rx + rackHalf, rackMidY - rackHalf, rackMidY + rackHalf, W.rackD0, W.rackD1),
    );
    // Вертикальные опорные стойки ряда
    for (let i = 0; i < rackPostCount; i++) {
      const rd = W.rackD0 + rackHalf + ((W.rackD1 - W.rackD0 - RACK_BAR) * i) / (rackPostCount - 1);
      steelFrames.push(box(rx - rackHalf, rx + rackHalf, 0, W.rackH, rd - rackHalf, rd + rackHalf));
    }
  }

  // --- Стеклянный подъёмник для МГН (пом. 3): светло-серый каркас + стекло + порталы дверей 1–2 эт. ---
  const E = Z.elevator;
  const elevFrame = [];
  const ep = ELEV_POST;
  // 4 угловые стойки
  for (const [ex, ed] of [
    [E.x0, E.d0],
    [E.x1 - ep, E.d0],
    [E.x0, E.d1 - ep],
    [E.x1 - ep, E.d1 - ep],
  ]) {
    elevFrame.push(box(ex, ex + ep, E.y0, E.y1, ed, ed + ep));
  }
  // Горизонтальные пояса шахты (низ, верх двери 1 эт., уровень 2 эт., верх двери 2 эт., крышка шахты)
  for (const y of [E.y0, E.doorH, R.y2, R.y2 + E.doorH, E.y1 - ep]) {
    elevFrame.push(
      box(E.x0, E.x1, y, y + ep, E.d0, E.d0 + ep),
      box(E.x0, E.x1, y, y + ep, E.d1 - ep, E.d1),
      box(E.x1 - ep, E.x1, y, y + ep, E.d0, E.d1),
    );
  }
  // Порталы дверей подъёмника на грани x = E.x1 (1-й и 2-й этажи)
  const eDoorD0 = (E.d0 + E.d1 - E.doorW) / 2;
  const eDoorD1 = eDoorD0 + E.doorW;
  for (const floorY of [E.y0, R.y2]) {
    elevFrame.push(
      box(E.x1 - ep, E.x1, floorY, floorY + E.doorH, eDoorD0 - ep, eDoorD0),
      box(E.x1 - ep, E.x1, floorY, floorY + E.doorH, eDoorD1, eDoorD1 + ep),
    );
  }
  // Крышка шахты
  elevFrame.push(box(E.x0, E.x1, E.y1 - ep, E.y1, E.d0, E.d1));

  // Стёкла шахты подъёмника (3 открытые грани)
  glassPanels.push(
    ...glassPair('d', E.d0 + ELEV_GLASS_T, E.x0 + ep, E.x1 - ep, E.y0 + ep, E.y1 - ep),
    ...glassPair('d', E.d1 - ELEV_GLASS_T, E.x0 + ep, E.x1 - ep, E.y0 + ep, E.y1 - ep),
    ...glassPair('x', E.x1 - ELEV_GLASS_T, E.d0 + ep, E.d1 - ep, E.y0 + ep, E.y1 - ep),
  );

  // --- Несущий каркас тамбура главного входа (ВБ7/ВБ8; стёкла и импосты строит windows.js) ---
  const V = Z.vestibule;
  const vf = VEST_FRAME;
  const vDoorX0 = (V.x0 + V.x1 - V.doorW) / 2;
  const vDoorX1 = vDoorX0 + V.doorW;
  elevFrame.push(
    // Угловые стойки и верхние балки тамбура
    box(V.x0, V.x0 + vf, 0, V.h, V.d1 - vf, V.d1),
    box(V.x1 - vf, V.x1, 0, V.h, V.d1 - vf, V.d1),
    box(V.x0, V.x1, V.h - vf, V.h, V.d1 - vf, V.d1),
    box(V.x0, V.x0 + vf, V.h - vf, V.h, V.d0, V.d1),
    box(V.x1 - vf, V.x1, V.h - vf, V.h, V.d0, V.d1),
    // Портал внутренних дверей тамбура (горизонтальный ригель V.doorH строит windows.js)
    box(vDoorX0 - vf, vDoorX0, 0, V.h - vf, V.d1 - vf, V.d1),
    box(vDoorX1, vDoorX1 + vf, 0, V.h - vf, V.d1 - vf, V.d1),
  );

  batch.add('walls', M.steelGray, [...elevFrame, ...fireBoxGeoms], { tag: 'framesGray' });
  batch.add('walls', M.steel, steelFrames, { tag: 'steelDetails' });
  batch.add('walls', M.glass, glassPanels, { tag: 'archGlass', shadow: false });
  batch.add('walls', M.booth, boothRecesses, { tag: 'recesses', shadow: false });

  // ===========================================================================
  //  7. ПОТОЛКИ 1-ГО И 2-ГО ЭТАЖЕЙ (слой ceiling, ТОЛЬКО FrontSide, ny < -0.35!)
  // ===========================================================================
  const ceilings = [
    // 2-й этаж: 5 последовательных полос профиля foyerCeilY(d) от ВБ3 (−0,80) до стены витрин (20,22)
    slopedCeilStrip(R.x0, R.x1, R.dGlass2, C2.glassY, C2.shelfFromD, C2.shelfY),
    slopedCeilStrip(R.x0, R.x1, C2.shelfFromD, C2.shelfY, C2.rampFromD, C2.shelfY),
    slopedCeilStrip(R.x0, R.x1, C2.rampFromD, C2.shelfY, C2.rampToD, C2.atriumY),
    slopedCeilStrip(R.x0, R.x1, C2.rampToD, C2.atriumY, C2.bendD, C2.atriumY),
    slopedCeilStrip(R.x0, R.x1, C2.bendD, C2.atriumY, R.dWall2, C2.wallY),

    // Потолки двух коридоров 2-го этажа в Большой зал
    ...Z.corridors.map((c) => rect('y', c.y0 + c.h, c.x0, c.x1, c.d0, c.d1, -1)),

    // 1-й этаж: оконная галерея и тамбур (Y = 2,53), аккуратно обходя шахту подъёмника МГН и атриум
    rect('y', C1.reception, R.x0, R.x1, R.dGlass1, Z.elevator.d0, -1),
    rect('y', C1.reception, Z.elevator.x1, R.x1, Z.elevator.d0, A.westD, -1),

    // 1-й этаж: перекрытие над гардеробом (трапеция под южным балконом, Y = 2,65)
    horizontalShape(
      [
        [A.southEdge[0][0], A.southEdge[0][1]],
        [R.x1, A.southEdge[0][1]],
        [R.x1, R.dWhite1],
        [A.southEdge[1][0], R.dWhite1],
      ],
      C1.wardrobeSlab,
      -1,
    ),

    // 1-й этаж: потолок под мостиком буфета (Y = 2,82)
    rect('y', C1.buffet, B.x0, B.x1, B.d0, B.d1, -1),

    // 1-й этаж: потолок коридора прохода за белой стеной и правого коридора у дивана (Y = 2,45)
    rect('y', Z.passage.h, Z.passage.x0, Z.passage.x1, R.dWhite1, Z.passage.d1, -1),
    rect('y', Z.sideCorridor.h, Z.sideCorridor.x0, Z.sideCorridor.x1, Z.sideCorridor.d0, Z.sideCorridor.d1, -1),
  ];

  batch.add('ceiling', M.ceilPerfGray, ceilings, { tag: 'ceiling', shadow: false });
}
