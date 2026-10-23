// =============================================================================
//  ШАБЛОН «ЧЁРНЫЙ КАБИНЕТ» — готовые виды, размерные линии, сетка 1 м и
//  дежурный/зальный свет. Всё из конфигурации площадки (cfg).
// =============================================================================
import * as THREE from 'three';
import { buildDimsFromList, fmtM } from '../../core/overlays.js';
import { trussDs, rowFrontD, seatLayout } from './layout.js';

/**
 * Готовые точки обзора [x, y, d]. cfg.views может переопределить или дополнить любой вид.
 * Ортогональные виды подобраны так, чтобы зал целиком помещался с полями cfg.viewMargin.
 */
export function blackBoxViews(cfg) {
  const R = cfg.room, S = cfg.stage, H = cfg.hall;
  const W = R.x1 - R.x0, D = R.d1 - R.d0, cx = (R.x0 + R.x1) / 2, cd = (R.d0 + R.d1) / 2;
  const m = cfg.viewMargin ?? 1.5;
  const row = Math.min(2, H.rows - 1); // 3-й ряд
  const sd = (S.d0 + S.d1) / 2;
  const ds = trussDs(cfg);
  // зритель 3-го ряда — над креслом, ближайшим к оси зала
  const seat = seatLayout(cfg).seats.filter((s) => s.row === row).reduce((a, s) => (Math.abs(s.x - cx) < Math.abs(a.x - cx) ? s : a));
  // режим «чертёж» на плане: снизу слева — экспликация, сверху справа — масштабная линейка
  const legendPad = cfg.planLegendPad ?? 1.2, topPad = cfg.planTopPad ?? 0.8;
  const views = {
    overview: { name: 'Общий вид', type: 'persp', pos: [cx + W * 0.6, R.ceiling * 1.9, R.d0 - D * 0.75], target: [cx, R.ceiling * 0.27, cd + D * 0.08], portraitPullback: cfg.portraitPullback ?? 1.3 },
    // глаза — над задней частью своего сиденья, взгляд почти горизонтально (над спинками ряда впереди)
    hall: { name: `Из зала (${row + 1}-й ряд)`, type: 'persp', pos: [seat.x, seat.y + H.eyeY, seat.d - H.seatDepth * 0.6], target: [seat.x, H.eyeY * 0.85, sd + (S.d1 - S.d0) * 0.12] },
    stageToHall: { name: 'Со сцены в зал', type: 'persp', pos: [cx, 1.7, S.d1 - 0.5], target: [cx, 1.3, R.d0] },
    trusses: { name: 'Под фермами', type: 'persp', pos: [R.x0 + 0.9, 1.5, ds[0] - 0.4], target: [cx + W * 0.12, cfg.trusses.bottomY, ds[ds.length - 1]] },
    plan: { name: 'План сверху', type: 'ortho', dir: 'top', center: [cx, 0, cd + (topPad - legendPad) / 2], height: D + 2 * m + legendPad + topPad, width: W + 2 * m },
    // по высоте — потолок с полями, по глубине — весь зал (с полями) на экране ≈ 1,4 : 1
    section: { name: 'Разрез сбоку', type: 'ortho', dir: 'side', center: [0, R.ceiling / 2, cd], height: Math.max(R.ceiling + 2 * m, (D + 2 * m) / 1.4), width: D + 2 * m },
  };
  for (const [k, v] of Object.entries(cfg.views || {})) views[k] = { ...views[k], ...v };
  return views;
}

/** Список размеров для buildDimsFromList: [p1(x,y,d), p2(x,y,d), подпись, положение подписи]. */
export function blackBoxDims(cfg) {
  const R = cfg.room, S = cfg.stage, T = cfg.trusses;
  const ds = trussDs(cfg);
  const { width: rowW } = seatLayout(cfg);
  const aisleX = Math.min(R.x1 - 0.4, (cfg.hall.centerX || 0) + rowW / 2 + 0.35); // в боковом проходе, не по креслам
  const y = 0.03;
  const last = ds[ds.length - 1];
  // Размеры по глубине на разрезе сбоку ложатся в одну линию — разводим их по высоте:
  // общая глубина — над потолком, части зала — под полом, остальное — у пола.
  // (Высота y на плане не видна, а X — на разрезе, поэтому так можно.)
  const above = R.ceiling + 0.35, below = -0.4;
  return [
    [[R.x0, y, R.d1 - 0.3], [R.x1, y, R.d1 - 0.3], `Ширина ${fmtM(R.x1 - R.x0)}`],
    [[aisleX, above, R.d0], [aisleX, above, R.d1], `Глубина ${fmtM(R.d1 - R.d0)}`, 0.62],
    [[R.x0 + 0.5, below, S.d0], [R.x0 + 0.5, below, S.d1], `Игровая площадка ${fmtM(S.d1 - S.d0)}`],
    [[R.x0 + 0.5, below, R.d0], [R.x0 + 0.5, below, S.d0], `Зрители ${fmtM(S.d0 - R.d0)}`],
    [[R.x0 + 2.5, 0.35, S.d0], [R.x0 + 2.5, 0.35, rowFrontD(cfg, 0)], `До 1-го ряда ${fmtM(cfg.hall.firstRowGap)}`],
    [[R.x0 + 0.3, 0, R.d0 + 0.3], [R.x0 + 0.3, R.ceiling, R.d0 + 0.3], `Потолок ${fmtM(R.ceiling)}`],
    // по оси последней фермы — линия приходит точно в плоскость нижних поясов
    [[R.x0 + 1.0, 0, last], [R.x0 + 1.0, T.bottomY, last], `Низ ферм ${fmtM(T.bottomY)}`, 0.7],
    [[R.x1 - 0.6, T.bottomY - 0.45, ds[0]], [R.x1 - 0.6, T.bottomY - 0.45, ds[1]], `Шаг ферм ${fmtM(T.step)}`],
  ];
}

/** Сетка 1 м по всему полу, оси (x = 0 и нулевая линия d = 0) — красным, оцифровка. */
export function blackBoxGrid(labels, cfg) {
  const R = cfg.room;
  const g = new THREE.Group();
  g.name = 'grid';
  const v = [];
  const Y = 0.006;
  for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) v.push(x, Y, -R.d0, x, Y, -R.d1);
  for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) v.push(R.x0, Y, -d, R.x1, Y, -d);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x6f7c8f, transparent: true, opacity: 0.45 })));
  const ax = new THREE.BufferGeometry();
  ax.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.01, -R.d0, 0, 0.01, -R.d1, R.x0, 0.01, 0, R.x1, 0.01, 0], 3));
  g.add(new THREE.LineSegments(ax, new THREE.LineBasicMaterial({ color: 0xff5a36 })));
  if (labels) {
    const xl = new THREE.Group();
    xl.name = 'grid:x';
    g.add(xl);
    g.userData.xLabels = xl; // на разрезе прячет setGridView
    const mk = (parent, text, x, d, opts = {}) => {
      const s = labels.make(text, { px: 22, color: '#c8352a', bg: 'rgba(255,255,255,0.92)', kind: 'grid', depthTest: false, ...opts });
      s.position.set(x, 0.02, -d);
      s.renderOrder = 11;
      parent.add(s);
    };
    const num = (n) => String(n).replace('-', '−');
    const step = cfg.gridLabelStep ?? 2;
    for (let x = Math.ceil(R.x0 / step) * step; x <= R.x1; x += step) mk(xl, num(x), x, R.d1 + 0.5);
    for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) mk(g, num(d), R.x0 - 0.45, d);
    // названия осей — над цифрами, прижаты к краям зала (cx: 0 / 1): на узком экране не выходят за кадр;
    // внизу слева на плане их закрыла бы экспликация
    mk(xl, 'м от оси', R.x1, R.d1 + 1.1, { color: '#333', cx: 1 });
    mk(g, cfg.zeroLineLabel || 'м от нулевой линии', R.x0, R.d1 + 1.1, { color: '#333', cx: 0 });
  }
  return g;
}

/** Наложения площадки для движка: { dims, grid }. */
export function blackBoxOverlays(labels, cfg) {
  return { dims: buildDimsFromList(labels, blackBoxDims(cfg)), grid: blackBoxGrid(labels, cfg) };
}

/**
 * Дежурный и зальный свет — настоящие источники для LightingSystem.
 * cfg.ambient: { duty: { color, decay, full, lite }, house: { color, decay, angle, full, lite, points: { full, lite } } }
 * full / lite — яркость одного источника в профиле; dutyRows — лампы из buildEmitters.
 * @returns {{ duty: THREE.Light[], blue: [], house: THREE.Light[] }}
 */
export function blackBoxAmbient(plan, cfg, dutyRows) {
  const A = cfg.ambient;
  const full = plan === 'full';
  // дежурный: в полном профиле — по источнику на каждую ферму с лампами, в лёгком — один на все
  const sets = full ? dutyRows : [dutyRows.flat()];
  const duty = sets.map((pts) => {
    const L = new THREE.PointLight(A.duty.color, 0, 0, A.duty.decay);
    L.position.copy(pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length)).add(new THREE.Vector3(0, -0.2, 0));
    L.userData.base = full ? A.duty.full : A.duty.lite;
    return L;
  });
  const house = (full ? A.house.points.full : A.house.points.lite).map(([x, d]) => {
    const L = new THREE.SpotLight(A.house.color, 0, 0, A.house.angle, 0.9, A.house.decay);
    L.position.set(x, cfg.room.ceiling - 0.05, -d);
    L.target.position.set(x, -1, -d);
    L.userData.base = full ? A.house.full : A.house.lite;
    return L;
  });
  return { duty, blue: [], house };
}
