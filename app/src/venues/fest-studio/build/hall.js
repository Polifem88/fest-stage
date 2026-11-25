// Телескопический зал-блитчер Студии мультимедиа (слой hall):
//  • buildHall(st, ctx) — терминальное состояние ('folded' = 0 мест у стены; 'unfolded' = 40 мест);
//  • animateHall(fromSt, toSt, ctx) — плавная двухфазная анимация раскладывания и сворачивания (~950 мс)
//    без пересоздания BufferGeometry в кадре.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, worldUV } from '../../../core/geom.js';
import { STUDIO } from '../config/dimensions.js';
import { bleacherPose, placed, placedAt } from '../config/layouts.js';

// Визуальные константы деталей
const DECK_T = 0.045; // толщина настила яруса
const RISER_T = 0.025; // толщина лицевого подступенка/фартука яруса
const CURTAIN_T = 0.014; // толщина боковой тканевой шторки
const CURTAIN_STEP_IN = 0.018; // уступ боковых шторок внутрь от верхнего яруса к нижнему (без z-fighting)
const RAIL_FRAME = 0.028; // сечение обвязки секций ограждения
const RAIL_BAR = 0.014; // сечение вертикальных прутьев ограждения
const RAIL_SIDE_OUT = 0.016; // вынос стоек боковых поручней по ярусам наружу от боковой грани
const ANIM_DURATION_MS = 950;

// Размеры кресел и стульев (согласованы со стульями Сцены под крышей: 0,44 × 0,42 м, спинка до ~0,82 м)
const CHAIR = {
  seatW: 0.44,
  seatD: 0.42,
  seatY: 0.42,
  seatT: 0.055,
  backH: 0.39,
  backT: 0.045,
  leg: 0.026,
  foldSeatY: 0.065, // высота сиденья сложенного пакета кресла (общая высота со спинкой ≤ 0,17 м < шага ярусов 0,30 м)
};

function mergeAll(list) {
  const out = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(out, false);
  for (const g of list) g.dispose();
  return m;
}

function staticMesh(geo, mat, name, bpRole = null) {
  if (mat?.map) worldUV(geo, mat.userData?.uvScale || 0.25);
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.userData.static = true;
  m.userData.layer = 'hall';
  if (bpRole) m.userData.bpRole = bpRole;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Боковая тканевая шторка блитчера: оранжевый тон в цвет кресел с тёплым рассеянным отсветом в тени под ярусами. */
function makeCurtainMat(M) {
  const base = M?.velvetOrange;
  if (!base?.clone) return base;
  const mat = base.clone();
  mat.name = 'velvetOrange';
  mat.color?.setHex(0xc4602a);
  mat.emissive?.setHex(0x6e2b0d);
  if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0.55;
  return mat;
}

/** Стул/кресло в разложенном вертикальном положении (центр сиденья над (0, 0), лицом в +d / −Z). */
function uprightSeatGeometry() {
  const C = CHAIR;
  const B = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const fabric = [
    B(C.seatW, C.seatT, C.seatD, 0, C.seatY, 0),
    B(C.seatW, C.backH, C.backT, 0, C.seatY + C.seatT / 2 + C.backH / 2, C.seatD / 2 - C.backT / 2),
  ];
  const lx = C.seatW / 2 - C.leg / 2;
  const lz = C.seatD / 2 - C.leg / 2;
  const frame = [
    ...[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z]) => B(C.leg, C.seatY, C.leg, x, C.seatY / 2, z)),
    ...[-lx, lx].map((x) => B(C.leg, C.backH + C.seatT, C.leg, x, C.seatY + (C.backH + C.seatT) / 2, lz)),
    B(C.seatW - C.leg * 2, C.leg, C.leg, 0, C.seatY - C.leg, 0),
  ];
  return [mergeAll(fabric), mergeAll(frame)];
}

/** Пакет сложенного кресла трибуны (спинка горизонтально вперёд поверх сиденья, высота ≤ 0,17 м). */
function foldedSeatBoxes(x, y, d) {
  const C = CHAIR;
  const ySeat0 = y + C.foldSeatY - C.seatT / 2;
  const ySeat1 = y + C.foldSeatY + C.seatT / 2;
  const yBack0 = ySeat1 + 0.004;
  const yBack1 = yBack0 + C.backT;
  const hw = C.seatW / 2, hd = C.seatD / 2;
  const fabric = [
    box(x - hw, x + hw, ySeat0, ySeat1, d - hd, d + hd),
    box(x - hw, x + hw, yBack0, yBack1, d - hd + 0.02, d - hd + 0.02 + C.backH),
  ];
  const lx = hw - C.leg / 2;
  const frame = [
    box(x - lx - C.leg / 2, x - lx + C.leg / 2, y, yBack0, d - hd, d + hd * 0.7),
    box(x + lx - C.leg / 2, x + lx + C.leg / 2, y, yBack0, d - hd, d + hd * 0.7),
  ];
  return { fabric, frame };
}

/** Заднее секционное ограждение вдоль X на глубине d, от y0 до y1. */
function backRailBoxes(br, mobile) {
  const out = [];
  const sections = 5;
  const span = (br.x1 - br.x0) / sections;
  const barStep = mobile ? 0.18 : 0.12;
  const r = RAIL_FRAME / 2, rb = RAIL_BAR / 2;
  for (let s = 0; s < sections; s++) {
    const sx0 = br.x0 + s * span + 0.015;
    const sx1 = br.x0 + (s + 1) * span - 0.015;
    // стойки секции, верхний и нижний ригели
    out.push(
      box(sx0, sx0 + RAIL_FRAME, br.y0, br.y1, br.d - r, br.d + r),
      box(sx1 - RAIL_FRAME, sx1, br.y0, br.y1, br.d - r, br.d + r),
      box(sx0, sx1, br.y1 - RAIL_FRAME, br.y1, br.d - r, br.d + r),
      box(sx0, sx1, br.y0 + 0.08, br.y0 + 0.08 + RAIL_FRAME * 0.8, br.d - r, br.d + r),
    );
    const inner = sx1 - sx0 - RAIL_FRAME * 2;
    const nBars = Math.max(2, Math.floor(inner / barStep));
    for (let i = 1; i < nBars; i++) {
      const bx = sx0 + RAIL_FRAME + (inner * i) / nBars;
      out.push(box(bx - rb, bx + rb, br.y0 + 0.08 + RAIL_FRAME * 0.8, br.y1 - RAIL_FRAME, br.d - rb, br.d + rb));
    }
  }
  return out;
}

/** Боковая секция поручня в локальных координатах (шарнир в начале (0, 0, 0), идёт вдоль +d / −Z длины len). */
function localSideRailGeometry(len, height, mobile) {
  const parts = [];
  const r = RAIL_FRAME / 2, rb = RAIL_BAR / 2;
  // задняя и передняя стойки, верхний поручень и нижняя перекладина
  parts.push(
    box(-r, r, 0, height, 0, RAIL_FRAME),
    box(-r, r, 0, height, len - RAIL_FRAME, len),
    box(-r, r, height - RAIL_FRAME, height, 0, len),
    box(-r, r, 0.08, 0.08 + RAIL_FRAME * 0.8, 0, len),
  );
  const barStep = mobile ? 0.18 : 0.11;
  const inner = len - RAIL_FRAME * 2;
  const nBars = Math.max(2, Math.floor(inner / barStep));
  for (let i = 1; i < nBars; i++) {
    const bd = RAIL_FRAME + (inner * i) / nBars;
    parts.push(box(-rb, rb, 0.08 + RAIL_FRAME * 0.8, height - RAIL_FRAME, bd - rb, bd + rb));
  }
  return mergeAll(parts);
}

/** Добавляет геометрию одного яруса (в глобальных координатах d0..d1, h): настил, подступенок и боковые шторки. */
function pushTierGeometry(t, prevDeckY, deckOut, steelOut, curtainOut) {
  // Настил яруса (верх M.aluDeck)
  deckOut.push(box(t.x0, t.x1, t.h - DECK_T, t.h, t.d0, t.d1));
  // Лицевой подступенок до предыдущего уровня (или до пола у 1-го яруса) и задняя планка базового яруса
  const yLow = Math.max(0, prevDeckY - 0.02);
  steelOut.push(box(t.x0, t.x1, yLow, t.h - DECK_T, t.d1 - RISER_T, t.d1));
  if (t.tier === STUDIO.bleacher.tiers) {
    steelOut.push(box(t.x0, t.x1, 0, t.h - DECK_T, t.d0, t.d0 + RISER_T));
  }
  // Оранжевые тканевые боковины от пола до низа настила (с небольшим уступом по ярусам без z-fighting)
  const inset = t.idxFromTop * CURTAIN_STEP_IN;
  const cd0 = t.d0 + 0.015, cd1 = t.d1 - 0.015;
  curtainOut.push(
    box(t.x0 + inset, t.x0 + inset + CURTAIN_T, 0.004, t.h - DECK_T, cd0, cd1),
    box(t.x1 - inset - CURTAIN_T, t.x1 - inset, 0.004, t.h - DECK_T, cd0, cd1),
  );
}

/** Полуступень лестничного прохода. */
function pushStepGeometry(s, deckOut, steelOut) {
  deckOut.push(box(s.x0, s.x1, s.y1 - DECK_T * 0.75, s.y1, s.d0, s.d1));
  steelOut.push(box(s.x0, s.x1, s.y0, s.y1 - DECK_T * 0.75, s.d0, s.d1));
}

/**
 * Построить терминальную статическую группу слоя 'hall' ('folded' или 'unfolded').
 */
export function buildHall(st, { M, profile } = {}) {
  const mobile = profile?.name === 'mobile';
  const isUnfolded = st?.id === 'unfolded';
  const p = placed(st);

  const deck = [];
  const steel = [];
  const curtains = [];
  const foldedFabric = [];
  const foldedFrame = [];

  for (const t of p.tiers) {
    const lowerY = isUnfolded ? (t.tier - 1) * STUDIO.bleacher.riser : 0;
    pushTierGeometry(t, lowerY, deck, steel, curtains);
  }
  if (isUnfolded) {
    for (const s of p.steps) pushStepGeometry(s, deck, steel);
  } else {
    // В свёрнутом состоянии кресла сложены горизонтально внутри/поверх пакета ярусов
    for (const bs of p.bleacherSeats) {
      const fb = foldedSeatBoxes(bs.x, bs.y, bs.d);
      foldedFabric.push(...fb.fabric);
      foldedFrame.push(...fb.frame);
    }
  }

  // Заднее ограждение и 8 боковых поручней
  steel.push(...backRailBoxes(p.backRail, mobile));
  for (const sr of p.sideRails) {
    const railGeo = localSideRailGeometry(sr.d1 - sr.d0, sr.y1 - sr.y0, mobile);
    const outShift = (sr.side === 'left' ? -1 : 1) * (sr.idxFromTop * RAIL_SIDE_OUT * 0.4);
    const m = new THREE.Matrix4()
      .makeTranslation(sr.x + outShift, sr.y0, -sr.d0)
      .multiply(new THREE.Matrix4().makeRotationY(-sr.splayRad));
    railGeo.applyMatrix4(m);
    steel.push(railGeo);
  }

  const g = new THREE.Group();
  g.name = `hall:${st?.id || 'folded'}`;
  const curtainMat = makeCurtainMat(M);
  for (const [list, mat, name, role] of [
    [deck, M.aluDeck, 'hallDeck', null],
    [steel, M.steel, 'hallSteel', null],
    [curtains, curtainMat, 'hallCurtains', null],
    [foldedFabric, M.seatFabric, 'hallFoldedFabric', 'seatF'],
    [foldedFrame, M.seatFrame, 'hallFoldedFrame', 'seatK'],
  ]) {
    if (list.length) g.add(staticMesh(mergeAll(list), mat, name, role));
  }

  // Активные места (0 в folded, 40 в unfolded: 32 кресла трибуны + 8 стульев 0-го ряда)
  const [gF, gK] = uprightSeatGeometry();
  const iF = new THREE.InstancedMesh(gF, M.seatFabric, p.seats.length);
  const iK = new THREE.InstancedMesh(gK, M.seatFrame, p.seats.length);
  const m = new THREE.Matrix4(), r = new THREE.Matrix4();
  p.seats.forEach((s, k) => {
    m.makeTranslation(s.x, s.y, -s.d).multiply(r.makeRotationY(-(s.rotY || 0)));
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
    if (p.seats.length > 0) im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}

/**
 * Плавная двухфазная анимация перехода между состояниями блитчера (~950 мс).
 * Все геометрии создаются один раз при старте перехода; update(k) меняет только матрицы узлов.
 */
export function animateHall(fromSt, toSt, { M, profile } = {}) {
  const mobile = profile?.name === 'mobile';
  const fromP = fromSt?.id === 'unfolded' ? 1 : 0;
  const toP = toSt?.id === 'unfolded' ? 1 : 0;
  const B = STUDIO.bleacher;
  const C = CHAIR;

  const group = new THREE.Group();
  group.name = 'hall:anim';

  // Заднее ограждение неподвижно на 4-м ярусе
  const pose0 = placedAt(bleacherPose(fromP));
  group.add(staticMesh(mergeAll(backRailBoxes(pose0.backRail, mobile)), M.steel, 'animBackRail'));

  // Общая геометрия бокового поручня (одна секция длины 0,88 м и высоты 0,85 м)
  const railLen = B.tierDepth - 0.07;
  const sharedSideRailGeo = localSideRailGeometry(railLen, B.sideRailH, mobile);

  // Общие геометрии ряда из 8 сидений и 8 шарнирных спинок (двигаются синхронно на каждом ярусе)
  const seatBasesF = [], seatBasesK = [], seatBacksF = [], seatBacksK = [];
  for (let k = 0; k < B.seatCountPerRow; k++) {
    const x = B.seatsX0 + B.seatPitch * (k + 0.5);
    const hw = C.seatW / 2, hd = C.seatD / 2, lx = hw - C.leg / 2, lz = hd - C.leg / 2;
    seatBasesF.push(new THREE.BoxGeometry(C.seatW, C.seatT, C.seatD).translate(x, 0, 0));
    seatBasesK.push(
      new THREE.BoxGeometry(C.leg, C.seatY, C.leg).translate(x - lx, -C.seatY / 2, -lz),
      new THREE.BoxGeometry(C.leg, C.seatY, C.leg).translate(x + lx, -C.seatY / 2, -lz),
      new THREE.BoxGeometry(C.leg, C.seatY, C.leg).translate(x - lx, -C.seatY / 2, lz),
      new THREE.BoxGeometry(C.leg, C.seatY, C.leg).translate(x + lx, -C.seatY / 2, lz),
    );
    // Спинка относительно оси шарнира на верхней грани сиденья: при повороте −90° вокруг X ложится ровно поверх подушки сиденья
    seatBacksF.push(new THREE.BoxGeometry(C.seatW, C.backH, C.backT).translate(x, C.backH / 2, C.backT / 2));
    seatBacksK.push(
      new THREE.BoxGeometry(C.leg, C.backH, C.leg).translate(x - lx, C.backH / 2, C.backT - C.leg / 2),
      new THREE.BoxGeometry(C.leg, C.backH, C.leg).translate(x + lx, C.backH / 2, C.backT - C.leg / 2),
    );
  }
  const rowSeatFGeo = mergeAll(seatBasesF);
  const rowSeatKGeo = mergeAll(seatBasesK);
  const rowBackFGeo = mergeAll(seatBacksF);
  const rowBackKGeo = mergeAll(seatBacksK);
  const curtainMat = makeCurtainMat(M);

  const tierRig = [];
  for (const t of pose0.tiers) {
    const tg = new THREE.Group();
    tg.name = `animTier:${t.tier}`;
    // Строим ярус в локальных координатах относительно d0 = 0 (z = 0 на задней кромке яруса)
    const localT = { ...t, d0: 0, d1: B.tierDepth };
    const tDeck = [], tSteel = [], tCurt = [];
    pushTierGeometry(localT, 0, tDeck, tSteel, tCurt);
    if (t.tier < B.tiers) {
      pushStepGeometry({ x0: B.stairX0, x1: B.stairX1, d0: 0, d1: B.halfStepD, y0: t.h, y1: t.h + B.halfStepH }, tDeck, tSteel);
    }
    tg.add(
      staticMesh(mergeAll(tDeck), M.aluDeck, `tierDeck:${t.tier}`),
      staticMesh(mergeAll(tSteel), M.steel, `tierSteel:${t.tier}`),
      staticMesh(mergeAll(tCurt), curtainMat, `tierCurt:${t.tier}`),
    );

    const railL = staticMesh(sharedSideRailGeo, M.steel, `railL:${t.tier}`);
    const railR = staticMesh(sharedSideRailGeo, M.steel, `railR:${t.tier}`);
    railL.position.set(B.x0 - t.idxFromTop * RAIL_SIDE_OUT * 0.4, t.h, -0.03);
    railR.position.set(B.x1 + t.idxFromTop * RAIL_SIDE_OUT * 0.4, t.h, -0.03);
    tg.add(railL, railR);

    // Подушка сиденья + ножки (поднимаются вдоль Y внутри яруса) и шарнирная спинка
    const seatGroup = new THREE.Group();
    const seatClipGroup = new THREE.Group(); // ножки не опускаются ниже пола при tFold = 0
    seatGroup.add(
      staticMesh(rowSeatFGeo, M.seatFabric, `seatF:${t.tier}`, 'seatF'),
      seatClipGroup,
    );
    const legsMesh = staticMesh(rowSeatKGeo, M.seatFrame, `seatK:${t.tier}`, 'seatK');
    seatClipGroup.add(legsMesh);

    const backPivot = new THREE.Group();
    backPivot.position.set(0, C.seatT / 2, C.seatD / 2 - C.backT);
    backPivot.add(
      staticMesh(rowBackFGeo, M.seatFabric, `backF:${t.tier}`, 'seatF'),
      staticMesh(rowBackKGeo, M.seatFrame, `backK:${t.tier}`, 'seatK'),
    );
    seatGroup.add(backPivot);
    tg.add(seatGroup);
    group.add(tg);
    tierRig.push({ tier: t.tier, idxFromTop: t.idxFromTop, h: t.h, tg, railL, railR, seatGroup, seatClipGroup, backPivot });
  }

  // Выходная нижняя полуступень (tier 0)
  const exitDeck = [], exitSteel = [];
  pushStepGeometry({ x0: B.stairX0, x1: B.stairX1, d0: 0, d1: B.halfStepD, y0: 0, y1: B.halfStepH }, exitDeck, exitSteel);
  const exitStepGrp = new THREE.Group();
  exitStepGrp.add(
    staticMesh(mergeAll(exitDeck), M.aluDeck, 'exitStepDeck'),
    staticMesh(mergeAll(exitSteel), M.steel, 'exitStepSteel'),
  );
  group.add(exitStepGrp);

  // 0-й приставной ряд стульев на полу (8 шт.)
  const [chairFGeo, chairKGeo] = uprightSeatGeometry();
  const chairsF = [], chairsK = [];
  for (let k = 0; k < B.seatCountPerRow; k++) {
    const x = B.seatsX0 + B.seatPitch * (k + 0.5);
    const m = new THREE.Matrix4().makeTranslation(x, 0, -B.row0D);
    chairsF.push(chairFGeo.clone().applyMatrix4(m));
    chairsK.push(chairKGeo.clone().applyMatrix4(m));
  }
  chairFGeo.dispose();
  chairKGeo.dispose();
  const row0Grp = new THREE.Group();
  row0Grp.name = 'animRow0';
  row0Grp.add(
    staticMesh(mergeAll(chairsF), M.seatFabric, 'row0F', 'seatF'),
    staticMesh(mergeAll(chairsK), M.seatFrame, 'row0K', 'seatK'),
  );
  group.add(row0Grp);

  const update = (k01) => {
    const p = fromP + (toP - fromP) * Math.min(1, Math.max(0, k01));
    const pose = bleacherPose(p);
    const cur = placedAt(pose);

    for (const tr of tierRig) {
      const ct = cur.tiers.find((x) => x.tier === tr.tier);
      tr.tg.position.set(0, 0, -ct.d0);
      const srL = cur.sideRails.find((x) => x.tier === tr.tier && x.side === 'left');
      const srR = cur.sideRails.find((x) => x.tier === tr.tier && x.side === 'right');
      tr.railL.rotation.y = -srL.splayRad;
      tr.railR.rotation.y = -srR.splayRad;

      const seatY = C.foldSeatY + (C.seatY - C.foldSeatY) * pose.tFold;
      tr.seatGroup.position.set(0, tr.h + seatY, -B.seatSetbackFromRear);
      tr.seatClipGroup.scale.set(1, Math.max(0.12, seatY / C.seatY), 1);
      // При tFold = 0 спинка ложится вперёд (−Z / +d) поверх сиденья: поворот −90° вокруг X
      tr.backPivot.rotation.x = -(Math.PI / 2) * (1 - pose.tFold);
    }

    const ex = cur.steps.find((s) => s.tier === 0);
    exitStepGrp.position.set(0, 0, -ex.d0);

    if (pose.tChairs <= 0.001) {
      row0Grp.visible = false;
    } else {
      row0Grp.visible = true;
      row0Grp.scale.set(1, pose.tChairs, 1);
    }
  };

  update(0);
  return { group, duration: ANIM_DURATION_MS, update, dispose: () => {} };
}
