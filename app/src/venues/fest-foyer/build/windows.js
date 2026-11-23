// Витражи и окна Фойе театра «ФЭСТ» (Этап 1 — открытые витражи, слой windows):
//  • ВБ6 (фасадный витраж 1-го этажа, d = 0,00, две входные двустворчатые двери);
//  • ВБ3 (консольный панорамный витраж 2-го этажа, d = −0,80, Y = 3,00..9,20);
//  • ВБ7 / ВБ8 (стеклянные перегородки и двери тамбура главного входа);
//  • ОК16*-И / ОК16*-А (узкие вертикальные окна в кирпичных торцевых стенах);
//  • свёрнутые короба рулонных блэкаут-штор наверху ВБ6 и ВБ3 (задел под Этап 2).
// Все габариты — из config/dimensions.js (FOYER); здесь только пропорции профилей рам.
import { box, rect } from '../../../core/geom.js';
import { FOYER } from '../config/dimensions.js';

// Визуальные константы профилей витражей
const MULLION_W = 0.055;     // ширина алюминиевого импоста и ригеля
const MULLION_D = 0.075;     // глубина алюминиевого профиля
const PERIM_W = 0.065;       // ширина наружной обвязки витража
const DOOR_STILE_W = 0.05;   // ширина профиля створки стеклянной двери
const DOOR_PUSH_Y = 1.05;    // высота горизонтальной ручки/перекладины входных дверей
const BLIND_GAP_D = 0.04;    // отступ короба рулонной шторы внутрь помещения от оси стекла
const GLASS_SPLIT = 0.004;   // разнесение двусторонней пары стёкол (видно снаружи и изнутри)
const VEST_MULLION_STEP = 1.10; // шаг импостов боковых и глухих секций тамбура ВБ7/ВБ8

/** Двусторонняя пара плоскостей стекла без z-fighting (axis: 'd' или 'x'). */
function glassPair(axis, at, a0, a1, b0, b1) {
  return [
    rect(axis, at - GLASS_SPLIT, a0, a1, b0, b1, -1),
    rect(axis, at + GLASS_SPLIT, a0, a1, b0, b1, 1),
  ];
}

/** Вертикальный профиль вдоль Y в плоскости d = at. */
function mullionD(x, d, y0, y1, w = MULLION_W, depth = MULLION_D) {
  return box(x - w / 2, x + w / 2, y0, y1, d - depth / 2, d + depth / 2);
}

/** Горизонтальный ригель вдоль X в плоскости d = at. */
function transomD(x0, x1, d, y, h = MULLION_W, depth = MULLION_D) {
  return box(x0, x1, y - h / 2, y + h / 2, d - depth / 2, d + depth / 2);
}

/** Построить фасадный витраж в плоскости d = cfg.d (ВБ6 или ВБ3). */
function buildFacadeBay(cfg, frames, glass, blinds, { mobile = false } = {}) {
  const { d, x0, x1, y0, y1, mullionStep, transoms, doors = [], blindBoxH, blindBoxD } = cfg;

  // Наружная рама витража (низ, верх, левый/правый края)
  frames.push(
    box(x0, x1, y0, y0 + PERIM_W, d - MULLION_D / 2, d + MULLION_D / 2),
    box(x0, x1, y1 - PERIM_W, y1, d - MULLION_D / 2, d + MULLION_D / 2),
    box(x0, x0 + PERIM_W, y0, y1, d - MULLION_D / 2, d + MULLION_D / 2),
    box(x1 - PERIM_W, x1, y0, y1, d - MULLION_D / 2, d + MULLION_D / 2),
  );

  // Регулярные вертикальные импосты (не пересекают дверные проёмы)
  const insideDoor = (x) => doors.some(([a, b]) => x > a + 0.12 && x < b - 0.12);
  const cols = Math.max(2, Math.round((x1 - x0) / mullionStep));
  for (let i = 1; i < cols; i++) {
    const x = x0 + ((x1 - x0) * i) / cols;
    if (insideDoor(x)) continue;
    frames.push(mullionD(x, d, y0 + PERIM_W, y1 - PERIM_W));
  }

  // Горизонтальные ригели
  for (const ty of transoms) {
    frames.push(transomD(x0 + PERIM_W, x1 - PERIM_W, d, ty));
  }

  // Двустворчатые стеклянные входные двери в составе витража (для ВБ6)
  const doorTop = transoms[0] || y1 - PERIM_W;
  for (const [dx0, dx1] of doors) {
    const dMid = (dx0 + dx1) / 2;
    frames.push(
      mullionD(dx0, d, y0, y1, MULLION_W),
      mullionD(dx1, d, y0, y1, MULLION_W),
      mullionD(dMid, d, y0, doorTop, DOOR_STILE_W, MULLION_D * 0.8),
    );
    if (!mobile) {
      frames.push(transomD(dx0 + DOOR_STILE_W, dx1 - DOOR_STILE_W, d, y0 + DOOR_PUSH_Y, DOOR_STILE_W * 0.7, MULLION_D * 0.7));
    }
  }

  // Полупрозрачное стекло (видно с улицы и из фойе)
  glass.push(...glassPair('d', d, x0 + PERIM_W, x1 - PERIM_W, y0 + PERIM_W, y1 - PERIM_W));

  // Свёрнутый короб блэкаут-шторы наверху проёма (задел под Этап 2)
  const bd0 = d + BLIND_GAP_D;
  blinds.push(box(x0 + PERIM_W, x1 - PERIM_W, y1 - blindBoxH, y1, bd0, bd0 + blindBoxD));
}

export function buildWindows(batch, M, { mobile = false } = {}) {
  const W = FOYER.windows;
  const V = FOYER.zones.vestibule;

  const frames = [];
  const glass = [];
  const blinds = [];

  // ===========================================================================
  //  1. ПАНОРАМНЫЕ ВИТРАЖИ ВБ6 (1-й этаж, d = 0) И ВБ3 (2-й этаж, d = −0,80)
  // ===========================================================================
  buildFacadeBay(W.vb6, frames, glass, blinds, { mobile });
  buildFacadeBay(W.vb3, frames, glass, blinds, { mobile });

  // ===========================================================================
  //  2. СТЕКЛЯННЫЕ ПЕРЕГОРОДКИ ТАМБУРА ВБ7 (фронт d = 1,85) И ВБ8 (бока)
  // ===========================================================================
  const vMid = (V.x0 + V.x1) / 2;
  const vDoorX0 = vMid - V.doorW / 2;
  const vDoorX1 = vMid + V.doorW / 2;

  // ВБ7: центральная стойка двустворчатой двери, ригель над дверью и стекло
  frames.push(
    mullionD(vMid, V.d1, 0, V.doorH, DOOR_STILE_W, MULLION_D * 0.75),
    transomD(V.x0, V.x1, V.d1, V.doorH, MULLION_W, MULLION_D * 0.8),
  );
  // Промежуточные импосты в боковых глухих частях ВБ7
  for (const [sx0, sx1] of [[V.x0, vDoorX0], [vDoorX1, V.x1]]) {
    if (sx1 - sx0 > VEST_MULLION_STEP) {
      frames.push(mullionD((sx0 + sx1) / 2, V.d1, 0, V.h, MULLION_W * 0.85, MULLION_D * 0.75));
    }
  }
  glass.push(...glassPair('d', V.d1, V.x0, V.x1, 0, V.h));

  // ВБ8: боковые стеклянные стенки тамбура (x = V.x0 и x = V.x1, d = 0..1,85)
  const vSideMidD = (V.d0 + V.d1) / 2;
  for (const vx of [V.x0, V.x1]) {
    frames.push(
      box(vx - MULLION_D * 0.35, vx + MULLION_D * 0.35, 0, V.h, vSideMidD - MULLION_W / 2, vSideMidD + MULLION_W / 2),
      box(vx - MULLION_D * 0.35, vx + MULLION_D * 0.35, V.doorH - MULLION_W / 2, V.doorH + MULLION_W / 2, V.d0, V.d1),
    );
    glass.push(...glassPair('x', vx, V.d0, V.d1, 0, V.h));
  }

  // ===========================================================================
  //  3. УЗКИЕ ВЕРТИКАЛЬНЫЕ ОКНА ОК16* В КИРПИЧНЫХ ТОРЦАХ (1-й и 2-й этажи)
  // ===========================================================================
  for (const ok of W.ok16) {
    const xA = ok.wall === 'x0' ? ok.x : ok.x - MULLION_D;
    const xB = ok.wall === 'x0' ? ok.x + MULLION_D : ok.x;
    const xGlass = (xA + xB) / 2;

    // Обвязка рамы окна ОК16*
    frames.push(
      box(xA, xB, ok.y0, ok.y1, ok.d0, ok.d0 + PERIM_W),
      box(xA, xB, ok.y0, ok.y1, ok.d1 - PERIM_W, ok.d1),
      box(xA, xB, ok.y0, ok.y0 + PERIM_W, ok.d0, ok.d1),
      box(xA, xB, ok.y1 - PERIM_W, ok.y1, ok.d0, ok.d1),
    );
    // Горизонтальные ригели (на уровне потолка 1 эт., пола 2 эт. и середины 2 эт.)
    for (const ty of ok.transoms) {
      frames.push(box(xA, xB, ty - MULLION_W / 2, ty + MULLION_W / 2, ok.d0 + PERIM_W, ok.d1 - PERIM_W));
    }
    // Стекло ОК16*
    glass.push(...glassPair('x', xGlass, ok.d0 + PERIM_W, ok.d1 - PERIM_W, ok.y0 + PERIM_W, ok.y1 - PERIM_W));
  }

  // --- Упаковка строго в слой windows ---
  batch.add('windows', M.steel, frames, { tag: 'windowFrames' });
  batch.add('windows', M.glass, glass, { tag: 'windowGlass', shadow: false });
  batch.add('windows', M.steelGray, blinds, { tag: 'blindBoxes' });
}
