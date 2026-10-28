// Трансформируемый зал Сцены под крышей: станки 2 × 1 (рифлёный алюминий, ножки, чёрный фартук),
// стулья (InstancedMesh: обивка + каркас) и пульты (подиум, стол, корпус пульта, стул) — по планировке.
// Группа целиком заменяется движком при смене планировки (Stage.setLayout) и освобождается им же.
// Мешей (вызовов отрисовки) — 6 при любой планировке.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box } from '../../../core/geom.js';
import { placed, LAYOUTS } from '../config/layouts.js';

// Визуальные константы деталей (не влияют на габариты помещения и развес)
const DECK_T = 0.05; // настил станка
const LEG = 0.05; // сечение ножки
const LEG_IN = 0.06; // отступ ножки от края станка
const APRON_GAP = 0.004; // фартук чуть перед гранью станка
const TABLE = { w: 1.2, d: 0.6, top: 0.75, t: 0.03, leg: 0.04 }; // стол пульта 1,2 × 0,6, столешница на +0,75
const CONSOLE = { w: 0.9, d: 0.42, h: 0.12 }; // корпус пульта на столе
const CHAIR = { seatW: 0.44, seatD: 0.42, seatY: 0.45, seatT: 0.05, backH: 0.42, backT: 0.04, leg: 0.025 };

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

/** Стул в локальных координатах: центр сиденья над (0, 0), зритель смотрит в −Z (в +d). */
function chairGeometry() {
  const C = CHAIR;
  const B = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const fabric = [
    B(C.seatW, C.seatT, C.seatD, 0, C.seatY, 0),
    B(C.seatW, C.backH, C.backT, 0, C.seatY + C.backH / 2 + C.seatT, C.seatD / 2),
  ];
  const lx = C.seatW / 2 - C.leg, lz = C.seatD / 2 - C.leg;
  const frame = [
    ...[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z]) => B(C.leg, C.seatY, C.leg, x, C.seatY / 2, z)),
    ...[-lx, lx].map((x) => B(C.leg, C.backH + C.seatT, C.leg, x, C.seatY + (C.backH + C.seatT) / 2, lz)),
  ];
  return [mergeAll(fabric), mergeAll(frame)];
}

/** Направление «лицом» ряда → единичный вектор в плане (x, d). */
const FACE = { '+d': [0, 1], '-d': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

/** Станок/подиум: настил, 4 ножки, фартук с лицевой стороны. */
function addStand(s, facing, deck, legs, apron) {
  deck.push(box(s.x0, s.x1, s.h - DECK_T, s.h, s.d0, s.d1));
  const legH = s.h - DECK_T;
  if (legH > 0) {
    for (const x of [s.x0 + LEG_IN, s.x1 - LEG_IN - LEG]) for (const d of [s.d0 + LEG_IN, s.d1 - LEG_IN - LEG]) legs.push(box(x, x + LEG, 0, legH, d, d + LEG));
  }
  const [fx, fd] = FACE[facing];
  const g = APRON_GAP;
  if (fd > 0) apron.push(box(s.x0, s.x1, 0, legH, s.d1, s.d1 + g));
  if (fd < 0) apron.push(box(s.x0, s.x1, 0, legH, s.d0 - g, s.d0));
  if (fx > 0) apron.push(box(s.x1, s.x1 + g, 0, legH, s.d0, s.d1));
  if (fx < 0) apron.push(box(s.x0 - g, s.x0, 0, legH, s.d0, s.d1));
}

function staticMesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.userData.static = true; // «чертёж»: цвет слоя и рёбра
  m.userData.layer = 'hall';
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Группа слоя hall по планировке.
 * @param {{id:string, rows:number, shift:number}} st
 * @param {{M:Object, profile?:Object}} ctx
 */
export function buildHall(st, { M }) {
  const L = LAYOUTS.find((l) => l.id === st.id);
  const p = placed(st);
  const rowFacing = (s) => (p.rows.find((r) => s.x0 >= r.x0 - 1e-6 && s.x1 <= r.x1 + 1e-6 && s.d0 >= r.d0 - 1e-6 && s.d1 <= r.d1 + 1e-6) || p.rows[0]).facing;
  const deck = [], legs = [], apron = [], furniture = [];
  for (const s of p.stands) addStand(s, rowFacing(s), deck, legs, apron);

  // пульты: подиум, стол, корпус пульта, стул; лицом — как первый ряд планировки
  const facing = L.rows[0]?.facing || '+d';
  const [fx, fd] = FACE[facing];
  const [gF, gK] = chairGeometry();
  for (const pu of p.pults) {
    addStand(pu, facing, deck, legs, apron);
    const cx = (pu.x0 + pu.x1) / 2, cd = (pu.d0 + pu.d1) / 2, y = pu.h;
    const alongX = fd !== 0; // стол вдоль X, если смотрим по d
    const tw = alongX ? TABLE.w : TABLE.d, td = alongX ? TABLE.d : TABLE.w;
    const tcx = cx + fx * 0.15, tcd = cd + fd * 0.15; // стол ближе к лицевой стороне
    furniture.push(box(tcx - tw / 2, tcx + tw / 2, y + TABLE.top - TABLE.t, y + TABLE.top, tcd - td / 2, tcd + td / 2));
    for (const sx of [-1, 1]) for (const sd of [-1, 1]) {
      const lx = tcx + sx * (tw / 2 - TABLE.leg), ld = tcd + sd * (td / 2 - TABLE.leg);
      furniture.push(box(lx - TABLE.leg / 2, lx + TABLE.leg / 2, y, y + TABLE.top - TABLE.t, ld - TABLE.leg / 2, ld + TABLE.leg / 2));
    }
    const cw = alongX ? CONSOLE.w : CONSOLE.d, cdp = alongX ? CONSOLE.d : CONSOLE.w;
    furniture.push(box(tcx - cw / 2, tcx + cw / 2, y + TABLE.top, y + TABLE.top + CONSOLE.h, tcd - cdp / 2, tcd + cdp / 2));
    // стул оператора за столом
    const rot = new THREE.Matrix4().makeRotationY(-Math.atan2(fx, fd));
    const at = new THREE.Matrix4().makeTranslation(cx - fx * 0.45, y, -(cd - fd * 0.45)).multiply(rot);
    furniture.push(gF.clone().applyMatrix4(at), gK.clone().applyMatrix4(at));
  }

  const g = new THREE.Group();
  g.name = `hall:${st.id}`;
  // меши без деталей не добавляем (в «Пустом зале» станков нет)
  for (const [list, mat, name] of [[deck, M.aluDeck, 'hallDeck'], [legs, M.steel, 'hallLegs'], [apron, M.blackWall, 'hallApron'], [furniture, M.fixtureBody, 'hallPults']]) {
    if (list.length) g.add(staticMesh(mergeAll(list), mat, name));
  }

  // стулья: обивка (оранжевая) и каркас (чёрный) — по экземпляру на место
  const iF = new THREE.InstancedMesh(gF, M.seatFabric, p.seats.length);
  const iK = new THREE.InstancedMesh(gK, M.seatFrame, p.seats.length);
  const m = new THREE.Matrix4(), r = new THREE.Matrix4();
  p.seats.forEach((s, k) => {
    m.makeTranslation(s.x, s.y, -s.d).multiply(r.makeRotationY(-s.rotY));
    iF.setMatrixAt(k, m);
    iK.setMatrixAt(k, m);
  });
  iF.name = 'seatsFabric';
  iK.name = 'seatsFrame';
  for (const im of [iF, iK]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.userData.layer = 'hall';
    im.userData.seats = true;
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}
