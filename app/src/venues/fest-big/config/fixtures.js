// =============================================================================
//  ПРИБОРЫ — по «Схеме с развесом света».
//  Места — со схемы; типы — по значкам, сверены с перечнем светового цеха
//  (см. INVENTORY ниже и fixtures_inventory_check.md).
//  Порядок в списках — слева направо (как смотреть из зала) / спереди назад.
// =============================================================================
import { DIM } from './dimensions.js';
import { DEPTHS as D } from './rigging.js';
import { venueTypes } from '../../../library/fixtureTypes.js';
import { SPECS as LIB_SPECS } from '../../../library/specs.js';

// Типы приборов — общий справочник театра (library/fixtureTypes.js, там же описание shape/lamp)
// плюс собственный тип Большой сцены, ещё не уточнённый (в конце: цвета справочных типов не сдвигаются).
export const LOCAL_TYPES = {
  // тип пока не уточнён
  GAL_LAMP: { name: 'ETC Source Four 26° или PAR-64', shape: 'profile', beam: 26, lamp: true, scale: 0.85, unknown: true, note: 'на каждой боковой галерее 2 из 6 — ETC 26°, остальные PAR-64; какие именно — уточняется' },
};
export const TYPES = venueTypes(LOCAL_TYPES);

// Паспорт собственного типа (общие паспорта — library/specs.js)
export const LOCAL_SPECS = {
  // боковые галереи: какой из приборов ETC 26°, а какой PAR-64 — уточняется (см. fixtures.js)
  GAL_LAMP: { power: '575 Вт (ETC 26°) или 1000 Вт (PAR-64)', source: 'лампа HPL 575 Вт или PAR64 1000 Вт', zoom: '26° (ETC) или по лампе (PAR-64)', color: 'гель-фильтр в рамке', weight: '6,3 кг (ETC) или ≈ 3,2 кг (PAR-64)', dmx: 'через диммер', ip: '—', confidence: 'тип не определён: ETC 26° или PAR-64', url: 'https://support.etcconnect.com/ETC/Fixtures/Source_Four/Source_Four_ERS_and_HID/Fixture_and_Shipping_Weights_of_Source_Four' },
};
export const SPECS = { ...LIB_SPECS, ...LOCAL_SPECS };

/**
 * Перечень светового цеха по местам подвеса (только то, что висит постоянно)
 * с поправками завцехом (20.10.2026). Проверяется автотестом.
 */
export const INVENTORY = {
  C0: { BEYE: 4, SPOT585: 3, PAR64: 6 },
  C1: { SPOT585: 3, BSW350: 2, WASH760: 6, WASHZOOM: 2, PAR64: 4 },
  C2: { BSW350: 5, PLUTO: 4, WASHZOOM: 2 },
  C3: { BSW350: 3, SPOT585: 2, PLUTO: 4, WASHZOOM: 2 },
  bridges: { FRESNEL: 15, PROF_CW: 1, ETC26: 2 }, // по завцеху: 102 — Jr 50°, 107 — 19° (линза 14/26), 112 — 26°, 60 — Q400 WW+CW
  // по завцеху: RGBALC — по одному в каждой ложе (всего 4), BroPar — в дальних ложах.
  // На схеме на сторону 5 LED-мест, в перечне 6 приборов: одного WW+CW на схеме нет.
  boxesEachSide: { PROF_CW: 3, PROF_RGB: 2, BROPAR: 1, COMPC: 6 },
  towerEach: { PROF_CW: 1, PAR64: 1, WASH760: 1 },
  galleries: { ETC26: 6, PAR64: 8 }, // по завцеху: ETC — по 2 на левой и правой, 2 на задней (в середине)
  floor: { ETC50: '6–8' }, // прострелы по планшету, количество меняется; в модели — PORTABLE (вкл. в панели «Свет»)
};

/** Группы для управления и линии со схемы: D — диммерные линии, S — свитчерные (постоянное питание). */
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
  PORT_L: { name: 'Переносные слева (планшет)', ds: 'на планшете: 12 диммерных / 7 свитчерных линий', set: 'portable' },
  PORT_R: { name: 'Переносные справа (планшет)', ds: 'на планшете: 12 диммерных / 7 свитчерных линий', set: 'portable' },
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
  { id: 'portable', name: 'Переносные', groups: ['PORT_L', 'PORT_R'] },
];

/**
 * Переносные ETC 50° — прострелы по планшету (по завцеху 6–8 шт., число меняется).
 * Ставятся по обеим сторонам сцены вдоль кулис и светят поперёк сцены.
 * mode: 'off' — не показывать, 'floor' — прямо на полу (на напольной подставке), 'stand' — на штативах.
 */
export const PORTABLE = {
  max: 8,
  counts: [6, 8],
  defaults: { mode: 'off', count: 8 },
  x: 6.6, // от оси сцены, м (между концами штанкетов и галереями)
  dFrom: 1.4, dTo: 7.0, // глубина первой и последней пары, м
  floorY: 0.24, // центр прибора на напольной подставке
  standY: 1.9, // центр прибора на штативе
};

/** Положение и наведение переносного прибора (side: -1 слева, +1 справа; k — номер пары спереди назад). */
export function portablePlacement(side, k, mode, count) {
  const perSide = count / 2;
  const visible = mode !== 'off' && k < perSide;
  const kk = Math.min(k, perSide - 1);
  const d = perSide > 1 ? PORTABLE.dFrom + ((PORTABLE.dTo - PORTABLE.dFrom) * kk) / (perSide - 1) : PORTABLE.dFrom;
  const x = side * PORTABLE.x;
  const stand = mode === 'stand';
  return {
    visible,
    mount: { on: null, x, y: stand ? PORTABLE.standY : PORTABLE.floorY, d },
    // с пола — почти горизонтально через всю сцену; со штатива — сверху в пол дальней половины (видна полоса прострела)
    aim: stand ? { x: -side * 2.0, y: 0, d } : { x: -side * 4.5, y: 0, d },
  };
}

// --- Раскладка по софитам (слева направо) ----------------------------------
const BARS = {
  // Spot 585 / BSW 350 на схеме одним значком — разделены по блокам номеров
  // (С1: 38–40 = 585, 41–42 = 350; С3: 61–63 = 350, 64–65 = 585), это сходится с перечнем.
  C0: [
    [30, 'BEYE'], [142, 'PAR64'], [34, 'SPOT585'], [144, 'PAR64'], [31, 'BEYE'], [145, 'PAR64'], [35, 'SPOT585'],
    [146, 'PAR64'], [32, 'BEYE'], [147, 'PAR64'], [36, 'SPOT585'], [148, 'PAR64'], [33, 'BEYE'],
  ],
  C1: [
    [71, 'WASHZOOM'], [81, 'WASH760'], [38, 'SPOT585'], [152, 'PAR64'], [43, 'WASH760'], [41, 'BSW350'], [157, 'PAR64'],
    [44, 'WASH760'], [39, 'SPOT585'], [158, 'PAR64'], [45, 'WASH760'], [42, 'BSW350'], [160, 'PAR64'], [46, 'WASH760'],
    [40, 'SPOT585'], [82, 'WASH760'], [72, 'WASHZOOM'],
  ],
  C2: [
    [73, 'WASHZOOM'], [47, 'BSW350'], [52, 'PLUTO'], [48, 'BSW350'], [53, 'PLUTO'], [49, 'BSW350'], [54, 'PLUTO'],
    [50, 'BSW350'], [55, 'PLUTO'], [51, 'BSW350'], [74, 'WASHZOOM'],
  ],
  C3: [
    [75, 'WASHZOOM'], [61, 'BSW350'], [66, 'PLUTO'], [64, 'SPOT585'], [67, 'PLUTO'], [62, 'BSW350'], [68, 'PLUTO'],
    [65, 'SPOT585'], [69, 'PLUTO'], [63, 'BSW350'], [76, 'WASHZOOM'],
  ],
};
/**
 * НАВЕДЕНИЕ ПРИБОРОВ — УСЛОВНОЕ (допущение модели): реальной фокусировки в исходных данных нет.
 * На софитах приборы через один смотрят на два соседних плана и сведены к центру «веером»,
 * С0 через один — на авансцену и на первый план за порталом. В карточке прибора это помечено.
 */
const BAR_AIM_ALT = { C0: [-1.2, 0.8], C1: [2.2, 3.4], C2: [4.4, 5.6], C3: [6.4, 7.6] };
export const AIM_NOTE = 'условное (допущение модели) — реальное наведение уточняйте у светового цеха';

const GX = DIM.box.width / 2 - DIM.galleries.width / 2; // середина боковой галереи
const RAIL_Y = DIM.galleries.upperY + 0.75;

// Боковые галереи: [номер, глубина d] (оценено по схеме), задняя: [номер, x]
const GAL_L = [[187, 2.55], [188, 3.05], [189, 5.4], [192, 6.5], [190, 7.4], [191, 8.1]];
const GAL_R = [[193, 2.3], [194, 3.55], [195, 5.3], [196, 5.8], [197, 6.95], [198, 8.1]];
const GAL_B = [[202, -4.9], [201, 0.0]];

// Выносные мосты: [номер, тип, x] (x оценено по схеме)
// 102, 107 — Jr 50° и 19° (линза 14/26); 60 — Profile Q400 WW+CW; 112 — ETC 26° (всё — со слов завцехом)
const BR1 = [
  [1, 'FRESNEL', -4.4], [102, 'ETCJR50', -3.6], [2, 'FRESNEL', -2.9], [3, 'FRESNEL', -2.2], [4, 'FRESNEL', -1.5], [5, 'FRESNEL', -0.7],
  [107, 'ETC19', 0.0], [6, 'FRESNEL', 0.75], [7, 'FRESNEL', 1.5], [8, 'FRESNEL', 2.25], [9, 'FRESNEL', 3.6], [10, 'FRESNEL', 4.4],
];
const BR2 = [
  [11, 'FRESNEL', -3.6], [12, 'FRESNEL', -1.8], [60, 'PROF_CW', -1.0], [13, 'FRESNEL', -0.15], [112, 'ETC26', 0.6], [14, 'FRESNEL', 1.7], [15, 'FRESNEL', 3.6],
];

// Ложи: [номер, тип, колонка (0/1), ряд сверху (0..), примечание]
// Трёхзначные (= диммерные линии) — ComPC 1000 Вт. LED: по завцеху RGBALC — по одному в каждой ложе,
// BroPar — в дальних ложах (на схеме не нарисован). Так всё сходится с перечнем.
// В дальней ложе 20 / 25 — со своим значком (отличается от 18, 19 / 23, 24) → RGBALC.
const NEAR_RGB = 'какой из двух LED в этой ложе — RGBALC, уточняется';
const BOXES = {
  BOX_L1: { key: 'L1', items: [[119, 'COMPC', 0, 0], [118, 'COMPC', 1, 0], [120, 'COMPC', 0, 1], [17, 'PROF_RGB', 1, 1, NEAR_RGB], [16, 'PROF_CW', 0, 2, NEAR_RGB], [121, 'COMPC', 1, 2], [122, 'COMPC', 0, 3], [123, 'COMPC', 1, 3]] },
  BOX_L2: { key: 'L2', items: [[20, 'PROF_RGB', 0, 0], ['УФ-Л', 'BROPAR', 1, 0, 'на схеме не нарисован, место условное'], [18, 'PROF_CW', 0, 1], [19, 'PROF_CW', 1, 1]] },
  BOX_R1: { key: 'R1', items: [[128, 'COMPC', 0, 0], [129, 'COMPC', 1, 0], [21, 'PROF_CW', 0, 1, NEAR_RGB], [130, 'COMPC', 1, 1], [131, 'COMPC', 0, 2], [22, 'PROF_RGB', 1, 2, NEAR_RGB], [132, 'COMPC', 0, 3], [133, 'COMPC', 1, 3]] },
  BOX_R2: { key: 'R2', items: [[25, 'PROF_RGB', 0, 0], ['УФ-П', 'BROPAR', 1, 0, 'на схеме не нарисован, место условное'], [23, 'PROF_CW', 0, 1], [24, 'PROF_CW', 1, 1]] },
};

// Прострелы (сверху вниз)
const TOWERS = {
  TOW_L: { key: 'L', items: [[26, 'PROF_CW'], [139, 'PAR64'], [28, 'WASH760']] },
  TOW_R: { key: 'R', items: [[27, 'PROF_CW'], [140, 'PAR64'], [29, 'WASH760']] },
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
        aim: { x: x * (bar === 'C0' ? 0.55 : 0.68), y: 0, d: BAR_AIM_ALT[bar][i % 2] },
      });
    });
  }
  // --- галереи (приборы на перилах, смотрят на сцену)
  // ламповые (номера = диммерные линии). По завцеху: ETC 26° — 2 на левой, 2 на правой, 2 на задней (в середине),
  // остальные 8 — PAR-64. На задней галерее на схеме как раз 2 места → ETC; на боковых — какие 2 из 6, пока не известно.
  const galType = (g) => (g === 'GAL_B' ? 'ETC26' : 'GAL_LAMP');
  GAL_L.forEach(([no, d], i) => list.push({ no, type: galType('GAL_L', i), group: 'GAL_L', mount: { on: null, x: -GX + 0.55, y: RAIL_Y, d }, aim: { x: -1.5, y: 0, d: d - 0.5 } }));
  GAL_R.forEach(([no, d], i) => list.push({ no, type: galType('GAL_R', i), group: 'GAL_R', mount: { on: null, x: GX - 0.55, y: RAIL_Y, d }, aim: { x: 1.5, y: 0, d: d - 0.5 } }));
  GAL_B.forEach(([no, x]) => list.push({ no, type: galType('GAL_B'), group: 'GAL_B', mount: { on: null, x, y: RAIL_Y, d: DIM.box.backWallD - DIM.galleries.width - 0.1 }, aim: { x: x * 0.6, y: 0, d: 4.5 } }));
  // --- мосты
  const b1 = DIM.hallRig.bridge1, b2 = DIM.hallRig.bridge2;
  BR1.forEach(([no, type, x]) => list.push({ no, type, group: 'BR1', mount: { on: null, x, y: b1.y - 0.35, d: b1.d }, aim: { x: x * 0.8, y: 0, d: 1.2 } }));
  BR2.forEach(([no, type, x]) => list.push({ no, type, group: 'BR2', mount: { on: null, x, y: b2.y - 0.35, d: b2.d }, aim: { x: x * 0.8, y: 0, d: 2.6 } }));
  // --- ложи
  for (const [group, { key, items }] of Object.entries(BOXES)) {
    const bx = DIM.hallRig.boxes[key];
    const wallX = bx.side * (DIM.hall.width / 2 - 0.35);
    const rows = Math.max(...items.map((it) => it[3])) + 1;
    items.forEach(([no, type, col, row, note]) => {
      const y = bx.y + bx.h / 2 - 0.3 - (row * (bx.h - 0.5)) / Math.max(1, rows - 1);
      const d = bx.d + (col - 0.5) * (bx.w * 0.55);
      list.push({ no, type, group, note, mount: { on: null, x: wallX, y, d }, aim: { x: -bx.side * 2.0, y: 0.5, d: 1.0 + row * 0.6 } });
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
  // --- «пушка» у пульта (в операторской, за стеклом): по завцеху — Profile Q400 WW+CW
  list.push({ no: 'П', type: 'PROF_CW', group: 'FOH', note: '«пушка» у пульта', mount: { on: null, x: 0.8, y: 3.7, d: -(DIM.hall.portalToBoothWall + 0.8) }, aim: { x: 0, y: 1.6, d: 1.5 } });
  // --- переносные ETC 50° (в конце списка, чтобы не сбить номера в сохранённых ссылках).
  // Н1, Н3, Н5, Н7 — слева спереди назад; Н2, Н4, Н6, Н8 — справа.
  for (let k = 0; k < PORTABLE.max / 2; k++) {
    for (const side of [-1, 1]) {
      const p = portablePlacement(side, k, 'floor', PORTABLE.max);
      list.push({ no: `Н${k * 2 + (side < 0 ? 1 : 2)}`, type: 'ETC50', group: side < 0 ? 'PORT_L' : 'PORT_R', portable: { side, k }, mount: p.mount, aim: p.aim });
    }
  }
  return list;
}

export const FIXTURES = build();

/** Сколько приборов каждого типа расставлено в группах groups: { TYPE: n }. */
export function countByType(groups) {
  const counts = {};
  for (const f of FIXTURES) if (groups.includes(f.group)) counts[f.type] = (counts[f.type] || 0) + 1;
  return counts;
}

/** Питание прибора: ламповые — своя диммерная линия (номер на схеме), остальные — свитчерные линии группы. */
export function powerOf(f) {
  if (f.portable) return 'диммерная линия на планшете (D)';
  return TYPES[f.type].lamp ? `диммерная линия D${f.no}` : 'свитчерная линия (S) группы';
}

export const BAR_DEPTH = { C0: D.C0, C1: D.C1, C2: D.C2, C3: D.C3 };
