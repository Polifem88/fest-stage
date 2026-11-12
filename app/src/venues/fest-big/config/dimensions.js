// =============================================================================
//  РАЗМЕРЫ БОЛЬШОЙ СЦЕНЫ ФЭСТ — единый источник правды.
//  Все цифры в метрах. Поменяйте число здесь — модель перестроится сама.
//
//  Система координат модели:
//    X — вправо, если смотреть из зала (лево/право — «зрительские»);
//    Y — вверх, 0 = планшет сцены;
//    d — глубина: 0 = передняя (зрительская) плоскость портала, + вглубь сцены,
//        − в сторону зала. В Three.js:  z = −d.
//
//  assumption: true — значение не было дано, оценено по фото/схеме (см. план, A1–A13).
// =============================================================================

import { _initHallGeometry, hallFloorY, hallCanopyY, hallCeilingY, hallCeilingNiche } from './hallGeometry.js';

export const DIM = {
  // --- Сценическая коробка ---------------------------------------------------
  box: {
    width: 17.0, // от стены до стены (уточнено пользователем)
    ceiling: 8.5, // высота до потолка за порталом
    backWallD: 9.2, // задняя стена: 2.75 (авансцена) + 9.2 = 11.95 ≈ 12 м от края авансцены
  },

  // --- Портал ----------------------------------------------------------------
  portal: {
    width: 12.5,
    height: 5.15,
    thickness: 0.25, // «ширина конструкции портала»
  },

  // --- Авансцена и зал ---------------------------------------------------------
  forestage: {
    depth: 2.75, // от края до линии портала
    frontWidth: 11.25, // ширина переда авансцены
    backWidth: 12.5, // у портала = ширина портала
    height: 0.75, // над полом зрительного зала
    // бока авансцены: от переднего края строго под прямым углом на sideStraight вглубь,
    // далее — скос к внутреннему углу портала (±backWidth/2, d = 0)
    sideStraight: 1.9,
    // 2 трапециевидные лестницы в нишах между порталом и боками авансцены:
    // верхнее основание — скос авансцены, нижнее — параллельно ему от переднего угла
    // авансцены до портала. steps — число подъёмов (последний — на планшет).
    stairs: { steps: 5 },
  },
  decoCeilingY: 6.1, // потолок зала у портала (горизонтальный участок hall.ceiling.frontFlat), верх перемычки портала

  hall: {
    width: 16.0, // верхний объём от серой стены до серой стены (±8,00 м)
    portalToBoothWall: 18.0, // от портала до передней стены операторской
    stepRise: 0.15, // подъём каждой ступени ряда (замер патча 2); уклон пандусов = stepRise / rowPitch (≈ 9,46°)
    firstStepGap: 2.45, // от края авансцены до первой ступени (на ней стоит 2-й ряд), замер патча 2
    rows: 15,
    seatsPerRow: 26,
    rowPitch: 0.9, // ширина ступени с рядом кресел (замер патча 2); последняя ступень доходит до операторской
    aisleAtPeak: 1.5, // чистый проход от пика «ёлочки» (|X| = 8,20) до торца ступеней (замер патча 2)
    stepMargin: 0.04, // assumption: кант торца ступени за внешней опорой кресла (ширина кресла выводится из прохода)
    stepMarginAssumption: true,
    // кресло стоит почти вплотную к подступенку следующего ряда: зазор seatRiserGap от задней кромки опоры (боковины)
    // кресла, которая на seatBackReach за осью; 15-й ряд — на том же шаге от 14-го (не вплотную к операторской)
    seatBackReach: 0.22, // от оси кресла до задней кромки боковины на полу
    seatRiserGap: 0.02, // уточнение заказчика: «зазор буквально 2 см»
    seatSetback: 0, // от передней кромки ступени до оси кресла: выводится ниже = rowPitch − seatBackReach − seatRiserGap (0,66)
    frontCornerFloorY: -0.85, // пол у передних косых дверей и вдоль портала в углах зала
    canopyHeightAtPortal: 2.3, // высота низа карниза над полом -0,85 м у портала (+1,45 м)
    canopyHeightMain: 2.75, // высота низа карниза над пандусом начиная со 2-го ряда (+2,00 → +3,91 м)
    canopyFasciaH: 0.16, // assumption: вертикальный бортик-фаска карниза на линии ±8,00 м
    canopyFasciaAssumption: true,
    nicheMinDepth: 0.2, // отступ пиков «ёлочки» от верхней серой стены (|X| = 8,20 м)
    nicheMaxDepth: 0.7, // отступ впадин «ёлочки» от верхней серой стены (|X| = 8,70 м)
    sawtoothStartD: -2.3, // начало чередования панелей 2,25 / 0,85 м от портала
    sawtoothTeeth: 4,
    sawtoothLong: 2.25, // уточнено в патче 2 (было 2,30)
    sawtoothShort: 0.85,
    ledStripW: 0.04, // assumption: ширина светящегося профиля в углах «ёлочки»
    ledStripD: 0.025, // assumption: глубина профиля LED-ленты
    ledStripAssumption: true,
    exitFlareAngleDeg: 45, // assumption: разворот внешней 5,25-метровой стены «кишки» ради точного замыкания обмеров
    exitFlareAngleAssumption: true,
    exitFlareLen: 5.25,
    exitStraightLen: 2.65, // уточнено в патче 2 (было 2,60); скос операторской с дверью замыкает контур на 18,00 м
    exitBackWallW: 2.6,
    exitFlatLen: 0.7, // пол «кишки» становится горизонтальным за 0,70 м до торцевой двери (замер патча 2)
    exitBlendLen: 1.0, // assumption: длина плавного (C¹) перехода уклона пандуса в горизонталь перед дверью
    exitBlendAssumption: true,
    boothFrontWidth: 16.5, // ширина передней грани операторской с окнами (±8,25 м)
    boothSideLen: 1.7, // длина прямых боковых стен операторской
    // Потолок зала (патч 2, по фото): от портала горизонтальный участок frontFlat на decoCeilingY,
    // затем bays × (наклон slopeLen с понижением slopeDrop + горизонталь flatLen), затем большой наклон
    // к верху окон операторской на boothClear над ступенью последнего ряда. Длины — по поверхности потолка
    // (панели 1,2 × 0,6 м: в наклон ровно 1 полоса, в горизонталь — 4).
    ceiling: {
      frontFlat: 1.5,
      slopeLen: 0.6,
      flatLen: 2.4,
      bays: 5,
      slopeDrop: 0.2, // «примерно 20 см» каждый наклон
      boothClear: 3.0, // высота потолка у операторской над ступенью последнего ряда
      // открытые чёрные наклонные ниши выносных мостов (номера наклонов от портала, 1..bays): приборы висят над потолком
      niches: [2, 4],
      nicheWidth: 9.6, // 8 панелей по 1,2 м по центру зала
      nicheBack: 0.4, // assumption: заглубление тёмной ниши за наклон (над нижним участком потолка)
      nicheUp: 0.5, // assumption: высота ниши над верхней кромкой наклона
      nicheAssumption: true,
      houseLampStrip: 2, // ряд светильников — по центру 3-й полосы панелей каждого горизонтального участка
    },
    // источники зального света в модели [x, d]: на компьютере — 3, на телефоне — 1 (облегчённый профиль)
    houseLights: { full: [[-4, -9], [4, -9], [0, -15]], lite: [[0, -11]] },
    // мягкая безтеневая подсветка бежевых ниш «ёлочки», карниза и выходов в полном профиле (по 2 точки на сторону)
    nicheLightsX: 7.45,
    nicheLightsD: [-5.5, -16.2],
  },

  // --- Галереи ---------------------------------------------------------------
  galleries: {
    width: 0.9,
    leftGap: 0.65, // зазор левой боковой галереи от левой стены (d = frontToD..backGalleryFrontD)
    // 4 станции вертикальных тяжей левой галереи к потолку (между осями канатов, мимо приборов GAL_L и вне ригеля)
    leftHangersD: [2.35, 4.40, 6.10, 7.00], // assumption: true
    leftHangersAssumption: true,
    upperY: 5.7, // верхняя галерея: бока и зад
    frontY: 6.2, // передняя (над порталом)
    frontFromD: 0.0, // assumption (A3)
    frontToD: 0.8, // assumption (A3) — над дорогой занавеса, видно Ш1
    upperStairLen: 0.8, // длина переходной лесенки 6,20 → 5,70 м вдоль боковых галерей
    lowerY: 2.2, // нижняя галерея (только задняя стена) и заход
    overGateY: 2.9, // участок нижней галереи над воротами
    gateStairW: 0.6, // ширина левого марша подъёма на участок нижней галереи над воротами
    fasciaDrop: 0.35, // свес серой обшивки нижней галереи вниз от верха настила
    railH: 1.0,
  },

  // --- Узел подъёма на галерею (задний правый угол) -------------------------
  liftNode: {
    padSize: 1.85,
    padY: 2.2,
    // техническая лестница к правой стене, перед площадкой; лезут лицом к стене
    sideLadder: { width: 0.5, gapToPad: 0.05 },
    // вертикальная лестница без ограждения: у края площадки со стороны ворот; проём в перилах верхней галереи — вправо от неё
    vertLadder: { width: 0.45, topY: 5.7, d: 8.0, upperGapW: 0.7 },
  },

  // --- Проёмы ------------------------------------------------------------------
  openings: {
    // ниши задних грузовых ворот и задней левой двери за стеной d = 9,20..10,30 м с пандусом до -0,35 м
    gate: {
      fromRightWall: 2.4,
      width: 2.95,
      depth: 1.1,
      heightAtWall: 2.4,
      heightAtGate: 2.75,
      height: 2.6,
      guideH: 0.15,
    },
    backDoor: {
      fromLeftWall: 3.6,
      width: 0.95,
      depth: 1.1,
      heightAtWall: 1.9,
      heightAtDoor: 2.25,
      height: 2.0,
    },
    // правая боковая дверь в стенке приямка на 0,85 м ниже планшета, сразу за выступом стены
    sideDoor: { width: 0.9, height: 2.1, fromD: 1.4, assumption: true },
    // косые двойные двери у портала в зрительном зале (порог на уровне приямка -0,85 м)
    portalDoors: { width: 1.75, height: 2.15, sillY: -0.85 },
    // торцевые двойные двери выходов из зала в конце 2,60-метровых «кишок» (ширина 1,75 м — по аналогии с передними)
    hallExitDoors: { width: 1.75, height: 2.15, widthAssumption: true },
    // однопольные двери в скошенных углах операторской
    boothDoors: { width: 0.9, height: 2.05, assumption: true },
  },

  // приямок у правой стены — трапеция в плане: ширина 0,50 → 1,00 м на d = 1,35..4,75 м, глубина 0,85 м
  pit: {
    fromD: 1.35,
    toD: 4.75,
    fromW: 0.5,
    toW: 1.0,
    depth: 0.85,
    steps: 5,
    tread: 0.3,
    stepsAssumption: true,
  },

  // самодельная косая решётка над приямком по кромке pitEdgeX (topY заполняется ниже = wallPier.topY)
  rack: {
    postStep: 1.0,
    postStepAssumption: true,
    ladderPost: 1, // вторая стойка от портала заменяется вертикальной лестницей в плоскости решётки
    ladderWidth: 0.44,
    levels: [2.1, 4.5], // «этажи» без пола
    topY: 0,
  },

  // узлы управления противовесами и канатами
  controls: {
    cwInset: 0.14,
    // левая стена: перила-фиксаторы канатов (две трубы Ø60 мм) на railInset от стены; сетка-рабица — в плоскости
    // перил, перед канатами (со стороны сцены), от meshFromY до низа настила верхней галереи (5,64);
    // ручные канаты (Ø ≈ 20 мм) — вплотную к перилам со стороны стены: 0,62 − 0,03 − 0,01 = 0,58
    railInset: 0.62,
    ropeInset: 0.58,
    meshFromY: 2.0,
    // правый передний узел (Ш1, С0, З): у выступа стены (x = 8,00), ограждение 0,50 м по X (до x = 7,50), канаты вплотную изнутри перил
    rightFront: { shiftX: 0.5, railWidth: 0.5, ropeGap: 0.32, guideTopY: 5.95, assumption: true },
    // правый задний угловой узел (Б2): шахта, поручни и вырезы 0,50 × 0,50 м в углу сцены (x = 8,00..8,50, d = 8,70..9,20)
    b2Corner: { size: 0.5, ropeGap: 0.3 },
  },

  // --- Ригель ------------------------------------------------------------------
  rigel: { d: 3.55, width: 0.3, bottomY: 6.65 },

  // --- Трубы -------------------------------------------------------------------
  pipe: {
    diameter: 0.05, // 50 мм (в исходном файле опечатка «50 см»)
    length: 13.5,
    sideLength: null, // у боковых — по факту: Б1 от Ш2 до Ш11 + 0,20; Б2 от Ш2 до 0,10 перед угловой площадкой (см. rigging.js)
    lightBarDepth: 0.5, // фактическая ширина софита по приборам
    trackWidth: 0.2, // дорога занавеса
    trackLength: 15.0,
    pickupX: [-6.5, -2.2, 2.2, 6.5], // assumption (A12) — 4 подвеса по 13,5-метровой трубе
  },

  // --- Дежурное освещение -----------------------------------------------------
  duty: {
    dropFromCeiling: 1.0, // от потолка до низа светильника
    perRow: 4,
  },

  // --- Зал: свет и конструкции (A11, сымпровизировано) -----------------------
  hallRig: {
    // выносные мосты с приборами — над потолком в открытых наклонных нишах (ниша = номер наклона из hall.ceiling.niches);
    // d и y трубы вычисляются из профиля потолка ниже (головы приборов — в проёме наклона)
    bridge1: { niche: 2, length: 9.4 },
    bridge2: { niche: 4, length: 9.4 },
    // фермы дежурного света зала под потолком (вплотную к нему), с небольшими светильниками дежурного света
    dutyTrusses: {
      size: 0.3, // сечение квадратной фермы
      list: [
        { d: -7.0, length: 12.0 }, // assumption (A11): d и длина — по фото
        { d: -12.0, length: 10.0 },
      ],
      lightStep: 1.5, // assumption: шаг светильников дежурного света вдоль фермы
      assumption: true,
    },
    boxes: {
      // «ложи» — световые рамы на боковых стенах зала
      L1: { side: -1, d: -6.2, y: 4.2, w: 1.4, h: 2.2 },
      L2: { side: -1, d: -12.5, y: 4.3, w: 1.2, h: 1.6 },
      R1: { side: 1, d: -6.2, y: 4.2, w: 1.4, h: 2.2 },
      R2: { side: 1, d: -12.5, y: 4.3, w: 1.2, h: 1.6 },
    },
    // вертикальные прострелы у углов авансцены, на стенах зала (на серой акустической части)
    sideTowers: {
      L: { side: -1, d: -1.6, y: 2.2, h: 3.0 },
      R: { side: 1, d: -1.6, y: 2.2, h: 3.0 },
    },
    // окно операторской: верх — на линии потолка у операторской (низ большого наклона)
    booth: { windowH: 1.2, windowW: 12.0 },
  },
};

// Удобные производные величины
export const BOX_HALF = DIM.box.width / 2;
const DECK_THICKNESS = 0.06; // толщина настила галерей (верх 5,70 → низ 5,64)
// выступ правой стены за узлом управления Ш1/С0/З: от задней стенки портала до узкого торца приямка
DIM.wallPier = {
  x0: +(BOX_HALF - 0.5).toFixed(4),
  fromD: DIM.portal.thickness,
  toD: DIM.pit.fromD,
  topY: +(DIM.galleries.upperY - DECK_THICKNESS).toFixed(4),
};
DIM.rack.topY = DIM.wallPier.topY;

export const HALL_HALF = DIM.hall.width / 2;
// Производные величины зала (патч 2): 1-й ряд стоит на партере в полосе rowPitch перед первой ступенью;
// ширина кресла выводится из замеренного прохода 1,50 м от пика «ёлочки» до торца ступеней (26 кресел в ряду).
DIM.hall.firstRowGap = +(DIM.hall.firstStepGap - DIM.hall.rowPitch).toFixed(4); // 1.55
DIM.hall.seatSetback = +(DIM.hall.rowPitch - DIM.hall.seatBackReach - DIM.hall.seatRiserGap).toFixed(4); // 0.66
DIM.hall.seatWidth = +((HALL_HALF + DIM.hall.nicheMinDepth - DIM.hall.aisleAtPeak - DIM.hall.stepMargin) / (DIM.hall.seatsPerRow / 2)).toFixed(6); // 0.512308
DIM.hall.rakeDeg = +((Math.atan(DIM.hall.stepRise / DIM.hall.rowPitch) * 180) / Math.PI).toFixed(2); // 9.46 (для подписей)
export const STEP_HALF_X = +((DIM.hall.seatsPerRow / 2) * DIM.hall.seatWidth + DIM.hall.stepMargin).toFixed(4); // 6.70
export const PORTAL_BACK_D = DIM.portal.thickness;
export const GALLERY_INNER_X = BOX_HALF - DIM.galleries.width; // 7.60 — внутренняя кромка правой боковой галереи
export const LEFT_GALLERY = {
  x0: +(-BOX_HALF + DIM.galleries.leftGap).toFixed(4), // -7.85
  x1: +(-BOX_HALF + DIM.galleries.leftGap + DIM.galleries.width).toFixed(4), // -6.95
};
export const BACK_GALLERY_FRONT_D = DIM.box.backWallD - DIM.galleries.width; // 8.30
export const B2_SHAFT = {
  x0: +(BOX_HALF - DIM.controls.b2Corner.size).toFixed(4), // 8.00
  x1: BOX_HALF, // 8.50
  d0: +(DIM.box.backWallD - DIM.controls.b2Corner.size).toFixed(4), // 8.70
  d1: DIM.box.backWallD, // 9.20
};
export const RAKE = DIM.hall.stepRise / DIM.hall.rowPitch;

/** Координата X косой сценической кромки приямка на глубине d (fromD ≤ d ≤ toD). */
export function pitEdgeX(d) {
  const p = DIM.pit;
  const w = p.fromW + ((p.toW - p.fromW) * (d - p.fromD)) / (p.toD - p.fromD);
  return BOX_HALF - w;
}

/** Строго внутри трапеции приямка (для обрезки лучей и пятен света). */
export function inPit(x, d) {
  const p = DIM.pit;
  return d > p.fromD && d < p.toD && x > pitEdgeX(d);
}

/** Габариты и отметки ниши задних грузовых ворот. */
export function gateNiche() {
  const o = DIM.openings.gate;
  const x1 = +(BOX_HALF - o.fromRightWall).toFixed(4);
  const x0 = +(x1 - o.width).toFixed(4);
  const d0 = DIM.box.backWallD;
  const d1 = +(d0 + o.depth).toFixed(4);
  return {
    x0,
    x1,
    d0,
    d1,
    ceilY: o.heightAtWall,
    floorDrop: +(o.heightAtGate - o.heightAtWall).toFixed(4),
  };
}

/** Габариты и отметки ниши задней левой двери. */
export function doorNiche() {
  const o = DIM.openings.backDoor;
  const x0 = +(-BOX_HALF + o.fromLeftWall).toFixed(4);
  const x1 = +(x0 + o.width).toFixed(4);
  const d0 = DIM.box.backWallD;
  const d1 = +(d0 + o.depth).toFixed(4);
  return {
    x0,
    x1,
    d0,
    d1,
    ceilY: o.heightAtWall,
    floorDrop: +(o.heightAtDoor - o.heightAtWall).toFixed(4),
  };
}

/** Полуширина авансцены на глубине d (−depth ≤ d ≤ 0): прямой участок, затем скос к порталу. */
export function forestageHalfWidth(d) {
  const fs = DIM.forestage;
  const fw2 = fs.frontWidth / 2, bw2 = fs.backWidth / 2;
  const breakD = -fs.depth + fs.sideStraight;
  if (d <= breakD) return fw2;
  return fw2 + ((d - breakD) / -breakD) * (bw2 - fw2);
}

_initHallGeometry(DIM);
export { hallFloorY, hallCanopyY, hallCeilingY };

// Выносные мосты в наклонных нишах потолка: голова прибора — на BRIDGE_HEAD_INSET выше середины проёма наклона
// (по нормали внутрь ниши), труба — на FIXTURE_HEAD_DROP выше головы (так висит прибор в systems/fixtures.js).
const BRIDGE_HEAD_INSET = 0.1;
const FIXTURE_HEAD_DROP = 0.22;
for (const key of ['bridge1', 'bridge2']) {
  const br = DIM.hallRig[key];
  const n = hallCeilingNiche(br.niche);
  br.d = +(n.midD + n.inD * BRIDGE_HEAD_INSET).toFixed(4);
  br.y = +(n.midY + n.inY * BRIDGE_HEAD_INSET + FIXTURE_HEAD_DROP).toFixed(4);
}
// Фермы дежурного света — вплотную к потолку (верхний пояс на отметке потолка)
for (const t of DIM.hallRig.dutyTrusses.list) {
  t.y = +(hallCeilingY(t.d) - DIM.hallRig.dutyTrusses.size / 2).toFixed(4);
}

/** Глубина d передней кромки ряда i (0..rows-1). */
export function rowFrontD(i) {
  return -(DIM.forestage.depth + DIM.hall.firstRowGap) - i * DIM.hall.rowPitch;
}

/** Глубина d задней кромки ступени ряда i: у последнего ряда — передняя стена операторской. */
export function rowBackD(i) {
  return i >= DIM.hall.rows - 1 ? -DIM.hall.portalToBoothWall : rowFrontD(i) - DIM.hall.rowPitch;
}

/** Глубина d оси кресел ряда i. */
export function rowSeatD(i) {
  return rowFrontD(i) - DIM.hall.seatSetback;
}

/** Отметка пола ряда i: 1-й ряд — партер (-0,75), каждый следующий выше на stepRise. */
export function rowFloorY(i) {
  return -DIM.forestage.height + i * DIM.hall.stepRise;
}

/** z в Three.js из глубины d. */
export const Z = (d) => -d;
