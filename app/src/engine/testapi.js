// Программный «пульт» для автотестов и субагентов-тестировщиков: window.__fest
import * as THREE from 'three';
import { VENUES } from '../venues/registry.js';

export function exposeTestApi(stage) {
  window.__fest = {
    stage,
    /** Ключи видов текущей площадки. */
    get views() { return Object.keys(stage.views); },
    /** Площадки каталога: [{ id, name, status }]. */
    venues: VENUES.map(({ id, name, status }) => ({ id, name, status })),
    venue: () => stage.venue?.id,
    loadVenue: (id) => stage.loadVenue(id),
    setView: (k) => stage.setView(k, { instant: true }),
    /** Произвольная камера: pos/target в координатах [x, y, d] (d — глубина от нулевой линии площадки). */
    setCamera: (pos, target, fov = 50) => {
      stage.setView(stage.venue.defaultView, { instant: true });
      stage.persp.fov = fov;
      stage.persp.updateProjectionMatrix();
      stage.persp.position.set(pos[0], pos[1], -pos[2]);
      stage.controls.target.set(target[0], target[1], -target[2]);
      stage.controls.update();
      stage.invalidate();
    },
    setHeight: (id, m) => stage.setHeight(id, m),
    height: (id) => stage.rigging?.height(id),
    light: (setId, on) => (setId === 'all' ? stage.setAllStage(on) : stage.setGroupSet(setId, on)),
    /** Переносные приборы (если есть): mode 'off' | 'floor' | 'stand', count. */
    portable: (mode, count) => stage.setPortable(mode, count),
    /** Планировка трансформируемого зала: { id, rows, shift } или null; setLayout({ id?, rows?, shift? }). */
    layout: () => (stage.layout ? { ...stage.layout } : null),
    setLayout: (p) => stage.setLayout(typeof p === 'string' ? { id: p } : p),
    flag: (k, v) => stage.setFlag(k, v),
    layer: (k, v) => stage.setLayer(k, v),
    select: (sel) => stage.select(sel),
    selectFixture: (no) => { const f = stage.fixtures.byNo.get(String(no)); if (f) stage.select({ kind: 'fixture', idx: f.idx }); return !!f; },
    getState: () => stage.getState(),
    describe: () => stage.describe(),
    stats: () => stage.stats(),
    renderNow: () => stage.render(),
    exportPlanDXF: () => stage.exportPlanDXF(),
    exportSectionDXF: () => stage.exportSectionDXF(),
    export3DDXF: () => stage.export3DDXF(),
    exportGLB: () => stage.exportGLB(),
    /** Замер FPS за ms миллисекунд (с принудительной перерисовкой каждый кадр). */
    fps: (ms = 3000) => new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const step = () => {
        stage.controls.target.y += 1e-6 * (n % 2 ? 1 : -1);
        stage.invalidate();
        n++;
        if (performance.now() - t0 < ms) requestAnimationFrame(step);
        else res({ fps: (n * 1000) / (performance.now() - t0), ...stage.stats() });
      };
      requestAnimationFrame(step);
    }),
    /** Экранные координаты точки [x,y,d] (для кликов роботом). */
    project: (p) => {
      const v = new THREE.Vector3(p[0], p[1], -p[2]).project(stage.camera);
      const r = stage.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    ready: true,
  };
}
