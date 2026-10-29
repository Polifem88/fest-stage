// =============================================================================
//  ПЛОЩАДКА «СЦЕНА ПОД КРЫШЕЙ» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Трансформируемый зал под капитальными фермами: 6 планировок (caps.layouts), 49 приборов на фермах
//  30 × 30, 20 купольных ламп дежурного света, мольтон склада декораций.
//  Нулевая линия d = 0 — передний край 1-го ряда «Стандарта» (линия ферм с приборами № 1–7);
//  X = 0 — середина рядов; Y = 0 — пол. Размеры — config/dimensions.js, зал — config/layouts.js,
//  развес — config/fixtures.js.
// =============================================================================
import { ROOF } from './config/dimensions.js';
import { LAYOUTS, SHIFT_STEP, shiftRange, seatCount, rowsMax } from './config/layouts.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, AIM_NOTE, powerOf } from './config/fixtures.js';
import { buildArchitecture } from './build/architecture.js';
import { buildTrusses } from './build/trusses.js';
import { buildEmitters, buildMolton } from './build/emitters.js';
import { buildHall } from './build/hall.js';
import { FLOOR, hangs, poolK } from './build/floor.js';
import { buildDims, buildGrid } from './build/overlays.js';
import { ambientLights } from './build/ambient.js';
import { buildPlanDXF, buildSectionDXF } from './export/dxf2d.js';
import { build3DDXF, buildGLB } from './export/export3d.js';

const R = ROOF.room;
const MID_X = (R.x0 + R.x1) / 2, MID_D = (R.d0 + R.d1) / 2;
/** Высота глаз сидящего зрителя над полом/станком (вид из зала и с пульта). */
const EYE = 1.15;
const std = LAYOUTS[0];
const row3 = std.rows.find((r) => r.rank === 3);
const lightPult = std.pults.find((p) => p.kind === 'light');

/** Готовые точки обзора. Координаты: [x, y, d]. */
const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [11.5, 12.5, 12.5], target: [-0.3, 0.6, -1.6], portraitPullback: true },
  hall: { name: 'Из зала (3-й ряд)', type: 'persp', pos: [0.6, row3.h + EYE, (row3.d0 + row3.d1) / 2], target: [0, 1.4, 4.5] },
  booth: { name: 'С пульта света', type: 'persp', pos: [(lightPult.x0 + lightPult.x1) / 2, lightPult.h + EYE, (lightPult.d0 + lightPult.d1) / 2], target: [0.5, 1.2, 3.5] },
  stageToHall: { name: 'Со сцены в зал', type: 'persp', pos: [0, 1.7, 6.2], target: [0, 1.2, -4], portraitPullback: 0.4 },
  ceiling: { name: 'Фермы и потолок (снизу)', type: 'persp', pos: [-1.5, 1.2, -1.5], target: [1.2, ROOF.trusses.y0 + 0.5, 3.5] },
  storage: { name: 'Склад за мольтоном', type: 'persp', pos: [3.5, 1.7, -6.0], target: [-3.0, 1.2, -9.0] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [MID_X, 0, MID_D], height: 20.5, width: 18.5, legendRows: 7 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 2.4, MID_D], height: 7.5, width: 20.5 },
};

/** Групповые источники света по профилю. */
const LIGHT_PLANS = {
  full: [
    { id: 'FRONT', members: ['FRONT', 'FRESNEL'], shadow: false, per: 2.4 },
    { id: 'SIDES', members: ['SIDE_L', 'SIDE_R', 'SIDE_WASH'], shadow: false, per: 2.2 },
    { id: 'WASH', members: ['COMPC'], shadow: true, per: 2.4 },
    { id: 'HEADS', members: ['BEYE', 'RAVEN'], shadow: false, per: 2.2 },
    { id: 'BACK', members: ['BACK'], shadow: false, per: 2.2 },
    { id: 'STORAGE', members: ['STORAGE'], shadow: false, per: 1.6 },
  ],
  lite: [
    { id: 'FRONT_SIDE', members: ['FRONT', 'FRESNEL', 'SIDE_L', 'SIDE_R', 'SIDE_WASH'], per: 2.2 },
    { id: 'STAGE', members: ['COMPC', 'BEYE', 'RAVEN', 'BACK', 'STORAGE'], per: 2.2 },
  ],
};

export default {
  id: 'roof',
  name: 'Сцена под крышей',
  status: 'ready',
  meta: { type: 'Трансформируемый зал в стиле «лофт»', seats: seatCount({ id: std.id, rows: rowsMax(std.id), shift: 0 }) },
  // фермы на жёстком подвесе — механики нет; переносных приборов нет; зального света нет; зал трансформируется
  caps: { rigging: false, counterweights: false, portable: false, duty: true, houseLight: false, layouts: true },
  // порядок = порядок битов в ссылке: только добавлять в конец
  layers: [
    ['hall', 'Зрительный зал'],
    ['walls', 'Стены'],
    ['ceiling', 'Потолок и балки', { bp: 0xe8e9eb, default: false, hidden: true }],
    ['trusses', 'Фермы', { bp: 0xe2e5ea }],
    ['lights', 'Свет (приборы)'],
    ['molton', 'Мольтон', { bp: 0xc9ccd1 }],
  ],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 45 },
  rigging: null,
  layouts: {
    list: LAYOUTS.map((l) => ({ id: l.id, name: l.name, rowsMax: rowsMax(l.id) })),
    default: std.id,
    shiftStep: SHIFT_STEP,
    range: shiftRange,
    seats: seatCount,
    build: buildHall,
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
    lineText: () => 'на схеме не указаны',
    aimNote: AIM_NOTE,
  },
  lightPlans: LIGHT_PLANS,
  texts: {
    extraEquipment: 'Не моделируется, ставится под спектакль: профильные прожекторы Anzhee Profile Q400 и Q100 (RGBALC), '
      + 'головы Anzhee PRO Phoenix Wash 760z, линейные приборы Anzhee LedBar 24-15, дым-машины LookSolution Viper, '
      + 'хейзер SmokeFactory, штативы. Управление: пульт Stage 4 Twin CW+FW (GrandMA2 onPC), диммеры Light Union '
      + 'Wave-1200 — 4 шт. (16 каналов) и 8 переносных, свитчеры Light Union CommuPack-1 (24 линии).',
  },

  build(ctx) {
    const mobile = ctx.profile?.name === 'mobile';
    buildArchitecture(ctx.batch, ctx.M, { mobile });
    buildTrusses(ctx.batch, ctx.M, { mobile });
    ctx.commitBatch();
    const em = buildEmitters(ctx.M);
    ctx.add('lights', em.groups.duty, em.groups.house);
    ctx.add('molton', buildMolton(ctx.M));
    return {
      rigging: null,
      emitters: em.groups,
      ambient: (plan) => ambientLights(plan, em),
      overlays: (labels) => ({ dims: buildDims(labels), grid: buildGrid(labels) }),
    };
  },

  exports: {
    planDXF: buildPlanDXF,
    sectionDXF: buildSectionDXF,
    dxf3d: build3DDXF,
    glb: buildGLB,
  },
};
