// Архитектура и конструкция Сцены под крышей:
//  • слой walls — пол, стены (рыжий кирпич / чёрные) с дверями и проёмом, тупик коридора, венткороба 9 и 11
//    с решёткой, кирпичные цоколи, I-колонны;
//  • слой ceiling — рифлёный настил, швеллеры, капитальные фермы (решётка Уоррена), одиночные диагонали,
//    V-косынки. Всё, что уходит в стены (балки к замурованным колоннам), обрезано контуром помещения.
// Все размеры — config/dimensions.js; здесь только визуальные константы деталей.
import * as THREE from 'three';
import { box, rect, wallWithHoles, P, clipSegmentToRects } from '../../../core/geom.js';
import { ROOF, CEIL_RECTS, NICHE9, insideRoom, roomPolygon } from '../config/dimensions.js';

// Визуальные константы деталей (не влияют на габариты помещения и развес)
const DOOR_RECESS = 0.08; // полотно двери утоплено в проём
const DOOR_SEAM = 0.012; // шов между створками двустворчатой двери
const FLANGE_T = 0.022; // полка I-колонны
const WEB_T = 0.014; // стенка I-колонны
const WEB_W = 0.08; // раскосы решётки капитальной фермы
const CHANNEL_W = 0.10; // ширина полки швеллера
const GRILLE_GAP = 0.004; // решётка венткороба — чуть перед гранью
const EPS = 1e-6;

/** Брус сечением w × h между точками p и q (THREE.Vector3): грань h — вертикальная. */
export function strut(p, q, w, h = w) {
  const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
  const hl = Math.hypot(dx, dz), len = Math.hypot(hl, dy);
  const g = new THREE.BoxGeometry(len, h, w);
  g.rotateZ(Math.atan2(dy, hl));
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  return g;
}

/** Части отрезка [x, y, d] → [x, y, d] внутри прямоугольников (в плане), высота — по ходу отрезка. */
export function clip3(a, b, rects) {
  const dx = b[0] - a[0], dd = b[2] - a[2];
  const tOf = (p) => (Math.abs(dx) > Math.abs(dd) ? (p[0] - a[0]) / dx : (p[1] - a[2]) / dd);
  if (Math.abs(dx) < EPS && Math.abs(dd) < EPS) return insideRoom(a[0], a[2], Math.min(a[1], b[1])) ? [[a, b]] : [];
  return clipSegmentToRects([a[0], a[2]], [b[0], b[2]], rects).map(([p, q]) => {
    const tp = tOf(p), tq = tOf(q);
    return [[p[0], a[1] + (b[1] - a[1]) * tp, p[1]], [q[0], a[1] + (b[1] - a[1]) * tq, q[1]]];
  });
}
const V = (p) => P(p[0], p[1], p[2]);

/** Многоугольник [x, d] → горизонтальная грань на высоте y (up: лицом вверх). */
function polygonFace(pts, y, up) {
  const shape = new THREE.Shape(pts.map(([x, d]) => new THREE.Vector2(x, up ? d : -d)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Лицевая сторона стены — к полу помещения. */
function wallFacing(w) {
  const mid = (w.a0 + w.a1) / 2;
  return w.axis === 'x' ? (insideRoom(w.at + 0.01, mid) ? 1 : -1) : (insideRoom(mid, w.at + 0.01) ? 1 : -1);
}

/** Полотно двери в проёме стены + откосы. */
function addDoor(batch, M, w, dr, facing) {
  const shift = -facing * DOOR_RECESS;
  const at = w.at + shift;
  const lo = Math.min(w.at, at), hi = Math.max(w.at, at);
  const leaves = dr.double
    ? [[dr.a0, (dr.a0 + dr.a1) / 2 - DOOR_SEAM / 2], [(dr.a0 + dr.a1) / 2 + DOOR_SEAM / 2, dr.a1]]
    : [[dr.a0, dr.a1]];
  for (const [a0, a1] of leaves) batch.add('walls', M.door, rect(w.axis, at, a0, a1, 0, dr.h, facing));
  if (dr.double) batch.add('walls', M.blackWall, rect(w.axis, at - shift * 0.02, (dr.a0 + dr.a1) / 2 - DOOR_SEAM / 2, (dr.a0 + dr.a1) / 2 + DOOR_SEAM / 2, 0, dr.h, facing));
  if (w.axis === 'd') {
    batch.add('walls', M.blackWall, [
      rect('x', dr.a0, lo, hi, 0, dr.h, 1), rect('x', dr.a1, lo, hi, 0, dr.h, -1), rect('y', dr.h, dr.a0, dr.a1, lo, hi, -1),
    ]);
  } else {
    batch.add('walls', M.blackWall, [
      rect('d', dr.a0, lo, hi, 0, dr.h, 1), rect('d', dr.a1, lo, hi, 0, dr.h, -1), rect('y', dr.h, lo, hi, dr.a0, dr.a1, -1),
    ]);
  }
}

export function buildArchitecture(batch, M, { mobile = false } = {}) {
  const C = ROOF.room.ceiling;
  const poly = roomPolygon();

  // ===========================================================================
  //  1. ПОЛ И СТЕНЫ
  // ===========================================================================
  batch.add('walls', M.floor, polygonFace(poly, 0, true), { tag: 'floor' });

  for (const w of ROOF.walls) {
    const facing = wallFacing(w);
    const h = w.h ?? C;
    const doors = w.part ? [] : ROOF.doors.filter((dr) => dr.wall === w.id);
    const holes = doors.map((dr) => ({ a0: dr.a0, a1: dr.a1, b0: -0.01, b1: dr.h }));
    const mat = w.finish === 'brick' ? M.brickRed : M.blackWall;
    batch.add('walls', mat, wallWithHoles(w.axis, w.at, Math.min(w.a0, w.a1), Math.max(w.a0, w.a1), 0, h, facing, holes), { tag: `wall${w.id}` });
    for (const dr of doors) addDoor(batch, M, w, dr, facing);
  }

  // венткороб 8.1 + 9: верх короба на 2,50 и ниша над ним до плоскости стены 8
  const v9 = ROOF.vent9;
  batch.add('walls', M.blackWall, [
    rect('y', v9.y, v9.x0, v9.x1, v9.d0, v9.d1, 1),
    rect('d', v9.d0, v9.x0, v9.x1, v9.y, C, 1), // стена 8 продолжается выше 2,50
    rect('x', v9.x0, v9.d0, v9.d1, v9.y, C, 1), // бок полноразмерного короба за сегментом A
  ], { tag: 'vent9' });

  // венткороб 11: решётка на лицевой грани (чёрное поле + сетка)
  const v11 = ROOF.vent11, gr = v11.grille;
  batch.add('walls', M.attic, rect('x', v11.x1 + GRILLE_GAP, gr.d0, gr.d1, gr.y0, gr.y1, 1), { tag: 'grille' });
  batch.add('walls', M.mesh, rect('x', v11.x1 + GRILLE_GAP * 2, gr.d0, gr.d1, gr.y0, gr.y1, 1), { tag: 'grille', shadow: false });

  // кирпичные цоколи стен 10 и 12
  for (const p of ROOF.plinths) {
    batch.add('walls', M.brickRed, [
      rect('y', p.h, p.x0, p.x1, p.d0, p.d1, 1),
      rect('x', p.x1, p.d0, p.d1, 0, p.h, 1),
      rect('d', p.d0, p.x0, p.x1, 0, p.h, -1),
      rect('d', p.d1, p.x0, p.x1, 0, p.h, 1),
    ], { tag: 'plinth' });
  }

  // проём 2,25 и тёмный тупик коридора
  const cr = ROOF.corridor;
  batch.add('walls', M.floor, rect('y', 0, cr.x0, cr.x1, cr.d0, cr.d1, 1), { tag: 'floor' });
  batch.add('walls', M.attic, [
    rect('x', cr.x0, cr.d0, cr.d1, 0, C, 1),
    rect('x', cr.x1, cr.d0, cr.d1, 0, C, -1),
    rect('d', cr.d1, cr.x0, cr.x1, 0, C, -1),
    rect('y', C, cr.x0, cr.x1, cr.d0, cr.d1, -1),
  ], { tag: 'corridor', shadow: false });

  // I-колонны (полки перпендикулярны X); замурованные не рисуются, часть в стене — отрезается
  const cols = [];
  const colTop = ROOF.capital.y1;
  for (const c of ROOF.columns) {
    if (c.embedded) continue;
    const h = c.w / 2;
    const flanges = [[c.x - h, c.x - h + FLANGE_T], [c.x + h - FLANGE_T, c.x + h]];
    for (const [x0, x1] of flanges) if (insideRoom((x0 + x1) / 2, c.d)) cols.push(box(x0, x1, 0, colTop, c.d - h, c.d + h));
    const wx0 = Math.max(c.x - h + FLANGE_T, ROOF.room.x0), wx1 = Math.min(c.x + h - FLANGE_T, ROOF.room.x1);
    cols.push(box(wx0, wx1, 0, colTop, c.d - WEB_T / 2, c.d + WEB_T / 2));
  }
  batch.add('walls', M.steel, cols, { tag: 'columns' });

  // ===========================================================================
  //  2. ПОТОЛОК И КОНСТРУКЦИЯ
  // ===========================================================================
  // рифлёный настил (низ — отметка потолка) по контуру помещения и в нише над стеной 9
  batch.add('ceiling', M.deckRibbed, [polygonFace(poly, C, false), rect('y', C, NICHE9[0], NICHE9[1], NICHE9[2], NICHE9[3], -1)], { tag: 'deck', shadow: false });

  const steel = [];
  // швеллеры вдоль d с шагом channels.step
  const CH = ROOF.channels;
  for (let x = ROOF.room.x0 + CH.step / 2; x < ROOF.room.x1; x += CH.step) {
    for (const [p, q] of clipSegmentToRects([x, ROOF.room.d0], [x, ROOF.room.d1], CEIL_RECTS)) {
      steel.push(box(x - CHANNEL_W / 2, x + CHANNEL_W / 2, CH.y0, CH.y1, p[1], q[1]));
    }
  }

  // капитальные фермы: пояса 0,15 × 0,15 и решётка Уоррена ~45°
  const K = ROOF.capital, c2 = K.chord / 2;
  const yb = K.y0 + c2, yt = K.y1 - c2; // оси поясов
  const step = (yt - yb) / Math.tan((K.webAngle * Math.PI) / 180);
  for (const l of K.lines) {
    const a = l.axis === 'x' ? [l.at, l.a0] : [l.a0, l.at];
    const b = l.axis === 'x' ? [l.at, l.a1] : [l.a1, l.at];
    for (const [p, q] of clipSegmentToRects(a, b, CEIL_RECTS)) {
      if (l.axis === 'x') {
        const d0 = Math.min(p[1], q[1]), d1 = Math.max(p[1], q[1]);
        steel.push(box(l.at - c2, l.at + c2, K.y0, K.y0 + K.chord, d0, d1), box(l.at - c2, l.at + c2, K.y1 - K.chord, K.y1, d0, d1));
      } else {
        const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]);
        steel.push(box(x0, x1, K.y0, K.y0 + K.chord, l.at - c2, l.at + c2), box(x0, x1, K.y1 - K.chord, K.y1, l.at - c2, l.at + c2));
      }
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const n = Math.max(1, Math.round(L / step));
      const at = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      for (let i = 0; i < n; i++) {
        const [x0, d0] = at(i / n), [x1, d1] = at((i + 1) / n);
        const up = i % 2 === 0;
        steel.push(strut(P(x0, up ? yb : yt, d0), P(x1, up ? yt : yb, d1), WEB_W));
      }
      // стойки на концах куска (у стены / колонны)
      steel.push(strut(P(p[0], yb, p[1]), P(p[0], yt, p[1]), WEB_W), strut(P(q[0], yb, q[1]), P(q[0], yt, q[1]), WEB_W));
    }
  }

  // одиночные диагонали крест-накрест на уровне нижнего пояса
  const DG = ROOF.diagonals, yd = (DG.y0 + DG.y1) / 2;
  for (const [a, b] of DG.bays) {
    for (const [p, q] of clipSegmentToRects(a, b, CEIL_RECTS)) steel.push(strut(P(p[0], yd, p[1]), P(q[0], yd, q[1]), DG.w, DG.y1 - DG.y0));
  }

  // V-косынки: нога основание → узел, плечи узел → верх колонны и узел → середина пролёта
  for (const v of ROOF.vFrames) {
    const mid = (v.faceA + v.faceB) / 2;
    for (const face of [v.faceA, v.faceB]) {
      const dir = Math.sign(mid - face);
      const base = [v.x, 0, face], node = [v.x, v.node.y, face + dir * v.node.off];
      const top = [v.x, v.topY, face], centre = [v.x, v.topY, mid];
      for (const [a, b] of [[base, node], [node, top], [node, centre]]) {
        for (const [p, q] of clip3(a, b, ROOF.rects)) steel.push(strut(V(p), V(q), v.w));
      }
    }
  }
  batch.add('ceiling', M.steel, steel, { tag: 'structure' });
  return { mobile };
}
