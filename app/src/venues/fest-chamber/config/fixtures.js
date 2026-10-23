// =============================================================================
//  ПРИБОРЫ КАМЕРНОЙ СЦЕНЫ — по «Схеме развеса света» и «Перечню оборудования»
//  (data/chamber/Свет/). Всего 72 прибора:
//    • Над залом (фермы ЗФ1, ЗФ2, ЗФ3) — 20 шт. (№119 на ЗФ1, 15 приборов на ЗФ2, 4 прибора на ЗФ3);
//    • Операторская (вынос) — 1 шт. (ОП);
//    • Прострелы по авансцене (на единственной П-образной конструкции сразу за передними колоннами) — 4 шт. (17+122, 19+123);
//    • 1-й ряд над сценой (ферма Ф2 + боковые прострелы П1, П2 на Ф2 и 152, 134 на Ф3) — 14 шт.;
//    • 2-й ряд над сценой (ферма Ф4 LedBar + ферма Ф5 с боковыми прострелами П3+136, П4+141) — 18 шт.;
//    • 3-й ряд над сценой (ферма Ф8 + боковые прострелы 154, 158 на Ф7 и П5, П6 на Ф8) — 15 шт.
//  Все приборы подвешены на неподвижных конструкциях (mount.on = null).
// =============================================================================
import { CHAMBER, TRUSS_BY_ID, trussChordsAt } from './dimensions.js';
import { venueTypes } from '../../../library/fixtureTypes.js';
import { SPECS as LIB_SPECS } from '../../../library/specs.js';

export const TYPES = venueTypes();
export const SPECS = { ...LIB_SPECS };

/**
 * Перечень светового оборудования по местам подвеса (проверяется автотестом).
 */
export const INVENTORY = {
  hall: { SVETOCH1000: 10, RAVEN150: 2, PROF100_CW: 2, PROF_RGB: 2, ETC26: 4 },
  foh: { PROF100_CW: 1 },
  prosceniumEach: { PROF100_RGB: 1, ETCJR_ZOOM: 1 },
  row1: { FRESNEL100: 8, BEYE640: 2 },
  side1Each: { P7X40: 1, ETCJR_ZOOM: 1 },
  row2: { BEYE640: 5, RAVEN150: 2, COMPC500: 4, LEDBAR24: 3 },
  side2Each: { P7X40: 1, ETCJR36: 1 },
  row3: { BEYE640: 5, SPARROW: 6 },
  side3Each: { P7X40: 1, ETC_50: 1 },
};

/** Узловые сплиттерные коробки DMX на фермах со схемы цеха. */
export const DMX_BOXES = [
  { id: 'DMX-1', truss: 'ZF2', x: 5.1, d: -2.7 },
  { id: 'DMX-2', truss: 'F2', x: 5.15, d: 1.85 },
  { id: 'DMX-3', truss: 'F5', x: 5.25, d: 4.95 },
  { id: 'DMX-4', truss: 'F5', x: -5.5, d: 4.95 },
  { id: 'DMX-5', truss: 'F8', x: 5.15, d: 7.95 },
];

/** Группы приборов и линии питания со схемы (D — диммерные линии, S — свитчерные). */
export const GROUPS = {
  HALL_ZF1: { name: 'Над залом (фермы ЗФ1–ЗФ2)', ds: 'D104–119 / S5, 8, 13, 14 · DMX-1', set: 'hall' },
  HALL_ZF2: { name: 'Над залом (ферма ЗФ3)', ds: 'D102, 120 / S15, 16 · DMX-1', set: 'hall' },
  FOH: { name: 'Операторская (вынос)', ds: 'S (вынос у окна операторской)', set: 'foh' },
  PROS_L: { name: 'Прострел авансцены левый (П-подвес за колонной)', ds: 'D122 / S17', set: 'proscenium' },
  PROS_R: { name: 'Прострел авансцены правый (П-подвес за колонной)', ds: 'D123 / S19', set: 'proscenium' },
  ROW1: { name: '1-й ряд над сценой (ферма Ф2)', ds: 'S21–30 · DMX-2', set: 'row1' },
  SIDE1_L: { name: 'Прострел 1-го ряда левый (П1 на Ф2, 152 на Ф3)', ds: 'D152 / S (P7x40, DMX без диммера)', set: 'side' },
  SIDE1_R: { name: 'Прострел 1-го ряда правый (П2 на Ф2, 134 на Ф3)', ds: 'D134 / S (P7x40, DMX-2)', set: 'side' },
  ROW2_BAR: { name: '2-й ряд — линейные (ферма Ф4)', ds: 'S37–39 (LedBar 24-15)', set: 'row2' },
  ROW2: { name: '2-й ряд над сценой (ферма Ф5)', ds: 'D137–140 / S30А, 31–36 · DMX-3, DMX-4', set: 'row2' },
  SIDE2_L: { name: 'Прострел 2-го ряда левый (П3 + 136 на Ф5)', ds: 'D136 / S (P7x40, DMX-4)', set: 'side' },
  SIDE2_R: { name: 'Прострел 2-го ряда правый (П4 + 141 на Ф5)', ds: 'D141 / S (P7x40, DMX-3)', set: 'side' },
  ROW3: { name: '3-й ряд над сценой (ферма Ф8)', ds: 'S40–50 · DMX-5', set: 'row3' },
  SIDE3_L: { name: 'Прострел 3-го ряда левый (154 на Ф7, П5 на Ф8)', ds: 'D154 / S (P7x40, DMX без диммера)', set: 'side' },
  SIDE3_R: { name: 'Прострел 3-го ряда правый (158 на Ф7, П6 на Ф8)', ds: 'D158 / S (P7x40, DMX-5)', set: 'side' },
};

/** Наборы групп для кнопок быстрого управления во вкладке «Свет». */
export const GROUP_SETS = [
  { id: 'hall', name: 'Зал (ЗФ1–ЗФ3)', groups: ['HALL_ZF1', 'HALL_ZF2'] },
  { id: 'proscenium', name: 'Авансцена', groups: ['PROS_L', 'PROS_R'] },
  { id: 'row1', name: '1-й ряд (Ф2)', groups: ['ROW1'] },
  { id: 'row2', name: '2-й ряд (Ф4–Ф5)', groups: ['ROW2_BAR', 'ROW2'] },
  { id: 'row3', name: '3-й ряд (Ф8)', groups: ['ROW3'] },
  { id: 'side', name: 'Прострелы сцены', groups: ['SIDE1_L', 'SIDE1_R', 'SIDE2_L', 'SIDE2_R', 'SIDE3_L', 'SIDE3_R'] },
  { id: 'foh', name: 'Операторская', groups: ['FOH'] },
];

export const AIM_NOTE = 'условное (допущение модели) — реальное наведение уточняйте у светового цеха';

/**
 * Точка крепления на нижнем поясе фермы trussId (side: 0 — пояс со стороны зала, 1 — со стороны сцены).
 */
function onTruss(trussId, x, side = 1) {
  const tr = TRUSS_BY_ID[trussId];
  const bottom = trussChordsAt(tr.d, CHAMBER).bottom;
  const [y, d] = bottom[Math.min(side, bottom.length - 1)];
  return { on: null, x, y: y + 0.02, d };
}

// --- 1. Ферма ЗФ2 (d = -2,70 м): 15 приборов слева направо + №119 на ЗФ1 (d = -4,50 м)
const ZF2_MAIN_ITEMS = [
  [13, 'PROF100_CW'],
  [104, 'SVETOCH1000'],
  [105, 'SVETOCH1000'],
  [106, 'ETC26'],
  [107, 'SVETOCH1000'],
  [5, 'PROF_RGB'],
  [109, 'SVETOCH1000'],
  [110, 'ETC26'],
  [111, 'SVETOCH1000'],
  [8, 'PROF_RGB'],
  [112, 'SVETOCH1000'],
  [113, 'ETC26'],
  [115, 'SVETOCH1000'],
  [117, 'SVETOCH1000'],
  [14, 'PROF100_CW'],
];

// --- 2. Ферма ЗФ3 (d = -0,90 м): 4 прибора слева направо --------------------
const ZF3_ITEMS = [
  [102, 'SVETOCH1000', -3.8, -2.4, 1.8],
  [15, 'RAVEN150', -1.4, -0.8, 2.4],
  [16, 'RAVEN150', 1.4, 0.8, 2.4],
  [120, 'SVETOCH1000', 3.8, 2.4, 1.8],
];

// --- 3. 1-й ряд над сценой — ферма Ф2 (d = +1,85 м): 10 приборов на поясе ---
const F2_ITEMS = [
  [21, 'FRESNEL100'],
  [22, 'FRESNEL100'],
  [29, 'BEYE640'],
  [23, 'FRESNEL100'],
  [24, 'FRESNEL100'],
  [25, 'FRESNEL100'],
  [26, 'FRESNEL100'],
  [30, 'BEYE640'],
  [27, 'FRESNEL100'],
  [28, 'FRESNEL100'],
];

// --- 4. 2-й ряд над сценой — ферма Ф4 (d = +4,15 м): 3 линейных прибора -----
const F4_ITEMS = [
  [37, 'LEDBAR24', -2.8],
  [38, 'LEDBAR24', -0.14],
  [39, 'LEDBAR24', 2.5],
];

// --- 5. 2-й ряд над сценой — ферма Ф5 (d = +4,95 м): 11 приборов на поясе ---
const F5_ITEMS = [
  ['30А', 'BEYE640', 'на схеме № 30 (дублирует № 30 с 1-го ряда Ф2)'],
  [35, 'RAVEN150'],
  [137, 'COMPC500'],
  [31, 'BEYE640'],
  [138, 'COMPC500'],
  [32, 'BEYE640'],
  [139, 'COMPC500'],
  [33, 'BEYE640'],
  [140, 'COMPC500'],
  [36, 'RAVEN150'],
  [34, 'BEYE640'],
];

// --- 6. 3-й ряд над сценой — ферма Ф8 (d = +7,95 м): 11 приборов на поясе ---
const F8_ITEMS = [
  [45, 'SPARROW'],
  [40, 'BEYE640'],
  [46, 'SPARROW'],
  [41, 'BEYE640'],
  [47, 'SPARROW'],
  [42, 'BEYE640'],
  [48, 'SPARROW'],
  [43, 'BEYE640'],
  [49, 'SPARROW'],
  [44, 'BEYE640'],
  [50, 'SPARROW'],
];

function build() {
  const list = [];

  // 1. ЗФ2 (15 приборов выносного света из зала на первый и второй планы сцены) + № 119 на ЗФ1 справа
  const zf2Span = 9.6;
  ZF2_MAIN_ITEMS.forEach(([no, type, note], i) => {
    const x = -zf2Span / 2 + (zf2Span * i) / (ZF2_MAIN_ITEMS.length - 1);
    const aimD = i % 2 === 0 ? 1.8 : 3.2;
    list.push({
      no,
      type,
      group: 'HALL_ZF1',
      truss: 'ZF2',
      note,
      mount: onTruss('ZF2', x, 1),
      aim: { x: x * 0.72, y: 0, d: aimD },
    });
  });
  list.push({
    no: 119,
    type: 'ETC26',
    group: 'HALL_ZF1',
    truss: 'ZF1',
    note: 'подвес справа на ферме ЗФ1; в текстовом перечне указано 3 шт. ETC 26°',
    mount: onTruss('ZF1', 4.8, 1),
    aim: { x: 1.6, y: 0, d: 1.5 },
  });

  // 2. ЗФ3 (дополнительный вынос над залом ближе к сцене: 2 Светоч + 2 головы Raven Spot 150)
  for (const [no, type, x, ax, ad] of ZF3_ITEMS) {
    list.push({
      no,
      type,
      group: 'HALL_ZF2',
      truss: 'ZF3',
      mount: onTruss('ZF3', x, 1),
      aim: { x: ax, y: 0, d: ad },
    });
  }

  // 3. Операторская (5-й профильный прожектор Anzhee Profile 100 WW/CW у окна будки)
  list.push({
    no: 'ОП',
    type: 'PROF100_CW',
    group: 'FOH',
    note: 'выносной профильный прожектор у окна операторской',
    mount: { on: null, x: 0.4, y: 3.25, d: -4.98 },
    aim: { x: 0, y: 1.1, d: 2.2 },
  });

  // 4. Прострелы по авансцене (на единственной П-образной конструкции сразу за передними колоннами, d = +0,18 м)
  const pf = CHAMBER.trusses.prosceniumFrame;
  list.push(
    { no: 17, type: 'PROF100_RGB', group: 'PROS_L', truss: null, mount: { on: null, x: pf.leftX, y: 3.25, d: pf.d }, aim: { x: 1.8, y: 0, d: 0.9 } },
    { no: 122, type: 'ETCJR_ZOOM', group: 'PROS_L', truss: null, mount: { on: null, x: pf.leftX, y: 2.75, d: pf.d }, aim: { x: 2.2, y: 0, d: 1.2 } },
    { no: 19, type: 'PROF100_RGB', group: 'PROS_R', truss: null, mount: { on: null, x: pf.rightX, y: 3.25, d: pf.d }, aim: { x: -1.8, y: 0, d: 0.9 } },
    { no: 123, type: 'ETCJR_ZOOM', group: 'PROS_R', truss: null, mount: { on: null, x: pf.rightX, y: 2.75, d: pf.d }, aim: { x: -2.2, y: 0, d: 1.2 } },
  );

  // 5. 1-й ряд над сценой (Ф2, d = +1,85 м) + боковые прострелы 1-го ряда (П1, П2 на Ф2; 152, 134 на Ф3)
  const f2Span = 7.2;
  F2_ITEMS.forEach(([no, type], i) => {
    const x = -0.14 - f2Span / 2 + (f2Span * i) / (F2_ITEMS.length - 1);
    const aimD = i % 2 === 0 ? 2.4 : 3.5;
    list.push({
      no,
      type,
      group: 'ROW1',
      truss: 'F2',
      mount: onTruss('F2', x, i % 2),
      aim: { x: x * 0.78, y: 0, d: aimD },
    });
  });
  const f2D = TRUSS_BY_ID.F2.d;
  const f3D = TRUSS_BY_ID.F3.d;
  list.push(
    { no: 'П1', type: 'P7X40', group: 'SIDE1_L', truss: 'F2', note: 'прострел 1-го ряда на ферме Ф2 (управление по DMX, без диммерного номера)', mount: onTruss('F2', -4.95, 0), aim: { x: 1.8, y: 0, d: f2D + 0.4 } },
    { no: 152, type: 'ETCJR_ZOOM', group: 'SIDE1_L', truss: 'F3', note: 'прострел 1-го ряда на ферме Ф3 слева', mount: onTruss('F3', -4.55, 1), aim: { x: 2.4, y: 0, d: f3D + 0.3 } },
    { no: 'П2', type: 'P7X40', group: 'SIDE1_R', truss: 'F2', note: 'прострел 1-го ряда на ферме Ф2 (управление по DMX, без диммерного номера)', mount: onTruss('F2', 4.75, 0), aim: { x: -1.8, y: 0, d: f2D + 0.4 } },
    { no: 134, type: 'ETCJR_ZOOM', group: 'SIDE1_R', truss: 'F3', note: 'прострел 1-го ряда на ферме Ф3 справа', mount: onTruss('F3', 4.35, 1), aim: { x: -2.4, y: 0, d: f3D + 0.3 } },
  );

  // 6. 2-й ряд над сценой: Ф4 (3 × LedBar) + Ф5 (11 приборов + боковые прострелы П3+136 слева и П4+141 справа на Ф5)
  for (const [no, type, x] of F4_ITEMS) {
    list.push({
      no,
      type,
      group: 'ROW2_BAR',
      truss: 'F4',
      mount: onTruss('F4', x, 1),
      aim: { x, y: 0, d: 5.2 },
    });
  }
  const f5Span = 6.8;
  F5_ITEMS.forEach(([no, type, note], i) => {
    const x = -0.14 - f5Span / 2 + (f5Span * i) / (F5_ITEMS.length - 1);
    const aimD = i % 2 === 0 ? 4.6 : 5.8;
    list.push({
      no,
      type,
      group: 'ROW2',
      truss: 'F5',
      note,
      mount: onTruss('F5', x, i % 2),
      aim: { x: x * 0.75, y: 0, d: aimD },
    });
  });
  const f5D = TRUSS_BY_ID.F5.d;
  list.push(
    { no: 'П3', type: 'P7X40', group: 'SIDE2_L', truss: 'F5', note: 'прострел 2-го ряда на ферме Ф5 слева (управление по DMX, без диммерного номера)', mount: onTruss('F5', -5.15, 0), aim: { x: 1.8, y: 0, d: f5D + 0.2 } },
    { no: 136, type: 'ETCJR36', group: 'SIDE2_L', truss: 'F5', note: 'прострел 2-го ряда на ферме Ф5 слева', mount: onTruss('F5', -4.35, 1), aim: { x: 2.4, y: 0, d: f5D + 0.4 } },
    { no: 'П4', type: 'P7X40', group: 'SIDE2_R', truss: 'F5', note: 'прострел 2-го ряда на ферме Ф5 справа (управление по DMX, без диммерного номера)', mount: onTruss('F5', 4.85, 0), aim: { x: -1.8, y: 0, d: f5D + 0.2 } },
    { no: 141, type: 'ETCJR36', group: 'SIDE2_R', truss: 'F5', note: 'прострел 2-го ряда на ферме Ф5 справа', mount: onTruss('F5', 4.1, 1), aim: { x: -2.4, y: 0, d: f5D + 0.4 } },
  );

  // 7. 3-й ряд над сценой: Ф8 (11 приборов + П5, П6 на Ф8) и 154, 158 на Ф7
  const f8Span = 7.2;
  F8_ITEMS.forEach(([no, type], i) => {
    const x = -0.14 - f8Span / 2 + (f8Span * i) / (F8_ITEMS.length - 1);
    const aimD = i % 2 === 0 ? 6.4 : 7.5;
    list.push({
      no,
      type,
      group: 'ROW3',
      truss: 'F8',
      mount: onTruss('F8', x, 0),
      aim: { x: x * 0.75, y: 0, d: aimD },
    });
  });
  const f7D = TRUSS_BY_ID.F7.d;
  const f8D = TRUSS_BY_ID.F8.d;
  list.push(
    { no: 'П5', type: 'P7X40', group: 'SIDE3_L', truss: 'F8', note: 'прострел 3-го ряда на ферме Ф8 слева (управление по DMX, без диммерного номера)', mount: onTruss('F8', -4.95, 0), aim: { x: 1.8, y: 0, d: f8D - 0.3 } },
    { no: 154, type: 'ETC_50', group: 'SIDE3_L', truss: 'F7', note: 'прострел 3-го ряда на ферме Ф7 слева', mount: onTruss('F7', -4.55, 1), aim: { x: 2.4, y: 0, d: f7D + 0.2 } },
    { no: 'П6', type: 'P7X40', group: 'SIDE3_R', truss: 'F8', note: 'прострел 3-го ряда на ферме Ф8 справа (управление по DMX, без диммерного номера)', mount: onTruss('F8', 4.75, 0), aim: { x: -1.8, y: 0, d: f8D - 0.3 } },
    { no: 158, type: 'ETC_50', group: 'SIDE3_R', truss: 'F7', note: 'прострел 3-го ряда на ферме Ф7 справа', mount: onTruss('F7', 4.35, 1), aim: { x: -2.4, y: 0, d: f7D + 0.2 } },
  );

  return list;
}

export const FIXTURES = build();

/** Сколько приборов каждого типа расставлено в группах groups: { TYPE: n }. */
export function countByType(groups) {
  const counts = {};
  for (const f of FIXTURES) if (groups.includes(f.group)) counts[f.type] = (counts[f.type] || 0) + 1;
  return counts;
}

/** Питание прибора: ламповые — своя диммерная линия (номер на схеме), остальные — свитчерная линия. */
export function powerOf(f) {
  return TYPES[f.type].lamp ? `диммерная линия D${f.no}` : 'свитчерная линия (S)';
}
