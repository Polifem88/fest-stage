// =============================================================================
//  СТУДИЯ МУЛЬТИМЕДИА — постоянный развес светового оборудования (15 приборов).
//  Источники: data/studio/Cвет/ (описание .docx + схема развеса) и натурные фотографии
//  павильона (привязка двух боковых Profile 100 на нижних фермах Н±2.70 у края циклорамы).
//  Порядок FIXTURES — часть формата ссылки: только добавлять в конец.
//  ВАЖНО: локальный тип BSW200 добавляется через venueTypes(LOCAL_TYPES), не меняя
//  library/fixtureTypes.js, чтобы сохранить палитру цветов Большой сцены.
// =============================================================================
import { STUDIO } from './dimensions.js';
import { venueTypes } from '../../../library/fixtureTypes.js';
import { SPECS as LIB_SPECS } from '../../../library/specs.js';

export const LOCAL_TYPES = {
  BSW200: { name: 'Showlee BSW 200', shape: 'spot', beam: 16, scale: 0.82 },
};

export const LOCAL_SPECS = {
  BSW200: {
    power: '≈ 250 Вт (макс.)',
    source: 'LED 200 Вт белый',
    zoom: 'мотор. зум (Beam / Spot / Wash)',
    color: 'колесо цветов',
    weight: '≈ 11 кг',
    dmx: '16–20 кан.',
    ip: 'IP20',
    confidence: 'средняя (типовой OEM-паспорт BSW 200 LED)',
  },
};

export const TYPES = venueTypes(LOCAL_TYPES);
export const SPECS = { ...LIB_SPECS, ...LOCAL_SPECS };

/** Состав постоянного развеса по типам (проверяется юнит-тестом). */
export const INVENTORY = {
  PROF_CW: 3,
  BSW200: 2,
  PROF100_RGB: 2,
  BEYE640: 8,
};

export const GROUPS = {
  FRONT: { name: 'Фронт на Ф1 (профили 1–3)', set: 'front', ds: 'свитчер CommuPack 24' },
  SPOT: { name: 'Головы BSW 200 на Ф2 (4–5)', set: 'spot', ds: 'свитчер CommuPack 24' },
  SIDE_L: { name: 'Левый боковой профиль на Н-2.70 (6)', set: 'sides', ds: 'свитчер CommuPack 24' },
  SIDE_R: { name: 'Правый боковой профиль на Н2.70 (7)', set: 'sides', ds: 'свитчер CommuPack 24' },
  CYC: { name: 'Заливка циклорамы B-Eye (8–15)', set: 'cyc', ds: 'свитчер CommuPack 24' },
};

export const GROUP_SETS = [
  { id: 'front', name: 'Фронт', groups: ['FRONT'] },
  { id: 'spot', name: 'BSW 200', groups: ['SPOT'] },
  { id: 'sides', name: 'Профили', groups: ['SIDE_L', 'SIDE_R'] },
  { id: 'cyc', name: 'Циклорама', groups: ['CYC'] },
];

export const LIGHT_PLANS = {
  full: [
    { id: 'FRONT', members: ['FRONT'], shadow: false, per: 3.4 },
    { id: 'SPOT', members: ['SPOT'], shadow: true, per: 3.6 },
    { id: 'SIDES', members: ['SIDE_L', 'SIDE_R'], shadow: false, per: 2.8 },
    { id: 'CYC', members: ['CYC'], shadow: false, per: 2.6 },
  ],
  lite: [
    { id: 'FRONT_SIDE', members: ['FRONT', 'SPOT', 'SIDE_L', 'SIDE_R'], per: 3.2 },
    { id: 'CYC', members: ['CYC'], per: 2.6 },
  ],
};

export const AIM_NOTE = 'условное (допущение модели) — реальная фокусировка выставляется под съёмку или спектакль';

const HANG = 0.02; // отступ точки подвеса струбцины под нижним поясом фермы
const ALL_LINES = Object.fromEntries([
  ...STUDIO.trusses.upper.lines.map((l) => [l.id, { ...l, y0: STUDIO.trusses.upper.y0 }]),
  ...STUDIO.trusses.lower.lines.map((l) => [l.id, { ...l, y0: STUDIO.trusses.lower.y0 }]),
]);

export function onTruss(lineId, along) {
  const l = ALL_LINES[lineId];
  if (!l) throw new Error(`нет линии ферм ${lineId}`);
  const y = +(l.y0 - HANG).toFixed(4);
  return l.axis === 'd' ? { on: null, x: along, y, d: l.at } : { on: null, x: l.at, y, d: along };
}

const F = (no, type, group, line, along, aim, extra = {}) => ({
  no,
  type,
  group,
  line,
  assumed: true,
  mount: onTruss(line, along),
  aim: { x: aim[0], y: 0, d: aim[1] },
  ...extra,
});

export const FIXTURES = [
  // № 1–3: фронтальные профили Anzhee Profile Q400 (WW+CW) на Ф1 (d = −7,55)
  F(1, 'PROF_CW', 'FRONT', 'Ф1', -1.75, [-0.45, 0.30]),
  F(2, 'PROF_CW', 'FRONT', 'Ф1', 0, [0, 0.50]),
  F(3, 'PROF_CW', 'FRONT', 'Ф1', 1.75, [0.45, 0.30]),

  // № 4–5: поворотные головы Showlee BSW 200 на Ф2 (d = −5,70)
  F(4, 'BSW200', 'SPOT', 'Ф2', -1.35, [-0.80, 0.80], { assumption: true }),
  F(5, 'BSW200', 'SPOT', 'Ф2', 1.35, [0.80, 0.80], { assumption: true }),

  // № 6–7: боковые профили Anzhee Profile 100 (RGBALC) на нижних фермах Н±2.70 у края циклорамы (d = −0,55, по фото)
  F(6, 'PROF100_RGB', 'SIDE_L', 'Н-2.70', -0.55, [0.60, 1.60], { assumption: true }),
  F(7, 'PROF100_RGB', 'SIDE_R', 'Н2.70', -0.55, [-0.60, 1.60], { assumption: true }),

  // № 8–15: заливка циклорамы Anzhee H6x40Z B-EYE П-контуром (Д-2.70, Ф6, Д2.70)
  F(8, 'BEYE640', 'CYC', 'Д-2.70', 0.65, [-1.80, 1.20]),
  F(9, 'BEYE640', 'CYC', 'Д-2.70', 2.55, [-1.80, 2.60]),
  F(10, 'BEYE640', 'CYC', 'Ф6', -1.80, [-1.60, 2.40]),
  F(11, 'BEYE640', 'CYC', 'Ф6', -0.60, [-0.55, 2.40]),
  F(12, 'BEYE640', 'CYC', 'Ф6', 0.60, [0.55, 2.40]),
  F(13, 'BEYE640', 'CYC', 'Ф6', 1.80, [1.60, 2.40]),
  F(14, 'BEYE640', 'CYC', 'Д2.70', 2.55, [1.80, 2.60]),
  F(15, 'BEYE640', 'CYC', 'Д2.70', 0.65, [1.80, 1.20]),
];

export function countByType(groups = null) {
  const counts = {};
  for (const f of FIXTURES) if (!groups || groups.includes(f.group)) counts[f.type] = (counts[f.type] || 0) + 1;
  return counts;
}

export function powerOf() {
  return 'свитчер CommuPack 24 (номер линии не указан)';
}

export function lineText() {
  return 'пульт ETC Cobalt Congo Kid';
}
