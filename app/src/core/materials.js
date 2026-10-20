// Материалы и процедурные текстуры (рисуются кодом — без внешних файлов).
import * as THREE from 'three';

function canvasTex(size, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// детерминированный «случай», чтобы текстуры были одинаковыми при каждом запуске
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Кирпич: текстура = 1 × 1 м (кирпич 250 × 65 мм + шов 10 мм)
function brickTex(base, mortar, vary) {
  return canvasTex(512, (g, S) => {
    const r = rng(7);
    g.fillStyle = mortar;
    g.fillRect(0, 0, S, S);
    const rows = 13, bw = S / 4, bh = S / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * bw * 0.5;
      for (let x = -1; x < 5; x++) {
        const v = (r() - 0.5) * vary;
        const c = new THREE.Color(base).offsetHSL(0, 0, v);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }
  });
}

// Доски планшета: 1 × 1 м, доски 125 мм вдоль глубины
function boardsTex() {
  return canvasTex(512, (g, S) => {
    const r = rng(3);
    const n = 8, w = S / n;
    for (let i = 0; i < n; i++) {
      let y = 0;
      while (y < S) {
        const len = S * (0.6 + r() * 0.9);
        const c = new THREE.Color('#3b3936').offsetHSL(0, 0, (r() - 0.5) * 0.025);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(i * w, y, w, len);
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(i * w, y, w, 2);
        y += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(i * w, 0, 2, S);
      // потёртости
      for (let k = 0; k < 18; k++) {
        g.fillStyle = `rgba(200,190,160,${0.04 + r() * 0.06})`;
        g.fillRect(i * w + r() * w, r() * S, 1 + r() * 4, 1 + r() * 10);
      }
    }
  });
}

// Плитка потолка: 0.6 × 0.6 м → текстура 1.2 × 1.2 м (2×2 плитки) — масштаб задаётся в uvScale
function tilesTex(base, line) {
  return canvasTex(256, (g, S) => {
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = line;
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * S / 2, 0); g.lineTo(i * S / 2, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * S / 2); g.lineTo(S, i * S / 2); g.stroke();
    }
  });
}

function woodPanelTex() {
  return canvasTex(256, (g, S) => {
    const r = rng(11);
    g.fillStyle = '#b58a5c';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 64; i++) {
      g.fillStyle = `rgba(90,55,25,${0.08 + r() * 0.12})`;
      g.fillRect(r() * S, 0, 1 + r() * 2, S);
    }
    g.fillStyle = 'rgba(60,35,15,0.6)';
    g.fillRect(0, 0, 3, S); // шов панели
  });
}

function meshTex() {
  // сетка-рабица (альфа)
  return canvasTex(128, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    for (let i = -S; i < S * 2; i += S / 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
      g.beginPath(); g.moveTo(i + S, 0); g.lineTo(i, S); g.stroke();
    }
  }, { srgb: false });
}

export function radialTex() {
  return canvasTex(128, (g, S) => {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }, { repeat: false, srgb: false });
}

/**
 * Библиотека материалов. uvScale — сколько метров в одном повторе текстуры
 * (UV у статической геометрии задаются в метрах, см. geom.js → worldUV).
 */
export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const m = {
    floor: std({ map: boardsTex(), roughness: 0.75 }),
    blackWall: std({ color: 0x141414, roughness: 0.95 }),
    brickBack: std({ map: brickTex('#353535', '#232323', 0.05), roughness: 0.95 }),
    brickSide: std({ map: brickTex('#262626', '#181818', 0.04), roughness: 0.95 }),
    portal: std({ color: 0x0e0e0e, roughness: 0.9 }),
    stageEdge: std({ color: 0x1c1b1a, roughness: 0.9 }),
    steel: std({ color: 0x2a2c30, metalness: 0.55, roughness: 0.55 }),
    steelGray: std({ color: 0x5e6166, metalness: 0.3, roughness: 0.7 }),
    fascia: std({ color: 0x6a6c70, roughness: 0.85 }),
    pipe: std({ color: 0x1f2023, metalness: 0.7, roughness: 0.4 }),
    track: std({ color: 0x2d2f33, metalness: 0.6, roughness: 0.5 }),
    rigel: std({ color: 0x1a1a1a, roughness: 0.9 }),
    counterweight: std({ color: 0x3b3430, roughness: 0.8, metalness: 0.2 }),
    rope: std({ color: 0xc9b48a, roughness: 1 }),
    mesh: std({ color: 0x55575a, alphaMap: meshTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.4 }),
    door: std({ color: 0x1b1b1d, roughness: 0.7 }),
    gate: std({ color: 0x161618, roughness: 0.6, metalness: 0.2 }),
    // зал
    hallFloor: std({ color: 0x3a3c44, roughness: 1 }),
    hallWood: std({ map: woodPanelTex(), roughness: 0.7 }),
    hallAcoustic: std({ color: 0x8b8783, roughness: 1 }),
    hallCeiling: std({ map: tilesTex('#6f665e', '#4f4943'), roughness: 1 }),
    decoCeiling: std({ map: tilesTex('#222225', '#4a4a50'), roughness: 1 }),
    attic: std({ color: 0x0b0b0b, roughness: 1 }),
    seatFabric: std({ color: 0xc4602a, roughness: 0.95 }),
    seatFrame: std({ color: 0x1d1a18, roughness: 0.7 }),
    glass: std({ color: 0x0c0f14, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55 }),
    booth: std({ color: 0x101114, roughness: 1 }),
    truss: std({ color: 0x18191b, metalness: 0.6, roughness: 0.45 }),
    // приборы
    fixtureBody: std({ color: 0x17181a, metalness: 0.35, roughness: 0.55 }),
    // светящиеся элементы (не зависят от света сцены)
    dutyBulb: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
    ledStrip: new THREE.MeshBasicMaterial({ color: 0xf4f6ff }),
    houseLamp: new THREE.MeshBasicMaterial({ color: 0xfff4dd }),
    blueLed: new THREE.MeshBasicMaterial({ color: 0x2a3cff }),
  };
  // масштаб повтора текстур (метров на повтор)
  m.floor.userData.uvScale = 1;
  m.brickBack.userData.uvScale = 1;
  m.brickSide.userData.uvScale = 1;
  m.hallCeiling.userData.uvScale = 1.2;
  m.decoCeiling.userData.uvScale = 1.2;
  m.hallWood.userData.uvScale = 0.6;
  m.mesh.userData.uvScale = 0.25;
  for (const [k, v] of Object.entries(m)) v.name = k;
  return m;
}
