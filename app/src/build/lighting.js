// Настоящие источники света (их немного: браузер не потянет ~114 честных источников).
// Каждый «групповой» прожектор изображает свет своей группы приборов; его яркость
// пропорциональна доле включённых приборов группы. Плюс дежурный и зальный свет.
import * as THREE from 'three';
import { DIM } from '../config/dimensions.js';
import { BAR_DEPTH } from '../config/fixtures.js';

const WARM = 0xffd2a0;
// Общий множитель яркости сценического света (подбирается по скриншотам: scripts/luma.ps1)
const GROUP_GAIN = 1.5;
const DUTY_GAIN = 0.6;

/** Набор групповых источников для профиля. members — группы приборов. */
const PLAN = {
  full: [
    { id: 'C0', members: ['C0'], shadow: false },
    { id: 'C1', members: ['C1'], shadow: true },
    { id: 'C2', members: ['C2'], shadow: true },
    { id: 'C3', members: ['C3'], shadow: false },
    { id: 'GAL', members: ['GAL_L', 'GAL_R', 'GAL_B'] },
    { id: 'BR', members: ['BR1', 'BR2'], shadow: false },
    { id: 'BOXL', members: ['BOX_L1', 'BOX_L2', 'TOW_L'] },
    { id: 'BOXR', members: ['BOX_R1', 'BOX_R2', 'TOW_R'] },
    { id: 'FOH', members: ['FOH'] },
  ],
  lite: [
    { id: 'FRONT', members: ['C0', 'C1'] },
    { id: 'BACK', members: ['C2', 'C3', 'GAL_L', 'GAL_R', 'GAL_B'] },
    { id: 'HALL', members: ['BR1', 'BR2', 'BOX_L1', 'BOX_L2', 'BOX_R1', 'BOX_R2', 'TOW_L', 'TOW_R', 'FOH'] },
  ],
};

export class LightingSystem {
  /** opts: { plan: 'full'|'lite', shadows: bool, dutyPoints, housePoints, blueX } */
  constructor(fixtures, opts) {
    this.fx = fixtures;
    this.opts = opts;
    this.root = new THREE.Group();
    this.root.name = 'realLights';
    this.groupLights = [];
    this.level = { stage: 1, duty: 1, house: 1 };
    this._build();
  }

  _build() {
    // общий слабый «технический» свет — модель читается и в темноте
    this.hemi = new THREE.HemisphereLight(0xb8c4d6, 0x1a1816, 0.25);
    this.root.add(this.hemi);

    for (const g of PLAN[this.opts.plan]) {
      const members = this.fx.list.filter((f) => g.members.includes(f.group));
      const L = new THREE.SpotLight(WARM, 0, 0, Math.PI / 5, 0.65, 1.6);
      L.name = `spot:${g.id}`;
      L.castShadow = !!(this.opts.shadows && g.shadow);
      if (L.castShadow) {
        L.shadow.mapSize.set(1024, 1024);
        L.shadow.bias = -0.0005;
        L.shadow.normalBias = 0.02;
        L.shadow.camera.near = 0.5;
        L.shadow.camera.far = 25;
      }
      this.root.add(L, L.target);
      this.groupLights.push({ ...g, light: L, fixtures: members });
    }
    this.placeGroupLights();

    // дежурный свет: по одной «лампе» на линию ДО (в лёгком профиле — одна на все)
    const dp = this.opts.dutyPoints;
    const rows = this.opts.plan === 'full' ? [0, 1, 2] : [1];
    this.dutyLights = rows.map((r) => {
      const pts = dp.slice(r * 4, r * 4 + 4);
      const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const L = new THREE.PointLight(0xffe2b0, 0, 0, 1.4);
      L.position.copy(c).add(new THREE.Vector3(0, -0.3, 0));
      L.userData.base = (this.opts.plan === 'full' ? 34 : 70) * DUTY_GAIN;
      this.root.add(L);
      return L;
    });
    // синие приборы у задней стены
    const blue = this.opts.plan === 'full' ? this.opts.blueX : [this.opts.blueX[1]];
    this.blueLights = blue.map((p) => {
      const L = new THREE.SpotLight(0x3348ff, 0, 7, Math.PI / 3.2, 0.8, 1.5);
      L.position.copy(p);
      L.target.position.set(p.x, 0, p.z + 0.15);
      L.userData.base = this.opts.plan === 'full' ? 9 : 22;
      this.root.add(L, L.target);
      return L;
    });
    // свет в зале
    const hallPts = this.opts.plan === 'full' ? [[-4, -9], [4, -9], [0, -15]] : [[0, -11]];
    this.houseLights = hallPts.map(([x, d]) => {
      const L = new THREE.SpotLight(0xfff0d6, 0, 0, Math.PI / 2.6, 0.9, 1.3);
      L.position.set(x, DIM.hall.ceilingY - 0.2, -d);
      L.target.position.set(x, -1, -d);
      L.userData.base = this.opts.plan === 'full' ? 120 : 260;
      this.root.add(L, L.target);
      return L;
    });
  }

  /** Перерасчёт положения и яркости групповых источников (после движения софитов / вкл-выкл). */
  placeGroupLights() {
    for (const g of this.groupLights) {
      const fl = g.fixtures;
      if (!fl.length) continue;
      const c = new THREE.Vector3(), a = new THREE.Vector3();
      let on = 0;
      for (const f of fl) {
        c.add(this.fx.mountPos(f, new THREE.Vector3()));
        a.add(new THREE.Vector3(f.aim.x, f.aim.y, -f.aim.d));
        if (f.on) on++;
      }
      c.multiplyScalar(1 / fl.length);
      a.multiplyScalar(1 / fl.length);
      // разброс целей → угол конуса
      let spread = 0;
      for (const f of fl) spread = Math.max(spread, Math.hypot(f.aim.x - a.x, -f.aim.d - a.z));
      const L = g.light;
      L.position.copy(c);
      L.target.position.copy(a);
      const dist = c.distanceTo(a);
      L.angle = Math.min(Math.PI / 2.3, Math.atan((spread + 2.2) / Math.max(1, dist)));
      // яркость: ~ доля включённых × количество × расстояние^затухание (физические единицы)
      const per = (g.members.some((m) => m.startsWith('BOX') || m.startsWith('TOW')) ? 2.5 : g.members[0] === 'FOH' ? 14 : 3.2) * (this.opts.plan === 'lite' ? 0.7 : 1);
      L.userData.base = per * on * Math.pow(dist, 1.6) * 0.032 * GROUP_GAIN;
      L.intensity = L.userData.base * this.level.stage;
    }
  }

  setStage(level) { this.level.stage = level; for (const g of this.groupLights) g.light.intensity = (g.light.userData.base || 0) * level; }
  setDuty(on) {
    this.level.duty = on ? 1 : 0;
    for (const L of [...this.dutyLights, ...this.blueLights]) L.intensity = on ? L.userData.base : 0;
  }
  setHouse(on) {
    this.level.house = on ? 1 : 0;
    for (const L of this.houseLights) L.intensity = on ? L.userData.base : 0;
  }
  setAmbient(v) { this.hemi.intensity = v; }
}

export { BAR_DEPTH };
