import { describe, it, expect } from 'vitest';
import chamber from '../../src/venues/fest-chamber/index.js';
import {
  CHAMBER, ALL_TRUSSES, TRUSS_BY_ID, trussChordsAt, trussTopY,
  hangerXsFor, rowFloorY, rowFrontD, chamberSeatLayout,
} from '../../src/venues/fest-chamber/config/dimensions.js';
import { FIXTURES, INVENTORY, countByType } from '../../src/venues/fest-chamber/config/fixtures.js';
import { validateVenue } from '../../src/venues/contract.js';
import { TYPES } from '../../src/library/fixtureTypes.js';
import { SPECS } from '../../src/library/specs.js';

const R = CHAMBER.room, T = CHAMBER.trusses, S = CHAMBER.stage, H = CHAMBER.hall;

describe('Камерная сцена: контракт и паспорт', () => {
  it('validateVenue без ошибок', () => {
    expect(validateVenue(chamber)).toEqual([]);
  });
  it('готовая площадка без подвижной механики и переносных приборов, 102 места, полный набор экспортов', () => {
    expect(chamber.status).toBe('ready');
    expect(chamber.rigging).toBeNull();
    expect(chamber.caps.rigging).toBe(false);
    expect(chamber.caps.counterweights).toBe(false);
    expect(chamber.caps.portable).toBe(false);
    expect(chamber.caps.duty).toBe(true);
    expect(chamber.caps.houseLight).toBe(true);
    expect(chamber.fixtures.portable).toBeNull();
    expect(chamber.meta).toMatchObject({ type: 'Аудитория с фиксированным амфитеатром', seats: 102 });
    expect(typeof chamber.exports.planDXF).toBe('function');
    expect(typeof chamber.exports.sectionDXF).toBe('function');
    expect(typeof chamber.exports.dxf3d).toBe('function');
    expect(typeof chamber.exports.glb).toBe('function');
  });
  it('все виды на месте, ортогональные вмещают зал и сцену', () => {
    expect(Object.keys(chamber.views)).toEqual(
      expect.arrayContaining(['overview', 'hall', 'booth', 'stageToHall', 'trusses', 'pocket', 'plan', 'section']),
    );
    expect(chamber.views.plan.height).toBeGreaterThan(R.d1 - R.d0);
    expect(chamber.views.section.height).toBeGreaterThan(R.ceiling);
  });
});

describe('Камерная сцена: геометрия зала, сцены и 12 ферм', () => {
  it('общая глубина 16,40 м (зал 6,65 м + сцена 9,75 м), потолок 4,40 м', () => {
    expect(R.d1 - R.d0).toBeCloseTo(16.40, 6);
    expect(-H.backWallD).toBeCloseTo(6.65, 6);
    expect(S.d1 - S.d0).toBeCloseTo(9.75, 6);
    expect(R.ceiling).toBe(4.40);
  });
  it('ширина зала 11,70 м, ширина сцены с левым карманом 14,00 м, просвет колонн 11,275 м', () => {
    expect(H.x1 - H.x0).toBeCloseTo(11.70, 6);
    expect(S.x1 - S.x0).toBeCloseTo(14.00, 6);
    expect(S.portalWidth).toBeCloseTo(11.275, 6);
  });
  it('12 ферм (9 сценических Ф1–Ф9 + 3 зальных ЗФ1–ЗФ3), все внутри помещения', () => {
    expect(ALL_TRUSSES).toHaveLength(12);
    expect(T.stage).toHaveLength(9);
    expect(T.hall).toHaveLength(3);
    for (const tr of ALL_TRUSSES) {
      expect(tr.x0).toBeGreaterThan(R.x0);
      expect(tr.x1).toBeLessThan(R.x1);
      const c = trussChordsAt(tr.d, CHAMBER);
      for (const [, dd] of [...c.bottom, ...c.top]) {
        expect(dd).toBeGreaterThan(R.d0);
        expect(dd).toBeLessThan(R.d1);
      }
    }
    expect(trussTopY(CHAMBER)).toBeLessThan(R.ceiling);
  });
  it('треугольное сечение 20 см из трубы 32 мм вершиной вверх: низ ферм Y = +3,75 м, низ ригелей Y = +3,60 м', () => {
    expect(T.side).toBe(0.20);
    expect(T.tube).toBe(0.032);
    expect(T.bottomY).toBe(3.75);
    expect(CHAMBER.rigels.bottomY).toBe(3.60);
    const cStage = trussChordsAt(TRUSS_BY_ID.F1.d, CHAMBER);
    expect(cStage.bottom).toHaveLength(2);
    expect(cStage.top).toHaveLength(1);
    for (const [y] of cStage.bottom) expect(y).toBe(3.75);
    expect(cStage.top[0][0]).toBeCloseTo(3.75 + 0.1732, 4);
    expect(cStage.bottom[1][1] - cStage.bottom[0][1]).toBeCloseTo(0.20, 6);
  });
  it('жёсткие подвесы к потолку не реже чем через 3 м на каждой ферме', () => {
    for (const tr of ALL_TRUSSES) {
      const xs = hangerXsFor(tr.x0, tr.x1, CHAMBER);
      expect(xs.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(3.0001);
    }
  });
});

describe('Камерная сцена: зрительский амфитеатр (102 места)', () => {
  it('ровно 102 места в 7 рядах (1–6 по 16 мест с 2 откидными, 7-й ряд — 6 мест вокруг операторской)', () => {
    const { seats } = chamberSeatLayout(CHAMBER);
    expect(seats).toHaveLength(102);
    for (let r = 0; r < 6; r++) {
      expect(seats.filter((s) => s.row === r)).toHaveLength(16);
    }
    expect(seats.filter((s) => s.folding)).toHaveLength(2);
    expect(seats.filter((s) => s.row === 6)).toHaveLength(6);
  });
  it('все кресла в пределах ширины зала, не попадают в боковую лестницу и операторскую', () => {
    const { seats } = chamberSeatLayout(CHAMBER);
    const half = H.seatPitch / 2;
    const B = H.booth;
    for (const s of seats) {
      const hw = s.folding ? H.foldingPitch / 2 : half;
      expect(s.x - hw).toBeGreaterThanOrEqual(H.tierX0);
      expect(s.x + hw).toBeLessThanOrEqual(H.x1);
      expect(s.d).toBeGreaterThan(H.backWallD);
      // В 7-м ряду нет кресел внутри габаритов операторской по X
      if (s.row === 6) {
        expect(s.x < B.x0 || s.x > B.x1).toBe(true);
      }
    }
    expect(rowFloorY(0)).toBe(0);
    expect(rowFloorY(1)).toBe(0.25);
    expect(rowFloorY(6)).toBeCloseTo(1.50, 6);
    expect(rowFrontD(0)).toBeCloseTo(0.35, 6);
  });
});

describe('Камерная сцена: световой развес (72 прибора)', () => {
  it('72 прибора, уникальные номера, точное совпадение с перечнем оборудования и справочником театра', () => {
    expect(FIXTURES).toHaveLength(72);
    expect(new Set(FIXTURES.map((f) => String(f.no))).size).toBe(72);
    expect(countByType(['HALL_ZF1', 'HALL_ZF2'])).toEqual(INVENTORY.hall);
    expect(countByType(['FOH'])).toEqual(INVENTORY.foh);
    expect(countByType(['PROS_L'])).toEqual(INVENTORY.prosceniumEach);
    expect(countByType(['PROS_R'])).toEqual(INVENTORY.prosceniumEach);
    expect(countByType(['ROW1'])).toEqual(INVENTORY.row1);
    expect(countByType(['SIDE1_L'])).toEqual(INVENTORY.side1Each);
    expect(countByType(['SIDE1_R'])).toEqual(INVENTORY.side1Each);
    expect(countByType(['ROW2_BAR', 'ROW2'])).toEqual(INVENTORY.row2);
    expect(countByType(['SIDE2_L'])).toEqual(INVENTORY.side2Each);
    expect(countByType(['SIDE2_R'])).toEqual(INVENTORY.side2Each);
    expect(countByType(['ROW3'])).toEqual(INVENTORY.row3);
    expect(countByType(['SIDE3_L'])).toEqual(INVENTORY.side3Each);
    expect(countByType(['SIDE3_R'])).toEqual(INVENTORY.side3Each);

    for (const f of FIXTURES) {
      expect(TYPES[f.type], `тип для прибора №${f.no}`).toBeTruthy();
      expect(SPECS[f.type], `паспорт для прибора №${f.no}`).toBeTruthy();
    }

    // Проверка распределения по фермам ЗФ1–ЗФ3 и Ф2–Ф8 и единственной П-образной конструкции за передними колоннами
    const byNo = Object.fromEntries(FIXTURES.map((f) => [String(f.no), f]));
    expect(byNo['119'].truss).toBe('ZF1');
    expect(FIXTURES.filter((f) => f.truss === 'ZF2')).toHaveLength(15);
    expect(FIXTURES.filter((f) => f.truss === 'ZF3').map((f) => f.no)).toEqual([102, 15, 16, 120]);
    for (const no of ['17', '122', '19', '123']) {
      expect(byNo[no].truss).toBeNull();
      expect(byNo[no].mount.d).toBeCloseTo(CHAMBER.trusses.prosceniumFrame.d, 5);
    }
    expect(CHAMBER.trusses.sideDrops).toHaveLength(2);
    expect(CHAMBER.niche.height).toBe(4.4);
    expect(byNo['П1'].truss).toBe('F2');
    expect(byNo['П2'].truss).toBe('F2');
    expect(byNo['152'].truss).toBe('F3');
    expect(byNo['134'].truss).toBe('F3');
    expect(byNo['П3'].truss).toBe('F5');
    expect(byNo['136'].truss).toBe('F5');
    expect(byNo['П4'].truss).toBe('F5');
    expect(byNo['141'].truss).toBe('F5');
    expect(byNo['154'].truss).toBe('F7');
    expect(byNo['158'].truss).toBe('F7');
    expect(byNo['П5'].truss).toBe('F8');
    expect(byNo['П6'].truss).toBe('F8');
  });
  it('все 72 прибора неподвижны (mount.on = null) и закреплены внутри помещения', () => {
    for (const f of FIXTURES) {
      expect(f.mount.on, `прибор №${f.no}`).toBeNull();
      expect(chamber.fixtures.hangs(f), `прибор №${f.no}`).toBe(true);
      expect(f.mount.x).toBeGreaterThan(R.x0);
      expect(f.mount.x).toBeLessThan(R.x1);
      expect(f.mount.d).toBeGreaterThan(R.d0);
      expect(f.mount.d).toBeLessThan(R.d1);
      expect(f.mount.y).toBeLessThan(R.ceiling);
      if (f.truss) {
        const tr = TRUSS_BY_ID[f.truss];
        expect(tr, `ферма ${f.truss} прибора №${f.no}`).toBeTruthy();
        expect(f.mount.x).toBeGreaterThanOrEqual(tr.x0);
        expect(f.mount.x).toBeLessThanOrEqual(tr.x1);
      }
    }
  });
  it('у каждой группы есть набор кнопок и групповой источник в обоих профилях (full и lite), а шейдер пятен компилируется без ошибок', () => {
    for (const g of Object.keys(chamber.fixtures.groups)) {
      expect(chamber.fixtures.groupSets.some((s) => s.groups.includes(g)), g).toBe(true);
      for (const plan of ['full', 'lite']) {
        expect(chamber.lightPlans[plan].some((p) => p.members.includes(g)), `${plan}:${g}`).toBe(true);
      }
    }
    const sh = { vertexShader: '#include <common>\n#include <project_vertex>', fragmentShader: '#include <common>\nvoid main() {' };
    const mat = {};
    chamber.fixtures.floor.clip(mat);
    mat.onBeforeCompile(sh);
    expect(sh.fragmentShader).toContain('discard');
  });
});
