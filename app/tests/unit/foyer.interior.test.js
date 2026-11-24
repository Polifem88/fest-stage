// Фойе (этап 1 — черновик): мебель, LED-экран, оранжевая ткань на лестнице,
// дежурный свет, точечные источники освещения и оверлеи (размеры и сетка).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StaticBatch } from '../../src/core/geom.js';
import { FOYER, foyerCeilY } from '../../src/venues/fest-foyer/config/dimensions.js';
import { buildInterior } from '../../src/venues/fest-foyer/build/interior.js';
import { buildCurtain } from '../../src/venues/fest-foyer/build/curtain.js';
import { buildEmitters } from '../../src/venues/fest-foyer/build/emitters.js';
import { ambientLights } from '../../src/venues/fest-foyer/build/ambient.js';
import { dimList, buildDims, buildGrid } from '../../src/venues/fest-foyer/build/overlays.js';

const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshBasicMaterial({ name: String(p) })) });
const triCount = (group) => {
  let n = 0;
  group?.traverse((o) => {
    if (o.isMesh) n += o.geometry.attributes.position.count / 3;
  });
  return n;
};
const groupBox = (group) => {
  const b = new THREE.Box3();
  group?.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    b.union(o.geometry.boundingBox);
  });
  return b;
};
const fakeLabels = () => {
  const made = [];
  return {
    made,
    make(text, opts = {}) {
      const o = new THREE.Object3D();
      o.userData.text = text;
      o.userData.opts = opts;
      made.push({ text, opts, obj: o });
      return o;
    },
  };
};

describe('Фойе · интерьер и LED-экран (interior.js)', () => {
  it('LED-экран в слое walls в габаритах Y ∈ [3,88; 6,77], d ∈ [8,85; 14,07], X у стены +11,56', () => {
    const batch = new StaticBatch();
    buildInterior(batch, fakeM(), { mobile: false });
    const L = batch.build();

    expect(L.walls).toBeTruthy();
    const mats = new Set(L.walls.children.map((m) => m.material.name));
    expect(mats.has('booth')).toBe(true);
    expect(mats.has('steel')).toBe(true);

    const b = groupBox(L.walls);
    expect(b.min.y).toBeGreaterThanOrEqual(3.88);
    expect(b.max.y).toBeLessThanOrEqual(6.77);
    expect(b.max.y).toBeLessThan(FOYER.trusses.atriumY0);
    // d = -z
    const dMin = -b.max.z;
    const dMax = -b.min.z;
    expect(dMin).toBeGreaterThanOrEqual(8.85);
    expect(dMin).toBeLessThanOrEqual(8.95);
    expect(dMax).toBeLessThanOrEqual(14.07);
    expect(dMax).toBeGreaterThanOrEqual(13.97);
    expect(b.max.x).toBeCloseTo(FOYER.screen.x, 3);
    expect(b.min.x).toBeCloseTo(FOYER.screen.x - FOYER.screen.protrude, 3);
  });

  it('M3: сиденье дивана ровно 0,45 м, спинка 1,10 м; 12 рёбер по 0,10 м на модуль (4 на mobile)', () => {
    const run = (mobile) => {
      const b = new StaticBatch();
      buildInterior(b, fakeM(), { mobile });
      return b.build().furniture;
    };
    const desk = run(false);
    const seat = desk.children.find((m) => m.material.name === 'seatFrame');
    const velvet = desk.children.find((m) => m.material.name === 'velvetOrange');
    seat.geometry.computeBoundingBox();
    velvet.geometry.computeBoundingBox();
    const y2 = FOYER.room.y2;
    expect(seat.geometry.boundingBox.max.y).toBeCloseTo(y2 + 0.45, 4);
    expect(velvet.geometry.boundingBox.max.y).toBeCloseTo(y2 + 1.10, 4);
    // ни одна точка сиденья 1-го этажа не выше 0,45, спинки — не выше 1,10
    const ys = (m) => { const p = m.geometry.attributes.position; const out = []; for (let i = 0; i < p.count; i++) out.push(p.getY(i)); return out; };
    expect(Math.max(...ys(seat).filter((y) => y < y2))).toBeCloseTo(0.45, 4);
    expect(Math.max(...ys(velvet).filter((y) => y < y2))).toBeCloseTo(1.10, 4);
    // velvet: 1 стенка спинки + рёбра; box = 12 треугольников
    const n = FOYER.furniture.sofas1f.length + FOYER.furniture.sofas2f.length;
    const tris = (m) => m.geometry.attributes.position.count / 3;
    expect(tris(velvet)).toBe(n * (1 + 12) * 12);
    const mobVelvet = run(true).children.find((m) => m.material.name === 'velvetOrange');
    expect(tris(mobVelvet)).toBe(n * (1 + 4) * 12);
  });

  it('стойки, диваны и 5 витрин в слое furniture с нужными материалами и без пустых геометрий', () => {
    const batch = new StaticBatch();
    buildInterior(batch, fakeM(), { mobile: false });
    const L = batch.build();

    expect(L.furniture).toBeTruthy();
    const mats = new Set(L.furniture.children.map((m) => m.material.name));
    for (const k of ['woodSlats', 'stageEdge', 'booth', 'seatFrame', 'velvetOrange', 'steel', 'glass']) {
      expect(mats.has(k), `материал ${k}`).toBe(true);
    }
    for (const grp of Object.values(L)) {
      grp.traverse((o) => {
        if (o.isMesh) expect(o.geometry.attributes.position.count, o.name).toBeGreaterThan(0);
      });
    }
    // Проверяем охват по высоте: от пола 1-го эт. (0) до верха витрин 2-го эт. (3.00 + 2.20 = 5.20)
    const b = groupBox(L.furniture);
    expect(b.min.y).toBeCloseTo(0, 3);
    expect(b.max.y).toBeCloseTo(FOYER.room.y2 + FOYER.furniture.showcases[0].h, 2);
  });

  it('mobile строит меньше треугольников диванов, чем desktop', () => {
    const bDesk = new StaticBatch();
    buildInterior(bDesk, fakeM(), { mobile: false });
    const bMob = new StaticBatch();
    buildInterior(bMob, fakeM(), { mobile: true });
    expect(triCount(bMob.build().furniture)).toBeLessThan(triCount(bDesk.build().furniture));
  });

  it('C1/C3: Г-стойки B1 (h 1,20) и гардероба (h 0,90) построены по плечам и не заходят в колонны', () => {
    const batch = new StaticBatch();
    buildInterior(batch, fakeM(), { mobile: false });
    const L = batch.build();
    const C = FOYER.columns;
    const cols = [...C.outer, ...C.inner, C.extraB];
    const EPS = 0.025; // свес столешницы 0,02 м допустим
    let bad = 0;
    const tops = [];
    L.furniture.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const d = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        if (y < FOYER.room.y2 && cols.some((c) => x > c.x0 + EPS && x < c.x1 - EPS && d > c.d0 + EPS && d < c.d1 - EPS)) bad++;
        if (o.material.name === 'stageEdge') tops.push({ x, y, d });
      }
    });
    expect(bad, 'мебель внутри колонн').toBe(0);
    const W = FOYER.zones.wardrobe;
    const B = FOYER.furniture.receptionB1;
    const near = (y, h) => Math.abs(y - h) < 0.04;
    // столешница гардероба h = 0,90 над обоими плечами
    expect(tops.some((t) => near(t.y, W.armD.h) && t.x > W.armD.x0 && t.x < W.armD.x1 && t.d > W.armD.d0 && t.d < W.armD.d1)).toBe(true);
    expect(tops.some((t) => near(t.y, W.armX.h) && t.x > 9.6 && t.x < 11 && t.d > W.armX.d0 && t.d < W.armX.d1)).toBe(true);
    // столешница B1 h = 1,20 над длинным и коротким плечом, перед колонной К1*-3 — пусто
    const [long, short] = B.arms;
    expect(tops.some((t) => near(t.y, B.h) && t.x > -1.5 && t.x < -0.5 && t.d > long.d0 && t.d < long.d1)).toBe(true);
    expect(tops.some((t) => near(t.y, B.h) && t.x > short.x0 && t.x < short.x1 && t.d > 1.0 && t.d < 1.6)).toBe(true);
    expect(tops.some((t) => near(t.y, B.h) && t.x > -2.0 && t.x < -0.5 && t.d > 1.0 && t.d < 1.8)).toBe(false);
  });
});

describe('Фойе · стационарная ткань на лестнице (curtain.js)', () => {
  it('вся геометрия строго в слое curtain; оранжевая ткань от Y = 0, начинается от прохода X = −4,79 и обрывается на 4-й ступени', () => {
    const batch = new StaticBatch();
    buildCurtain(batch, fakeM(), { mobile: false });
    const L = batch.build();

    expect(Object.keys(L)).toEqual(['curtain']);
    const mats = new Set(L.curtain.children.map((m) => m.material.name));
    expect(mats.has('velvetOrange')).toBe(true);
    expect(mats.has('molton'), 'старой чёрной шторы на d = 13,75 больше нет').toBe(false);
    expect(mats.has('pipe') || mats.has('steel')).toBe(true);

    const bAll = groupBox(L.curtain);
    expect(bAll.min.y).toBeCloseTo(0, 3);
    expect(bAll.max.y).toBeLessThanOrEqual(3.05);
    // труба Ø32 по-прежнему от верха марша X = −6,15
    expect(bAll.min.x).toBeLessThanOrEqual(FOYER.stairs.upper.xTop + 0.05);

    const velvet = L.curtain.children.find((m) => m.material.name === 'velvetOrange');
    velvet.geometry.computeBoundingBox();
    const vb = velvet.geometry.boundingBox;
    expect(vb.min.y).toBeCloseTo(0, 3);
    // 4-я ступень снизу: t = (4-1)/13 → x ≈ -0.25, далеко до нижней 1-й ступени x = +0.54
    expect(vb.max.x).toBeLessThan(0.10);
    // полотно начинается от правой границы прохода 1,15 м — проход открыт (180759.jpg)
    const P = FOYER.zones.passage;
    expect(vb.min.x).toBeCloseTo(P.x1, 2);
    // верх полотна — высота трубы над X = −4,79 (линейно 3,00 у xTop → 1,75 у xBot)
    const U = FOYER.stairs.upper;
    const yPipe = FOYER.curtain.topY + (FOYER.stairs.landingY - FOYER.curtain.topY) * (P.x1 - U.xTop) / (U.xBot - U.xTop);
    expect(vb.max.y).toBeCloseTo(yPipe, 2);
  });

  it('mobile бюджет треугольников interior + curtain < 25 000 и меньше desktop', () => {
    const run = (mobile) => {
      const b = new StaticBatch();
      const M = fakeM();
      buildInterior(b, M, { mobile });
      buildCurtain(b, M, { mobile });
      const L = b.build();
      return Object.values(L).reduce((s, g) => s + triCount(g), 0);
    };
    const deskTris = run(false);
    const mobTris = run(true);
    expect(mobTris).toBeLessThan(25_000);
    expect(mobTris).toBeLessThan(deskTris);
  });
});

describe('Фойе · дежурный свет (emitters.js и ambient.js)', () => {
  it('buildEmitters: светящиеся меши — прямые потомки groups.duty с emitter="duty", house пуста', () => {
    const em = buildEmitters(fakeM());
    const D = FOYER.duty;
    const expectedCount = D.downlights1f.length + D.downlights2f.length + D.sconces.length + D.pendants.length;

    expect(em.groups.duty).toBeInstanceOf(THREE.Group);
    expect(em.groups.house).toBeInstanceOf(THREE.Group);
    expect(em.groups.house.children).toHaveLength(0);
    expect(em.dutyPoints).toHaveLength(expectedCount);

    const glow = em.groups.duty.children.filter((c) => c.userData.emitter === 'duty');
    expect(glow.length).toBeGreaterThan(0);
    for (const m of glow) {
      expect(m.material.name).toBe('dutyBulb');
      expect(m.geometry.attributes.position.count).toBeGreaterThan(0);
    }
    // Ни одного глубоко вложенного эмиттера
    let deep = 0;
    em.groups.duty.traverse((o) => {
      if (o.userData.emitter && o.parent !== em.groups.duty) deep++;
    });
    expect(deep).toBe(0);

    // Несветящиеся корпуса/ободки/подвесы — статика в слое duty
    const statics = em.groups.duty.children.filter((c) => !c.userData.emitter);
    expect(statics.length).toBeGreaterThan(0);
    for (const s of statics) {
      expect(s.userData.static).toBe(true);
      expect(s.userData.layer).toBe('duty');
      expect(s.geometry.attributes.position.count).toBeGreaterThan(0);
    }

    // Проверка высот потолочных светильников 2-го этажа по foyerCeilY(d)
    const offset2f = D.downlights1f.length;
    D.downlights2f.forEach((p, idx) => {
      const pt = em.dutyPoints[offset2f + idx];
      expect(pt.y).toBeCloseTo(foyerCeilY(p.d), 1);
    });
  });

  it('ambientLights: full даёт 7 источников (+ юг 1-го этажа у гардероба, C5), lite даёт 2 источника', () => {
    const em = buildEmitters(fakeM());
    const full = ambientLights('full', em);
    const lite = ambientLights('lite', em);

    expect(full.blue).toEqual([]);
    expect(full.house).toEqual([]);
    expect(full.duty).toHaveLength(7);
    const s = FOYER.ambient.duty.south1f;
    expect(s).toEqual({ x: 8.20, d: 2.80 });
    expect(full.duty.some((l) => Math.abs(l.position.x - s.x) < 1e-6 && Math.abs(-l.position.z - s.d) < 1e-6 && l.position.y < FOYER.ceil1.reception)).toBe(true);
    expect(full.duty.every((l) => l.isPointLight && l.intensity === 0 && l.userData.base === FOYER.ambient.duty.full)).toBe(true);
    expect(full.duty.some((l) => l.position.y < FOYER.room.y2)).toBe(true);
    expect(full.duty.some((l) => l.position.y > FOYER.room.y2)).toBe(true);

    expect(lite.blue).toEqual([]);
    expect(lite.house).toEqual([]);
    expect(lite.duty).toHaveLength(2);
    expect(lite.duty.every((l) => l.isPointLight && l.intensity === 0 && l.userData.base === FOYER.ambient.duty.lite)).toBe(true);
    expect(lite.duty.some((l) => l.position.y < FOYER.room.y2)).toBe(true);
    expect(lite.duty.some((l) => l.position.y > FOYER.room.y2)).toBe(true);
  });
});

describe('Фойе · оверлеи размеров и сетки (overlays.js)', () => {
  it('dimList содержит ключевые габариты (23,49; 21,02; 8,34) и высоты (3; 6,37; 7,45; 8,5; 9,2)', () => {
    const list = dimList();
    const texts = list.map((d) => d[2]).join(' | ');
    for (const token of ['23,49', '21,02', '8,34', '3 м', '6,37', '7,45', '8,5', '9,2']) {
      expect(texts, `размер ${token}`).toContain(token);
    }
    const lbl = fakeLabels();
    const dims = buildDims(lbl);
    expect(dims.name).toBe('dims');
    expect(dims.userData.axes.x).toBeTruthy();
    expect(dims.userData.axes.y).toBeTruthy();
    expect(dims.userData.axes.d).toBeTruthy();
  });

  it('buildGrid строит метровую сетку, красные оси, подпись нулевой линии и метки ФВ-1..4', () => {
    const lbl = fakeLabels();
    const grid = buildGrid(lbl);
    expect(grid.name).toBe('grid');
    expect(grid.userData.xLabels).toBeTruthy();
    const texts = lbl.made.map((m) => m.text);
    expect(texts).toContain(FOYER.zeroLineLabel);
    for (const id of ['ФВ-1', 'ФВ-2', 'ФВ-2М', 'ФВ-3', 'ФВ-4']) {
      expect(texts.some((t) => t.includes(id)), `метка ${id}`).toBe(true);
    }
  });
});
