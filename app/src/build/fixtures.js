// Приборы: упрощённые модели по типам (InstancedMesh), светящиеся линзы,
// лучи («дымка») и световые пятна на полу. Включение/выключение по одному и группами.
import * as THREE from 'three';
import { DIM, BOX_HALF, HALL_HALF, hallFloorY } from '../config/dimensions.js';
import { FIXTURES, TYPES, BAR_DEPTH } from '../config/fixtures.js';
import { radialTexRGB } from '../core/materials.js';

const POOL_GAIN = 0.55; // яркость одного пятна на полу (подбирается по скриншотам)

const WARM = new THREE.Color(1.0, 0.8, 0.55);
const LENS_OFF = new THREE.Color(0.05, 0.05, 0.055);
const BODY = new THREE.Color(0x1a1b1e);
const BODY_SEL = new THREE.Color(0xff8a1f);
const BODY_UNKNOWN = new THREE.Color(0x3a2a40);

// Геометрия «головы» для каждого вида (линза смотрит в +Z, центр в начале координат)
function headGeometry(shape) {
  const parts = [];
  const add = (g) => parts.push(g.index ? g.toNonIndexed() : g);
  switch (shape) {
    case 'spot':
      add(new THREE.BoxGeometry(0.26, 0.26, 0.42));
      add(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 14).rotateX(Math.PI / 2).translate(0, 0, 0.25));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(-0.17, 0.08, 0)); // вилка
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(0.17, 0.08, 0));
      return { parts, lensZ: 0.305, lensR: 0.085, base: true };
    case 'wash':
      add(new THREE.CylinderGeometry(0.17, 0.15, 0.3, 16).rotateX(Math.PI / 2));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(-0.2, 0.08, 0));
      add(new THREE.BoxGeometry(0.04, 0.34, 0.12).translate(0.2, 0.08, 0));
      return { parts, lensZ: 0.152, lensR: 0.14, base: true };
    case 'beam':
      add(new THREE.BoxGeometry(0.24, 0.24, 0.26));
      add(new THREE.BoxGeometry(0.04, 0.3, 0.1).translate(-0.15, 0.07, 0));
      add(new THREE.BoxGeometry(0.04, 0.3, 0.1).translate(0.15, 0.07, 0));
      return { parts, lensZ: 0.132, lensR: 0.1, base: true };
    case 'ledpar':
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 18).rotateX(Math.PI / 2));
      add(new THREE.TorusGeometry(0.2, 0.015, 4, 16, Math.PI).rotateZ(Math.PI)); // лира
      return { parts, lensZ: 0.072, lensR: 0.165, base: false };
    case 'profile':
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06));
      add(new THREE.BoxGeometry(0.2, 0.22, 0.2).translate(0, 0, -0.2));
      return { parts, lensZ: 0.272, lensR: 0.07, base: false };
    case 'fresnel':
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 14).rotateX(Math.PI / 2));
      for (const [x, y, rz] of [[0, 0.17, 0], [0, -0.17, 0], [0.17, 0, Math.PI / 2], [-0.17, 0, Math.PI / 2]]) {
        add(new THREE.BoxGeometry(0.24, 0.01, 0.12).rotateX(y > 0 ? -0.5 : y < 0 ? 0.5 : 0).rotateZ(rz).translate(x, y, 0.19));
      }
      return { parts, lensZ: 0.131, lensR: 0.11, base: false };
    case 'par':
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.34, 14).rotateX(Math.PI / 2));
      return { parts, lensZ: 0.171, lensR: 0.1, base: false };
    case 'follow':
      add(new THREE.CylinderGeometry(0.13, 0.11, 0.9, 14).rotateX(Math.PI / 2));
      return { parts, lensZ: 0.451, lensR: 0.1, base: false };
    default:
      add(new THREE.BoxGeometry(0.2, 0.2, 0.3));
      return { parts, lensZ: 0.15, lensR: 0.08, base: false };
  }
}

function merge(parts) {
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0.012 } },
    vertexShader: /* glsl */ `
      varying float vT;
      varying float vF;
      varying vec3 vCol;
      void main() {
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        vec4 mv = modelViewMatrix * wp;
        vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vF = abs(dot(n, normalize(-mv.xyz)));
        vT = uv.y;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying float vT;
      varying float vF;
      varying vec3 vCol;
      void main() {
        float along = 0.18 + 0.82 * pow(vT, 1.6);
        float edge = pow(vF, 1.8);
        gl_FragColor = vec4(vCol, uStrength * along * edge);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export class FixtureSystem {
  /** opts: { beams: bool (видимость по умолчанию), beamSegments, labels: LabelManager|null } */
  constructor(M, rigging, opts) {
    this.M = M;
    this.rigging = rigging;
    this.opts = opts;
    this.root = new THREE.Group();
    this.root.name = 'fixtures';
    this.list = FIXTURES.map((f, i) => ({ ...f, idx: i, on: true, selected: false }));
    this.byNo = new Map(this.list.map((f) => [String(f.no), f]));
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._build();
    this.updateAll();
  }

  _build() {
    const M = this.M;
    const byShape = {};
    for (const f of this.list) (byShape[TYPES[f.type].shape] ||= []).push(f);
    this.shapes = {};
    const bodyMat = M.fixtureBody.clone();
    bodyMat.color.set(0xffffff);
    bodyMat.name = 'fixtureBodyInst';
    this.bodyMat = bodyMat;
    for (const [shape, fl] of Object.entries(byShape)) {
      const hg = headGeometry(shape);
      const im = new THREE.InstancedMesh(merge(hg.parts), bodyMat, fl.length);
      im.name = `fixtures:${shape}`;
      im.castShadow = true;
      im.userData.pickInstanced = { kind: 'fixture', map: fl.map((f) => f.idx) };
      fl.forEach((f, k) => { f.shapeKey = shape; f.shapeIdx = k; f.lensZ = hg.lensZ; f.lensR = hg.lensR * (TYPES[f.type].scale || 1); f.hasBase = hg.base; });
      this.shapes[shape] = im;
      this.root.add(im);
    }
    // основания/струбцины (не поворачиваются)
    const n = this.list.length;
    const baseGeo = merge([new THREE.BoxGeometry(0.3, 0.1, 0.24).toNonIndexed()]);
    const clampGeo = merge([new THREE.BoxGeometry(0.06, 0.12, 0.06).toNonIndexed()]);
    this.bases = new THREE.InstancedMesh(baseGeo, bodyMat, n);
    this.clamps = new THREE.InstancedMesh(clampGeo, bodyMat, n);
    this.bases.name = 'fixtureBases';
    this.clamps.name = 'fixtureClamps';
    this.root.add(this.bases, this.clamps);
    // линзы
    const lensGeo = new THREE.CircleGeometry(1, 16);
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.lenses = new THREE.InstancedMesh(lensGeo, this.lensMat, n);
    this.lenses.name = 'lenses';
    this.root.add(this.lenses);
    // лучи
    const seg = this.opts.beamSegments || 20;
    const cone = new THREE.CylinderGeometry(0, 1, 1, seg, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
    this.beams = new THREE.InstancedMesh(cone, beamMaterial(), n);
    this.beams.name = 'beams';
    this.beams.frustumCulled = false;
    this.beams.renderOrder = 5;
    this.beams.visible = !!this.opts.beams;
    this.root.add(this.beams);
    // пятна на полу: смешивание «максимумом» — сотня пятен в центре не складывается в белое,
    // яркость в любой точке не выше самого яркого пятна
    const poolGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({
      map: radialTexRGB(), transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.pools = new THREE.InstancedMesh(poolGeo, this.poolMat, n);
    this.pools.name = 'pools';
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 4;
    this.root.add(this.pools);
    for (const im of [this.bases, this.clamps, this.lenses, this.beams, this.pools, ...Object.values(this.shapes)]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.userData.layer = 'lights';
    }
    // номера приборов
    if (this.opts.labels) {
      for (const f of this.list) {
        const s = this.opts.labels.make(String(f.no), { px: 11, color: TYPES[f.type].unknown ? '#ffb3f0' : '#ffe9c2', bg: 'rgba(10,10,12,0.7)', kind: 'fixture' });
        f.label = s;
        this.root.add(s);
      }
    }
  }

  /** Мировая позиция крепления прибора. */
  mountPos(f, out = new THREE.Vector3()) {
    const m = f.mount;
    if (m.on) {
      const h = this.rigging.height(m.on);
      return out.set(m.x, h + m.y, -(BAR_DEPTH[m.on] + m.d));
    }
    return out.set(m.x, m.y, -m.d);
  }

  updateAll() { for (const f of this.list) this._update(f); this._flush(); }

  /** Обновить приборы на конкретном софите (после его движения). */
  updateBar(barId) {
    let any = false;
    for (const f of this.list) if (f.mount.on === barId) { this._update(f); any = true; }
    if (any) this._flush();
  }

  _flush() {
    for (const im of [this.bases, this.clamps, this.lenses, this.beams, this.pools, ...Object.values(this.shapes)]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }

  _update(f) {
    const mount = this.mountPos(f);
    const onBar = !!f.mount.on;
    const hang = onBar || f.group.startsWith('BR');
    // центр головы
    const head = mount.clone();
    if (hang) head.y -= f.hasBase ? 0.32 : 0.22;
    const aim = new THREE.Vector3(f.aim.x, f.aim.y, -f.aim.d);
    const dir = aim.clone().sub(head).normalize();
    const q = this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const sc = TYPES[f.type].scale || 1;
    this._m.compose(head, q, this._s.set(sc, sc, sc));
    this.shapes[f.shapeKey].setMatrixAt(f.shapeIdx, this._m);
    this.shapes[f.shapeKey].setColorAt(f.shapeIdx, f.selected ? BODY_SEL : TYPES[f.type].unknown ? BODY_UNKNOWN : BODY);
    // основание (у «голов») или струбцина
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    if (f.hasBase && hang) {
      this.bases.setMatrixAt(f.idx, new THREE.Matrix4().makeTranslation(mount.x, mount.y - 0.08, mount.z));
      this.clamps.setMatrixAt(f.idx, zero);
    } else {
      this.bases.setMatrixAt(f.idx, zero);
      this.clamps.setMatrixAt(f.idx, hang ? new THREE.Matrix4().makeTranslation(mount.x, mount.y - 0.08, mount.z) : zero);
    }
    this.bases.setColorAt(f.idx, BODY);
    this.clamps.setColorAt(f.idx, BODY);
    // линза
    const lensPos = head.clone().add(dir.clone().multiplyScalar(f.lensZ * sc + 0.002));
    this._m.compose(lensPos, q, this._s.set(f.lensR, f.lensR, 1));
    this.lenses.setMatrixAt(f.idx, this._m);
    this.lenses.setColorAt(f.idx, f.on ? WARM : LENS_OFF);
    // луч и пятно
    const half = THREE.MathUtils.degToRad(TYPES[f.type].beam / 2);
    const hit = traceToFloor(lensPos, dir);
    const L = hit.dist;
    const r = Math.tan(half);
    if (f.on) {
      this._m.compose(lensPos, q, this._s.set(r * L, r * L, L));
      this.beams.setMatrixAt(f.idx, this._m);
    } else this.beams.setMatrixAt(f.idx, zero);
    this.beams.setColorAt(f.idx, WARM);
    if (f.on && hit.floor) {
      const rad = Math.max(0.25, r * L);
      const stretch = Math.min(3.5, 1 / Math.max(0.28, Math.abs(dir.y)));
      const ang = Math.atan2(-dir.z, dir.x);
      const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      this._m.compose(hit.point.clone().setY(hit.point.y + 0.012), qp, this._s.set(rad * stretch, 1, rad));
      this.pools.setMatrixAt(f.idx, this._m);
    } else this.pools.setMatrixAt(f.idx, zero);
    this.pools.setColorAt(f.idx, poolColor(f));
    if (f.label) f.label.position.copy(mount).add(new THREE.Vector3(0, hang ? 0.12 : 0.3, 0));
    f.world = { head, dir, lensPos };
  }

  setOn(idx, on) {
    const f = this.list[idx];
    if (f.on === on) return;
    f.on = on;
    this._update(f);
    this._flush();
  }

  setMany(pred, on) {
    for (const f of this.list) if (pred(f)) { f.on = on; this._update(f); }
    this._flush();
  }

  select(idx) {
    for (const f of this.list) {
      const s = f.idx === idx;
      if (f.selected !== s) { f.selected = s; this._update(f); }
    }
    this._flush();
  }

  setHaze(v) { this.beams.visible = v; }
  setPools(v) { this.pools.visible = v; }
  setLabels(v) { for (const f of this.list) if (f.label) f.label.visible = v; }
}

function poolColor(f) {
  // пятна от приборов в зале (на сцену издалека) — слабее
  const k = f.group.startsWith('BR') || f.group.startsWith('BOX') ? 0.35 : f.group === 'FOH' ? 0.6 : 0.5;
  return WARM.clone().multiplyScalar(k * POOL_GAIN);
}

/** Пересечение луча с полом сцены/зала/стенами зала. */
export function traceToFloor(p, dir) {
  const maxD = 30;
  let best = { dist: maxD, floor: false, point: null };
  // планшет сцены (y = 0): коробка и авансцена
  if (dir.y < -0.02) {
    const t = -p.y / dir.y;
    const q = p.clone().addScaledVector(dir, t);
    const d = -q.z;
    const onStage = d >= 0 && d <= DIM.box.backWallD && Math.abs(q.x) <= BOX_HALF;
    const onFs = d < 0 && d >= -DIM.forestage.depth && Math.abs(q.x) <= DIM.forestage.frontWidth / 2 + ((d + DIM.forestage.depth) / DIM.forestage.depth) * ((DIM.forestage.backWidth - DIM.forestage.frontWidth) / 2);
    if ((onStage || onFs) && t < best.dist) best = { dist: t, floor: true, point: q };
    else if (!onStage && !onFs) {
      // пол зала (ступенчатый) — несколько итераций
      let tt = t;
      for (let k = 0; k < 4; k++) {
        const qq = p.clone().addScaledVector(dir, tt);
        const fy = hallFloorY(-qq.z);
        tt = (fy - p.y) / dir.y;
      }
      const qq = p.clone().addScaledVector(dir, tt);
      if (tt > 0 && tt < best.dist && Math.abs(qq.x) <= HALL_HALF) best = { dist: tt, floor: true, point: qq };
    }
  }
  // боковые стены
  if (Math.abs(dir.x) > 1e-3) {
    const wx = dir.x > 0 ? HALL_HALF : -HALL_HALF;
    const t = (wx - p.x) / dir.x;
    if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
  }
  // задняя стена сцены
  if (dir.z < -1e-3) {
    const t = (-DIM.box.backWallD - p.z) / dir.z;
    if (t > 0 && t < best.dist) best = { dist: t, floor: false, point: p.clone().addScaledVector(dir, t) };
  }
  return best;
}
