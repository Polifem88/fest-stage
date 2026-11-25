// Подвижная механика Студии мультимедиа (слой rigging):
// замкнутый контур алюминиевых ферм 30 × 30 (4,10 × 5,00 м по осям), 4 цепные лебёдки со спансетами
// под верхними поперечными фермами Ф3 и Ф5, 4 динамические грузовые цепи и 4-сторонняя зона захвата.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cylBetween, P } from '../../../core/geom.js';
import { trussLineTubes } from '../../_template/trusses.js';
import { STUDIO } from '../config/dimensions.js';
import { RIGGING } from '../config/rigging.js';

// Визуальные константы деталей
const HIT_HALF = 0.21; // полуширина невидимого бокса захвата 0,42 × 0,42 м вокруг фермы 0,30 × 0,30
const SPANSET_R = 0.022; // радиус петли текстильного стропа (спансета)
const SPANSET_SPREAD = 0.045; // разнос ветвей спансета вдоль поперечной фермы
const HOOK_R = 0.014; // радиус переходного звена/крюка под лебёдкой
const LABEL_X_OFF = 0.32;
const LABEL_Y_OFF = 0.08;

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

/** Четыре точки подвеса (x, d) по углам подвижного контура. */
export function hoistPoints() {
  const MT = STUDIO.movableTruss;
  return [
    { x: -MT.x, d: MT.d0 },
    { x: MT.x, d: MT.d0 },
    { x: -MT.x, d: MT.d1 },
    { x: MT.x, d: MT.d1 },
  ];
}

export class StudioRigging {
  /**
   * @param {Object} M палитра материалов
   * @param {{ labels?: Object|null, mobile?: boolean }} [opts]
   */
  constructor(M, { labels = null, mobile = false } = {}) {
    this.M = M;
    this.opts = { labels, mobile };
    this.root = new THREE.Group();
    this.root.name = 'rigging';
    this.items = new Map();
    this.listeners = [];
    this.highlightColor = new THREE.Color(0xff8a1f);
    this._build();
  }

  onChange(fn) { this.listeners.push(fn); }

  _build() {
    const MT = STUDIO.movableTruss;
    const T = STUDIO.trusses;
    const r = RIGGING[0];
    const localT = { size: T.size, tube: T.tube, brace: T.brace, y0: 0, y1: T.size };

    const g = new THREE.Group();
    g.name = `rig:${r.id}`;

    const tubes = [];
    for (const l of MT.lines) tubes.push(...trussLineTubes(l, localT, { mobile: this.opts.mobile }));
    const mat = this.M.trussAlu.clone();
    mat.name = `rig:${r.id}`;
    const visual = new THREE.Mesh(mergeAll(tubes), mat);
    visual.name = `rigVisual:${r.id}`;
    visual.castShadow = true;
    visual.receiveShadow = true;

    const midY = T.size / 2;
    const hitGeo = mergeAll([
      box(-MT.x - HIT_HALF, -MT.x + HIT_HALF, midY - HIT_HALF, midY + HIT_HALF, MT.d0 - HIT_HALF, MT.d1 + HIT_HALF),
      box(MT.x - HIT_HALF, MT.x + HIT_HALF, midY - HIT_HALF, midY + HIT_HALF, MT.d0 - HIT_HALF, MT.d1 + HIT_HALF),
      box(-MT.x + HIT_HALF, MT.x - HIT_HALF, midY - HIT_HALF, midY + HIT_HALF, MT.d0 - HIT_HALF, MT.d0 + HIT_HALF),
      box(-MT.x + HIT_HALF, MT.x - HIT_HALF, midY - HIT_HALF, midY + HIT_HALF, MT.d1 - HIT_HALF, MT.d1 + HIT_HALF),
    ]);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.name = `rigHit:${r.id}`;
    hit.userData.pick = { kind: 'rig', id: r.id };
    hit.userData.noMeasure = true;

    g.add(visual, hit);

    let label = null;
    if (this.opts.labels) {
      label = this.opts.labels.make(r.name, { px: 15, color: '#8ff0e6', kind: 'rig' });
      label.position.set(-MT.x - LABEL_X_OFF, T.size + LABEL_Y_OFF, -MT.d0);
      label.userData.home = label.position.clone();
      g.add(label);
    }

    this.root.add(g);

    const pickups = hoistPoints();
    const cableVerts = [];
    for (const p of pickups) {
      cableVerts.push(p.x, r.rest + T.size, -p.d, p.x, MT.hoist.y0, -p.d);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cableVerts, 3));
    this.cables = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x8d939c, transparent: true, opacity: 0.85 }));
    this.cables.name = 'cables';
    this.cables.frustumCulled = false;
    this.root.add(this.cables);

    this.items.set(r.id, { cfg: r, group: g, mat, visual, hit, pickups, h: r.rest, label });
    this._apply(r.id);
  }

  /** Статика слоя rigging: 4 корпуса цепных лебёдок и спансеты под верхними фермами Ф3 и Ф5. */
  buildStatic(batch) {
    const H = STUDIO.movableTruss.hoist;
    const hoists = [];
    const spansets = [];
    for (const p of hoistPoints()) {
      hoists.push(box(p.x - H.w / 2, p.x + H.w / 2, H.y0, H.y1, p.d - H.d / 2, p.d + H.d / 2));
      for (const sx of [-SPANSET_SPREAD, SPANSET_SPREAD]) {
        spansets.push(cylBetween(P(p.x + sx * 0.4, H.y1, p.d), P(p.x + sx, H.spansetTopY, p.d), SPANSET_R, 6));
      }
      spansets.push(cylBetween(P(p.x, H.y0 - 0.03, p.d), P(p.x, H.y0, p.d), HOOK_R, 6));
    }
    batch.add('rigging', this.M.fixtureBody, hoists, { tag: 'hoists' });
    batch.add('rigging', this.M.steel, spansets, { tag: 'spansets' });
  }

  get(id) { return this.items.get(id); }
  height(id) { return this.items.get(id)?.h; }

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
    const T = STUDIO.trusses;
    it.group.position.y = it.h;
    const pos = this.cables.geometry.attributes.position;
    for (let k = 0; k < it.pickups.length; k++) {
      pos.setY(k * 2, it.h + T.size);
    }
    pos.needsUpdate = true;
  }

  highlight(id) { this._sel = id; this._paint(); }
  hover(id) { if (this._hov === id) return false; this._hov = id; this._paint(); return true; }

  _paint() {
    for (const [k, it] of this.items) {
      const sel = k === this._sel, hov = !sel && k === this._hov;
      it.mat.emissive?.set(sel || hov ? this.highlightColor : 0x000000);
      if ('emissiveIntensity' in it.mat) it.mat.emissiveIntensity = sel ? 0.8 : hov ? 0.35 : 0;
    }
  }

  /** Ось передней поперечной стороны контура в мировых координатах (для ранжирования в Stage.pick). */
  axis(id) {
    const it = this.items.get(id);
    const MT = STUDIO.movableTruss;
    const y = (it ? it.h : MT.restY) + STUDIO.trusses.size / 2;
    return [new THREE.Vector3(-MT.x, y, -MT.d0), new THREE.Vector3(MT.x, y, -MT.d0)];
  }

  setLabelLayout(mode) {
    for (const it of this.items.values()) {
      const s = it.label;
      if (!s) continue;
      s.position.copy(s.userData.home);
      s.material.depthTest = mode !== 'plan';
      s.renderOrder = mode === 'plan' ? 12 : 10;
    }
  }

  snapshot() { return Object.fromEntries([...this.items].map(([k, v]) => [k, v.h])); }
}
