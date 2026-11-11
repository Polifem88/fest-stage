// Локальные материалы зрительного зала Большой сцены (Патч 1, часть 2).
// Не затрагивают общий словарь core/materials.js, сохраняя 100 % паритет других площадок.
// Материалы записываются на объект M, чтобы sharedSet(stage.M) защищал их от dispose при смене сцен.
import * as THREE from 'three';

const BEIGE_UV_SCALE = 1.15; // 2 широких модуля по 1,15 м на грань 2,30 м (горизонтальные ламели + вертикальный шов)

function createBeigeSlatsTexture() {
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (!g) return null;

  g.fillStyle = '#c8b191';
  g.fillRect(0, 0, S, S);

  // Горизонтальные акустические бороздки/ламели (16 ламелей на модуль 1,15 м ≈ шаг 7,2 см, как на фото зала)
  const slats = 16;
  const step = S / slats;
  for (let i = 0; i < slats; i++) {
    const y = i * step;
    const gr = g.createLinearGradient(0, y, 0, y + step);
    gr.addColorStop(0, '#a88f6e');
    gr.addColorStop(0.16, '#d5c0a1');
    gr.addColorStop(0.55, '#c8b191');
    gr.addColorStop(0.88, '#bea684');
    gr.addColorStop(1, '#a88f6e');
    g.fillStyle = gr;
    g.fillRect(0, y, S, step);
  }

  // Тонкий светлый/латунный вертикальный нащельник на стыке модулей 1,15 м
  g.fillStyle = 'rgba(232, 212, 178, 0.65)';
  g.fillRect(0, 0, 2, S);
  g.fillStyle = 'rgba(110, 88, 60, 0.45)';
  g.fillRect(2, 0, 2, S);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Получить или лениво создать локальные материалы зала на словаре M.
 * Если M уже содержит одноимённые материалы (например, из createExportMaterials()), возвращает их напрямую.
 */
export function getHallMaterials(M) {
  if (!M.wallPanel) {
    M.wallPanel = new THREE.MeshStandardMaterial({
      name: 'wallPanel',
      color: 0x686c75,
      roughness: 0.88,
      metalness: 0,
      side: THREE.FrontSide,
    });
    M.wallPanel.userData.uvScale = 1.2;
  }
  if ('hallBeigePanel' in M && 'hallCanopy' in M && 'hallLedStrip' in M) {
    M.hallBeigePanel.userData ||= {};
    M.hallBeigePanel.userData.uvScale ||= BEIGE_UV_SCALE;
    return {
      hallBeigePanel: M.hallBeigePanel,
      hallCanopy: M.hallCanopy,
      hallLedStrip: M.hallLedStrip,
    };
  }

  const tex = createBeigeSlatsTexture();
  const hallBeigePanel = new THREE.MeshStandardMaterial({
    name: 'hallBeigePanel',
    color: tex ? 0xffffff : 0xc8b191,
    map: tex,
    roughness: 0.72,
    metalness: 0,
    side: THREE.FrontSide,
  });
  hallBeigePanel.userData.uvScale = BEIGE_UV_SCALE;

  const hallCanopy = new THREE.MeshStandardMaterial({
    name: 'hallCanopy',
    color: 0xcfb896,
    emissive: 0xcfb896,
    emissiveIntensity: 0.04,
    roughness: 0.8,
    metalness: 0,
    side: THREE.FrontSide,
  });

  const hallLedStrip = new THREE.MeshStandardMaterial({
    name: 'hallLedStrip',
    color: 0xfff5e4,
    emissive: 0xffdfad,
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0,
    side: THREE.FrontSide,
  });

  M.hallBeigePanel = hallBeigePanel;
  M.hallCanopy = hallCanopy;
  M.hallLedStrip = hallLedStrip;

  return { hallBeigePanel, hallCanopy, hallLedStrip };
}
