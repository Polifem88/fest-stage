// Стационарная оранжевая бархатная ткань на ломаной лестнице (от верха до 4-й ступени снизу)
// и чёрный занавес под верхним маршем (проход 1,15 м за буфетом).
// Вся геометрия строго в слое 'curtain' — чистый задел для переключения/скрытия на Этапе 2.
import * as THREE from 'three';
import { P } from '../../../core/geom.js';
import { tubeBetween } from '../../_template/build.js';
import { FOYER } from '../config/dimensions.js';

// Визуальные пропорции трубы, хомутов и складок ткани, м
const PIPE_SEG_DESKTOP = 10;
const PIPE_SEG_MOBILE = 6;
const CLAMP_R = 0.012;
const CLAMP_SEG = 5;
const PLEAT_PITCH = 0.24;
const PLEAT_AMP = 0.035;
const PLEAT_SUBDIV_DESKTOP = 4;
const PLEAT_SUBDIV_MOBILE = 2;
const MOLTON_FOLD_AMP = 0.035;
const FLOOR_Y = 0;

/** Полотно со складками вдоль ломаной трубки (pts: [[x, y, d], ...]), свисающее до Y = 0. */
function buildPleatedDrapery(pts, segNormals, step) {
  // Строим узлы выборки (x, yTop, d, nx, nd, s) вдоль всей ломаной без разрывов на углах
  const samples = [];
  let sTotal = 0;

  for (let seg = 0; seg < pts.length - 1; seg++) {
    const a = pts[seg];
    const b = pts[seg + 1];
    const horizLen = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(2, Math.round(horizLen / step));
    const [nx, nd] = segNormals[seg];

    for (let i = 0; i <= n; i++) {
      // На стыке сегментов пропускаем дубль начальной точки, но усредняем нормаль угла
      if (seg > 0 && i === 0) {
        const prev = samples[samples.length - 1];
        const mx = prev.nx + nx;
        const md = prev.nd + nd;
        const ml = Math.hypot(mx, md) || 1;
        prev.nx = mx / ml;
        prev.nd = md / ml;
        continue;
      }
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const d = a[2] + (b[2] - a[2]) * t;
      const s = sTotal + horizLen * t;
      samples.push({ x, y, d, nx, nd, s });
    }
    sTotal += horizLen;
  }

  const cols = samples.length;
  const positions = new Float32Array((cols - 1) * 6 * 3);
  let ptr = 0;
  const pushV = (x, y, d) => {
    positions[ptr++] = x;
    positions[ptr++] = y;
    positions[ptr++] = -d;
  };

  for (let i = 0; i < cols - 1; i++) {
    const c0 = samples[i];
    const c1 = samples[i + 1];
    const w0 = PLEAT_AMP * Math.sin((c0.s / PLEAT_PITCH) * Math.PI * 2);
    const w1 = PLEAT_AMP * Math.sin((c1.s / PLEAT_PITCH) * Math.PI * 2);

    const x0 = c0.x + c0.nx * w0;
    const d0 = c0.d + c0.nd * w0;
    const x1 = c1.x + c1.nx * w1;
    const d1 = c1.d + c1.nd * w1;

    // Два треугольника на вертикальную полосу от трубы до пола Y = 0
    pushV(x0, c0.y, d0);
    pushV(x0, FLOOR_Y, d0);
    pushV(x1, FLOOR_Y, d1);

    pushV(x0, c0.y, d0);
    pushV(x1, FLOOR_Y, d1);
    pushV(x1, c1.y, d1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Чёрный занавес (мольтон) со складками, перекрывающий проход под верхним маршем лестницы. */
function buildUnderStairMolton(mobile) {
  const u = FOYER.curtain.underStairBlack;
  const w = u.x1 - u.x0;
  const h = u.y1 - u.y0;
  const subdiv = mobile ? PLEAT_SUBDIV_MOBILE : PLEAT_SUBDIV_DESKTOP;
  const seg = Math.max(6, Math.round(w / (PLEAT_PITCH / subdiv)));
  const g = new THREE.PlaneGeometry(w, h, seg, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, MOLTON_FOLD_AMP * Math.sin(((x + w / 2) / PLEAT_PITCH) * Math.PI * 2));
  }
  g.computeVertexNormals();
  g.translate((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, -u.d);
  return g;
}

export function buildCurtain(batch, M, { mobile = false } = {}) {
  const ST = FOYER.stairs;
  const CU = FOYER.curtain;
  const RL = FOYER.railing;
  const off = CU.pipeOffset;
  const pipeSeg = mobile ? PIPE_SEG_MOBILE : PIPE_SEG_DESKTOP;

  // 1. Опорные точки по линии перил открытой (атриумной) стороны ломаной лестницы
  const u0 = [ST.upper.xTop, CU.topY, ST.upper.d0];
  const u1 = [ST.upper.xBot, ST.landingY, ST.upper.d0];

  const [lowTopX, lowTopD] = ST.lower.top[0];
  const [lowBotX, lowBotD] = ST.lower.bottom[0];
  const ldx = lowBotX - lowTopX;
  const ldd = lowBotD - lowTopD;
  const llen = Math.hypot(ldx, ldd);
  // Внешняя горизонтальная нормаль в сторону атриума (−x, −d)
  const nLower = [ldd / llen, -ldx / llen];
  const nUpper = [0, -1];

  const landDx = lowTopX - u1[0];
  const landDd = lowTopD - u1[2];
  const landLen = Math.hypot(landDx, landDd);
  const nLanding = [landDd / landLen, -landDx / landLen];

  // Нижний марш обрывается на 4-й ступени снизу: t = (stopStepFromBottom - 1) / risers
  const tStop = (CU.stopStepFromBottom - 1) / ST.lower.risers;
  const stopX = lowBotX + (lowTopX - lowBotX) * tStop;
  const stopD = lowBotD + (lowTopD - lowBotD) * tStop;
  const stopY = ST.landingY * tStop;

  const l0 = [lowTopX, ST.landingY, lowTopD];
  const l1 = [stopX, stopY, stopD];

  // 2. Узлы трубы Ø32 мм, вынесенной наружу от линии перил на pipeOffset
  const p0 = [u0[0], u0[1], u0[2] - off];
  const p1 = [u1[0], u1[1], u1[2] - off];
  const p2 = [l0[0] + nLower[0] * off, l0[1], l0[2] + nLower[1] * off];
  const p3 = [l1[0] + nLower[0] * off, l1[1], l1[2] + nLower[1] * off];

  const pipePts = [p0, p1, p2, p3];
  const railPts = [u0, u1, l0, l1];
  const pipeGeoms = [];

  for (let i = 0; i < pipePts.length - 1; i++) {
    const a = pipePts[i];
    const b = pipePts[i + 1];
    pipeGeoms.push(tubeBetween(P(...a), P(...b), CU.pipeR, pipeSeg));

    // Хомуты-перемычки от стоек перил к трубе шторы
    const ra = railPts[i];
    const rb = railPts[i + 1];
    const segLen = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const clamps = Math.max(1, Math.round(segLen / RL.postStep));
    for (let k = 0; k <= clamps; k++) {
      if (i > 0 && k === 0) continue;
      const t = k / clamps;
      const rp = P(ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t);
      const pp = P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      pipeGeoms.push(tubeBetween(rp, pp, CLAMP_R, CLAMP_SEG));
    }
  }

  const pleatStep = PLEAT_PITCH / (mobile ? PLEAT_SUBDIV_MOBILE : PLEAT_SUBDIV_DESKTOP);
  const velvetGeo = buildPleatedDrapery(pipePts, [nUpper, nLanding, nLower], pleatStep);
  const moltonGeo = buildUnderStairMolton(mobile);

  batch.add('curtain', M.pipe, pipeGeoms);
  batch.add('curtain', M.velvetOrange, velvetGeo);
  batch.add('curtain', M.molton, moltonGeo);
}
