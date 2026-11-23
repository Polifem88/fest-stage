// =============================================================================
//  Алюминиевая система ферм Q25/31 (250 × 250 мм, труба Ø40, раскосы Ø16) Фойе:
//    1) 5 продольных горизонтальных линий (ФВ-1, ФВ-2, ФВ-2М, ФВ-3, ФВ-4);
//    2) 6 поперечных веток (оконная 8,00 + вертикальный опуск 1,00 + атриум 7,00 + уклон 7,00→6,00);
//    3) 2 опорные стойки на пол 2-го этажа (С-1, С-2) + вынос от С-2 к ФВ-1;
//    4) Г-образная периметральная ферма 2-го этажа (низ +2,70, верх +2,95).
//  Осевые и вертикальные звенья строятся общим построителем venues/_template/trusses.js
//  (без модификации шаблона ради 100% паритета fest-roof и fest-studio);
//  наклонные и косые звенья — локальным построителем angledTrussTubes.
// =============================================================================
import * as THREE from 'three';
import { P } from '../../../core/geom.js';
import { tubeBetween } from '../../_template/build.js';
import { trussLineTubes, trussPostTubes, TRUSS_SEG, LACE_PITCH } from '../../_template/trusses.js';
import { FOYER } from '../config/dimensions.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_UP = new THREE.Vector3(1, 0, 0);
const MIN_SEG_LEN = 1e-6;
const MIN_CROSS_SQ = 1e-8;

/**
 * Квадратная 4-поясная ферма Q25/31 вдоль произвольного 3D-отрезка между точками
 * нижнего центра p0 = [x, y0, d] и p1 = [x, y0, d].
 * На мобильном строит только 4 пояса (6-гранные цилиндры); на десктопе — пояса,
 * зигзагообразные раскосы по всем 4 граням и торцевые рамки.
 */
export function angledTrussTubes(p0, p1, T, { mobile = false } = {}) {
  const a = P(p0[0], p0[1], p0[2]);
  const b = P(p1[0], p1[1], p1[2]);
  const vec = b.clone().sub(a);
  const len = vec.length();
  if (len < MIN_SEG_LEN) return [];

  const dir = vec.clone().divideScalar(len);
  const side = new THREE.Vector3().crossVectors(dir, WORLD_UP);
  if (side.lengthSq() < MIN_CROSS_SQ) side.crossVectors(dir, FALLBACK_UP);
  side.normalize();
  const orthoUp = new THREE.Vector3().crossVectors(side, dir).normalize();

  const seg = mobile ? TRUSS_SEG.mobile : TRUSS_SEG.desktop;
  const r = T.tube / 2;
  const rb = T.brace / 2;
  const s = T.size / 2 - r;

  // 4 пояса в локальном сечении [поперёк (side), вверх от нижнего центра (orthoUp)]
  const ch = [
    [-s, r],
    [s, r],
    [-s, T.size - r],
    [s, T.size - r],
  ];
  const pt = (t, cs, cu) => a.clone()
    .addScaledVector(vec, t)
    .addScaledVector(side, cs)
    .addScaledVector(orthoUp, cu);

  const out = [];
  for (const [cs, cu] of ch) {
    out.push(tubeBetween(pt(0, cs, cu), pt(1, cs, cu), r, seg.chord));
  }
  if (mobile) return out;

  const [bl, br, tl, tr] = ch;
  const faces = [[bl, br], [tl, tr], [bl, tl], [br, tr]];
  const pitch = T.pitch || LACE_PITCH;
  const n = Math.max(1, Math.round(len / pitch));

  for (const [p, q] of faces) {
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const [u, v] = i % 2 ? [p, q] : [q, p];
      out.push(tubeBetween(pt(t0, u[0], u[1]), pt(t1, v[0], v[1]), rb, seg.lacing));
    }
  }

  // Торцевые рамки на обоих концах сегмента
  for (const t of [0, 1]) {
    for (const [p, q] of faces) {
      out.push(tubeBetween(pt(t, p[0], p[1]), pt(t, q[0], q[1]), rb, seg.lacing));
    }
  }
  return out;
}

/** Построить всю систему алюминиевых ферм Фойе строго в слой 'trusses' (материал M.trussAlu). */
export function buildTrusses(batch, M, { mobile = false } = {}) {
  const T = FOYER.trusses;
  const horizT = (y0) => ({ ...T, y0, y1: y0 + T.size });
  const tubes = [];

  // 1. 5 продольных горизонтальных линий (ФВ-1, ФВ-2, ФВ-2М, ФВ-3, ФВ-4)
  for (const l of T.longitudinal) {
    tubes.push(...trussLineTubes(l, horizT(l.y0), { mobile }));
  }

  // 2. 6 поперечных веток (оконная 8,00 + опуск 7,00..8,00 + атриум 7,00 + наклонная галерея 7,00→6,00)
  const winT = horizT(T.windowY0);
  const atrT = horizT(T.atriumY0);
  for (const x of T.transverseX) {
    tubes.push(...trussLineTubes({ axis: 'x', at: x, a0: T.windowD, a1: T.stepD }, winT, { mobile }));
    tubes.push(...trussPostTubes({ x, d: T.stepD, y0: T.atriumY0, y1: T.windowY0 }, T, { mobile }));
    tubes.push(...trussLineTubes({ axis: 'x', at: x, a0: T.stepD, a1: T.bendD }, atrT, { mobile }));
    tubes.push(...angledTrussTubes([x, T.atriumY0, T.bendD], [x, T.wallY0, T.wallD], T, { mobile }));
  }

  // 3. Опорные вертикальные стойки на пол 2-го этажа (С-1 и С-2) + вынос от С-2 к ФВ-1
  for (const p of T.posts) {
    tubes.push(...trussPostTubes(p, T, { mobile }));
    if (p.tieTo) {
      tubes.push(...angledTrussTubes([p.x, p.y1, p.d], p.tieTo, T, { mobile }));
    }
  }

  // 4. Периметральная Г-образная ферма 2-го этажа (западный ортогональный + южный скошенный луч)
  const perim = T.perimeter;
  tubes.push(...trussLineTubes(perim.west, horizT(perim.y0), { mobile }));
  const [[sx0, sd0], [sx1, sd1]] = perim.south;
  tubes.push(...angledTrussTubes([sx0, perim.y0, sd0], [sx1, perim.y0, sd1], T, { mobile }));

  batch.add('trusses', M.trussAlu, tubes, { tag: 'trusses' });
}
