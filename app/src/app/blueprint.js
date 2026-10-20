// Лист чертежа поверх 3D: экспликация (условные обозначения) и линейный масштаб.
// Рисуется на отдельном 2D-холсте над WebGL и добавляется в PNG-скриншот.
import { TYPES } from '../config/fixtures.js';
import { TYPE_COLORS } from '../build/fixtures.js';

const RIG_LEGEND = [
  ['#2f6fde', 'Ш — штанкет'],
  ['#e8590c', 'С — софит'],
  ['#8b3fd6', 'З — дорога занавеса'],
  ['#1a9e6a', 'Б — боковой штанкет'],
];

export class SheetOverlay {
  /** @param stage ядро; legendOnScreen — показывать экспликацию на экране (на телефоне — только в PNG) */
  constructor(stage, { legendOnScreen = true } = {}) {
    this.stage = stage;
    this.legendOnScreen = legendOnScreen;
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'sheet-overlay';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    c.hidden = true;
    stage.container.appendChild(c);
  }

  /** Перерисовать на экране (вызывается после каждого кадра). */
  draw() {
    const st = this.stage;
    const on = st.flags.blueprint;
    this.canvas.hidden = !on;
    if (!on) return;
    const el = st.renderer.domElement;
    const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const g = this.canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    this.paint(g, w, h, { legend: this.legendOnScreen });
  }

  /** Нарисовать лист в контексте g размером w×h css-пикселей. */
  paint(g, w, h, { legend = true } = {}) {
    const st = this.stage;
    if (!st.flags.blueprint) return;
    const small = w < 600;
    if (legend) this._legend(g, w, h, small);
    if (st.camera.isOrthographicCamera) this._scaleBar(g, w, h, small);
  }

  _legend(g, w, h, small) {
    const st = this.stage;
    const counts = new Map();
    for (const f of st.fixtures.list) if (!f.hidden) counts.set(f.type, (counts.get(f.type) || 0) + 1);
    const rows = [...counts].sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((a, r) => a + r[1], 0);
    const fs = small || h < 700 ? 10 : 11, lh = Math.round(fs * 1.42), pad = small ? 6 : 8, sw = fs;
    const font = (wt = '') => `${wt}${fs}px "Segoe UI", system-ui, sans-serif`;
    // строки: [цвет, текст, вид значка]
    const items = [...rows.map(([t, n]) => [TYPE_COLORS[t], `${TYPES[t].name} — ${n}`, 'box']), ...RIG_LEGEND.map(([c, s]) => [c, s, 'line'])];
    // по возможности одной колонкой (уже — меньше закрывает чертёж); если не влезает по высоте — в 2–3
    const maxRows = Math.max(6, Math.floor((h * 0.85 - pad * 2 - lh * 2) / lh));
    const ncol = Math.min(3, Math.ceil(items.length / maxRows));
    const perCol = Math.ceil(items.length / ncol);
    g.font = font();
    const colW = Math.max(...items.map((it) => g.measureText(it[1]).width)) + sw + pad * 1.7;
    const bw = Math.min(w - 2 * pad, Math.max(colW * ncol + pad * (ncol + 1), 170));
    const bh = pad * 2 + lh * (perCol + 2);
    const x0 = pad + 2, y0 = h - bh - (small ? 8 : 12);
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = '#3b4048';
    g.lineWidth = 1;
    g.fillRect(x0, y0, bw, bh);
    g.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);
    let y = y0 + pad + fs;
    g.fillStyle = '#111';
    g.font = font('600 ');
    g.fillText('Условные обозначения', x0 + pad, y);
    g.font = font();
    g.fillStyle = '#555';
    g.fillText(`приборов: ${total}`, x0 + pad + g.measureText('Условные обозначения ').width + 14, y);
    const top = y + lh * 1.3;
    items.forEach(([c, text, kind], i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const x = x0 + pad + col * (colW + pad), yy = top + row * lh;
      g.fillStyle = c;
      if (kind === 'box') g.fillRect(x, yy - sw + 2, sw, sw - 2);
      else g.fillRect(x, yy - sw / 2 - 1, sw, 3);
      g.fillStyle = '#111';
      g.fillText(text, x + sw + pad * 0.7, yy);
    });
  }

  _scaleBar(g, w, h, small) {
    const cam = this.stage.camera;
    const pxPerM = (h * cam.zoom) / (cam.top - cam.bottom);
    if (!isFinite(pxPerM) || pxPerM <= 0) return;
    const steps = [1, 2, 5, 10, 20];
    const len = steps.find((s) => s * pxPerM >= Math.min(160, w * 0.3)) || 20;
    const seg = len <= 2 ? 0.5 : len <= 5 ? 1 : len / 5;
    const L = len * pxPerM;
    const fs = small ? 10 : 11;
    const x1 = w - (small ? 14 : 24), x0 = x1 - L;
    // вверху справа: внизу слева экспликация, внизу справа — подсказка управления
    const y = (small ? 70 : 34) + fs;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(x0 - 10, y - fs - 10, L + 20, fs + 26);
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    for (let i = 0, m = 0; m < len - 1e-6; i++, m += seg) {
      g.fillStyle = i % 2 ? '#fff' : '#111';
      g.fillRect(x0 + m * pxPerM, y, seg * pxPerM, 6);
    }
    g.strokeRect(x0 + 0.5, y + 0.5, L, 6);
    g.fillStyle = '#111';
    g.font = `${fs}px "Segoe UI", system-ui, sans-serif`;
    g.textAlign = 'center';
    for (const m of [0, len / 2, len]) g.fillText(m === len ? `${String(m).replace('.', ',')} м` : String(m).replace('.', ','), x0 + m * pxPerM, y - 4);
    g.textAlign = 'left';
  }
}
