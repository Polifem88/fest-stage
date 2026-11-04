// Общий построитель квадратных ферм 30 × 30 (труба Ø50, раскосы Ø16): линия вдоль оси и вертикальная вставка.
// Возвращает массив геометрий труб; материал задаёт площадка (чёрный металл или алюминий) в batch.add.
import { P } from '../../core/geom.js';
import { tubeBetween } from './build.js';

export const LACE_PITCH = 0.3; // шаг раскосов решётки (≈ 45° при сечении 0,30)
export const TRUSS_SEG = { desktop: { chord: 8, lacing: 5 }, mobile: { chord: 6, lacing: 4 } };

/** Четыре пояса квадратной фермы: смещения поперёк оси [поперёк, высота]. */
export function chordOffsets(T) {
  const s = T.size / 2 - T.tube / 2;
  return [[-s, T.y0 + T.tube / 2], [s, T.y0 + T.tube / 2], [-s, T.y1 - T.tube / 2], [s, T.y1 - T.tube / 2]];
}

/**
 * Ферма вдоль линии l (axis 'd' — вдоль X на d = at; 'x' — вдоль d на x = at).
 * На компьютере — 4 пояса, раскосы 4 граней и торцевые рамки; на телефоне — только 4 пояса.
 */
export function trussLineTubes(l, T, { mobile = false } = {}) {
  const seg = mobile ? TRUSS_SEG.mobile : TRUSS_SEG.desktop;
  const r = T.tube / 2, rb = T.brace / 2;
  const pt = (along, across, y) => (l.axis === 'd' ? P(along, y, l.at + across) : P(l.at + across, y, along));
  const out = [];
  const ch = chordOffsets(T);
  for (const [c, y] of ch) out.push(tubeBetween(pt(l.a0, c, y), pt(l.a1, c, y), r, seg.chord));
  if (mobile) return out;
  const len = l.a1 - l.a0;
  const n = Math.max(1, Math.round(len / LACE_PITCH));
  const [bl, br, tl, tr] = ch;
  // четыре грани: низ, верх, две боковые — зигзаг
  const faces = [[bl, br], [tl, tr], [bl, tl], [br, tr]];
  for (const [p, q] of faces) {
    for (let i = 0; i < n; i++) {
      const a0 = l.a0 + (len * i) / n, a1 = l.a0 + (len * (i + 1)) / n;
      const [u, v] = i % 2 ? [p, q] : [q, p];
      out.push(tubeBetween(pt(a0, u[0], u[1]), pt(a1, v[0], v[1]), rb, seg.lacing));
    }
  }
  // торцевые рамки
  for (const a of [l.a0, l.a1]) for (const [p, q] of [[bl, br], [tl, tr], [bl, tl], [br, tr]]) out.push(tubeBetween(pt(a, p[0], p[1]), pt(a, q[0], q[1]), rb, seg.lacing));
  return out;
}

/** Вертикальная стойка или вставка 30 × 30 от y0 до y1. */
export function trussPostTubes(post, T, { mobile = false } = {}) {
  const seg = mobile ? TRUSS_SEG.mobile : TRUSS_SEG.desktop;
  const r = T.tube / 2, rb = T.brace / 2, s = T.size / 2 - T.tube / 2;
  const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
  const out = corners.map(([cx, cd]) => tubeBetween(P(post.x + cx, post.y0, post.d + cd), P(post.x + cx, post.y1, post.d + cd), r, seg.chord));
  if (!mobile) {
    const h = post.y1 - post.y0;
    const n = Math.max(1, Math.round(h / LACE_PITCH));
    for (let k = 0; k < 4; k++) {
      const [ax, ad] = corners[k], [bx, bd] = corners[(k + 1) % 4];
      for (let i = 0; i < n; i++) {
        const y0 = post.y0 + (h * i) / n, y1 = post.y0 + (h * (i + 1)) / n;
        const [u, v] = i % 2 ? [[ax, ad], [bx, bd]] : [[bx, bd], [ax, ad]];
        out.push(tubeBetween(P(post.x + u[0], y0, post.d + u[1]), P(post.x + v[0], y1, post.d + v[1]), rb, seg.lacing));
      }
    }
  }
  return out;
}
