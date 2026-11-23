// Стационарный интерьер Фойе (Этап 1):
// LED-экран Ancomp P2 (слой walls), стойки B1/B2/гардероба, оранжевые ребристые диваны
// 1-го и 2-го этажей и 5 стеклянных витрин (слой furniture).
import { box } from '../../../core/geom.js';
import { FOYER } from '../config/dimensions.js';

// Визуальные пропорции и зазоры деталей, м
const SCREEN_PANEL_RECESS = 0.008;

const COUNTER_KICK_H = 0.10;
const COUNTER_KICK_INSET = 0.04;
const COUNTER_TOP_H = 0.06;
const COUNTER_TOP_OVERHANG = 0.02;

const SOFA_PLINTH_H = 0.24;
const SOFA_PLINTH_INSET = 0.03;
const SOFA_SEAT_H = 0.18;
const SOFA_BACK_H = 0.44;
const SOFA_BACK_T = 0.18;
const SOFA_BACK_SPINE_RATIO = 0.35;
const SOFA_RIB_STEP = 0.22;
const SOFA_RIB_STEP_MOBILE = 0.45;
const SOFA_RIB_GAP = 0.015;

const CASE_PLINTH_H = 0.35;
const CASE_CAP_H = 0.06;
const CASE_POST_W = 0.03;
const CASE_GLASS_T = 0.008;
const CASE_GLASS_INSET = 0.015;
const CASE_SHELVES = 3;
const CASE_SHELF_T = 0.012;

function buildScreen(batch, M) {
  const S = FOYER.screen;
  const x1 = S.x;
  const x0 = S.x - S.protrude;
  const y0 = S.y0;
  const y1 = S.y0 + S.h;
  const { d0, d1, frame: f } = S;

  // Тонкая чёрная рама по периметру экрана (строго внутри габарита 5,12 × 2,88 м)
  const frameGeoms = [
    box(x0, x1, y0, y0 + f, d0, d1),
    box(x0, x1, y1 - f, y1, d0, d1),
    box(x0, x1, y0 + f, y1 - f, d0, d0 + f),
    box(x0, x1, y0 + f, y1 - f, d1 - f, d1),
  ];
  batch.add('walls', M.steel, frameGeoms, { tag: 'screenFrame' });
  batch.add('walls', M.booth, box(x0 + SCREEN_PANEL_RECESS, x1, y0 + f, y1 - f, d0 + f, d1 - f), { tag: 'screen' });
}

function addCounter(geoms, { x0, x1, d0, d1, y0 = 0, h }) {
  const yKick = y0 + COUNTER_KICK_H;
  const yBodyTop = y0 + h - COUNTER_TOP_H;
  geoms.kick.push(box(x0 + COUNTER_KICK_INSET, x1 - COUNTER_KICK_INSET, y0, yKick, d0 + COUNTER_KICK_INSET, d1 - COUNTER_KICK_INSET));
  geoms.slats.push(box(x0, x1, yKick, yBodyTop, d0, d1));
  geoms.top.push(box(x0 - COUNTER_TOP_OVERHANG, x1 + COUNTER_TOP_OVERHANG, yBodyTop, y0 + h, d0 - COUNTER_TOP_OVERHANG, d1 + COUNTER_TOP_OVERHANG));
}

function addSofa(geoms, s, ribStep) {
  const y0 = s.y0 ?? 0;
  const yPlinth = y0 + SOFA_PLINTH_H;
  const ySeat = yPlinth + SOFA_SEAT_H;
  const yBack = ySeat + SOFA_BACK_H;
  const spineT = SOFA_BACK_T * SOFA_BACK_SPINE_RATIO;

  geoms.slats.push(box(
    s.x0 + SOFA_PLINTH_INSET, s.x1 - SOFA_PLINTH_INSET,
    y0, yPlinth,
    s.d0 + SOFA_PLINTH_INSET, s.d1 - SOFA_PLINTH_INSET,
  ));

  if (s.facing === '-d' || s.facing === '+d') {
    const backAtD1 = s.facing === '-d';
    const seatD0 = backAtD1 ? s.d0 : s.d0 + SOFA_BACK_T;
    const seatD1 = backAtD1 ? s.d1 - SOFA_BACK_T : s.d1;
    const spineD0 = backAtD1 ? s.d1 - spineT : s.d0;
    const spineD1 = backAtD1 ? s.d1 : s.d0 + spineT;
    const ribD0 = backAtD1 ? s.d1 - SOFA_BACK_T : s.d0 + spineT;
    const ribD1 = backAtD1 ? s.d1 - spineT : s.d0 + SOFA_BACK_T;

    geoms.seat.push(box(s.x0, s.x1, yPlinth, ySeat, seatD0, seatD1));
    geoms.velvet.push(box(s.x0, s.x1, yPlinth, yBack, spineD0, spineD1));

    const len = s.x1 - s.x0;
    const n = Math.max(2, Math.round(len / ribStep));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const rx0 = s.x0 + i * step + SOFA_RIB_GAP / 2;
      const rx1 = s.x0 + (i + 1) * step - SOFA_RIB_GAP / 2;
      geoms.velvet.push(box(rx0, rx1, yPlinth, yBack, ribD0, ribD1));
    }
  } else {
    const backAtX0 = s.facing === '+x';
    const seatX0 = backAtX0 ? s.x0 + SOFA_BACK_T : s.x0;
    const seatX1 = backAtX0 ? s.x1 : s.x1 - SOFA_BACK_T;
    const spineX0 = backAtX0 ? s.x0 : s.x1 - spineT;
    const spineX1 = backAtX0 ? s.x0 + spineT : s.x1;
    const ribX0 = backAtX0 ? s.x0 + spineT : s.x1 - SOFA_BACK_T;
    const ribX1 = backAtX0 ? s.x0 + SOFA_BACK_T : s.x1 - spineT;

    geoms.seat.push(box(seatX0, seatX1, yPlinth, ySeat, s.d0, s.d1));
    geoms.velvet.push(box(spineX0, spineX1, yPlinth, yBack, s.d0, s.d1));

    const len = s.d1 - s.d0;
    const n = Math.max(2, Math.round(len / ribStep));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const rd0 = s.d0 + i * step + SOFA_RIB_GAP / 2;
      const rd1 = s.d0 + (i + 1) * step - SOFA_RIB_GAP / 2;
      geoms.velvet.push(box(ribX0, ribX1, yPlinth, yBack, rd0, rd1));
    }
  }
}

function addShowcase(geoms, sc) {
  const x0 = sc.x - sc.w / 2;
  const x1 = sc.x + sc.w / 2;
  const d0 = sc.d1 - sc.depth;
  const d1 = sc.d1;
  const y0 = sc.y0;
  const y1 = sc.y0 + sc.h;
  const yGlass0 = y0 + CASE_PLINTH_H;
  const yGlass1 = y1 - CASE_CAP_H;
  const pw = CASE_POST_W;

  // Нижний цоколь и верхняя крышка
  geoms.kick.push(
    box(x0, x1, y0, yGlass0, d0, d1),
    box(x0, x1, yGlass1, y1, d0, d1),
  );
  // 4 угловые металлические стойки
  geoms.steel.push(
    box(x0, x0 + pw, yGlass0, yGlass1, d0, d0 + pw),
    box(x1 - pw, x1, yGlass0, yGlass1, d0, d0 + pw),
    box(x0, x0 + pw, yGlass0, yGlass1, d1 - pw, d1),
    box(x1 - pw, x1, yGlass0, yGlass1, d1 - pw, d1),
  );
  // 4 стеклянные стенки (чуть утоплены внутрь каркаса, чтобы исключить z-fighting)
  const gx0 = x0 + CASE_GLASS_INSET;
  const gx1 = x1 - CASE_GLASS_INSET;
  const gd0 = d0 + CASE_GLASS_INSET;
  const gd1 = d1 - CASE_GLASS_INSET;
  geoms.glass.push(
    box(gx0, gx1, yGlass0, yGlass1, gd0, gd0 + CASE_GLASS_T),
    box(gx0, gx1, yGlass0, yGlass1, gd1 - CASE_GLASS_T, gd1),
    box(gx0, gx0 + CASE_GLASS_T, yGlass0, yGlass1, gd0 + CASE_GLASS_T, gd1 - CASE_GLASS_T),
    box(gx1 - CASE_GLASS_T, gx1, yGlass0, yGlass1, gd0 + CASE_GLASS_T, gd1 - CASE_GLASS_T),
  );
  // Стеклянные полки внутри витрины
  const spanY = yGlass1 - yGlass0;
  for (let i = 1; i <= CASE_SHELVES; i++) {
    const sy = yGlass0 + (spanY * i) / (CASE_SHELVES + 1);
    geoms.glass.push(box(
      gx0 + CASE_GLASS_T, gx1 - CASE_GLASS_T,
      sy - CASE_SHELF_T / 2, sy + CASE_SHELF_T / 2,
      gd0 + CASE_GLASS_T, gd1 - CASE_GLASS_T,
    ));
  }
}

export function buildInterior(batch, M, { mobile = false } = {}) {
  buildScreen(batch, M);

  const F = FOYER.furniture;
  const W = FOYER.zones.wardrobe;
  const ribStep = mobile ? SOFA_RIB_STEP_MOBILE : SOFA_RIB_STEP;

  const geoms = { kick: [], slats: [], top: [], seat: [], velvet: [], steel: [], glass: [] };

  addCounter(geoms, F.receptionB1);
  addCounter(geoms, F.buffetB2);
  addCounter(geoms, {
    x0: W.counterX0,
    x1: W.counterX1,
    d0: W.counterD0,
    d1: W.counterD1,
    h: W.counterH,
  });

  for (const s of F.sofas1f) addSofa(geoms, s, ribStep);
  for (const s of F.sofas2f) addSofa(geoms, s, ribStep);
  for (const sc of F.showcases) addShowcase(geoms, sc);

  batch.add('furniture', M.booth, geoms.kick);
  batch.add('furniture', M.woodSlats, geoms.slats);
  batch.add('furniture', M.stageEdge, geoms.top);
  batch.add('furniture', M.seatFrame, geoms.seat);
  batch.add('furniture', M.velvetOrange, geoms.velvet);
  batch.add('furniture', M.steel, geoms.steel);
  batch.add('furniture', M.glass, geoms.glass, { shadow: false });
}
