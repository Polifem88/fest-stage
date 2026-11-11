import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DIM, BOX_HALF, GALLERY_INNER_X, BACK_GALLERY_FRONT_D, LEFT_GALLERY, B2_SHAFT, pitEdgeX, inPit, gateNiche, doorNiche } from '../../src/venues/fest-big/config/dimensions.js';
import { RIGGING, SPACING, DEPTHS, LEFT_RAIL_ORDER, RIG_BY_ID, ropeDepth, DUTY_ROWS, counterweightX, ropeX, rightFrontRailX } from '../../src/venues/fest-big/config/rigging.js';
import { FIXTURES, TYPES, GROUPS, INVENTORY, countByType, PORTABLE, portablePlacement, SPECS } from '../../src/venues/fest-big/config/fixtures.js';
import { buildArchitecture } from '../../src/venues/fest-big/build/architecture.js';
import { RiggingSystem } from '../../src/venues/fest-big/build/rigging.js';
import { traceToFloor } from '../../src/venues/fest-big/build/floor.js';
import { StaticBatch } from '../../src/core/geom.js';

describe('Паспорта приборов', () => {
  it('у каждого типа прибора есть паспортные данные с источником', () => {
    for (const t of Object.keys(TYPES)) {
      expect(SPECS[t], `нет паспорта для ${t}`).toBeTruthy();
      expect(SPECS[t].url, `нет ссылки на источник для ${t}`).toMatch(/^https:\/\//);
    }
  });
});

describe('Размеры и глубины', () => {
  it('сумма расстояний + галерея + портал + авансцена = 12 м (±5 см)', () => {
    const chain = SPACING.reduce((s, [, , g]) => s + g, 0);
    const total = DIM.forestage.depth + DIM.portal.thickness + chain + DIM.galleries.width;
    // по исходным цифрам выходит 11.95 — 5 см «недостачи», это в пределах допуска
    expect(Math.abs(total - 12)).toBeLessThanOrEqual(0.051);
  });

  it('задняя стена совпадает с цепочкой расстояний', () => {
    expect(DEPTHS.Rail + DIM.galleries.width).toBeCloseTo(DIM.box.backWallD, 2);
    expect(DEPTHS.Rail).toBeCloseTo(BACK_GALLERY_FRONT_D, 2);
  });

  it('ригель на 6.65 и выступает от потолка на 1.85 м', () => {
    expect(DIM.box.ceiling - DIM.rigel.bottomY).toBeCloseTo(1.85, 5);
    expect(DEPTHS.Rigel).toBeCloseTo(DIM.rigel.d, 3);
  });

  it('объекты идут строго спереди назад в нужном порядке', () => {
    const order = ['C0', 'Sh0', 'Z', 'Sh1', 'Sh2', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'Sh12'];
    const ds = order.map((id) => RIG_BY_ID[id].d);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });

  it('двойные двери у портала заданы по размерам 2.2×2.0 м и примыкают к порталу (d = 0)', () => {
    const pd = DIM.openings.portalDoors;
    expect(pd).toBeTruthy();
    expect(pd.width).toBe(2.2);
    expect(pd.height).toBe(2.0);
    expect(pd.fromD).toBe(0.0);
  });
});

describe('Механика', () => {
  it('исходное положение в пределах хода', () => {
    for (const r of RIGGING) {
      expect(r.rest, r.id).toBeGreaterThanOrEqual(r.min);
      expect(r.rest, r.id).toBeLessThanOrEqual(r.max);
    }
  });

  it('ничего не выше потолка; за ригелем штанкеты не выше его низа на своём месте', () => {
    for (const r of RIGGING) expect(r.max, r.id).toBeLessThan(DIM.box.ceiling);
  });

  it('концы обычных штанкет не заходят на галереи; боковые — между концами и перилами', () => {
    expect(DIM.pipe.length / 2).toBeLessThan(Math.abs(LEFT_GALLERY.x1));
    expect(DIM.pipe.length / 2).toBeLessThan(GALLERY_INNER_X);
    expect(Math.abs(RIG_BY_ID.B1.x)).toBeGreaterThan(DIM.pipe.length / 2);
    expect(Math.abs(RIG_BY_ID.B1.x)).toBeLessThan(Math.abs(LEFT_GALLERY.x1));
    expect(RIG_BY_ID.B2.x).toBeGreaterThan(DIM.pipe.length / 2);
    expect(RIG_BY_ID.B2.x).toBeLessThan(GALLERY_INNER_X);
  });

  it('Б2 короче Б1 и не заходит на площадку узла подъёма', () => {
    const b1 = RIG_BY_ID.B1, b2 = RIG_BY_ID.B2;
    expect(b2.dTo - b2.dFrom).toBeLessThan(b1.dTo - b1.dFrom);
    expect(b2.dTo).toBeLessThan(DIM.box.backWallD - DIM.liftNode.padSize);
  });

  it('порядок канатов на левой стене совпадает с уточнённым', () => {
    expect(LEFT_RAIL_ORDER).toEqual(['Sh2', 'Sh0', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'B1', 'Sh12']);
    const ds = LEFT_RAIL_ORDER.map(ropeDepth);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });

  it('линии дежурного света между нужными объектами', () => {
    expect(DUTY_ROWS[0].d).toBeGreaterThan(DEPTHS.Sh3);
    expect(DUTY_ROWS[0].d).toBeLessThan(DEPTHS.Sh4);
    expect(DUTY_ROWS[1].d).toBeGreaterThan(DEPTHS.Sh8);
    expect(DUTY_ROWS[1].d).toBeLessThan(DEPTHS.C3);
    expect(DUTY_ROWS[2].d).toBeGreaterThan(DEPTHS.Sh11);
    expect(DUTY_ROWS[2].d).toBeLessThan(DEPTHS.Sh12);
  });
});

describe('Приборы', () => {
  it('номера уникальны', () => {
    const nos = FIXTURES.map((f) => String(f.no));
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('количество на софитах как на схеме', () => {
    const c = (g) => FIXTURES.filter((f) => f.group === g).length;
    expect(c('C0')).toBe(13);
    expect(c('C1')).toBe(17);
    expect(c('C2')).toBe(11);
    expect(c('C3')).toBe(11);
  });

  it('расстановка сходится с перечнем светового цеха', () => {
    // софиты и прострелы — точно
    for (const g of ['C0', 'C1', 'C2', 'C3']) expect(countByType([g]), g).toEqual(INVENTORY[g]);
    for (const g of ['TOW_L', 'TOW_R']) expect(countByType([g]), g).toEqual(INVENTORY.towerEach);
    // ложи — полностью как в перечне (BroPar — без номера на схеме)
    const boxes = INVENTORY.boxesEachSide;
    expect(countByType(['BOX_L1', 'BOX_L2']), 'левые ложи').toEqual(boxes);
    expect(countByType(['BOX_R1', 'BOX_R2']), 'правые ложи').toEqual(boxes);
    // RGBALC — по одному в каждой ложе
    for (const g of ['BOX_L1', 'BOX_L2', 'BOX_R1', 'BOX_R2']) expect(countByType([g]).PROF_RGB, g).toBe(1);
    // мосты: Fresnel и Profile — как в перечне; два ETC 26° (107 — 19° со сменной линзой 14/26) + Jr 50° (по завцеху)
    const br = countByType(['BR1', 'BR2']);
    expect(br.FRESNEL).toBe(INVENTORY.bridges.FRESNEL);
    expect(br.PROF_CW).toBe(INVENTORY.bridges.PROF_CW);
    expect((br.ETC26 || 0) + (br.ETC19 || 0)).toBe(INVENTORY.bridges.ETC26);
    expect(br.ETCJR50).toBe(1);
    // галереи: на задней 2 ETC 26°; на боковых 12 мест = ещё 4 ETC 26° + 8 PAR-64 (какие где — уточняется)
    expect(countByType(['GAL_B'])).toEqual({ ETC26: 2 });
    expect(countByType(['GAL_L', 'GAL_R'])).toEqual({ GAL_LAMP: 12 });
    expect(INVENTORY.galleries.ETC26 - 2 + INVENTORY.galleries.PAR64).toBe(12);
  });

  it('прострелы (sideTowers) и их приборы перенесены на серую часть стены (Y = 2.2..5.2 м)', () => {
    const woodTopY = -DIM.forestage.height + 2.6; // 1.85 м — граница деревянной обшивки
    for (const [key, t] of Object.entries(DIM.hallRig.sideTowers)) {
      expect(t.y, `низ стойки ${key}`).toBeGreaterThan(woodTopY);
      expect(t.y, `низ стойки ${key}`).toBe(2.2);
      expect(t.h, `высота стойки ${key}`).toBe(3.0);
      expect(t.y + t.h, `верх стойки ${key}`).toBeLessThan(DIM.decoCeilingY);
    }
    const byNo = Object.fromEntries(FIXTURES.map((f) => [String(f.no), f]));
    // Левый прострел: #26 (Profile), #139 (PAR), #28 (Wash)
    // Правый прострел: #27 (Profile), #140 (PAR), #29 (Wash)
    expect(byNo['26'].mount.y).toBeCloseTo(4.8, 2);
    expect(byNo['27'].mount.y).toBeCloseTo(4.8, 2);
    expect(byNo['139'].mount.y).toBeCloseTo(3.6, 2);
    expect(byNo['140'].mount.y).toBeCloseTo(3.6, 2);
    expect(byNo['28'].mount.y).toBeCloseTo(2.4, 2);
    expect(byNo['29'].mount.y).toBeCloseTo(2.4, 2);
    // Все 6 приборов строго выше деревянной обшивки (1.85 м) и выше проёма двери (-0.75 + 2.0 = 1.25 м)
    for (const no of ['26', '27', '139', '140', '28', '29']) {
      expect(byNo[no].mount.y).toBeGreaterThan(woodTopY);
      expect(byNo[no].mount.y).toBeGreaterThan(-DIM.forestage.height + DIM.openings.portalDoors.height);
    }
  });

  it('ламповые приборы — это ровно трёхзначные номера (= диммерные линии)', () => {
    for (const f of FIXTURES) {
      if (f.group === 'FOH' || f.portable) continue;
      expect(!!TYPES[f.type].lamp, String(f.no)).toBe(Number(f.no) >= 100);
    }
  });

  it('у каждого прибора есть тип и группа', () => {
    for (const f of FIXTURES) {
      expect(TYPES[f.type], String(f.no)).toBeTruthy();
      expect(GROUPS[f.group], String(f.no)).toBeTruthy();
    }
  });

  it('все приборы внутри здания', () => {
    for (const f of FIXTURES) {
      expect(Math.abs(f.mount.x), String(f.no)).toBeLessThanOrEqual(DIM.hall.width / 2);
      if (!f.mount.on) expect(f.mount.y, String(f.no)).toBeLessThan(DIM.box.ceiling);
    }
  });

  it('переносные ETC 50°: в конце списка, видно ровно выбранное число, стоят на сцене у кулис', () => {
    const port = FIXTURES.filter((f) => f.portable);
    expect(port.length).toBe(PORTABLE.max);
    expect(FIXTURES.slice(-PORTABLE.max).every((f) => f.portable)).toBe(true); // не сбивает старые ссылки
    for (const mode of ['floor', 'stand']) {
      for (const count of PORTABLE.counts) {
        const pl = port.map((f) => portablePlacement(f.portable.side, f.portable.k, mode, count));
        expect(pl.filter((p) => p.visible).length, `${mode} ${count}`).toBe(count);
        for (const p of pl.filter((q) => q.visible)) {
          expect(Math.abs(p.mount.x)).toBeLessThan(Math.abs(LEFT_GALLERY.x1));
          expect(p.mount.d).toBeGreaterThan(DIM.portal.thickness);
          expect(p.mount.d).toBeLessThan(DIM.box.backWallD - 1);
          expect(Math.sign(p.aim.x)).toBe(-Math.sign(p.mount.x)); // светят поперёк сцены
        }
      }
    }
    expect(port.map((f) => portablePlacement(f.portable.side, f.portable.k, 'off', 8)).some((p) => p.visible)).toBe(false);
  });
});

const fakeM = () => new Proxy({}, { get: (t, p) => (t[p] ||= new THREE.MeshStandardMaterial({ name: String(p) })) });

describe('Патч 1 · раздел 1', () => {
  it('трубы Ш и С — 13,5 м, дорога — 15 м', () => {
    expect(DIM.pipe.length).toBe(13.5);
    expect(DIM.pipe.trackLength).toBe(15.0);
  });

  it('левая галерея в 0,65 от стены, ширина 0,9', () => {
    expect(LEFT_GALLERY.x0).toBeCloseTo(-7.85, 6);
    expect(LEFT_GALLERY.x1).toBeCloseTo(-6.95, 6);
    expect(GALLERY_INNER_X).toBeCloseTo(7.6, 6);
  });

  it('Б1 = −6,80 (0,15 от левой галереи), Б2 = +7,10', () => {
    expect(RIG_BY_ID.B1.x).toBeCloseTo(-6.80, 6);
    expect(RIG_BY_ID.B2.x).toBeCloseTo(7.10, 6);
  });

  it('пределы хода по ТЗ', () => {
    const want = { B1: [6.2, 6.2], B2: [6.2, 6.2], Sh2: [6.7, 6.7], Sh3: [6.7, 6.7], Sh4: [6.7, 6.7], Sh5: [6.7, 6.7], Sh6: [6.7, 6.7] };
    for (const [id, [max, rest]] of Object.entries(want)) {
      expect(RIG_BY_ID[id].max, id).toBe(max);
      expect(RIG_BY_ID[id].rest, id).toBe(rest);
    }
    expect(RIG_BY_ID.Z.min).toBe(2);
    expect(RIG_BY_ID.Z.rest).toBe(6);
  });

  it('ригель: низ 6,65', () => expect(DIM.rigel.bottomY).toBe(6.65));

  it('площадка узла подъёма 1,85 и ось вертикальной лестницы 8,0', () => {
    expect(DIM.liftNode.padSize).toBe(1.85);
    expect(DIM.liftNode.vertLadder.d).toBe(8.0);
  });

  it('тяжи левой галереи — не ближе 0,15 к осям канатов, не ближе 0,20 к приборам GAL_L и вне ригеля', () => {
    expect(DIM.galleries.leftHangersAssumption).toBe(true);
    expect(DIM.galleries.upperStairLen).toBe(0.8);
    expect(DIM.galleries.leftHangersD).toEqual([2.35, 4.40, 6.10, 7.00]);
    const ropes = RIGGING.filter((r) => r.control === 'left').map((r) => ropeDepth(r.id));
    const galL = FIXTURES.filter((f) => f.group === 'GAL_L');
    for (const d of DIM.galleries.leftHangersD) {
      for (const rd of ropes) expect(Math.abs(d - rd), `тяж ${d} у каната ${rd}`).toBeGreaterThanOrEqual(0.15);
      for (const f of galL) expect(+Math.abs(d - f.mount.d).toFixed(6), `тяж ${d} у прибора № ${f.no}`).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(d - DIM.rigel.d)).toBeGreaterThan(DIM.rigel.width / 2 + 0.1);
      expect(d).toBeGreaterThan(DIM.galleries.frontToD + DIM.galleries.upperStairLen); // за лесенкой 6,2→5,7
      expect(d).toBeLessThan(BACK_GALLERY_FRONT_D);
    }
  });

  it('приборы левой галереи 187–192 снаружи перил на x = −6,85', () => {
    const galL = FIXTURES.filter((f) => f.group === 'GAL_L');
    expect(galL.length).toBe(6);
    for (const f of galL) expect(f.mount.x, String(f.no)).toBeCloseTo(-6.85, 6);
  });

  it('старая высота Б1/Б2 = 6,5 обрезается до нового максимума 6,2', () => {
    const rs = new RiggingSystem(fakeM(), {});
    rs.setHeight('B1', 6.5);
    rs.setHeight('B2', 6.5);
    expect(rs.height('B1')).toBe(6.2);
    expect(rs.height('B2')).toBe(6.2);
  });
});

describe('Патч 1 · раздел 2', () => {
  it('приямок — трапеция 0,5 → 1,0 на d 1,35…4,75, глубина 0,85', () => {
    expect(pitEdgeX(1.35)).toBeCloseTo(8.0, 6);
    expect(pitEdgeX(4.75)).toBeCloseTo(7.5, 6);
    expect(DIM.pit.depth).toBe(0.85);
    expect(DIM.pit.stepsAssumption).toBe(true);
    expect(inPit(8.2, 3.0)).toBe(true);
    expect(inPit(7.7, 2.0)).toBe(false); // был в старом прямоугольнике, вне трапеции
    expect(inPit(8.2, 1.2)).toBe(false); // под выступом стены
  });

  it('выступ стены 0,5 × 1,1 от портала до приямка, верх под галереей', () => {
    const p = DIM.wallPier;
    expect(BOX_HALF - p.x0).toBeCloseTo(0.5, 6);
    expect(p.toD - p.fromD).toBeCloseTo(1.1, 6);
    expect(p.toD).toBe(DIM.pit.fromD);
    expect(p.topY).toBeLessThan(DIM.galleries.upperY);
  });

  it('решётка не содержит устаревших ключей прямоугольника', () => {
    expect(DIM.rack.fromD).toBeUndefined();
    expect(DIM.rack.toD).toBeUndefined();
    expect(DIM.rack.depthX).toBeUndefined();
    expect(DIM.rack.height).toBeUndefined();
    expect(DIM.rack.ladderD).toBeUndefined();
    expect(DIM.rack.topY).toBe(DIM.wallPier.topY);
  });

  it('узел Ш1/С0/З: перила 0,50 м от выступа стены (x = 7,50), канаты вплотную изнутри (7,54) вне фермы З', () => {
    expect(rightFrontRailX()).toBeCloseTo(7.5, 6);
    expect(DIM.wallPier.x0 - rightFrontRailX()).toBeCloseTo(0.5, 6);
    for (const id of ['Z', 'C0', 'Sh1']) {
      expect(counterweightX(RIG_BY_ID[id])).toBeCloseTo(7.86, 6);
      expect(ropeX(RIG_BY_ID[id])).toBeCloseTo(7.54, 6);
    }
    expect(ropeX(RIG_BY_ID.Z) - DIM.pipe.trackLength / 2).toBeGreaterThan(0.03);
    expect(ropeX(RIG_BY_ID.Z) - rightFrontRailX()).toBeCloseTo(0.04, 6);
    expect(counterweightX(RIG_BY_ID.Sh2)).toBeCloseTo(-8.36, 6); // левая стена — как было
    expect(counterweightX(RIG_BY_ID.B2)).toBeCloseTo(8.36, 6);  // каретка Б2 у правой стены
    expect(DIM.wallPier.x0 - (counterweightX(RIG_BY_ID.Z) + 0.05)).toBeGreaterThan(0); // каретка не в выступе
  });

  it('боковая дверь — за выступом, в стенке приямка', () => {
    const sd = DIM.openings.sideDoor;
    expect(sd.fromD).toBeGreaterThanOrEqual(DIM.wallPier.toD);
    expect(sd.fromD + sd.width).toBeLessThan(DIM.pit.toD - (DIM.pit.steps - 1) * DIM.pit.tread);
  });

  it('луч вниз: в трапеции — на дно, рядом снаружи — на планшет', () => {
    const down = new THREE.Vector3(0, -1, 0);
    expect(traceToFloor(new THREE.Vector3(8.2, 5, -3.0), down).point.y).toBeCloseTo(-0.85, 6);
    expect(traceToFloor(new THREE.Vector3(7.7, 5, -2.0), down).point.y).toBeCloseTo(0, 6);
  });
});

describe('Патч 1 · раздел 3', () => {
  it('ниша ворот 2,95 × 1,1 в 2,4 от правой стены; высоты сходятся; без assumption', () => {
    const g = gateNiche(), o = DIM.openings.gate;
    expect(o.assumption).toBeUndefined();
    expect(o.centerX).toBeUndefined();
    expect(g.x1).toBeCloseTo(BOX_HALF - 2.4, 6);
    expect(g.x0).toBeCloseTo(3.15, 6);
    expect(g.d1 - g.d0).toBeCloseTo(1.1, 6);
    expect(g.d0).toBe(DIM.box.backWallD);
    expect(g.ceilY).toBe(2.4);
    expect(g.floorDrop).toBeCloseTo(0.35, 6);
    expect(o.height + o.guideH).toBeCloseTo(o.heightAtGate, 6);
  });

  it('ниша двери 0,95 × 1,1 в 3,6 от левой стены; над дверью 0,25; без assumption', () => {
    const n = doorNiche(), o = DIM.openings.backDoor;
    expect(o.assumption).toBeUndefined();
    expect(o.centerX).toBeUndefined();
    expect(n.x0).toBeCloseTo(-4.9, 6);
    expect(n.x1).toBeCloseTo(-3.95, 6);
    expect(n.d1 - n.d0).toBeCloseTo(1.1, 6);
    expect(n.ceilY).toBe(1.9);
    expect(n.floorDrop).toBeCloseTo(0.35, 6);
    expect(o.heightAtDoor - o.height).toBeCloseTo(0.25, 6);
  });

  it('галерея над воротами: подъём ровно над нишей, обшивка выше проёма', () => {
    const g = gateNiche();
    expect(DIM.galleries.fasciaDrop).toBe(0.35);
    expect(DIM.galleries.gateStairW).toBe(0.6);
    expect(DIM.galleries.overGateY - DIM.galleries.fasciaDrop).toBeGreaterThan(g.ceilY);
    expect(g.x1).toBeLessThan(BOX_HALF - DIM.liftNode.padSize);
  });
});

describe('Угловая шахта Б2, проём вертикальной лестницы и расширенный узел Ш1/С0/З', () => {
  function builtStageStatic() {
    const M = fakeM();
    M.mesh.alphaMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const batch = new StaticBatch();
    buildArchitecture(batch, M);
    const rs = new RiggingSystem(M, { ropes: true });
    rs.buildStatic(batch);
    const layers = batch.build();
    for (const grp of Object.values(layers)) grp.updateMatrixWorld(true);
    return { layers, rs };
  }

  it('узел Б2 перемещён в правый задний угол 0,5 × 0,5 м (x = 8,00…8,50, d = 8,70…9,20)', () => {
    expect(B2_SHAFT).toEqual({ x0: 8.0, x1: 8.5, d0: 8.7, d1: 9.2 });
    expect(ropeDepth('B2')).toBeCloseTo(8.95, 6);
    expect(counterweightX(RIG_BY_ID.B2)).toBeCloseTo(8.36, 6);
    expect(ropeX(RIG_BY_ID.B2)).toBeGreaterThan(B2_SHAFT.x0 + 0.03);
    expect(ropeX(RIG_BY_ID.B2)).toBeLessThan(counterweightX(RIG_BY_ID.B2) - 0.1);
  });

  it('в углах нижней площадки (2,20) и верхней галереи (5,70) вырезаны отверстия 0,5 × 0,5 м, а на верхней галерее стоят перила', () => {
    const { layers } = builtStageStatic();
    const gal = layers.galleries;
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const hitYs = (x, d) => {
      rc.set(new THREE.Vector3(x, 7.2, -d), down);
      return rc.intersectObject(gal, true).map((h) => h.point.y);
    };

    // Внутри отверстия 0,5 × 0,5 (x = 8.25, d = 8.95) настила нет ни на 5.70, ни на 2.20
    expect(hitYs(8.25, 8.95)).toEqual([]);

    // Сразу снаружи отверстия по X (x = 7.80, d = 8.95) и по d (x = 8.25, d = 8.50) присутствуют оба настила
    for (const [x, d] of [[7.8, 8.95], [8.25, 8.5]]) {
      const ys = hitYs(x, d);
      expect(ys.some((y) => Math.abs(y - DIM.galleries.upperY) < 0.02), `верхняя галерея в (${x}, ${d})`).toBe(true);
      expect(ys.some((y) => Math.abs(y - DIM.liftNode.padY) < 0.02), `нижняя площадка в (${x}, ${d})`).toBe(true);
    }

    // На верхней галерее вокруг отверстия 0,5 × 0,5 стоят перила (верхний поручень ~6.70) по обеим открытым сторонам
    const railHitX = new THREE.Raycaster(new THREE.Vector3(7.7, 6.7, -8.95), new THREE.Vector3(1, 0, 0), 0, 0.6).intersectObject(gal, true);
    const railHitD = new THREE.Raycaster(new THREE.Vector3(8.25, 6.7, -8.4), new THREE.Vector3(0, 0, -1), 0, 0.6).intersectObject(gal, true);
    expect(railHitX.length, 'перила верхней галереи вдоль d на x = 8,00').toBeGreaterThan(0);
    expect(railHitD.length, 'перила верхней галереи вдоль X на d = 8,70').toBeGreaterThan(0);
  });

  it('шахта Б2 закрыта сеткой-рабицей с обеих открытых сторон от нижней площадки (2,20) до низа настила верхней галереи (5,64), а снизу — поручни 0,5 × 0,5 м', () => {
    const { layers } = builtStageStatic();
    const meshObj = layers.rigging.children.find((o) => o.material?.name === 'mesh');
    expect(meshObj).toBeTruthy();
    const pos = meshObj.geometry.attributes.position;
    const nor = meshObj.geometry.attributes.normal;

    let minY = Infinity, maxY = -Infinity;
    let hasFaceX = false, hasFaceD = false;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), d = -pos.getZ(i);
      if (x > 7.5 && d > 8.5) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        if (Math.abs(x - B2_SHAFT.x0) < 0.01 && Math.abs(nor.getX(i)) > 0.9) hasFaceX = true;
        if (Math.abs(d - B2_SHAFT.d0) < 0.01 && Math.abs(nor.getZ(i)) > 0.9) hasFaceD = true;
      }
    }
    expect(hasFaceX, 'сетка вдоль оси d на x = 8,00').toBe(true);
    expect(hasFaceD, 'сетка вдоль оси X на d = 8,70').toBe(true);
    expect(minY).toBeCloseTo(DIM.liftNode.padY, 3);
    expect(maxY).toBeCloseTo(DIM.galleries.upperY - 0.06, 3);

    // Поручни-защита 0,5 × 0,5 м снизу на высоте 1,0 м с обеих сторон угла Б2, и старого ограждения на d = 7,70 больше нет
    const steelObj = layers.rigging.children.find((o) => o.material?.name === 'steel');
    const guardX = new THREE.Raycaster(new THREE.Vector3(7.7, 1.0, -8.95), new THREE.Vector3(1, 0, 0), 0, 0.6).intersectObject(steelObj, true);
    const guardD = new THREE.Raycaster(new THREE.Vector3(8.25, 1.0, -8.4), new THREE.Vector3(0, 0, -1), 0, 0.6).intersectObject(steelObj, true);
    const oldGuard = new THREE.Raycaster(new THREE.Vector3(7.5, 1.0, -7.7), new THREE.Vector3(1, 0, 0), 0, 1.0).intersectObject(steelObj, true);
    expect(guardX.length, 'нижний поручень Б2 на x = 8,00').toBeGreaterThan(0);
    expect(guardD.length, 'нижний поручень Б2 на d = 8,70').toBeGreaterThan(0);
    expect(oldGuard.length, 'старое ограждение Б2 на d = 7,70 убрано').toBe(0);
  });

  it('проём в перилах верхней галереи у вертикальной лестницы перенесён на x = 6,60…7,30 м (левый край вровень с лестницей)', () => {
    const { layers } = builtStageStatic();
    const gal = layers.galleries;
    const hitBackRailAt = (x) => new THREE.Raycaster(
      new THREE.Vector3(x, 6.7, -8.0),
      new THREE.Vector3(0, 0, -1),
      0,
      0.6,
    ).intersectObject(gal, true).length > 0;

    // Слева от лестницы (x = 6,42 — раньше был пустой проём) теперь идут сплошные перила до 6,60
    expect(hitBackRailAt(6.42)).toBe(true);
    // В новом проёме правее лестницы (x = 6,75 и 7,15) перил нет
    expect(hitBackRailAt(6.75)).toBe(false);
    expect(hitBackRailAt(7.15)).toBe(false);
    // Правее проёма (x = 7,45, между 7,30 и 7,60) перила снова есть
    expect(hitBackRailAt(7.45)).toBe(true);
  });

  it('нижние перила узла Ш1/С0/З стоят на x = 7,50 м и соединены с выступом стены 8,00 м поперечинами 0,50 м', () => {
    const { layers } = builtStageStatic();
    const steelObj = layers.rigging.children.find((o) => o.material?.name === 'steel');
    const hits = new THREE.Raycaster(
      new THREE.Vector3(7.2, 1.0, -0.7),
      new THREE.Vector3(1, 0, 0),
      0,
      0.6,
    ).intersectObject(steelObj, true);
    expect(hits.length).toBeGreaterThan(0);
    // Наружная поверхность трубы (r = 0.03) с осью x = 7.50 находится около 7.47
    expect(hits[0].point.x).toBeCloseTo(7.5 - 0.03, 2);
  });
});
