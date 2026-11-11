// =============================================================================
//  ПАРАМЕТРИЧЕСКОЕ ЯДРО ГЕОМЕТРИИ ЗРИТЕЛЬНОГО ЗАЛА БОЛЬШОЙ СЦЕНЫ (Патч 1, ч. 2)
//  Все узлы плана, уклон пандусов, спуск передних углов (-0,85 м) и C¹-карниз
//  строятся строго из DIM без дублирования тригонометрии в 3D, свете и DXF.
// =============================================================================

import './dimensions.js';

var _dim = null;
var _contour = [];
var _outerBreaks = [];
var _byId = {};
var _rake = 0;
var _stepHalfX = 0;

function clamp01(t) {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

function smooth01(t) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

/** Инициализируется синхронно из dimensions.js сразу после объявления DIM. */
export function _initHallGeometry(DIM) {
  if (_dim) return;
  _dim = DIM;
  const h = DIM.hall;
  const hallHalf = h.width / 2;
  _rake = Math.tan((h.rakeDeg * Math.PI) / 180);
  _stepHalfX = +((h.seatsPerRow / 2) * h.seatWidth + h.stepMargin).toFixed(4);

  const xPeak = hallHalf + h.nicheMinDepth; // 8.20
  const xValley = hallHalf + h.nicheMaxDepth; // 8.70
  const toothDX = xValley - xPeak; // 0.50

  // Угол длинных граней 2,30 м и косой передней дверной панели 1,75 м
  const sinLong = toothDX / h.sawtoothLong;
  const cosLong = Math.sqrt(1 - sinLong * sinLong);
  const pd = DIM.openings.portalDoors;

  const P0 = { id: 'P0', x: xPeak, d: 0 };
  const P1 = {
    id: 'P1',
    x: xPeak + pd.width * sinLong,
    d: -pd.width * cosLong,
  };
  const Z0 = { id: 'Z0', x: xPeak, d: h.sawtoothStartD };

  const dLong = Math.sqrt(h.sawtoothLong * h.sawtoothLong - toothDX * toothDX);
  const dShort = Math.sqrt(h.sawtoothShort * h.sawtoothShort - toothDX * toothDX);
  const toothStepD = dLong + dShort;

  const teeth = [];
  for (let k = 0; k < h.sawtoothTeeth; k++) {
    const v = {
      id: `V${k + 1}`,
      x: xValley,
      d: h.sawtoothStartD - k * toothStepD - dLong,
    };
    const z = {
      id: `Z${k + 1}`,
      x: xPeak,
      d: h.sawtoothStartD - (k + 1) * toothStepD,
    };
    teeth.push(v, z);
  }
  const ZLast = teeth[teeth.length - 1];

  const flareRad = (h.exitFlareAngleDeg * Math.PI) / 180;
  const E1 = {
    id: 'E1',
    x: ZLast.x + h.exitFlareLen * Math.sin(flareRad),
    d: ZLast.d - h.exitFlareLen * Math.cos(flareRad),
  };
  const E2 = {
    id: 'E2',
    x: E1.x,
    d: E1.d - h.exitStraightLen,
  };
  const B3 = {
    id: 'B3',
    x: E2.x - h.exitBackWallW,
    d: E2.d,
  };
  const B2 = {
    id: 'B2',
    x: B3.x,
    d: B3.d + h.boothSideLen,
  };
  const B1 = {
    id: 'B1',
    x: h.boothFrontWidth / 2,
    d: -h.portalToBoothWall,
  };

  const nodes = [P0, P1, Z0, ...teeth, E1, E2, B3, B2, B1].map((p) => Object.freeze(p));
  _contour = (_contour || []);
  _contour.length = 0;
  _contour.push(...nodes);
  Object.freeze(_contour);

  _byId = _byId || {};
  for (const p of nodes) _byId[p.id] = p;
  Object.freeze(_byId);

  _outerBreaks = _outerBreaks || [];
  _outerBreaks.length = 0;
  _outerBreaks.push(P0, P1, Z0, ...teeth, E1, E2);
  Object.freeze(_outerBreaks);
}

export { _contour as HALL_CONTOUR_RIGHT, _outerBreaks as HALL_OUTER_BREAKS, _byId as HALL_CONTOUR_BY_ID };

/** Нижнее ребро боковой лестницы авансцены X ≥ 0 на участке d ∈ [−depth, 0]. */
export function stairBottomX(d) {
  const fs = _dim.forestage;
  const fw2 = fs.frontWidth / 2;
  const bw2 = fs.backWidth / 2;
  const slopeLenD = fs.depth - fs.sideStraight; // 0.85
  const clampedD = Math.max(-fs.depth, Math.min(0, d));
  return fw2 + (fs.depth + clampedD) * ((bw2 - fw2) / slopeLenD);
}

/** Внешняя координата X ≥ 0 нижнего контура стен зала на глубине d ∈ [E2.d, 0]. */
export function hallOuterXAtD(d) {
  const pts = _outerBreaks;
  if (d >= pts[0].d) return pts[0].x;
  const last = pts[pts.length - 1];
  if (d <= last.d) return last.x;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (d <= a.d && d >= b.d) {
      const t = (a.d - d) / (a.d - b.d);
      return a.x + (b.x - a.x) * t;
    }
  }
  return last.x;
}

/** Внутренняя минимальная координата |X| пола зала на глубине d ∈ [E2.d, 0]. */
export function hallInnerMinXAtD(d) {
  const fsDepth = _dim.forestage.depth;
  const boothD = -_dim.hall.portalToBoothWall;
  if (d > -fsDepth) return stairBottomX(d);
  if (d > boothD) return 0;
  const B1 = _byId.B1, B2 = _byId.B2, B3 = _byId.B3;
  if (d >= B2.d) {
    const t = (B1.d - d) / (B1.d - B2.d);
    return B1.x + (B2.x - B1.x) * t;
  }
  return B3.x;
}

/** Принадлежность точки (x, d) фактическому полу зрительного зала (с «кишками» и без операторской). */
export function inHallFloor(x, d) {
  if (d > 0 || d < _byId.E2.d) return false;
  const ax = Math.abs(x);
  return ax >= hallInnerMinXAtD(d) - 1e-6 && ax <= hallOuterXAtD(d) + 1e-6;
}

/** Гладкий профиль бокового пандуса и выположенного тамбура выхода (без ступеней). */
export function hallRampY(d) {
  const h = _dim.hall;
  const floor0 = -_dim.forestage.height;
  const secondRowD = -(_dim.forestage.depth + h.firstRowGap + h.rowPitch); // -5.70
  if (d >= secondRowD) return floor0;
  const turnD = _byId.E1.d; // -17.7418
  const effD = Math.max(d, turnD);
  return floor0 + (secondRowD - effD) * _rake;
}

/**
 * Пол зрительного зала Y(d, x):
 *  • по центру |x| ≤ STEP_HALF_X на рядах 2..15 — горизонтальные ступени;
 *  • в боковых проходах |x| > STEP_HALF_X и за 15-м рядом — гладкий пандус 9° и горизонт у выходов;
 *  • в передних боковых карманах d ∈ (−2,75; 0] — плавный спуск от −0,75 до −0,85 м у косых дверей и портала.
 */
export function hallFloorY(d, x = 0) {
  const h = _dim.hall;
  const fs = _dim.forestage;
  const floor0 = -fs.height; // -0.75
  const ax = Math.abs(x);

  // Передние боковые карманы d ∈ (−2,75; 0] снаружи авансцены
  if (d > -fs.depth) {
    const clampedD = Math.min(0, d);
    const xStair = stairBottomX(clampedD);
    if (ax < fs.frontWidth / 2 && x === 0) return floor0;
    const cornerY = h.frontCornerFloorY; // -0.85
    const yInner = floor0 + (cornerY - floor0) * clamp01((fs.depth + clampedD) / fs.depth);
    const p1D = _byId.P1.d;
    const yOuter = clampedD >= p1D
      ? cornerY
      : cornerY + (floor0 - cornerY) * smooth01((p1D - clampedD) / (fs.depth + p1D));
    const xOuter = Math.max(xStair + 1e-6, hallOuterXAtD(clampedD));
    const u = smooth01((ax - xStair) / (xOuter - xStair));
    return yInner + (yOuter - yInner) * u;
  }

  const firstRowD = -(fs.depth + h.firstRowGap); // -4.90
  const secondRowD = firstRowD - h.rowPitch; // -5.70
  if (d >= secondRowD) return floor0; // партер и 1-й ряд без ступени

  const lastStepBackD = firstRowD - h.rows * h.rowPitch; // -16.90
  if (ax <= _stepHalfX && d > lastStepBackD) {
    const row = Math.min(h.rows - 1, Math.floor((firstRowD - d) / h.rowPitch));
    return floor0 + row * h.rowPitch * _rake;
  }

  return hallRampY(d);
}

/**
 * Низ нависающего карниза и потолка выходных тамбуров Y_canopy(d):
 *  • d ∈ (−5,70; 0] — C¹-гладкая парабола от +1,45 м у портала до +2,00 м у 2-го ряда (с наклоном RAKE);
 *  • d ∈ [−17,7418; −5,70] — параллельно пандусу в 2,75 м над ним;
 *  • d < −17,7418 — горизонтальный потолок выходного тамбура (+3,9072 м).
 */
export function hallCanopyY(d) {
  const h = _dim.hall;
  const y0 = h.frontCornerFloorY + h.canopyHeightAtPortal; // -0.85 + 2.30 = +1.45
  if (d >= 0) return y0;
  const secondRowD = -(_dim.forestage.depth + h.firstRowGap + h.rowPitch); // -5.70
  if (d > secondRowD) {
    const s = -d;
    const s1 = -secondRowD; // 5.70
    const y1 = -_dim.forestage.height + h.canopyHeightMain; // -0.75 + 2.75 = +2.00
    const dy = y1 - y0; // 0.55
    const v0 = (2 * dy) / s1 - _rake;
    const a = (_rake - v0) / (2 * s1);
    return y0 + v0 * s + a * s * s;
  }
  return hallRampY(d) + h.canopyHeightMain;
}

/**
 * Сегменты нижнего пояса стен зрительного зала, «кишки» выхода и операторской для стороны side ∈ {−1, +1}.
 * У каждого сегмента нормаль внутрь зала получается из направления (x0, d0) → (x1, d1) с учётом знака side.
 */
export function hallSideWallSegments(side) {
  const s = side >= 0 ? 1 : -1;
  const pd = _dim.openings.portalDoors;
  const ed = _dim.openings.hallExitDoors;
  const bd = _dim.openings.boothDoors;
  const exitSillY = hallRampY(_byId.E2.d);

  const seg = (id, kind, a, b, door = null) => ({
    id,
    kind,
    x0: s * a.x,
    d0: a.d,
    x1: s * b.x,
    d1: b.d,
    door,
  });

  const list = [
    seg('frontDoor', 'beige', _byId.P0, _byId.P1, {
      width: pd.width,
      height: pd.height,
      leaves: 2,
      sillY: pd.sillY,
    }),
    seg('frontReturn', 'beige', _byId.P1, _byId.Z0),
  ];

  for (let k = 1; k <= _dim.hall.sawtoothTeeth; k++) {
    list.push(
      seg(`toothLong${k}`, 'beige', _byId[`Z${k - 1}`], _byId[`V${k}`]),
      seg(`toothShort${k}`, 'beige', _byId[`V${k}`], _byId[`Z${k}`]),
    );
  }

  list.push(
    seg('exitFlare', 'beige', _byId.Z4, _byId.E1),
    seg('exitStraight', 'beige', _byId.E1, _byId.E2),
    seg('exitBack', 'beige', _byId.E2, _byId.B3, {
      width: ed.width,
      height: ed.height,
      leaves: 2,
      sillY: exitSillY,
    }),
    seg('boothSide', 'panel', _byId.B3, _byId.B2),
    seg('boothChamfer', 'panel', _byId.B2, _byId.B1, {
      width: bd.width,
      height: bd.height,
      leaves: 1,
      sillY: exitSillY,
    }),
  );

  return list;
}

/** 4 внутренних угла «ёлочки» для стороны side ∈ {−1, +1} под вертикальные LED-полосы. */
export function hallLedCorners(side) {
  const s = side >= 0 ? 1 : -1;
  const out = [];
  for (let k = 1; k <= _dim.hall.sawtoothTeeth; k++) {
    const prev = _byId[`Z${k - 1}`];
    const v = _byId[`V${k}`];
    const next = _byId[`Z${k}`];
    const x = s * v.x, d = v.d;
    const dx1 = s * prev.x - x, dd1 = prev.d - d;
    const l1 = Math.hypot(dx1, dd1);
    const dx2 = s * next.x - x, dd2 = next.d - d;
    const l2 = Math.hypot(dx2, dd2);
    const bx = dx1 / l1 + dx2 / l2;
    const bd = dd1 / l1 + dd2 / l2;
    const bl = Math.hypot(bx, bd);
    out.push({
      k,
      x,
      d,
      y0: hallFloorY(d, x),
      y1: hallCanopyY(d),
      nx: bx / bl,
      nd: bd / bl,
    });
  }
  return out;
}
