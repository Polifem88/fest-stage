// =============================================================================
//  СЦЕНА ПОД КРЫШЕЙ — трансформируемый зал: 6 готовых планировок (spec §6).
//  Порядок LAYOUTS — часть формата ссылки (поле lo): только ДОБАВЛЯТЬ в конец.
//  Координаты рядов и пультов — по таблице spec §6 при сдвиге 0. «Рядов» убирает задние
//  (верхние) ряды (rank > rows), «Сдвиг» двигает весь зал (ряды и пульты) вдоль оси axis
//  с шагом SHIFT_STEP; пределы — по преградам (OBSTACLES) и контуру помещения.
//  Станки 2 × 1, высоты 0,2 / 0,4 / 0,6 / 0,8; ряд 1 — стулья на полу; лестниц нет.
// =============================================================================
import { OBSTACLES, insideRoom } from './dimensions.js';

/** Шаг мест в ряду: 18 мест на 10 м. */
export const SEAT_PITCH = 10 / 18;
/** Инвентарь: станки под зрителей, пультовые станки, стулья, высоты станков. */
export const STOCK = { stands: 20, pultStands: 2, chairs: 90, heights: [0.2, 0.4, 0.6, 0.8] };
/** Станок 2 × 1. */
export const STAND = { long: 2, short: 1 };
/** Шаг сдвига зала, м; наибольший сдвиг — шагов в каждую сторону. */
export const SHIFT_STEP = 0.5;
export const SHIFT_MAX = 10;
/** Наименьший зазор до любой преграды и стены, м. */
export const CLEAR = 0.05;

const row = (rank, x0, x1, d0, d1, h, facing, seats) => ({ rank, x0, x1, d0, d1, h, facing, seats });
const pult = (kind, x0, x1, d0, d1, h) => ({ kind, x0, x1, d0, d1, h });
const LIGHT_H = 0.4, SOUND_H = 0.8;

/**
 * facing — куда смотрят зрители ряда: '+d' (к стене 13), '-d', '+x' (к стенам 2–3–4), '-x'.
 * axis — ось сдвига (поперёк рядов).
 */
export const LAYOUTS = [
  {
    id: 'std', name: 'Стандарт', axis: 'd',
    rows: [
      row(1, -5, 5, -1, 0, 0, '+d', 18),
      row(2, -5, 5, -2, -1, 0.2, '+d', 18),
      row(3, -5, 5, -3, -2, 0.4, '+d', 18),
      row(4, -5, 5, -4, -3, 0.6, '+d', 18),
      row(5, -5, 5, -5, -4, 0.8, '+d', 18),
    ],
    // у стены 10: свет — вровень с рядами 2–3, звук — с рядами 4–5
    pults: [pult('light', -6.15, -5.15, -3, -1, LIGHT_H), pult('sound', -6.15, -5.15, -5, -3, SOUND_H)],
  },
  { id: 'empty', name: 'Пустой зал', axis: 'd', rows: [], pults: [] },
  {
    id: 'cross', name: 'Поперёк · к стенам 2–3–4', axis: 'x',
    rows: [
      row(1, -1.2, -0.2, -4.5, 5.5, 0, '+x', 18),
      row(2, -2.2, -1.2, -4.5, 5.5, 0.2, '+x', 18),
      row(3, -3.2, -2.2, -4.5, 5.5, 0.4, '+x', 18),
      row(4, -4.2, -3.2, -4.5, 5.5, 0.6, '+x', 18),
      row(5, -5.2, -4.2, -4.5, 5.5, 0.8, '+x', 18),
    ],
    pults: [pult('light', -3.2, -1.2, 5.65, 6.65, LIGHT_H), pult('sound', -5.2, -3.2, 5.65, 6.65, SOUND_H)],
  },
  {
    id: 'crossRev', name: 'Поперёк · к стенам 10–12', axis: 'x',
    rows: [
      row(1, 0.4, 1.4, -4.5, 5.5, 0, '-x', 18),
      row(2, 1.4, 2.4, -4.5, 5.5, 0.2, '-x', 18),
      row(3, 2.4, 3.4, -4.5, 5.5, 0.4, '-x', 18),
      row(4, 3.4, 4.4, -4.5, 5.5, 0.6, '-x', 18),
      row(5, 4.4, 5.4, -4.5, 5.5, 0.8, '-x', 18),
    ],
    pults: [pult('light', 1.4, 3.4, 5.65, 6.65, LIGHT_H), pult('sound', 3.4, 5.4, 5.65, 6.65, SOUND_H)],
  },
  {
    id: 'traverse', name: 'Траверс', axis: 'd',
    rows: [
      // блок A — лицом к стене 13
      row(1, -4, 4, -3, -2, 0, '+d', 14),
      row(2, -4, 4, -4, -3, 0.2, '+d', 14),
      row(3, -4, 4, -5, -4, 0.4, '+d', 14),
      // блок B — лицом к мольтону
      row(1, -4, 4, 4.25, 5.25, 0, '-d', 14),
      row(2, -4, 4, 5.25, 6.25, 0.2, '-d', 14),
      row(3, -4, 4, 6.25, 7.25, 0.4, '-d', 14),
    ],
    pults: [pult('light', -6.15, -5.15, -5, -3, LIGHT_H), pult('sound', 4.15, 5.15, 5.25, 7.25, SOUND_H)],
  },
  {
    id: 'arena', name: 'Арена / П', axis: 'd',
    rows: [
      // тыл — лицом к стене 13
      row(1, -4, 4, -3, -2, 0, '+d', 14),
      row(2, -4, 4, -4, -3, 0.2, '+d', 14),
      row(3, -4, 4, -5, -4, 0.4, '+d', 14),
      // фланги
      row(1, -4, -3, -1.8, 4.2, 0, '+x', 10),
      row(2, -5, -4, -1.8, 4.2, 0.2, '+x', 10),
      row(1, 3, 4, -1.8, 4.2, 0, '-x', 10),
      row(2, 4, 5, -1.8, 4.2, 0.2, '-x', 10),
    ],
    pults: [pult('light', -6.15, -5.15, -5, -3, LIGHT_H), pult('sound', 4.15, 5.15, -5, -3, SOUND_H)],
  },
];

const byId = (id) => LAYOUTS.find((l) => l.id === id);

/** Наибольший ранг рядов планировки (0 — рядов нет). */
export function rowsMax(id) {
  return Math.max(0, ...byId(id).rows.map((r) => r.rank));
}

/** Угол поворота стула в плане (x, d): 0 — лицом к +d, π/2 — лицом к +x. */
const FACING_ROT = { '+d': 0, '+x': Math.PI / 2, '-d': Math.PI, '-x': -Math.PI / 2 };

/**
 * Раскладка планировки: ряды и пульты со сдвигом, станки 2 × 1, места.
 * @param {{id:string, rows:number, shift:number}} st  shift — в шагах SHIFT_STEP
 * @returns {{ rows, stands: Array<{x0,x1,d0,d1,h}>, seats: Array<{x,d,y,rotY}>, pults }}
 */
export function placed(st) {
  const L = byId(st.id);
  const s = (st.shift || 0) * SHIFT_STEP;
  const dx = L.axis === 'x' ? s : 0, dd = L.axis === 'd' ? s : 0;
  const mv = (r) => ({ ...r, x0: r.x0 + dx, x1: r.x1 + dx, d0: r.d0 + dd, d1: r.d1 + dd });
  const rows = L.rows.filter((r) => r.rank <= st.rows).map(mv);
  const pults = L.pults.map(mv);
  const stands = [];
  const seats = [];
  for (const r of rows) {
    const alongX = r.x1 - r.x0 >= r.d1 - r.d0;
    const len = alongX ? r.x1 - r.x0 : r.d1 - r.d0;
    if (r.h > 0) {
      const n = Math.round(len / STAND.long);
      for (let i = 0; i < n; i++) {
        stands.push(alongX
          ? { x0: r.x0 + i * STAND.long, x1: r.x0 + (i + 1) * STAND.long, d0: r.d0, d1: r.d1, h: r.h }
          : { x0: r.x0, x1: r.x1, d0: r.d0 + i * STAND.long, d1: r.d0 + (i + 1) * STAND.long, h: r.h });
      }
    }
    const cx = (r.x0 + r.x1) / 2, cd = (r.d0 + r.d1) / 2;
    for (let i = 0; i < r.seats; i++) {
      const o = (i - (r.seats - 1) / 2) * SEAT_PITCH;
      seats.push({ x: alongX ? cx + o : cx, d: alongX ? cd : cd + o, y: r.h, rotY: FACING_ROT[r.facing] });
    }
  }
  return { rows, stands, seats, pults };
}

/** Число мест. */
export function seatCount(st) {
  return byId(st.id).rows.filter((r) => r.rank <= st.rows).reduce((n, r) => n + r.seats, 0);
}

const overlap = (a, b) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];
/** Прямоугольник целиком в помещении: граница с шагом 2 см внутри контура (контур ортогональный, без дыр). */
function rectInRoom([x0, x1, d0, d1]) {
  const n = Math.max(2, Math.ceil(Math.max(x1 - x0, d1 - d0) / 0.02));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, d = d0 + (d1 - d0) * t;
    if (!insideRoom(x, d0) || !insideRoom(x, d1) || !insideRoom(x0, d) || !insideRoom(x1, d)) return false;
  }
  return true;
}
/** Планировка помещается: каждый ряд и пульт — с зазором CLEAR до преград и стен. */
export function fits(st) {
  const p = placed(st);
  for (const r of [...p.rows, ...p.pults]) {
    const g = [r.x0 - CLEAR + 1e-9, r.x1 + CLEAR - 1e-9, r.d0 - CLEAR + 1e-9, r.d1 + CLEAR - 1e-9];
    if (!rectInRoom(g)) return false;
    if (OBSTACLES.some((o) => overlap(g, o.r))) return false;
  }
  return true;
}

const rangeCache = new Map();
/** Допустимые шаги сдвига [min, max] (всегда содержит 0, |шаг| ≤ SHIFT_MAX). */
export function shiftRange(id, rows) {
  const key = `${id}/${rows}`;
  if (rangeCache.has(key)) return rangeCache.get(key);
  const L = byId(id);
  if (!L.rows.length && !L.pults.length) { rangeCache.set(key, [0, 0]); return [0, 0]; } // двигать нечего
  const walk = (dir) => {
    let k = 0;
    while (Math.abs(k + dir) <= SHIFT_MAX && fits({ id, rows, shift: k + dir })) k += dir;
    return k;
  };
  const r = [walk(-1), walk(1)];
  rangeCache.set(key, r);
  return r;
}
