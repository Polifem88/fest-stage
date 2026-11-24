// Лестницы и ограждения Фойе театра «ФЭСТ» (Этап 1 — черновик, слой stairs):
//  • ломаная парадная стальная лестница (13 косых нижних ступеней под 28° + трапециевидная площадка Y = 1,75
//    + 9 прямых верхних ступеней до Y = 3,00): тёмные корпуса ступеней с накладками проступи, белые наклонные
//    подшивки маршей и тонкая подшивка площадки; под площадкой и маршем — кладовая за чёрным молтоном,
//    проход 1,15 м за буфетом открыт;
//  • ограждения ОГ-2 (высота 0,95 м, отступ 0,10 м от кромки проёма, поручень Ø50,8 мм, стойки Ø38 мм
//    с латунными стаканами 0,18 м, вертикальные прутья Ø16 мм до ступени/пола, разреженный шаг на mobile);
//  • малая 5-ступенчатая лестница 2-го этажа (Y = 3,00 → 3,84) с площадкой и ограждением.
// Все габариты — из config/dimensions.js (FOYER); здесь только пропорции деталей.
import * as THREE from 'three';
import { box, prism, P } from '../../../core/geom.js';
import { tubeBetween } from '../../_template/build.js';
import { FOYER } from '../config/dimensions.js';

// Визуальные константы деталей
const TREAD_CAP = 0.05;         // толщина тёмной накладки проступи на площадках и ступенях
const PLINTH_OUT = 0.04;        // вынос цоколя нижней ступени по бокам марша
const RAIL_EDGE_INSET = 0.06;   // отступ оси ограждения от края лестничного марша
const COLLAR_SCALE = 1.35;      // отношение радиуса латунного стакана к радиусу стойки
const RAIL_SEG_DESKTOP = 8;     // число граней поручня и стоек на десктопе
const RAIL_SEG_MOBILE = 4;      // число граней труб на мобильном (бюджет треугольников ≤ 45k)
const BALUSTER_SEG_DESKTOP = 6; // число граней вертикальных балясин на десктопе
const BALUSTER_SEG_MOBILE = 4;  // 4-гранные призмы балясин на мобильном
const COL_CLEARANCE = 0.04;     // зазор при разрыве западного ограждения на гранях внутренних колонн
const MOLTON_PLEAT = 0.24;      // шаг складок молтона кладовой
const MOLTON_AMP = 0.035;       // глубина складок молтона
const MOLTON_SUBDIV = { desktop: 4, mobile: 2 };

const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Односторонний четырёхугольник с вычисленной нормалью по правилу правой руки. */
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

/**
 * Наклонная замкнутая 6-гранная балка-плита под маршем лестницы:
 * нижняя кромка соединяет [aL, aR] на yBotA с [bL, bR] на yBotB,
 * верхняя — те же концы на yTopA и yTopB (L → R по ширине марша, A → B вверх по маршу).
 */
function slopedSlab(aL, aR, bL, bR, yBotA, yTopA, yBotB, yTopB) {
  // Гарантируем положительную ориентацию (A→B × L→R вверх)
  const abx = bL[0] - aL[0], abd = bL[1] - aL[1];
  const lrx = aR[0] - aL[0], lrd = aR[1] - aL[1];
  // В Three.js (x, -d): (abx, 0, -abd) × (lrx, 0, -lrd) = (0, abx*lrd - abd*lrx, 0)
  const crossY = abx * lrd - abd * lrx;
  const [pAL, pAR, pBL, pBR] = crossY >= 0 ? [aL, aR, bL, bR] : [aR, aL, bR, bL];

  const bAL = P(pAL[0], yBotA, pAL[1]);
  const bAR = P(pAR[0], yBotA, pAR[1]);
  const bBL = P(pBL[0], yBotB, pBL[1]);
  const bBR = P(pBR[0], yBotB, pBR[1]);
  const tAL = P(pAL[0], yTopA, pAL[1]);
  const tAR = P(pAR[0], yTopA, pAR[1]);
  const tBL = P(pBL[0], yTopB, pBL[1]);
  const tBR = P(pBR[0], yTopB, pBR[1]);

  return [
    quad(tAL, tBL, tBR, tAR), // верх
    quad(bAL, bAR, bBR, bBL), // низ (подшивка марша)
    quad(bAL, bBL, tBL, tAL), // бок L
    quad(bAR, tAR, tBR, bBR), // бок R
    quad(bAL, tAL, tAR, bAR), // торец A
    quad(bBL, bBR, tBR, tBL), // торец B
  ];
}

/** Призма ступени из 4 углов (p00, p01 — передняя кромка, p11, p10 — задняя кромка) в (x, d). */
function stepPrism(p00, p01, p11, p10, y0, y1) {
  // Ориентируем CCW в (x, d) для корректных наружных нормалей prism()
  const area = (p01[0] - p00[0]) * (p11[1] - p00[1]) - (p01[1] - p00[1]) * (p11[0] - p00[0]);
  const pts = area >= 0 ? [p00, p01, p11, p10] : [p00, p10, p11, p01];
  return prism(pts, y0, y1);
}

/**
 * Секция ограждения ОГ-2 от точки p0=[x,y,d] до p1=[x,y,d]:
 * поручень Ø50,8, стойки Ø38 (шаг 1,00 м) с латунными стаканами 0,18 м,
 * вертикальные балясины Ø16 от ступени/пола до поручня (шаг 0,10 м десктоп / 0,28 м мобильный).
 */
function addRailingRun(p0, p1, steel, brass, { mobile = false, withBrass = true } = {}) {
  const RL = FOYER.railing;
  const [x0, y0, d0] = p0;
  const [x1, y1, d1] = p1;
  const runLen = Math.hypot(x1 - x0, d1 - d0);
  if (runLen < 0.05) return;

  const railSeg = mobile ? RAIL_SEG_MOBILE : RAIL_SEG_DESKTOP;
  const balSeg = mobile ? BALUSTER_SEG_MOBILE : BALUSTER_SEG_DESKTOP;
  const balStep = mobile ? RL.balusterStepMobile : RL.balusterStep;

  const top0 = P(x0, y0 + RL.h, d0);
  const top1 = P(x1, y1 + RL.h, d1);
  // Поручень (нижней горизонтальной связки у ОГ-2 нет — 180818.jpg)
  steel.push(tubeBetween(top0, top1, RL.railR, railSeg));

  // Опорные стойки (шаг ~1,00 м) + латунные стаканы у основания
  const postCount = Math.max(1, Math.round(runLen / RL.postStep));
  const collarR = RL.postR * COLLAR_SCALE;
  for (let i = 0; i <= postCount; i++) {
    const t = i / postCount;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    const d = lerp(d0, d1, t);
    steel.push(tubeBetween(P(x, y, d), P(x, y + RL.h, d), RL.postR, railSeg));
    if (withBrass) {
      if (mobile) {
        brass.push(box(x - collarR, x + collarR, y, y + RL.collarH, d - collarR, d + collarR));
      } else {
        const g = new THREE.CylinderGeometry(collarR, collarR, RL.collarH, railSeg, 1, false);
        g.translate(x, y + RL.collarH / 2, -d);
        brass.push(g);
      }
    }
  }

  // Вертикальные балясины Ø16 мм между стойками
  const balCount = Math.max(1, Math.floor(runLen / balStep));
  for (let i = 1; i < balCount; i++) {
    const t = i / balCount;
    // Пропускаем балясину, если она почти совпадает со стойкой
    const nearestPost = Math.round(t * postCount) / postCount;
    if (Math.abs(t - nearestPost) * runLen < RL.postR * 2) continue;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    const d = lerp(d0, d1, t);
    steel.push(tubeBetween(P(x, y, d), P(x, y + RL.h, d), RL.balusterR, balSeg));
  }
}

/**
 * Чёрный молтон со складками между точками a=[x,d] и b=[x,d] от пола (Y = 0)
 * до верхних отметок yTopA / yTopB (низ подшивки марша или площадки).
 */
function moltonRun(a, b, yTopA, yTopB, mobile) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const td = (b[1] - a[1]) / len;
  const step = MOLTON_PLEAT / (mobile ? MOLTON_SUBDIV.mobile : MOLTON_SUBDIV.desktop);
  const n = Math.max(2, Math.round(len / step));
  const pos = [];
  const col = (i) => {
    const t = i / n;
    const w = MOLTON_AMP * Math.sin(((len * t) / MOLTON_PLEAT) * Math.PI * 2);
    return {
      x: a[0] + (b[0] - a[0]) * t + td * w,
      d: a[1] + (b[1] - a[1]) * t - tx * w,
      y: yTopA + (yTopB - yTopA) * t,
    };
  };
  for (let i = 0; i < n; i++) {
    const c0 = col(i);
    const c1 = col(i + 1);
    pos.push(
      c0.x, c0.y, -c0.d, c0.x, 0, -c0.d, c1.x, 0, -c1.d,
      c0.x, c0.y, -c0.d, c1.x, 0, -c1.d, c1.x, c1.y, -c1.d,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Корпус ступени (тёмный) + накладка проступи (плитка) по 4 углам в (x, d). */
function addStep(bodiesDark, treads, p00, p01, p11, p10, y0, y1) {
  bodiesDark.push(stepPrism(p00, p01, p11, p10, y0, y1 - TREAD_CAP));
  treads.push(stepPrism(p00, p01, p11, p10, y1 - TREAD_CAP, y1));
}

/** Разрезать отрезок [xA, xB] по X, вырезая колонны (чтобы перила не проходили сквозь бетон). */
function subtractSpans(xA, xB, obstacles) {
  let spans = [[xA, xB]];
  for (const [o0, o1] of obstacles) {
    const next = [];
    for (const [s0, s1] of spans) {
      if (o1 <= s0 || o0 >= s1) {
        next.push([s0, s1]);
      } else {
        if (o0 > s0 + 0.05) next.push([s0, o0]);
        if (o1 < s1 - 0.05) next.push([o1, s1]);
      }
    }
    spans = next;
  }
  return spans;
}

export function buildStairs(batch, M, { mobile = false } = {}) {
  const R = FOYER.room;
  const A = FOYER.atrium;
  const S = FOYER.stairs;
  const RL = FOYER.railing;
  const SS = FOYER.smallStairs;

  const treads = [];
  const bodies = [];
  const bodiesDark = [];
  const molton = [];
  const steel = [];
  const brass = [];

  // ===========================================================================
  //  1. НИЖНИЙ МАРШ ПАРАДНОЙ ЛЕСТНИЦЫ (13 ступеней, поворот 28° к атриуму)
  // ===========================================================================
  const [bL, bR] = S.lower.bottom;
  const [tL, tR] = S.lower.top;
  const nLow = S.lower.risers;
  const lowRise = S.landingY / nLow;
  const lowW = Math.hypot(bR[0] - bL[0], bR[1] - bL[1]);

  for (let i = 0; i < nLow; i++) {
    const u0 = i / nLow;
    const u1 = (i + 1) / nLow;
    const y0 = i * lowRise;
    const y1 = (i + 1) * lowRise;
    const p00 = lerp2(bL, tL, u0);
    const p01 = lerp2(bR, tR, u0);
    const p10 = lerp2(bL, tL, u1);
    const p11 = lerp2(bR, tR, u1);
    addStep(bodiesDark, treads, p00, p01, p11, p10, y0, y1);
    if (i === 0) {
      // Выступающий по бокам цоколь нижней ступени
      const k = -PLINTH_OUT / lowW;
      bodiesDark.push(stepPrism(
        lerp2(p00, p01, k), lerp2(p01, p00, k), lerp2(p11, p10, k), lerp2(p10, p11, k),
        y0, y1 - TREAD_CAP,
      ));
    }
  }
  // Несущая наклонная плита-косоур с белой подшивкой строго под внутренними углами ступеней нижнего марша
  const lowUnderL = lerp2(bL, tL, 1 / nLow);
  const lowUnderR = lerp2(bR, tR, 1 / nLow);
  bodies.push(
    ...slopedSlab(
      lowUnderL,
      lowUnderR,
      tL,
      tR,
      0,
      0,
      S.landingY - lowRise - S.slabThick,
      S.landingY - lowRise,
    ),
  );

  // ===========================================================================
  //  2. ПРОМЕЖУТОЧНАЯ ТРАПЕЦИЕВИДНАЯ ПЛОЩАДКА (Y = 1,75): накладка + тонкая светлая подшивка
  // ===========================================================================
  const yLandingSoffit = S.landingY - TREAD_CAP - S.slabThick;
  treads.push(prism(S.landing, S.landingY - TREAD_CAP, S.landingY));
  bodies.push(prism(S.landing, yLandingSoffit, S.landingY - TREAD_CAP));

  // ===========================================================================
  //  3. ВЕРХНИЙ МАРШ ПАРАДНОЙ ЛЕСТНИЦЫ (9 прямых ступеней, Y = 1,75 → 3,00)
  // ===========================================================================
  const U = S.upper;
  const nUp = U.risers;
  const upRise = (R.y2 - S.landingY) / nUp;
  const stepDx = (U.xTop - U.xBot) / nUp;

  for (let i = 0; i < nUp; i++) {
    const xa = U.xBot + i * stepDx;
    const xb = U.xBot + (i + 1) * stepDx;
    const y0 = S.landingY + i * upRise;
    const y1 = S.landingY + (i + 1) * upRise;
    bodiesDark.push(box(xb, xa, y0, y1 - TREAD_CAP, U.d0, U.d1));
    treads.push(box(xb, xa, y1 - TREAD_CAP, y1, U.d0, U.d1));
  }
  // Наклонная плита с белой подшивкой строго под внутренними углами верхнего марша (проход 1,15 м свободен!)
  const upUnderX = U.xBot + stepDx;
  const ySoffitA = S.landingY - S.slabThick;
  const ySoffitB = R.y2 - upRise - S.slabThick;
  bodies.push(
    ...slopedSlab(
      [upUnderX, U.d0],
      [upUnderX, U.d1],
      [U.xTop, U.d0],
      [U.xTop, U.d1],
      ySoffitA,
      S.landingY,
      ySoffitB,
      R.y2 - upRise,
    ),
  );
  /** Низ наклонной подшивки верхнего марша над точкой x. */
  const upperSoffitY = (x) => lerp(ySoffitA, ySoffitB, (x - upUnderX) / (U.xTop - upUnderX));

  // Кладовая под лестницей: чёрный молтон по правой границе прохода и по задней кромке площадки
  const US = S.underStorage;
  const [sa, sb] = US.side;
  molton.push(moltonRun(sa, sb, upperSoffitY(sa[0]), upperSoffitY(sb[0]), mobile));
  const [ba, bb] = US.back;
  molton.push(moltonRun(ba, bb, yLandingSoffit, yLandingSoffit, mobile));

  // ===========================================================================
  //  4. ОГРАЖДЕНИЯ ОГ-2: ПЕРИМЕТР ВТОРОГО СВЕТА + ОБА МАРША ПАРАДНОЙ ЛЕСТНИЦЫ
  // ===========================================================================
  const ins = RL.inset;
  const elevX1 = FOYER.zones.elevator.x1;

  // 4.1. Западная кромка вдоль внутренних колонн (с разрывами на колоннах оси 1)
  const colSpans = FOYER.columns.inner.map((c) => [c.x0 - COL_CLEARANCE, c.x1 + COL_CLEARANCE]);
  const westRuns = subtractSpans(elevX1 + ins, A.westX1 + ins, colSpans);
  for (const [xa, xb] of westRuns) {
    addRailingRun([xa, R.y2, A.westD - ins], [xb, R.y2, A.westD - ins], steel, brass, { mobile });
  }
  // Короткий поворот от угла подъёмника МГН к западной кромке атриума
  addRailingRun(
    [elevX1 + ins, R.y2, FOYER.zones.elevator.d1],
    [elevX1 + ins, R.y2, A.westD - ins],
    steel,
    brass,
    { mobile },
  );

  // 4.2. Южная скошенная кромка балкона экрана (смещена на +inset в сторону пола экрана)
  const [s0, s1] = A.southEdge;
  const sLen = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  // Наружная нормаль в сторону экрана (+X)
  const snx = (s1[1] - s0[1]) / sLen;
  const snd = -(s1[0] - s0[0]) / sLen;
  const southA = [s0[0] + snx * ins, R.y2, s0[1] - ins];
  const southB = [s1[0] + snx * ins, R.y2, s1[1] + ins];
  addRailingRun(southA, southB, steel, brass, { mobile });

  // 4.3. Восточная кромка галереи 2-го этажа (от южного угла до верха лестницы X = −6,15)
  addRailingRun(southB, [A.eastX0, R.y2, A.eastD + ins], steel, brass, { mobile });

  // 4.4. Мостик над буфетом (западный край мостика d = 11,45 + inset, от кирпичной стены до лестницы)
  addRailingRun([R.x0, R.y2, A.buffetEdgeD + ins], [A.buffetX1, R.y2, A.buffetEdgeD + ins], steel, brass, { mobile });

  // 4.5. Обе стороны нижнего марша (смещение внутрь марша на RAIL_EDGE_INSET)
  const lowInsetFrac = RAIL_EDGE_INSET / lowW;
  const lbIn = lerp2(bL, bR, lowInsetFrac);
  const ltIn = lerp2(tL, tR, lowInsetFrac);
  const rbIn = lerp2(bR, bL, lowInsetFrac);
  const rtIn = lerp2(tR, tL, lowInsetFrac);
  addRailingRun([lbIn[0], 0, lbIn[1]], [ltIn[0], S.landingY, ltIn[1]], steel, brass, { mobile });
  addRailingRun([rbIn[0], 0, rbIn[1]], [rtIn[0], S.landingY, rtIn[1]], steel, brass, { mobile });

  // 4.6. Кромки промежуточной площадки Y = 1,75 (открытая сторона и задняя сторона)
  const upOpenD = U.d0 + RAIL_EDGE_INSET;
  const upWallD = U.d1 - RAIL_EDGE_INSET;
  addRailingRun([ltIn[0], S.landingY, ltIn[1]], [U.xBot, S.landingY, upOpenD], steel, brass, { mobile });
  addRailingRun([rtIn[0], S.landingY, rtIn[1]], [U.xBot, S.landingY, upWallD], steel, brass, { mobile });

  // 4.7. Обе стороны верхнего марша (Y = 1,75 → 3,00)
  addRailingRun([U.xBot, S.landingY, upOpenD], [U.xTop, R.y2, upOpenD], steel, brass, { mobile });
  addRailingRun([U.xBot, S.landingY, upWallD], [U.xTop, R.y2, upWallD], steel, brass, { mobile });

  // ===========================================================================
  //  5. МАЛАЯ 5-СТУПЕНЧАТАЯ ЛЕСТНИЦА 2-ГО ЭТАЖА (Y = 3,00 → 3,84) И ОГРАЖДЕНИЕ
  // ===========================================================================
  const landX1 = SS.x0 + SS.landingW;
  // Площадка у двери операторской
  treads.push(box(SS.x0, landX1, SS.y1 - TREAD_CAP, SS.y1, SS.d0, SS.d1));
  bodies.push(box(SS.x0, landX1, SS.y0, SS.y1 - TREAD_CAP, SS.d0, SS.d1));

  // 5 ступеней от x1 (−4,92) вверх к площадке (landX1 = −6,60)
  const smRise = (SS.y1 - SS.y0) / SS.risers;
  const smTread = (SS.x1 - landX1) / SS.risers;
  for (let i = 0; i < SS.risers; i++) {
    const xa = SS.x1 - i * smTread;
    const xb = SS.x1 - (i + 1) * smTread;
    const yTop = SS.y0 + (i + 1) * smRise;
    const yBot = SS.y0 + i * smRise;
    treads.push(box(xb, xa, yBot, yTop, SS.d0, SS.d1));
    if (i > 0) bodies.push(box(xb, xa, SS.y0, yBot, SS.d0, SS.d1));
  }

  // Чёрное ограждение малой лестницы (высота 0,95 м, без латунных стаканов)
  const smRailD = SS.d0 + RAIL_EDGE_INSET;
  addRailingRun([SS.x0 + RAIL_EDGE_INSET, SS.y1, SS.d1], [SS.x0 + RAIL_EDGE_INSET, SS.y1, smRailD], steel, brass, {
    mobile,
    withBrass: false,
  });
  addRailingRun([SS.x0 + RAIL_EDGE_INSET, SS.y1, smRailD], [landX1, SS.y1, smRailD], steel, brass, {
    mobile,
    withBrass: false,
  });
  addRailingRun([landX1, SS.y1, smRailD], [SS.x1, SS.y0, smRailD], steel, brass, {
    mobile,
    withBrass: false,
  });

  // --- Упаковка в слой stairs ---
  batch.add('stairs', M.tileFloorDark, treads, { tag: 'stairTreads' });
  batch.add('stairs', M.plasterLight, bodies, { tag: 'stairStructure' });
  batch.add('stairs', M.booth, bodiesDark, { tag: 'stairBodies' });
  batch.add('stairs', M.molton, molton, { tag: 'underStorage', shadow: false });
  batch.add('stairs', M.steel, steel, { tag: 'railings' });
  batch.add('stairs', M.brass, brass, { tag: 'railingCollars' });
}
