// =============================================================================
//  ПЛОЩАДКА «СТУДИЯ МУЛЬТИМЕДИА» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Съёмочный павильон с угловой белой циклорамой R = 0,70, двухъярусной алюминиевой решёткой ферм,
//  подъёмным фермовым контуром 4,10 × 5,00 м на 4 цепных лебёдках, телескопическим блитчером
//  на 40 мест с двухфазной анимацией, 15 приборами постоянного развеса и 12 светильниками дежурки.
//  Нулевая линия d = 0 — передний край циклорамы; X = 0 — ось симметрии павильона; Y = 0 — пол.
// =============================================================================
import { RIGGING, describeRig } from './config/rigging.js';
import { LAYOUTS, DEFAULT_LAYOUT, SHIFT_STEP, shiftRange, seatCount } from './config/layouts.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS, AIM_NOTE, powerOf, lineText } from './config/fixtures.js';
import { buildArchitecture } from './build/architecture.js';
import { buildCyclorama } from './build/cyclorama.js';
import { buildTrusses } from './build/trusses.js';
import { StudioRigging } from './build/rigging.js';
import { buildHall, animateHall } from './build/hall.js';
import { FLOOR, hangs, poolK } from './build/floor.js';
import { buildEmitters } from './build/emitters.js';
import { ambientLights } from './build/ambient.js';
import { buildDims, buildGrid } from './build/overlays.js';

/** Готовые точки обзора. Координаты: [x, y, d]. */
const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [-6.5, 8.5, -13.5], target: [0.2, 1.4, -0.5], portraitPullback: true },
  hall: { name: 'С блитчера (3-й ряд)', type: 'persp', pos: [-0.45, 0.90 + 1.15, -6.45], target: [0, 1.4, 2.0], portraitPullback: 0.45 },
  camera: { name: 'На циклораму', type: 'persp', pos: [0, 1.6, -6.0], target: [0, 1.4, 3.0] },
  booth: { name: 'Из операторской', type: 'persp', pos: [0.2, 4.1, -7.6], target: [0, 1.0, 2.0] },
  cycToExit: { name: 'С циклорамы к выходу', type: 'persp', pos: [0, 1.7, 3.0], target: [-0.2, 1.2, -7.2] },
  ceiling: { name: 'Фермы и потолок (снизу)', type: 'persp', pos: [0.8, 1.0, -3.8], target: [-0.3, 5.4, 1.2] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [0, 0, -2.475], height: 15.2, width: 9.2, legendRows: 5 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 2.8, -2.475], height: 6.8, width: 14.5 },
};

export default {
  id: 'studio',
  name: 'Студия мультимедиа',
  status: 'draft',
  meta: {
    type: 'Съёмочный павильон с циклорамой',
    seats: 40,
    note: 'черновик',
  },
  caps: {
    rigging: true,
    counterweights: false,
    portable: false,
    duty: true,
    houseLight: false,
    layouts: true,
  },
  // порядок первых 6 слоёв заморожен ссылками черновика; новые слои добавлены строго в конец
  layers: [
    ['walls', 'Стены'],
    ['ceiling', 'Потолок', { bp: 0xe8e9eb }],
    ['cyc', 'Циклорама', { bp: 0xf4f4f2 }],
    ['trusses', 'Фермы', { bp: 0xe2e5ea }],
    ['lights', 'Свет (приборы)'],
    ['duty', 'Свет (дежурка)', { bp: 0x8a8f98 }],
    ['rigging', 'Подвижная ферма', { bp: 0xe2e5ea }],
    ['hall', 'Блитчер (зал)'],
  ],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 35 },
  rigging: {
    list: RIGGING,
    describe: describeRig,
  },
  layouts: {
    list: LAYOUTS,
    default: DEFAULT_LAYOUT,
    shiftStep: SHIFT_STEP,
    steppers: false,
    range: shiftRange,
    seats: seatCount,
    build: buildHall,
    animate: animateHall,
  },
  fixtures: {
    list: FIXTURES,
    types: TYPES,
    specs: SPECS,
    groups: GROUPS,
    groupSets: GROUP_SETS,
    barDepth: {},
    portable: null,
    floor: FLOOR,
    hangs,
    poolK,
    powerOf,
    lineText,
    aimNote: AIM_NOTE,
  },
  lightPlans: LIGHT_PLANS,
  texts: {
    rigDrag: 'подвижную ферму можно тянуть мышью',
    rigHint: 'Высота низа подвижной фермы 4,1 × 5,0 м над полом (4 цепные лебёдки синхронно).',
    layoutHint: 'При переключении блитчер выезжает от стены операторской, поднимаются кресла и выставляется 0-й ряд стульев.',
    extraEquipment: 'Пульт управления светом ETC Cobalt Congo Kid, свитчер Light Union CommuPack 24 (24 свитчерные линии). Под проект возможен довес и установка дополнительного LED-оборудования, профильных и линзовых прожекторов, голов Wash, хейзера (Hazer), штативов и коммутации. Всё постоянное оборудование — направленного театрально-постановочного света (не специализированное кино-видеосветительное).',
  },
  exports: {},

  build(ctx) {
    const mobile = ctx.profile?.name === 'mobile';
    buildArchitecture(ctx.batch, ctx.M, { mobile });
    buildCyclorama(ctx.batch, ctx.M, { mobile });
    buildTrusses(ctx.batch, ctx.M, { mobile });
    const rig = new StudioRigging(ctx.M, { labels: ctx.labels, mobile });
    rig.buildStatic(ctx.batch);
    ctx.commitBatch();
    ctx.add('rigging', rig.root);
    const em = buildEmitters(ctx.M);
    ctx.add('duty', em.groups.duty);
    ctx.add('lights', em.groups.house);
    return {
      rigging: rig,
      emitters: em.groups,
      ambient: (plan) => ambientLights(plan, em),
      overlays: (labels) => ({ dims: buildDims(labels), grid: buildGrid(labels) }),
    };
  },
};
