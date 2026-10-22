// Скрипт комплексного тестирования десктопной версии (Desktop UI/UX Review)
import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve('.');
const SHOTS_DIR = path.resolve('review/modular-r1/desktop/shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const desktopUrl = pathToFileURL(path.resolve('dist/desktop.html')).href;
const indexUrl = pathToFileURL(path.resolve('dist/index.html')).href;

const NOISE = [
  /GPU stall due to ReadPixels/i,
  /GL Driver Message/i,
  /WebGL.*performance/i,
  /Automatic fallback to software WebGL/i,
];

async function createPage(browser, { width = 1920, height = 1080 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const logs = { errors: [], warnings: [], all: [] };
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    logs.all.push({ type, text });
    if (NOISE.some((r) => r.test(text))) return;
    if (type === 'error') logs.errors.push(text);
    else if (type === 'warning') logs.warnings.push(text);
  });
  page.on('pageerror', (err) => {
    logs.errors.push(`[pageerror] ${err.message}`);
  });
  return { context, page, logs };
}

async function waitFest(page, timeout = 30000) {
  await page.waitForFunction(() => window.__fest?.ready, null, { timeout });
  await page.evaluate(() => window.__fest.renderNow());
}

async function shot(page, name) {
  const filePath = path.join(SHOTS_DIR, `${name}.jpg`);
  await page.screenshot({ path: filePath, type: 'jpeg', quality: 80 });
  console.log(`[shot] saved ${name}.jpg`);
  return filePath;
}

const results = {
  timestamp: new Date().toISOString(),
  scenarios: {},
  findings: [],
};

console.log('=== STARTING DESKTOP UI/UX AUDIT ===');
console.log('Target URL:', desktopUrl);

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  headless: true,
});

try {
  // ---------------------------------------------------------------------------
  // SCENARIO 1: Viewports / Resolutions (1920x1080, 1366x768, 1280x720)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Responsive Resolutions ---');
  results.scenarios.resolutions = {};
  const resolutions = [
    { w: 1920, h: 1080, name: '1080p' },
    { w: 1366, h: 768, name: 'laptop-1366' },
    { w: 1280, h: 720, name: '720p' },
  ];

  for (const res of resolutions) {
    const { context, page, logs } = await createPage(browser, { width: res.w, height: res.h });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Metrics check
    const layout = await page.evaluate(() => {
      const top = document.querySelector('.topbar');
      const side = document.querySelector('.side');
      const card = document.querySelector('.card');
      const status = document.querySelector('.status');
      const quick = document.querySelector('.quick');
      const search = document.querySelector('.top-search');
      const actions = document.querySelector('.top-actions');
      const brand = document.querySelector('.brand-btn');
      return {
        topbarHeight: top?.offsetHeight,
        topbarScrollWidth: top?.scrollWidth,
        topbarClientWidth: top?.clientWidth,
        topbarOverflown: top?.scrollWidth > top?.clientWidth,
        sideWidth: side?.offsetWidth,
        sideHeight: side?.offsetHeight,
        statusText: status?.textContent,
        statusBottom: status?.getBoundingClientRect().bottom,
        windowHeight: window.innerHeight,
        quickButtonsCount: quick?.children.length,
        brandText: brand?.innerText?.trim(),
      };
    });

    await shot(page, `res_${res.name}_big_overview`);

    // Switch to chamber
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__fest.renderNow());

    const layoutChamber = await page.evaluate(() => {
      const top = document.querySelector('.topbar');
      const status = document.querySelector('.status');
      const brand = document.querySelector('.brand-btn');
      return {
        topbarOverflown: top?.scrollWidth > top?.clientWidth,
        statusText: status?.textContent,
        brandText: brand?.innerText?.trim(),
      };
    });

    await shot(page, `res_${res.name}_chamber_overview`);

    results.scenarios.resolutions[res.name] = {
      resolution: `${res.w}x${res.h}`,
      big: layout,
      chamber: layoutChamber,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Venue Switcher via Header (Mouse & Keyboard)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Venue Switcher via Header ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Initial state
    const brandBtn = page.locator('.brand-btn');
    const brandAriaExpandedInit = await brandBtn.getAttribute('aria-expanded');
    const brandTitleInit = await brandBtn.getAttribute('title');

    // Click to open dialog
    await brandBtn.click();
    const dlg = page.locator('dialog.venue-picker');
    await page.waitForFunction(() => document.querySelector('dialog.venue-picker')?.open);
    const dlgOpen = await dlg.isVisible();
    const brandAriaExpandedOpen = await brandBtn.getAttribute('aria-expanded');

    // Capture open dialog shot
    await shot(page, 'venue_picker_open');

    // Inspect venue items in dialog
    const items = await page.evaluate(() => {
      const els = [...document.querySelectorAll('dialog.venue-picker .venue-item')];
      return els.map((el) => ({
        id: el.dataset.venue,
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        ariaCurrent: el.getAttribute('aria-current'),
        ariaDisabled: el.getAttribute('aria-disabled'),
        className: el.className,
      }));
    });

    // Test Esc key to close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const isDlgClosedAfterEsc = !(await page.evaluate(() => document.querySelector('dialog.venue-picker')?.open));
    const brandAriaExpandedAfterEsc = await brandBtn.getAttribute('aria-expanded');

    // Test click outside to close dialog
    await brandBtn.click();
    await page.waitForFunction(() => document.querySelector('dialog.venue-picker')?.open);
    // Click outside: dialog bounds vs click point
    const dlgBox = await dlg.boundingBox();
    // Click at x: 10, y: 10 (top left outside dialog)
    await page.mouse.click(10, 10);
    await page.waitForTimeout(200);
    const isDlgClosedAfterClickOutside = !(await page.evaluate(() => document.querySelector('dialog.venue-picker')?.open));

    // Keyboard workflow: Tab to brand button, Enter to open, Arrow keys, Enter to pick
    await page.keyboard.press('Tab'); // might need multiple tabs or focus directly
    // Let's test focusing brand button directly then keyboard navigating
    await brandBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('dialog.venue-picker')?.open);

    const focusedInit = await page.evaluate(() => document.activeElement?.getAttribute('data-venue'));
    // Press ArrowDown
    await page.keyboard.press('ArrowDown');
    const focusedAfterDown = await page.evaluate(() => document.activeElement?.getAttribute('data-venue'));
    // Press ArrowDown again
    await page.keyboard.press('ArrowDown');
    const focusedAfterDown2 = await page.evaluate(() => document.activeElement?.getAttribute('data-venue'));
    // Press ArrowUp
    await page.keyboard.press('ArrowUp');
    const focusedAfterUp = await page.evaluate(() => document.activeElement?.getAttribute('data-venue'));

    // Press Enter on the focused item (should be 'chamber')
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__fest.venue() === 'chamber', null, { timeout: 10000 });
    const currentVenueAfterKb = await page.evaluate(() => window.__fest.venue());
    const hashAfterKb = await page.evaluate(() => location.hash);
    const headerTitleAfterKb = await page.locator('.brand-btn').innerText();

    results.scenarios.venueSwitcher = {
      brandAriaExpandedInit,
      brandTitleInit,
      dlgOpen,
      brandAriaExpandedOpen,
      items,
      isDlgClosedAfterEsc,
      brandAriaExpandedAfterEsc,
      isDlgClosedAfterClickOutside,
      keyboardNav: {
        focusedInit,
        focusedAfterDown,
        focusedAfterDown2,
        focusedAfterUp,
        currentVenueAfterKb,
        hashAfterKb,
        headerTitleAfterKb: headerTitleAfterKb.replace(/\s+/g, ' ').trim(),
      },
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Attempting to open "soon" stages
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Soon stages interaction ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    await page.locator('.brand-btn').click();
    await page.waitForFunction(() => document.querySelector('dialog.venue-picker')?.open);

    // Click Roof
    await page.locator('.venue-item[data-venue="roof"]').click();
    await page.waitForTimeout(200);
    const toastText = await page.locator('.toast').last().textContent();
    const isDlgStillOpen = await page.evaluate(() => document.querySelector('dialog.venue-picker')?.open);
    const venueStillBig = await page.evaluate(() => window.__fest.venue());

    await page.keyboard.press('Escape');

    // Test direct URL to roof: desktop.html#v=roof
    await page.goto(`${desktopUrl}#v=roof`);
    await waitFest(page);
    const fallbackVenue = await page.evaluate(() => window.__fest.venue());
    const fallbackToast = await page.locator('.toast').last().textContent();

    results.scenarios.soonStages = {
      clickSoonToast: toastText,
      isDlgStillOpen,
      venueStillBig,
      fallbackVenue,
      fallbackToast,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Interface Adaptations on Chamber Stage
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 4: UI adaptations on Chamber ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Check Big stage UI components
    const bigUI = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.tab')].map((t) => ({ id: t.dataset.tab, text: t.innerText.trim() }));
      const quick = [...document.querySelectorAll('.quick .tgl')].map((t) => ({ id: t.dataset.id, text: t.innerText.trim() }));
      const layers = [...document.querySelectorAll('.panel-layers .tgl')].map((t) => ({ id: t.dataset.id, text: t.innerText.trim() }));
      const exportItems = [...document.querySelectorAll('.export-menu .export-item')].map((t) => ({ id: t.dataset.export, text: t.innerText.trim() }));
      const helpItems = [...document.querySelectorAll('.help li')].map((li) => li.innerText.trim());
      const status = document.querySelector('.status')?.innerText.trim();
      const hasPortable = !!document.querySelector('.panel-light h4:has(+ div .btn)');
      return { tabs, quick, layers, exportItems, helpItems, status, hasPortable };
    });

    // Switch to Chamber
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__fest.renderNow());

    const chamberUI = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.tab')].map((t) => ({ id: t.dataset.tab, text: t.innerText.trim() }));
      const activeTab = document.querySelector('.tab.on')?.dataset.tab;
      const quick = [...document.querySelectorAll('.quick .tgl')].map((t) => ({ id: t.dataset.id, text: t.innerText.trim() }));
      const layers = [...document.querySelectorAll('.panel-layers .tgl')].map((t) => ({ id: t.dataset.id, text: t.innerText.trim() }));
      const exportItems = [...document.querySelectorAll('.export-menu .export-item')].map((t) => ({ id: t.dataset.export, text: t.innerText.trim() }));
      const exportBtnTitle = document.querySelector('.export-menu-btn')?.title;
      const exportBtnText = document.querySelector('.export-menu-btn')?.innerText.trim();
      const helpItems = [...document.querySelectorAll('.help li')].map((li) => li.innerText.trim());
      const status = document.querySelector('.status')?.innerText.trim();
      const lightHeaders = [...document.querySelectorAll('.panel-light h4')].map((h) => h.innerText.trim());
      const hasPortable = lightHeaders.some((h) => h.includes('Переносные'));
      const groupSets = [...document.querySelectorAll('.panel-light .groups .grp-cell')].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
      const chipsCount = document.querySelectorAll('.panel-light .chip').length;
      const chipsTexts = [...document.querySelectorAll('.panel-light .chip')].map((c) => c.innerText.trim());

      // Search for any leftover words of mechanics / Big stage
      const entireSidebarText = document.querySelector('.side')?.innerText || '';
      const mechanicsWords = ['штанкет', 'софит', 'дорога занавеса', 'боковой штанкет', 'колосники', 'лебёдк'];
      const residualMechanicsInSidebar = mechanicsWords.filter((w) => entireSidebarText.toLowerCase().includes(w));

      return {
        tabs,
        activeTab,
        quick,
        layers,
        exportItems,
        exportBtnTitle,
        exportBtnText,
        helpItems,
        status,
        lightHeaders,
        hasPortable,
        groupSets,
        chipsCount,
        chipsTextsSample: chipsTexts.slice(0, 10),
        residualMechanicsInSidebar,
      };
    });

    // Capture shots of Chamber UI panels
    // 1. Light panel
    await shot(page, 'chamber_panel_light');

    // 2. Layers panel
    await page.locator('.tab[data-tab="layers"]').click();
    await shot(page, 'chamber_panel_layers');

    // 3. Views panel (includes export CAD/3D)
    await page.locator('.tab[data-tab="views"]').click();
    await shot(page, 'chamber_panel_views');

    // 4. Export dropdown
    await page.locator('.export-menu-btn').click();
    await shot(page, 'chamber_export_dropdown_open');
    // Note: Clicking .export-menu-btn again is blocked because .export-backdrop (z-index 24)
    // covers .topbar (z-index 15). We test closing via Escape:
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const isExportClosedByEsc = await page.evaluate(() => document.querySelector('.export-menu')?.hidden);

    // 5. Help modal
    await page.locator('button[title="Подсказка по управлению"]').click();
    await shot(page, 'chamber_help_modal_open');
    await page.locator('.help .btn').click();
    await page.waitForTimeout(200);

    results.scenarios.chamberUI = {
      bigUI,
      chamberUI,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: State Persistence / Memory
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 5: State persistence between venues ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Setup Big Stage:
    // Sh5 -> 2.40m, blueprint -> true, haze -> true, hazeDensity -> 0.75, grid -> true, view -> hall
    await page.evaluate(() => {
      const f = window.__fest;
      f.setHeight('Sh5', 2.4);
      f.flag('blueprint', true);
      f.flag('grid', true);
      f.flag('haze', true);
      f.flag('hazeDensity', 0.75);
      f.setView('hall');
      // turn off all stage lights
      f.light('all', false);
    });

    const bigStateBefore = await page.evaluate(() => {
      const f = window.__fest;
      return {
        sh5Height: f.height('Sh5'),
        view: f.getState().view,
        blueprint: f.getState().flags.blueprint,
        grid: f.getState().flags.grid,
        hazeDensity: f.getState().flags.hazeDensity,
        stageLightsState: f.stage.stageState(),
        inputValue: document.querySelector('.rig-row[data-id="Sh5"] input.num')?.value,
      };
    });

    // Switch to Chamber
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);

    const chamberStateDuring = await page.evaluate(() => {
      const f = window.__fest;
      return {
        venue: f.venue(),
        view: f.getState().view,
        blueprint: f.getState().flags.blueprint,
        grid: f.getState().flags.grid,
        hazeDensity: f.getState().flags.hazeDensity,
        stageLightsState: f.stage.stageState(),
      };
    });

    // Change something on Chamber: switch view to 'trusses', turn off grid
    await page.evaluate(() => {
      const f = window.__fest;
      f.setView('trusses');
      f.flag('grid', false);
    });

    // Switch back to Big Stage
    await page.evaluate(() => window.__fest.loadVenue('big'));
    await page.waitForTimeout(400);

    const bigStateAfter = await page.evaluate(() => {
      const f = window.__fest;
      return {
        venue: f.venue(),
        sh5Height: f.height('Sh5'),
        view: f.getState().view,
        blueprint: f.getState().flags.blueprint,
        grid: f.getState().flags.grid,
        hazeDensity: f.getState().flags.hazeDensity,
        stageLightsState: f.stage.stageState(),
        inputValue: document.querySelector('.rig-row[data-id="Sh5"] input.num')?.value,
      };
    });

    results.scenarios.memory = {
      bigStateBefore,
      chamberStateDuring,
      bigStateAfter,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Share Link on Chamber & Reloading
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Share links on Chamber ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(300);

    // Set view to 'trusses' and solo front group
    await page.evaluate(() => {
      window.__fest.setView('trusses');
      window.__fest.stage.soloGroupSet('front');
    });

    const shareUrl = await page.evaluate(() => {
      document.querySelector('button[title="Скопировать ссылку с текущим состоянием"]').click();
      return window.__fest.stage.shareUrl();
    });

    const hash = new URL(shareUrl).hash;

    // Open this exact share URL in a fresh page context
    const { context: ctx2, page: page2, logs: logs2 } = await createPage(browser, { width: 1920, height: 1080 });
    await page2.goto(`${desktopUrl}${hash}`);
    await waitFest(page2);

    const restoredState = await page2.evaluate(() => {
      const f = window.__fest;
      return {
        venue: f.venue(),
        view: f.getState().view,
        frontState: f.stage.groupSetState('front'),
        midState: f.stage.groupSetState('mid'),
        backState: f.stage.groupSetState('back'),
      };
    });

    results.scenarios.shareLink = {
      shareUrl,
      hash,
      restoredState,
      errors: [...logs.errors, ...logs2.errors],
    };
    await context.close();
    await ctx2.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Legacy v1 link format (#s=...)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Legacy v1 Link Format ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Generate valid v1 state string
    const v1 = await page.evaluate(() => {
      const v = window.__fest.stage.venue;
      const h = v.rigging.list.map((r) => Math.round((r.id === 'Sh5' ? 2.85 : r.rest) * 100));
      const bytes = new Uint8Array(Math.ceil(v.fixtures.list.length / 8)).fill(255);
      const b = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return b(new TextEncoder().encode(JSON.stringify({ v: 1, h, fx: b(bytes), f: 1, l: 31, view: 'hall' })));
    });

    await context.close();

    // Open new page with legacy v1 hash
    const { context: ctxV1, page: pageV1, logs: logsV1 } = await createPage(browser, { width: 1920, height: 1080 });
    await pageV1.goto(`${desktopUrl}#s=${v1}`);
    await waitFest(pageV1);

    const v1Restored = await pageV1.evaluate(() => {
      const f = window.__fest;
      return {
        venue: f.venue(),
        sh5Height: f.height('Sh5'),
        view: f.getState().view,
        sh5InputValue: document.querySelector('.rig-row[data-id="Sh5"] input.num')?.value,
      };
    });

    results.scenarios.legacyV1 = {
      v1Hash: v1,
      v1Restored,
      errors: logsV1.errors,
    };
    await ctxV1.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: State Save & Load via File / openState
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 8: State save & load via openState ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Setup big stage state
    await page.evaluate(() => {
      window.__fest.setHeight('Sh5', 3.1);
      window.__fest.setView('hall');
    });
    const bigSavedState = await page.evaluate(() => window.__fest.getState());

    // Switch to chamber
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(300);
    const chamberCurrentVenue = await page.evaluate(() => window.__fest.venue());

    // Now call openState with the Big Stage state object!
    const openBigResult = await page.evaluate(async (st) => {
      return await window.__fest.stage.openState(st);
    }, bigSavedState);
    await page.waitForTimeout(400);

    const venueAfterOpenBig = await page.evaluate(() => window.__fest.venue());
    const sh5AfterOpenBig = await page.evaluate(() => window.__fest.height('Sh5'));

    // Now save Chamber state
    await page.evaluate(() => {
      window.__fest.loadVenue('chamber');
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.__fest.setView('trusses');
    });
    const chamberSavedState = await page.evaluate(() => window.__fest.getState());

    // Switch to Big
    await page.evaluate(() => window.__fest.loadVenue('big'));
    await page.waitForTimeout(400);

    // Open Chamber state while on Big
    const openChamberResult = await page.evaluate(async (st) => {
      return await window.__fest.stage.openState(st);
    }, chamberSavedState);
    await page.waitForTimeout(400);

    const venueAfterOpenChamber = await page.evaluate(() => window.__fest.venue());
    const viewAfterOpenChamber = await page.evaluate(() => window.__fest.getState().view);

    results.scenarios.fileOpenState = {
      bigSavedStateVenue: bigSavedState.venue,
      chamberCurrentVenue,
      openBigResult,
      venueAfterOpenBig,
      sh5AfterOpenBig,
      chamberSavedStateVenue: chamberSavedState.venue,
      openChamberResult,
      venueAfterOpenChamber,
      viewAfterOpenChamber,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Export on Both Stages (DXF & GLB)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 9: CAD & GLB Export ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Big stage export checks
    const bigExports = await page.evaluate(async () => {
      const f = window.__fest;
      const planDXF = f.exportPlanDXF();
      const sectionDXF = f.exportSectionDXF();
      const dxf3D = f.export3DDXF();
      const glbBuf = await f.exportGLB();
      return {
        planDXFLength: planDXF?.length,
        sectionDXFLength: sectionDXF?.length,
        dxf3DLength: dxf3D?.length,
        glbByteLength: glbBuf?.byteLength,
        glbHeader: glbBuf ? Array.from(new Uint8Array(glbBuf.slice(0, 12))) : null,
      };
    });

    // Chamber stage export checks
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);

    const chamberExports = await page.evaluate(async () => {
      const f = window.__fest;
      const planDXF = f.exportPlanDXF();
      const sectionDXF = f.exportSectionDXF();
      const dxf3D = f.export3DDXF();
      let glbBuf = null;
      let glbError = null;
      try {
        glbBuf = await f.exportGLB();
      } catch (e) {
        glbError = e.message;
      }
      return {
        planDXF,
        sectionDXF,
        dxf3D,
        glbByteLength: glbBuf?.byteLength,
        glbError,
        glbHeader: glbBuf ? Array.from(new Uint8Array(glbBuf.slice(0, 12))) : null,
      };
    });

    // Verify GLB magic (0x46546C67 = 'glTF')
    const verifyGlbHeader = (header) => {
      if (!header || header.length < 12) return { valid: false, reason: 'Too short' };
      const magic = String.fromCharCode(...header.slice(0, 4));
      const view = new DataView(new Uint8Array(header).buffer);
      const version = view.getUint32(4, true);
      const totalLen = view.getUint32(8, true);
      return { valid: magic === 'glTF' && version === 2, magic, version, totalLen };
    };

    results.scenarios.exports = {
      big: {
        ...bigExports,
        glbValidation: verifyGlbHeader(bigExports.glbHeader),
      },
      chamber: {
        ...chamberExports,
        glbValidation: verifyGlbHeader(chamberExports.glbHeader),
      },
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Fixture Search by Number
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Fixture Search ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    // Big stage search
    const testSearch = async (query) => {
      return await page.evaluate((q) => {
        const inp = document.querySelector('.top-search input.search');
        inp.value = q;
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const sel = window.__fest.stage.selected;
        const toast = document.querySelector('.toast')?.textContent;
        return {
          query: q,
          selectedKind: sel?.kind,
          selectedFixtureIdx: sel?.idx,
          selectedFixtureNo: sel ? window.__fest.stage.fixtures.list[sel.idx]?.no : null,
          toast,
        };
      }, query);
    };

    const bigSearch38 = await testSearch('38');
    const bigSearch1 = await testSearch('1');
    const bigSearch999 = await testSearch('999');

    // Switch to Chamber
    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);

    // Test Cyrillic 'К1', 'к1', 'К18'
    const chamberSearchCyrillicUpper = await testSearch('К1');
    const chamberSearchCyrillicLower = await testSearch('к1');
    const chamberSearchCyrillic18 = await testSearch('К18');
    // Test Latin 'K1', 'k1' (layout mistake!)
    const chamberSearchLatinUpper = await testSearch('K1');
    const chamberSearchLatinLower = await testSearch('k1');
    // Test just number '1' or '18'
    const chamberSearchNumberOnly = await testSearch('1');

    results.scenarios.fixtureSearch = {
      big: { bigSearch38, bigSearch1, bigSearch999 },
      chamber: {
        chamberSearchCyrillicUpper,
        chamberSearchCyrillicLower,
        chamberSearchCyrillic18,
        chamberSearchLatinUpper,
        chamberSearchLatinLower,
        chamberSearchNumberOnly,
      },
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Blueprint Mode + Explication on Chamber Plan
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 11: Blueprint mode + explication on Chamber ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    await page.evaluate(() => window.__fest.loadVenue('chamber'));
    await page.waitForTimeout(400);

    // Set view to 'plan' and flag blueprint
    await page.evaluate(() => {
      window.__fest.setView('plan');
      window.__fest.flag('blueprint', true);
      window.__fest.flag('dims', true);
      window.__fest.flag('grid', true);
      window.__fest.flag('fixtureLabels', true);
      window.__fest.renderNow();
    });

    await page.waitForTimeout(400);
    await shot(page, 'chamber_blueprint_plan_full');

    // Inspect overlay canvas state
    const overlayState = await page.evaluate(() => {
      const overlayCanvas = document.querySelector('.sheet-overlay');
      const dimsGroup = window.__fest.stage.scene.getObjectByName('dims');
      const gridGroup = window.__fest.stage.scene.getObjectByName('grid');
      return {
        canvasWidth: overlayCanvas?.width,
        canvasHeight: overlayCanvas?.height,
        canvasHidden: overlayCanvas?.hidden,
        dimsVisible: dimsGroup?.visible,
        gridVisible: gridGroup?.visible,
      };
    });

    results.scenarios.blueprintPlan = {
      overlayState,
      errors: logs.errors,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Rapid Repeated Venue Switching (Stress Test)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Rapid Repeated Switching ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(desktopUrl);
    await waitFest(page);

    const memStart = await page.evaluate(() => {
      const m = window.__fest.stage.renderer.info.memory;
      return { g: m.geometries, t: m.textures };
    });

    // 5 rapid clicks alternating between Big and Chamber
    const switchLog = [];
    for (let i = 0; i < 5; i++) {
      const target = i % 2 === 0 ? 'chamber' : 'big';
      await page.evaluate((id) => window.__fest.loadVenue(id), target);
      switchLog.push({ step: i + 1, target });
    }

    // Wait for stabilization
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__fest.renderNow());

    const domState = await page.evaluate(() => {
      const veils = document.querySelectorAll('.venue-veil').length;
      const loading = document.querySelectorAll('.loading').length;
      const tabsCount = document.querySelectorAll('.tabs').length;
      const currentVenue = window.__fest.venue();
      const currentBrandText = document.querySelector('.brand-btn')?.innerText.replace(/\s+/g, ' ').trim();
      const m = window.__fest.stage.renderer.info.memory;
      return {
        veils,
        loading,
        tabsCount,
        currentVenue,
        currentBrandText,
        mem: { g: m.geometries, t: m.textures },
      };
    });

    await shot(page, 'rapid_switch_final_state');

    results.scenarios.rapidSwitching = {
      memStart,
      domState,
      errors: logs.errors,
      warnings: logs.warnings,
    };
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Landing Page index.html
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Landing page index.html ---');
  {
    const { context, page, logs } = await createPage(browser, { width: 1920, height: 1080 });
    await page.goto(indexUrl);
    await page.waitForTimeout(500);

    await shot(page, 'index_page_1080p');

    const indexData = await page.evaluate(() => {
      const title = document.title;
      const cards = [...document.querySelectorAll('.venue-card, .card, [data-venue], a[href*="desktop"]')].map((el) => ({
        tag: el.tagName,
        href: el.getAttribute('href'),
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        className: el.className,
      }));
      const allLinks = [...document.querySelectorAll('a')].map((a) => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href'),
      }));
      return { title, cards, allLinks };
    });

    results.scenarios.indexPage = {
      indexData,
      errors: logs.errors,
    };
    await context.close();
  }

} finally {
  await browser.close();
}

fs.writeFileSync(
  path.resolve('review/modular-r1/desktop/audit-results.json'),
  JSON.stringify(results, null, 2),
  'utf-8'
);

console.log('=== AUDIT FINISHED. Results written to audit-results.json ===');
