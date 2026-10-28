// =============================================================================
//  ПЛОЩАДКА «КАМЕРНАЯ СЦЕНА» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Нулевая линия (d = 0) — задняя (сценическая) грань передних портальных колонн и ригеля
//  (она же плоскость стены с дверью в левый карман); Y = 0 — уровень планшета сцены и 1-го ряда.
//  Все размеры — config/dimensions.js, развес — config/fixtures.js.
// =============================================================================
import { CHAMBER, rowFloorY, rowFrontD } from './config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, AIM_NOTE, powerOf } from './config/fixtures.js';
import { buildArchitecture, buildSeats, buildEmitters } from './build/architecture.js';
import { FLOOR, hangs, poolK } from './build/floor.js';
import { buildDims, buildGrid } from './build/overlays.js';
import { ambientLights } from './build/ambient.js';
import { buildPlanDXF, buildSectionDXF } from './export/dxf2d.js';
import { build3DDXF, buildGLB } from './export/export3d.js';

/** Готовые точки обзора. type: 'persp' | 'ortho'. Координаты: [x, y, d]. */
const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [11.5, 9.2, -10.5], target: [-0.8, 1.8, 2.2], portraitPullback: true },
  hall: { name: 'Из зала (4-й ряд)', type: 'persp', pos: [-0.2, rowFloorY(3) + CHAMBER.hall.eyeY, rowFrontD(3) - 0.35], target: [-0.14, 1.8, 4.5] },
  booth: { name: 'С пульта', type: 'persp', pos: [0.0, CHAMBER.hall.topPlatformY + 1.45, CHAMBER.hall.booth.d1 + 0.25], target: [-0.14, 1.6, 3.8] },
  stageToHall: { name: 'Со сцены в зал', type: 'persp', pos: [-0.14, 1.7, 5.2], target: [0.0, 1.8, -4.5], portraitPullback: 0.4 },
  trusses: { name: 'Фермы (снизу)', type: 'persp', pos: [-2.2, 1.1, 0.5], target: [0.0, CHAMBER.trusses.bottomY, 4.2] },
  pocket: { name: 'Левый карман', type: 'persp', pos: [-3.2, 1.75, 1.2], target: [-7.2, 1.8, 5.8] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [-1.2, 0, 1.8], height: 22.5, width: 19.5, legendRows: 7 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 2.2, 2.0], height: 9.5, width: 20.5 },
};

/** Групповые источники света по профилю (per — яркость одного прибора группы). */
const LIGHT_PLANS = {
  full: [
    { id: 'HALL', members: ['HALL_ZF1', 'HALL_ZF2', 'FOH'], shadow: false, per: 2.2 },
    { id: 'PROS', members: ['PROS_L', 'PROS_R'], shadow: false, per: 2.4 },
    { id: 'ROW1', members: ['ROW1'], shadow: true, per: 2.6 },
    { id: 'ROW2', members: ['ROW2_BAR', 'ROW2'], shadow: true, per: 2.4 },
    { id: 'ROW3', members: ['ROW3'], shadow: false, per: 2.4 },
    { id: 'SIDE_L', members: ['SIDE1_L', 'SIDE2_L', 'SIDE3_L'], shadow: false, per: 2.2 },
    { id: 'SIDE_R', members: ['SIDE1_R', 'SIDE2_R', 'SIDE3_R'], shadow: false, per: 2.2 },
  ],
  lite: [
    { id: 'FRONT', members: ['HALL_ZF1', 'HALL_ZF2', 'FOH', 'PROS_L', 'PROS_R', 'ROW1'], per: 2.2 },
    { id: 'STAGE', members: ['ROW2_BAR', 'ROW2', 'ROW3', 'SIDE1_L', 'SIDE1_R', 'SIDE2_L', 'SIDE2_R', 'SIDE3_L', 'SIDE3_R'], per: 2.2 },
  ],
};

export default {
  id: 'chamber',
  name: 'Камерная сцена',
  status: 'ready',
  meta: { type: 'Аудитория с фиксированным амфитеатром', seats: CHAMBER.hall.seatsTotal },
  // фермы неподвижны — механики нет; переносных приборов нет
  caps: { rigging: false, counterweights: false, portable: false, duty: true, houseLight: true, layouts: false },
  // порядок = порядок битов в ссылке: только добавлять в конец
  layers: [
    ['hall', 'Зрительный зал'],
    ['walls', 'Стены и потолок'],
    ['trusses', 'Фермы', { bp: 0xe2e5ea }],
    ['lights', 'Свет (приборы)'],
  ],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 45 },
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
    floor: FLOOR,
    hangs,
    poolK,
    powerOf,
    lineText: (g) => (g.ds ? `${g.ds} (D — диммерные, S — свитчерные)` : 'на схеме не указаны'),
    aimNote: AIM_NOTE,
  },
  lightPlans: LIGHT_PLANS,

  build(ctx) {
    const mobile = ctx.profile?.name === 'mobile';
    buildArchitecture(ctx.batch, ctx.M, { mobile });
    ctx.commitBatch();
    ctx.add('hall', ...buildSeats(ctx.M));
    const em = buildEmitters(ctx.M);
    ctx.add('lights', em.groups.duty);
    ctx.add('hall', em.groups.house);
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
