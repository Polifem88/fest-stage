// =============================================================================
//  ПРИБОРЫ СЦЕНЫ ПОД КРЫШЕЙ — по «Схеме развеса светового оборудования, ферм и стандартного
//  положения зрительного зала» (data/roof/Световое оборудование/) и интервью (spec §5.1).
//  Всего 49 приборов, все — на нижних поясах ферм 30 × 30 (жёсткий подвес, mount.on = null).
//  Номера на схеме несквозные: 1–24, 26, 28, 29 · 50–62 · 101–109. Порядок FIXTURES — часть
//  формата ссылки (с первой публикации только добавлять в конец).
//  Допущения: верхний «14» на схеме = № 13; Q400 RGBALC = № 8 и № 10; значки ComPC без номера =
//  № 104 и № 108; «Подсв 109» — единственный Involight LedPar 933. Наведение условное (AIM_NOTE).
// =============================================================================
import { ROOF } from './dimensions.js';
import { venueTypes } from '../../../library/fixtureTypes.js';
import { SPECS as LIB_SPECS } from '../../../library/specs.js';

export const TYPES = venueTypes();
export const SPECS = { ...LIB_SPECS };

/** Перечень светового оборудования цеха (проверяется автотестом). */
export const INVENTORY = { FRESNEL100: 7, PROF100_CW: 9, PROF_RGB: 2, P7X40: 9, BEYE640: 9, RAVEN150: 4, COMPC500: 8, LEDPAR933: 1 };

/** Группы приборов (линии DMX и диммеров на схеме не указаны). */
export const GROUPS = {
  FRONT: { name: 'Фронт над залом (профили 8–10)', set: 'front' },
  SIDE_L: { name: 'Боковые профили слева (17, 11–13)', set: 'sides' },
  SIDE_R: { name: 'Боковые профили справа (18, 14–16)', set: 'sides' },
  FRESNEL: { name: 'Френели (1–7)', set: 'fresnel' },
  COMPC: { name: 'ComPC-500 (101–108)', set: 'compc' },
  BEYE: { name: 'B-Eye (50–58)', set: 'heads' },
  RAVEN: { name: 'Raven Spot (59–62)', set: 'heads' },
  BACK: { name: 'Контровой wash (19–23)', set: 'wash' },
  SIDE_WASH: { name: 'Боковой wash (24, 26, 28, 29)', set: 'wash' },
  STORAGE: { name: 'Подсветка склада за мольтоном (109)', set: 'storage' },
};

/** Наборы групп для кнопок быстрого управления во вкладке «Свет». */
export const GROUP_SETS = [
  { id: 'front', name: 'Фронт', groups: ['FRONT'] },
  { id: 'sides', name: 'Боковые профили', groups: ['SIDE_L', 'SIDE_R'] },
  { id: 'fresnel', name: 'Френели', groups: ['FRESNEL'] },
  { id: 'compc', name: 'ComPC', groups: ['COMPC'] },
  { id: 'heads', name: 'Головы (B-Eye + Raven)', groups: ['BEYE', 'RAVEN'] },
  { id: 'wash', name: 'Контровой и боковой wash', groups: ['BACK', 'SIDE_WASH'] },
  { id: 'storage', name: 'Подсветка склада', groups: ['STORAGE'] },
];

export const AIM_NOTE = 'условное (допущение модели) — реальное наведение уточняйте у светового цеха';

/** Крепление ниже нижнего пояса фермы (струбцина). */
const HANG = 0.02;
const LINE = Object.fromEntries(ROOF.trusses.lines.map((l) => [l.id, l]));

/** Точка на нижнем поясе линии ферм lineId: along — x (поперечная линия) или d (продольная). */
export function onTruss(lineId, along) {
  const l = LINE[lineId];
  if (!l) throw new Error(`нет линии ферм ${lineId}`);
  const y = ROOF.trusses.y0 - HANG;
  return l.axis === 'd' ? { on: null, x: along, y, d: l.at } : { on: null, x: l.at, y, d: along };
}

const F = (no, type, group, line, along, aim, note) => ({ no, type, group, line, note, mount: onTruss(line, along), aim: { x: aim[0], y: 0, d: aim[1] } });

// условное наведение: френели и ComPC — вниз чуть к сцене, профили — через сцену, контра — к залу
function build() {
  const L = [];
  // 1–7 — Fresnel 100 на линии d = 0
  [-3.43, -1.84, -0.51, 0.78, 1.88, 3.32, 4.05].forEach((x, i) => L.push(F(i + 1, 'FRESNEL100', 'FRESNEL', 'П0', x, [x * 0.9, 1.6])));
  // 8–10 — фронт над залом, d −1,73 на продольных линиях x −2,5 / 0 / 2,5
  L.push(F(8, 'PROF_RGB', 'FRONT', 'Д-2.5', -1.73, [-1.2, 2.6], 'Q400 RGBALC — допущение'));
  L.push(F(9, 'PROF100_CW', 'FRONT', 'Д0', -1.73, [0, 2.8]));
  L.push(F(10, 'PROF_RGB', 'FRONT', 'Д2.5', -1.73, [1.2, 2.6], 'Q400 RGBALC — допущение'));
  // 11–13 — линия x = −5 (верхний «14» на схеме = № 13)
  [[11, 1.34], [12, 3.97], [13, 6.50]].forEach(([no, d]) => L.push(F(no, 'PROF100_CW', 'SIDE_L', 'Д-5', d, [1.5, d], no === 13 ? 'на схеме подписан «14» — № 13 (допущение)' : undefined)));
  // 14–16 — линия x = 5
  [[14, 1.38], [15, 3.19], [16, 6.38]].forEach(([no, d]) => L.push(F(no, 'PROF100_CW', 'SIDE_R', 'Д5', d, [-1.5, d])));
  // 17, 18 — углы (−5; 0) и (5; 0)
  L.push(F(17, 'PROF100_CW', 'SIDE_L', 'П0', -5, [1.5, 0.6]));
  L.push(F(18, 'PROF100_CW', 'SIDE_R', 'П0', 5, [-1.5, 0.6]));
  // 19–23 — контра, линия d = 7,5
  [-1.66, -0.72, 0.47, 1.41, 2.42].forEach((x, i) => L.push(F(19 + i, 'P7X40', 'BACK', 'П7.5', x, [x, 4.5])));
  // 24, 26, 28, 29 — боковой wash
  L.push(F(24, 'P7X40', 'SIDE_WASH', 'Д-5', -0.70, [-1.0, 1.0]));
  L.push(F(26, 'P7X40', 'SIDE_WASH', 'Д5', -1.90, [1.0, 0.6]));
  L.push(F(28, 'P7X40', 'SIDE_WASH', 'П2.5+', 6.27, [2.0, 2.5]));
  L.push(F(29, 'P7X40', 'SIDE_WASH', 'П5+', 6.36, [2.0, 5.0]));
  // 50–58 — B-Eye на пересечениях d {0; 2,5; 5} × x {−2,5; 0; 2,5}
  const dLine = { 0: 'П0', 2.5: 'П2.5', 5: 'П5' };
  [0, 2.5, 5].forEach((d, i) => [-2.5, 0, 2.5].forEach((x, j) => L.push(F(50 + i * 3 + j, 'BEYE640', 'BEYE', dLine[d], x, [x, d + 0.5]))));
  // 59–62 — Raven Spot 150
  [[59, -1.23, 0], [60, 1.33, 0], [61, -1.23, 5], [62, 1.30, 5]].forEach(([no, x, d]) => L.push(F(no, 'RAVEN150', 'RAVEN', dLine[d], x, [x, d + 1.0])));
  // 101–104 — ComPC-500 на линии d = 2,5; 105–108 — на линии d = 5 (104 и 108 — значки без номера)
  [-1.81, -1.08, 0.89, 1.72].forEach((x, i) => L.push(F(101 + i, 'COMPC500', 'COMPC', 'П2.5', x, [x, 3.0], i === 3 ? 'на схеме значок без номера — № 104 (допущение)' : undefined)));
  [-1.81, -0.56, 0.73, 1.77].forEach((x, i) => L.push(F(105 + i, 'COMPC500', 'COMPC', 'П5', x, [x, 5.5], i === 3 ? 'на схеме значок без номера — № 108 (допущение)' : undefined)));
  // 109 — Involight LedPar 933, подсветка склада за мольтоном
  L.push(F(109, 'LEDPAR933', 'STORAGE', 'Д-5', -5.95, [-4.0, -7.5], '«Подсв 109» на схеме'));
  return L;
}

export const FIXTURES = build();
/** Номера, присвоенные по допущению (на схеме цеха номера нет или он дублируется) — на чертеже со звёздочкой. */
export const ASSUMED_NOS = [13, 104, 108];
for (const f of FIXTURES) if (ASSUMED_NOS.includes(f.no)) f.assumed = true;

/** Сколько приборов каждого типа (во всех группах или только в groups). */
export function countByType(groups = null) {
  const counts = {};
  for (const f of FIXTURES) if (!groups || groups.includes(f.group)) counts[f.type] = (counts[f.type] || 0) + 1;
  return counts;
}

/** Питание прибора: линии на схеме не указаны; ламповые — через диммер, остальные — свитчерная линия. */
export function powerOf(f) {
  return TYPES[f.type].lamp ? 'диммерная линия (номер на схеме не указан)' : 'свитчерная линия (S)';
}
