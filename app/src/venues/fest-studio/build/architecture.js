// Архитектура Студии мультимедиа:
//  • слой walls — серый наливной пол (с нишами), ореховые панели стен, откосов и козырька операторской,
//    двустворчатая дверь выхода, техническая дверь, окно операторской (5 секций);
//  • слой ceiling — ореховые панели потолка (5,65), 2 кассеты кондиционера 0,80 × 0,80, 4 диффузора 0,60 × 0,60.
// Все размеры — config/dimensions.js; здесь только визуальные константы деталей.
import { box, rect, wallWithHoles } from '../../../core/geom.js';
import { STUDIO } from '../config/dimensions.js';
import { panelUV } from './panels.js';

// Визуальные константы деталей
const DOOR_SEAM = 0.012; // шов между створками двустворчатой двери
const WIN_DEPTH = 0.08; // глубина рамы и ниши окна операторской
const WIN_FRAME = 0.04; // ширина профиля рамы и импостов окна
const WIN_GLASS_INSET = 0.03; // заглубление стекла от плоскости козырька
const CASSETTE_H = 0.035; // выступание корпуса кассеты кондиционера вниз от потолка
const CASSETTE_GRILLE_PAD = 0.05; // отступ решётки от края корпуса кассеты
const DIFFUSER_H = 0.022; // выступание корпуса диффузора вниз от потолка
const DIFFUSER_INNER = 0.36; // внутренний квадрат диффузора

export function buildArchitecture(batch, M) {
  const R = STUDIO.room, C = R.ceiling;
  const CN = STUDIO.canopy;
  const W = STUDIO.window;
  const PW = STUDIO.panels.wall, PC = STUDIO.panels.ceil;
  const exit = STUDIO.doors.find((d) => d.id === 'exit');
  const tech = STUDIO.doors.find((d) => d.id === 'tech');

  // Модули и привязки UV панелей (спецификация §2):
  //  • поперечные стены (d = const): панель центрирована на X = 0 → шов x = −0,61;
  //  • продольные стены (x = const): швы от стены за циклорамой d = 4,00 (z = −4,00);
  //  • потолок и низ козырька: по X швы от −0,61, по d — от стены за циклорамой d = 4,00 (z = −4,00).
  const modW = PW.w + PW.seam, modH = PW.h + PW.seam;
  const modCW = PC.w + PC.seam, modCH = PC.h + PC.seam;
  const uvD = { u0: -modW / 2, du: modW, v0: 0, dv: modH };
  const uvX = { u0: -R.d1, du: modW, v0: 0, dv: modH };
  const uvYWall = { u0: -modW / 2, du: modW, v0: -R.d1, dv: modW };
  const uvCeil = { u0: -modCW / 2, du: modCW, v0: -STUDIO.panels.ceilOriginD, dv: modCH };

  // ===========================================================================
  //  1. ПОЛ (серый полуматовый наливной, вкл. нишу выхода и углубление тех. двери)
  // ===========================================================================
  batch.add('walls', M.floorPoured, [
    rect('y', 0, R.x0, R.x1, R.d0, R.d1, 1),
    rect('y', 0, exit.x0, exit.x1, exit.d0, exit.d1, 1),
    rect('y', 0, tech.x0, tech.x1, tech.d0, tech.d1, 1),
  ], { tag: 'floor' });

  // ===========================================================================
  //  2. СТЕНЫ, КОЗЫРЁК И ОТКОСЫ НИШ (ореховые перфорированные панели)
  // ===========================================================================
  const panelsD = [
    // стена за циклорамой (d = 4,00)
    rect('d', R.d1, R.x0, R.x1, 0, C, -1),
    // задняя стена под козырьком (d = −8,60): слева от ниши выхода и перемычка над нишей (2,15…2,40)
    rect('d', R.d0, R.x0, exit.x0, 0, CN.y, 1),
    rect('d', R.d0, exit.x0, exit.x1, exit.h, CN.y, 1),
    // лицевая грань козырька операторской (d = −7,90, y 2,40…5,65) с проёмом окна
    ...wallWithHoles('d', CN.d1, R.x0, R.x1, CN.y, C, 1, [{ a0: W.x0, a1: W.x1, b0: W.y0, b1: W.y1 }]),
    // откосы углубления технической двери (d = −4,45 и d = −3,40)
    rect('d', tech.d0, tech.x0, tech.x1, 0, tech.h, 1),
    rect('d', tech.d1, tech.x0, tech.x1, 0, tech.h, -1),
  ];

  const panelsX = [
    // левая стена (x = −3,05): под козырьком (0…2,40) и основная часть (0…5,65)
    rect('x', R.x0, R.d0, CN.d1, 0, CN.y, 1),
    rect('x', R.x0, CN.d1, R.d1, 0, C, 1),
    // правая стена (x = 3,05): в нише выхода (0…2,15), под козырьком (0…2,40) и основная с проёмом тех. двери
    rect('x', R.x1, exit.d0, R.d0, 0, exit.h, -1),
    rect('x', R.x1, R.d0, CN.d1, 0, CN.y, -1),
    ...wallWithHoles('x', R.x1, CN.d1, R.d1, 0, C, -1, [{ a0: tech.d0, a1: tech.d1, b0: -0.01, b1: tech.h }]),
    // левый откос ниши выхода (x = 1,25)
    rect('x', exit.x0, exit.d0, exit.d1, 0, exit.h, 1),
  ];

  const panelsY = [
    // низ козырька операторской (y = 2,40)
    rect('y', CN.y, R.x0, R.x1, CN.d0, CN.d1, -1),
    // потолки ниши выхода и углубления технической двери (y = 2,15)
    rect('y', exit.h, exit.x0, exit.x1, exit.d0, exit.d1, -1),
    rect('y', tech.h, tech.x0, tech.x1, tech.d0, tech.d1, -1),
  ];

  batch.add('walls', M.walnutWall, [
    ...panelUV(panelsD, uvD),
    ...panelUV(panelsX, uvX),
    ...panelUV(panelsY, uvYWall),
  ], { tag: 'walls', uv: false });

  // ===========================================================================
  //  3. ДВЕРИ (выход для зрителей — двустворчатая; техническая — одностворчатая)
  // ===========================================================================
  const exitMid = (exit.x0 + exit.x1) / 2;
  batch.add('walls', M.door, [
    rect('d', exit.d0, exit.x0, exitMid - DOOR_SEAM / 2, 0, exit.h, 1),
    rect('d', exit.d0, exitMid + DOOR_SEAM / 2, exit.x1, 0, exit.h, 1),
    rect('x', tech.x1, tech.d0, tech.d1, 0, tech.h, -1),
  ], { tag: 'doors' });
  batch.add('walls', M.blackWall, rect('d', exit.d0, exitMid - DOOR_SEAM / 2, exitMid + DOOR_SEAM / 2, 0, exit.h, 1), { shadow: false });

  // ===========================================================================
  //  4. ОКНО ОПЕРАТОРСКОЙ (5 секций, чёрная рама, тёмное стекло, фон операторской)
  // ===========================================================================
  const f = WIN_FRAME, wd0 = W.d - WIN_DEPTH, wd1 = W.d;
  const winFrames = [
    box(W.x0, W.x1, W.y0, W.y0 + f, wd0, wd1),
    box(W.x0, W.x1, W.y1 - f, W.y1, wd0, wd1),
    box(W.x0, W.x0 + f, W.y0 + f, W.y1 - f, wd0, wd1),
    box(W.x1 - f, W.x1, W.y0 + f, W.y1 - f, wd0, wd1),
  ];
  const secW = (W.x1 - W.x0) / W.sections;
  for (let i = 1; i < W.sections; i++) {
    const xm = W.x0 + secW * i;
    winFrames.push(box(xm - f / 2, xm + f / 2, W.y0 + f, W.y1 - f, wd0, wd1));
  }
  batch.add('walls', M.blackWall, winFrames, { tag: 'windowFrame', shadow: false });
  batch.add('walls', M.glass, rect('d', W.d - WIN_GLASS_INSET, W.x0 + f, W.x1 - f, W.y0 + f, W.y1 - f, 1), { tag: 'windowGlass', shadow: false });
  batch.add('walls', M.booth, rect('d', wd0, W.x0, W.x1, W.y0, W.y1, 1), { tag: 'windowBack', shadow: false });

  // ===========================================================================
  //  5. ПОТОЛОК, КАССЕТЫ КОНДИЦИОНЕРА И ДИФФУЗОРЫ (слой ceiling)
  // ===========================================================================
  batch.add('ceiling', M.walnutCeil, panelUV(rect('y', C, R.x0, R.x1, CN.d1, R.d1, -1), uvCeil), { tag: 'ceiling', shadow: false, uv: false });

  const plastic = [];
  const grilles = [];
  for (const c of STUDIO.cassettes) {
    const h = c.size / 2;
    plastic.push(box(c.x - h, c.x + h, C - CASSETTE_H, C, c.d0, c.d1));
    const gp = CASSETTE_GRILLE_PAD;
    // rect('y') уже имеет UV 0..1 на прямоугольнике — текстура решётки ложится ровно на кассету
    grilles.push(rect('y', C - CASSETTE_H - 0.002, c.x - h + gp, c.x + h - gp, c.d0 + gp, c.d1 - gp, -1));
  }
  for (const df of STUDIO.diffusers) {
    const h = df.size / 2, hi = DIFFUSER_INNER / 2;
    plastic.push(
      box(df.x - h, df.x + h, C - DIFFUSER_H, C, df.d - h, df.d + h),
      box(df.x - hi, df.x + hi, C - DIFFUSER_H - 0.008, C - DIFFUSER_H, df.d - hi, df.d + hi),
    );
  }
  batch.add('ceiling', M.plasticWhite, plastic, { tag: 'ceilingFixtures', shadow: false });
  batch.add('ceiling', M.ventGrille, grilles, { tag: 'cassetteGrilles', shadow: false, uv: false });
}
