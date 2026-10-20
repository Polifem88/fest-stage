// Программный «пульт» для автотестов и субагентов-тестировщиков: window.__fest
import * as THREE from 'three';
import { VIEWS } from './stage.js';

export function exposeTestApi(stage) {
  window.__fest = {
    stage,
    views: Object.keys(VIEWS),
    setView: (k) => stage.setView(k, { instant: true }),
    /** Произвольная камера: pos/target в координатах [x, y, d] (d — глубина от портала). */
    setCamera: (pos, target, fov = 50) => {
      stage.setView('overview', { instant: true });
      stage.persp.fov = fov;
      stage.persp.updateProjectionMatrix();
      stage.persp.position.set(pos[0], pos[1], -pos[2]);
      stage.controls.target.set(target[0], target[1], -target[2]);
      stage.controls.update();
      stage.invalidate();
    },
    setHeight: (id, m) => stage.setHeight(id, m),
    height: (id) => stage.rigging.height(id),
    light: (setId, on) => (setId === 'all' ? stage.setAllStage(on) : stage.setGroupSet(setId, on)),
    /** Переносные ETC 50°: mode 'off' | 'floor' | 'stand', count 6 | 8. */
    portable: (mode, count) => stage.setPortable(mode, count),
    flag: (k, v) => stage.setFlag(k, v),
    layer: (k, v) => stage.setLayer(k, v),
    select: (sel) => stage.select(sel),
    selectFixture: (no) => { const f = stage.fixtures.byNo.get(String(no)); if (f) stage.select({ kind: 'fixture', idx: f.idx }); return !!f; },
    getState: () => stage.getState(),
    describe: () => stage.describe(),
    stats: () => stage.stats(),
    renderNow: () => stage.render(),
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
