// Локальные материалы зрительного зала Большой сцены (Патч 1, часть 2).
// Не затрагивают общий словарь core/materials.js, сохраняя 100 % паритет других площадок.
// Материалы записываются на объект M, чтобы sharedSet(stage.M) защищал их от dispose при смене сцен.
import * as THREE from 'three';

const BEIGE_UV_SCALE = 0.575; // 4 модуля по 0,575 м на панель 2,30 м (8 реек в повторе)

function createBeigeSlatsTexture() {
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (!g) return null;

  g.fillStyle = '#c8b191';
  g.fillRect(0, 0, S, S);

  // Тонкие вертикальные рейки/бороздки (8 реек на модуль 0,575 м ≈ шаг 7,2 см)
  const slats = 8;
  const step = S / slats;
  for (let i = 0; i < slats; i++) {
    const x = i * step;
    const gr = g.createLinearGradient(x, 0, x + step, 0);
    gr.addColorStop(0, '#ae9574');
    gr.addColorStop(0.14, '#d3be9f');
    gr.addColorStop(0.55, '#c8b191');
    gr.addColorStop(0.9, '#bfa786');
    gr.addColorStop(1, '#ae9574');
    g.fillStyle = gr;
    g.fillRect(x, 0, step, S);
  }

  // Более чёткий стыковочный шов панели на границе модуля
  g.fillStyle = 'rgba(115, 92, 64, 0.45)';
  g.fillRect(0, 0, 3, S);

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
    color: 0xdfd6c7,
    emissive: 0xdfd6c7,
    emissiveIntensity: 0.04,
    roughness: 0.85,
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
