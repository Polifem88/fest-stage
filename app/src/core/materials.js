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

// Кирпич: текстура = 1 × 1 м (кирпич 250 × 65 мм + шов 10 мм), однотонный чёрный кирпич
function brickTex(base, mortar, vary = 0) {
  return canvasTex(512, (g, S) => {
    const r = rng(7);
    g.fillStyle = mortar;
    g.fillRect(0, 0, S, S);
    const rows = 13, bw = S / 4, bh = S / rows;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * bw * 0.5;
      for (let x = -1; x < 5; x++) {
        const v = vary ? (r() - 0.5) * vary : 0;
        const c = new THREE.Color(base).offsetHSL(0, 0, v);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(x * bw + off + 3, y * bh + 3, bw - 6, bh - 6);
        // лёгкий объём верхней грани кирпича, чтобы кладка читалась в чёрном цвете
        g.fillStyle = 'rgba(255,255,255,0.035)';
        g.fillRect(x * bw + off + 3, y * bh + 3, bw - 6, 2);
      }
    }
  });
}

// Доски планшета: 2 × 2 м (5 досок шириной по 400 мм вдоль глубины).
// Тёмный графит (почти чёрный), однотонный, без разноцветных пятен и пёстрых затёртостей.
function boardsTex() {
  return canvasTex(512, (g, S) => {
    const r = rng(3);
    const n = 5, w = S / n;
    g.fillStyle = '#181a1d';
    g.fillRect(0, 0, S, S);
    // тонкая продольная фактура древесины в том же графитовом тоне
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 22; k++) {
        g.fillStyle = k % 2 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.22)';
        g.fillRect(i * w + 5 + r() * (w - 10), 0, 1 + r() * 2, S);
      }
      // поперечные стыки досок
      const yJoint = Math.round(((i * 0.37 + 0.25) % 1) * S);
      g.fillStyle = '#070809';
      g.fillRect(i * w, yJoint, w, 3);
      // продольный шов между досками (40 см) и лёгкая фаска кромки
      const xEdge = Math.round(i * w);
      g.fillStyle = '#060708';
      g.fillRect(xEdge, 0, 4, S);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(xEdge + 4, 0, 2, S);
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

// Серые стеновые панели: прямоугольник 1,2 × 0,6 м (Ш × В) в тайле 1,2 × 1,2 м (1 по ширине × 2 по высоте)
function greyPanelTex() {
  return canvasTex(256, (g, S) => {
    const r = rng(19);
    g.fillStyle = '#686c75';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.03)';
      g.fillRect(r() * S, r() * S, 16 + r() * 32, 2 + r() * 4);
    }
    g.strokeStyle = '#3f434a';
    g.lineWidth = 3;
    // По ширине (U) — 1 панель 1,2 м (вертикальный шов по краям тайла 0 и S)
    for (let i = 0; i <= 1; i++) {
      g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, S); g.stroke();
    }
    // По высоте (V) — 2 панели по 0,6 м (горизонтальные швы на 0, S/2 и S)
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(0, i * S / 2); g.lineTo(S, i * S / 2); g.stroke();
    }
  });
}

// Рифлёный профнастил потолка: текстура 1 × 1 м, 5 волн (шаг 0,2 м) вдоль U — направление задаёт развёртка
function ribbedTex(base, light, dark, ribs = 5) {
  return canvasTex(256, (g, S) => {
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    const w = S / ribs;
    for (let i = 0; i < ribs; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, dark);
      gr.addColorStop(0.3, light);
      gr.addColorStop(0.55, base);
      gr.addColorStop(1, dark);
      g.fillStyle = gr;
      g.fillRect(i * w, 0, w, S);
    }
  });
}

// Рифлёный алюминий настила станка («чечевица»): текстура 0,25 × 0,25 м
function treadTex() {
  return canvasTex(128, (g, S) => {
    g.fillStyle = '#8d9196';
    g.fillRect(0, 0, S, S);
    const n = 4, c = S / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const cx = x * c + c / 2, cy = y * c + c / 2, a = (x + y) % 2 ? Math.PI / 4 : -Math.PI / 4;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.fillStyle = '#b4b8bd'; g.fillRect(-c * 0.32, -2, c * 0.64, 3);
        g.fillStyle = '#5f6368'; g.fillRect(-c * 0.32, 1, c * 0.64, 2);
        g.restore();
      }
    }
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

/** Мягкое пятно в цвете (чёрный фон, белый центр, без прозрачности) — для смешивания «максимумом». */
export function radialTexRGB() {
  return canvasTex(128, (g, S) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.5, '#a0a0a0');
    gr.addColorStop(0.8, '#383838');
    gr.addColorStop(1, '#000000');
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
  const boards = boardsTex();
  const m = {
    floor: std({ map: boards, roughness: 0.9 }),
    // узкая доска 10 см того же графитового цвета (5 досок на 0.5 м повтора)
    floorNarrow: std({ map: boards, roughness: 0.9 }),
    blackWall: std({ color: 0x141414, roughness: 0.95 }),
    wallPanel: std({ map: greyPanelTex(), roughness: 0.88 }),
    brickBack: std({ map: brickTex('#161618', '#08080a', 0), roughness: 0.95 }),
    // низ задней стены под нижней галереей: чёрный кирпич
    brickBlack: std({ map: brickTex('#121214', '#070709', 0), roughness: 1 }),
    brickSide: std({ map: brickTex('#161618', '#08080a', 0), roughness: 0.95 }),
    portal: std({ color: 0x0e0e0e, roughness: 0.9 }),
    stageEdge: std({ color: 0x1c1b1a, roughness: 0.9 }),
    steel: std({ color: 0x2a2c30, metalness: 0.55, roughness: 0.55 }),
    steelGray: std({ color: 0x5e6166, metalness: 0.3, roughness: 0.7 }),
    fascia: std({ color: 0x2a2c30, metalness: 0.2, roughness: 0.85 }), // отбойный щит нижней галереи — тёмный графитовый металл
    pipe: std({ color: 0x1f2023, metalness: 0.7, roughness: 0.4 }),
    track: std({ color: 0x2d2f33, metalness: 0.6, roughness: 0.5 }),
    curtainTrack: std({ color: 0xb8bec7, metalness: 0.65, roughness: 0.35 }),
    rigel: std({ color: 0x1a1a1a, roughness: 0.9 }),
    counterweight: std({ color: 0x3b3430, roughness: 0.8, metalness: 0.2 }),
    rope: std({ color: 0xc9b48a, roughness: 1 }),
    mesh: std({ color: 0x55575a, alphaMap: meshTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.4 }),
    // двери и ворота чуть светлее чёрного низа задней стены, чтобы оставались различимыми
    door: std({ color: 0x222225, roughness: 0.7 }),
    gate: std({ color: 0x232427, roughness: 0.6, metalness: 0.3 }),
    // зал
    hallFloor: std({ color: 0x3a3c44, roughness: 1 }),
    carpet: std({ color: 0x34373d, roughness: 0.98 }),
    carpetSide: std({ color: 0x282b30, roughness: 0.98 }),
    brass: std({ color: 0xb8923a, metalness: 0.7, roughness: 0.35 }),
    acUnit: std({ color: 0x151619, roughness: 0.75, metalness: 0.2 }),
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
    // --- добавлять только в конец (порядок создания материалов = порядок отрисовки готовых площадок) ---
    // рыжий кирпич со светлым швом (открытая кладка)
    brickRed: std({ map: brickTex('#8e4a2e', '#bdb2a3', 0.1), roughness: 0.95 }),
    // тёмный рифлёный профнастил потолка
    deckRibbed: std({ map: ribbedTex('#26282c', '#3a3d42', '#141517'), roughness: 0.7, metalness: 0.35 }),
    // серый рифлёный алюминий верха станка
    aluDeck: std({ map: treadTex(), roughness: 0.55, metalness: 0.5 }),
    // чёрный мольтон (бархат): виден с обеих сторон
    molton: std({ color: 0x0b0b0c, roughness: 1, side: THREE.DoubleSide }),
  };
  // масштаб повтора текстур (метров на повтор)
  m.floor.userData.uvScale = 2;
  m.floorNarrow.userData.uvScale = 0.5;
  m.wallPanel.userData.uvScale = 1.2;
  m.brickBack.userData.uvScale = 1;
  m.brickBlack.userData.uvScale = 1;
  m.brickSide.userData.uvScale = 1;
  m.hallCeiling.userData.uvScale = 1.2;
  m.decoCeiling.userData.uvScale = 1.2;
  m.hallWood.userData.uvScale = 0.6;
  m.mesh.userData.uvScale = 0.25;
  m.brickRed.userData.uvScale = 1;
  m.deckRibbed.userData.uvScale = 1;
  m.aluDeck.userData.uvScale = 0.25;
  for (const [k, v] of Object.entries(m)) v.name = k;
  return m;
}
