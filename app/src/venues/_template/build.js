// =============================================================================
//  ШАБЛОН «ЧЁРНЫЙ КАБИНЕТ» — построение геометрии по конфигурации (cfg).
//  Коробка зала (стены, потолок, пол площадки и зрительской части), ряды кресел
//  (InstancedMesh), неподвижные треугольные фермы с жёсткими подвесами к потолку,
//  лампы дежурного и зального света. Никаких чисел площадки здесь нет — только из cfg
//  (кроме мелких визуальных зазоров и пропорций кресла/лампы).
// =============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, rect, P } from '../../core/geom.js';
import { trussDs, trussXRange, trussChords, triHeight, hangerXs, seatLayout, rowFrontD, rowFloorY } from './layout.js';

/** Слои по умолчанию (cfg.layerOf может переназначить). */
const LAYER_OF = { walls: 'walls', stageFloor: 'walls', hallFloor: 'hall', seats: 'hall', trusses: 'trusses', duty: 'lights', house: 'hall' };
/** Материалы по умолчанию — ключи общей библиотеки core/materials.js (cfg.materials может переназначить). */
const MAT_OF = { walls: 'blackWall', ceiling: 'blackWall', stageFloor: 'floor', hallFloor: 'hallFloor', riser: 'stageEdge', truss: 'truss', hanger: 'truss', plate: 'steel', seatFabric: 'seatFabric', seatFrame: 'seatFrame', cord: 'pipe' };

/** Труба между точками p и q (THREE.Vector3), без торцов (их не видно) — вдвое меньше треугольников. */
export function tubeBetween(p, q, r, seg = 6) {
  const len = p.distanceTo(q);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), quat, new THREE.Vector3(1, 1, 1)));
  return g;
}

function mergeAll(list) {
  const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  for (const x of list) x.dispose();
  return g;
}

/**
 * Треугольная ферма вдоль X: 3 пояса + раскосы «зигзагом» на трёх гранях + торцевые рамки.
 * @param {Object} o
 * @param {number} o.x0, o.x1   концы фермы
 * @param {number} o.d          ось фермы по глубине
 * @param {number} o.bottomY    ось нижнего пояса (нижних поясов)
 * @param {number} o.side       сторона треугольника по осям поясов
 * @param {number} o.tube       диаметр труб поясов и раскосов
 * @param {number} o.pitch      шаг узлов раскосов вдоль фермы
 * @param {boolean} [o.apexUp]  вершиной вверх (два нижних пояса)
 * @param {{chord:number, lacing:number}} [o.seg] число граней труб
 * @returns {THREE.BufferGeometry} одна склеенная геометрия
 */
export function trussGeometry({ x0, x1, d, bottomY, side, tube, pitch, apexUp = true, seg = { chord: 8, lacing: 5 } }) {
  const h = triHeight(side), r = tube / 2;
  const sec = apexUp
    ? [[bottomY, d - side / 2], [bottomY, d + side / 2], [bottomY + h, d]]
    : [[bottomY, d], [bottomY + h, d - side / 2], [bottomY + h, d + side / 2]];
  const at = (k, x) => P(x, sec[k][0], sec[k][1]);
  const parts = [];
  for (let k = 0; k < 3; k++) parts.push(tubeBetween(at(k, x0), at(k, x1), r, seg.chord));
  const n = Math.max(1, Math.round((x1 - x0) / pitch));
  const faces = [[0, 1], [0, 2], [1, 2]];
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    for (const [a, b] of faces) {
      const [p, q] = i % 2 ? [at(b, xa), at(a, xb)] : [at(a, xa), at(b, xb)];
      parts.push(tubeBetween(p, q, r, seg.lacing));
    }
  }
  for (const x of [x0, x1]) for (const [a, b] of faces) parts.push(tubeBetween(at(a, x), at(b, x), r, seg.lacing));
  return mergeAll(parts);
}

/** Кресло в локальных координатах: передняя кромка сиденья в z = 0, зритель смотрит в −Z (в +d). */
function seatGeometry(pitch) {
  const B = (w, hh, dd, x, y, z) => new THREE.BoxGeometry(w, hh, dd).translate(x, y, z);
  const back = new THREE.BoxGeometry(pitch - 0.08, 0.6, 0.08).translate(0, 0.3, 0).rotateX(0.17).translate(0, 0.42, 0.5);
  const fabric = [B(pitch - 0.09, 0.08, 0.44, 0, 0.44, 0.24), back];
  // боковина с подлокотником — на левой границе места (общая для соседних кресел)
  const frame = [B(0.05, 0.62, 0.44, -pitch / 2, 0.31, 0.28), B(0.06, 0.05, 0.48, -pitch / 2, 0.645, 0.24)];
  return [mergeAll(fabric), mergeAll(frame)];
}

/** Ряды кресел: два InstancedMesh (обивка + каркас) на весь зал. */
export function buildSeats(M, cfg, mat = MAT_OF) {
  const H = cfg.hall;
  const { seats, blockEdges } = seatLayout(cfg);
  const [gF, gK] = seatGeometry(H.seatPitch);
  const iF = new THREE.InstancedMesh(gF, M[mat.seatFabric], seats.length);
  const iK = new THREE.InstancedMesh(gK, M[mat.seatFrame], seats.length + blockEdges.length);
  const m = new THREE.Matrix4();
  seats.forEach((s, k) => {
    m.makeTranslation(s.x, s.y, -s.d);
    iF.setMatrixAt(k, m);
    iK.setMatrixAt(k, m);
  });
  // замыкающая боковина справа в конце каждого блока
  blockEdges.forEach((e, k) => { m.makeTranslation(e.x + H.seatPitch / 2, e.y, -e.d); iK.setMatrixAt(seats.length + k, m); });
  for (const im of [iF, iK]) { im.castShadow = true; im.receiveShadow = true; im.userData.seats = true; im.computeBoundingSphere(); }
  iF.name = 'seatsFabric';
  iK.name = 'seatsFrame';
  return [iF, iK];
}

/**
 * Лампы дежурного света (свисают с нижнего пояса указанных ферм) и зального (диски на потолке).
 * Соглашение движка: emitters.duty / emitters.house — группы; у светящихся мешей userData.emitter.
 */
export function buildEmitters(M, cfg, mat = MAT_OF) {
  const groups = { duty: new THREE.Group(), house: new THREE.Group() };
  groups.duty.name = 'dutyEmitters';
  groups.house.name = 'houseEmitters';
  const E = cfg.emitters;
  const ds = trussDs(cfg);
  const cords = [], bulbs = [], dutyRows = [];
  for (const ti of E.duty.trusses) {
    const [y0, dChord] = trussChords(cfg, ds[ti]).bottom[0];
    const yb = y0 - E.duty.drop;
    const row = [];
    for (const x of E.duty.xs) {
      cords.push(tubeBetween(P(x, y0, dChord), P(x, yb + E.duty.bulbR * 2, dChord), 0.008, 4));
      cords.push(new THREE.CylinderGeometry(E.duty.bulbR * 0.85, E.duty.bulbR * 0.6, E.duty.bulbR, 10).translate(x, yb + E.duty.bulbR * 1.9, -dChord)); // патрон
      bulbs.push(new THREE.SphereGeometry(E.duty.bulbR, 14, 10).scale(1, 1.35, 1).translate(x, yb + E.duty.bulbR, -dChord));
      row.push(P(x, yb + E.duty.bulbR, dChord));
    }
    dutyRows.push(row);
  }
  const bulbMesh = new THREE.Mesh(mergeAll(bulbs), M.dutyBulb);
  bulbMesh.userData.emitter = 'duty';
  groups.duty.add(new THREE.Mesh(mergeAll(cords), M[mat.cord]), bulbMesh);
  const lamps = [];
  for (const d of E.house.ds) for (const x of E.house.xs) lamps.push(new THREE.CircleGeometry(E.house.r, 16).rotateX(Math.PI / 2).translate(x, cfg.room.ceiling - 0.01, -d));
  const hl = new THREE.Mesh(mergeAll(lamps), M.houseLamp);
  hl.userData.emitter = 'house';
  groups.house.add(hl);
  for (const g of Object.values(groups)) g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { groups, dutyRows };
}

/**
 * Построить чёрный кабинет целиком. ctx — контекст движка (venues/contract.js → BuildCtx).
 * @returns {{ emitters: {duty, house}, dutyRows: THREE.Vector3[][] }}
 */
export function buildBlackBox(ctx, cfg) {
  const { batch, M } = ctx;
  const L = { ...LAYER_OF, ...cfg.layerOf };
  const mat = { ...MAT_OF, ...cfg.materials };
  const R = cfg.room, S = cfg.stage, H = cfg.hall, T = cfg.trusses;
  const mobile = ctx.profile?.name === 'mobile';

  // --- пол: игровая площадка и зрительская часть (стык по S.d0, без наложения)
  batch.add(L.stageFloor, M[mat.stageFloor], rect('y', 0, R.x0, R.x1, S.d0, R.d1, 1), { tag: 'stageFloor' });
  batch.add(L.hallFloor, M[mat.hallFloor], rect('y', 0, R.x0, R.x1, R.d0, S.d0, 1), { tag: 'hallFloor' });
  // подъёмы рядов (если riser > 0)
  if (H.riser > 0) {
    const risers = [];
    for (let r = 1; r < H.rows; r++) {
      const front = rowFrontD(cfg, r) + (H.rowPitch - H.seatDepth) / 2;
      const back = r === H.rows - 1 ? R.d0 : rowFrontD(cfg, r + 1) + (H.rowPitch - H.seatDepth) / 2;
      risers.push(box(R.x0, R.x1, 0, rowFloorY(cfg, r), back, front));
    }
    batch.add(L.hallFloor, M[mat.riser], risers);
  }

  // --- стены (видны изнутри, снаружи «прозрачны» — как в кукольном домике) и потолок
  batch.add(L.walls, M[mat.walls], [
    rect('x', R.x0, R.d0, R.d1, 0, R.ceiling, 1),
    rect('x', R.x1, R.d0, R.d1, 0, R.ceiling, -1),
    rect('d', R.d1, R.x0, R.x1, 0, R.ceiling, -1),
    rect('d', R.d0, R.x0, R.x1, 0, R.ceiling, 1),
  ]);
  batch.add(L.walls, M[mat.ceiling], rect('y', R.ceiling, R.x0, R.x1, R.d0, R.d1, -1), { tag: 'ceiling', shadow: false });

  // --- фермы и жёсткие подвесы к потолку
  const [x0, x1] = trussXRange(cfg);
  const seg = (mobile && T.segMobile) || T.seg;
  const trusses = [], hangers = [], plates = [];
  const plate = T.plate;
  for (const d of trussDs(cfg)) {
    trusses.push(trussGeometry({ x0, x1, d, bottomY: T.bottomY, side: T.side, tube: T.tube, pitch: T.lacingPitch, apexUp: T.apexUp, seg }));
    const top = trussChords(cfg, d).top;
    const yTop = top[0][0] + T.tube / 2;
    for (const x of hangerXs(cfg)) {
      hangers.push(tubeBetween(P(x, yTop, d), P(x, R.ceiling - plate.thick, d), T.hangerTube / 2, seg.chord));
      // у фермы вершиной вниз подвес приходит между двумя верхними поясами — перемычка
      if (top.length > 1) hangers.push(tubeBetween(P(x, top[0][0], top[0][1]), P(x, top[1][0], top[1][1]), T.tube / 2, seg.lacing));
      plates.push(box(x - plate.size / 2, x + plate.size / 2, R.ceiling - plate.thick, R.ceiling, d - plate.size / 2, d + plate.size / 2));
    }
  }
  batch.add(L.trusses, M[mat.truss], trusses);
  batch.add(L.trusses, M[mat.hanger], hangers);
  batch.add(L.trusses, M[mat.plate], plates, { shadow: false });
  ctx.commitBatch();

  // --- кресла и лампы
  ctx.add(L.seats, ...buildSeats(M, cfg, mat));
  const em = buildEmitters(M, cfg, mat);
  ctx.add(L.duty, em.groups.duty);
  ctx.add(L.house, em.groups.house);
  return { emitters: em.groups, dutyRows: em.dutyRows };
}
