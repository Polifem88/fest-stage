// Фермы 30 × 30 (труба Ø50, раскосы Ø16) Сцены под крышей: сетка 2,5 × 2,5, добавка у стены 3 и три вертикальные стойки.
// Жёсткий подвес к капитальным балкам и диагоналям (подвесы не моделируются — фермы примыкают к ним).
// На компьютере — пояса и решётка, на телефоне — только пояса (меньше треугольников).
import { box } from '../../../core/geom.js';
import { trussLineTubes, trussPostTubes } from '../../_template/trusses.js';
import { ROOF } from '../config/dimensions.js';

// Визуальные константы
const PLATE = { size: 0.36, thick: 0.012 }; // опорная плита стойки

export function buildTrusses(batch, M, { mobile = false } = {}) {
  const T = ROOF.trusses;
  const tubes = [];
  for (const l of T.lines) tubes.push(...trussLineTubes(l, T, { mobile }));
  for (const leg of T.legs) tubes.push(...trussPostTubes({ x: leg.x, d: leg.d, y0: 0, y1: T.y0 }, T, { mobile }));
  batch.add('trusses', M.truss, tubes, { tag: 'trusses' });
  const plates = T.legs.map((l) => box(l.x - PLATE.size / 2, l.x + PLATE.size / 2, 0, PLATE.thick, l.d - PLATE.size / 2, l.d + PLATE.size / 2));
  batch.add('trusses', M.steel, plates, { shadow: false });
}
