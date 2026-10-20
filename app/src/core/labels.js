// Текстовые подписи-спрайты (рисуются в WebGL — попадают и в PNG-скриншот).
// Размер на экране постоянный (в пикселях) и для перспективной, и для орто-камеры.
import * as THREE from 'three';

export class LabelManager {
  constructor() {
    this.labels = [];
    this._v = new THREE.Vector3();
  }

  /**
   * text, opts: { px: высота на экране, color, bg, border, layer, minDist, maxDist }
   */
  make(text, opts = {}) {
    const { px = 16, color = '#ffffff', bg = 'rgba(15,17,22,0.78)', border = null, bold = true } = opts;
    const scale = 2;
    const fontPx = 26 * scale;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = `${bold ? '600 ' : ''}${fontPx}px "Segoe UI", system-ui, sans-serif`;
    g.font = font;
    const tw = Math.ceil(g.measureText(text).width);
    const padX = 10 * scale, padY = 6 * scale;
    c.width = tw + padX * 2;
    c.height = fontPx + padY * 2;
    g.font = font;
    if (bg) {
      g.fillStyle = bg;
      roundRect(g, 0, 0, c.width, c.height, 8 * scale);
      g.fill();
    }
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 2 * scale;
      roundRect(g, scale, scale, c.width - 2 * scale, c.height - 2 * scale, 7 * scale);
      g.stroke();
    }
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(text, padX, c.height / 2 + scale);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: opts.depthTest ?? true, depthWrite: false, transparent: true, toneMapped: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 10;
    s.userData.label = { px, aspect: c.width / c.height, text, kind: opts.kind || 'misc' };
    s.center.set(opts.cx ?? 0.5, opts.cy ?? 0.5);
    this.labels.push(s);
    return s;
  }

  setText(sprite, text, opts = {}) {
    // пересоздаём текстуру
    const n = this.make(text, { ...opts, px: sprite.userData.label.px });
    sprite.material.map.dispose();
    sprite.material.map = n.material.map;
    sprite.userData.label = n.userData.label;
    this.labels.pop();
  }

  /** Подгоняет масштаб всех видимых подписей под камеру. */
  update(camera, viewportH) {
    const v = this._v;
    for (const s of this.labels) {
      if (!s.visible || !s.parent) continue;
      const L = s.userData.label;
      let worldPerPx;
      if (camera.isOrthographicCamera) {
        worldPerPx = (camera.top - camera.bottom) / camera.zoom / viewportH;
      } else {
        s.getWorldPosition(v);
        const dist = v.distanceTo(camera.position);
        worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / viewportH;
      }
      const h = L.px * worldPerPx;
      s.scale.set(h * L.aspect, h, 1);
    }
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
