// Подвижная механика: штанкеты, софиты, дорога занавеса, боковые штанкеты,
// тросы подвеса, канаты управления, противовесы (каретки) на рабочей галерее.
import * as THREE from 'three';
import { DIM, BOX_HALF } from '../config/dimensions.js';
import { RIGGING, RIG_BY_ID, ropeDepth, LEFT_RAIL_ORDER, RIGHT_FRONT_ORDER } from '../config/rigging.js';
import { box, cylBetween, P } from '../../../core/geom.js';

const W = BOX_HALF;
const CEIL = DIM.box.ceiling;
const CW_X_LEFT = -W + 0.14;
const CW_X_RIGHT = W - 0.14;

export class RiggingSystem {
  /**
   * @param M материалы, @param opts { ropes: bool, labels: LabelManager }
   */
  constructor(M, opts) {
    this.M = M;
    this.opts = opts;
    this.root = new THREE.Group();
    this.root.name = 'rigging';
    this.items = new Map();
    this.listeners = [];
    this.highlightColor = new THREE.Color(0xff8a1f);
    this._build();
  }

  onChange(fn) { this.listeners.push(fn); }

  _build() {
    const M = this.M;
    const pipeR = DIM.pipe.diameter / 2;
    const cableVerts = [];
    this._cableIndex = [];

    // противовесы — один InstancedMesh
    const cwItems = RIGGING.filter((r) => r.control);
    const cwGeo = new THREE.BoxGeometry(0.1, 0.9, 0.13);
    this.arbors = new THREE.InstancedMesh(cwGeo, M.counterweight, cwItems.length);
    this.arbors.name = 'arbors';
    this.arbors.castShadow = true;
    this.root.add(this.arbors);

    cwItems.forEach((r, i) => {
      const g = new THREE.Group();
      g.name = `rig:${r.id}`;
      const mat = (r.kind === 'light' ? M.pipe : r.kind === 'track' ? M.track : M.pipe).clone();
      mat.name = `rig:${r.id}`;
      let visual, hit;
      if (r.kind === 'side') {
        const len = r.dTo - r.dFrom;
        visual = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, len, 10).rotateX(Math.PI / 2), mat);
        visual.position.set(r.x, 0, -(r.dFrom + len / 2));
        hit = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 6).rotateX(Math.PI / 2), hitMat());
        hit.position.copy(visual.position);
      } else if (r.kind === 'track') {
        // ферма-короб 0.2 × 0.2 × 15 м: 4 трубки + поперечины
        const L = DIM.pipe.trackLength, s = DIM.pipe.trackWidth / 2;
        const parts = [];
        for (const [yy, dd] of [[-s, -s], [-s, s], [s, -s], [s, s]]) parts.push(cylBetween(P(-L / 2, yy, r.d + dd), P(L / 2, yy, r.d + dd), 0.012, 5));
        for (let x = -L / 2; x <= L / 2 + 1e-6; x += 0.75) {
          parts.push(box(x - 0.015, x + 0.015, -s, s, r.d - s, r.d + s));
        }
        visual = new THREE.Mesh(mergeSimple(parts), mat);
        hit = new THREE.Mesh(new THREE.BoxGeometry(L, 0.35, 0.35), hitMat());
        hit.position.set(0, 0, -r.d);
      } else {
        visual = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, DIM.pipe.length, 10).rotateZ(Math.PI / 2), mat);
        visual.position.set(0, 0, -r.d);
        // зона захвата: у софита захватывает и трубу, и висящие под ней приборы
        hit = new THREE.Mesh(new THREE.BoxGeometry(DIM.pipe.length, r.kind === 'light' ? 0.36 : 0.24, r.kind === 'light' ? 0.5 : 0.22), hitMat());
        hit.position.set(0, r.kind === 'light' ? -0.12 : 0, -r.d);
      }
      visual.castShadow = true;
      hit.userData.pick = { kind: 'rig', id: r.id };
      g.add(visual, hit);
      this.root.add(g);

      // точки подвеса
      const pickups = r.kind === 'side'
        ? [r.dFrom, (r.dFrom + r.dTo) / 2, r.dTo].map((d) => ({ x: r.x, d }))
        : DIM.pipe.pickupX.map((x) => ({ x, d: r.d }));
      const topY = r.d < DIM.portal.thickness ? DIM.decoCeilingY : CEIL - 0.08;
      const start = cableVerts.length / 3;
      for (const p of pickups) cableVerts.push(p.x, 0, -p.d, p.x, topY, -p.d);
      this._cableIndex.push({ id: r.id, start, count: pickups.length, topY });

      // подпись
      let label = null;
      if (this.opts.labels) {
        label = this.opts.labels.make(r.name, { px: 15, color: r.kind === 'light' ? '#ffd28a' : '#cfe3ff', kind: 'rig' });
        if (r.kind === 'side') label.position.set(r.x, 0.22, -r.dFrom - 0.2);
        else label.position.set((i % 2 ? 1 : -1) * (DIM.pipe.length / 2 + 0.25), 0.18, -r.d); // через один — слева/справа, чтобы не слипались
        label.userData.home = label.position.clone();
        label.userData.order = i;
        g.add(label);
      }

      const item = { cfg: r, group: g, mat, visual, hit, pickups, h: r.rest, cwIndex: i, label };
      this.items.set(r.id, item);
    });

    // тросы — один LineSegments, обновляется при движении
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cableVerts, 3));
    this.cables = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x8d939c, transparent: true, opacity: 0.7 }));
    this.cables.name = 'cables';
    this.cables.frustumCulled = false;
    this.root.add(this.cables);

    for (const id of this.items.keys()) this._apply(id);
  }

  /** Статика механики: направляющие противовесов, блоки, фиксаторы канатов, канаты. */
  buildStatic(batch) {
    const M = this.M;
    const steel = [];
    const ropeLines = [];
    const blocks = [];
    for (const r of RIGGING) {
      const left = r.control === 'left';
      const x = left ? CW_X_LEFT : CW_X_RIGHT;
      const d = ropeDepth(r.id);
      // направляющие (пара Т-профилей)
      for (const dd of [d - 0.085, d + 0.085]) steel.push(box(x - 0.03, x + 0.03, 0.15, CEIL - 0.3, dd - 0.01, dd + 0.01));
      // головной блок над направляющей
      blocks.push(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12).rotateZ(Math.PI / 2).translate(x, CEIL - 0.2, -d));
      // канат управления (ручной): вертикаль у фиксатора
      const rx = left ? -W + 0.62 : W - 0.62;
      ropeLines.push(rx, 0.3, -d, rx, CEIL - 0.2, -d);
      ropeLines.push(rx, CEIL - 0.2, -d, x, CEIL - 0.2, -d);
      // трос от головного блока к подвесам по потолку
      const it = this.items.get(r.id);
      const far = it.pickups.reduce((a, p) => (Math.abs(p.x - x) > Math.abs(a.x - x) ? p : a), it.pickups[0]);
      const near = it.pickups.reduce((a, p) => (Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a), it.pickups[0]);
      const topY = it.cfg.d < DIM.portal.thickness ? CEIL - 0.12 : CEIL - 0.12;
      ropeLines.push(x, topY, -d, near.x, topY, -near.d);
      ropeLines.push(near.x, topY, -near.d, far.x, topY, -far.d);
      // блоки над подвесами
      for (const p of it.pickups) {
        if (p.d < DIM.portal.thickness) continue;
        blocks.push(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10).rotateX(Math.PI / 2).translate(p.x, CEIL - 0.12, -p.d));
      }
    }
    // обводные блоки для Ш0 и С0 (над порталом)
    for (const id of ['Sh0', 'C0']) {
      const it = this.items.get(id);
      for (const p of it.pickups) {
        blocks.push(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10).rotateX(Math.PI / 2).translate(p.x, CEIL - 0.12, -DIM.portal.thickness / 2));
        // трос: от обводного блока над порталом вниз за декоративный потолок
        if (this.opts.ropes) {
          ropeLines.push(p.x, CEIL - 0.12, -DIM.portal.thickness / 2, p.x, DIM.decoCeilingY + 0.02, -p.d);
        }
      }
    }
    // фиксаторы канатов (две трубы) — левая стена и правый передний угол
    const lockL = [ropeDepth(LEFT_RAIL_ORDER[0]) - 0.3, ropeDepth(LEFT_RAIL_ORDER.at(-1)) + 0.3];
    for (const y of [0.45, 1.0]) steel.push(cylBetween(P(-W + 0.62, y, lockL[0]), P(-W + 0.62, y, lockL[1]), 0.03, 8));
    const lockR = [ropeDepth(RIGHT_FRONT_ORDER[0]) - 0.2, ropeDepth(RIGHT_FRONT_ORDER.at(-1)) + 0.2];
    for (const y of [0.45, 1.0]) steel.push(cylBetween(P(W - 0.62, y, lockR[0]), P(W - 0.62, y, lockR[1]), 0.03, 8));
    const b2 = ropeDepth('B2');
    for (const y of [0.45, 1.0]) steel.push(cylBetween(P(W - 0.62, y, b2 - 0.25), P(W - 0.62, y, b2 + 0.25), 0.03, 8));
    // стойки фиксатора
    for (let d = lockL[0]; d <= lockL[1] + 1e-6; d += 1.2) steel.push(box(-W, -W + 0.65, 0.98, 1.02, d - 0.02, d + 0.02), box(-W + 0.6, -W + 0.64, 0, 1.0, d - 0.02, d + 0.02));
    // решётка-ограждение противовесов на левой стене (сетка + стойки), как на фото
    const cageX = -W + 0.32;
    steel.push(box(cageX - 0.02, cageX + 0.02, 1.9, 1.94, lockL[0], lockL[1]));
    for (let d = lockL[0]; d <= lockL[1] + 1e-6; d += (lockL[1] - lockL[0]) / 8) steel.push(box(cageX - 0.02, cageX + 0.02, 0, DIM.galleries.upperY - 0.2, d - 0.02, d + 0.02));
    const meshPanel = new THREE.PlaneGeometry(lockL[1] - lockL[0], DIM.galleries.upperY - 2.2).rotateY(Math.PI / 2).translate(cageX, 2.0 + (DIM.galleries.upperY - 2.2) / 2, -(lockL[0] + lockL[1]) / 2);
    batch.add('rigging', M.mesh, meshPanel, { shadow: false });

    batch.add('rigging', M.steel, steel);
    batch.add('rigging', M.pipe, blocks);

    if (this.opts.ropes) {
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(ropeLines, 3));
      const ropes = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc9b48a, transparent: true, opacity: 0.85 }));
      ropes.name = 'ropes';
      this.root.add(ropes);
    }

    // подписи у канатов управления
    if (this.opts.labels && this.opts.ropeLabels) {
      for (const r of RIGGING) {
        const left = r.control === 'left';
        const s = this.opts.labels.make(r.name, { px: 12, color: '#f3e6c8', bg: 'rgba(40,30,15,0.8)', kind: 'rope' });
        s.position.set(left ? -W + 0.62 : W - 0.62, 1.35, -ropeDepth(r.id));
        s.userData.rigId = r.id;
        this.root.add(s);
      }
    }
  }

  get(id) { return this.items.get(id); }
  height(id) { return this.items.get(id).h; }

  setHeight(id, h, { silent = false } = {}) {
    const it = this.items.get(id);
    if (!it) return;
    const r = it.cfg;
    const v = Math.min(r.max, Math.max(r.min, Math.round(h * 100) / 100));
    if (v === it.h) return;
    it.h = v;
    this._apply(id);
    if (!silent) for (const fn of this.listeners) fn(id, v);
  }

  _apply(id) {
    const it = this.items.get(id);
    const r = it.cfg;
    it.group.position.y = it.h;
    // тросы
    const ci = this._cableIndex.find((c) => c.id === id);
    const pos = this.cables.geometry.attributes.position;
    for (let k = 0; k < ci.count; k++) pos.setY(ci.start + k * 2, it.h);
    pos.needsUpdate = true;
    // противовес: 1:1 — штанкет вниз, каретка вверх
    const x = r.control === 'left' ? CW_X_LEFT : CW_X_RIGHT;
    const y = 0.6 + (r.max - it.h);
    const m = new THREE.Matrix4().makeTranslation(x, y, -ropeDepth(id));
    this.arbors.setMatrixAt(it.cwIndex, m);
    this.arbors.instanceMatrix.needsUpdate = true;
  }

  highlight(id) { this._sel = id; this._paint(); }
  /** Подсветка при наведении курсора (слабее, чем у выбранного). */
  hover(id) { if (this._hov === id) return false; this._hov = id; this._paint(); return true; }
  _paint() {
    for (const [k, it] of this.items) {
      const sel = k === this._sel, hov = !sel && k === this._hov;
      it.mat.emissive.set(sel || hov ? this.highlightColor : 0x000000);
      it.mat.emissiveIntensity = sel ? 0.8 : hov ? 0.35 : 0;
    }
  }

  /** Ось трубы в мировых координатах (для выбора ближайшей к курсору). */
  axis(id) {
    const it = this.items.get(id), r = it.cfg, y = it.h;
    if (r.kind === 'side') return [new THREE.Vector3(r.x, y, -r.dFrom), new THREE.Vector3(r.x, y, -r.dTo)];
    const L = (r.kind === 'track' ? DIM.pipe.trackLength : DIM.pipe.length) / 2;
    return [new THREE.Vector3(-L, y, -r.d), new THREE.Vector3(L, y, -r.d)];
  }

  /**
   * Раскладка подписей: 'plan' — на плане сверху подписи у каждого края выносятся «лесенкой»
   * в две колонки (шаг 30 см между трубами меньше высоты подписи) и рисуются поверх всего;
   * иначе — обычная (через одну слева/справа, у трубы).
   */
  setLabelLayout(mode) {
    for (const it of this.items.values()) {
      const s = it.label;
      if (!s) continue;
      s.position.copy(s.userData.home);
      s.material.depthTest = mode !== 'plan';
      s.renderOrder = mode === 'plan' ? 12 : 10;
      if (it.cfg.kind === 'side') {
        // боковой штанкет идёт под колонками подписей — на плане подпись к середине, ближе к центру
        if (mode === 'plan') s.position.set(it.cfg.x - Math.sign(it.cfg.x) * 1.2, s.position.y, -(it.cfg.dFrom + it.cfg.dTo) / 2);
        continue;
      }
      const far = mode === 'plan' && Math.floor(s.userData.order / 2) % 2 === 1;
      if (far) s.position.x += Math.sign(s.position.x) * 0.95;
    }
  }

  snapshot() { return Object.fromEntries([...this.items].map(([k, v]) => [k, v.h])); }
}

function hitMat() {
  const m = new THREE.MeshBasicMaterial({ visible: false });
  return m;
}

function mergeSimple(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

export { RIG_BY_ID };
