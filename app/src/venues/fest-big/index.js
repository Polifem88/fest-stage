// =============================================================================
//  ПЛОЩАДКА «БОЛЬШАЯ СЦЕНА» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Нулевая линия (d = 0) — передняя (зрительская) плоскость портала; Y = 0 — планшет сцены.
//  Все размеры — config/dimensions.js, механика — config/rigging.js, развес — config/fixtures.js.
// =============================================================================
import { DIM, rowFrontD } from './config/dimensions.js';
import { RIGGING, DUTY_ROWS } from './config/rigging.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, BAR_DEPTH, PORTABLE, portablePlacement, powerOf, AIM_NOTE } from './config/fixtures.js';
import { buildArchitecture, buildSeats, buildEmitters, HALL_BACK_FLOOR_Y } from './build/architecture.js';
import { RiggingSystem } from './build/rigging.js';
import { buildDims, buildGrid } from './build/overlays.js';
import { FLOOR, hangs, poolK } from './build/floor.js';
import { ambientLights } from './build/ambient.js';
import { buildPlanDXF, buildSectionDXF } from './export/dxf2d.js';
import { build3DDXF, buildGLB } from './export/export3d.js';

const eyeY = (row) => -DIM.forestage.height + row * DIM.hall.rowPitch * Math.tan((DIM.hall.rakeDeg * Math.PI) / 180) + 1.15;

/** Готовые точки обзора. type: 'persp' | 'ortho'. Координаты: [x, y, d]. */
const VIEWS = {
  // в книжной ориентации телефона общий вид отодвигается, чтобы влезла вся сцена (portraitPullback)
  overview: { name: 'Общий вид', type: 'persp', pos: [15.5, 12.5, -16], target: [0, 2.2, 2.5], portraitPullback: true },
  hall: { name: 'Из зала (8-й ряд)', type: 'persp', pos: [0, eyeY(7), rowFrontD(7) - 0.42], target: [0, 2.6, 4] },
  booth: { name: 'С пульта', type: 'persp', pos: [0.8, HALL_BACK_FLOOR_Y + 2.7, -DIM.hall.portalToBoothWall + 0.3], target: [0, 1.4, 3] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [0, 0, -4.2], height: 31 },
  // только коробка и авансцена, крупно; снизу остаётся полоса под экспликацию (legendRows)
  planStage: { name: 'План сцены (крупно)', type: 'ortho', dir: 'top', center: [0, 0, 0.4], height: 20.5, legendRows: 7 },
  // вся глубина здания: от задней стены сцены (9,2) до операторской (−18)
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 3.6, -4.4], height: 19.5 },
  stageToHall: { name: 'Со сцены в зал', type: 'persp', pos: [0, 1.7, 4.5], target: [0, 1.6, -12] },
  upperGallery: { name: 'С верхней галереи', type: 'persp', pos: [-1.5, DIM.galleries.upperY + 1.6, 8.75], target: [0, 2.2, 1.0] },
  // подписи всех 16 канатов читаются только вблизи — показываются в этом виде (allRopeLabels)
  flyGallery: { name: 'Рабочая галерея (канаты)', type: 'persp', pos: [-3.6, 1.8, 0.4], target: [-8.3, 2.4, 5.2], allRopeLabels: true },
};

/** Групповые источники света по профилю (per — яркость одного прибора группы). */
const LIGHT_PLANS = {
  full: [
    { id: 'C0', members: ['C0'], shadow: false },
    { id: 'C1', members: ['C1'], shadow: true },
    { id: 'C2', members: ['C2'], shadow: true },
    { id: 'C3', members: ['C3'], shadow: false },
    { id: 'GAL', members: ['GAL_L', 'GAL_R', 'GAL_B'] },
    { id: 'BR', members: ['BR1', 'BR2'], shadow: false },
    { id: 'BOXL', members: ['BOX_L1', 'BOX_L2', 'TOW_L'], per: 2.5 },
    { id: 'BOXR', members: ['BOX_R1', 'BOX_R2', 'TOW_R'], per: 2.5 },
    { id: 'FOH', members: ['FOH'], per: 14 },
    { id: 'PORT_L', members: ['PORT_L'], shadow: false },
    { id: 'PORT_R', members: ['PORT_R'], shadow: false },
  ],
  lite: [
    { id: 'FRONT', members: ['C0', 'C1'] },
    { id: 'BACK', members: ['C2', 'C3', 'GAL_L', 'GAL_R', 'GAL_B'] },
    { id: 'HALL', members: ['BR1', 'BR2', 'BOX_L1', 'BOX_L2', 'BOX_R1', 'BOX_R2', 'TOW_L', 'TOW_R', 'FOH'], per: 2.5 },
  ],
};

const CONTROL_NAMES = { left: 'левая стена (рабочая галерея)', 'right-front': 'правый передний угол за порталом', 'right-back-pad': 'под площадкой узла подъёма' };
const fmt2 = (v) => v.toFixed(2).replace('.', ',');

/** Строки карточки механики, особые для этой сцены (после «Тип», «Высота», «Ход»). */
function describeRig(r) {
  return [
    r.kind === 'side'
      ? ['Положение', `${r.x < 0 ? 'слева' : 'справа'}, от ${fmt2(r.dFrom)} до ${fmt2(r.dTo)} м за порталом`]
      : ['От портала', `${fmt2(r.d)} м ${r.d < 0 ? '(перед порталом)' : 'вглубь'}`],
    ['Подвесов', String(r.lines)],
    ['Управление', CONTROL_NAMES[r.control] + (r.via === 'redirect' ? ', через обводные блоки' : '')],
  ];
}

export default {
  id: 'big',
  name: 'Большая сцена',
  status: 'ready',
  meta: { type: 'Сцена-коробка с порталом', seats: DIM.hall.rows * DIM.hall.seatsPerRow },
  caps: { rigging: true, counterweights: true, portable: true, duty: true, houseLight: true },
  layers: [['hall', 'Зрительный зал'], ['walls', 'Стены и потолок коробки'], ['galleries', 'Галереи'], ['rigging', 'Механика'], ['lights', 'Свет (приборы)']],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 70 },
  // ссылки v1 (до каталога сцен): сколько было приборов и слоёв — новые, добавленные в конец, останутся включены
  linkV1: { fixtures: 124, layers: 5 },
  rigging: { list: RIGGING, describe: describeRig },
  fixtures: {
    list: FIXTURES,
    types: TYPES,
    specs: SPECS,
    groups: GROUPS,
    groupSets: GROUP_SETS,
    barDepth: BAR_DEPTH,
    portable: { ...PORTABLE, placement: portablePlacement, title: 'Переносные ETC 50° (прострелы по планшету)', short: 'Переносные ETC 50°' },
    floor: FLOOR,
    hangs,
    poolK,
    powerOf,
    lineText: (g) => (g.ds === '—' ? 'на схеме не указаны' : `${g.ds} (D — диммерные, S — свитчерные)`),
    aimNote: AIM_NOTE,
  },
  lightPlans: LIGHT_PLANS,
  texts: { rigDrag: 'штанкет можно тянуть мышью' },

  /** Порядок построения сохранён как до модульной переделки (одинаковый результат рендера). */
  build(ctx) {
    const P = ctx.profile;
    buildArchitecture(ctx.batch, ctx.M);
    const rigging = new RiggingSystem(ctx.M, { ropes: P.ropes, ropeLabels: P.ropeLabels, labels: ctx.labels });
    rigging.buildStatic(ctx.batch);
    ctx.commitBatch();
    const [seatsF, seatsK] = buildSeats(ctx.M);
    ctx.add('hall', seatsF, seatsK);
    const em = buildEmitters(ctx.M, DUTY_ROWS);
    ctx.add('lights', em.groups.duty);
    ctx.add('hall', em.groups.house);
    ctx.add('rigging', rigging.root);
    return {
      rigging,
      emitters: em.groups,
      ambient: (plan) => ambientLights(plan, em),
      overlays: (labels) => ({ dims: buildDims(labels), grid: buildGrid(labels) }),
    };
  },

  exports: { planDXF: buildPlanDXF, sectionDXF: buildSectionDXF, dxf3d: build3DDXF, glb: buildGLB },
};
