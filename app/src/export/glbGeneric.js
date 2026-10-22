// Общий экспорт 3D-модели площадки в Binary glTF 2.0 (.glb) — для площадок без собственного
// экспортёра (у Большой сцены свой: venues/fest-big/export/export3d.js).
// Берётся то, что сейчас видно в модели: статика слоёв, механика, корпуса приборов.
// Лучи, пятна, линзы, подписи и линии не выгружаются (в glTF у них нет смысла).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const SKIP = new Set(['beams', 'pools', 'lenses']);

/** Сцена для экспорта: копии видимых мешей в мировых координатах с простыми материалами. */
export function buildExportScene(stage) {
  const root = new THREE.Group();
  root.name = `FEST_${stage.venue.id}`;
  const mats = new Map();
  /** Материал для экспорта; tint — цвет экземпляра InstancedMesh (корпуса приборов окрашены через instanceColor). */
  const matFor = (m, tint = null) => {
    const src = Array.isArray(m) ? m[0] : m;
    const key = tint ? `${src.uuid}:${tint.getHexString()}` : src;
    if (!mats.has(key)) {
      const color = src.color ? src.color.clone() : new THREE.Color(0x808080);
      if (tint) color.multiply(tint);
      const out = new THREE.MeshStandardMaterial({
        name: src.name || 'material',
        color,
        roughness: src.roughness ?? 0.8,
        metalness: src.metalness ?? 0,
        side: src.side ?? THREE.FrontSide,
        transparent: !!src.transparent,
        opacity: src.opacity ?? 1,
      });
      mats.set(key, out);
    }
    return mats.get(key);
  };
  const sources = [...Object.values(stage.layerGroups || {})];
  for (const src of sources) {
    if (!src.visible) continue;
    src.updateMatrixWorld(true);
    src.traverseVisible((o) => {
      if (!o.isMesh || SKIP.has(o.name) || o.isSprite) return;
      const mat = o.userData.matOrig || o.material;
      if (!mat || mat.visible === false || mat.isShaderMaterial || mat.blending === THREE.AdditiveBlending) return;
      if (o.isInstancedMesh) {
        const m = new THREE.Matrix4();
        const c = new THREE.Color();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          if (Math.abs(m.determinant()) < 1e-12) continue; // скрытые экземпляры (масштаб 0)
          if (o.instanceColor) o.getColorAt(i, c);
          const mesh = new THREE.Mesh(o.geometry, matFor(mat, o.instanceColor ? c : null));
          mesh.name = `${o.name}#${i}`;
          mesh.matrixAutoUpdate = false;
          mesh.matrix.multiplyMatrices(o.matrixWorld, m);
          root.add(mesh);
        }
      } else {
        const mesh = new THREE.Mesh(o.geometry, matFor(mat));
        mesh.name = o.name;
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(o.matrixWorld);
        root.add(mesh);
      }
    });
  }
  return root;
}

/** @returns {Promise<ArrayBuffer>} */
export function buildSceneGLB(stage) {
  const root = buildExportScene(stage);
  root.updateMatrixWorld(true);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(root, resolve, reject, { binary: true, onlyVisible: true });
  });
}
