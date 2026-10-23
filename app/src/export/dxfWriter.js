// =============================================================================
//  ЯДРО ГЕНЕРАТОРА AUTOCAD DXF (AC1009 / R12 + $INSUNITS = 6 Метры)
//  Автономный сериализатор без внешних зависимостей.
//  Поддерживает 2D- и 3D-примитивы, слои, типы линий, блоки и оформление чертежей.
// =============================================================================

const fmtNum = (n, p = 4) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  return Number(r.toFixed(p)).toString();
};

/**
 * Очистка однострочного текста DXF от переводов строк, управляющих символов
 * и замена спецсимволов вне таблицы Windows-1251 (× -> x, ≈ -> ~, — -> -).
 */
const cleanText = (s) =>
  String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2248/g, '~')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00D8\u2300]/g, 'd=')
    .trim();

/**
 * Кодирование строки DXF в однобайтовый буфер Windows-1251 (ANSI_1251).
 * Обеспечивает 100% читаемость кириллицы во всех САПР (AutoCAD, Autodesk Viewer,
 * NanoCAD, LibreOffice Draw, Blender dxfgrabber, QCAD) по стандарту AC1009 + $DWGCODEPAGE=ANSI_1251.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function encodeDxfWindows1251(str) {
  const s = String(str ?? '');
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 128) {
      out[i] = code;
    } else if (code >= 0x0410 && code <= 0x044F) {
      out[i] = code - 0x0410 + 0xC0; // А..Я, а..я
    } else if (code === 0x0401) {
      out[i] = 0xA8; // Ё
    } else if (code === 0x0451) {
      out[i] = 0xB8; // ё
    } else if (code === 0x2116) {
      out[i] = 0xB9; // №
    } else if (code === 0x00B1) {
      out[i] = 0xB1; // ±
    } else if (code === 0x00B0) {
      out[i] = 0xB0; // °
    } else if (code === 0x00AB) {
      out[i] = 0xAB; // «
    } else if (code === 0x00BB) {
      out[i] = 0xBB; // »
    } else if (code === 0x00B7) {
      out[i] = 0xB7; // ·
    } else if (code === 0x2013) {
      out[i] = 0x96; // –
    } else if (code === 0x2014) {
      out[i] = 0x97; // —
    } else {
      out[i] = 0x2D; // '-'
    }
  }
  return out;
}

export class DxfWriter {
  /**
   * @param {object} opts
   * @param {number} [opts.insUnits=6] 6 = метры, 4 = миллиметры
   * @param {boolean} [opts.is3D=false]
   */
  constructor({ insUnits = 6, is3D = false } = {}) {
    this.insUnits = insUnits;
    this.is3D = is3D;
    this.layers = new Map();
    this.blocks = new Map();
    this.entities = [];
    this.extMin = [Infinity, Infinity, Infinity];
    this.extMax = [-Infinity, -Infinity, -Infinity];

    // Базовый слой 0 обязателен по спецификации DXF
    this.addLayer('0', { color: 7, ltype: 'CONTINUOUS' });
  }

  /** Учесть точку в расчёте габаритов чертежа ($EXTMIN / $EXTMAX). */
  _touch(x, y, z = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (x < this.extMin[0]) this.extMin[0] = x;
    if (y < this.extMin[1]) this.extMin[1] = y;
    if (z < this.extMin[2]) this.extMin[2] = z;
    if (x > this.extMax[0]) this.extMax[0] = x;
    if (y > this.extMax[1]) this.extMax[1] = y;
    if (z > this.extMax[2]) this.extMax[2] = z;
  }

  /**
   * Зарегистрировать слой.
   * @param {string} name Имя слоя (латиница/цифры/подчёркивание для макс. совместимости с САПР)
   * @param {object} opts { color: ACI (1..255), ltype: 'CONTINUOUS'|'DASHED'|'CENTER', off: boolean }
   */
  addLayer(name, { color = 7, ltype = 'CONTINUOUS', off = false } = {}) {
    const c = Math.max(1, Math.min(255, Math.abs(Math.round(color)) || 7));
    this.layers.set(name, {
      name,
      color: off ? -c : c,
      flags: off ? 1 : 0,
      off: !!off,
      ltype: ltype || 'CONTINUOUS',
    });
    return this;
  }

  _isLayerOff(layer) {
    return !!this.layers.get(layer)?.off;
  }

  /**
   * Зарегистрировать определение блока (BLOCK).
   * @param {string} name Имя блока
   * @param {(b: DxfBlockBuilder) => void} buildFn Функция наполнения геометрии блока в локальных координатах
   */
  addBlock(name, buildFn) {
    const builder = new DxfBlockBuilder();
    buildFn(builder);
    this.blocks.set(name, builder.entities);
    return this;
  }

  // ---------------------------------------------------------------------------
  //  Базовые геометрические примитивы (ENTITIES)
  // ---------------------------------------------------------------------------

  /** Отрезок (2D или 3D). */
  addLine(x1, y1, x2, y2, { layer = '0', z1 = 0, z2 = 0, ltype = null, color = null } = {}) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return this;
    this._touch(x1, y1, z1);
    this._touch(x2, y2, z2);
    this.entities.push(makeLineEntity(x1, y1, z1, x2, y2, z2, layer, ltype, color));
    return this;
  }

  /** 3D-отрезок по двум точкам [x, y, z]. */
  addLine3D(p1, p2, { layer = '0', ltype = null, color = null } = {}) {
    return this.addLine(p1[0], p1[1], p2[0], p2[1], { layer, z1: p1[2] || 0, z2: p2[2] || 0, ltype, color });
  }

  /** Полилиния из цепочки точек [[x, y, z?], ...]. */
  addPolyline(pts, { layer = '0', closed = false, ltype = null, color = null } = {}) {
    if (!pts || pts.length < 2) return this;
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      this.addLine(a[0], a[1], b[0], b[1], { layer, z1: a[2] || 0, z2: b[2] || 0, ltype, color });
    }
    if (closed && n >= 3) {
      const a = pts[n - 1], b = pts[0];
      this.addLine(a[0], a[1], b[0], b[1], { layer, z1: a[2] || 0, z2: b[2] || 0, ltype, color });
    }
    return this;
  }

  /** Прямоугольник по двум углам (x0, y0) — (x1, y1). */
  addRect(x0, y0, x1, y1, { layer = '0', z = 0, ltype = null, color = null } = {}) {
    return this.addPolyline(
      [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]],
      { layer, closed: true, ltype, color },
    );
  }

  /** Окружность. */
  addCircle(cx, cy, r, { layer = '0', cz = 0, ltype = null, color = null } = {}) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return this;
    this._touch(cx - r, cy - r, cz);
    this._touch(cx + r, cy + r, cz);
    this.entities.push(makeCircleEntity(cx, cy, cz, r, layer, ltype, color));
    return this;
  }

  /** Дуга окружности (углы в градусах против часовой стрелки). */
  addArc(cx, cy, r, startDeg, endDeg, { layer = '0', cz = 0, ltype = null, color = null } = {}) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return this;
    this._touch(cx - r, cy - r, cz);
    this._touch(cx + r, cy + r, cz);
    this.entities.push(makeArcEntity(cx, cy, cz, r, startDeg, endDeg, layer, ltype, color));
    return this;
  }

  /**
   * Текстовая надпись (TEXT).
   * @param {number} x
   * @param {number} y
   * @param {string} text
   * @param {object} opts { layer, z, height, rotation, align: 'left'|'center'|'right', valign: 'baseline'|'middle'|'top'|'bottom', color }
   */
  addText(x, y, text, { layer = '0', z = 0, height = 0.22, rotation = 0, align = 'left', valign = 'baseline', color = null } = {}) {
    const str = cleanText(text);
    if (!str || !Number.isFinite(x) || !Number.isFinite(y)) return this;
    this._touch(x, y, z);
    const approxW = str.length * height * 0.6;
    if (align === 'center') {
      this._touch(x - approxW / 2, y, z);
      this._touch(x + approxW / 2, y + height, z);
    } else if (align === 'right') {
      this._touch(x - approxW, y, z);
      this._touch(x, y + height, z);
    } else {
      this._touch(x + approxW, y + height, z);
    }
    this.entities.push(makeTextEntity(x, y, z, str, height, rotation, align, valign, layer, color));
    return this;
  }

  /** Вставка блока (INSERT). */
  addInsert(blockName, x, y, { layer = '0', z = 0, scaleX = 1, scaleY = 1, scaleZ = 1, rotation = 0, color = null } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this;
    this._touch(x - 0.3, y - 0.3, z);
    this._touch(x + 0.3, y + 0.3, z);
    const lines = [
      '0', 'INSERT',
      '8', layer,
      '2', blockName,
      '10', fmtNum(x),
      '20', fmtNum(y),
      '30', fmtNum(z),
      '41', fmtNum(scaleX),
      '42', fmtNum(scaleY),
      '43', fmtNum(scaleZ),
      '50', fmtNum(rotation, 2),
    ];
    if (color != null) lines.push('62', String(color));
    this.entities.push(lines.join('\n'));
    return this;
  }

  /**
   * Трёхмерная грань (3DFACE) по 3 или 4 вершинам [x, y, z].
   * Для треугольника 4-я вершина дублирует 3-ю по стандарту DXF.
   */
  add3DFace(p1, p2, p3, p4 = p3, { layer = '0', color = null } = {}) {
    for (const p of [p1, p2, p3, p4]) {
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) return this;
    }
    // Отбрасываем вырожденные треугольники нулевой площади
    const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
    const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * cx + cy * cy + cz * cz < 1e-10) return this;

    this._touch(p1[0], p1[1], p1[2]);
    this._touch(p2[0], p2[1], p2[2]);
    this._touch(p3[0], p3[1], p3[2]);
    this._touch(p4[0], p4[1], p4[2]);

    const lines = [
      '0', '3DFACE',
      '8', layer,
      '10', fmtNum(p1[0]), '20', fmtNum(p1[1]), '30', fmtNum(p1[2]),
      '11', fmtNum(p2[0]), '21', fmtNum(p2[1]), '31', fmtNum(p2[2]),
      '12', fmtNum(p3[0]), '22', fmtNum(p3[1]), '32', fmtNum(p3[2]),
      '13', fmtNum(p4[0]), '23', fmtNum(p4[1]), '33', fmtNum(p4[2]),
    ];
    if (color != null) lines.push('62', String(color));
    if (this._isLayerOff(layer)) lines.push('60', '1');
    this.entities.push(lines.join('\n'));
    return this;
  }

  // ---------------------------------------------------------------------------
  //  Инженерное оформление чертежей (размеры, высотные отметки, выноски, таблицы)
  // ---------------------------------------------------------------------------

  /**
   * Линейный размер с выносными линиями, архитектурными засечками (45°) и подписью.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {object} opts { offset, label, layer, textHeight, tickSize }
   */
  addLinearDim(x1, y1, x2, y2, { offset = 0.8, label = null, layer = 'DIMS', textHeight = 0.22, tickSize = 0.12 } = {}) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return this;
    const ux = dx / len, uy = dy / len;
    // Нормаль для выноса размерной линии
    const nx = -uy, ny = ux;
    const s = Math.sign(offset) || 1;
    const d1x = x1 + nx * offset, d1y = y1 + ny * offset;
    const d2x = x2 + nx * offset, d2y = y2 + ny * offset;

    // Выносные линии с небольшим отступом от объекта и выпуском за размерную линию
    const gap = 0.08 * s, ext = 0.14 * s;
    this.addLine(x1 + nx * gap, y1 + ny * gap, d1x + nx * ext, d1y + ny * ext, { layer });
    this.addLine(x2 + nx * gap, y2 + ny * gap, d2x + nx * ext, d2y + ny * ext, { layer });

    // Основная размерная линия (с небольшим выпуском за засечки)
    const ov = tickSize * 0.6;
    this.addLine(d1x - ux * ov, d1y - uy * ov, d2x + ux * ov, d2y + uy * ov, { layer });

    // Архитектурные засечки под 45°
    const tx = (ux + nx) * tickSize * 0.707, ty = (uy + ny) * tickSize * 0.707;
    this.addLine(d1x - tx, d1y - ty, d1x + tx, d1y + ty, { layer });
    this.addLine(d2x - tx, d2y - ty, d2x + tx, d2y + ty, { layer });

    // Текст размера
    const txt = label ?? `${len.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} м`;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    let txNormX = nx, txNormY = ny;
    if (ang > 90 || ang <= -90) {
      ang += 180;
      if (ang > 180) ang -= 360;
      txNormX = -nx;
      txNormY = -ny;
    }
    const mx = (d1x + d2x) / 2 + txNormX * (textHeight * 0.45);
    const my = (d1y + d2y) / 2 + txNormY * (textHeight * 0.45);
    this.addText(mx, my, txt, { layer, height: textHeight, rotation: ang, align: 'center', valign: 'middle' });
    return this;
  }

  /**
   * Высотная отметка уровня (знак ▽ со стрелкой и полкой по ГОСТ) для разреза.
   * @param {number} x Позиция по горизонтали
   * @param {number} y Высота (уровень)
   * @param {string} text Текст отметки (если не задан — форматируется из y, напр. "+5,700")
   * @param {object} opts { layer, side: 'left'|'right', textHeight, stemH }
   */
  addElevationMark(x, y, text = null, { layer = 'DIMS_SECTION', side = 'right', textHeight = 0.18, stemH = null } = {}) {
    const dir = side === 'left' ? -1 : 1;
    const h = textHeight * 1.1;
    const vStem = h + (stemH ?? h * 0.65);
    const sign = y > 1e-4 ? '+' : y < -1e-4 ? '-' : '±';
    const valStr = cleanText(text ?? `${sign}${Math.abs(y).toFixed(3).replace('.', ',')}`);
    const shelfW = Math.max(textHeight * 5.0, valStr.length * textHeight * 0.58 + 0.3);

    // Опорная засечка уровня
    this.addLine(x - 0.22, y, x + 0.22, y, { layer });
    // Стрелка ▽ с вершиной в (x, y)
    this.addPolyline([[x - h * 0.5, y + h], [x, y], [x + h * 0.5, y + h]], { layer });
    // Вертикальная ножка от края стрелки до полки и горизонтальная полка
    const sx = x + dir * h * 0.5;
    const sy = y + vStem;
    this.addLine(sx, y + h, sx, sy, { layer });
    this.addLine(sx, sy, sx + dir * shelfW, sy, { layer });
    // Подпись строго над полкой
    const tx = sx + dir * (shelfW * 0.5);
    this.addText(tx, sy + textHeight * 0.35, valStr, { layer, height: textHeight, align: 'center', valign: 'bottom' });
    return this;
  }

  /**
   * Выносная полка-флажок с текстом (для ступенчатой маркировки штанкетов и софитов).
   */
  addLeaderLabel(x0, y0, x1, y1, text, { layer = '0', textHeight = 0.2, shelfLen = 1.6, color = null } = {}) {
    const dir = x1 >= x0 ? 1 : -1;
    this.addCircle(x0, y0, 0.045, { layer, color });
    this.addLine(x0, y0, x1, y1, { layer, color });
    this.addLine(x1, y1, x1 + dir * shelfLen, y1, { layer, color });
    this.addText(
      x1 + dir * (shelfLen * 0.5),
      y1 + textHeight * 0.3,
      text,
      { layer, height: textHeight, align: 'center', valign: 'bottom', color },
    );
    return this;
  }

  /**
   * Таблица с заголовком, шапкой колонок и строками данных.
   * Координата (x0, yTop) — левый верхний угол таблицы; таблица растёт вниз (-Y).
   * @param {number} x0
   * @param {number} yTop
   * @param {object} spec { title, headers: [{ label, width, align }], rows: string[][], layer, rowH, textH }
   * @returns {{ width: number, height: number, bottomY: number }}
   */
  addTable(x0, yTop, { title = '', headers = [], rows = [], layer = 'SHEET_LEGEND', rowH = 0.42, textH = 0.18 } = {}) {
    const totalW = headers.reduce((s, c) => s + c.width, 0);
    let y = yTop;

    // Заголовок таблицы
    if (title) {
      const titleH = rowH * 1.25;
      this.addRect(x0, y - titleH, x0 + totalW, y, { layer });
      this.addText(x0 + totalW / 2, y - titleH / 2, title, { layer, height: textH * 1.15, align: 'center', valign: 'middle' });
      y -= titleH;
    }

    // Шапка колонок
    if (headers.length) {
      this.addRect(x0, y - rowH, x0 + totalW, y, { layer });
      let cx = x0;
      for (const col of headers) {
        if (cx > x0) this.addLine(cx, y - rowH, cx, y, { layer });
        const lbl = cleanText(col.label);
        const availW = Math.max(0.4, col.width - 0.24);
        const fitH = lbl.length > 0 ? Math.min(textH, availW / (lbl.length * 0.58)) : textH;
        this.addText(cx + col.width / 2, y - rowH / 2, lbl, { layer, height: Math.max(0.11, fitH), align: 'center', valign: 'middle' });
        cx += col.width;
      }
      y -= rowH;
    }

    // Строки
    const baseCellH = textH * 0.92;
    for (const row of rows) {
      this.addRect(x0, y - rowH, x0 + totalW, y, { layer });
      let cx = x0;
      for (let i = 0; i < headers.length; i++) {
        const col = headers[i];
        const cell = cleanText(row[i] ?? '');
        if (cx > x0) this.addLine(cx, y - rowH, cx, y, { layer });
        const al = col.align || 'left';
        const pad = 0.16;
        const availW = Math.max(0.4, col.width - pad * 2);
        const fitH = cell.length > 0 ? Math.min(baseCellH, availW / (cell.length * 0.58)) : baseCellH;
        const tx = al === 'center' ? cx + col.width / 2 : al === 'right' ? cx + col.width - pad : cx + pad;
        this.addText(tx, y - rowH / 2, cell, { layer, height: Math.max(0.1, fitH), align: al, valign: 'middle' });
        cx += col.width;
      }
      y -= rowH;
    }

    return { width: totalW, height: yTop - y, bottomY: y };
  }

  /**
   * Угловой штамп (основная надпись чертежа).
   */
  addTitleBlock(x0, y0, { title, subtitle, scale = '1:100 (1 ед. = 1 м)', extra = '', layer = 'SHEET_LEGEND', width = 12.0 } = {}) {
    const h = 2.2;
    this.addRect(x0, y0, x0 + width, y0 + h, { layer });
    this.addLine(x0, y0 + h * 0.62, x0 + width, y0 + h * 0.62, { layer });
    this.addLine(x0, y0 + h * 0.3, x0 + width, y0 + h * 0.3, { layer });
    this.addLine(x0 + width * 0.68, y0, x0 + width * 0.68, y0 + h * 0.62, { layer });

    this.addText(x0 + width * 0.5, y0 + h * 0.81, title || 'МЫТИЩИНСКИЙ ТЕАТР ДРАМЫ И КОМЕДИИ «ФЭСТ»', {
      layer, height: 0.24, align: 'center', valign: 'middle',
    });
    this.addText(x0 + width * 0.34, y0 + h * 0.46, subtitle || 'Технический чертёж сцены', {
      layer, height: 0.21, align: 'center', valign: 'middle',
    });
    this.addText(x0 + width * 0.84, y0 + h * 0.46, `Масштаб: ${scale}`, {
      layer, height: 0.17, align: 'center', valign: 'middle',
    });
    this.addText(x0 + width * 0.34, y0 + h * 0.15, extra || 'Единицы чертежа: метры ($INSUNITS = 6)', {
      layer, height: 0.16, align: 'center', valign: 'middle',
    });
    this.addText(x0 + width * 0.84, y0 + h * 0.15, 'Формат: DXF / AutoCAD DWG', {
      layer, height: 0.16, align: 'center', valign: 'middle',
    });
    return { width, height: h };
  }

  // ---------------------------------------------------------------------------
  //  Сериализация в строку DXF
  // ---------------------------------------------------------------------------

  toString() {
    const minX = Number.isFinite(this.extMin[0]) ? this.extMin[0] : -20;
    const minY = Number.isFinite(this.extMin[1]) ? this.extMin[1] : -25;
    const minZ = Number.isFinite(this.extMin[2]) ? this.extMin[2] : -2;
    const maxX = Number.isFinite(this.extMax[0]) ? this.extMax[0] : 20;
    const maxY = Number.isFinite(this.extMax[1]) ? this.extMax[1] : 15;
    const maxZ = Number.isFinite(this.extMax[2]) ? this.extMax[2] : 10;

    const out = [];

    // 1. HEADER
    out.push(
      '0', 'SECTION',
      '2', 'HEADER',
      '9', '$ACADVER',
      '1', 'AC1009',
      '9', '$DWGCODEPAGE',
      '3', 'ANSI_1251',
      '9', '$INSUNITS',
      '70', String(this.insUnits),
      '9', '$MEASUREMENT',
      '70', '1',
      '9', '$EXTMIN',
      '10', fmtNum(minX),
      '20', fmtNum(minY),
      '30', fmtNum(minZ),
      '9', '$EXTMAX',
      '10', fmtNum(maxX),
      '20', fmtNum(maxY),
      '30', fmtNum(maxZ),
      '0', 'ENDSEC',
    );

    // 2. TABLES (LTYPE, LAYER, STYLE)
    out.push(
      '0', 'SECTION',
      '2', 'TABLES',
      // Таблица типов линий
      '0', 'TABLE',
      '2', 'LTYPE',
      '70', '3',
      '0', 'LTYPE',
      '2', 'CONTINUOUS',
      '70', '0',
      '3', 'Solid line',
      '72', '65',
      '73', '0',
      '40', '0.0',
      '0', 'LTYPE',
      '2', 'DASHED',
      '70', '0',
      '3', 'Dashed __ __ __',
      '72', '65',
      '73', '2',
      '40', '0.4',
      '49', '0.25',
      '49', '-0.15',
      '0', 'LTYPE',
      '2', 'CENTER',
      '70', '0',
      '3', 'Center ____ _ ____',
      '72', '65',
      '73', '4',
      '40', '1.0',
      '49', '0.6',
      '49', '-0.15',
      '49', '0.1',
      '49', '-0.15',
      '0', 'ENDTAB',
      // Таблица слоёв
      '0', 'TABLE',
      '2', 'LAYER',
      '70', String(this.layers.size),
    );
    for (const l of this.layers.values()) {
      out.push(
        '0', 'LAYER',
        '2', l.name,
        '70', String(l.flags ?? 0),
        '62', String(l.color),
        '6', l.ltype,
      );
    }
    out.push(
      '0', 'ENDTAB',
      // Таблица стилей текста (TrueType arial.ttf для полной поддержки кириллицы в Autodesk Viewer / AutoCAD)
      '0', 'TABLE',
      '2', 'STYLE',
      '70', '1',
      '0', 'STYLE',
      '2', 'STANDARD',
      '70', '0',
      '40', '0.0',
      '41', '1.0',
      '50', '0.0',
      '71', '0',
      '42', '0.2',
      '3', 'arial.ttf',
      '4', '',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
    );

    // 3. BLOCKS
    out.push('0', 'SECTION', '2', 'BLOCKS');
    for (const [name, ents] of this.blocks.entries()) {
      out.push(
        '0', 'BLOCK',
        '8', '0',
        '2', name,
        '70', '0',
        '10', '0.0',
        '20', '0.0',
        '30', '0.0',
      );
      for (const e of ents) out.push(e);
      out.push('0', 'ENDBLK', '8', '0');
    }
    out.push('0', 'ENDSEC');

    // 4. ENTITIES (сначала вся чистая ASCII-геометрия, затем TEXT — чтобы первые >8 КБ файла были 100% ASCII)
    out.push('0', 'SECTION', '2', 'ENTITIES');
    const geomEntities = [];
    const textEntities = [];
    for (const e of this.entities) {
      if (e.startsWith('0\nTEXT\n')) textEntities.push(e);
      else geomEntities.push(e);
    }
    for (const e of geomEntities) out.push(e);
    if (textEntities.length > 0) {
      let approxLen = 0;
      for (const s of out) approxLen += s.length + 1;
      const padLine = '999\nFEST STAGE CAD EXPORT (AC1009 / ANSI_1251 / METERS)';
      while (approxLen < 9000) {
        out.push(padLine);
        approxLen += padLine.length + 1;
      }
    }
    for (const e of textEntities) out.push(e);
    out.push('0', 'ENDSEC', '0', 'EOF');

    return out.join('\n') + '\n';
  }

  /** Сериализация в бинарный буфер Windows-1251 (ANSI_1251). */
  toUint8Array() {
    return encodeDxfWindows1251(this.toString());
  }
}

/** Вспомогательный построитель геометрии внутри определения BLOCK. */
class DxfBlockBuilder {
  constructor() {
    this.entities = [];
  }
  addLine(x1, y1, x2, y2, { layer = '0', z1 = 0, z2 = 0, ltype = null, color = null } = {}) {
    this.entities.push(makeLineEntity(x1, y1, z1, x2, y2, z2, layer, ltype, color));
    return this;
  }
  addPolyline(pts, { layer = '0', closed = false, ltype = null, color = null } = {}) {
    if (!pts || pts.length < 2) return this;
    for (let i = 0; i < pts.length - 1; i++) {
      this.addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { layer, ltype, color });
    }
    if (closed && pts.length >= 3) {
      const a = pts[pts.length - 1], b = pts[0];
      this.addLine(a[0], a[1], b[0], b[1], { layer, ltype, color });
    }
    return this;
  }
  addRect(x0, y0, x1, y1, opts = {}) {
    return this.addPolyline([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { ...opts, closed: true });
  }
  addCircle(cx, cy, r, { layer = '0', cz = 0, ltype = null, color = null } = {}) {
    this.entities.push(makeCircleEntity(cx, cy, cz, r, layer, ltype, color));
    return this;
  }
}

function makeLineEntity(x1, y1, z1, x2, y2, z2, layer, ltype, color) {
  const a = [
    '0', 'LINE',
    '8', layer,
    '10', fmtNum(x1),
    '20', fmtNum(y1),
    '30', fmtNum(z1),
    '11', fmtNum(x2),
    '21', fmtNum(y2),
    '31', fmtNum(z2),
  ];
  if (ltype) a.push('6', ltype);
  if (color != null) a.push('62', String(color));
  return a.join('\n');
}

function makeCircleEntity(cx, cy, cz, r, layer, ltype, color) {
  const a = [
    '0', 'CIRCLE',
    '8', layer,
    '10', fmtNum(cx),
    '20', fmtNum(cy),
    '30', fmtNum(cz),
    '40', fmtNum(r),
  ];
  if (ltype) a.push('6', ltype);
  if (color != null) a.push('62', String(color));
  return a.join('\n');
}

function makeArcEntity(cx, cy, cz, r, startDeg, endDeg, layer, ltype, color) {
  const a = [
    '0', 'ARC',
    '8', layer,
    '10', fmtNum(cx),
    '20', fmtNum(cy),
    '30', fmtNum(cz),
    '40', fmtNum(r),
    '50', fmtNum(startDeg, 2),
    '51', fmtNum(endDeg, 2),
  ];
  if (ltype) a.push('6', ltype);
  if (color != null) a.push('62', String(color));
  return a.join('\n');
}

function makeTextEntity(x, y, z, str, height, rotation, align, valign, layer, color) {
  const hMap = { left: 0, center: 1, right: 2 };
  const vMap = { baseline: 0, bottom: 1, middle: 2, top: 3 };
  const hCode = hMap[align] ?? 0;
  const vCode = vMap[valign] ?? 0;
  // Вычисляем левую нижнюю точку базовой линии (10, 20) для программ вроде LibreOffice Draw,
  // которые игнорируют коды выравнивания 72/73 и точку выравнивания (11, 21).
  // AutoCAD при ненулевых 72/73 использует точку выравнивания (11, 21) = (x, y).
  const approxW = str.length * height * 0.56;
  const dx = hCode === 1 ? -approxW / 2 : hCode === 2 ? -approxW : 0;
  const dy = vCode === 2 ? -height * 0.36 : vCode === 3 ? -height : 0;
  const rad = ((rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const x0 = x + dx * cos - dy * sin;
  const y0 = y + dx * sin + dy * cos;
  const a = [
    '0', 'TEXT',
    '8', layer,
    '7', 'STANDARD',
    '10', fmtNum(x0),
    '20', fmtNum(y0),
    '30', fmtNum(z),
    '40', fmtNum(height),
    '1', str,
    '50', fmtNum(rotation, 2),
  ];
  if (hCode !== 0 || vCode !== 0) {
    a.push(
      '72', String(hCode),
      '11', fmtNum(x),
      '21', fmtNum(y),
      '31', fmtNum(z),
      '73', String(vCode),
    );
  }
  if (color != null) a.push('62', String(color));
  return a.join('\n');
}
