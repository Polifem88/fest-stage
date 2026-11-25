// =============================================================================
//  ПОДВИЖНАЯ МЕХАНИКА СТУДИИ МУЛЬТИМЕДИА — подъёмный контур ферм 4,10 × 5,00 м.
//  Порядок RIGGING — часть формата ссылки: только добавлять в конец.
// =============================================================================
import { STUDIO } from './dimensions.js';

const MT = STUDIO.movableTruss;

export const RIGGING = [
  {
    id: 'MF',
    name: 'ФП',
    fullName: 'Подъёмная ферма 4,1 × 5,0 м (4 лебёдки)',
    kind: 'truss',
    min: MT.minY,
    max: MT.maxY,
    rest: MT.restY,
  },
];

export const RIG_BY_ID = Object.fromEntries(RIGGING.map((r) => [r.id, r]));

/** Дополнительные строки карточки выбранной подвижной фермы. */
export function describeRig() {
  const T = STUDIO.trusses;
  const fmt = (v) => v.toFixed(2).replace('.', ',');
  return [
    ['Контур по осям', `${fmt(MT.x * 2)} × ${fmt(MT.d1 - MT.d0)} м (габарит ${fmt(MT.x * 2 + T.size)} × ${fmt(MT.d1 - MT.d0 + T.size)} м)`],
    ['Привод', '4 цепные лебёдки синхронно (под Ф3 и Ф5, 1,00 м от стен)'],
    ['Сечение', 'Алюминиевая квадратная ферма 30 × 30 см (труба Ø50, раскосы Ø16)'],
  ];
}
