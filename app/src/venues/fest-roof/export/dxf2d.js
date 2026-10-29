// =============================================================================
//  2D-ЧЕРТЕЖИ СЦЕНЫ ПОД КРЫШЕЙ (AutoCAD DXF) — с текущей планировкой зала (stage.layout):
//    1. buildPlanDXF(stage)    — план: стены, двери, колонны, капитальные балки, диагонали, V-косынки,
//                                фермы и стойки, купола, мольтон, станки, места, пульты, приборы, размеры
//    2. buildSectionDXF(stage) — продольный разрез: отметки пола, ферм, балок, потолка; гребёнка станков
//  Без лучей и пятен. Все размеры — config/*.js.
// =============================================================================
import { ROOF, CEIL_RECTS, roomPolygon } from '../config/dimensions.js';
import { LAYOUTS, placed, seatCount } from '../config/layouts.js';
import { FIXTURES, TYPES, SPECS, GROUPS } from '../config/fixtures.js';
import { clipSegmentToRects } from '../../../core/geom.js';
import { DxfWriter } from '../../../export/dxfWriter.js';
import { clip3 } from '../build/architecture.js';

const SHEET_TITLE = 'МЫТИЩИНСКИЙ ТЕАТР ДРАМЫ И КОМЕДИИ «ФЭСТ» · СЦЕНА ПОД КРЫШЕЙ';
const fmtM = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');
// Визуальные константы чертежа
const TXT = 0.16;
/** Номинальная мощность из строки паспорта («500 Вт (до 650 Вт)», «≈ 27 Вт») — первое число, Вт. */
const powerW = (s) => Number((String(s || '').match(/\d+(?:[.,]\d+)?/)?.[0] || '0').replace(',', '.'));

/** Состояние для чертежа: планировка и приборы (без stage — по умолчанию). */
export function exportState(stage) {
  const layout = stage?.layout || { id: LAYOUTS[0].id, rows: Math.max(...LAYOUTS[0].rows.map((r) => r.rank)), shift: 0 };
  const fixtures = (stage?.fixtures?.list || FIXTURES).map((f, idx) => ({ ...f, idx, hidden: !!f.hidden }));
  return { layout, fixtures, plan: placed(layout), name: LAYOUTS.find((l) => l.id === layout.id).name };
}

const SHAPE_BLOCK = { spot: 'FX_SPOT', wash: 'FX_WASH', beam: 'FX_BEAM', ledpar: 'FX_LEDPAR', profile: 'FX_PROFILE', fresnel: 'FX_FRESNEL', par: 'FX_PAR' };
function registerBlocks(dxf) {
  dxf.addBlock('FX_SPOT', (b) => { b.addRect(-0.13, -0.13, 0.13, 0.13); b.addRect(-0.08, -0.08, 0.08, 0.08); });
  dxf.addBlock('FX_WASH', (b) => { b.addRect(-0.14, -0.11, 0.14, 0.11); b.addRect(-0.09, -0.07, 0.09, 0.07); });
  dxf.addBlock('FX_BEAM', (b) => { b.addRect(-0.12, -0.12, 0.12, 0.12); b.addRect(-0.07, -0.07, 0.07, 0.07); });
  dxf.addBlock('FX_LEDPAR', (b) => { b.addRect(-0.13, -0.1, 0.13, 0.1); b.addLine(-0.16, 0, 0.16, 0); });
  dxf.addBlock('FX_PROFILE', (b) => { b.addRect(-0.09, -0.16, 0.09, 0.16); b.addLine(-0.12, 0, 0.12, 0); });
  dxf.addBlock('FX_FRESNEL', (b) => { b.addRect(-0.12, -0.13, 0.12, 0.13); b.addLine(-0.12, 0.08, 0.12, 0.08); });
  dxf.addBlock('FX_PAR', (b) => { b.addRect(-0.11, -0.11, 0.11, 0.11); });
  // стул: сиденье 0,44 × 0,42, спинка сзади (зритель смотрит в +Y блока)
  dxf.addBlock('SEAT', (b) => { b.addRect(-0.22, -0.21, 0.22, 0.21); b.addLine(-0.22, -0.19, 0.22, -0.19); });
  // купол дежурного света
  dxf.addBlock('DOME', (b) => { b.addCircle(0, 0, ROOF.domes.r); b.addCircle(0, 0, ROOF.domes.r * 0.5); });
}

const lineEnds = (l) => (l.axis === 'x' ? [[l.at, l.a0], [l.at, l.a1]] : [[l.a0, l.at], [l.a1, l.at]]);
const wallMid = (w) => (w.axis === 'x' ? [w.at, (w.a0 + w.a1) / 2] : [(w.a0 + w.a1) / 2, w.at]);

// =============================================================================
//  1. ПЛАН (X_cad = x, Y_cad = d)
// =============================================================================
export function buildPlanDXF(stage) {
  const { layout, fixtures, plan, name } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8 })
    .addLayer('WALLS', { color: 7 })
    .addLayer('DOORS', { color: 3 })
    .addLayer('COLUMNS', { color: 7 })
    .addLayer('CAPITAL', { color: 9, ltype: 'DASHED' })
    .addLayer('DIAGONALS', { color: 9 })
    .addLayer('VFRAMES', { color: 9 })
    .addLayer('TRUSSES', { color: 5 })
    .addLayer('LEGS', { color: 5 })
    .addLayer('DOMES', { color: 2 })
    .addLayer('MOLTON', { color: 8 })
    .addLayer('STANDS', { color: 8 })
    .addLayer('SEATS', { color: 30 })
    .addLayer('PULTS', { color: 6 })
    .addLayer('FIXTURES', { color: 8 })
    .addLayer('DIMS', { color: 2 })
    .addLayer('TEXT', { color: 7 });
  registerBlocks(dxf);
  const R = ROOF.room;

  // оси и сетка 1 м
  dxf.addLine(0, R.d0 - 1, 0, R.d1 + 1, { layer: '0_AXES' });
  dxf.addLine(R.x0 - 1, 0, R.x1 + 1, 0, { layer: '0_AXES' });
  dxf.addText(0.15, R.d1 + 0.6, 'ОСЬ РЯДОВ (X = 0)', { layer: '0_AXES', height: TXT });
  dxf.addText(R.x0 - 0.9, 0.12, ROOF.zeroLineLabel, { layer: '0_AXES', height: TXT, align: 'right' });
  for (let x = Math.ceil(R.x0); x <= R.x1; x++) {
    if (x) for (const [p, q] of clipSegmentToRects([x, R.d0], [x, R.d1], ROOF.rects)) dxf.addLine(p[0], p[1], q[0], q[1], { layer: '0_GRID' });
    if (x % 2 === 0) dxf.addText(x, R.d1 + 0.3, `${x > 0 ? '+' : ''}${x}`, { layer: '0_GRID', height: 0.14, align: 'center', valign: 'bottom' });
  }
  for (let d = Math.ceil(R.d0); d <= R.d1; d++) {
    if (d) for (const [p, q] of clipSegmentToRects([R.x0, d], [R.x1, d], ROOF.rects)) dxf.addLine(p[0], p[1], q[0], q[1], { layer: '0_GRID' });
    dxf.addText(R.x0 - 0.3, d, `${d > 0 ? '+' : ''}${d} м`, { layer: '0_GRID', height: 0.13, align: 'right', valign: 'middle' });
  }

  // стены: внутренний контур, номера стен, короба, цоколи, коридор, ниша над стеной 9
  dxf.addPolyline(roomPolygon(), { layer: 'WALLS', closed: true });
  for (const w of ROOF.walls) {
    if (w.part) continue;
    const [mx, md] = wallMid(w);
    dxf.addText(mx, md, w.id, { layer: 'TEXT', height: 0.2, align: 'center', valign: 'middle' });
  }
  const c = ROOF.corridor;
  dxf.addPolyline([[c.x0, c.d0], [c.x0, c.d1], [c.x1, c.d1], [c.x1, c.d0]], { layer: 'WALLS' });
  dxf.addText((c.x0 + c.x1) / 2, c.d1 - 0.5, 'коридор', { layer: 'TEXT', height: TXT, align: 'center' });
  for (const p of ROOF.plinths) dxf.addRect(p.x0, p.d0, p.x1, p.d1, { layer: 'WALLS' });
  const v11 = ROOF.vent11, v9 = ROOF.vent9;
  dxf.addRect(v11.x0, v11.d0, v11.x1, v11.d1, { layer: 'WALLS' });
  dxf.addText((v11.x0 + v11.x1) / 2, (v11.d0 + v11.d1) / 2, 'венткороб', { layer: 'TEXT', height: 0.12, align: 'center', rotation: 90 });
  dxf.addRect(v9.x0, v9.d0, v9.x1, v9.d1, { layer: 'WALLS', ltype: 'DASHED' });
  dxf.addText((v9.x0 + v9.x1) / 2, (v9.d0 + v9.d1) / 2, `венткороб до +${fmtM(v9.y)}`, { layer: 'TEXT', height: 0.12, align: 'center', valign: 'middle' });

  // двери: проём и дуга открывания внутрь помещения (двустворчатая — две створки от краёв проёма)
  for (const dr of ROOF.doors) {
    const w = ROOF.walls.find((x) => x.id === dr.wall && !x.part);
    const wd = dr.a1 - dr.a0;
    const sgn = w.at > 0 ? -1 : 1; // внутрь помещения
    const leaves = dr.double ? [[dr.a0, wd / 2, 1], [dr.a1, wd / 2, -1]] : [[dr.a0, wd, 1]];
    for (const [hinge, r, dir] of leaves) {
      // угол створки в плоскости стены (0° — вдоль +a) и открытой (перпендикулярно стене, внутрь)
      const along = dir > 0 ? 0 : 180, open = sgn > 0 ? 90 : 270;
      const [a0, a1] = [Math.min(along, open), Math.max(along, open)];
      const [s0, s1] = a1 - a0 > 180 ? [a1, a0 + 360] : [a0, a1];
      if (w.axis === 'd') {
        dxf.addLine(hinge, w.at, hinge, w.at + sgn * r, { layer: 'DOORS' });
        dxf.addArc(hinge, w.at, r, s0, s1, { layer: 'DOORS' });
      } else {
        // для стены вдоль d: «вдоль» — по +Y, «внутрь» — по ±X
        const alongY = dir > 0 ? 90 : 270, openX = sgn > 0 ? 0 : 180;
        const [b0, b1] = [Math.min(alongY, openX), Math.max(alongY, openX)];
        const [t0, t1] = b1 - b0 > 180 ? [b1, b0 + 360] : [b0, b1];
        dxf.addLine(w.at, hinge, w.at + sgn * r, hinge, { layer: 'DOORS' });
        dxf.addArc(w.at, hinge, r, t0, t1, { layer: 'DOORS' });
      }
    }
    const [mx, md] = w.axis === 'd' ? [(dr.a0 + dr.a1) / 2, w.at] : [w.at, (dr.a0 + dr.a1) / 2];
    dxf.addText(mx, md, `дверь ${fmtM(wd)}×${fmtM(dr.h)}`, { layer: 'DOORS', height: 0.11, align: 'center', valign: 'bottom', rotation: w.axis === 'x' ? 90 : 0 });
  }

  // колонны (I 0,40); замурованные — пунктиром
  for (const col of ROOF.columns) {
    const h = col.w / 2;
    dxf.addRect(col.x - h, col.d - h, col.x + h, col.d + h, { layer: 'COLUMNS', ltype: col.embedded ? 'DASHED' : null });
    if (!col.embedded) dxf.addText(col.x, col.d + h + 0.08, col.id, { layer: 'TEXT', height: 0.12, align: 'center' });
  }
  // капитальные балки (обрезаны контуром), диагонали, V-косынки
  const K = ROOF.capital;
  for (const l of K.lines) {
    for (const [p, q] of clipSegmentToRects(...lineEnds(l), CEIL_RECTS)) {
      const o = K.chord / 2;
      if (l.axis === 'x') { dxf.addLine(p[0] - o, p[1], q[0] - o, q[1], { layer: 'CAPITAL' }); dxf.addLine(p[0] + o, p[1], q[0] + o, q[1], { layer: 'CAPITAL' }); }
      else { dxf.addLine(p[0], p[1] - o, q[0], q[1] - o, { layer: 'CAPITAL' }); dxf.addLine(p[0], p[1] + o, q[0], q[1] + o, { layer: 'CAPITAL' }); }
    }
  }
  for (const [a, b] of ROOF.diagonals.bays) for (const [p, q] of clipSegmentToRects(a, b, CEIL_RECTS)) dxf.addLine(p[0], p[1], q[0], q[1], { layer: 'DIAGONALS' });
  for (const v of ROOF.vFrames) {
    const mid = (v.faceA + v.faceB) / 2;
    for (const [p, q] of clipSegmentToRects([v.x, v.faceA], [v.x, v.faceB], ROOF.rects)) {
      dxf.addRect(v.x - v.w / 2, Math.min(p[1], q[1]), v.x + v.w / 2, Math.max(p[1], q[1]), { layer: 'VFRAMES' });
    }
    dxf.addText(v.x, mid, 'V-косынки', { layer: 'VFRAMES', height: 0.11, align: 'center', rotation: 90 });
  }

  // фермы 30 × 30 и стойки
  const T = ROOF.trusses, s = T.size / 2;
  for (const l of T.lines) {
    if (l.axis === 'd') dxf.addRect(l.a0, l.at - s, l.a1, l.at + s, { layer: 'TRUSSES' });
    else dxf.addRect(l.at - s, l.a0, l.at + s, l.a1, { layer: 'TRUSSES' });
  }
  for (const l of T.lines.filter((t) => t.axis === 'd' && !t.extra)) dxf.addText(R.x1 + 0.4, l.at, `ферма d ${l.at > 0 ? '+' : ''}${fmtM(l.at)}`, { layer: 'TRUSSES', height: 0.13, valign: 'middle' });
  for (const g of T.legs) { dxf.addRect(g.x - s, g.d - s, g.x + s, g.d + s, { layer: 'LEGS' }); dxf.addLine(g.x - s, g.d - s, g.x + s, g.d + s, { layer: 'LEGS' }); }

  // купола и мольтон
  for (const p of ROOF.domes.list) dxf.addInsert('DOME', p.x, p.d, { layer: 'DOMES' });
  const m = ROOF.molton;
  dxf.addLine(m.x0, m.d, m.x1, m.d, { layer: 'MOLTON' });
  dxf.addText((m.x0 + m.x1) / 2, m.d - 0.3, 'мольтон (склад декораций за ним)', { layer: 'MOLTON', height: 0.13, align: 'center' });

  // зал: станки, места, пульты
  for (const st of plan.stands) {
    dxf.addRect(st.x0, st.d0, st.x1, st.d1, { layer: 'STANDS' });
    dxf.addText((st.x0 + st.x1) / 2, (st.d0 + st.d1) / 2, `+${fmtM(st.h, 1)}`, { layer: 'STANDS', height: 0.1, align: 'center', valign: 'middle' });
  }
  for (const se of plan.seats) dxf.addInsert('SEAT', se.x, se.d, { layer: 'SEATS', rotation: (-se.rotY * 180) / Math.PI });
  for (const pu of plan.pults) {
    dxf.addRect(pu.x0, pu.d0, pu.x1, pu.d1, { layer: 'PULTS' });
    dxf.addText((pu.x0 + pu.x1) / 2, (pu.d0 + pu.d1) / 2, `${pu.kind === 'light' ? 'пульт света' : 'пульт звука'} +${fmtM(pu.h, 1)}`, { layer: 'PULTS', height: 0.11, align: 'center', valign: 'middle', rotation: pu.x1 - pu.x0 < pu.d1 - pu.d0 ? 90 : 0 });
  }

  // приборы и номера
  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const sc = t.scale || 1;
    dxf.addInsert(SHAPE_BLOCK[t.shape] || 'FX_SPOT', f.mount.x, f.mount.d, { layer: 'FIXTURES', scaleX: sc, scaleY: sc, scaleZ: sc });
    dxf.addText(f.mount.x + 0.18, f.mount.d + 0.18, f.assumed ? `${f.no}*` : String(f.no), { layer: 'TEXT', height: 0.12, valign: 'middle' });
  }

  // размеры
  const w1 = ROOF.walls.find((w) => w.id === '1');
  dxf.addLinearDim(R.x0, R.d1, R.x1, R.d1, { offset: 1.4, label: `Ширина ${fmtM(R.x1 - R.x0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(R.x1, R.d0, R.x1, R.d1, { offset: -3.0, label: `Глубина ${fmtM(R.d1 - R.d0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(R.x1, w1.at, R.x1, ROOF.columns[0].d, { offset: -1.0, label: fmtM(w1.at - ROOF.columns[0].d), layer: 'DIMS' });

  // экспликация и штамп
  const legX = R.x1 + 4.0;
  let y = R.d1 + 1.5;
  const rows = [];
  let total = 0, watts = 0;
  for (const [k, def] of Object.entries(TYPES)) {
    const n = fixtures.filter((f) => f.type === k && !f.hidden).length;
    if (!n) continue;
    total += n;
    const sp = SPECS[k] || {};
    watts += n * powerW(sp.power);
    rows.push([k, def.name, String(n), sp.power || '-', sp.zoom || `${def.beam}°`, sp.weight || '-']);
  }
  rows.push(['ИТОГО', 'Всего приборов на плане', String(total), `≈ ${fmtM(watts / 1000, 1)} кВт`, '', '']);
  const t1 = dxf.addTable(legX, y, {
    title: 'ЭКСПЛИКАЦИЯ СВЕТОВОГО ОБОРУДОВАНИЯ',
    headers: [{ label: 'Код', width: 3.2, align: 'center' }, { label: 'Модель прибора', width: 8.6, align: 'left' }, { label: 'Шт', width: 2.0, align: 'center' }, { label: 'Мощность', width: 4.5, align: 'center' }, { label: 'Угол / Зум', width: 4.5, align: 'center' }, { label: 'Вес', width: 4.2, align: 'center' }],
    rows, layer: 'TEXT',
  });
  y = t1.bottomY - 0.35;
  dxf.addText(legX, y, '* — номер по допущению модели (на схеме цеха номера нет или он дублируется). Мощность — по паспортам, сумма номинальная.', { layer: 'TEXT', height: 0.14 });
  y -= 0.5;
  const t2 = dxf.addTable(legX, y, {
    title: 'ГРУППЫ ПРИБОРОВ (ЛИНИИ DMX И ДИММЕРОВ НА СХЕМЕ НЕ УКАЗАНЫ)',
    headers: [{ label: 'Группа', width: 14, align: 'left' }, { label: 'Приборов', width: 3, align: 'center' }],
    rows: Object.entries(GROUPS).map(([gid, g]) => [g.name, String(fixtures.filter((f) => f.group === gid && !f.hidden).length)]),
    layer: 'TEXT',
  });
  y = t2.bottomY - 0.7;
  dxf.addTitleBlock(legX, y - 2.2, {
    title: SHEET_TITLE,
    subtitle: `План помещения, конструкции, ферм, развеса света и зала — планировка «${name}» (2D)`,
    extra: `Приборов: ${total} шт. · Мест: ${seatCount(layout)} · Рядов: ${layout.rows} · Сдвиг: ${fmtM(layout.shift * 0.5, 1)} м`,
    width: 27.0,
    layer: 'TEXT',
  });
  return dxf.toString();
}

// =============================================================================
//  2. ПРОДОЛЬНЫЙ РАЗРЕЗ (X_cad = −d: стена 13 слева, склад у стены 8 справа — как у Камерной; Y_cad = высота)
// =============================================================================
export function buildSectionDXF(stage) {
  const { fixtures, plan, name } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8 })
    .addLayer('WALLS', { color: 7 })
    .addLayer('COLUMNS', { color: 7 })
    .addLayer('CAPITAL', { color: 9 })
    .addLayer('VFRAMES', { color: 9 })
    .addLayer('TRUSSES', { color: 5 })
    .addLayer('LEGS', { color: 5 })
    .addLayer('DOMES', { color: 2 })
    .addLayer('MOLTON', { color: 8 })
    .addLayer('STANDS', { color: 8 })
    .addLayer('PULTS', { color: 6 })
    .addLayer('FIXTURES', { color: 8 })
    .addLayer('DIMS', { color: 2 })
    .addLayer('TEXT', { color: 7 });
  const X = (d) => -d;
  const R = ROOF.room, C = R.ceiling, K = ROOF.capital, T = ROOF.trusses, CH = ROOF.channels;

  dxf.addLine(0, -1, 0, C + 2, { layer: '0_AXES' });
  dxf.addText(0.12, C + 1.6, ROOF.zeroLineLabel, { layer: '0_AXES', height: TXT });
  for (let d = Math.ceil(R.d0); d <= R.d1; d++) {
    if (d) dxf.addLine(X(d), -0.5, X(d), C, { layer: '0_GRID' });
    dxf.addText(X(d), -0.75, `${d > 0 ? '+' : ''}${d}`, { layer: '0_GRID', height: 0.14, align: 'center', valign: 'top' });
  }
  for (let y = 1; y <= 4; y++) dxf.addLine(X(R.d1), y, X(R.d0), y, { layer: '0_GRID' });

  // пол, потолок, торцевые стены (13 и 8), корридор
  dxf.addLine(X(R.d1), 0, X(R.d0), 0, { layer: 'WALLS' });
  dxf.addLine(X(R.d1), C, X(R.d0), C, { layer: 'WALLS' });
  dxf.addLine(X(R.d1), 0, X(R.d1), C, { layer: 'WALLS' });
  dxf.addLine(X(R.d0), 0, X(R.d0), C, { layer: 'WALLS' });
  const v9 = ROOF.vent9;
  dxf.addRect(X(v9.d1), 0, X(v9.d0), v9.y, { layer: 'WALLS', ltype: 'DASHED' });
  // швеллеры (по d — сплошная полоса), капитальные балки поперёк d — сечения, вдоль d — полосы поясов
  dxf.addRect(X(R.d1), CH.y0, X(R.d0), CH.y1, { layer: 'CAPITAL' });
  for (const l of K.lines.filter((x) => x.axis === 'd')) dxf.addRect(X(l.at) - K.chord / 2, K.y0, X(l.at) + K.chord / 2, K.y1, { layer: 'CAPITAL' });
  dxf.addLine(X(R.d1), K.y0 + K.chord, X(R.d0), K.y0 + K.chord, { layer: 'CAPITAL', ltype: 'DASHED' });
  // колонны
  for (const col of ROOF.columns.filter((x) => !x.embedded && x.x > 0)) dxf.addRect(X(col.d) - col.w / 2, 0, X(col.d) + col.w / 2, K.y1, { layer: 'COLUMNS' });
  // V-косынки (плоскость x 5,70), обрезка стеной 7
  const v = ROOF.vFrames[0], mid = (v.faceA + v.faceB) / 2;
  for (const face of [v.faceA, v.faceB]) {
    const dir = Math.sign(mid - face);
    const base = [v.x, 0, face], node = [v.x, v.node.y, face + dir * v.node.off], top = [v.x, v.topY, face], centre = [v.x, v.topY, mid];
    for (const [a, b] of [[base, node], [node, top], [node, centre]]) {
      for (const [p, q] of clip3(a, b, ROOF.rects)) dxf.addLine(X(p[2]), p[1], X(q[2]), q[1], { layer: 'VFRAMES' });
    }
  }
  // фермы: продольная полоса и сечения поперечных линий
  dxf.addRect(X(Math.max(...T.lines.map((l) => (l.axis === 'x' ? l.a1 : l.at)))), T.y0, X(Math.min(...T.lines.map((l) => (l.axis === 'x' ? l.a0 : l.at)))), T.y1, { layer: 'TRUSSES' });
  for (const l of T.lines.filter((x) => x.axis === 'd' && !x.extra)) dxf.addRect(X(l.at) - T.size / 2, T.y0, X(l.at) + T.size / 2, T.y1, { layer: 'TRUSSES' });
  for (const g of T.legs) dxf.addRect(X(g.d) - T.size / 2, 0, X(g.d) + T.size / 2, T.y0, { layer: 'LEGS' });
  // купола, мольтон
  for (const p of ROOF.domes.list) dxf.addArc(X(p.d), ROOF.domes.bottomY, ROOF.domes.r, 0, 180, { layer: 'DOMES' });
  const m = ROOF.molton;
  dxf.addLine(X(m.d), m.y0, X(m.d), m.y1, { layer: 'MOLTON' });
  // гребёнка станков и пульты текущей планировки
  for (const st of plan.stands) dxf.addRect(X(st.d1), 0, X(st.d0), st.h, { layer: 'STANDS' });
  for (const r of plan.rows.filter((x) => x.h === 0)) dxf.addLine(X(r.d1), 0.02, X(r.d0), 0.02, { layer: 'STANDS' });
  for (const pu of plan.pults) dxf.addRect(X(pu.d1), 0, X(pu.d0), pu.h, { layer: 'PULTS' });
  // приборы — положения подвеса
  for (const f of fixtures) {
    if (f.hidden) continue;
    dxf.addRect(X(f.mount.d) - 0.1, f.mount.y - 0.3, X(f.mount.d) + 0.1, f.mount.y, { layer: 'FIXTURES' });
  }
  // отметки и размеры
  const ex = X(R.d0) - 1.0;
  dxf.addElevationMark(ex, 0, '±0,000 (Пол)', { layer: 'DIMS' });
  dxf.addElevationMark(ex, T.y0, `+${fmtM(T.y0, 3)} (Низ ферм)`, { layer: 'DIMS' });
  dxf.addElevationMark(ex, K.y0, `+${fmtM(K.y0, 3)} (Низ капитальных балок)`, { layer: 'DIMS' });
  dxf.addElevationMark(ex, K.y1, `+${fmtM(K.y1, 3)} (Верх балок, швеллеры)`, { layer: 'DIMS' });
  dxf.addElevationMark(ex, C, `+${fmtM(C, 3)} (Потолок — низ настила)`, { layer: 'DIMS' });
  dxf.addLinearDim(X(R.d1), 0, X(R.d0), 0, { offset: -1.3, label: `Глубина ${fmtM(R.d1 - R.d0)} м`, layer: 'DIMS' });
  dxf.addTitleBlock(X(R.d1), -3.8, { title: SHEET_TITLE, subtitle: `Продольный разрез по оси X = 0 — планировка «${name}» (2D)`, width: 17.4, layer: 'TEXT' });
  return dxf.toString();
}
