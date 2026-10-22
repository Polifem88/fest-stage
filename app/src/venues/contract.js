// =============================================================================
//  КОНТРАКТ ПЛОЩАДКИ — что модуль сцены обязан отдать движку (engine/stage.js).
//  Модуль: venues/<театр>-<сцена>/index.js, экспорт по умолчанию — объект VenueModule.
//  validateVenue() проверяется юнит-тестом для каждой площадки реестра.
// =============================================================================
import { RIG_KINDS } from '../library/rigKinds.js';

/**
 * @typedef {Object} VenueModule
 * @property {string} id                       'big' — совпадает с id в registry.js и с #v= в ссылке
 * @property {string} name                     'Большая сцена'
 * @property {'ready'|'draft'} status
 * @property {{type:string, seats?:number, note?:string}} meta   — для карточки в списке сцен
 * @property {Capabilities} caps               — что есть на площадке; интерфейс скрывает остальное
 * @property {Array<[string, string, {bp?:number}?]>} layers
 *           слои [ключ, подпись, {bp: цвет в «чертеже»}]; порядок = порядок битов в ссылке, НЕ МЕНЯТЬ
 *           у опубликованной площадки (только добавлять в конец). Слой 'lights' обязателен.
 * @property {Record<string, View>} views      — готовые точки обзора; порядок = порядок кнопок
 * @property {string} defaultView
 * @property {{list: RigCfg[], controlNames?: Record<string,string>, describe?: Function}|null} rigging
 *           подвижная механика (порядок list = порядок в ссылке); null — механики нет
 * @property {FixturesCfg} fixtures
 * @property {{full: LightPlan[], lite: LightPlan[]}} lightPlans   — групповые источники по профилю
 * @property {(ctx: BuildCtx) => Built} build  — строит геометрию площадки
 * @property {Partial<Record<'planDXF'|'sectionDXF'|'dxf3d'|'glb', (stage) => any>>} exports
 * @property {{maxDistance?: number}} [camera]
 * @property {{rigDrag?: string}} [texts]
 *
 * @typedef {{rigging:boolean, counterweights:boolean, portable:boolean, duty:boolean, houseLight:boolean}} Capabilities
 * @typedef {{name:string, type:'persp'|'ortho', pos?:number[], target?:number[], dir?:'top'|'side',
 *            center?:number[], height?:number, width?:number, portraitPullback?:boolean|number, allRopeLabels?:boolean, legendRows?:number}} View
 * @typedef {{id:string, name:string, kind:string, min:number, max:number, rest:number}} RigCfg
 * @typedef {{list:Object[], types:Object, groups:Object, groupSets:Object[], barDepth:Object,
 *            specs?:Object, portable:Object|null, floor:{trace:Function, zone:Function, clip:Function},
 *            hangs:Function, poolK:Function, powerOf?:Function, lineText?:Function, aimNote?:string}} FixturesCfg
 * @typedef {{id:string, members:string[], shadow?:boolean, per?:number}} LightPlan
 * @typedef {{batch:Object, M:Object, labels:Object, profile:Object, commitBatch:Function, add:Function}} BuildCtx
 * @typedef {{rigging?:Object|null, emitters?:{duty:Object, house:Object}|null,
 *            ambient?:(plan:string)=>Object, overlays?:(labels:Object)=>{dims?:Object, grid?:Object}}} Built
 */

const CAPS = ['rigging', 'counterweights', 'portable', 'duty', 'houseLight'];

/** Проверка модуля площадки. @returns {string[]} список ошибок (пустой — всё в порядке) */
export function validateVenue(v) {
  const err = [];
  const need = (cond, msg) => { if (!cond) err.push(msg); };
  need(v && typeof v === 'object', 'модуль не объект');
  if (!v || typeof v !== 'object') return err;
  need(typeof v.id === 'string' && /^[a-z][a-z0-9-]*$/.test(v.id), `id «${v.id}»: латиница, цифры, дефис`);
  need(typeof v.name === 'string' && v.name.length > 0, 'нет name');
  need(['ready', 'draft'].includes(v.status), `status «${v.status}»: ready | draft`);
  need(v.meta && typeof v.meta.type === 'string', 'нет meta.type');
  need(typeof v.build === 'function', 'нет build(ctx)');
  // возможности
  need(v.caps && typeof v.caps === 'object', 'нет caps');
  for (const k of CAPS) need(typeof v.caps?.[k] === 'boolean', `caps.${k} должен быть true/false`);
  // слои
  const layerKeys = (v.layers || []).map((l) => l[0]);
  need(Array.isArray(v.layers) && v.layers.length > 0, 'нет layers');
  need(new Set(layerKeys).size === layerKeys.length, 'повторяются ключи слоёв');
  need(layerKeys.includes('lights'), "нет обязательного слоя 'lights'");
  need(layerKeys.length <= 30, 'слоёв больше 30 (битовая маска ссылки)');
  // виды
  const views = v.views || {};
  need(Object.keys(views).length > 0, 'нет views');
  need(!!views[v.defaultView], `defaultView «${v.defaultView}» нет среди views`);
  need(views[v.defaultView]?.type === 'persp', 'defaultView должен быть перспективным');
  for (const [k, w] of Object.entries(views)) {
    need(typeof w.name === 'string', `вид ${k}: нет name`);
    if (w.type === 'persp') need(Array.isArray(w.pos) && w.pos.length === 3 && Array.isArray(w.target) && w.target.length === 3, `вид ${k}: pos/target [x,y,d]`);
    else if (w.type === 'ortho') need(['top', 'side'].includes(w.dir) && Array.isArray(w.center) && w.height > 0, `вид ${k}: dir/center/height`);
    else err.push(`вид ${k}: type persp | ortho`);
  }
  // механика
  const rig = v.rigging;
  need(!!rig === !!v.caps?.rigging, 'caps.rigging не совпадает с наличием rigging');
  need(!v.caps?.counterweights || v.caps?.rigging, 'counterweights без rigging');
  if (rig) {
    const ids = rig.list.map((r) => r.id);
    need(new Set(ids).size === ids.length, 'повторяются id механики');
    for (const r of rig.list) {
      need(!!RIG_KINDS[r.kind], `механика ${r.id}: неизвестный вид «${r.kind}» (library/rigKinds.js)`);
      need(r.min <= r.rest && r.rest <= r.max, `механика ${r.id}: rest вне хода`);
    }
  }
  // приборы
  const fx = v.fixtures;
  need(fx && Array.isArray(fx.list), 'нет fixtures.list');
  if (fx && Array.isArray(fx.list)) {
    const nos = fx.list.map((f) => String(f.no));
    need(new Set(nos).size === nos.length, 'повторяются номера приборов');
    for (const f of fx.list) {
      need(!!fx.types?.[f.type], `прибор ${f.no}: тип «${f.type}» нет в справочнике`);
      need(!!fx.groups?.[f.group], `прибор ${f.no}: группа «${f.group}» не описана`);
      if (f.mount?.on) need(!!rig && rig.list.some((r) => r.id === f.mount.on) && fx.barDepth?.[f.mount.on] != null, `прибор ${f.no}: висит на «${f.mount.on}», которого нет в механике/barDepth`);
    }
    for (const s of fx.groupSets || []) for (const g of s.groups) need(!!fx.groups?.[g], `набор ${s.id}: группа «${g}» не описана`);
    need(!!fx.portable === !!v.caps?.portable, 'caps.portable не совпадает с наличием fixtures.portable');
    need(typeof fx.floor?.trace === 'function' && typeof fx.floor?.zone === 'function' && typeof fx.floor?.clip === 'function', 'fixtures.floor: trace/zone/clip');
    need(typeof fx.hangs === 'function' && typeof fx.poolK === 'function', 'fixtures.hangs / poolK');
  }
  // световые планы
  for (const plan of ['full', 'lite']) {
    need(Array.isArray(v.lightPlans?.[plan]), `нет lightPlans.${plan}`);
    for (const g of v.lightPlans?.[plan] || []) for (const m of g.members) need(!!fx?.groups?.[m], `lightPlans.${plan}.${g.id}: группа «${m}» не описана`);
  }
  need(v.exports && typeof v.exports === 'object', 'нет exports (может быть пустым объектом)');
  return err;
}
