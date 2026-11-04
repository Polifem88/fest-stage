// Алюминиевые фермы 30 × 30 (труба Ø50, раскосы Ø16) Студии мультимедиа:
// верхняя решётка (5,20…5,50), нижние П-образные фермы (3,25…3,55) и три вертикальные вставки (3,55…5,20).
// Строятся через общий построитель venues/_template/trusses.js, материал — M.trussAlu.
import { trussLineTubes, trussPostTubes } from '../../_template/trusses.js';
import { STUDIO } from '../config/dimensions.js';

export function buildTrusses(batch, M, { mobile = false } = {}) {
  const T = STUDIO.trusses;
  const upperT = { size: T.size, tube: T.tube, brace: T.brace, y0: T.upper.y0, y1: T.upper.y1 };
  const lowerT = { size: T.size, tube: T.tube, brace: T.brace, y0: T.lower.y0, y1: T.lower.y1 };
  const tubes = [];
  for (const l of T.upper.lines) tubes.push(...trussLineTubes(l, upperT, { mobile }));
  for (const l of T.lower.lines) tubes.push(...trussLineTubes(l, lowerT, { mobile }));
  for (const p of T.posts) tubes.push(...trussPostTubes(p, T, { mobile }));
  batch.add('trusses', M.trussAlu, tubes, { tag: 'trusses' });
}
