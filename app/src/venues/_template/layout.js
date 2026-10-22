// =============================================================================
//  ШАБЛОН «ЧЁРНЫЙ КАБИНЕТ» — чистая раскладка (без Three.js): где стоят фермы,
//  подвесы, ряды и кресла. Всё считается из конфигурации площадки (cfg) — эти же
//  функции используют построение геометрии, развес приборов и юнит-тесты.
//
//  cfg (пример — venues/fest-chamber/config/dimensions.js):
//    room:    { x0, x1, d0, d1, ceiling }            — внутренний объём зала
//    stage:   { d0, d1 }                              — игровая площадка (по глубине)
//    hall:    { rows, blocks, seatPitch, rowPitch, firstRowGap, aisle, riser, eyeY, seatDepth }
//    trusses: { count, step, center?, side, tube, bottomY, apexUp, wallGap,
//               lacingPitch, hangerStep, hangerInset, hangerTube }
//  Координаты: [x, y, d], d = −z; d = 0 — нулевая линия площадки (см. её dimensions.js).
// =============================================================================

/** Высота равностороннего треугольника со стороной s. */
export const triHeight = (s) => (s * Math.sqrt(3)) / 2;

/** Глубины осей ферм (d), равномерно с шагом step, по центру зала (или около trusses.center). */
export function trussDs(cfg) {
  const T = cfg.trusses;
  const c = T.center ?? (cfg.room.d0 + cfg.room.d1) / 2;
  return Array.from({ length: T.count }, (_, i) => c + (i - (T.count - 1) / 2) * T.step);
}

/** Пролёт фермы по X: от стены до стены за вычетом зазора wallGap с каждой стороны. */
export function trussXRange(cfg) {
  return [cfg.room.x0 + cfg.trusses.wallGap, cfg.room.x1 - cfg.trusses.wallGap];
}

/**
 * Пояса фермы в сечении (по осям труб). apexUp: два нижних пояса на bottomY, верхний —
 * на bottomY + h по оси фермы; иначе — один нижний пояс и два верхних.
 * @returns {{ bottom: [number, number][], top: [number, number][], h: number }} пары [y, d]
 */
export function trussChords(cfg, d) {
  const T = cfg.trusses;
  const s = T.side, h = triHeight(s), y = T.bottomY;
  return T.apexUp
    ? { bottom: [[y, d - s / 2], [y, d + s / 2]], top: [[y + h, d]], h }
    : { bottom: [[y, d]], top: [[y + h, d - s / 2], [y + h, d + s / 2]], h };
}

/** Высота верха фермы (ось верхнего пояса + радиус трубы). */
export function trussTopY(cfg) {
  return cfg.trusses.bottomY + triHeight(cfg.trusses.side) + cfg.trusses.tube / 2;
}

/** X жёстких подвесов фермы к потолку: равномерно, шаг не больше hangerStep, отступ от концов hangerInset. */
export function hangerXs(cfg) {
  const [x0, x1] = trussXRange(cfg);
  const a = x0 + cfg.trusses.hangerInset, b = x1 - cfg.trusses.hangerInset;
  const n = Math.max(1, Math.ceil((b - a) / cfg.trusses.hangerStep));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** Передняя кромка ряда r (линия коленей; зрители смотрят в +d, на площадку). */
export function rowFrontD(cfg, r) {
  return cfg.stage.d0 - cfg.hall.firstRowGap - r * cfg.hall.rowPitch;
}

/** Уровень пола ряда r (riser — подъём ряда; 0 — ровный пол). */
export function rowFloorY(cfg, r) {
  return r * (cfg.hall.riser || 0);
}

/** Сколько всего мест. */
export function seatCount(cfg) {
  return cfg.hall.rows * cfg.hall.blocks.reduce((s, n) => s + n, 0);
}

/**
 * Места: [{ row, block, x, y, d }] — x — середина кресла, d — передняя кромка сиденья.
 * Блоки по blocks[] разделены продольными проходами aisle, весь ряд — по центру (hall.centerX).
 * @returns {{ seats: Object[], blockEdges: {row:number, x:number, y:number, d:number}[] }}
 *   blockEdges — X боковин в конце каждого блока (у кресла боковина слева, справа замыкающая)
 */
export function seatLayout(cfg) {
  const H = cfg.hall;
  const W = H.blocks.reduce((s, n) => s + n * H.seatPitch, 0) + (H.blocks.length - 1) * H.aisle;
  const seats = [], blockEdges = [];
  for (let r = 0; r < H.rows; r++) {
    let x = (H.centerX || 0) - W / 2;
    const d = rowFrontD(cfg, r), y = rowFloorY(cfg, r);
    H.blocks.forEach((n, b) => {
      for (let s = 0; s < n; s++) seats.push({ row: r, block: b, x: x + (s + 0.5) * H.seatPitch, y, d });
      x += n * H.seatPitch;
      blockEdges.push({ row: r, x, y, d });
      x += H.aisle;
    });
  }
  return { seats, blockEdges, width: W };
}

/** Глубина задней кромки последнего ряда (кресло со спинкой). */
export function lastRowBackD(cfg) {
  return rowFrontD(cfg, cfg.hall.rows - 1) - cfg.hall.seatDepth;
}
