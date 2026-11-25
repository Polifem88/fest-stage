// =============================================================================
//  СТУДИЯ МУЛЬТИМЕДИА — телескопический зал-блитчер (4 яруса + 0-й ряд стульев, 40 мест).
//  Порядок LAYOUTS — часть формата ссылки (поле lo): только добавлять в конец.
//  По умолчанию блитчер свёрнут у стены операторской ('folded', 0 мест).
// =============================================================================
import { STUDIO } from './dimensions.js';

const B = STUDIO.bleacher;

export const LAYOUTS = [
  { id: 'folded', name: 'Свёрнут у стены', rowsMax: 0 },
  { id: 'unfolded', name: 'Разложен со стульями', rowsMax: 5 },
];

export const DEFAULT_LAYOUT = 'folded';
export const SHIFT_STEP = 0.5;

export function shiftRange() {
  return [0, 0];
}

export function seatCount(st) {
  return st?.id === 'unfolded' ? B.tiers * B.seatCountPerRow + B.seatCountPerRow : 0;
}

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Двухфазная поза блитчера по прогрессу раскладывания p ∈ [0, 1]:
 *  • p ∈ [0; 0,55]: выезд ярусов 1–3 и сведение боковых поручней при сложенных креслах;
 *  • p ∈ (0,55; 1]: подъём спинок 32 кресел и плавное появление 0-го ряда из 8 стульев.
 */
export function bleacherPose(p) {
  if (p <= 0) return { tSlide: 0, tFold: 0, tChairs: 0 };
  if (p >= 1) return { tSlide: 1, tFold: 1, tChairs: 1 };
  if (p <= 0.55) return { tSlide: smooth(p / 0.55), tFold: 0, tChairs: 0 };
  return {
    tSlide: 1,
    tFold: smooth((p - 0.55) / 0.45),
    tChairs: p <= 0.70 ? 0 : smooth((p - 0.70) / 0.30),
  };
}

/** Геометрическая раскладка ярусов, лестницы, кресел, стульев и поручней для произвольной позы. */
export function placedAt(pose) {
  const { tSlide, tFold, tChairs } = pose;
  const tiers = [];
  // Порядок от базового верхнего яруса (tier 4 на d = −7,90) к нижнему выдвижному (tier 1)
  for (let idx = 0; idx < B.tiers; idx++) {
    const tier = B.tiers - idx;
    const h = +(tier * B.riser).toFixed(4);
    const d0Fold = B.dBack + idx * B.foldedCascade;
    const d0Unfold = B.dBack + idx * B.tierDepth;
    const d0 = d0Fold + (d0Unfold - d0Fold) * tSlide;
    const d1 = d0 + B.tierDepth;
    tiers.push({ tier, idxFromTop: idx, x0: B.x0, x1: B.x1, d0, d1, h });
  }

  // Промежуточные полуступени лестничного прохода справа (x = 1,10 … 1,60)
  const steps = [];
  for (const t of tiers) {
    if (t.tier < B.tiers) {
      steps.push({
        tier: t.tier,
        x0: B.stairX0,
        x1: B.stairX1,
        d0: t.d0,
        d1: t.d0 + B.halfStepD,
        y0: t.h,
        y1: +(t.h + B.halfStepH).toFixed(4),
      });
    }
  }
  const tier1 = tiers.find((t) => t.tier === 1);
  const exitD0 = tier1.d1 - (B.halfStepD + 0.02) * (1 - tSlide);
  steps.push({
    tier: 0,
    x0: B.stairX0,
    x1: B.stairX1,
    d0: exitD0,
    d1: exitD0 + B.halfStepD,
    y0: 0,
    y1: B.halfStepH,
  });

  // 32 кресла трибуны (4 яруса × 8 кресел)
  const bleacherSeats = [];
  const backAngleRad = -(Math.PI / 2) * (1 - tFold);
  for (const t of tiers) {
    for (let k = 0; k < B.seatCountPerRow; k++) {
      bleacherSeats.push({
        tier: t.tier,
        col: k,
        x: +(B.seatsX0 + B.seatPitch * (k + 0.5)).toFixed(4),
        d: t.d0 + B.seatSetbackFromRear,
        y: t.h,
        rotY: 0,
        backAngleRad,
      });
    }
  }

  // 0-й приставной ряд стульев на полу (8 шт.)
  const floorChairs = [];
  if (tChairs > 0) {
    for (let k = 0; k < B.seatCountPerRow; k++) {
      floorChairs.push({
        col: k,
        x: +(B.seatsX0 + B.seatPitch * (k + 0.5)).toFixed(4),
        d: B.row0D,
        y: 0,
        rotY: 0,
        scale: tChairs,
      });
    }
  }

  const topH = +(B.tiers * B.riser).toFixed(4);
  const backRail = {
    x0: B.x0,
    x1: B.x1,
    d: B.dBack,
    y0: topH,
    y1: +(topH + B.backRailH).toFixed(4),
  };

  // Боковые поручни на всех 4 ярусах (в свёрнутом виде отгибаются наружу веером)
  const sideRails = [];
  for (const t of tiers) {
    const deg = B.sideSplayDeg[t.tier - 1] ?? 4;
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      sideRails.push({
        tier: t.tier,
        idxFromTop: t.idxFromTop,
        side,
        x: side === 'left' ? B.x0 : B.x1,
        d0: t.d0 + 0.03,
        d1: t.d1 - 0.04,
        y0: t.h,
        y1: +(t.h + B.sideRailH).toFixed(4),
        splayRad: sign * ((deg * Math.PI) / 180) * (1 - tSlide),
      });
    }
  }

  const seats = tFold >= 0.999 ? [...bleacherSeats, ...floorChairs] : [];
  return { tiers, steps, bleacherSeats, floorChairs, seats, backRail, sideRails };
}

/** Терминальная раскладка по состоянию планировки ('folded' | 'unfolded'). */
export function placed(st) {
  return placedAt(bleacherPose(st?.id === 'unfolded' ? 1 : 0));
}
