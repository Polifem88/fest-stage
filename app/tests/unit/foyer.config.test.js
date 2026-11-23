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

  it('профиль потолка 2-го этажа foyerCeilY(d) точен во всех 4 зонах (включая крутой скат 5,10→5,58)', () => {
    expect(foyerCeilY(-0.80)).toBeCloseTo(9.20, 4);
    expect(foyerCeilY(2.10)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY(3.60)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY(5.10)).toBeCloseTo(8.50, 4);
    expect(foyerCeilY(5.34)).toBeCloseTo(7.975, 4);
    expect(foyerCeilY(5.58)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY(10.00)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY(14.10)).toBeCloseTo(7.45, 4);
    expect(foyerCeilY(20.22)).toBeCloseTo(6.37, 4);
    // наклонная галерея: середина между 14,10 и 20,22
    expect(foyerCeilY((14.10 + 20.22) / 2)).toBeCloseTo((7.45 + 6.37) / 2, 4);
  });

  it('профиль низа ферм foyerTrussY0(d): 8,00 | опуск 1,00 на 5,98 | 7,00 → 6,00 (ФВ-2 не режет колонны 5,83)', () => {
    expect(foyerTrussY0(0.00)).toBeCloseTo(8.00, 4);
    expect(foyerTrussY0(5.60)).toBeCloseTo(8.00, 4);
    expect(foyerTrussY0(5.83)).toBeCloseTo(8.00, 4);
    expect(foyerTrussY0(5.98)).toBeCloseTo(7.00, 4);
    expect(foyerTrussY0(6.00)).toBeCloseTo(7.00, 4);
    expect(foyerTrussY0(14.10)).toBeCloseTo(7.00, 4);
    expect(foyerTrussY0(19.55)).toBeCloseTo(6.00, 4);
    expect(foyerTrussY0((14.10 + 19.55) / 2)).toBeCloseTo(6.50, 4);
    expect(FOYER.trusses.stepD - FOYER.trusses.size / 2).toBeGreaterThan(FOYER.atrium.westD);
  });

  it('LED-экран помещается под фермой 7,00 м, а периметральная ферма заподлицо с плитой 3,00 м', () => {
    expect(FOYER.screen.w).toBeCloseTo(5.12, 2);
    expect(FOYER.screen.h).toBeCloseTo(2.88, 2);
    expect(FOYER.screen.y0 + FOYER.screen.h).toBeCloseTo(6.765, 3);
    expect(FOYER.screen.y0 + FOYER.screen.h).toBeLessThan(FOYER.trusses.atriumY0);
    expect(FOYER.trusses.perimeter.y0 + FOYER.trusses.size).toBeCloseTo(2.95, 3);
    expect(FOYER.trusses.perimeter.y0 + FOYER.trusses.size).toBeLessThanOrEqual(FOYER.room.y2);
  });

  it('все 5 продольных веток, 6 поперечных линий и 2 вертикальные стойки ферм заданы', () => {
    expect(FOYER.trusses.longitudinal).toHaveLength(5);
    expect(FOYER.trusses.transverseX).toEqual([-11.25, -5.00, 0.25, 5.75, 8.38, 11.00]);
    expect(FOYER.trusses.posts).toHaveLength(2);
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
