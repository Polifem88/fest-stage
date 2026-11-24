// Фойе (этап 1 — черновик): проверка конфигурации размеров (SSOT), высот потолков и ферм,
// зазоров экрана/периметральной фермы и маркировки допущений.
import { describe, it, expect } from 'vitest';
import { FOYER, foyerCeilY, foyerTrussY0 } from '../../src/venues/fest-foyer/config/dimensions.js';
import { FIXTURES, TYPES, SPECS, GROUPS, GROUP_SETS, LIGHT_PLANS } from '../../src/venues/fest-foyer/config/fixtures.js';

describe('Фойе · конфигурация (SSOT)', () => {
  it('общая глубина 2-го этажа равна 21,02 м (W1) и ширина между кирпичами 23,49 м', () => {
    expect(FOYER.room.dWall2 - FOYER.room.dGlass2).toBeCloseTo(21.02, 2);
    expect(FOYER.room.x1 - FOYER.room.x0).toBeCloseTo(23.49, 2);
    expect(FOYER.room.dGlass1).toBe(0);
    expect(FOYER.room.dGlass2).toBeCloseTo(-0.80, 2);
    expect(FOYER.room.y2).toBe(3.00);
    expect(FOYER.room.slabThick).toBe(0.30);
    expect(FOYER.room.tile).toBeCloseTo(0.597, 3);
  });

  it('ширина проёма второго света равна 8,34 м (A1 = 8,44 − 0,10 перила)', () => {
    expect(FOYER.atrium.eastD - FOYER.atrium.westD).toBeCloseTo(8.34, 2);
    expect(FOYER.railing.inset).toBe(0.10);
    expect(FOYER.railing.h).toBe(0.95);
  });

  it('ломаная лестница: 13 нижних + 9 верхних ступеней, площадка 1,75 м, верх 3,00 м', () => {
    expect(FOYER.stairs.width).toBe(2.50);
    expect(FOYER.stairs.tread).toBe(0.31);
    expect(FOYER.stairs.landingY).toBe(1.75);
    expect(FOYER.stairs.lower.risers).toBe(13);
    expect(FOYER.stairs.upper.risers).toBe(9);
    expect(FOYER.stairs.lower.angleDeg).toBeCloseTo(28.0, 1);
    expect(FOYER.room.y2).toBe(3.00);
  });

  it('профиль потолка 2-го этажа foyerCeilY(d): скат у ВБ3 → полка 8,50 (1,10..4,10) → подшивка 4,10→5,03 → атриум 7,45 → перелом 9,60 → 6,37', () => {
    const C = FOYER.ceil2;
    expect(C.glassY).toBe(9.20);
    expect(C.shelfFromD).toBe(1.10);
    expect(C.shelfY).toBe(8.50);
    expect(C.rampFromD).toBe(4.10);
    expect(C.rampToD).toBe(5.03);
    expect(C.atriumY).toBe(7.45);
    expect(C.bendD).toBe(9.60);
    expect(C.wallY).toBe(6.37);
    // полка ровно 5 панелей = 3,00 м (H5)
    expect(C.rampFromD - C.shelfFromD).toBeCloseTo(3.00, 6);

    expect(foyerCeilY(-0.80)).toBeCloseTo(9.20, 4);
    expect(foyerCeilY((-0.80 + 1.10) / 2)).toBeCloseTo((9.20 + 8.50) / 2, 4);
    expect(foyerCeilY(1.10)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY(2.60)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY(4.10)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY((4.10 + 5.03) / 2)).toBeCloseTo((8.50 + 7.45) / 2, 4);
    expect(foyerCeilY(5.03)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY(7.00)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY(9.60)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY((9.60 + 20.22) / 2)).toBeCloseTo((7.45 + 6.37) / 2, 4);
    expect(foyerCeilY(20.22)).toBeCloseTo(6.37, 4);
  });

  it('дверь ДВ5Б* (M5) и LED-экран: d = 6,65..8,30, экран 8,90..14,02, перелом bendD = экран.d0 + 0,70', () => {
    const dv = FOYER.zones.doors.find((d) => d.id === 'ДВ5Б*');
    expect(dv.d0).toBe(6.65);
    expect(dv.d1).toBe(8.30);
    expect(dv.d1 - dv.d0).toBeCloseTo(1.65, 6);
    expect(dv.d1 - FOYER.room.dGlass2).toBeCloseTo(9.10, 6); // M5: 9,10 м от стекла ВБ3
    expect(dv.assumption).toBeUndefined();

    const S = FOYER.screen;
    expect(S.d0).toBe(8.90);
    expect(S.d1).toBe(14.02);
    expect(S.d0 - dv.d1).toBeCloseTo(0.60, 6); // E4
    expect(S.d1 - S.d0).toBeCloseTo(S.w, 6);
    expect(S.d0 + 0.70).toBeCloseTo(FOYER.ceil2.bendD, 6); // ответ №1
    expect(dv.d1 + 1.30).toBeCloseTo(FOYER.ceil2.bendD, 6); // H4
  });

  it('профиль низа ферм foyerTrussY0(d): 8,00 | опуск 1,00 на 4,10 | 7,00 до перелома 9,60 | уклон → 6,00 на 19,10', () => {
    const T = FOYER.trusses;
    expect(T.windowD).toBe(-0.40);
    expect(T.stepD).toBe(4.10);
    expect(T.bendD).toBe(9.60);
    expect(T.wallD).toBe(19.10);
    expect(T.bendD).toBe(FOYER.ceil2.bendD);
    expect(T.stepD).toBe(FOYER.ceil2.rampFromD);

    expect(foyerTrussY0(-0.40)).toBeCloseTo(8.00, 4);
    expect(foyerTrussY0(4.09)).toBeCloseTo(8.00, 4);
    expect(foyerTrussY0(4.10)).toBeCloseTo(7.00, 4);
    expect(foyerTrussY0(9.60)).toBeCloseTo(7.00, 4);
    expect(foyerTrussY0(12.60)).toBeCloseTo(6.6842, 4);
    expect(foyerTrussY0((9.60 + 19.10) / 2)).toBeCloseTo(6.50, 4);
    expect(foyerTrussY0(19.10)).toBeCloseTo(6.00, 4);
    expect(foyerTrussY0(20.00)).toBeCloseTo(6.00, 4);
  });

  it('фермы нигде не касаются потолка: зазор foyerCeilY − (Y0 + 0,25) ≥ 0,15 на всём [−0,40; 19,10]', () => {
    const T = FOYER.trusses;
    let worst = Infinity;
    for (let d = T.windowD; d <= T.wallD + 1e-9; d += 0.01) {
      worst = Math.min(worst, foyerCeilY(d) - (foyerTrussY0(d) + T.size));
    }
    expect(worst).toBeGreaterThanOrEqual(0.15);
  });

  it('сетка ферм Q25/31 по ТХ3: 19,75 × 22,25 м по наружным поясам, ФВ-1 в 2,5 см за рёбрами ВБ3', () => {
    const T = FOYER.trusses;
    const h = T.size / 2;
    expect(T.transverseX).toEqual([-11.43, -4.93, 0.57, 4.57, 7.57, 10.57]);
    const xs = T.transverseX;
    expect(xs[xs.length - 1] + h - (xs[0] - h)).toBeCloseTo(22.25, 6);
    expect(T.wallD + h - (T.windowD - h)).toBeCloseTo(19.75, 6);
    // наружный пояс ФВ-1 (−0,525) в 2,5 см от торца рёбер витража ВБ3 (−0,80 + 0,25 = −0,55)
    expect(T.windowD - h - (FOYER.room.dGlass2 + 0.25)).toBeCloseTo(0.025, 6);
  });

  it('продольные ФВ-1..ФВ-4 и стойки С-1/С-2 стоят в узлах сетки ТХ3', () => {
    const T = FOYER.trusses;
    const byId = Object.fromEntries(T.longitudinal.map((l) => [l.id, l]));
    expect(T.longitudinal.map((l) => l.id)).toEqual(['ФВ-1', 'ФВ-2', 'ФВ-2М', 'ФВ-3', 'ФВ-4']);
    expect(byId['ФВ-1']).toMatchObject({ axis: 'd', at: -0.40, a0: -11.43, a1: 10.57, y0: 8.00 });
    expect(byId['ФВ-2']).toMatchObject({ axis: 'd', at: 6.60, a0: -11.43, a1: 10.57, y0: 7.00 });
    expect(byId['ФВ-2М']).toMatchObject({ axis: 'd', at: 9.60, a0: 0.57, a1: 10.57, y0: 7.00 });
    expect(byId['ФВ-3']).toMatchObject({ axis: 'd', at: 12.60, a0: -11.43, a1: 10.57 });
    expect(byId['ФВ-3'].y0).toBeCloseTo(foyerTrussY0(12.60), 4);
    expect(byId['ФВ-4']).toMatchObject({ axis: 'd', at: 19.10, a0: -11.43, a1: 10.57, y0: 6.00 });
    // ФВ-2 над правым косяком ДВ5Б* (d0 = 6,65)
    const dv = FOYER.zones.doors.find((d) => d.id === 'ДВ5Б*');
    expect(Math.abs(byId['ФВ-2'].at - dv.d0)).toBeLessThan(T.size / 2);

    expect(T.posts).toHaveLength(2);
    const [c1, c2] = T.posts;
    expect(c1).toMatchObject({ id: 'С-1', x: -4.93, d: 19.10, y0: 3.00, y1: 6.00 });
    expect(c2).toMatchObject({ id: 'С-2', x: 11.57, y0: 3.00, y1: 8.00, tieTo: [10.57, 8.00, -0.40], assumption: true });
    // С-2 сдвинута к витражу (d = 0,03), чтобы не задевать диван у торца А (решение заказчика 24.11)
    expect(c2.d).toBe(0.03);
  });

  it('LED-экран помещается под фермой 7,00 м, крайняя поперечная ферма X = 10,57 не задевает экран', () => {
    const T = FOYER.trusses;
    expect(FOYER.screen.w).toBeCloseTo(5.12, 2);
    expect(FOYER.screen.h).toBeCloseTo(2.88, 2);
    expect(FOYER.screen.y0).toBeCloseTo(3.885, 3);
    expect(FOYER.screen.y0 + FOYER.screen.h).toBeCloseTo(6.765, 3);
    expect(FOYER.screen.y0 + FOYER.screen.h).toBeLessThan(T.atriumY0);
    expect(Math.max(...T.transverseX) + T.size / 2).toBeLessThan(FOYER.screen.x - FOYER.screen.protrude);
    expect(T.perimeter.y0 + T.size).toBeCloseTo(2.95, 3);
    expect(T.perimeter.y0 + T.size).toBeLessThanOrEqual(FOYER.room.y2);
  });

  it('все оценочные по фото элементы помечены флагом assumption', () => {
    expect(FOYER.ceil2.rampAssumption).toBe(true);
    expect(FOYER.smallStairs.assumption).toBe(true);
    expect(FOYER.zones.elevator.assumption).toBe(true);
    expect(FOYER.columns.pilasters.assumption).toBe(true);
    expect(FOYER.furniture.sofas1f.every((s) => s.assumption === true)).toBe(true);
    expect(FOYER.furniture.sofas2f.every((s) => s.assumption === true)).toBe(true);
    expect(FOYER.furniture.showcases.every((s) => s.assumption === true)).toBe(true);
    expect(FOYER.duty.assumption).toBe(true);
  });

  it('каркас приборов пуст (черновик Этапа 1)', () => {
    expect(FIXTURES).toEqual([]);
    expect(TYPES).toEqual({});
    expect(SPECS).toEqual({});
    expect(GROUPS).toEqual({});
    expect(GROUP_SETS).toEqual([]);
    expect(LIGHT_PLANS).toEqual({ full: [], lite: [] });
  });
});
