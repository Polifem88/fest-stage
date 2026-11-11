import { describe, it, expect } from 'vitest';
import { DIM, HALL_HALF, STEP_HALF_X, rowFrontD } from '../../src/venues/fest-big/config/dimensions.js';
import {
  HALL_CONTOUR_RIGHT,
  hallLedCorners,
  hallFloorY,
  hallCanopyY,
  inHallFloor,
} from '../../src/venues/fest-big/config/hallGeometry.js';

describe('Большая сцена · геометрия зрительного зала (Патч 1, часть 2)', () => {
  it('верхняя ширина зала 16,0 м, ступени ±7,06 м под 26 креслами по 0,54 м', () => {
    expect(DIM.hall.width).toBe(16.0);
    expect(HALL_HALF).toBe(8.0);
    expect(DIM.hall.seatWidth).toBe(0.54);
    expect(STEP_HALF_X).toBeCloseTo(7.06, 4);
  });

  it('контур нижних стен, ёлочки, кишок и операторской замыкается без невязки', () => {
    const byId = Object.fromEntries(HALL_CONTOUR_RIGHT.map((p) => [p.id, p]));
    expect(byId.P0).toMatchObject({ x: 8.2, d: 0 });
    expect(Math.hypot(byId.P1.x - byId.P0.x, byId.P1.d - byId.P0.d)).toBeCloseTo(1.75, 4);
    expect(byId.Z0.x).toBeCloseTo(8.2, 4);
    expect(byId.Z0.d).toBeCloseTo(-2.3, 4);
    for (let k = 1; k <= 4; k++) {
      const zPrev = byId[`Z${k - 1}`], v = byId[`V${k}`], zNext = byId[`Z${k}`];
      expect(v.x).toBeCloseTo(8.7, 4);
      expect(zNext.x).toBeCloseTo(8.2, 4);
      expect(Math.hypot(v.x - zPrev.x, v.d - zPrev.d)).toBeCloseTo(2.3, 4);
      expect(Math.hypot(zNext.x - v.x, zNext.d - v.d)).toBeCloseTo(0.85, 4);
    }
    expect(byId.Z4.d).toBeCloseTo(-14.0295, 3);
    expect(Math.hypot(byId.E1.x - byId.Z4.x, byId.E1.d - byId.Z4.d)).toBeCloseTo(5.25, 4);
    expect(byId.E1.x).toBeCloseTo(11.9123, 3);
    expect(byId.E1.d).toBeCloseTo(-17.7418, 3);
    expect(byId.E1.d - byId.E2.d).toBeCloseTo(2.6, 4);
    expect(byId.E2.x - byId.B3.x).toBeCloseTo(2.6, 4);
    expect(byId.B2.d - byId.B3.d).toBeCloseTo(1.7, 4);
    expect(byId.B1.x).toBeCloseTo(8.25, 4);
    expect(byId.B1.d).toBeCloseTo(-18.0, 4);
    expect(Math.hypot(byId.B2.x - byId.B1.x, byId.B2.d - byId.B1.d)).toBeCloseTo(1.2412, 3);
  });

  it('карниз C1-гладкий от +1,45 м у портала до +2,00 м у 2-го ряда и +3,91 м в тамбуре', () => {
    expect(hallCanopyY(0)).toBeCloseTo(1.45, 4);
    expect(hallCanopyY(rowFrontD(1))).toBeCloseTo(2.0, 4);
    const eps = 1e-4;
    const slopeLeft = (hallCanopyY(rowFrontD(1) - eps) - hallCanopyY(rowFrontD(1))) / eps;
    const slopeRight = (hallCanopyY(rowFrontD(1)) - hallCanopyY(rowFrontD(1) + eps)) / eps;
    expect(slopeRight).toBeCloseTo(slopeLeft, 3);
    expect(hallCanopyY(-19.5) - hallFloorY(-19.5, 10.5)).toBeCloseTo(2.75, 3);
  });

  it('пол зала: ступени по центру, гладкий пандус в проходах, -0,85 у передних дверей, горизонт у выходов', () => {
    expect(hallFloorY(0, 8.0)).toBeCloseTo(-0.85, 4);
    expect(hallFloorY(-1.5, 8.45)).toBeCloseTo(-0.85, 3);
    expect(hallFloorY(-2.75, 7.5)).toBeCloseTo(-0.75, 4);
    expect(hallFloorY(-5.3, 0)).toBeCloseTo(-0.75, 4); // 1-й ряд без ступени
    // в середине 5-го ряда центр ступенчатый, а проход выше переднего края ступени по гладкому уклону
    const dMid = rowFrontD(4) - 0.4;
    expect(hallFloorY(dMid, 0)).toBeGreaterThan(hallFloorY(dMid, 7.8));
    expect(hallFloorY(rowFrontD(4) - 0.8 + 1e-5, 0)).toBeCloseTo(hallFloorY(rowFrontD(4) - 0.8, 7.8), 3);
    // горизонтальный тамбур перед выходными дверями
    expect(hallFloorY(-18.0, 10.5)).toBeCloseTo(hallFloorY(-20.2, 10.5), 4);
    expect(inHallFloor(10.5, -19.5)).toBe(true);
    expect(inHallFloor(0, -19.5)).toBe(false); // внутри операторской пола зала нет
  });

  it('по 4 LED-ленты с каждой стороны от пола пандуса до низа карниза', () => {
    for (const side of [-1, 1]) {
      const leds = hallLedCorners(side);
      expect(leds).toHaveLength(4);
      for (const c of leds) {
        expect(Math.abs(c.x)).toBeCloseTo(8.7, 4);
        expect(c.y0).toBeCloseTo(hallFloorY(c.d, c.x), 4);
        expect(c.y1).toBeCloseTo(hallCanopyY(c.d), 4);
        expect(c.nx * side).toBeLessThan(0); // биссектриса направлена внутрь зала
        expect(Math.hypot(c.nx, c.nd)).toBeCloseTo(1, 5);
      }
      // V1 (d ≈ -4.55) попадает на плавный переход карниза (+1.45 → +2.00), а V2..V4 — на участок полной высоты 2.75 м
      expect(leds[0].y1 - leds[0].y0).toBeGreaterThan(2.5);
      expect(leds[0].y1 - leds[0].y0).toBeLessThan(2.75);
      for (const c of leds.slice(1)) {
        expect(c.y1 - c.y0).toBeCloseTo(2.75, 4);
      }
    }
  });
});
