// Additional targeted checks for edge cases
// Run from app: node review/modular-r1/mobile/inspect-details.mjs

import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../../..');
const shotsDir = path.resolve(__dirname, 'shots');

const mobileHtmlPath = path.resolve(appDir, 'dist/mobile.html');
const indexHtmlPath = path.resolve(appDir, 'dist/index.html');
const mobileUrl = pathToFileURL(mobileHtmlPath).href;
const indexUrl = pathToFileURL(indexHtmlPath).href;

const chromeArgs = [
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--allow-file-access-from-files',
];

async function inspect() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: chromeArgs,
  });

  try {
    console.log('=== CHECK 1: Narrow screen overflow on 320px and 375px ===');
    const page320 = await browser.newPage({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await page320.goto(mobileUrl);
    await page320.waitForFunction(() => window.__fest && window.__fest.ready);

    const overflow320 = await page320.evaluate(() => {
      const header = document.querySelector('.mtop');
      const brand = document.querySelector('.brand-btn');
      const right = document.querySelector('.mtop-right');
      const buttons = [...right.querySelectorAll('button')].map(b => {
        const r = b.getBoundingClientRect();
        return {
          title: b.title || b.getAttribute('aria-label') || b.className,
          left: r.left,
          right: r.right,
          isOffscreen: r.right > window.innerWidth,
        };
      });
      return {
        windowWidth: window.innerWidth,
        headerScrollWidth: header.scrollWidth,
        brandRight: brand.getBoundingClientRect().right,
        rightLeft: right.getBoundingClientRect().left,
        rightRight: right.getBoundingClientRect().right,
        buttons,
      };
    });
    console.log('320px screen header analysis:', JSON.stringify(overflow320, null, 2));

    // Also check on Chamber stage on 320px (Chamber has caps.rigging:false, caps.duty:true, caps.houseLight:true)
    await page320.evaluate(() => window.__fest.loadVenue('chamber'));
    await page320.waitForTimeout(300);

    const overflow320Chamber = await page320.evaluate(() => {
      const right = document.querySelector('.mtop-right');
      const brand = document.querySelector('.brand-btn');
      const buttons = [...right.querySelectorAll('button')].map(b => {
        const r = b.getBoundingClientRect();
        return {
          title: b.title || b.getAttribute('aria-label') || b.className,
          left: r.left,
          right: r.right,
          isOffscreen: r.right > window.innerWidth,
        };
      });
      return {
        venue: window.__fest.venue(),
        windowWidth: window.innerWidth,
        brandRight: brand.getBoundingClientRect().right,
        rightLeft: right.getBoundingClientRect().left,
        rightRight: right.getBoundingClientRect().right,
        buttons,
      };
    });
    console.log('320px Chamber stage header analysis:', JSON.stringify(overflow320Chamber, null, 2));

    await page320.close();

    console.log('=== CHECK 2: Orthographic Framing of Chamber Plan & Section on Mobile ===');
    const pagePort = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await pagePort.goto(mobileUrl);
    await pagePort.waitForFunction(() => window.__fest && window.__fest.ready);
    await pagePort.evaluate(() => window.__fest.loadVenue('chamber'));
    await pagePort.waitForTimeout(300);

    // Analyze Plan view projection & bounds
    await pagePort.evaluate(() => window.__fest.setView('plan'));
    await pagePort.waitForTimeout(300);
    const planFraming = await pagePort.evaluate(() => {
      const stage = window.__fest.stage;
      const cam = stage.camera; // orthographic camera
      // Chamber dimensions: room x0: -6, x1: 6, d0: -5, d1: 4
      // Project 4 corners of the room
      const corners = [
        [-6, 0, -5],
        [6, 0, -5],
        [-6, 0, 4],
        [6, 0, 4],
      ].map(([x, y, d]) => window.__fest.project([x, y, d]));
      return {
        view: stage.view,
        camType: cam.isOrthographicCamera ? 'ortho' : 'persp',
        camBounds: cam.isOrthographicCamera ? {
          left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, zoom: cam.zoom,
        } : null,
        viewportSize: { w: window.innerWidth, h: window.innerHeight },
        screenCorners: corners,
        minScreenX: Math.min(...corners.map(c => c.x)),
        maxScreenX: Math.max(...corners.map(c => c.x)),
        minScreenY: Math.min(...corners.map(c => c.y)),
        maxScreenY: Math.max(...corners.map(c => c.y)),
      };
    });
    console.log('Chamber Plan framing analysis:', JSON.stringify(planFraming, null, 2));

    // Analyze Section view projection & bounds
    await pagePort.evaluate(() => window.__fest.setView('section'));
    await pagePort.waitForTimeout(300);
    const sectionFraming = await pagePort.evaluate(() => {
      const stage = window.__fest.stage;
      const cam = stage.camera;
      // Section corners: d from -5 to 4, y from 0 to 4.4
      const corners = [
        [0, 0, -5],
        [0, 4.4, -5],
        [0, 0, 4],
        [0, 4.4, 4],
      ].map(([x, y, d]) => window.__fest.project([x, y, d]));
      return {
        view: stage.view,
        camType: cam.isOrthographicCamera ? 'ortho' : 'persp',
        viewportSize: { w: window.innerWidth, h: window.innerHeight },
        screenCorners: corners,
        minScreenX: Math.min(...corners.map(c => c.x)),
        maxScreenX: Math.max(...corners.map(c => c.x)),
        minScreenY: Math.min(...corners.map(c => c.y)),
        maxScreenY: Math.max(...corners.map(c => c.y)),
      };
    });
    console.log('Chamber Section framing analysis:', JSON.stringify(sectionFraming, null, 2));

    // Analyze Overview view camera pullback
    await pagePort.evaluate(() => window.__fest.setView('overview'));
    await pagePort.waitForTimeout(300);
    const overviewFraming = await pagePort.evaluate(() => {
      const stage = window.__fest.stage;
      const cam = stage.camera;
      return {
        pos: [cam.position.x, cam.position.y, cam.position.z],
        fov: cam.fov,
        portraitPullback: stage.views.overview.portraitPullback,
      };
    });
    console.log('Chamber Overview camera analysis:', overviewFraming);

    console.log('=== CHECK 3: Views tab on Chamber (is there DXF export panel?) ===');
    await pagePort.tap('.mtab[data-tab="views"]');
    await pagePort.waitForTimeout(300);

    const viewsPanelChamber = await pagePort.evaluate(() => {
      const panel = document.querySelector('.panel-views');
      const h4s = [...panel.querySelectorAll('h4')].map(h => h.textContent.trim());
      const exportItems = [...panel.querySelectorAll('.export-panel .export-item')].map(e => e.textContent.trim());
      const exportPanel = panel.querySelector('.export-panel');
      return {
        h4s,
        exportItemsCount: exportItems.length,
        exportItems,
        exportPanelChildren: exportPanel?.children?.length,
      };
    });
    console.log('Views panel on Chamber:', viewsPanelChamber);
    await pagePort.screenshot({ path: path.join(shotsDir, '22-chamber-views-panel-mobile.jpg'), type: 'jpeg', quality: 80 });

    console.log('=== CHECK 4: Layers tab on Chamber (caps.rigging check) ===');
    await pagePort.tap('.mtab[data-tab="layers"]');
    await pagePort.waitForTimeout(300);

    const layersPanelChamber = await pagePort.evaluate(() => {
      const panel = document.querySelector('.panel-layers');
      const layers = [...panel.querySelectorAll('.grid-1')][0];
      const tools = [...panel.querySelectorAll('.grid-1')][1];
      const layerBtns = [...layers.querySelectorAll('.tgl')].map(b => b.textContent.trim());
      const toolBtns = [...tools.querySelectorAll('.tgl')].map(b => b.textContent.trim());
      return { layerBtns, toolBtns };
    });
    console.log('Layers panel on Chamber:', layersPanelChamber);
    await pagePort.screenshot({ path: path.join(shotsDir, '23-chamber-layers-panel-mobile.jpg'), type: 'jpeg', quality: 80 });

    await pagePort.close();

    console.log('=== CHECK 5: Big Stage Views panel (comparison) ===');
    const pageBig = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await pageBig.goto(mobileUrl);
    await pageBig.waitForFunction(() => window.__fest && window.__fest.ready);
    await pageBig.tap('.mtab[data-tab="views"]');
    await pageBig.waitForTimeout(300);

    const viewsPanelBig = await pageBig.evaluate(() => {
      const panel = document.querySelector('.panel-views');
      const h4s = [...panel.querySelectorAll('h4')].map(h => h.textContent.trim());
      const exportItems = [...panel.querySelectorAll('.export-panel .export-item')].map(e => e.textContent.trim());
      return { h4s, exportItems };
    });
    console.log('Views panel on Big stage:', viewsPanelBig);
    await pageBig.screenshot({ path: path.join(shotsDir, '24-big-views-panel-mobile.jpg'), type: 'jpeg', quality: 80 });

    // Open share menu on Big stage for comparison
    await pageBig.tap('.share-btn');
    await pageBig.waitForTimeout(300);
    const shareMenuBig = await pageBig.evaluate(() => {
      const menu = document.querySelector('.share-menu');
      return [...menu.querySelectorAll('button')].map(b => b.textContent.trim());
    });
    console.log('Share menu on Big stage:', shareMenuBig);
    await pageBig.screenshot({ path: path.join(shotsDir, '25-big-share-menu-mobile.jpg'), type: 'jpeg', quality: 80 });

    await pageBig.close();

  } finally {
    await browser.close();
  }
}

inspect().catch(err => {
  console.error('Inspect failure:', err);
  process.exit(1);
});
