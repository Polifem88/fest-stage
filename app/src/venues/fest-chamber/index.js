// =============================================================================
//  ПЛОЩАДКА «КАМЕРНАЯ СЦЕНА» ТЕАТРА ФЭСТ (ЧЕРНОВИК) — модуль для движка
//  (контракт: venues/contract.js). Построена по шаблону «чёрный кабинет» (venues/_template).
//  Нулевая линия (d = 0) — передний край игровой площадки (портала нет); Y = 0 — пол.
//  Размеры — config/dimensions.js, развес — config/fixtures.js.
// =============================================================================
import { CHAMBER } from './config/dimensions.js';
import { FIXTURES, TYPES, GROUPS, GROUP_SETS, AIM_NOTE, powerOf } from './config/fixtures.js';
import { buildBlackBox, blackBoxViews, blackBoxOverlays, blackBoxAmbient, seatCount } from '../_template/index.js';
import { rectFloor } from '../../systems/fixtures.js';

const R = CHAMBER.room;

/** Групповые источники света по профилю (per — яркость одного прибора группы). */
const LIGHT_PLANS = {
  full: [
    { id: 'FRONT', members: ['FRONT'], shadow: false },
    { id: 'MID', members: ['MID'], shadow: true },
    { id: 'BACK', members: ['BACK'], shadow: false },
  ],
  lite: [
    { id: 'FRONT', members: ['FRONT'] },
    { id: 'TOP', members: ['MID', 'BACK'] },
  ],
};

export default {
  id: 'chamber',
  name: 'Камерная сцена',
  status: 'draft',
  meta: { type: 'Чёрный кабинет', seats: seatCount(CHAMBER), note: 'черновик: размеры условные' },
  // фермы неподвижны — механики нет; переносных приборов нет
  caps: { rigging: false, counterweights: false, portable: false, duty: true, houseLight: true },
  // порядок = порядок битов в ссылке: только добавлять в конец
  layers: [['hall', 'Зрительный зал'], ['walls', 'Стены и потолок'], ['trusses', 'Фермы', { bp: 0xe2e5ea }], ['lights', 'Свет (приборы)']],
  views: blackBoxViews(CHAMBER),
  defaultView: 'overview',
  camera: { maxDistance: 40 },
  rigging: null,
  fixtures: {
    list: FIXTURES,
    types: TYPES,
    groups: GROUPS,
    groupSets: GROUP_SETS,
    barDepth: {},
    portable: null,
    floor: rectFloor({ x0: R.x0, x1: R.x1, d0: R.d0, d1: R.d1 }),
    hangs: (f) => f.truss != null,
    poolK: () => 0.5,
    powerOf,
    aimNote: AIM_NOTE,
  },
  lightPlans: LIGHT_PLANS,

  build(ctx) {
    const bb = buildBlackBox(ctx, CHAMBER);
    return {
      rigging: null,
      emitters: bb.emitters,
      ambient: (plan) => blackBoxAmbient(plan, CHAMBER, bb.dutyRows),
      overlays: (labels) => blackBoxOverlays(labels, CHAMBER),
    };
  },

  // DXF у черновика нет; 3D-модель (.glb) движок выгружает общим экспортом
  exports: {},
};
