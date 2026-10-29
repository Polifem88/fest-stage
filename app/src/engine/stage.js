// Ядро приложения: сцена, камеры, виды, выбор и перетаскивание, рулетка, режим «чертёж»,
// скриншот, состояние в ссылке. Общее для десктопа и телефона; различия — в профиле.
// Движок не знает о конкретной сцене: всё, что относится к площадке (геометрия, механика,
// развес, виды, экспорт), приходит из её модуля через реестр (venues/registry.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SPECS } from '../library/specs.js';
import { RIG_KINDS } from '../library/rigKinds.js';
import { createMaterials } from '../core/materials.js';
import { StaticBatch } from '../core/geom.js';
import { LabelManager } from '../core/labels.js';
import { setDimsView, setGridView } from '../core/overlays.js';
import { FixtureSystem, HAZE_DEFAULT } from '../systems/fixtures.js';
import { LightingSystem } from '../systems/lighting.js';
import { encodeState, decodeState, peekVenue, parseHash, normLayout } from './state.js';
import { SheetOverlay } from './blueprint.js';
import { disposeTree, sharedSet } from './dispose.js';
import { encodeDxfWindows1251 } from '../export/dxfWriter.js';
import { buildSceneGLB } from '../export/glbGeneric.js';
import { DEFAULT_VENUE, LEGACY_VENUE, venueEntry, isOpenable } from '../venues/registry.js';

export const PROFILES = {
  desktop: { name: 'desktop', dpr: 2, antialias: true, shadows: true, ropes: true, ropeLabels: true, haze: true, beamSegments: 22, lightPlan: 'full', fixtureLabels: false, dragRequiresSelect: false },
  mobile: { name: 'mobile', dpr: 1.5, antialias: true, shadows: false, ropes: false, ropeLabels: false, haze: false, beamSegments: 12, lightPlan: 'lite', fixtureLabels: false, dragRequiresSelect: true },
};

// Цвета слоёв в режиме «чертёж» по умолчанию (площадка может задать свой: layers[i][2].bp)
const BP_LAYER = { walls: 0xfbfbfa, hall: 0xf2f1ee, galleries: 0xe2e5ea, rigging: 0xe2e5ea, lights: 0x8a8f98 };

export class Stage {
  constructor(container, profileName = 'desktop') {
    this.profile = PROFILES[profileName];
    this.container = container;
    this.listeners = {};
    this.selected = null;
    // режимы отображения — общие для всех площадок (переносятся при смене сцены)
    this.flags = { duty: true, house: false, haze: this.profile.haze, hazeDensity: HAZE_DEFAULT, blueprint: false, labels: true, fixtureLabels: this.profile.fixtureLabels, grid: false, dims: false };
    this._flagDefaults = { ...this.flags };
    this.layers = {};
    this.view = null;
    this.venue = null;
    this.rigging = null;
    this._memory = new Map(); // состояние каждой площадки (механика, свет, слои, вид, камера)
    this._dirty = true;
    this._initEngine();
  }

  // ---------------------------------------------------------------------------
  //  События
  // ---------------------------------------------------------------------------
  on(ev, fn) {
    (this.listeners[ev] ||= []).push(fn);
    if (this._scope) this._scope.push([ev, fn]);
    return () => this.off(ev, fn);
  }
  off(ev, fn) {
    const a = this.listeners[ev];
    const i = a ? a.indexOf(fn) : -1;
    if (i >= 0) a.splice(i, 1);
  }
  emit(ev, ...a) { for (const fn of [...(this.listeners[ev] || [])]) fn(...a); }
  /**
   * Подписки, сделанные внутри fn, собираются в «область» и снимаются все разом вызовом
   * возвращённой функции. Интерфейс пересобирает панели площадки в такой области.
   */
  scope(fn) {
    const prev = this._scope;
    const list = (this._scope = []);
    const dispose = () => { for (const [ev, f] of list) this.off(ev, f); list.length = 0; };
    try { fn(); } catch (e) { dispose(); throw e; } finally { this._scope = prev; }
    return dispose;
  }
  invalidate() { this._dirty = true; }

  /** Виды текущей площадки. */
  get views() { return this.venue?.views || {}; }

  // ---------------------------------------------------------------------------
  //  Движок (один раз): рендерер, камеры, управление, материалы
  // ---------------------------------------------------------------------------
  _initEngine() {
    const P = this.profile;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: P.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, P.dpr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = P.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    this.container.appendChild(r.domElement);
    r.domElement.style.touchAction = 'none';

    const scene = (this.scene = new THREE.Scene());
    this.bgDark = new THREE.Color(0x0b0d11);
    scene.background = this.bgDark;

    this.persp = new THREE.PerspectiveCamera(P.name === 'mobile' ? 58 : 50, 1, 0.05, 200);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 200);
    this.camera = this.persp;
    this.controls = new OrbitControls(this.persp, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.maxDistance = 70;
    this.controls.addEventListener('change', () => this.invalidate());

    this.M = createMaterials();

    // рулетка
    this.measure = { active: false, points: [], group: new THREE.Group() };
    this.measure.group.name = 'measure';

    // лист чертежа: экспликация и масштаб (на телефоне экспликация — только в PNG)
    this.sheet = new SheetOverlay(this, { legendOnScreen: P.name !== 'mobile' });

    this._bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this._loop();
  }

  // ---------------------------------------------------------------------------
  //  Площадки
  // ---------------------------------------------------------------------------
  /**
   * Открыть площадку из реестра. Состояние текущей запоминается; у новой восстанавливается
   * то, с каким её оставили. Режимы отображения общие; дежурный и зальный свет — свои у площадки.
   * @returns {Promise<boolean>} false — площадку открыть не удалось (событие venueerror)
   */
  async loadVenue(id) {
    // переключения выполняются строго по очереди (двойной щелчок не строит две сцены разом)
    const run = () => this._loadVenue(id);
    this._venueQueue = (this._venueQueue || Promise.resolve()).then(run, run);
    return this._venueQueue;
  }

  async _loadVenue(id) {
    if (!isOpenable(id)) return false;
    if (this.venue?.id === id) return true;
    const entry = venueEntry(id);
    this.emit('venueloading', entry);
    let venue;
    try {
      venue = (await entry.load()).default;
      // дать браузеру нарисовать плашку «Строим…» до тяжёлой сборки геометрии
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    } catch (e) {
      console.error(e);
      this.emit('venueerror', entry, e);
      if (this.venue) this.emit('venue', this.venue); // прежняя площадка цела — вернуть ей панели
      return false;
    }
    const prevId = this.venue?.id;
    if (this.venue) {
      this._memory.set(this.venue.id, this._snapshot());
      this._teardownVenue();
    }
    const mem = this._memory.get(venue.id);
    // дежурный и зальный свет — свои у каждой площадки (GEMINI.md §2.2): из памяти или исходные
    const own = mem?.flags || this._flagDefaults;
    this.flags.duty = own.duty;
    this.flags.house = own.house;
    try {
      this._buildVenue(venue);
    } catch (e) {
      // сборка площадки упала (например, черновик с ошибкой в конфиге): разобрать недостроенное,
      // сообщить и вернуть прежнюю площадку (она восстановится из памяти)
      console.error(e);
      try { this._teardownVenue(); } catch { /* недостроенная сцена */ }
      this.emit('venueerror', entry, e);
      if (prevId && prevId !== id) await this._loadVenue(prevId);
      return false;
    }
    // сначала интерфейс пересобирает панели под новую площадку, потом приходит её состояние
    this.emit('venue', venue);
    if (mem) this._restore(mem); // loadState сам сообщает 'state'
    else this.emit('state');
    this.emit('select', null, null); // выбор прежней площадки снят
    this.invalidate();
    return true;
  }

  /**
   * Первый запуск: площадка и состояние из ссылки (#v=<id>&s=<данные>), иначе — по умолчанию.
   * @returns {{ venue: string, notice?: string }}
   */
  async boot(hash = location.hash) {
    const { v, s } = parseHash(hash);
    let id = v || (s ? peekVenue(s) : null) || DEFAULT_VENUE;
    let notice;
    if (!isOpenable(id)) {
      const e = venueEntry(id);
      notice = e ? `«${e.name}» пока в разработке — открыта ${venueEntry(DEFAULT_VENUE).name}` : `Сцена «${id}» не найдена — открыта ${venueEntry(DEFAULT_VENUE).name}`;
      id = DEFAULT_VENUE;
    }
    await this.loadVenue(id);
    if (s && peekVenue(s) === id) this.loadState(s);
    return { venue: id, notice };
  }

  _buildVenue(venue) {
    this.venue = venue;
    const P = this.profile;
    const scene = this.scene;
    this.controls.maxDistance = venue.camera?.maxDistance ?? 70;
    this.labels = new LabelManager();
    const batch = new StaticBatch();
    this.layers = Object.fromEntries(venue.layers.map(([k, , opt]) => [k, opt?.hidden ? false : (opt?.default ?? true)]));
    this.layerGroups = null;
    const commitBatch = () => {
      if (this.layerGroups) return;
      const built = batch.build();
      for (const k of Object.keys(built)) if (!(k in this.layers)) throw new Error(`площадка ${venue.id}: слой «${k}» не описан в layers`);
      // после сборки статики добавлять в batch бессмысленно — геометрия не попала бы в сцену
      batch.add = () => { throw new Error(`площадка ${venue.id}: batch.add после commitBatch()/add()`); };
      this.layerGroups = {};
      for (const k of Object.keys(this.layers)) {
        const g = new THREE.Group();
        g.name = `L:${k}`;
        if (built[k]) g.add(built[k]);
        this.layerGroups[k] = g;
        scene.add(g);
      }
    };
    const add = (layer, ...objs) => {
      commitBatch();
      if (!this.layerGroups[layer]) throw new Error(`площадка ${venue.id}: слой «${layer}» не описан в layers`);
      this.layerGroups[layer].add(...objs);
    };
    const built = venue.build({ batch, M: this.M, labels: this.labels, profile: P, commitBatch, add }) || {};
    commitBatch();
    // трансформируемый зал: группа слоя hall по планировке (до приборов — пол пятен знает планировку)
    this.layout = null;
    this._hallGroup = null;
    this._bpOn = false; // «чертёж» к новой площадке применит _applyFlags ниже
    if (venue.layouts) this._swapHall(normLayout(null, venue.layouts));
    this.rigging = built.rigging || null;
    this.emitters = built.emitters || null;
    // «включённый» материал светящихся мешей запоминаем сразу: первый _applyFlags может их погасить
    // (дежурка выключена) — тогда по текущему материалу его уже не узнать
    for (const g of Object.values(this.emitters || {})) for (const m of g.children) if (m.userData.emitter) m.userData.matOn = m.material;

    this.fixtures = new FixtureSystem(this.M, this.rigging, { beams: this.flags.haze, beamSegments: P.beamSegments, labels: this.labels }, venue.fixtures);
    this.layerGroups.lights.add(this.fixtures.root);
    this.lighting = new LightingSystem(this.fixtures, { plan: P.lightPlan, shadows: P.shadows, groups: venue.lightPlans?.[P.lightPlan] || [], ambient: built.ambient?.(P.lightPlan) });
    scene.add(this.lighting.root);

    const ov = built.overlays?.(this.labels) || {};
    this.dims = ov.dims || emptyGroup('dims');
    this.grid = ov.grid || emptyGroup('grid');
    scene.add(this.dims, this.grid);
    scene.add(this.measure.group); // рулетка — поверх, последней в сцене

    // механика двигает приборы и групповой свет
    this.rigging?.onChange((id) => {
      if (venue.fixtures.barDepth?.[id] !== undefined) this.fixtures.updateBar(id);
      this.lighting.placeGroupLights();
      this._shadowsDirty = true;
      this.invalidate();
      this.emit('rig', id, this.rigging.height(id));
    });

    this._bpOn = false;
    this._applyFlags();
    this._applyLayers();
    this.resize();
    this.setView(venue.defaultView, { instant: true });
    this._shadowsDirty = true;
  }

  /** Освободить всё, что построила площадка (WebGL-контекст, камеры и материалы движка остаются). */
  _teardownVenue() {
    this._anim = null;
    this.selected = null;
    this.clearMeasure();
    const keep = sharedSet(this.M, this._bp, { off: this._off });
    for (const g of Object.values(this.layerGroups || {})) disposeTree(g, keep);
    disposeTree(this.lighting?.root, keep);
    disposeTree(this.dims, keep);
    disposeTree(this.grid, keep);
    this.layerGroups = null;
    this._hallGroup = null;
    this.layout = null;
    this.rigging = null;
    this.fixtures = null;
    this.lighting = null;
    this.emitters = null;
    this.labels = null;
    this.renderer.renderLists.dispose();
    this.venue = null;
  }

  // ---------------------------------------------------------------------------
  //  Трансформируемый зал (caps.layouts)
  // ---------------------------------------------------------------------------
  /**
   * Сменить планировку зала: { id?, rows?, shift? } (shift — в шагах layouts.shiftStep).
   * Новая планировка без rows/shift — все ряды, без сдвига. Значения зажимаются в допустимые пределы.
   * @returns {boolean} false — у площадки нет трансформируемого зала
   */
  setLayout(partial = {}) {
    const cfg = this.venue?.layouts;
    if (!cfg) return false;
    const cur = this.layout;
    const p = partial.id && partial.id !== cur.id ? { rows: Infinity, shift: 0, ...partial } : { ...cur, ...partial };
    const st = normLayout(p, cfg);
    if (st.id === cur.id && st.rows === cur.rows && st.shift === cur.shift) return true;
    this._swapHall(st);
    this.fixtures.updateAll();
    this.lighting.placeGroupLights();
    this._shadowsDirty = true;
    this.invalidate();
    this.emit('layout', { ...st });
    return true;
  }

  /** Заменить группу зала: пол пятен → новая группа → освободить старую → «чертёж», если включён. */
  _swapHall(st) {
    const venue = this.venue;
    venue.fixtures.floor.setLayout?.(st);
    const g = venue.layouts.build(st, { M: this.M, profile: this.profile });
    g.name ||= 'hall:layout';
    const hall = this.layerGroups.hall;
    if (this._hallGroup) {
      hall.remove(this._hallGroup);
      disposeTree(this._hallGroup, sharedSet(this.M, this._bp, { off: this._off }));
    }
    hall.add(g);
    this._hallGroup = g;
    this.layout = st;
    if (this._bpOn) this._bpApply(g, true);
  }

  /** Состояние площадки для памяти при переключении: механика, свет, слои, вид и точное положение камеры. */
  _snapshot() {
    const ortho = this.camera === this.ortho;
    const cam = { ortho, pos: (ortho ? this.ortho : this.persp).position.toArray(), target: this.controls.target.toArray(), zoom: this.ortho.zoom };
    return { ...this.getState(), cam };
  }

  /** Восстановить состояние площадки; режимы отображения (flags) — только если явно попросили. */
  _restore(st, { flags = false } = {}) {
    const s = flags ? st : { ...st, flags: undefined };
    this.loadState(s);
    const c = st.cam;
    // камеру восстанавливаем, только если вид того же типа (иначе — просто готовый вид)
    if (c && c.ortho === (this.camera === this.ortho)) {
      (c.ortho ? this.ortho : this.persp).position.fromArray(c.pos);
      if (c.ortho) { this.ortho.zoom = c.zoom; this.ortho.updateProjectionMatrix(); }
      this.controls.target.fromArray(c.target);
      this.controls.update();
    }
    this.invalidate();
  }

  // ---------------------------------------------------------------------------
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this._updateOrtho();
    this.invalidate();
  }

  _updateOrtho() {
    const el = this.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight) || 1;
    // вид задан высотой; если у вида есть ширина (width), на узком экране вписываем и её целиком
    const hh = Math.max(this._orthoH || 20, this._orthoW ? this._orthoW / aspect : 0) / 2;
    Object.assign(this.ortho, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    this.ortho.updateProjectionMatrix();
  }

  _loop() {
    const tick = (t) => {
      requestAnimationFrame(tick);
      if (!this.venue) return;
      if (this._anim) this._stepAnim(t);
      const changed = this.controls.update();
      if (changed) this._dirty = true;
      if (!this._dirty) return;
      this._dirty = false;
      this.render();
    };
    requestAnimationFrame(tick);
  }

  render() {
    if (!this.venue) return;
    if (this._shadowsDirty && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.needsUpdate = true; this._shadowsDirty = false; }
    this.labels.update(this.camera, this.renderer.domElement.clientHeight || 1);
    this.renderer.render(this.scene, this.camera);
    this.sheet?.draw();
    this._frames = (this._frames || 0) + 1;
  }

  // ---------------------------------------------------------------------------
  //  Виды
  // ---------------------------------------------------------------------------
  setView(key, { instant = false } = {}) {
    const v = this.views[key];
    if (!v) return;
    this.view = key;
    this.viewDir = v.type === 'ortho' ? v.dir : null;
    setDimsView(this.dims, this.viewDir);
    setGridView(this.grid, this.viewDir);
    this.rigging?.setLabelLayout(this.viewDir === 'top' ? 'plan' : 'normal');
    this._updateRopeLabels();
    if (v.type === 'ortho') {
      this.camera = this.ortho;
      this.controls.object = this.ortho;
      this._orthoH = v.height;
      this._orthoW = v.width || 0;
      this.ortho.zoom = 1;
      const [cx, cy, cd] = v.center;
      const c = new THREE.Vector3(cx, cy, -cd);
      if (v.dir === 'top') {
        this.ortho.position.set(cx, 60, -cd);
        this.ortho.up.set(0, 0, -1);
      } else {
        this.ortho.position.set(60, cy, -cd);
        this.ortho.up.set(0, 1, 0);
      }
      this.ortho.lookAt(c);
      this.controls.target.copy(c);
      this.controls.enableRotate = false;
      // на плане и разрезе вращать нечего: левая кнопка и один палец — сдвиг
      this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      this.controls.touches.ONE = THREE.TOUCH.PAN;
      this._updateOrtho();
      this._anim = null;
    } else {
      const wasOrtho = this.camera === this.ortho;
      this.camera = this.persp;
      this.controls.object = this.persp;
      this.controls.enableRotate = true;
      this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      this.controls.touches.ONE = THREE.TOUCH.ROTATE;
      this.persp.up.set(0, 1, 0);
      const pos = new THREE.Vector3(v.pos[0], v.pos[1], -v.pos[2]);
      const tgt = new THREE.Vector3(v.target[0], v.target[1], -v.target[2]);
      // в книжной ориентации телефона вид отодвигаем, чтобы влезла вся сцена
      if (v.portraitPullback && this.persp.aspect < 1) pos.sub(tgt).multiplyScalar(1 + (1 - this.persp.aspect) * (typeof v.portraitPullback === 'number' ? v.portraitPullback : 0.9)).add(tgt);
      if (instant || wasOrtho) {
        this.persp.position.copy(pos);
        this.controls.target.copy(tgt);
        this._anim = null;
      } else {
        this._anim = { t0: performance.now(), dur: 900, p0: this.persp.position.clone(), p1: pos, t0v: this.controls.target.clone(), t1v: tgt };
      }
    }
    this.controls.update();
    this.invalidate();
    this.emit('view', key);
  }

  _stepAnim(now) {
    const a = this._anim;
    const k = Math.min(1, (now - a.t0) / a.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.persp.position.lerpVectors(a.p0, a.p1, e);
    this.controls.target.lerpVectors(a.t0v, a.t1v, e);
    this._dirty = true;
    if (k >= 1) this._anim = null;
  }

  // ---------------------------------------------------------------------------
  //  Механика
  // ---------------------------------------------------------------------------
  setHeight(id, h) { this.rigging?.setHeight(id, h); }

  /** Плавно навести камеру на прибор (поиск по номеру). */
  focusFixture(idx) {
    const f = this.fixtures.list[idx];
    const p = this.fixtures.mountPos(f);
    if (this.camera !== this.persp) this.setView(this.venue.defaultView, { instant: true });
    const dir = this.persp.position.clone().sub(this.controls.target).normalize();
    const dist = Math.min(9, Math.max(4, this.persp.position.distanceTo(this.controls.target)));
    this._anim = { t0: performance.now(), dur: 800, p0: this.persp.position.clone(), p1: p.clone().addScaledVector(dir, dist), t0v: this.controls.target.clone(), t1v: p.clone() };
    this.invalidate();
  }
  allTo(which) {
    if (!this.rigging) return;
    for (const r of this.venue.rigging.list) this.rigging.setHeight(r.id, which === 'up' ? r.max : which === 'down' ? r.min : r.rest);
  }

  // ---------------------------------------------------------------------------
  //  Свет
  // ---------------------------------------------------------------------------
  get groupSets() { return this.venue?.fixtures.groupSets || []; }
  _lightsChanged() {
    this.lighting.placeGroupLights();
    this.invalidate();
    this.emit('lights');
  }
  setFixture(idx, on) { this.fixtures.setOn(idx, on); this._lightsChanged(); }
  setGroupSet(setId, on) {
    const set = this.groupSets.find((s) => s.id === setId);
    if (!set) return;
    this.fixtures.setMany((f) => set.groups.includes(f.group), on);
    this._lightsChanged();
  }
  groupSetState(setId) {
    const set = this.groupSets.find((s) => s.id === setId);
    const fl = this.fixtures.list.filter((f) => set.groups.includes(f.group));
    const on = fl.filter((f) => f.on).length;
    return on === 0 ? 'off' : on === fl.length ? 'on' : 'mixed';
  }
  setAllStage(on) { this.fixtures.setMany(() => true, on); this._lightsChanged(); }
  /** «Соло»: включена только эта группа сценического света, остальной сценический свет гаснет. */
  soloGroupSet(setId) {
    const set = this.groupSets.find((s) => s.id === setId);
    if (!set) return;
    this.fixtures.setMany(() => true, false);
    this.fixtures.setMany((f) => set.groups.includes(f.group), true);
    this._lightsChanged();
  }
  stageState() {
    const fl = this.fixtures.list.filter((f) => !f.hidden);
    const on = fl.filter((f) => f.on).length;
    return on === 0 ? 'off' : on === fl.length ? 'on' : 'mixed';
  }
  /** Переносные приборы (если есть на площадке): mode 'off' | 'floor' | 'stand', count — из venue.fixtures.portable.counts. */
  setPortable(mode, count = this.fixtures.portable.count) {
    if (!this.fixtures.portableCfg) return;
    this.fixtures.setPortable(mode, count);
    this._shadowsDirty = true;
    this._lightsChanged();
    this.emit('portable', this.fixtures.portable);
  }

  setFlag(k, v) { this.flags[k] = v; this._applyFlags(); this.invalidate(); this.emit('flags', k, v); }
  _applyFlags() {
    const f = this.flags;
    this.lighting.setDuty(f.duty);
    this.lighting.setHouse(f.house);
    if (this.emitters) {
      for (const m of this.emitters.duty.children) if (m.userData.emitter) m.material = f.duty ? m.userData.matOn : this._offMat();
      for (const m of this.emitters.house.children) if (m.userData.emitter) m.material = f.house ? m.userData.matOn : this._offMat();
    }
    this.fixtures.setHaze(f.haze && !f.blueprint);
    this.fixtures.setHazeDensity(f.hazeDensity ?? HAZE_DEFAULT);
    this.fixtures.setPools(!f.blueprint);
    for (const s of this.labels.labels) {
      const k = s.userData.label.kind;
      if (k === 'rig') s.visible = f.labels;
      if (k === 'fixture') s.visible = f.fixtureLabels;
    }
    this._updateRopeLabels();
    this.fixtures.setLabels(f.fixtureLabels); // учитывает скрытые переносные приборы
    this.fixtures.setColorByType(f.blueprint); // в чертеже корпуса окрашены по типу (см. экспликацию)
    this.grid.visible = f.grid;
    this.dims.visible = f.dims;
    this._applyBlueprint(f.blueprint);
  }
  _offMat() { return (this._off ||= new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 })); }

  /**
   * Подписи канатов (если у площадки они есть) читаются только вблизи.
   * Показываем все — в виде с allRopeLabels, в остальных — только у выбранного штанкета.
   */
  _updateRopeLabels() {
    if (!this.labels) return;
    const all = !!this.views[this.view]?.allRopeLabels;
    const selId = this.selected?.kind === 'rig' ? this.selected.id : null;
    for (const s of this.labels.labels) {
      if (s.userData.label.kind !== 'rope') continue;
      s.visible = !!this.flags?.labels && (all || s.userData.rigId === selId);
    }
  }

  setLayer(k, v) { if (!(k in this.layers)) return; this.layers[k] = v; this._applyLayers(); this.invalidate(); this.emit('layers', k, v); }
  _applyLayers() { for (const [k, g] of Object.entries(this.layerGroups)) g.visible = this.layers[k] !== false; this._shadowsDirty = true; }

  // ---------------------------------------------------------------------------
  //  Режим «чертёж»
  // ---------------------------------------------------------------------------
  _bpLayer(k) {
    const own = this.venue.layers.find((l) => l[0] === k)?.[2]?.bp;
    const key = own != null ? `layer:${this.venue.id}:${k}` : BP_LAYER[k] != null ? `layer:${k}` : 'layer:walls';
    return (this._bp[key] ||= new THREE.MeshBasicMaterial({ color: own, side: THREE.FrontSide }));
  }
  _applyBlueprint(on) {
    if (!!this._bpOn === on) return;
    this._bpOn = on;
    const scene = this.scene;
    if (!this._bp) {
      // порядок создания материалов — как до модульной переделки (одинаковый порядок отрисовки)
      const basic = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
      this._bp = {};
      for (const [k, c] of Object.entries(BP_LAYER)) this._bp[`layer:${k}`] = basic(c);
      this._bp.glass = basic(0xe9eef5);
      this._bp.edges = new THREE.LineBasicMaterial({ color: 0x3b4048 });
      // механика — цветом по виду (словарь театра)
      for (const [k, d] of Object.entries(RIG_KINDS)) this._bp[`rig:${k}`] = new THREE.MeshBasicMaterial({ color: d.color });
      // кресла — светлые (на печати не «грязное пятно»), корпуса приборов — цвет по типу (instanceColor)
      this._bp.seatF = new THREE.MeshLambertMaterial({ color: 0xf7f4ef, emissive: 0x8a8580 });
      this._bp.seatK = basic(0x9a9a9a);
      this._bp.fixture = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }
    scene.background = on ? new THREE.Color(0xffffff) : this.bgDark;
    this._bpApply(scene, on);
    if (this.rigging) {
      for (const it of this.rigging.items.values()) {
        if (on) { it.visual.userData.matOrig ||= it.visual.material; it.visual.material = this._bp[`rig:${it.cfg.kind}`] || this._bp['rig:batten']; }
        else if (it.visual.userData.matOrig) it.visual.material = it.visual.userData.matOrig;
      }
      this.rigging.cables?.material.color.set(on ? 0x5b6470 : 0x8d939c);
    }
    this.lighting.root.visible = !on;
    this.renderer.toneMapping = on ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    // светящиеся элементы приглушаем
    for (const m of [this.fixtures.lenses]) m.visible = !on;
    this._shadowsDirty = true;
  }

  /**
   * Материалы «чертежа» для мешей поддерева root (вся сцена или новая группа зала после смены планировки).
   * Статика (userData.static, userData.layer) — цвет слоя и рёбра; InstancedMesh кресел и приборов — по имени
   * или userData.bpRole. Исходный материал хранится в userData.matOrig.
   */
  _bpApply(root, on) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      // кресла и корпуса приборов (InstancedMesh); площадка может пометить меш явно: userData.bpRole
      const instKey = o.userData.bpRole || (o.name === 'seatsFabric' ? 'seatF' : o.name === 'seatsFrame' ? 'seatK' : (o.name.startsWith('fixtures:') || o.name === 'fixtureBases' || o.name === 'fixtureClamps' || o.name.startsWith('portable')) ? 'fixture' : null);
      if (instKey && this._bp[instKey]) {
        if (on) { o.userData.matOrig ||= o.material; o.material = this._bp[instKey]; }
        else if (o.userData.matOrig) o.material = o.userData.matOrig;
        return;
      }
      if (o.userData.static) {
        if (on) {
          o.userData.matOrig ||= o.material;
          o.material = o.material.transparent && o.material.name === 'glass' ? this._bp.glass : this._bpLayer(o.userData.layer);
          if (!o.userData.edges) {
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), this._bp.edges);
            e.matrixAutoUpdate = false;
            e.raycast = () => {};
            o.add(e);
            o.userData.edges = e;
          }
          o.userData.edges.visible = true;
        } else if (o.userData.matOrig) {
          o.material = o.userData.matOrig;
          if (o.userData.edges) o.userData.edges.visible = false;
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  //  Выбор, перетаскивание, рулетка
  // ---------------------------------------------------------------------------
  _bindPointer() {
    const el = this.renderer.domElement;
    this.ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const toNdc = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return ndc;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.venue) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (down) { // второй палец — отменяем перетаскивание, пусть работает масштаб
        if (down.drag) { this.controls.enabled = true; }
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: null, moved: false };
      if (this.measure.active) return;
      const hit = this.pick(toNdc(e));
      if (hit && hit.kind === 'rig') {
        const canDrag = !this.profile.dragRequiresSelect || (this.selected && this.selected.kind === 'rig' && this.selected.id === hit.id);
        if (canDrag) {
          this.controls.enabled = false;
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          camDir.y = 0;
          if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, -1);
          camDir.normalize();
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, hit.point);
          down.drag = { id: hit.id, plane, startY: hit.point.y, startH: this.rigging.height(hit.id) };
          el.setPointerCapture(e.pointerId);
        }
      }
    }, { capture: true });
    el.addEventListener('pointermove', (e) => {
      if (!this.venue) return;
      if (!down || e.pointerId !== down.id) {
        if (!down && e.pointerType === 'mouse') this._hover(toNdc(e));
        return;
      }
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (down.drag) {
        this.ray.setFromCamera(toNdc(e), this.camera);
        const p = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(down.drag.plane, p)) {
          this.rigging.setHeight(down.drag.id, down.drag.startH + (p.y - down.drag.startY));
          if (!this.selected || this.selected.id !== down.drag.id) this.select({ kind: 'rig', id: down.drag.id });
          this.emit('drag', { id: down.drag.id, h: this.rigging.height(down.drag.id), x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' });
        }
      }
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      if (!this.venue) return;
      if (d.drag) { this.controls.enabled = true; this._shadowsDirty = true; this.invalidate(); this.emit('dragend'); }
      if (d.moved) return;
      // клик/тап
      if (this.measure.active) { this._measureClick(toNdc(e)); return; }
      const hit = this.pick(toNdc(e));
      this.select(hit);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { if (down?.drag) { this.controls.enabled = true; this.emit('dragend'); } down = null; });
    el.addEventListener('pointerleave', () => { if (this.rigging?.hover(null)) this.invalidate(); });
  }

  _hover(ndc) {
    const hit = this.pick(ndc);
    this.renderer.domElement.style.cursor = this.measure.active ? 'crosshair' : hit ? (hit.kind === 'rig' ? 'ns-resize' : 'pointer') : 'grab';
    // подсветка штанкета под курсором — видно, что именно схватится
    if (this.rigging?.hover(!this.measure.active && hit?.kind === 'rig' ? hit.id : null)) this.invalidate();
  }

  /**
   * Луч из точки экрана → что под курсором: механика или прибор.
   * Штанкеты висят через 30 см, и луч часто проходит через зоны захвата нескольких труб —
   * из них выбираем ту, чья ось ближе всего к курсору НА ЭКРАНЕ. Прибор в приоритете,
   * если луч попал в его корпус.
   */
  pick(ndc) {
    this.ray.setFromCamera(ndc, this.camera);
    const targets = [];
    if (this.rigging && this.layers.rigging !== false) for (const it of this.rigging.items.values()) targets.push(it.hit);
    if (this.layers.lights) targets.push(...Object.values(this.fixtures.shapes));
    const hits = this.ray.intersectObjects(targets, false);
    if (!hits.length) return null;
    const fx = hits.find((h) => h.object.userData.pickInstanced);
    const rigHits = hits.filter((h) => h.object.userData.pick);
    let rig = null, scored = [], best = Infinity;
    if (rigHits.length) {
      const el = this.renderer.domElement;
      const W = el.clientWidth, H = el.clientHeight;
      const cx = ((ndc.x + 1) / 2) * W, cy = ((1 - ndc.y) / 2) * H;
      const toPx = (v) => { const p = v.clone().project(this.camera); return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H, p.z]; };
      for (const h of rigHits) {
        const [a, b] = this.rigging.axis(h.object.userData.pick.id);
        const A = toPx(a), B = toPx(b);
        if (A[2] > 1 || B[2] > 1) { scored.push([h, 1e6 + h.distance]); continue; } // ось за камерой
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const t = Math.max(0, Math.min(1, ((cx - A[0]) * dx + (cy - A[1]) * dy) / (dx * dx + dy * dy || 1)));
        const dist = Math.hypot(cx - (A[0] + t * dx), cy - (A[1] + t * dy));
        scored.push([h, dist]);
        best = Math.min(best, dist);
      }
      // трубы, совпавшие на экране (±1 px), — берём ближнюю к камере (rigHits отсортированы по дальности)
      rig = (scored.find(([, d]) => d <= best + 1) || scored[0])[0];
    }
    if (fx) {
      // прибор выигрывает, если курсор не лежит на чужой трубе перед ним
      // (зона захвата своего софита охватывает висящие на нём приборы — её не считаем;
      //  невидимые зоны захвата близких к камере штанкетов тоже не мешают, если трубы под курсором нет)
      const idx = fx.object.userData.pickInstanced.map[fx.instanceId];
      const bar = this.fixtures.list[idx].mount.on;
      const blocked = scored.some(([h, d]) => h.object.userData.pick.id !== bar && h.distance < fx.distance - 0.05 && d <= 3);
      if (!blocked) return { kind: 'fixture', idx, point: fx.point };
    }
    if (rig) return { kind: 'rig', id: rig.object.userData.pick.id, point: rig.point };
    return null;
  }

  select(sel) {
    this.selected = sel ? { kind: sel.kind, id: sel.id, idx: sel.idx } : null;
    this.rigging?.highlight(sel && sel.kind === 'rig' ? sel.id : null);
    this.fixtures.select(sel && sel.kind === 'fixture' ? sel.idx : -1);
    this._updateRopeLabels();
    this.invalidate();
    this.emit('select', this.selected, sel); // 2-й аргумент — исходный запрос (например, keepSheet)
  }

  /** Описание выбранного объекта для карточки. */
  describe(sel = this.selected) {
    if (!sel || !this.venue) return null;
    const V = this.venue;
    const fmt = (v) => v.toFixed(2).replace('.', ',');
    if (sel.kind === 'rig') {
      const r = this.rigging.get(sel.id).cfg;
      const rows = [
        ['Тип', RIG_KINDS[r.kind]?.name || r.kind],
        ['Высота', `${fmt(this.rigging.height(sel.id))} м`],
        ['Ход', `${String(r.min).replace('.', ',')} – ${String(r.max).replace('.', ',')} м`],
        ...(V.rigging.describe?.(r, this) || []),
      ];
      const n = this.fixtures.list.filter((f) => f.mount.on === r.id).length;
      if (n) rows.push(['Приборов', String(n)]);
      return { title: `${r.name}${r.fullName ? ' — ' + r.fullName : ''}`, kind: 'rig', id: r.id, rows, min: r.min, max: r.max, value: this.rigging.height(sel.id) };
    }
    const FX = V.fixtures;
    const f = this.fixtures.list[sel.idx];
    const t = FX.types[f.type];
    const g = FX.groups[f.group];
    const pos = this.fixtures.mountPos(f);
    const rows = [['Тип', t.name], ['Группа', g.name]];
    if (FX.powerOf) rows.push(['Питание', FX.powerOf(f)]);
    if (FX.lineText) rows.push(['Линии группы', FX.lineText(g)]);
    rows.push(
      ['Висит на', f.mount.on ? `${this.rigging.get(f.mount.on).cfg.name} (высота ${fmt(this.rigging.height(f.mount.on))} м)` : g.name],
      ['Высота прибора', `${fmt(pos.y)} м`],
      ['Угол луча', `${t.beam}° (в модели)`],
    );
    // дальность и пятно — по текущему (условному) наведению
    const w = f.world;
    if (w && w.onFloor) {
      const L = w.throw, dia = 2 * L * Math.tan((t.beam * Math.PI) / 360);
      rows.push(['До пола по лучу', `${L.toFixed(1).replace('.', ',')} м`]);
      rows.push(['Пятно', `≈ ${dia.toFixed(1).replace('.', ',')} м в поперечнике луча`]);
    } else if (w) rows.push(['Луч', 'упирается в стену, на пол не попадает']);
    if (FX.aimNote) rows.push(['Наведение', FX.aimNote]);
    // паспорт производителя (может быть неполным)
    const s = FX.specs?.[f.type] || SPECS[f.type]; // собственные паспорта площадки или справочник театра
    if (s) {
      for (const [k, name] of [['source', 'Источник'], ['power', 'Мощность'], ['zoom', 'Угол / зум (паспорт)'], ['color', 'Цвет'], ['dmx', 'DMX'], ['weight', 'Вес'], ['ip', 'Защита']]) {
        if (s[k] && s[k] !== '—') rows.push([name, s[k]]);
      }
      rows.push(['Паспорт', `по открытым данным производителя (опознание модели: ${s.confidence}) — уточняйте в цехе`]);
    }
    if (t.note) rows.push([t.unknown ? 'Внимание' : 'Примечание', t.note]);
    if (f.note) rows.push(['Примечание', f.note]);
    return { title: `Прибор № ${f.no}`, kind: 'fixture', idx: f.idx, on: f.on, rows };
  }

  // --- рулетка
  setMeasure(on) {
    this.measure.active = on;
    if (!on) this.clearMeasure();
    this.emit('measure', on);
  }
  clearMeasure() {
    const g = this.measure.group;
    for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose?.(); c.material?.map?.dispose?.(); c.material?.dispose?.(); }
    if (this.labels) this.labels.labels = this.labels.labels.filter((s) => s.parent);
    this.measure.points.length = 0; // очищаем на месте: _measureClick держит ссылку на этот массив
    this.invalidate();
  }
  _measureClick(ndc) {
    this.ray.setFromCamera(ndc, this.camera);
    const objs = [];
    this.scene.traverseVisible((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.userData.noMeasure && o.material && o.material.visible !== false && o.material.blending !== THREE.AdditiveBlending) objs.push(o); });
    const hit = this.ray.intersectObjects(objs, false).find((h) => h.object.name !== 'beams' && h.object.name !== 'pools');
    if (!hit) return;
    const pts = this.measure.points;
    if (pts.length === 2) this.clearMeasure();
    pts.push(hit.point.clone());
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x26e07f, depthTest: false }));
    dot.renderOrder = 11;
    dot.position.copy(hit.point);
    this.measure.group.add(dot);
    if (pts.length === 2) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x26e07f, depthTest: false }));
      line.renderOrder = 11;
      this.measure.group.add(line);
      const dist = pts[0].distanceTo(pts[1]);
      const s = this.labels.make(`${dist.toFixed(2).replace('.', ',')} м`, { px: 16, color: '#06210f', bg: 'rgba(38,224,127,0.95)', kind: 'measure', depthTest: false });
      s.position.copy(pts[0]).add(pts[1]).multiplyScalar(0.5);
      this.measure.group.add(s);
      this.emit('measured', dist);
    }
    this.invalidate();
  }

  // ---------------------------------------------------------------------------
  //  Скриншот, состояние, экспорт
  // ---------------------------------------------------------------------------
  /** Префикс имён сохраняемых файлов: fest-big, fest-chamber… */
  get filePrefix() { return `fest-${this.venue?.id || 'stage'}`; }

  screenshot(filename = `${this.filePrefix}.png`) {
    this.render();
    const src = this.renderer.domElement;
    let url;
    if (this.flags.blueprint) {
      // чертёж: поверх 3D — экспликация и масштаб (на телефоне экспликация только здесь)
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      const k = src.width / (src.clientWidth || src.width);
      g.setTransform(k, 0, 0, k, 0, 0);
      this.sheet.paint(g, src.clientWidth || src.width, src.clientHeight || src.height, { legend: true });
      url = c.toDataURL('image/png');
    } else url = src.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    return url;
  }

  getState() {
    return {
      venue: this.venue.id,
      heights: this.rigging ? this.rigging.snapshot() : {},
      fixturesOn: this.fixtures.list.map((f) => f.on),
      flags: { ...this.flags },
      layers: { ...this.layers },
      portable: { ...this.fixtures.portable },
      view: this.view,
      layout: this.layout ? { ...this.layout } : null,
    };
  }
  stateString() { return encodeState(this.getState(), this.venue); }
  shareUrl() {
    const base = location.href.split('#')[0];
    return `${base}#v=${this.venue.id}&s=${this.stateString()}`;
  }
  /**
   * Применить состояние ТЕКУЩЕЙ площадки (строка из ссылки или объект). Состояние другой
   * площадки не применяется — для него есть openState() (переключает сцену).
   */
  loadState(strOrObj) {
    const st = typeof strOrObj === 'string' ? decodeState(strOrObj, this.venue) : strOrObj;
    if (!st) return false;
    if (st.venue && st.venue !== this.venue.id) return false;
    if (this.rigging) for (const [id, h] of Object.entries(st.heights || {})) this.rigging.setHeight(id, h);
    // планировка зала — до приборов: пятна пересчитываются по новому полу
    if (st.layout && this.layout) this.setLayout(st.layout);
    if (st.fixturesOn) { this.fixtures.list.forEach((f, i) => { f.on = !!st.fixturesOn[i]; }); this.fixtures.updateAll(); this._lightsChanged(); }
    if (st.portable && this.fixtures.portableCfg) this.setPortable(st.portable.mode, st.portable.count);
    if (st.flags) { Object.assign(this.flags, st.flags); this._applyFlags(); }
    if (st.layers) { for (const k of Object.keys(this.layers)) if (k in st.layers) this.layers[k] = st.layers[k]; this._applyLayers(); }
    if (st.view && this.views[st.view]) this.setView(st.view, { instant: true });
    this.emit('state');
    this.invalidate();
    return true;
  }
  /** Применить состояние любой площадки (файл .json или строка ссылки): при необходимости сменить сцену. */
  async openState(strOrObj) {
    let id;
    if (typeof strOrObj === 'string') id = peekVenue(strOrObj);
    // файл до каталога сцен (без venue) — Большая сцена; объект без состояния — не наш файл
    else if (strOrObj && (strOrObj.heights || strOrObj.fixturesOn)) id = strOrObj.venue || LEGACY_VENUE;
    if (!id || !isOpenable(id)) return false;
    if (id !== this.venue.id) await this.loadVenue(id);
    return this.loadState(strOrObj);
  }
  downloadState() {
    const blob = new Blob([JSON.stringify(this.getState(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.filePrefix}-state.json`;
    a.click();
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** Какие форматы экспорта есть у площадки: planDXF, sectionDXF, dxf3d — свои; glb — свой или общий. */
  exportFormats() {
    const e = this.venue?.exports || {};
    return { planDXF: !!e.planDXF, sectionDXF: !!e.sectionDXF, dxf3d: !!e.dxf3d, glb: true };
  }

  exportPlanDXF(filename = `${this.filePrefix}-plan-2d.dxf`) {
    if (!this.venue.exports.planDXF) return null;
    const dxf = this.venue.exports.planDXF(this);
    this._downloadBlob(new Blob([encodeDxfWindows1251(dxf)], { type: 'application/dxf' }), filename);
    return dxf;
  }

  exportSectionDXF(filename = `${this.filePrefix}-section-2d.dxf`) {
    if (!this.venue.exports.sectionDXF) return null;
    const dxf = this.venue.exports.sectionDXF(this);
    this._downloadBlob(new Blob([encodeDxfWindows1251(dxf)], { type: 'application/dxf' }), filename);
    return dxf;
  }

  export3DDXF(filename = `${this.filePrefix}-3d.dxf`) {
    if (!this.venue.exports.dxf3d) return null;
    const dxf = this.venue.exports.dxf3d(this);
    this._downloadBlob(new Blob([encodeDxfWindows1251(dxf)], { type: 'application/dxf' }), filename);
    return dxf;
  }

  async exportGLB(filename = `${this.filePrefix}-3d.glb`) {
    const buf = await (this.venue.exports.glb ? this.venue.exports.glb(this) : buildSceneGLB(this));
    this._downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), filename);
    return buf;
  }

  /** Статистика отрисовки (для тестов производительности). */
  stats() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, frames: this._frames };
  }
}

function emptyGroup(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

