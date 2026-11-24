// Фойе (этап 1 — черновик): проверка конфигурации размеров (SSOT), высот потолков и ферм,
// зазоров экрана/периметральной фермы и маркировки допущений.
import { describe, it, expect } from 'vitest';
import { FOYER, foyerCeilY, foyerTrussY0, foyerEndWallStepD } from '../../src/venues/fest-foyer/config/dimensions.js';
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

  it('колонна К1-4 по вектору АР P33 прижата +X-гранью к оси В: X 5,46..6,01, d 4,90..5,83', () => {
    const k14 = FOYER.columns.inner.find((c) => c.id === 'К1-4');
    expect(k14).toEqual({ id: 'К1-4', cx: 5.735, x0: 5.46, x1: 6.01, d0: 4.90, d1: 5.83 });
    expect(FOYER.columns.inner.map((c) => c.id)).toEqual(['К1-1', 'К1-2', 'К1-3', 'К1-4']);
    expect(FOYER.columns.inner.find((c) => c.id === 'К1-3')).toMatchObject({ cx: 0, x0: -0.275, x1: 0.275 });
  });

  it('гардероб (M1): контур пом. 2, двусторонняя Г-стойка 5,25 + 5,55 м сходится во внутреннем углу К1-4', () => {
    const W = FOYER.zones.wardrobe;
    const k14 = FOYER.columns.inner.find((c) => c.id === 'К1-4');
    expect(W).toMatchObject({ x0: 6.01, x1: 11.56, d0: 5.83, d1: 13.11 });
    expect(W.x1).toBe(FOYER.room.x1);
    expect(W.assumption).toBeUndefined(); // габариты стоек — замер M1
    expect(W.rackAssumption).toBe(true);  // схематичные вешалки — допущение
    expect(W.armD).toEqual({ x0: 5.56, x1: 6.01, d0: 5.83, d1: 11.08, h: 0.90 });
    expect(W.armX).toEqual({ x0: 6.01, x1: 11.56, d0: 5.38, d1: 5.83, h: 0.90 });
    expect(W.armD.d1 - W.armD.d0).toBeCloseTo(5.25, 6);
    expect(W.armX.x1 - W.armX.x0).toBeCloseTo(5.55, 6);
    expect(W.armD.x1 - W.armD.x0).toBeCloseTo(0.45, 6);
    expect(W.armX.d1 - W.armX.d0).toBeCloseTo(0.45, 6);
    // угол стыка (6,01; 5,83) = внутренний угол колонны К1-4
    expect([W.armD.x1, W.armD.d0]).toEqual([k14.x1, k14.d1]);
    expect([W.armX.x0, W.armX.d1]).toEqual([k14.x1, k14.d1]);
    // плечо по X проходит вплотную за задней гранью колонны К1-Б
    expect(W.armX.d0).toBe(FOYER.columns.extraB.d1);
    // вешалки развёрнуты вдоль d и стоят внутри контура гардероба
    expect(W.rackRowsX).toEqual([7.25, 8.65, 10.05]);
    expect(W).toMatchObject({ rackD0: 6.35, rackD1: 12.30, rackH: 2.05 });
    for (const x of W.rackRowsX) expect(x > W.x0 && x < W.x1).toBe(true);
    expect(W.rackD0).toBeGreaterThan(W.armX.d1);
    expect(W.rackD1).toBeLessThan(W.d1);
  });

  it('стойка администратора B1 (M4): буква «Г», плечо 0,60 м, длинное плечо 3,00 м вдоль витража, вылет 1,825 м', () => {
    const B = FOYER.furniture.receptionB1;
    expect(B.h).toBe(1.20);
    const [long, short] = B.arms;
    expect(long).toEqual({ x0: -3.00, x1: 0.00, d0: 2.04, d1: 2.64 });
    expect(short).toEqual({ x0: -3.00, x1: -2.40, d0: 0.815, d1: 2.04 });
    expect(long.x1 - long.x0).toBeCloseTo(3.00, 6);
    expect(long.d1 - long.d0).toBeCloseTo(0.60, 6);
    expect(short.x1 - short.x0).toBeCloseTo(0.60, 6);
    expect(long.d1 - short.d0).toBeCloseTo(1.825, 6);
    expect(short.d0).toBeCloseTo(0.815, 6); // отступ от ВБ6
  });

  it('стойки B1, B2 и гардероба нигде не заходят в колонны', () => {
    const C = FOYER.columns;
    const cols = [...C.outer, ...C.inner, C.extraB];
    const W = FOYER.zones.wardrobe;
    const F = FOYER.furniture;
    const counters = [...F.receptionB1.arms, F.buffetB2, W.armD, W.armX];
    const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.d0 < b.d1 - 1e-6 && a.d1 > b.d0 + 1e-6;
    for (const k of counters) {
      for (const c of cols) expect(overlap(k, c), `${JSON.stringify(k)} × ${c.id}`).toBe(false);
    }
  });

  it('белая стена d = 14,13 доходит до X = 5,56; правый коридор у дивана (M7 — допущение)', () => {
    expect(FOYER.room.whiteX1).toBe(5.56);
    expect(FOYER.zones.sideCorridor).toEqual({ x0: 4.55, x1: 5.56, d0: 14.13, d1: 15.80, h: 2.45, assumption: true });
    expect(FOYER.zones.sideCorridor.x1).toBe(FOYER.zones.wardrobe.armD.x0);
  });

  it('проход 1,15 м под лестницей (M7 — допущение): коридор за белой стеной, без старой чёрной шторы на d = 13,75', () => {
    const P = FOYER.zones.passage;
    expect(P).toEqual({ x0: -5.94, x1: -4.79, d0: 11.45, d1: 16.00, h: 2.45, assumption: true });
    expect(P.x1 - P.x0).toBeCloseTo(FOYER.zones.buffet.passageW, 6);
    expect(P.x0).toBe(FOYER.zones.buffet.pier.x1); // сразу за кирпичным столбом буфета
    expect(P.d1).toBeGreaterThan(FOYER.room.dWhite1);
    expect(FOYER.curtain.underStairBlack).toBeUndefined();
  });

  it('кладовая под лестницей (молтон, допущение) по правой границе прохода и задней кромке площадки', () => {
    const U = FOYER.stairs.underStorage;
    const S = FOYER.stairs;
    expect(U.assumption).toBe(true);
    expect(U.side).toEqual([[-4.79, 11.45], [-4.79, 13.95]]);
    expect(U.back).toEqual([[-3.67, 13.95], [-1.57, 13.18]]);
    expect(U.side[0][0]).toBe(FOYER.zones.passage.x1);
    expect(U.side[0][1]).toBe(S.upper.d0);
    expect(U.side[1][1]).toBe(S.upper.d1);
    // задняя кромка промежуточной площадки (landing[3] → landing[2])
    expect(U.back).toEqual([S.landing[3], S.landing[2]]);
  });

  it('малая лестница (D1): площадка с дверью на +X-конце у стойки С-1, 5 ступеней поднимаются от x0', () => {
    const SS = FOYER.smallStairs;
    expect(SS).toMatchObject({ x0: -8.10, x1: -5.12, d0: 18.93, d1: 20.22, y0: 3.00, y1: 3.84, risers: 5, landingW: 1.30, doorW: 0.90, doorH: 2.05, assumption: true });
    const c1 = FOYER.trusses.posts.find((p) => p.id === 'С-1');
    const c1x0 = c1.x - FOYER.trusses.size / 2;
    expect(c1x0).toBeCloseTo(-5.055, 6);
    expect(c1x0 - SS.x1).toBeCloseTo(0.065, 6); // 6,5 см до стойки С-1
  });

  describe('диваны — единый модуль 1,20 × 0,70 (M2, M3)', () => {
    const F = FOYER.furniture;
    const all = () => [...F.sofas1f, ...F.sofas2f];
    const len = (s) => (s.facing === '+d' || s.facing === '-d' ? s.x1 - s.x0 : s.d1 - s.d0);
    const dep = (s) => (s.facing === '+d' || s.facing === '-d' ? s.d1 - s.d0 : s.x1 - s.x0);
    const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.d0 < b.d1 - 1e-6 && a.d1 > b.d0 + 1e-6;

    it('модуль задан в конфиге и все 33 дивана строго 1,20 × 0,70', () => {
      expect(F.sofaModule).toEqual({ len: 1.20, depth: 0.70 });
      expect(F.sofas1f).toHaveLength(10);
      expect(F.sofas2f).toHaveLength(23);
      for (const s of all()) {
        expect(len(s), JSON.stringify(s)).toBeCloseTo(1.20, 6);
        expect(dep(s), JSON.stringify(s)).toBeCloseTo(0.70, 6);
      }
      expect(F.sofas1f.every((s) => s.y0 === 0)).toBe(true);
      expect(F.sofas2f.every((s) => s.y0 === FOYER.room.y2)).toBe(true);
    });

    it('1-й этаж (M2): 3 у белой стены, 4 вдоль ВБ6 в углу А, 3 вдоль кирпичного торца А', () => {
      const wall = F.sofas1f.filter((s) => s.d1 === FOYER.room.dWhite1);
      expect(wall).toHaveLength(3);
      expect(Math.min(...wall.map((s) => s.x0))).toBeCloseTo(0.80, 6);
      expect(Math.max(...wall.map((s) => s.x1))).toBeCloseTo(4.40, 6);
      expect(wall.every((s) => s.facing === '-d' && s.assumption === true)).toBe(true);

      const glass = F.sofas1f.filter((s) => s.facing === '+d');
      expect(glass).toHaveLength(4);
      expect(Math.min(...glass.map((s) => s.x0))).toBeCloseTo(6.96, 6);
      expect(Math.max(...glass.map((s) => s.x1))).toBeCloseTo(11.76, 6);
      expect(glass.every((s) => s.d0 === 0.02 && s.d1 === 0.72 && !s.assumption)).toBe(true);

      const brick = F.sofas1f.filter((s) => s.facing === '-x');
      expect(brick).toHaveLength(3);
      expect(brick.every((s) => s.x0 === 10.86 && s.x1 === FOYER.room.x1 && !s.assumption)).toBe(true);
      expect(Math.min(...brick.map((s) => s.d0))).toBeCloseTo(1.18, 6);
      expect(Math.max(...brick.map((s) => s.d1))).toBeCloseTo(4.78, 6);
    });

    it('2-й этаж (M3): пары «спина к спине» вдоль d у колонн К1*, по одному у торцов, 5 у стены витрин', () => {
      const win = F.sofas2f.filter((s) => s.d0 === 0.18 && s.d1 === 1.38);
      expect(win).toHaveLength(12);
      for (const c of FOYER.columns.outer) {
        expect(win.some((s) => s.x0 === +(c.cx - 0.70).toFixed(3) && s.x1 === c.cx && s.facing === '-x'), `${c.id} −x`).toBe(true);
        expect(win.some((s) => s.x0 === c.cx && s.x1 === +(c.cx + 0.70).toFixed(3) && s.facing === '+x'), `${c.id} +x`).toBe(true);
      }
      expect(win.some((s) => s.x0 === -12.23 && s.facing === '+x')).toBe(true);
      expect(win.some((s) => s.x1 === 11.86 && s.facing === '-x')).toBe(true);

      const atr = F.sofas2f.filter((s) => s.d0 === 1.78 && s.d1 === 2.98);
      expect(atr).toHaveLength(6);
      expect([...new Set(atr.map((s) => s.facing === '-x' ? s.x1 : s.x0))].sort((a, b) => a - b)).toEqual([-5.98, 0, 6.00]);
      expect(atr.concat(win).every((s) => !s.assumption)).toBe(true);

      const sc = F.sofas2f.filter((s) => s.d0 === 19.48 && s.d1 === 20.18);
      expect(sc).toHaveLength(5);
      expect(sc.every((s) => s.facing === '-d' && s.assumption === true)).toBe(true);
      expect(F.showcases.map((v) => v.x)).toEqual([-4.20, -2.07, 0.06, 2.19, 6.85]);
      // двойной диван 2,40 м между В-4 и В-5
      expect(sc.filter((s) => s.x0 >= 3.25 - 1e-6 && s.x1 <= 5.65 + 1e-6)).toHaveLength(2);
    });

    it('диваны не пересекаются друг с другом, с колоннами, стойками, витринами, опорами ферм и витражами', () => {
      const C = FOYER.columns;
      const T = FOYER.trusses;
      const W = FOYER.zones.wardrobe;
      const h = T.size / 2;
      const cols = [...C.outer, ...C.inner, C.extraB];
      const posts = T.posts.map((p) => ({ id: p.id, x0: p.x - h, x1: p.x + h, d0: p.d - h, d1: p.d + h }));
      const cases = F.showcases.map((v) => ({ id: v.id, x0: v.x - v.w / 2, x1: v.x + v.w / 2, d0: v.d1 - v.depth, d1: v.d1 }));
      const counters = [...F.receptionB1.arms, F.buffetB2, W.armD, W.armX];
      const list = all();
      list.forEach((a, i) => {
        list.forEach((b, j) => { if (j > i && a.y0 === b.y0) expect(overlap(a, b), `${i}×${j}`).toBe(false); });
        for (const c of cols) expect(overlap(a, c), `${JSON.stringify(a)} × ${c.id}`).toBe(false);
        if (a.y0 > 0) {
          for (const p of posts) expect(overlap(a, p), `${JSON.stringify(a)} × ${p.id}`).toBe(false);
          for (const v of cases) expect(overlap(a, v), `${JSON.stringify(a)} × ${v.id}`).toBe(false);
          expect(a.d0).toBeGreaterThanOrEqual(FOYER.room.dGlass2 + 0.25); // за рёбрами ВБ3
        } else {
          for (const k of counters) expect(overlap(a, k), `${JSON.stringify(a)} × стойка`).toBe(false);
          expect(a.d0).toBeGreaterThan(FOYER.room.dGlass1); // перед стеклом ВБ6
        }
        expect(a.x0).toBeGreaterThanOrEqual(-12.23 - 1e-6);
        expect(a.x1).toBeLessThanOrEqual(11.86 + 1e-6);
      });
    });
  });

  it('двери 2-го этажа (D3): ДВ5* внутри южного коридора, привязки ДВ5* / ДВ1Б** / ДВ1** — допущение (M10)', () => {
    const doors = Object.fromEntries(FOYER.zones.doors.map((d) => [d.id, d]));
    const south = FOYER.zones.corridors.find((c) => c.id === 'south');
    expect(doors['ДВ5*']).toMatchObject({ wall: 'x1', d0: 20.80, d1: 21.70, assumption: true });
    expect(doors['ДВ5*'].d0).toBeGreaterThan(south.d0);
    expect(doors['ДВ5*'].d1).toBeLessThan(south.d1);
    expect(doors['ДВ1Б**'].assumption).toBe(true);
    expect(doors['ДВ1**'].assumption).toBe(true);
    // простенок у экрана 14,02 … 20,22 глухой
    const onScreenWall = FOYER.zones.doors.filter((d) => d.wall === 'x1' && d.d1 > FOYER.screen.d1 && d.d0 < FOYER.room.dWall2);
    expect(onScreenWall).toHaveLength(0);
  });

  it('M8: наклонный уступ торцов — линия d_step(Y): 3,35 на полу 2 эт., 4,10 на потолке, вынос 0,30 м', () => {
    const S = FOYER.endWallStep;
    const R = FOYER.room;
    expect(S).toMatchObject({ outset: 0.30, dAt2fFloor: 3.35, dAt2fCeil: 4.10, xWin0: -12.23, xWin1: 11.86 });
    expect(S.dAt2fFloor - R.dGlass2).toBeCloseTo(4.15, 6); // замер от стекла ВБ3
    expect(S.dAt2fCeil - R.dGlass2).toBeCloseTo(4.90, 6);
    expect(S.xWin0).toBeCloseTo(R.x0 - S.outset, 6);
    expect(S.xWin1).toBeCloseTo(R.x1 + S.outset, 6);
    expect(foyerEndWallStepD(R.y2)).toBeCloseTo(3.35, 6);
    expect(foyerEndWallStepD(FOYER.ceil2.shelfY)).toBeCloseTo(4.10, 6);
    expect(foyerEndWallStepD(FOYER.ceil2.shelfY)).toBeCloseTo(FOYER.ceil2.rampFromD, 6);
    expect(foyerEndWallStepD(0)).toBeCloseTo(2.94, 2);
    expect(foyerEndWallStepD(2.53)).toBeCloseTo(3.29, 2);
  });

  it('M8: прямоугольные пилястры на осях колонн удалены, остались только выступы в глубине зала', () => {
    const P = FOYER.columns.pilasters;
    expect(P.assumption).toBe(true);
    expect(P.items).toEqual([
      { wall: 'x0', d0: 11.45, d1: 12.10 },
      { wall: 'x1', d0: 14.10, d1: 14.65 },
    ]);
  });

  it('витражи ВБ6/ВБ3 и окна ОК16* доведены до расширенной оконной зоны торцов', () => {
    const W = FOYER.windows;
    for (const k of ['vb6', 'vb3']) {
      expect(W[k].x0).toBe(-12.18);
      expect(W[k].x1).toBe(11.81);
    }
    expect(W.ok16.find((o) => o.wall === 'x0').x).toBe(FOYER.endWallStep.xWin0);
    expect(W.ok16.find((o) => o.wall === 'x1').x).toBe(FOYER.endWallStep.xWin1);
    // ОК16* целиком в оконной зоне при любой высоте
    for (const o of W.ok16) expect(o.d1).toBeLessThan(foyerEndWallStepD(o.y0));
  });

  it('M9: витраж ВБ3 — рёбра 0,25 м, подоконная полка 0,95 м, ригели со шторами 2,05 м и под потолком (0,12 × 0,05)', () => {
    const V = FOYER.windows.vb3;
    expect(V.ribDepth).toBe(0.25);
    expect(V.d + V.ribDepth).toBeCloseTo(-0.55, 6);
    expect(V.sill).toEqual({ y0: 3.90, y1: 3.95, depth: 0.12 });
    expect(V.sill.y1 - FOYER.room.y2).toBeCloseTo(0.95, 6); // верх полки — 0,95 м над полом 2-го эт.
    expect(V.rails).toEqual([{ y0: 5.05, y1: 5.10, depth: 0.12 }, { y0: 9.15, y1: 9.20, depth: 0.12 }]);
    expect(V.rails[0].y0 - FOYER.room.y2).toBeCloseTo(2.05, 6);
    expect(V.rails[1].y1).toBe(V.y1);
  });

  it('все оценочные по фото элементы помечены флагом assumption', () => {
    expect(FOYER.ceil2.rampAssumption).toBe(true);
    expect(FOYER.smallStairs.assumption).toBe(true);
    expect(FOYER.zones.elevator.assumption).toBe(true);
    expect(FOYER.columns.pilasters.assumption).toBe(true);
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
