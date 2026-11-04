// =============================================================================
//  ПЛОЩАДКА «СТУДИЯ МУЛЬТИМЕДИА» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Съёмочный павильон с угловой белой циклорамой, алюминиевой фермовой решёткой (верхний ярус,
//  нижние фермы и 3 вертикальные вставки), окном операторской и 12 светильниками дежурного света.
//  Статус: 'draft' (черновик: без приборов сценического света и без расстановки кресел).
//  Нулевая линия d = 0 — передний край циклорамы; X = 0 — ось симметрии павильона; Y = 0 — пол.
// =============================================================================
import { STUDIO } from './config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS } from './config/fixtures.js';
import { buildArchitecture } from './build/architecture.js';
import { buildCyclorama } from './build/cyclorama.js';
import { buildTrusses } from './build/trusses.js';
import { buildEmitters } from './build/emitters.js';
import { ambientLights } from './build/ambient.js';
import { buildDims, buildGrid } from './build/overlays.js';
import { rectFloor } from '../../systems/fixtures.js';

const R = STUDIO.room;

/** Готовые точки обзора. Координаты: [x, y, d]. */
const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [6.0, 9.0, -14.0], target: [0, 1.5, 0], portraitPullback: true },
  camera: { name: 'На циклораму', type: 'persp', pos: [0, 1.6, -6.0], target: [0, 1.4, 3.0] },
  booth: { name: 'Из операторской', type: 'persp', pos: [0.2, 4.1, -7.6], target: [0, 1.0, 2.0] },
  cycToExit: { name: 'С циклорамы к выходу', type: 'persp', pos: [0, 1.7, 3.0], target: [1.5, 1.4, -8.0] },
  ceiling: { name: 'Фермы и потолок (снизу)', type: 'persp', pos: [-1.0, 1.2, -2.0], target: [0.5, 5.4, 1.0] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [0, 0, -2.475], height: 14.5, width: 9 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 2.8, -2.475], height: 6.8, width: 14.5 },
};

export default {
  id: 'studio',
  name: 'Студия мультимедиа',
  status: 'draft',
  meta: {
    type: 'Съёмочный павильон с циклорамой',
    note: 'черновик: без света и зала',
  },
  caps: {
    rigging: false,
    counterweights: false,
    portable: false,
    duty: true,
    houseLight: false,
    layouts: false,
  },
  // порядок = порядок битов в ссылке: только добавлять в конец
  layers: [
    ['walls', 'Стены'],
    ['ceiling', 'Потолок', { bp: 0xe8e9eb }],
    ['cyc', 'Циклорама', { bp: 0xf4f4f2 }],
    ['trusses', 'Фермы', { bp: 0xe2e5ea }],
    ['lights', 'Свет (приборы)'],
    ['duty', 'Свет (дежурка)', { bp: 0x8a8f98 }],
  ],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 35 },
  rigging: null,
  layouts: null,
  fixtures: {
    list: FIXTURES,
    types: TYPES,
    specs: SPECS,
    groups: GROUPS,
    groupSets: GROUP_SETS,
    barDepth: {},
    portable: null,
    floor: rectFloor({ x0: R.x0, x1: R.x1, d0: R.d0, d1: R.d1 }),
    hangs: () => true,
    poolK: () => 0.5,
  },
  lightPlans: LIGHT_PLANS,
  exports: {},

  build(ctx) {
    const mobile = ctx.profile?.name === 'mobile';
    buildArchitecture(ctx.batch, ctx.M, { mobile });
    buildCyclorama(ctx.batch, ctx.M, { mobile });
    buildTrusses(ctx.batch, ctx.M, { mobile });
    ctx.commitBatch();
    const em = buildEmitters(ctx.M);
    ctx.add('duty', em.groups.duty);
    ctx.add('lights', em.groups.house);
    return {
      rigging: null,
      emitters: em.groups,
      ambient: (plan) => ambientLights(plan, em),
      overlays: (labels) => ({ dims: buildDims(labels), grid: buildGrid(labels) }),
    };
  },
};
