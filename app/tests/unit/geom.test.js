// Общие заготовки: обрезка отрезков контуром помещения, порядок справочника приборов.
import { describe, it, expect } from 'vitest';
import { clipSegmentToRects } from '../../src/core/geom.js';
import { TYPES } from '../../src/library/fixtureTypes.js';
import { SPECS } from '../../src/library/specs.js';

describe('clipSegmentToRects — части отрезка внутри объединения прямоугольников', () => {
  it('перекрывающиеся прямоугольники сливаются в один кусок', () => {
    expect(clipSegmentToRects([0, 0], [10, 0], [[2, 4, -1, 1], [3, 6, -1, 1]])).toEqual([[[2, 0], [6, 0]]]);
  });
  it('диагональ обрезается по прямоугольнику', () => {
    expect(clipSegmentToRects([0, 0], [10, 10], [[0, 5, 0, 5]])).toEqual([[[0, 0], [5, 5]]]);
  });
  it('мимо — пусто', () => {
    expect(clipSegmentToRects([0, 0], [1, 0], [[2, 3, 0, 1]])).toEqual([]);
  });
  it('два несмежных прямоугольника — два куска; направление отрезка сохраняется', () => {
    expect(clipSegmentToRects([10, 0], [0, 0], [[1, 2, -1, 1], [5, 7, -1, 1]])).toEqual([[[7, 0], [5, 0]], [[2, 0], [1, 0]]]);
  });
  it('смежные прямоугольники (общая грань) — один кусок', () => {
    expect(clipSegmentToRects([0, 0], [10, 0], [[0, 4, -1, 1], [4, 8, -1, 1]])).toEqual([[[0, 0], [8, 0]]]);
  });
});

describe('Справочник приборов', () => {
  it('LedPar 933 — последним ключом (цвета «чертежа» прежних типов не сдвинуты), есть паспорт', () => {
    expect(Object.keys(TYPES).at(-1)).toBe('LEDPAR933');
    expect(TYPES.LEDPAR933).toMatchObject({ name: 'Involight LedPar 933', shape: 'ledpar', beam: 25 });
    expect(SPECS.LEDPAR933).toBeTruthy();
  });
});
