// Фермы 30 × 30 (труба Ø32) Сцены под крышей: сетка 2,5 × 2,5, добавка у стены 3 и три вертикальные стойки.
// Жёсткий подвес к капитальным балкам и диагоналям (подвесы не моделируются — фермы примыкают к ним).
// На компьютере — пояса и решётка, на телефоне — только пояса (меньше треугольников).
import { box, P } from '../../../core/geom.js';
import { tubeBetween } from '../../_template/build.js';
import { ROOF } from '../config/dimensions.js';

// Визуальные константы
const LACE_PITCH = 0.3; // шаг раскосов решётки (≈ 45° при сечении 0,30)
const SEG = { desktop: { chord: 8, lacing: 5 }, mobile: { chord: 6, lacing: 4 } };
const PLATE = { size: 0.42, thick: 0.012 }; // опорная плита стойки

/** Четыре пояса квадратной фермы: смещения поперёк оси [поперёк, высота]. */
function chordOffsets(T) {
  const s = T.size / 2 - T.tube / 2;
  return [[-s, T.y0 + T.tube / 2], [s, T.y0 + T.tube / 2], [-s, T.y1 - T.tube / 2], [s, T.y1 - T.tube / 2]];
}

/** Ферма вдоль линии l (axis 'd' — вдоль X на d = at; 'x' — вдоль d на x = at). */
function trussLine(l, T, seg, lacing) {
  const r = T.tube / 2;
  const pt = (along, across, y) => (l.axis === 'd' ? P(along, y, l.at + across) : P(l.at + across, y, along));
  const out = [];
  const ch = chordOffsets(T);
  for (const [c, y] of ch) out.push(tubeBetween(pt(l.a0, c, y), pt(l.a1, c, y), r, seg.chord));
  if (!lacing) return out;
  const len = l.a1 - l.a0;
  const n = Math.max(1, Math.round(len / LACE_PITCH));
  const [bl, br, tl, tr] = ch;
  // четыре грани: низ, верх, две боковые — зигзаг
  const faces = [[bl, br], [tl, tr], [bl, tl], [br, tr]];
  for (const [p, q] of faces) {
    for (let i = 0; i < n; i++) {
      const a0 = l.a0 + (len * i) / n, a1 = l.a0 + (len * (i + 1)) / n;
      const [u, v] = i % 2 ? [p, q] : [q, p];
      out.push(tubeBetween(pt(a0, u[0], u[1]), pt(a1, v[0], v[1]), r * 0.6, seg.lacing));
    }
  }
  // торцевые рамки
  for (const a of [l.a0, l.a1]) for (const [p, q] of [[bl, br], [tl, tr], [bl, tl], [br, tr]]) out.push(tubeBetween(pt(a, p[0], p[1]), pt(a, q[0], q[1]), r * 0.6, seg.lacing));
  return out;
}

/** Вертикальная стойка 30 × 30 от пола до низа ферм. */
function trussLeg(leg, T, seg, lacing) {
  const r = T.tube / 2, s = T.size / 2 - T.tube / 2;
  const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
  const out = corners.map(([cx, cd]) => tubeBetween(P(leg.x + cx, 0, leg.d + cd), P(leg.x + cx, T.y0, leg.d + cd), r, seg.chord));
  if (lacing) {
    const n = Math.max(1, Math.round(T.y0 / LACE_PITCH));
    for (let k = 0; k < 4; k++) {
      const [ax, ad] = corners[k], [bx, bd] = corners[(k + 1) % 4];
      for (let i = 0; i < n; i++) {
        const y0 = (T.y0 * i) / n, y1 = (T.y0 * (i + 1)) / n;
        const [u, v] = i % 2 ? [[ax, ad], [bx, bd]] : [[bx, bd], [ax, ad]];
        out.push(tubeBetween(P(leg.x + u[0], y0, leg.d + u[1]), P(leg.x + v[0], y1, leg.d + v[1]), r * 0.6, seg.lacing));
      }
    }
  }
  return out;
}

export function buildTrusses(batch, M, { mobile = false } = {}) {
  const T = ROOF.trusses;
  const seg = mobile ? SEG.mobile : SEG.desktop;
  const lacing = !mobile;
  const tubes = [];
  for (const l of T.lines) tubes.push(...trussLine(l, T, seg, lacing));
  for (const leg of T.legs) tubes.push(...trussLeg(leg, T, seg, lacing));
  batch.add('trusses', M.truss, tubes, { tag: 'trusses' });
  const plates = T.legs.map((l) => box(l.x - PLATE.size / 2, l.x + PLATE.size / 2, 0, PLATE.thick, l.d - PLATE.size / 2, l.d + PLATE.size / 2));
  batch.add('trusses', M.steel, plates, { shadow: false });
}
