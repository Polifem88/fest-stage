// Освобождение ресурсов WebGL при смене площадки: геометрия, материалы, текстуры подписей,
// теневые карты источников. Общие материалы движка (keep) не трогаются.

/**
 * @param root  объект, всё поддерево которого больше не нужно
 * @param keep  Set материалов и текстур, которые используются и дальше (общие для движка)
 */
export function disposeTree(root, keep = new Set()) {
  if (!root) return;
  const geos = new Set(), mats = new Set(), texs = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    const m = o.material;
    if (m) for (const mm of Array.isArray(m) ? m : [m]) mats.add(mm);
    if (o.userData?.matOrig) mats.add(o.userData.matOrig);
    if (o.isLight && typeof o.dispose === 'function') o.dispose(); // теневая карта
  });
  for (const g of geos) g.dispose();
  for (const m of mats) {
    if (keep.has(m)) continue;
    for (const v of Object.values(m)) if (v && v.isTexture && !keep.has(v)) texs.add(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture && !keep.has(u.value)) texs.add(u.value);
    m.dispose();
  }
  for (const t of texs) t.dispose();
  root.removeFromParent();
}

/** Материалы и текстуры, которые нельзя освобождать (общие для всех площадок). */
export function sharedSet(...materialMaps) {
  const s = new Set();
  for (const map of materialMaps) {
    if (!map) continue;
    for (const m of Object.values(map)) {
      if (!m || !m.isMaterial) continue;
      s.add(m);
      for (const v of Object.values(m)) if (v && v.isTexture) s.add(v);
    }
  }
  return s;
}
