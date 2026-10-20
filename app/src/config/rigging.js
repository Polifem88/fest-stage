// =============================================================================
//  ВЕРХНЯЯ МЕХАНИКА: штанкеты (Ш), софиты (С), дорога занавеса (З), боковые (Б).
//  d — ОСЬ объекта от передней плоскости портала (м). Расстояния из тех. файла
//  даны между осями: их сумма с галереей, порталом и авансценой даёт ровно 12 м.
//  min/max — ход по высоте (высота трубы над планшетом), rest — исходное положение.
// =============================================================================

// Расстояния из тех. файла (от портала вглубь), м
export const SPACING = [
  ['Portal', 'Z', 0.3],
  ['Z', 'Sh1', 0.3],
  ['Sh1', 'Sh2', 0.6],
  ['Sh2', 'C1', 0.6],
  ['C1', 'Sh3', 0.6],
  ['Sh3', 'Sh4', 0.6],
  ['Sh4', 'Rigel', 0.3],
  ['Rigel', 'Sh5', 0.3],
  ['Sh5', 'Sh6', 0.3],
  ['Sh6', 'C2', 0.45],
  ['C2', 'Sh7', 0.75],
  ['Sh7', 'Sh8', 0.3],
  ['Sh8', 'C3', 0.85],
  ['C3', 'Sh9', 0.35],
  ['Sh9', 'Sh10', 0.3],
  ['Sh10', 'Sh11', 0.3],
  ['Sh11', 'Sh12', 0.45],
  ['Sh12', 'Rail', 0.4],
];
// Перед порталом
export const FRONT_SPACING = [
  ['Portal', 'Sh0', 0.2],
  ['Sh0', 'C0', 1.0],
];

/** Глубины осей всех объектов, вычисленные из расстояний. */
export function computeDepths() {
  // «Портал» в цепочке — задняя плоскость портальной конструкции (0.25),
  // но расстояния в файле фактически отсчитаны так, что сумма = 12 м при отсчёте
  // от ПЕРЕДНЕЙ плоскости + толщина портала включена в первые 0.3 м до З.
  // Поэтому: d(Z) = 0.25 + 0.3 = 0.55.
  const depths = { Portal: 0.25 };
  for (const [a, b, gap] of SPACING) depths[b] = +(depths[a] + gap).toFixed(3);
  depths.PortalFront = 0;
  depths.Sh0 = -0.2;
  depths.C0 = -1.2;
  return depths;
}

const D = computeDepths();

/**
 * kind:
 *   batten — штанкет (труба Ø50, 14 м, 4 подвеса)
 *   light  — софит (такая же труба с приборами, глубина по приборам 0.5 м)
 *   track  — дорога занавеса (15 м, 0.2 м)
 *   side   — боковой штанкет (вдоль глубины, 3 подвеса)
 * control: left | right-front | right-back-pad   via: direct | redirect (через обводные блоки)
 */
export const RIGGING = [
  { id: 'C0', name: 'С0', kind: 'light', d: D.C0, min: 2, max: 6, rest: 5.6, control: 'right-front', via: 'redirect', lines: 4 },
  { id: 'Sh0', name: 'Ш0', kind: 'batten', d: D.Sh0, min: 1, max: 6, rest: 5.9, control: 'left', via: 'redirect', lines: 4 },
  { id: 'Z', name: 'З', kind: 'track', d: D.Z, min: 3, max: 6, rest: 6, control: 'right-front', via: 'direct', lines: 4, fullName: 'Дорога занавеса' },
  { id: 'Sh1', name: 'Ш1', kind: 'batten', d: D.Sh1, min: 1.5, max: 6, rest: 6, control: 'right-front', via: 'direct', lines: 4 },
  { id: 'Sh2', name: 'Ш2', kind: 'batten', d: D.Sh2, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 4 },
  { id: 'C1', name: 'С1', kind: 'light', d: D.C1, min: 2, max: 7, rest: 6.6, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh3', name: 'Ш3', kind: 'batten', d: D.Sh3, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh4', name: 'Ш4', kind: 'batten', d: D.Sh4, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh5', name: 'Ш5', kind: 'batten', d: D.Sh5, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh6', name: 'Ш6', kind: 'batten', d: D.Sh6, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 4 },
  { id: 'C2', name: 'С2', kind: 'light', d: D.C2, min: 2, max: 7, rest: 6.6, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh7', name: 'Ш7', kind: 'batten', d: D.Sh7, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh8', name: 'Ш8', kind: 'batten', d: D.Sh8, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  { id: 'C3', name: 'С3', kind: 'light', d: D.C3, min: 2, max: 7, rest: 6.6, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh9', name: 'Ш9', kind: 'batten', d: D.Sh9, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh10', name: 'Ш10', kind: 'batten', d: D.Sh10, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh11', name: 'Ш11', kind: 'batten', d: D.Sh11, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  { id: 'Sh12', name: 'Ш12', kind: 'batten', d: D.Sh12, min: 1, max: 6.9, rest: 6.9, control: 'left', via: 'direct', lines: 4 },
  // Боковые: перпендикулярно сцене, между галереей и концами обычных штанкет (концы на ±7.0, перила на ±7.6)
  { id: 'B1', name: 'Б1', kind: 'side', x: -7.3, dFrom: D.Sh2, dTo: D.Sh11, min: 1, max: 6.5, rest: 6.5, control: 'left', via: 'direct', lines: 3 },
  { id: 'B2', name: 'Б2', kind: 'side', x: 7.3, dFrom: D.Sh2, dTo: D.Sh9, min: 1, max: 6.5, rest: 6.5, control: 'right-back-pad', via: 'direct', lines: 3 },
];

export const RIG_BY_ID = Object.fromEntries(RIGGING.map((r) => [r.id, r]));

// Порядок канатов управления на ЛЕВОЙ стене (спереди назад) — уточнено пользователем.
export const LEFT_RAIL_ORDER = ['Sh2', 'Sh0', 'C1', 'Sh3', 'Sh4', 'Sh5', 'Sh6', 'C2', 'Sh7', 'Sh8', 'C3', 'Sh9', 'Sh10', 'Sh11', 'B1', 'Sh12'];
// Правый передний угол сразу за порталом (спереди назад)
export const RIGHT_FRONT_ORDER = ['Z', 'C0', 'Sh1'];

/**
 * Положение каната управления по глубине (d) на стене.
 * Канат стоит напротив своего подъёма; «обводные» (Ш0, С0, Б1) — между соседями.
 */
export function ropeDepth(id) {
  const r = RIG_BY_ID[id];
  const order = r.control === 'left' ? LEFT_RAIL_ORDER : r.control === 'right-front' ? RIGHT_FRONT_ORDER : null;
  if (!order) return D.Rail - 0.6; // Б2 — под площадкой узла подъёма
  const own = (x) => (RIG_BY_ID[x].kind === 'side' ? null : RIG_BY_ID[x].via === 'redirect' ? null : RIG_BY_ID[x].d);
  const i = order.indexOf(id);
  const self = own(id);
  if (self != null) return self;
  // между ближайшими соседями с «собственным» положением
  let prev = null, next = null;
  for (let k = i - 1; k >= 0 && prev == null; k--) prev = own(order[k]);
  for (let k = i + 1; k < order.length && next == null; k++) next = own(order[k]);
  if (prev != null && next != null) return (prev + next) / 2;
  return (prev ?? next) + (prev != null ? 0.15 : -0.15);
}

// Линии дежурного освещения (ДО) — между соседними объектами
export const DUTY_ROWS = [
  { id: 'DO1', name: 'ДО1', d: (D.Sh3 + D.Sh4) / 2 },
  { id: 'DO2', name: 'ДО2', d: (D.Sh8 + D.C3) / 2 },
  { id: 'DO3', name: 'ДО3', d: (D.Sh11 + D.Sh12) / 2 },
];

export const DEPTHS = D;
