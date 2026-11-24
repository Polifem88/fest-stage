// =============================================================================
//  ПЛОЩАДКА «ФОЙЕ» ТЕАТРА ФЭСТ — модуль для движка (контракт: venues/contract.js).
//  Двухсветное лофт-пространство (1-й и 2-й этажи), панорамное остекление ВБ6/ВБ3,
//  трапециевидный проём второго света, ломаная парадная лестница (13 + 9 ступеней) с
//  ограждениями ОГ-2, 3-зонный потолок, алюминиевая сетка ферм Q25/31 + периметральная
//  Г-ферма (+2,70), стационарный интерьер (LED-экран, стойки, диваны, витрины),
//  оранжевая ткань на лестнице и дежурный свет.
//  Статус: 'draft' (Этап 1: без сценических приборов и без трансформируемого зала).
//  Нулевая линия d = 0 — внутреннее стекло витража 1-го этажа (ВБ6);
//  X = 0 — ось Г (середина 24 м); Y = 0 — чистый пол 1-го этажа (+3,00 — 2-й этаж).
// =============================================================================
import { FOYER } from './config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS } from './config/fixtures.js';
import { buildArchitecture } from './build/architecture.js';
import { buildStairs } from './build/stairs.js';
import { buildWindows } from './build/windows.js';
import { buildTrusses } from './build/trusses.js';
import { buildInterior } from './build/interior.js';
import { buildCurtain } from './build/curtain.js';
import { buildEmitters } from './build/emitters.js';
import { ambientLights } from './build/ambient.js';
import { buildDims, buildGrid } from './build/overlays.js';
import { rectFloor } from '../../systems/fixtures.js';

const R = FOYER.room;

/** Готовые точки обзора. Координаты: [x, y, d]. */
const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [-14.5, 16.5, -13.5], target: [-0.2, 2.5, 9.5], portraitPullback: true },
  atrium1f: { name: '1-й этаж (у окон)', type: 'persp', pos: [-3.5, 1.75, 2.8], target: [-1.5, 2.2, 11.8] },
  gallery2f: { name: '2-й этаж (галерея)', type: 'persp', pos: [4.2, 4.7, 17.5], target: [-2.5, 4.2, 5.5] },
  stairs: { name: 'С лестницы', type: 'persp', pos: [-5.5, 4.7, 12.7], target: [4.5, 3.8, 7.5] },
  windows2f: { name: 'Оконная галерея', type: 'persp', pos: [-7.6, 4.7, 2.75], target: [6.5, 5.1, 2.75] },
  ceiling: { name: 'Фермы и потолок', type: 'persp', pos: [-1.5, 1.5, 8.2], target: [0.5, 7.6, 6.5] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [-0.18, 0, 10.2], height: 25.5, width: 27 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 4.6, 9.71], height: 11, width: 24 },
};

export default {
  id: 'foyer',
  name: 'Фойе',
  status: 'draft',
  meta: {
    type: 'Двухсветное фойе с парадной лестницей',
    note: 'черновик: без сценического света и расстановки зала',
  },
  caps: {
    rigging: false,
    counterweights: false,
    portable: false,
    duty: true,
    houseLight: false,
    layouts: false,
  },
  // порядок = порядок битов в ссылке (#v=foyer&s=…): только добавлять в конец!
  layers: [
    ['walls', 'Стены и этажи'],
    ['windows', 'Витражи и окна', { bp: 0xcfe2f3 }],
    ['stairs', 'Лестница и перила', { bp: 0xd8dce2 }],
    ['curtain', 'Ткань на лестнице', { bp: 0xe6a880 }],
    ['furniture', 'Мебель и стойки', { bp: 0xd9cfc2 }],
    ['ceiling', 'Потолок', { bp: 0xe8e9eb }],
    ['trusses', 'Фермы', { bp: 0xe2e5ea }],
    ['lights', 'Свет (приборы)'],
    ['duty', 'Свет (дежурка)', { bp: 0x8a8f98 }],
  ],
  views: VIEWS,
  defaultView: 'overview',
  camera: { maxDistance: 55 },
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
    floor: rectFloor({ x0: R.x0, x1: R.x1, d0: R.dGlass2, d1: R.dWall2 }),
    hangs: () => true,
    poolK: () => 0.5,
  },
  lightPlans: LIGHT_PLANS,
  exports: {},

  build(ctx) {
    const mobile = ctx.profile?.name === 'mobile';
    buildArchitecture(ctx.batch, ctx.M, { mobile });
    buildStairs(ctx.batch, ctx.M, { mobile });
    buildWindows(ctx.batch, ctx.M, { mobile });
    buildTrusses(ctx.batch, ctx.M, { mobile });
    buildInterior(ctx.batch, ctx.M, { mobile });
    buildCurtain(ctx.batch, ctx.M, { mobile });
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
