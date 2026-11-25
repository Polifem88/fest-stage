// =============================================================================
//  2D-ЧЕРТЕЖИ СТУДИИ МУЛЬТИМЕДИА (AutoCAD DXF) — с учётом состояния блитчера и высоты ФП:
//    1. buildPlanDXF(stage)    — план павильона, ниш дверей, козырька, циклорамы R = 0,70,
//                                стационарных ферм, подвижной фермы ФП, блитчера, дежурки и 15 приборов
//    2. buildSectionDXF(stage) — продольный разрез с высотными отметками, дугой циклорамы,
//                                подвижной фермой с цепями/лебёдками и профилем блитчера
// =============================================================================
import { STUDIO } from '../config/dimensions.js';
import { RIGGING } from '../config/rigging.js';
import { LAYOUTS, DEFAULT_LAYOUT, placed, seatCount } from '../config/layouts.js';
import { FIXTURES, TYPES, SPECS, GROUPS } from '../config/fixtures.js';
import { hoistPoints } from '../build/rigging.js';
import { DxfWriter } from '../../../export/dxfWriter.js';

const SHEET_TITLE = 'МЫТИЩИНСКИЙ ТЕАТР ДРАМЫ И КОМЕДИИ «ФЭСТ» · СТУДИЯ МУЛЬТИМЕДИА';
const fmtM = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');
const TXT = 0.15;
const powerW = (s) => Number((String(s || '').match(/\d+(?:[.,]\d+)?/)?.[0] || '0').replace(',', '.'));

/** Состояние для экспорта: планировка блитчера, высота подвижной фермы ФП и список приборов. */
export function exportState(stage) {
  const layout = stage?.layout || { id: DEFAULT_LAYOUT, rows: 0, shift: 0 };
  const rawH = stage?.rigging?.height?.('MF');
  const mfH = Number.isFinite(rawH) ? rawH : RIGGING[0].rest;
  const fixtures = (stage?.fixtures?.list || FIXTURES).map((f, idx) => ({ ...f, idx, hidden: !!f.hidden }));
  const layoutDef = LAYOUTS.find((l) => l.id === layout.id) || LAYOUTS[0];
  return { layout, mfH, fixtures, plan: placed(layout), layoutName: layoutDef.name, seats: seatCount(layout) };
}

const SHAPE_BLOCK = {
  spot: 'FX_SPOT',
  wash: 'FX_WASH',
  beam: 'FX_BEAM',
  ledpar: 'FX_LEDPAR',
  profile: 'FX_PROFILE',
  fresnel: 'FX_FRESNEL',
  par: 'FX_PAR',
};

function registerBlocks(dxf) {
  dxf.addBlock('FX_SPOT', (b) => { b.addRect(-0.13, -0.13, 0.13, 0.13); b.addRect(-0.08, -0.08, 0.08, 0.08); });
  dxf.addBlock('FX_WASH', (b) => { b.addRect(-0.14, -0.11, 0.14, 0.11); b.addRect(-0.09, -0.07, 0.09, 0.07); });
  dxf.addBlock('FX_BEAM', (b) => { b.addRect(-0.12, -0.12, 0.12, 0.12); b.addRect(-0.07, -0.07, 0.07, 0.07); });
  dxf.addBlock('FX_LEDPAR', (b) => { b.addRect(-0.13, -0.10, 0.13, 0.10); b.addLine(-0.16, 0, 0.16, 0); });
  dxf.addBlock('FX_PROFILE', (b) => { b.addRect(-0.09, -0.16, 0.09, 0.16); b.addLine(-0.12, 0, 0.12, 0); });
  dxf.addBlock('FX_FRESNEL', (b) => { b.addRect(-0.12, -0.13, 0.12, 0.13); b.addLine(-0.12, 0.08, 0.12, 0.08); });
  dxf.addBlock('FX_PAR', (b) => { b.addRect(-0.11, -0.11, 0.11, 0.11); });
  // Кресло/стул 0,44 × 0,42 м, лицом в +Y_cad (+d)
  dxf.addBlock('SEAT', (b) => { b.addRect(-0.22, -0.21, 0.22, 0.21); b.addLine(-0.22, -0.17, 0.22, -0.17); });
  // Встроенный светильник дежурного света
  dxf.addBlock('DUTY_LAMP', (b) => { b.addCircle(0, 0, STUDIO.duty.r); b.addCircle(0, 0, STUDIO.duty.r * 0.55); });
  // Цепная лебёдка подвижной фермы
  const H = STUDIO.movableTruss.hoist;
  dxf.addBlock('HOIST', (b) => {
    b.addRect(-H.w / 2, -H.d / 2, H.w / 2, H.d / 2);
    b.addLine(-H.w / 2, -H.d / 2, H.w / 2, H.d / 2);
    b.addLine(-H.w / 2, H.d / 2, H.w / 2, -H.d / 2);
  });
}

// =============================================================================
//  1. ПЛАН ПАВИЛЬОНА (X_cad = x, Y_cad = d)
// =============================================================================
export function buildPlanDXF(stage) {
  const { layout, mfH, fixtures, plan, layoutName, seats } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8 })
    .addLayer('WALLS', { color: 7 })
    .addLayer('DOORS', { color: 3 })
    .addLayer('CANOPY', { color: 9, ltype: 'DASHED' })
    .addLayer('CYC', { color: 4 })
    .addLayer('TRUSSES', { color: 5 })
    .addLayer('RIGGING', { color: 6 })
    .addLayer('DUTY', { color: 2 })
    .addLayer('CEIL_EQUIP', { color: 8 })
    .addLayer('STANDS', { color: 8 })
    .addLayer('SEATS', { color: 30 })
    .addLayer('FIXTURES', { color: 8 })
    .addLayer('DIMS', { color: 2 })
    .addLayer('TEXT', { color: 7 });
  registerBlocks(dxf);

  const R = STUDIO.room;
  const CN = STUDIO.canopy;
  const W = STUDIO.window;
  const C = STUDIO.cyc;
  const T = STUDIO.trusses;
  const MT = STUDIO.movableTruss;
  const B = STUDIO.bleacher;
  const exit = STUDIO.doors.find((d) => d.id === 'exit');
  const tech = STUDIO.doors.find((d) => d.id === 'tech');

  // 1. Оси и метровая сетка
  dxf.addLine(0, exit.d0 - 0.8, 0, R.d1 + 0.9, { layer: '0_AXES' });
  dxf.addLine(R.x0 - 0.9, 0, tech.x1 + 0.8, 0, { layer: '0_AXES' });
  dxf.addText(0.12, R.d1 + 0.55, 'ОСЬ ПАВИЛЬОНА (X = 0)', { layer: '0_AXES', height: TXT });
  dxf.addText(R.x0 - 0.65, 0.12, STUDIO.zeroLineLabel, { layer: '0_AXES', height: TXT, align: 'right' });

  for (let x = Math.ceil(R.x0); x <= Math.floor(R.x1); x++) {
    if (x !== 0) dxf.addLine(x, R.d0, x, R.d1, { layer: '0_GRID' });
    dxf.addText(x, R.d1 + 0.25, `${x > 0 ? '+' : ''}${x}`, { layer: '0_GRID', height: 0.13, align: 'center', valign: 'bottom' });
  }
  for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) {
    if (d !== 0) dxf.addLine(R.x0, d, R.x1, d, { layer: '0_GRID' });
    dxf.addText(R.x0 - 0.22, d, `${d > 0 ? '+' : ''}${d} м`, { layer: '0_GRID', height: 0.12, align: 'right', valign: 'middle' });
  }

  // 2. Контур стен с нишей выхода и углублением технической двери
  dxf.addPolyline([
    [R.x0, R.d0],
    [exit.x0, R.d0],
    [exit.x0, exit.d0],
    [exit.x1, exit.d0],
    [R.x1, tech.d0],
    [tech.x1, tech.d0],
    [tech.x1, tech.d1],
    [R.x1, tech.d1],
    [R.x1, R.d1],
    [R.x0, R.d1],
  ], { layer: 'WALLS', closed: true });

  // 3. Двери и дуги открывания
  const exitLeaf = (exit.x1 - exit.x0) / 2;
  dxf.addLine(exit.x0, exit.d0, exit.x0, exit.d0 + exitLeaf, { layer: 'DOORS' });
  dxf.addArc(exit.x0, exit.d0, exitLeaf, 0, 90, { layer: 'DOORS' });
  dxf.addLine(exit.x1, exit.d0, exit.x1, exit.d0 + exitLeaf, { layer: 'DOORS' });
  dxf.addArc(exit.x1, exit.d0, exitLeaf, 90, 180, { layer: 'DOORS' });
  dxf.addText((exit.x0 + exit.x1) / 2, exit.d0 - 0.22, `выход ${fmtM(exit.x1 - exit.x0)}×${fmtM(exit.h)}`, { layer: 'DOORS', height: 0.12, align: 'center' });

  const techW = tech.d1 - tech.d0;
  dxf.addLine(tech.x1, tech.d0, tech.x1 - techW, tech.d0, { layer: 'DOORS' });
  dxf.addArc(tech.x1, tech.d0, techW, 90, 180, { layer: 'DOORS' });
  dxf.addText(tech.x1 + 0.18, (tech.d0 + tech.d1) / 2, `тех. дверь ${fmtM(techW)}×${fmtM(tech.h)}`, { layer: 'DOORS', height: 0.12, align: 'center', rotation: 90 });

  // 4. Козырёк и окно операторской
  dxf.addLine(R.x0, CN.d1, R.x1, CN.d1, { layer: 'CANOPY' });
  dxf.addRect(W.x0, W.d - 0.08, W.x1, W.d, { layer: 'CANOPY' });
  for (let i = 1; i < W.sections; i++) {
    const wx = W.x0 + ((W.x1 - W.x0) * i) / W.sections;
    dxf.addLine(wx, W.d - 0.08, wx, W.d, { layer: 'CANOPY' });
  }
  dxf.addText(0, CN.d0 + 0.32, `козырёк операторской +${fmtM(CN.y)} (окно +${fmtM(W.y0)}…+${fmtM(W.y1)})`, { layer: 'CANOPY', height: 0.12, align: 'center' });

  // 5. Циклорама (внешний контур с угловыми дугами R = 0,70 и пунктирная граница начала выкружки пола)
  const cx0 = C.x0 + C.r, cx1 = C.x1 - C.r, cd1 = C.d1 - C.r;
  dxf.addLine(C.x0, C.d0, C.x1, C.d0, { layer: 'CYC' });
  dxf.addLine(C.x0, C.d0, C.x0, cd1, { layer: 'CYC' });
  dxf.addLine(C.x1, C.d0, C.x1, cd1, { layer: 'CYC' });
  dxf.addLine(cx0, C.d1, cx1, C.d1, { layer: 'CYC' });
  dxf.addArc(cx0, cd1, C.r, 90, 180, { layer: 'CYC' });
  dxf.addArc(cx1, cd1, C.r, 0, 90, { layer: 'CYC' });
  dxf.addPolyline([[cx0, C.d0], [cx0, cd1], [cx1, cd1], [cx1, C.d0]], { layer: 'CYC', ltype: 'DASHED' });
  dxf.addText(0, C.d1 - 0.32, `циклорама В=+${fmtM(C.h)} · выкружка R=${fmtM(C.r)}`, { layer: 'CYC', height: 0.12, align: 'center' });

  // 6. Стационарные фермы 30 × 30 (верхние, нижние и 3 вертикальные вставки)
  const hs = T.size / 2;
  for (const l of T.upper.lines) {
    if (l.axis === 'd') {
      dxf.addRect(l.a0, l.at - hs, l.a1, l.at + hs, { layer: 'TRUSSES' });
      dxf.addText(R.x1 + 0.58, l.at, `${l.id} (d=${l.at >= 0 ? '+' : ''}${fmtM(l.at)})`, { layer: 'TRUSSES', height: 0.12, valign: 'middle' });
    } else {
      dxf.addRect(l.at - hs, l.a0, l.at + hs, l.a1, { layer: 'TRUSSES' });
    }
  }
  for (const l of T.lower.lines) {
    if (l.axis === 'd') dxf.addRect(l.a0, l.at - hs, l.a1, l.at + hs, { layer: 'TRUSSES', ltype: 'DASHED' });
    else dxf.addRect(l.at - hs, l.a0, l.at + hs, l.a1, { layer: 'TRUSSES', ltype: 'DASHED' });
  }
  for (const p of T.posts) {
    dxf.addRect(p.x - hs, p.d - hs, p.x + hs, p.d + hs, { layer: 'TRUSSES' });
    dxf.addLine(p.x - hs, p.d - hs, p.x + hs, p.d + hs, { layer: 'TRUSSES' });
    dxf.addLine(p.x - hs, p.d + hs, p.x + hs, p.d - hs, { layer: 'TRUSSES' });
  }

  // 7. Подвижный фермовый контур ФП (4,10 × 5,00 м) и 4 цепные лебёдки
  for (const l of MT.lines) {
    if (l.axis === 'd') dxf.addRect(l.a0, l.at - hs, l.a1, l.at + hs, { layer: 'RIGGING' });
    else dxf.addRect(l.at - hs, l.a0, l.at + hs, l.a1, { layer: 'RIGGING' });
  }
  for (const hp of hoistPoints()) dxf.addInsert('HOIST', hp.x, hp.d, { layer: 'RIGGING' });
  dxf.addText(0, MT.d0 - 0.34, `ФП (H=+${fmtM(mfH)} м)`, { layer: 'RIGGING', height: 0.14, align: 'center' });

  // 8. Потолочные светильники дежурки, кассеты кондиционера и диффузоры
  for (const dl of STUDIO.duty.list) dxf.addInsert('DUTY_LAMP', dl.x, dl.d, { layer: 'DUTY' });
  for (const c of STUDIO.cassettes) {
    const ch = c.size / 2;
    dxf.addRect(c.x - ch, c.d0, c.x + ch, c.d1, { layer: 'CEIL_EQUIP' });
    dxf.addText(c.x, (c.d0 + c.d1) / 2, 'КК', { layer: 'CEIL_EQUIP', height: 0.11, align: 'center', valign: 'middle' });
  }
  for (const df of STUDIO.diffusers) {
    const dh = df.size / 2;
    dxf.addRect(df.x - dh, df.d - dh, df.x + dh, df.d + dh, { layer: 'CEIL_EQUIP' });
  }

  // 9. Блитчер в текущем состоянии (folded / unfolded) и зрительские места
  for (const t of plan.tiers) {
    dxf.addRect(t.x0, t.d0, t.x1, t.d1, { layer: 'STANDS' });
    if (layout.id === 'unfolded') {
      dxf.addLine(B.stairX0, t.d0, B.stairX0, t.d1, { layer: 'STANDS' });
      dxf.addText(B.stairX0 + 0.25, (t.d0 + t.d1) / 2, `+${fmtM(t.h)}`, { layer: 'STANDS', height: 0.10, align: 'center', valign: 'middle' });
    }
  }
  if (layout.id === 'unfolded') {
    for (const s of plan.steps) dxf.addRect(s.x0, s.d0, s.x1, s.d1, { layer: 'STANDS', ltype: 'DASHED' });
  } else {
    dxf.addText((B.x0 + B.x1) / 2, (B.dBack + plan.tiers.at(-1).d1) / 2, 'блитчер свёрнут (пакет 1,07 м, до +1,20)', { layer: 'STANDS', height: 0.12, align: 'center', valign: 'middle' });
  }
  // Заднее и боковые ограждения блитчера
  dxf.addLine(plan.backRail.x0, plan.backRail.d, plan.backRail.x1, plan.backRail.d, { layer: 'STANDS' });
  for (const sr of plan.sideRails) {
    const len = sr.d1 - sr.d0;
    const xTip = sr.x + Math.sin(sr.splayRad) * len;
    const dTip = sr.d0 + Math.cos(sr.splayRad) * len;
    dxf.addLine(sr.x, sr.d0, xTip, dTip, { layer: 'STANDS' });
  }
  for (const se of plan.seats) {
    dxf.addInsert('SEAT', se.x, se.d, { layer: 'SEATS', rotation: (-(se.rotY || 0) * 180) / Math.PI });
  }

  // 10. Приборы постоянного развеса (развёрнутые по азимуту наведения) и условные номера 1*…15*
  for (const f of fixtures) {
    if (f.hidden) continue;
    const t = TYPES[f.type];
    const sc = t.scale || 1;
    const dx = (f.aim?.x ?? f.mount.x) - f.mount.x;
    const dd = (f.aim?.d ?? f.mount.d + 1) - f.mount.d;
    const rotDeg = Math.hypot(dx, dd) > 1e-3 ? Math.round((-Math.atan2(dx, dd) * 180) / Math.PI) : 0;
    dxf.addInsert(SHAPE_BLOCK[t.shape] || 'FX_SPOT', f.mount.x, f.mount.d, { layer: 'FIXTURES', scaleX: sc, scaleY: sc, scaleZ: sc, rotation: rotDeg });
    const tx = f.mount.x > 2.4 ? f.mount.x - 0.28 : f.mount.x + 0.17;
    dxf.addText(tx, f.mount.d + 0.16, f.assumed ? `${f.no}*` : String(f.no), { layer: 'TEXT', height: 0.12, valign: 'middle' });
  }

  // 11. Размерные цепочки
  dxf.addLinearDim(R.x0, R.d1, R.x1, R.d1, { offset: 1.25, label: `Ширина ${fmtM(R.x1 - R.x0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(R.x0, R.d0, R.x0, R.d1, { offset: 1.15, label: `Глубина ${fmtM(R.d1 - R.d0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(R.x0, C.d0, R.x0, R.d1, { offset: 0.55, label: `Циклорама ${fmtM(R.d1 - C.d0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(B.x0, exit.d0, B.x1, exit.d0, { offset: -0.75, label: `Блитчер ${fmtM(B.x1 - B.x0)} м`, layer: 'DIMS' });
  dxf.addLinearDim(B.x1, exit.d0, R.x1, exit.d0, { offset: -0.75, label: `Проход ${fmtM(R.x1 - B.x1)} м`, layer: 'DIMS' });

  // 12. Экспликация приборов, группы и штамп
  const legX = R.x1 + 3.2;
  let y = R.d1 + 1.2;
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
  rows.push(['ИТОГО', 'Всего приборов постоянного развеса', String(total), `≈ ${fmtM(watts / 1000, 1)} кВт`, '', '']);
  const t1 = dxf.addTable(legX, y, {
    title: 'ЭКСПЛИКАЦИЯ СВЕТОВОГО ОБОРУДОВАНИЯ',
    headers: [
      { label: 'Код', width: 3.0, align: 'center' },
      { label: 'Модель прибора', width: 8.6, align: 'left' },
      { label: 'Шт', width: 1.8, align: 'center' },
      { label: 'Мощность', width: 4.4, align: 'center' },
      { label: 'Угол / Зум', width: 4.8, align: 'center' },
      { label: 'Вес', width: 3.8, align: 'center' },
    ],
    rows,
    layer: 'TEXT',
  });
  y = t1.bottomY - 0.35;
  dxf.addText(legX, y, '* — номер по допущению модели (на схеме цеха сквозная нумерация не указана). Мощность — по паспортам, сумма номинальная.', { layer: 'TEXT', height: 0.13 });
  y -= 0.45;
  const t2 = dxf.addTable(legX, y, {
    title: 'ГРУППЫ ПРИБОРОВ (СВИТЧЕР LIGHT UNION COMMUPACK 24 · ПУЛЬТ ETC COBALT CONGO KID)',
    headers: [
      { label: 'Группа', width: 14.4, align: 'left' },
      { label: 'Приборов', width: 3.0, align: 'center' },
    ],
    rows: Object.entries(GROUPS).map(([gid, g]) => [g.name, String(fixtures.filter((f) => f.group === gid && !f.hidden).length)]),
    layer: 'TEXT',
  });
  y = t2.bottomY - 0.65;
  dxf.addTitleBlock(legX, y - 2.2, {
    title: SHEET_TITLE,
    subtitle: `План помещения, циклорамы, ферм, блитчера («${layoutName}») и развеса света (2D)`,
    extra: `Приборов: ${total} шт. · Мест: ${seats} · Подвижная ферма ФП: H=+${fmtM(mfH)} м`,
    width: 26.4,
    layer: 'TEXT',
  });

  return dxf.toString();
}

// =============================================================================
//  2. ПРОДОЛЬНЫЙ РАЗРЕЗ (X_cad = −d: циклорама слева, операторская справа; Y_cad = высота)
// =============================================================================
export function buildSectionDXF(stage) {
  const { layout, mfH, fixtures, plan, layoutName, seats } = exportState(stage);
  const dxf = new DxfWriter({ insUnits: 6, is3D: false });
  dxf
    .addLayer('0_AXES', { color: 1, ltype: 'CENTER' })
    .addLayer('0_GRID', { color: 8 })
    .addLayer('WALLS', { color: 7 })
    .addLayer('CANOPY', { color: 9 })
    .addLayer('CYC', { color: 4 })
    .addLayer('TRUSSES', { color: 5 })
    .addLayer('RIGGING', { color: 6 })
    .addLayer('DUTY', { color: 2 })
    .addLayer('CEIL_EQUIP', { color: 8 })
    .addLayer('STANDS', { color: 8 })
    .addLayer('FIXTURES', { color: 8 })
    .addLayer('DIMS', { color: 2 })
    .addLayer('TEXT', { color: 7 });

  const X = (d) => -d;
  const R = STUDIO.room;
  const CN = STUDIO.canopy;
  const W = STUDIO.window;
  const C = STUDIO.cyc;
  const T = STUDIO.trusses;
  const MT = STUDIO.movableTruss;
  const B = STUDIO.bleacher;
  const exit = STUDIO.doors.find((d) => d.id === 'exit');
  const hs = T.size / 2;

  // 1. Нулевая линия d = 0 и сетка
  dxf.addLine(0, -0.8, 0, R.ceiling + 1.4, { layer: '0_AXES' });
  dxf.addText(0.12, R.ceiling + 1.0, STUDIO.zeroLineLabel, { layer: '0_AXES', height: TXT });
  for (let d = Math.ceil(R.d0); d <= Math.floor(R.d1); d++) {
    if (d !== 0) dxf.addLine(X(d), -0.35, X(d), R.ceiling, { layer: '0_GRID' });
    dxf.addText(X(d), -0.58, `${d > 0 ? '+' : ''}${d}`, { layer: '0_GRID', height: 0.12, align: 'center', valign: 'top' });
  }
  for (let y = 1; y <= 5; y++) dxf.addLine(X(R.d1), y, X(CN.d1), y, { layer: '0_GRID' });

  // 2. Пол, потолок, стены и козырёк с окном операторской
  dxf.addLine(X(R.d1), 0, X(exit.d0), 0, { layer: 'WALLS' });
  dxf.addLine(X(R.d1), 0, X(R.d1), R.ceiling, { layer: 'WALLS' });
  dxf.addLine(X(R.d1), R.ceiling, X(CN.d1), R.ceiling, { layer: 'WALLS' });
  dxf.addLine(X(R.d0), 0, X(R.d0), CN.y, { layer: 'WALLS' });
  dxf.addRect(X(R.d0), 0, X(exit.d0), exit.h, { layer: 'WALLS', ltype: 'DASHED' });
  dxf.addLine(X(CN.d1), CN.y, X(R.d0), CN.y, { layer: 'CANOPY' });
  dxf.addLine(X(CN.d1), CN.y, X(CN.d1), R.ceiling, { layer: 'CANOPY' });
  dxf.addRect(X(W.d), W.y0, X(W.d - 0.08), W.y1, { layer: 'CANOPY' });
  dxf.addText(X(CN.d0) - 0.35, (W.y0 + W.y1) / 2, 'Операторская', { layer: 'TEXT', height: 0.13, align: 'center' });

  // 3. Профиль циклорамы с нижней выкружкой R = 0,70
  const cd1 = C.d1 - C.r;
  dxf.addLine(X(cd1), 0.003, X(C.d0), 0.003, { layer: 'CYC' });
  dxf.addArc(X(cd1), C.r, C.r, 180, 270, { layer: 'CYC' });
  dxf.addLine(X(C.d1), C.r, X(C.d1), C.h, { layer: 'CYC' });
  dxf.addLine(X(C.d1), C.h, X(C.d0), C.h, { layer: 'CYC', ltype: 'DASHED' });
  dxf.addLine(X(C.d0), 0, X(C.d0), C.h, { layer: 'CYC', ltype: 'DASHED' });
  dxf.addText(X(C.d1 / 2), C.h + 0.14, `Циклорама В=+${fmtM(C.h)} (выкружка R=${fmtM(C.r)})`, { layer: 'CYC', height: 0.12, align: 'center' });

  // 4. Верхние и нижние стационарные фермы + вертикальные вставки
  dxf.addRect(X(3.80), T.upper.y0, X(-7.70), T.upper.y1, { layer: 'TRUSSES' });
  for (const l of T.upper.lines.filter((x) => x.axis === 'd')) {
    dxf.addRect(X(l.at + hs), T.upper.y0, X(l.at - hs), T.upper.y1, { layer: 'TRUSSES' });
    dxf.addText(X(l.at), T.upper.y1 + 0.06, l.id, { layer: 'TRUSSES', height: 0.11, align: 'center' });
  }
  dxf.addRect(X(0), T.lower.y0, X(-7.85), T.lower.y1, { layer: 'TRUSSES', ltype: 'DASHED' });
  for (const p of T.posts) {
    dxf.addRect(X(p.d + hs), p.y0, X(p.d - hs), p.y1, { layer: 'TRUSSES' });
  }

  // 5. Подвижная ферма ФП на высоте mfH с лебёдками и цепями под Ф3 и Ф5
  dxf.addRect(X(MT.d1 + hs), mfH, X(MT.d0 - hs), mfH + T.size, { layer: 'RIGGING' });
  for (const hd of [MT.d0, MT.d1]) {
    const H = MT.hoist;
    dxf.addRect(X(hd + hs), mfH, X(hd - hs), mfH + T.size, { layer: 'RIGGING' });
    dxf.addRect(X(hd + H.d / 2), H.y0, X(hd - H.d / 2), H.y1, { layer: 'RIGGING' });
    dxf.addLine(X(hd), H.y1, X(hd), H.spansetTopY, { layer: 'RIGGING' });
    dxf.addLine(X(hd), mfH + T.size, X(hd), H.y0, { layer: 'RIGGING', ltype: 'DASHED' });
  }
  const mfLblY = mfH > 4.1 ? mfH - 0.22 : mfH + T.size + 0.08;
  dxf.addText(X((MT.d0 + MT.d1) / 2), mfLblY, `ФП (+${fmtM(mfH, 3)} м)`, { layer: 'RIGGING', height: 0.13, align: 'center' });

  // 6. Светильники дежурки и кассеты на потолке
  for (const dl of STUDIO.duty.list) {
    dxf.addLine(X(dl.d - STUDIO.duty.r), R.ceiling - 0.02, X(dl.d + STUDIO.duty.r), R.ceiling - 0.02, { layer: 'DUTY' });
  }
  for (const c of STUDIO.cassettes) {
    dxf.addRect(X(c.d1), R.ceiling - 0.04, X(c.d0), R.ceiling, { layer: 'CEIL_EQUIP' });
  }

  // 7. Профиль блитчера (пакет folded или гребёнка 4 ярусов + 0-й ряд в unfolded) и ограждение +2,20
  for (const t of plan.tiers) {
    const yLow = layout.id === 'unfolded' ? (t.tier - 1) * B.riser : 0;
    dxf.addRect(X(t.d1), yLow, X(t.d0), t.h, { layer: 'STANDS' });
  }
  if (layout.id === 'unfolded') {
    for (const s of plan.steps) dxf.addRect(X(s.d1), s.y0, X(s.d0), s.y1, { layer: 'STANDS', ltype: 'DASHED' });
    // Силуэты кресел на ярусах и 0-го ряда стульев на полу
    for (const t of plan.tiers) {
      const sd = t.d0 + B.seatSetbackFromRear;
      dxf.addRect(X(sd + 0.21), t.h, X(sd - 0.21), t.h + 0.45, { layer: 'STANDS' });
      dxf.addRect(X(sd - 0.16), t.h + 0.45, X(sd - 0.21), t.h + 0.82, { layer: 'STANDS' });
    }
    dxf.addRect(X(B.row0D + 0.21), 0, X(B.row0D - 0.21), 0.45, { layer: 'STANDS' });
    dxf.addRect(X(B.row0D - 0.16), 0.45, X(B.row0D - 0.21), 0.82, { layer: 'STANDS' });
  }
  // Заднее ограждение 4-го яруса до +2,20 м
  dxf.addLine(X(plan.backRail.d), plan.backRail.y0, X(plan.backRail.d), plan.backRail.y1, { layer: 'STANDS' });
  dxf.addText(X(plan.backRail.d) - 0.08, plan.backRail.y1 - 0.06, `ограждение +${fmtM(plan.backRail.y1)}`, { layer: 'TEXT', height: 0.11, align: 'right' });

  // 8. Приборы в разрезе (сгруппированы по позиции в плоскости разреза без двойного наложения)
  const secGroups = new Map();
  for (const f of fixtures) {
    if (f.hidden) continue;
    const key = `${f.mount.d.toFixed(3)}|${f.mount.y.toFixed(3)}`;
    if (!secGroups.has(key)) secGroups.set(key, { d: f.mount.d, y: f.mount.y, list: [] });
    secGroups.get(key).list.push(f);
  }
  for (const grp of secGroups.values()) {
    dxf.addRect(X(grp.d) - 0.10, grp.y - 0.28, X(grp.d) + 0.10, grp.y, { layer: 'FIXTURES' });
    const nos = grp.list.map((f) => f.no).sort((a, b) => a - b);
    const allAssumed = grp.list.every((f) => f.assumed);
    const star = (n) => (allAssumed ? `${n}*` : String(n));
    const contiguous = nos.length > 1 && nos.every((n, i) => i === 0 || n === nos[i - 1] + 1);
    const lbl = nos.length === 1 ? star(nos[0]) : contiguous ? `${star(nos[0])}–${star(nos.at(-1))}` : nos.map(star).join(',');
    dxf.addText(X(grp.d), grp.y - 0.43, lbl, { layer: 'TEXT', height: 0.10, align: 'center' });
  }

  // 9. Высотные отметки и линейные размеры
  const exR = X(exit.d0) + 0.9;
  const exL = X(R.d1) - 3.6;
  dxf.addElevationMark(exR, 0, '±0,000 (Пол павильона)', { layer: 'DIMS' });
  dxf.addElevationMark(exR, CN.y, `+${fmtM(CN.y, 3)} (Низ козырька)`, { layer: 'DIMS' });
  dxf.addElevationMark(exR, T.lower.y0, `+${fmtM(T.lower.y0, 3)} (Низ нижних ферм)`, { layer: 'DIMS' });
  dxf.addElevationMark(exL, C.h, `+${fmtM(C.h, 3)} (Верх циклорамы)`, { layer: 'DIMS' });
  dxf.addElevationMark(exR, T.upper.y0, `+${fmtM(T.upper.y0, 3)} (Низ верхних ферм)`, { layer: 'DIMS' });
  dxf.addElevationMark(exL, R.ceiling, `+${fmtM(R.ceiling, 3)} (Потолок)`, { layer: 'DIMS' });

  dxf.addLinearDim(X(R.d1), 0, X(R.d0), 0, { offset: -1.15, label: `Глубина ${fmtM(R.d1 - R.d0)} м`, layer: 'DIMS' });
  dxf.addTitleBlock(X(R.d1), -3.7, {
    title: SHEET_TITLE,
    subtitle: `Продольный разрез по оси X = 0 — блитчер «${layoutName}», ФП H=+${fmtM(mfH)} м (2D)`,
    extra: `Приборов: ${fixtures.filter((f) => !f.hidden).length} шт. · Мест: ${seats}`,
    width: 17.6,
    layer: 'TEXT',
  });

  return dxf.toString();
}
