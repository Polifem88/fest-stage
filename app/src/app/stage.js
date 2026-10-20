// Ядро приложения: сцена, камеры, виды, выбор и перетаскивание, рулетка, режим «чертёж»,
// скриншот, состояние в ссылке. Общее для десктопа и телефона; различия — в профиле.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DIM, rowFrontD } from '../config/dimensions.js';
import { RIGGING, RIG_BY_ID, DUTY_ROWS } from '../config/rigging.js';
import { GROUPS, GROUP_SETS, TYPES, BAR_DEPTH, powerOf } from '../config/fixtures.js';
import { createMaterials } from '../core/materials.js';
import { StaticBatch } from '../core/geom.js';
import { LabelManager } from '../core/labels.js';
import { buildArchitecture, buildSeats, buildEmitters, HALL_BACK_FLOOR_Y } from '../build/architecture.js';
import { RiggingSystem } from '../build/rigging.js';
import { FixtureSystem } from '../build/fixtures.js';
import { LightingSystem } from '../build/lighting.js';
import { buildDims, buildGrid, setDimsView } from './overlays.js';
import { encodeState, decodeState } from './state.js';

export const PROFILES = {
  desktop: { name: 'desktop', dpr: 2, antialias: true, shadows: true, ropes: true, ropeLabels: true, haze: true, beamSegments: 22, lightPlan: 'full', fixtureLabels: false, dragRequiresSelect: false },
  mobile: { name: 'mobile', dpr: 1.5, antialias: true, shadows: false, ropes: false, ropeLabels: false, haze: false, beamSegments: 12, lightPlan: 'lite', fixtureLabels: false, dragRequiresSelect: true },
};

const eyeY = (row) => -DIM.forestage.height + row * DIM.hall.rowPitch * Math.tan((DIM.hall.rakeDeg * Math.PI) / 180) + 1.15;

/** Готовые точки обзора. type: 'persp' | 'ortho'. Координаты: [x, y, d]. */
export const VIEWS = {
  overview: { name: 'Общий вид', type: 'persp', pos: [15.5, 12.5, -16], target: [0, 2.2, 2.5] },
  hall: { name: 'Из зала (8-й ряд)', type: 'persp', pos: [0, eyeY(7), rowFrontD(7) - 0.42], target: [0, 2.6, 4] },
  booth: { name: 'С пульта', type: 'persp', pos: [0.8, HALL_BACK_FLOOR_Y + 2.7, -DIM.hall.portalToBoothWall + 0.3], target: [0, 1.4, 3] },
  plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [0, 0, -4.2], height: 31 },
  section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, 3.4, -4.0], height: 14 },
  stageToHall: { name: 'Со сцены в зал', type: 'persp', pos: [0, 1.7, 4.5], target: [0, 1.6, -12] },
  upperGallery: { name: 'С верхней галереи', type: 'persp', pos: [-1.5, DIM.galleries.upperY + 1.6, 8.75], target: [0, 2.2, 1.0] },
  flyGallery: { name: 'Рабочая галерея (канаты)', type: 'persp', pos: [-3.6, 1.8, 0.4], target: [-8.3, 2.4, 5.2] },
};

export class Stage {
  constructor(container, profileName = 'desktop') {
    this.profile = PROFILES[profileName];
    this.container = container;
    this.listeners = {};
    this.selected = null;
    this.flags = { duty: true, house: false, haze: this.profile.haze, blueprint: false, labels: true, fixtureLabels: this.profile.fixtureLabels, grid: false, dims: false };
    this.layers = { hall: true, walls: true, galleries: true, rigging: true, lights: true };
    this.view = 'overview';
    this._dirty = true;
    this._init();
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) fn(...a); }
  invalidate() { this._dirty = true; }

  // ---------------------------------------------------------------------------
  _init() {
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

    // --- построение
    this.M = createMaterials();
    this.labels = new LabelManager();
    const batch = new StaticBatch();
    buildArchitecture(batch, this.M);
    this.rigging = new RiggingSystem(this.M, { ropes: P.ropes, ropeLabels: P.ropeLabels, labels: this.labels });
    this.rigging.buildStatic(batch);
    const layers = batch.build();
    this.layerGroups = {};
    for (const k of Object.keys(this.layers)) {
      const g = new THREE.Group();
      g.name = `L:${k}`;
      if (layers[k]) g.add(layers[k]);
      this.layerGroups[k] = g;
      scene.add(g);
    }
    const [seatsF, seatsK] = buildSeats(this.M);
    this.layerGroups.hall.add(seatsF, seatsK);
    const em = buildEmitters(this.M, DUTY_ROWS);
    this.emitters = em.groups;
    this.layerGroups.lights.add(em.groups.duty);
    this.layerGroups.hall.add(em.groups.house);
    this.layerGroups.rigging.add(this.rigging.root);

    this.fixtures = new FixtureSystem(this.M, this.rigging, { beams: this.flags.haze, beamSegments: P.beamSegments, labels: this.labels });
    this.layerGroups.lights.add(this.fixtures.root);
    this.lighting = new LightingSystem(this.fixtures, { plan: P.lightPlan, shadows: P.shadows, dutyPoints: em.dutyPoints, housePoints: em.housePoints, blueX: em.blueX });
    scene.add(this.lighting.root);

    this.dims = buildDims(this.labels);
    this.grid = buildGrid();
    scene.add(this.dims, this.grid);

    // механика двигает приборы и групповой свет
    this.rigging.onChange((id) => {
      if (BAR_DEPTH[id] !== undefined) this.fixtures.updateBar(id);
      this.lighting.placeGroupLights();
      this._shadowsDirty = true;
      this.invalidate();
      this.emit('rig', id, this.rigging.height(id));
    });

    // рулетка
    this.measure = { active: false, points: [], group: new THREE.Group() };
    this.measure.group.name = 'measure';
    scene.add(this.measure.group);

    this._applyFlags();
    this._applyLayers();
    this.resize();
    this.setView('overview', { instant: true });
    this._bindPointer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this._shadowsDirty = true;

    // начальное состояние из ссылки
    const m = location.hash.match(/s=([\w-]+)/);
    if (m) this.loadState(m[1]);

    this._loop();
  }

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
    const hh = (this._orthoH || 20) / 2;
    Object.assign(this.ortho, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    this.ortho.updateProjectionMatrix();
  }

  _loop() {
    const tick = (t) => {
      requestAnimationFrame(tick);
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
    if (this._shadowsDirty && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.needsUpdate = true; this._shadowsDirty = false; }
    this.labels.update(this.camera, this.renderer.domElement.clientHeight || 1);
    this.renderer.render(this.scene, this.camera);
    this._frames = (this._frames || 0) + 1;
  }

  // ---------------------------------------------------------------------------
  //  Виды
  // ---------------------------------------------------------------------------
  setView(key, { instant = false } = {}) {
    const v = VIEWS[key];
    if (!v) return;
    this.view = key;
    setDimsView(this.dims, v.type === 'ortho' ? v.dir : null);
    if (v.type === 'ortho') {
      this.camera = this.ortho;
      this.controls.object = this.ortho;
      this._orthoH = v.height;
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
      this._updateOrtho();
      this._anim = null;
    } else {
      const wasOrtho = this.camera === this.ortho;
      this.camera = this.persp;
      this.controls.object = this.persp;
      this.controls.enableRotate = true;
      this.persp.up.set(0, 1, 0);
      const pos = new THREE.Vector3(v.pos[0], v.pos[1], -v.pos[2]);
      const tgt = new THREE.Vector3(v.target[0], v.target[1], -v.target[2]);
      // в книжной ориентации телефона общий вид отодвигаем, чтобы влезла вся сцена
      if (key === 'overview' && this.persp.aspect < 1) pos.sub(tgt).multiplyScalar(1 + (1 - this.persp.aspect) * 0.9).add(tgt);
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
  setHeight(id, h) { this.rigging.setHeight(id, h); }

  /** Плавно навести камеру на прибор (поиск по номеру). */
  focusFixture(idx) {
    const f = this.fixtures.list[idx];
    const p = this.fixtures.mountPos(f);
    if (this.camera !== this.persp) this.setView('overview', { instant: true });
    const dir = this.persp.position.clone().sub(this.controls.target).normalize();
    const dist = Math.min(9, Math.max(4, this.persp.position.distanceTo(this.controls.target)));
    this._anim = { t0: performance.now(), dur: 800, p0: this.persp.position.clone(), p1: p.clone().addScaledVector(dir, dist), t0v: this.controls.target.clone(), t1v: p.clone() };
    this.invalidate();
  }
  allTo(which) {
    for (const r of RIGGING) this.rigging.setHeight(r.id, which === 'up' ? r.max : which === 'down' ? r.min : r.rest);
  }

  // ---------------------------------------------------------------------------
  //  Свет
  // ---------------------------------------------------------------------------
  _lightsChanged() {
    this.lighting.placeGroupLights();
    this.invalidate();
    this.emit('lights');
  }
  setFixture(idx, on) { this.fixtures.setOn(idx, on); this._lightsChanged(); }
  setGroupSet(setId, on) {
    const set = GROUP_SETS.find((s) => s.id === setId);
    if (!set) return;
    this.fixtures.setMany((f) => set.groups.includes(f.group), on);
    this._lightsChanged();
  }
  groupSetState(setId) {
    const set = GROUP_SETS.find((s) => s.id === setId);
    const fl = this.fixtures.list.filter((f) => set.groups.includes(f.group));
    const on = fl.filter((f) => f.on).length;
    return on === 0 ? 'off' : on === fl.length ? 'on' : 'mixed';
  }
  setAllStage(on) { this.fixtures.setMany(() => true, on); this._lightsChanged(); }
  stageState() {
    const fl = this.fixtures.list.filter((f) => !f.hidden);
    const on = fl.filter((f) => f.on).length;
    return on === 0 ? 'off' : on === fl.length ? 'on' : 'mixed';
  }
  /** Переносные ETC 50°: mode 'off' | 'floor' | 'stand', count 6 | 8. */
  setPortable(mode, count = this.fixtures.portable.count) {
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
    for (const m of this.emitters.duty.children) if (m.userData.emitter) m.material = f.duty ? this.M[m.userData.emitter === 'duty' ? matNameFor(m) : 'houseLamp'] : this._offMat();
    for (const m of this.emitters.house.children) m.material = f.house ? this.M.houseLamp : this._offMat();
    this.fixtures.setHaze(f.haze && !f.blueprint);
    this.fixtures.setPools(!f.blueprint);
    for (const s of this.labels.labels) {
      const k = s.userData.label.kind;
      if (k === 'rig' || k === 'rope') s.visible = f.labels;
      if (k === 'fixture') s.visible = f.fixtureLabels;
    }
    this.fixtures.setLabels(f.fixtureLabels); // учитывает скрытые переносные приборы
    this.grid.visible = f.grid;
    this.dims.visible = f.dims;
    this._applyBlueprint(f.blueprint);
  }
  _offMat() { return (this._off ||= new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 })); }

  setLayer(k, v) { this.layers[k] = v; this._applyLayers(); this.invalidate(); this.emit('layers', k, v); }
  _applyLayers() { for (const [k, g] of Object.entries(this.layerGroups)) g.visible = this.layers[k] !== false; this._shadowsDirty = true; }

  // ---------------------------------------------------------------------------
  //  Режим «чертёж»
  // ---------------------------------------------------------------------------
  _applyBlueprint(on) {
    if (!!this._bpOn === on) return;
    this._bpOn = on;
    const scene = this.scene;
    if (!this._bp) {
      const basic = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
      this._bp = {
        walls: basic(0xfbfbfa), hall: basic(0xf2f1ee), galleries: basic(0xe2e5ea), rigging: basic(0xe2e5ea), lights: basic(0x8a8f98),
        glass: basic(0xe9eef5), edges: new THREE.LineBasicMaterial({ color: 0x3b4048 }),
        batten: new THREE.MeshBasicMaterial({ color: 0x2f6fde }), light: new THREE.MeshBasicMaterial({ color: 0xe8590c }), track: new THREE.MeshBasicMaterial({ color: 0x8b3fd6 }), side: new THREE.MeshBasicMaterial({ color: 0x1a9e6a }),
        seatF: new THREE.MeshLambertMaterial({ color: 0xf3cfb0, emissive: 0x6b4a33 }), seatK: basic(0xbfbfbf), fixture: new THREE.MeshLambertMaterial({ color: 0x9aa0aa, emissive: 0x3a3e46 }),
      };
    }
    scene.background = on ? new THREE.Color(0xffffff) : this.bgDark;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      // кресла и корпуса приборов (InstancedMesh)
      const instKey = o.name === 'seatsFabric' ? 'seatF' : o.name === 'seatsFrame' ? 'seatK' : (o.name.startsWith('fixtures:') || o.name === 'fixtureBases' || o.name === 'fixtureClamps' || o.name.startsWith('portable')) ? 'fixture' : null;
      if (instKey) {
        if (on) { o.userData.matOrig ||= o.material; o.material = this._bp[instKey]; }
        else if (o.userData.matOrig) o.material = o.userData.matOrig;
        return;
      }
      if (o.userData.static) {
        if (on) {
          o.userData.matOrig ||= o.material;
          o.material = o.material.transparent && o.material.name === 'glass' ? this._bp.glass : this._bp[o.userData.layer] || this._bp.walls;
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
    // механика — цветом по виду
    for (const it of this.rigging.items.values()) {
      if (on) { it.visual.userData.matOrig ||= it.visual.material; it.visual.material = this._bp[it.cfg.kind] || this._bp.batten; }
      else if (it.visual.userData.matOrig) it.visual.material = it.visual.userData.matOrig;
    }
    this.lighting.root.visible = !on;
    this.renderer.toneMapping = on ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.rigging.cables.material.color.set(on ? 0x5b6470 : 0x8d939c);
    // светящиеся элементы приглушаем
    for (const m of [this.fixtures.lenses]) m.visible = !on;
    this._shadowsDirty = true;
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
        }
      }
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      if (d.drag) { this.controls.enabled = true; this._shadowsDirty = true; this.invalidate(); }
      if (d.moved) return;
      // клик/тап
      if (this.measure.active) { this._measureClick(toNdc(e)); return; }
      const hit = this.pick(toNdc(e));
      this.select(hit);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { if (down?.drag) this.controls.enabled = true; down = null; });
  }

  _hover(ndc) {
    const hit = this.pick(ndc);
    this.renderer.domElement.style.cursor = this.measure.active ? 'crosshair' : hit ? (hit.kind === 'rig' ? 'ns-resize' : 'pointer') : 'grab';
  }

  /** Луч из точки экрана → что под курсором: механика или прибор. */
  pick(ndc) {
    this.ray.setFromCamera(ndc, this.camera);
    const targets = [];
    if (this.layers.rigging) for (const it of this.rigging.items.values()) targets.push(it.hit);
    if (this.layers.lights) targets.push(...Object.values(this.fixtures.shapes));
    const hits = this.ray.intersectObjects(targets, false);
    if (!hits.length) return null;
    // приоритет: прибор, если он почти так же близко, как штанкет
    const fx = hits.find((h) => h.object.userData.pickInstanced);
    const rig = hits.find((h) => h.object.userData.pick);
    if (fx && (!rig || fx.distance < rig.distance + 0.25)) {
      return { kind: 'fixture', idx: fx.object.userData.pickInstanced.map[fx.instanceId], point: fx.point };
    }
    if (rig) return { kind: 'rig', id: rig.object.userData.pick.id, point: rig.point };
    return null;
  }

  select(sel) {
    this.selected = sel ? { kind: sel.kind, id: sel.id, idx: sel.idx } : null;
    this.rigging.highlight(sel && sel.kind === 'rig' ? sel.id : null);
    this.fixtures.select(sel && sel.kind === 'fixture' ? sel.idx : -1);
    this.invalidate();
    this.emit('select', this.selected);
  }

  /** Описание выбранного объекта для карточки. */
  describe(sel = this.selected) {
    if (!sel) return null;
    if (sel.kind === 'rig') {
      const r = RIG_BY_ID[sel.id];
      const kindName = { batten: 'Штанкет', light: 'Софит', track: 'Дорога занавеса', side: 'Боковой штанкет' }[r.kind];
      const ctrl = { left: 'левая стена (рабочая галерея)', 'right-front': 'правый передний угол за порталом', 'right-back-pad': 'под площадкой узла подъёма' }[r.control];
      const rows = [
        ['Тип', kindName],
        ['Высота', `${this.rigging.height(sel.id).toFixed(2).replace('.', ',')} м`],
        ['Ход', `${String(r.min).replace('.', ',')} – ${String(r.max).replace('.', ',')} м`],
        r.kind === 'side' ? ['Положение', `${r.x < 0 ? 'слева' : 'справа'}, от ${r.dFrom.toFixed(2)} до ${r.dTo.toFixed(2)} м за порталом`] : ['От портала', `${r.d.toFixed(2).replace('.', ',')} м ${r.d < 0 ? '(перед порталом)' : 'вглубь'}`],
        ['Подвесов', String(r.lines)],
        ['Управление', ctrl + (r.via === 'redirect' ? ', через обводные блоки' : '')],
      ];
      if (r.kind === 'light') {
        const n = this.fixtures.list.filter((f) => f.group === r.id).length;
        rows.push(['Приборов', String(n)]);
      }
      return { title: `${r.name}${r.fullName ? ' — ' + r.fullName : ''}`, kind: 'rig', id: r.id, rows, min: r.min, max: r.max, value: this.rigging.height(sel.id) };
    }
    const f = this.fixtures.list[sel.idx];
    const t = TYPES[f.type];
    const g = GROUPS[f.group];
    const pos = this.fixtures.mountPos(f);
    const rows = [
      ['Тип', t.name],
      ['Группа', g.name],
      ['Питание', powerOf(f)],
      ['Линии группы', g.ds === '—' ? 'на схеме не указаны' : `${g.ds} (D — диммерные, S — свитчерные)`],
      ['Висит на', f.mount.on ? `${RIG_BY_ID[f.mount.on].name} (высота ${this.rigging.height(f.mount.on).toFixed(2).replace('.', ',')} м)` : g.name],
      ['Высота прибора', `${pos.y.toFixed(2).replace('.', ',')} м`],
      ['Угол луча', `${t.beam}°`],
    ];
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
    for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose?.(); }
    this.labels.labels = this.labels.labels.filter((s) => s.parent);
    this.measure.points = [];
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
  //  Скриншот, состояние
  // ---------------------------------------------------------------------------
  screenshot(filename = 'fest-stage.png') {
    this.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    return url;
  }

  getState() {
    return {
      heights: this.rigging.snapshot(),
      fixturesOn: this.fixtures.list.map((f) => f.on),
      flags: { ...this.flags },
      layers: { ...this.layers },
      portable: { ...this.fixtures.portable },
      view: this.view,
    };
  }
  stateString() { return encodeState(this.getState()); }
  shareUrl() {
    const base = location.href.split('#')[0];
    return `${base}#s=${this.stateString()}`;
  }
  loadState(strOrObj) {
    const st = typeof strOrObj === 'string' ? decodeState(strOrObj) : strOrObj;
    if (!st) return false;
    for (const [id, h] of Object.entries(st.heights || {})) this.rigging.setHeight(id, h);
    if (st.fixturesOn) { this.fixtures.list.forEach((f, i) => { f.on = !!st.fixturesOn[i]; }); this.fixtures.updateAll(); this._lightsChanged(); }
    if (st.portable) this.setPortable(st.portable.mode, st.portable.count);
    if (st.flags) { Object.assign(this.flags, st.flags); this._applyFlags(); }
    if (st.layers) { Object.assign(this.layers, st.layers); this._applyLayers(); }
    if (st.view && VIEWS[st.view]) this.setView(st.view, { instant: true });
    this.emit('state');
    this.invalidate();
    return true;
  }
  downloadState() {
    const blob = new Blob([JSON.stringify(this.getState(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fest-stage-state.json';
    a.click();
  }

  /** Статистика отрисовки (для тестов производительности). */
  stats() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, frames: this._frames };
  }
}

function matNameFor(m) {
  if (m.material === undefined) return 'dutyBulb';
  const n = m.userData.matName || (m.userData.matName = m.material.name);
  return n || 'dutyBulb';
}
