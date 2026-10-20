// =============================================================================
//  ПРИБОРЫ — по «Схеме с развесом света».
//  Тип каждой позиции определён по значку на схеме (см. таблицу на проверку).
//  Порядок в списках — слева направо (как смотреть из зала) / спереди назад.
// =============================================================================
import { DIM } from './dimensions.js';
import { DEPTHS as D } from './rigging.js';

/**
 * shape: внешний вид упрощённой модели
 *   spot  — голова с подвесом-вилкой, длинный корпус (Spot)
 *   wash  — голова с вилкой, короткий корпус, большая линза (Wash)
 *   beam  — голова с вилкой, компактная (B-Eye)
 *   ledpar— большой круглый LED-прожектор на лире
 *   profile — профильный (эллипсоидный) прожектор
 *   fresnel — линзовый прожектор Френеля с шторками
 *   par   — PAR-64 (банка)
 *   follow— пушка (следящий прожектор) на штативе
 */
export const TYPES = {
  SPOT585: { name: 'Pro Phoenix Spot 585', shape: 'spot', beam: 16, legendCount: 8 },
  SPOT350: { name: 'Pro Phoenix Spot 350', shape: 'spot', beam: 18, legendCount: 10, scale: 0.85 },
  PLUTO: { name: 'Silver Star Pluto 8000', shape: 'ledpar', beam: 40, legendCount: 8 },
  WASHZOOM: { name: 'Dialighting WashZoom 37x15 V2', shape: 'wash', beam: 34, legendCount: 6, scale: 1.1 },
  WASH760: { name: 'Pro Phoenix Wash 760z', shape: 'wash', beam: 30, legendCount: 8 },
  BEYE: { name: 'Anzhee 7x60 WP B-Eye', shape: 'beam', beam: 20, legendCount: 4 },
  PROF_CW: { name: 'Anzhee Profilee 400 CW', shape: 'profile', beam: 26, legendCount: 8 },
  PROF_RGB: { name: 'Anzhee Profilee 400 RGBALC', shape: 'profile', beam: 26, legendCount: 8 },
  FRESNEL: { name: 'ProСвет Fresnel 300 CW', shape: 'fresnel', beam: 36, legendCount: 15 },
  PAR64: { name: 'PAR-64', shape: 'par', beam: 24, legendCount: 16 },
  ETC: { name: 'ETC Source Four 26° (19°)', shape: 'profile', beam: 26, legendCount: 10, scale: 0.85 },
  // нет в легенде схемы — тип уточнить
  X_PROF: { name: 'Профильный (тип не указан в легенде)', shape: 'profile', beam: 26, legendCount: 0, unknown: true, scale: 0.85 },
  X_FRES: { name: 'Линзовый (тип не указан в легенде)', shape: 'fresnel', beam: 36, legendCount: 0, unknown: true },
  X_GEN: { name: 'Прибор (тип не указан в легенде)', shape: 'par', beam: 30, legendCount: 0, unknown: true },
  FOLLOW: { name: 'Пушка (следящий прожектор)', shape: 'follow', beam: 6, legendCount: 0 },
};

/** Группы для управления и подписи D/S со схемы (D — DMX-адрес, S — линия). */
export const GROUPS = {
  C0: { name: 'Софит 0', ds: 'D142–150 / S1–6' },
  C1: { name: 'Софит 1', ds: 'D151–162 / S23–29' },
  C2: { name: 'Софит 2', ds: 'D163–174 / S30–36' },
  C3: { name: 'Софит 3', ds: 'D175–186 / S37–43' },
  GAL_L: { name: 'Галерея левая', ds: 'D187–192 / S44–46', set: 'galleries' },
  GAL_R: { name: 'Галерея правая', ds: 'D193–198 / S47–49', set: 'galleries' },
  GAL_B: { name: 'Галерея задняя', ds: 'D199–206 / S50–52', set: 'galleries' },
  BR1: { name: '1-й выносной мост', ds: 'D101–109 / S1–6', set: 'bridges' },
  BR2: { name: '2-й выносной мост', ds: 'D110–117 / S7–8', set: 'bridges' },
  BOX_L1: { name: '1-я левая ложа', ds: 'D118–123 / S9', set: 'boxes' },
  BOX_L2: { name: '2-я левая ложа', ds: 'D124–127 / S10–12', set: 'boxes' },
  BOX_R1: { name: '1-я правая ложа', ds: 'D128–133 / S13', set: 'boxes' },
  BOX_R2: { name: '2-я правая ложа', ds: 'D134–137 / S14–16', set: 'boxes' },
  TOW_L: { name: 'Левый прострел', ds: 'D138, 139 / S17', set: 'towers' },
  TOW_R: { name: 'Правый прострел', ds: 'D140, 141 / S18', set: 'towers' },
  FOH: { name: 'Пульт', ds: '—', set: 'foh' },
};

/** Наборы групп для кнопок управления. */
export const GROUP_SETS = [
  { id: 'C0', name: 'С0', groups: ['C0'] },
  { id: 'C1', name: 'С1', groups: ['C1'] },
  { id: 'C2', name: 'С2', groups: ['C2'] },
  { id: 'C3', name: 'С3', groups: ['C3'] },
  { id: 'galleries', name: 'Галереи', groups: ['GAL_L', 'GAL_R', 'GAL_B'] },
  { id: 'bridges', name: 'Мосты', groups: ['BR1', 'BR2'] },
  { id: 'boxes', name: 'Ложи', groups: ['BOX_L1', 'BOX_L2', 'BOX_R1', 'BOX_R2'] },
  { id: 'towers', name: 'Прострелы', groups: ['TOW_L', 'TOW_R'] },
  { id: 'foh', name: 'Пушка', groups: ['FOH'] },
];

// --- Раскладка по софитам (слева направо) ----------------------------------
const BARS = {
  C0: [
    [30, 'BEYE'], [142, 'ETC'], [34, 'SPOT585'], [144, 'ETC'], [31, 'BEYE'], [145, 'ETC'], [35, 'SPOT585'],
    [146, 'ETC'], [32, 'BEYE'], [147, 'ETC'], [36, 'SPOT585'], [148, 'ETC'], [33, 'BEYE'],
  ],
  C1: [
    [71, 'WASHZOOM'], [81, 'WASH760'], [38, 'SPOT585'], [152, 'ETC'], [43, 'WASH760'], [41, 'SPOT585'], [157, 'ETC'],
    [44, 'WASH760'], [39, 'SPOT585'], [158, 'ETC'], [45, 'WASH760'], [42, 'SPOT585'], [160, 'ETC'], [46, 'WASH760'],
    [40, 'SPOT585'], [82, 'WASH760'], [72, 'WASHZOOM'],
  ],
  C2: [
    [73, 'WASHZOOM'], [47, 'SPOT350'], [52, 'PLUTO'], [48, 'SPOT350'], [53, 'PLUTO'], [49, 'SPOT350'], [54, 'PLUTO'],
    [50, 'SPOT350'], [55, 'PLUTO'], [51, 'SPOT350'], [74, 'WASHZOOM'],
  ],
  C3: [
    [75, 'WASHZOOM'], [61, 'SPOT350'], [66, 'PLUTO'], [64, 'SPOT350'], [67, 'PLUTO'], [62, 'SPOT350'], [68, 'PLUTO'],
    [65, 'SPOT350'], [69, 'PLUTO'], [63, 'SPOT350'], [76, 'WASHZOOM'],
  ],
};
const BAR_AIM_D = { C0: 0.8, C1: 2.6, C2: 4.8, C3: 6.8 };

const GX = DIM.box.width / 2 - DIM.galleries.width / 2; // середина боковой галереи
const RAIL_Y = DIM.galleries.upperY + 0.75;

// Боковые галереи: [номер, глубина d] (оценено по схеме), задняя: [номер, x]
const GAL_L = [[187, 2.55], [188, 3.05], [189, 5.4], [192, 6.5], [190, 7.4], [191, 8.1]];
const GAL_R = [[193, 2.3], [194, 3.55], [195, 5.3], [196, 5.8], [197, 6.95], [198, 8.1]];
const GAL_B = [[202, -4.9], [201, 0.0]];

// Выносные мосты: [номер, тип, x] (x оценено по схеме)
const BR1 = [
  [1, 'FRESNEL', -4.4], [102, 'X_PROF', -3.6], [2, 'FRESNEL', -2.9], [3, 'FRESNEL', -2.2], [4, 'FRESNEL', -1.5], [5, 'FRESNEL', -0.7],
  [107, 'X_PROF', 0.0], [6, 'FRESNEL', 0.75], [7, 'FRESNEL', 1.5], [8, 'FRESNEL', 2.25], [9, 'FRESNEL', 3.6], [10, 'FRESNEL', 4.4],
];
const BR2 = [
  [11, 'FRESNEL', -3.6], [12, 'FRESNEL', -1.8], [60, 'X_GEN', -1.0], [13, 'FRESNEL', -0.15], [112, 'X_PROF', 0.6], [14, 'FRESNEL', 1.7], [15, 'FRESNEL', 3.6],
];

// Ложи: [номер, тип, колонка (0/1), ряд сверху (0..)]
const BOXES = {
  BOX_L1: { key: 'L1', items: [[119, 'PAR64', 0, 0], [118, 'PAR64', 1, 0], [120, 'PAR64', 0, 1], [17, 'X_FRES', 1, 1], [16, 'X_FRES', 0, 2], [121, 'PAR64', 1, 2], [122, 'PAR64', 0, 3], [123, 'PAR64', 1, 3]] },
  BOX_L2: { key: 'L2', items: [[20, 'X_FRES', 0, 0], [18, 'PAR64', 0, 1], [19, 'PAR64', 1, 1]] },
  BOX_R1: { key: 'R1', items: [[128, 'PAR64', 0, 0], [129, 'PAR64', 1, 0], [21, 'X_FRES', 0, 1], [130, 'PAR64', 1, 1], [131, 'PAR64', 0, 2], [22, 'X_FRES', 1, 2], [132, 'PAR64', 0, 3], [133, 'PAR64', 1, 3]] },
  BOX_R2: { key: 'R2', items: [[25, 'X_FRES', 0, 0], [23, 'PAR64', 0, 1], [24, 'PAR64', 1, 1]] },
};

// Прострелы (сверху вниз)
const TOWERS = {
  TOW_L: { key: 'L', items: [[26, 'PROF_RGB'], [139, 'X_PROF'], [28, 'WASH760']] },
  TOW_R: { key: 'R', items: [[27, 'PROF_RGB'], [140, 'X_PROF'], [29, 'WASH760']] },
};

/**
 * Каждый прибор: { no, type, group, mount: { on: 'C1' | null, x, y, d } , aim: {x,y,d} }
 * Для приборов на софитах y — смещение вниз от трубы, d — смещение от оси софита.
 */
function build() {
  const list = [];
  // --- софиты
  for (const [bar, items] of Object.entries(BARS)) {
    const n = items.length;
    const span = 13.0; // приборы распределены по 13 м из 14
    items.forEach(([no, type], i) => {
      const x = -span / 2 + (span * i) / (n - 1);
      list.push({
        no, type, group: bar,
        mount: { on: bar, x, y: -0.28, d: 0 },
        aim: { x: x * (bar === 'C0' ? 0.55 : 0.75), y: 0, d: BAR_AIM_D[bar] + (bar === 'C0' ? 0 : 0.4) },
      });
    });
  }
  // --- галереи (приборы на перилах, смотрят на сцену)
  const galType = (g, i) => (g === 'GAL_R' ? 'PROF_RGB' : 'PROF_CW');
  GAL_L.forEach(([no, d], i) => list.push({ no, type: galType('GAL_L', i), group: 'GAL_L', mount: { on: null, x: -GX + 0.55, y: RAIL_Y, d }, aim: { x: -1.5, y: 0, d: d - 0.5 } }));
  GAL_R.forEach(([no, d], i) => list.push({ no, type: galType('GAL_R', i), group: 'GAL_R', mount: { on: null, x: GX - 0.55, y: RAIL_Y, d }, aim: { x: 1.5, y: 0, d: d - 0.5 } }));
  GAL_B.forEach(([no, x]) => list.push({ no, type: 'PROF_CW', group: 'GAL_B', mount: { on: null, x, y: RAIL_Y, d: DIM.box.backWallD - DIM.galleries.width - 0.1 }, aim: { x: x * 0.6, y: 0, d: 4.5 } }));
  // --- мосты
  const b1 = DIM.hallRig.bridge1, b2 = DIM.hallRig.bridge2;
  BR1.forEach(([no, type, x]) => list.push({ no, type, group: 'BR1', mount: { on: null, x, y: b1.y - 0.35, d: b1.d }, aim: { x: x * 0.8, y: 0, d: 1.2 } }));
  BR2.forEach(([no, type, x]) => list.push({ no, type, group: 'BR2', mount: { on: null, x, y: b2.y - 0.35, d: b2.d }, aim: { x: x * 0.8, y: 0, d: 2.6 } }));
  // --- ложи
  for (const [group, { key, items }] of Object.entries(BOXES)) {
    const bx = DIM.hallRig.boxes[key];
    const wallX = bx.side * (DIM.hall.width / 2 - 0.35);
    const rows = Math.max(...items.map((it) => it[3])) + 1;
    items.forEach(([no, type, col, row]) => {
      const y = bx.y + bx.h / 2 - 0.3 - (row * (bx.h - 0.5)) / Math.max(1, rows - 1);
      const d = bx.d + (col - 0.5) * (bx.w * 0.55);
      list.push({ no, type, group, mount: { on: null, x: wallX, y, d }, aim: { x: -bx.side * 2.0, y: 0.5, d: 1.0 + row * 0.6 } });
    });
  }
  // --- прострелы
  for (const [group, { key, items }] of Object.entries(TOWERS)) {
    const t = DIM.hallRig.sideTowers[key];
    const wallX = t.side * (DIM.hall.width / 2 - 0.3);
    items.forEach(([no, type], i) => {
      const y = t.y + t.h - 0.4 - i * ((t.h - 0.6) / (items.length - 1));
      list.push({ no, type, group, mount: { on: null, x: wallX, y, d: t.d }, aim: { x: -t.side * 4.5, y: 1.0, d: 0.6 } });
    });
  }
  // --- пушка у пульта (в операторской, за стеклом)
  list.push({ no: 'П', type: 'FOLLOW', group: 'FOH', mount: { on: null, x: 0.8, y: 3.7, d: -(DIM.hall.portalToBoothWall + 0.8) }, aim: { x: 0, y: 1.6, d: 1.5 } });
  return list;
}

export const FIXTURES = build();

/** Сводка по типам для проверки с легендой схемы. */
export function typeSummary() {
  const counts = {};
  for (const f of FIXTURES) counts[f.type] = (counts[f.type] || 0) + 1;
  return Object.entries(TYPES).map(([k, t]) => ({ key: k, name: t.name, placed: counts[k] || 0, legend: t.legendCount }));
}

export const BAR_DEPTH = { C0: D.C0, C1: D.C1, C2: D.C2, C3: D.C3 };
