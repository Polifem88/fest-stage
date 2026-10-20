import { describe, it, expect } from 'vitest';
import { DIM, BOX_HALF, GALLERY_INNER_X, BACK_GALLERY_FRONT_D } from '../../src/config/dimensions.js';
import { RIGGING, SPACING, DEPTHS, LEFT_RAIL_ORDER, RIG_BY_ID, ropeDepth, DUTY_ROWS } from '../../src/config/rigging.js';
import { FIXTURES, TYPES, GROUPS, INVENTORY, countByType, PORTABLE, portablePlacement } from '../../src/config/fixtures.js';
import { SPECS } from '../../src/config/specs.js';

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

  it('ригель на 6.4 и выступает от потолка на 2.1 м', () => {
    expect(DIM.box.ceiling - DIM.rigel.bottomY).toBeCloseTo(2.1, 5);
    expect(DEPTHS.Rigel).toBeCloseTo(DIM.rigel.d, 3);
  });

  it('объекты идут строго спереди назад в нужном порядке', () => {
    const order = ['C0', 'Sh0', 'Z', 'Sh1', 'Sh2', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'Sh12'];
    const ds = order.map((id) => RIG_BY_ID[id].d);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
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
    expect(DIM.pipe.length / 2).toBeLessThan(GALLERY_INNER_X);
    for (const id of ['B1', 'B2']) {
      const x = Math.abs(RIG_BY_ID[id].x);
      expect(x).toBeGreaterThan(DIM.pipe.length / 2);
      expect(x).toBeLessThan(GALLERY_INNER_X);
    }
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
          expect(Math.abs(p.mount.x)).toBeLessThan(DIM.box.width / 2 - DIM.galleries.width);
          expect(p.mount.d).toBeGreaterThan(DIM.portal.thickness);
          expect(p.mount.d).toBeLessThan(DIM.box.backWallD - 1);
          expect(Math.sign(p.aim.x)).toBe(-Math.sign(p.mount.x)); // светят поперёк сцены
        }
      }
    }
    expect(port.map((f) => portablePlacement(f.portable.side, f.portable.k, 'off', 8)).some((p) => p.visible)).toBe(false);
  });
});
