// Настоящие источники света (их немного: браузер не потянет ~114 честных источников).
// Каждый «групповой» прожектор изображает свет своей группы приборов; его яркость
// пропорциональна доле включённых приборов группы. Плюс дежурный и зальный свет.
// Общая система для всех площадок: состав групповых источников (venue.lightPlans)
// и дежурный/зальный свет (venue.ambientLights) приходят из модуля площадки.
import * as THREE from 'three';

const WARM = 0xffd2a0;
// Общий множитель яркости сценического света (подбирается по скриншотам: scripts/luma.ps1)
const GROUP_GAIN = 1.5;
// Яркость одного прибора группы по умолчанию (у площадки — поле per в плане источников)
const PER_DEFAULT = 3.2;

export class LightingSystem {
  /**
   * opts: { plan: 'full'|'lite', shadows: bool,
   *         groups: [{ id, members: [группы приборов], shadow?, per? }] — план групповых источников,
   *         ambient: { duty: THREE.Light[], blue: THREE.Light[], house: THREE.Light[] } — готовые
   *                  источники дежурного (duty, blue) и зального (house) света; base — в userData.base }
   */
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

    for (const g of this.opts.groups || []) {
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

    // дежурный (лампы и синие приборы) и зальный свет — от площадки
    const amb = this.opts.ambient || {};
    this.dutyLights = amb.duty || [];
    this.blueLights = amb.blue || [];
    this.houseLights = amb.house || [];
    for (const L of [...this.dutyLights, ...this.blueLights, ...this.houseLights]) {
      this.root.add(L);
      if (L.target) this.root.add(L.target);
    }
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
        if (f.on && !f.hidden) on++;
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
      const per = (g.per ?? PER_DEFAULT) * (this.opts.plan === 'lite' ? 0.7 : 1);
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
