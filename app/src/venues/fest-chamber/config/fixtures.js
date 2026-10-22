// =============================================================================
//  ПРИБОРЫ КАМЕРНОЙ СЦЕНЫ (ЧЕРНОВИК) — развес условный (assumption: true):
//  схемы развеса нет, приборы расставлены, чтобы работала вкладка «Свет».
//  Типы — общий справочник театра (library/fixtureTypes.js). Все приборы висят
//  под нижним поясом неподвижных ферм (mount.on = null — механики нет).
//  Фермы нумеруются от стены за зрителями: № 1 (d = −4,5) … № 9 (d = 3,5).
// =============================================================================
import { CHAMBER } from './dimensions.js';
import { trussDs, trussChords } from '../../_template/layout.js';
import { venueTypes } from '../../../library/fixtureTypes.js';

export const TYPES = venueTypes();

const DS = trussDs(CHAMBER);
/** Точка крепления на нижнем поясе фермы ti (side: 0 — пояс со стороны зрителей, 1 — со стороны площадки). */
function onTruss(ti, x, side) {
  const bottom = trussChords(CHAMBER, DS[ti]).bottom;
  const [y, d] = bottom[Math.min(side, bottom.length - 1)];
  // +0,02: струбцина прибора (центр на 8 см ниже точки крепления) обнимает трубу пояса
  return { on: null, x, y: y + 0.02, d };
}

/** Группы: ds — линии со схемы (схемы нет — пусто). */
export const GROUPS = {
  FRONT: { name: 'Фронт (ферма № 3, над зрителями)', ds: '' },
  MID: { name: 'Верхний свет (ферма № 6)', ds: '' },
  BACK: { name: 'Контровой (ферма № 9)', ds: '' },
};

export const GROUP_SETS = [
  { id: 'front', name: 'Фронт', groups: ['FRONT'] },
  { id: 'mid', name: 'Верх', groups: ['MID'] },
  { id: 'back', name: 'Контра', groups: ['BACK'] },
];

/** НАВЕДЕНИЕ — УСЛОВНОЕ: реальной фокусировки нет. В карточке прибора это помечено. */
export const AIM_NOTE = 'условное (допущение модели) — реальное наведение уточняйте у светового цеха';

// [тип, x крепления, x цели, d цели] — слева направо (как смотреть из зала)
const RIG = {
  FRONT: { truss: 2, side: 1, items: [['ETC26', -3.75, -2.6, 2.6], ['ETC26', -2.25, -1.6, 1.2], ['ETC26', -0.75, -0.5, 2.6], ['ETC26', 0.75, 0.5, 1.2], ['ETC26', 2.25, 1.6, 2.6], ['ETC26', 3.75, 2.6, 1.2]] },
  MID: { truss: 5, side: 0, items: [['FRESNEL', -3.75, -3.0, 2.2], ['FRESNEL', -2.25, -1.8, 2.2], ['FRESNEL', -0.75, -0.6, 2.2], ['FRESNEL', 0.75, 0.6, 2.2], ['FRESNEL', 2.25, 1.8, 2.2], ['FRESNEL', 3.75, 3.0, 2.2]] },
  BACK: { truss: 8, side: 0, items: [['PLUTO', -4.5, -2.6, 1.6], ['PAR64', -3.0, -2.4, 1.0], ['PAR64', -1.0, -0.8, 1.0], ['PAR64', 1.0, 0.8, 1.0], ['PAR64', 3.0, 2.4, 1.0], ['PLUTO', 4.5, 2.6, 1.6]] },
};

function build() {
  const list = [];
  for (const [group, { truss, side, items }] of Object.entries(RIG)) {
    for (const [type, x, ax, ad] of items) {
      list.push({ no: `К${list.length + 1}`, type, group, truss, mount: onTruss(truss, x, side), aim: { x: ax, y: 0, d: ad } });
    }
  }
  return list;
}

/** Каждый прибор: { no, type, group, truss (индекс фермы), mount: { on: null, x, y, d }, aim: { x, y, d } } */
export const FIXTURES = build();

/** Питание: ламповые — диммерная линия, остальные (LED) — свитчерная. Номера линий не известны. */
export function powerOf(f) {
  return TYPES[f.type].lamp ? 'диммерная линия' : 'свитчерная линия';
}
