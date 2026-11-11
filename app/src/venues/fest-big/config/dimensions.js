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
  decoCeilingY: 6.1, // декоративный потолок над авансценой

  hall: {
    width: 18.0,
    portalToBoothWall: 18.0, // от портала до стены с операторской
    rakeDeg: 9, // угол подъёма
    firstRowGap: 2.15, // от края сцены до кресел первого ряда
    rows: 15,
    seatsPerRow: 26,
    rowPitch: 0.8, // assumption (A9)
    seatWidth: 0.56, // assumption (A9)
    ceilingY: 7.5, // assumption (A10), над уровнем планшета
    ceilingSlopeTo: -6.0, // assumption: потолок поднимается от 6.1 до ceilingY к этому d
    // источники зального света в модели [x, d]: на компьютере — 3, на телефоне — 1 (облегчённый профиль)
    houseLights: { full: [[-4, -9], [4, -9], [0, -15]], lite: [[0, -11]] },
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
    // широкие двойные двери у портала в зрительном зале (слева и справа)
    portalDoors: { width: 2.2, height: 2.0, fromD: 0.0 },
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
    ropeInset: 0.62,
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
    sideLength: null, // у боковых — по факту от Ш2 до Ш11 / Ш9 (см. rigging.js)
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
    bridge1: { d: -7.0, y: 6.4, length: 12.0 },
    bridge2: { d: -12.0, y: 6.8, length: 10.0 },
    boxes: {
      // «ложи» — световые рамы на боковых стенах зала
      L1: { side: -1, d: -6.2, y: 4.2, w: 1.4, h: 2.2 },
      L2: { side: -1, d: -12.5, y: 4.6, w: 1.2, h: 1.6 },
      R1: { side: 1, d: -6.2, y: 4.2, w: 1.4, h: 2.2 },
      R2: { side: 1, d: -12.5, y: 4.6, w: 1.2, h: 1.6 },
    },
    // вертикальные прострелы у углов авансцены, на стенах зала (на серой акустической части)
    sideTowers: {
      L: { side: -1, d: -1.6, y: 2.2, h: 3.0 },
      R: { side: 1, d: -1.6, y: 2.2, h: 3.0 },
    },
    booth: { windowFromY: 2.0, windowH: 1.2, windowW: 12.0 },
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
export const RAKE = Math.tan((DIM.hall.rakeDeg * Math.PI) / 180);

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

/** Пол зрительного зала (Y) в точке глубины d (d < 0). Ступенчатый по рядам. */
export function hallFloorY(d) {
  const h = DIM.hall;
  const floor0 = -DIM.forestage.height;
  const firstRowD = -(DIM.forestage.depth + h.firstRowGap);
  if (d >= firstRowD) return floor0;
  const row = Math.min(h.rows - 1, Math.floor((firstRowD - d) / h.rowPitch));
  return floor0 + row * h.rowPitch * RAKE;
}

/** Глубина d передней кромки ряда i (0..rows-1). */
export function rowFrontD(i) {
  return -(DIM.forestage.depth + DIM.hall.firstRowGap) - i * DIM.hall.rowPitch;
}

/** z в Three.js из глубины d. */
export const Z = (d) => -d;
