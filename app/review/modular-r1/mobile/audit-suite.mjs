// Audit Suite for Mobile UI/UX Review (Round 1)
// Run from app: node review/modular-r1/mobile/audit-suite.mjs

import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../../..');
const shotsDir = path.resolve(__dirname, 'shots');

if (!fs.existsSync(shotsDir)) {
  fs.mkdirSync(shotsDir, { recursive: true });
}

const mobileHtmlPath = path.resolve(appDir, 'dist/mobile.html');
const indexHtmlPath = path.resolve(appDir, 'dist/index.html');
const mobileUrl = pathToFileURL(mobileHtmlPath).href;
const indexUrl = pathToFileURL(indexHtmlPath).href;

console.log('Mobile URL:', mobileUrl);
console.log('Index URL:', indexUrl);

const chromeArgs = [
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--allow-file-access-from-files',
];

const results = {
  consoleLogs: [],
  consoleErrors: [],
  touchTargetViolations: [],
  scenarios: {},
  performance: {},
};

function recordLog(type, text) {
  if (type === 'error') {
    results.consoleErrors.push(text);
    console.error(`[CONSOLE ERROR] ${text}`);
  } else {
    results.consoleLogs.push(`[${type}] ${text}`);
  }
}

async function createBrowser() {
  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: chromeArgs,
    });
  } catch (err) {
    console.warn('Chrome channel failed, falling back to bundled chromium:', err.message);
    return await chromium.launch({
      headless: true,
      args: chromeArgs,
    });
  }
}

async function checkTouchTargets(page, contextName, selector = 'button, .btn, .tgl, .chip, .mtab, .venue-item, .handle, input, a') {
  const elements = await page.$$(selector);
  const violations = [];
  for (const el of elements) {
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box) continue;
    // Elements with width or height < 43.5 (allowing 0.5px subpixel rounding)
    if (box.width < 43.5 || box.height < 43.5) {
      const info = await el.evaluate(e => {
        return {
          tagName: e.tagName,
          className: e.className,
          id: e.id,
          text: (e.textContent || '').trim().slice(0, 30),
          ariaLabel: e.getAttribute('aria-label') || '',
          role: e.getAttribute('role') || '',
        };
      }).catch(() => null);
      if (info) {
        violations.push({
          context: contextName,
          selector,
          box: { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, x: Math.round(box.x), y: Math.round(box.y) },
          element: info,
        });
      }
    }
  }
  return violations;
}

async function run() {
  const browser = await createBrowser();

  try {
    console.log('--- TEST 1: iPhone 13 Portrait - Initial & Venue Switcher ---');
    {
      const context = await browser.newContext({
        ...devices['iPhone 13'],
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      page.on('console', msg => recordLog(msg.type(), msg.text()));
      page.on('pageerror', err => recordLog('error', err.stack || err.message));

      await page.goto(mobileUrl);
      await page.waitForFunction(() => window.__fest && window.__fest.ready);
      await page.evaluate(() => window.__fest.renderNow());

      // Initial shot
      await page.screenshot({ path: path.join(shotsDir, '01-iphone13-initial-big.jpg'), type: 'jpeg', quality: 80 });

      // Verify Header details
      const headerInfo = await page.evaluate(() => {
        const brandBtn = document.querySelector('.brand-btn');
        const b = brandBtn?.querySelector('b')?.textContent;
        const brandName = brandBtn?.querySelector('.brand-name')?.textContent;
        const caret = brandBtn?.querySelector('.brand-caret')?.textContent;
        const quickSlot = document.querySelector('.quick-slot');
        const shareBtn = document.querySelector('.share-btn');
        const brandBox = brandBtn?.getBoundingClientRect();
        const rightBox = document.querySelector('.mtop-right')?.getBoundingClientRect();
        return {
          b, brandName, caret,
          brandBox: brandBox ? { w: brandBox.width, h: brandBox.height, r: brandBox.right } : null,
          rightBox: rightBox ? { w: rightBox.width, h: rightBox.height, l: rightBox.left } : null,
          collision: brandBox && rightBox ? brandBox.right > rightBox.left : false,
        };
      });
      results.scenarios.headerBigIPhone13 = headerInfo;
      console.log('Header on Big Stage (iPhone 13):', headerInfo);

      // Check touch targets on initial screen
      const initialViolations = await checkTouchTargets(page, 'iPhone13 Initial Big Stage');
      results.touchTargetViolations.push(...initialViolations);
      console.log(`Touch target violations on initial screen: ${initialViolations.length}`);

      // Open venue picker by tapping brand button
      console.log('Tapping brand button...');
      await page.tap('.brand-btn');
      await page.waitForTimeout(300);

      const pickerVisible = await page.evaluate(() => {
        const dlg = document.querySelector('.venue-picker');
        return dlg && dlg.open;
      });
      console.log('Venue picker dialog open:', pickerVisible);
      await page.screenshot({ path: path.join(shotsDir, '02-venue-picker-open-iphone13.jpg'), type: 'jpeg', quality: 80 });

      // Inspect venue picker items
      const pickerItems = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.venue-item')];
        return items.map(it => ({
          venue: it.dataset.venue,
          name: it.querySelector('.venue-name')?.textContent?.trim(),
          meta: it.querySelector('.venue-meta')?.textContent?.trim(),
          isCurrent: it.classList.contains('current'),
          isSoon: it.classList.contains('soon'),
          disabled: it.getAttribute('aria-disabled'),
          box: it.getBoundingClientRect(),
        }));
      });
      results.scenarios.venuePickerItems = pickerItems;
      console.log('Venue picker items:', pickerItems);

      // Check touch targets in venue picker
      const pickerViolations = await checkTouchTargets(page, 'Venue Picker Dialog', '.venue-item, .venue-head button');
      results.touchTargetViolations.push(...pickerViolations);
      console.log(`Touch target violations in venue picker: ${pickerViolations.length}`);

      // TEST: Tap "soon" venue (e.g. roof)
      console.log('Tapping "soon" venue (roof)...');
      await page.tap('.venue-item[data-venue="roof"]');
      await page.waitForTimeout(400);

      const soonToast = await page.evaluate(() => {
        const dlg = document.querySelector('.venue-picker');
        const toasts = [...document.querySelectorAll('.toast')].map(t => t.textContent);
        return {
          pickerStillOpen: dlg && dlg.open,
          toasts,
        };
      });
      results.scenarios.soonVenueFeedback = soonToast;
      console.log('Soon venue feedback:', soonToast);
      await page.screenshot({ path: path.join(shotsDir, '03-venue-picker-soon-toast.jpg'), type: 'jpeg', quality: 80 });

      // TEST: Close venue modal via close button '×'
      console.log('Closing venue modal via "×"...');
      await page.tap('.venue-head .x');
      await page.waitForTimeout(300);
      const closedViaX = await page.evaluate(() => !document.querySelector('.venue-picker')?.open);
      console.log('Closed via "×":', closedViaX);

      // TEST: Reopen and close via tap outside (backdrop)
      console.log('Reopening and testing backdrop click...');
      await page.tap('.brand-btn');
      await page.waitForTimeout(300);
      // In mobile, dialog is at bottom. Click at top of screen (y = 50)
      await page.mouse.click(100, 50);
      await page.waitForTimeout(300);
      const closedViaBackdrop = await page.evaluate(() => !document.querySelector('.venue-picker')?.open);
      console.log('Closed via backdrop click:', closedViaBackdrop);

      // TEST: Reopen and close via Escape
      console.log('Reopening and testing Esc key...');
      await page.tap('.brand-btn');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const closedViaEsc = await page.evaluate(() => !document.querySelector('.venue-picker')?.open);
      console.log('Closed via Escape:', closedViaEsc);

      // SWITCH TO CHAMBER STAGE
      console.log('Opening picker and selecting Chamber Stage...');
      await page.tap('.brand-btn');
      await page.waitForTimeout(300);
      
      const t0 = Date.now();
      await page.tap('.venue-item[data-venue="chamber"]');
      
      // Wait for venue to change
      await page.waitForFunction(() => window.__fest && window.__fest.venue() === 'chamber');
      const switchDuration = Date.now() - t0;
      console.log(`Switched to Chamber stage in ${switchDuration} ms`);
      results.performance.switchToChamberMs = switchDuration;

      await page.waitForTimeout(400);
      await page.evaluate(() => window.__fest.renderNow());

      // Verify Chamber state, header, tabs, toasts
      const chamberState = await page.evaluate(() => {
        const brandBtn = document.querySelector('.brand-btn');
        const b = brandBtn?.querySelector('b')?.textContent;
        const brandName = brandBtn?.querySelector('.brand-name')?.textContent;
        const pageTitle = document.title;
        const tabs = [...document.querySelectorAll('.mtab')].map(t => ({
          id: t.dataset.tab,
          text: t.textContent.trim(),
          visible: t.offsetParent !== null,
          box: t.getBoundingClientRect(),
        }));
        const toasts = [...document.querySelectorAll('.toast')].map(t => t.textContent);
        const caps = window.__fest.stage.venue.caps;
        const hash = window.location.hash;
        return {
          venueId: window.__fest.venue(),
          b, brandName, pageTitle, tabs, toasts, caps, hash
        };
      });
      results.scenarios.chamberStageLoaded = chamberState;
      console.log('Chamber Stage loaded:', chamberState);

      await page.screenshot({ path: path.join(shotsDir, '04-chamber-loaded-peek-iphone13.jpg'), type: 'jpeg', quality: 80 });

      // Check touch targets on Chamber stage (peek)
      const chamberPeekViolations = await checkTouchTargets(page, 'Chamber Stage Peek');
      results.touchTargetViolations.push(...chamberPeekViolations);
      console.log(`Touch target violations on Chamber Peek: ${chamberPeekViolations.length}`);

      // Open bottom sheet by clicking on Tab "💡 Свет"
      console.log('Opening Light tab on Chamber stage...');
      await page.tap('.mtab[data-tab="light"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shotsDir, '05-chamber-tab-light-open.jpg'), type: 'jpeg', quality: 80 });

      // Inspect Light panel on Chamber
      const lightPanelInfo = await page.evaluate(() => {
        const panel = document.querySelector('.panel-light');
        const toggles = [...panel.querySelectorAll('.tgl')].map(t => t.textContent.trim());
        const soloBtns = [...panel.querySelectorAll('.solo')].map(s => s.textContent.trim());
        const chips = [...panel.querySelectorAll('.chip')].map(c => ({
          no: c.textContent.trim(),
          box: c.getBoundingClientRect(),
        }));
        const sheetState = document.querySelector('.sheet')?.dataset?.state;
        return {
          sheetState,
          toggles,
          soloCount: soloBtns.length,
          chipCount: chips.length,
          sampleChips: chips.slice(0, 5),
        };
      });
      results.scenarios.chamberLightPanel = lightPanelInfo;
      console.log('Chamber Light Panel info:', lightPanelInfo);

      // Check touch targets in open sheet
      const openSheetViolations = await checkTouchTargets(page, 'Chamber Open Sheet (Light tab)', 'button, .btn, .tgl, .chip, .mtab, .handle, input');
      results.touchTargetViolations.push(...openSheetViolations);
      console.log(`Touch target violations in open sheet: ${openSheetViolations.length}`);

      // Open group details to make chips visible
      console.log('Opening first group details (Фронт)...');
      await page.tap('details.grp summary');
      await page.waitForTimeout(300);

      // TEST: Long press on fixture chip
      console.log('Testing long press on fixture chip...');
      const firstChip = page.locator('.chip').first();
      await firstChip.waitFor({ state: 'visible', timeout: 5000 });
      const chipNo = await firstChip.textContent();
      console.log(`Targeting fixture chip № ${chipNo}...`);

      const beforeOn = await page.evaluate((no) => {
        const f = window.__fest.stage.fixtures.byNo.get(no);
        return f ? f.on : null;
      }, chipNo);

      // Dispatch pointerdown and wait 600ms
      const chipBox = await firstChip.boundingBox();
      console.log('Chip bounding box:', chipBox);
      if (chipBox) {
        await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(650);
        await page.mouse.up();
        await page.waitForTimeout(300);
      }

      const afterOn = await page.evaluate((no) => {
        const f = window.__fest.stage.fixtures.byNo.get(no);
        const toasts = [...document.querySelectorAll('.toast')].map(t => t.textContent);
        return { on: f ? f.on : null, toasts };
      }, chipNo);

      console.log(`Fixture ${chipNo} state before: ${beforeOn}, after long-press: ${afterOn.on}`);
      console.log('Toasts after long press:', afterOn.toasts);
      results.scenarios.longPressFixture = { chipNo, beforeOn, afterOn };
      await page.screenshot({ path: path.join(shotsDir, '06-chamber-fixture-longpress.jpg'), type: 'jpeg', quality: 80 });

      // Regular tap on chip -> selects fixture.
      // Notice: keepSheet is true, so sheet stays open, but .mobile[data-sheet=open] .card is display:none!
      console.log('Tapping fixture chip to select it while sheet is open...');
      await firstChip.click();
      await page.waitForTimeout(300);

      const cardVisibilityWhileSheetOpen = await page.evaluate(() => {
        const card = document.querySelector('.card');
        const sheet = document.querySelector('.sheet');
        const cardDisplay = window.getComputedStyle(card).display;
        return {
          sheetState: sheet?.dataset?.state,
          cardDisplay,
          cardHiddenAttr: card.hidden,
        };
      });
      console.log('Card visibility while sheet is open:', cardVisibilityWhileSheetOpen);
      results.scenarios.cardVisibilityWhileSheetOpen = cardVisibilityWhileSheetOpen;

      // Now collapse sheet to peek so card can be seen on mobile
      console.log('Collapsing sheet to peek to view the card...');
      await page.tap('.handle');
      await page.waitForTimeout(300);

      const cardInfo = await page.evaluate(() => {
        const card = document.querySelector('.card');
        if (!card || card.hidden) return null;
        const head = card.querySelector('.card-head')?.textContent?.trim();
        const rows = [...card.querySelectorAll('dl dt')].map((dt, i) => ({
          k: dt.textContent.trim(),
          v: card.querySelectorAll('dl dd')[i]?.textContent?.trim(),
        }));
        const xBtn = card.querySelector('.x');
        const xBox = xBtn?.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        return {
          head, rows,
          cardBox: { w: cardBox.width, h: cardBox.height, top: cardBox.top, bottom: cardBox.bottom },
          xBox: xBox ? { w: xBox.width, h: xBox.height } : null,
        };
      });
      results.scenarios.fixtureCard = cardInfo;
      console.log('Fixture card info after collapsing sheet:', cardInfo);
      await page.screenshot({ path: path.join(shotsDir, '07-chamber-fixture-card.jpg'), type: 'jpeg', quality: 80 });

      // Check card touch targets (close button, toggle, slider if any)
      const cardViolations = await checkTouchTargets(page, 'Fixture Card', '.card button, .card input');
      results.touchTargetViolations.push(...cardViolations);

      // Close card via '×'
      if (await page.$('.card .x')) {
        await page.tap('.card .x');
        await page.waitForTimeout(200);
      }

      // TEST: Share menu on Chamber stage
      console.log('Opening Share menu on Chamber stage...');
      await page.tap('.share-btn');
      await page.waitForTimeout(300);

      const shareMenuInfo = await page.evaluate(() => {
        const menu = document.querySelector('.share-menu');
        const btns = [...menu.querySelectorAll('button')].map(b => ({
          text: b.textContent.trim(),
          exportId: b.dataset.export || null,
          box: b.getBoundingClientRect(),
        }));
        const slot = menu.querySelector('.quick-slot');
        const emptySlot = slot ? slot.children.length === 0 : false;
        return {
          menuHidden: menu.hidden,
          buttons: btns,
          emptySlot,
        };
      });
      results.scenarios.chamberShareMenu = shareMenuInfo;
      console.log('Share menu on Chamber stage:', shareMenuInfo);
      await page.screenshot({ path: path.join(shotsDir, '08-chamber-share-menu.jpg'), type: 'jpeg', quality: 80 });

      // Check touch targets in Share menu
      const shareViolations = await checkTouchTargets(page, 'Chamber Share Menu', '.share-menu button');
      results.touchTargetViolations.push(...shareViolations);

      // Close share menu by tapping backdrop
      await page.tap('.share-backdrop');
      await page.waitForTimeout(200);

      // TEST: Views on Chamber Stage (plan, section, overview)
      console.log('Testing Chamber Views in Portrait...');
      // Views list
      const availableViews = await page.evaluate(() => window.__fest.views);
      console.log('Available views for Chamber:', availableViews);

      // Plan view
      await page.evaluate(() => window.__fest.setView('plan'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__fest.renderNow());
      await page.screenshot({ path: path.join(shotsDir, '09-chamber-plan-portrait.jpg'), type: 'jpeg', quality: 80 });

      // Section view
      await page.evaluate(() => window.__fest.setView('section'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__fest.renderNow());
      await page.screenshot({ path: path.join(shotsDir, '10-chamber-section-portrait.jpg'), type: 'jpeg', quality: 80 });

      // Overview view
      await page.evaluate(() => window.__fest.setView('overview'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__fest.renderNow());
      await page.screenshot({ path: path.join(shotsDir, '11-chamber-overview-portrait.jpg'), type: 'jpeg', quality: 80 });

      // Stats for Chamber
      const chamberStats = await page.evaluate(() => window.__fest.stats());
      results.performance.chamberStats = chamberStats;
      console.log('Chamber Stats:', chamberStats);

      // Switch back to Big stage and test stats
      console.log('Switching back to Big Stage...');
      const t1 = Date.now();
      await page.evaluate(() => window.__fest.loadVenue('big'));
      const switchToBigMs = Date.now() - t1;
      results.performance.switchToBigMs = switchToBigMs;
      console.log(`Switched to Big stage in ${switchToBigMs} ms`);

      const bigStats = await page.evaluate(() => window.__fest.stats());
      results.performance.bigStats = bigStats;
      console.log('Big Stage Stats:', bigStats);

      await context.close();
    }

    console.log('--- TEST 2: Narrow Screens (iPhone SE 320px & 375px) ---');
    {
      // 320px width (iPhone 5 / SE 1st gen width)
      const context320 = await browser.newContext({
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      });
      const page320 = await context320.newPage();
      page320.on('console', msg => recordLog(msg.type(), msg.text()));
      page320.on('pageerror', err => recordLog('error', err.stack || err.message));

      await page320.goto(mobileUrl);
      await page320.waitForFunction(() => window.__fest && window.__fest.ready);

      const header320Big = await page320.evaluate(() => {
        const brandBtn = document.querySelector('.brand-btn');
        const right = document.querySelector('.mtop-right');
        const bBox = brandBtn.getBoundingClientRect();
        const rBox = right.getBoundingClientRect();
        return {
          brandText: brandBtn.textContent.replace(/\s+/g, ' ').trim(),
          brandBox: { x: bBox.x, y: bBox.y, w: bBox.width, h: bBox.height, right: bBox.right },
          rightBox: { x: rBox.x, y: rBox.y, w: rBox.width, h: rBox.height, left: rBox.left },
          collision: bBox.right > rBox.left,
          gap: rBox.left - bBox.right,
        };
      });
      console.log('Header 320px (Big stage):', header320Big);
      results.scenarios.header320Big = header320Big;
      await page320.screenshot({ path: path.join(shotsDir, '12-header-320px-big.jpg'), type: 'jpeg', quality: 80 });

      // Switch to Chamber on 320px
      await page320.evaluate(() => window.__fest.loadVenue('chamber'));
      await page320.waitForTimeout(300);

      const header320Chamber = await page320.evaluate(() => {
        const brandBtn = document.querySelector('.brand-btn');
        const right = document.querySelector('.mtop-right');
        const bBox = brandBtn.getBoundingClientRect();
        const rBox = right.getBoundingClientRect();
        return {
          brandText: brandBtn.textContent.replace(/\s+/g, ' ').trim(),
          brandBox: { x: bBox.x, y: bBox.y, w: bBox.width, h: bBox.height, right: bBox.right },
          rightBox: { x: rBox.x, y: rBox.y, w: rBox.width, h: rBox.height, left: rBox.left },
          collision: bBox.right > rBox.left,
          gap: rBox.left - bBox.right,
        };
      });
      console.log('Header 320px (Chamber stage):', header320Chamber);
      results.scenarios.header320Chamber = header320Chamber;
      await page320.screenshot({ path: path.join(shotsDir, '13-header-320px-chamber.jpg'), type: 'jpeg', quality: 80 });

      // Check tabs on 320px
      const tabs320 = await page320.evaluate(() => {
        return [...document.querySelectorAll('.mtab')].map(t => ({
          text: t.textContent.trim(),
          box: t.getBoundingClientRect(),
        }));
      });
      results.scenarios.tabs320Chamber = tabs320;
      console.log('Tabs 320px (Chamber):', tabs320);

      await context320.close();

      // iPhone SE (375 x 667)
      const contextSE = await browser.newContext({
        ...devices['iPhone SE'],
        deviceScaleFactor: 1,
      });
      const pageSE = await contextSE.newPage();
      await pageSE.goto(mobileUrl);
      await pageSE.waitForFunction(() => window.__fest && window.__fest.ready);

      const headerSE = await pageSE.evaluate(() => {
        const brandBtn = document.querySelector('.brand-btn');
        const right = document.querySelector('.mtop-right');
        const bBox = brandBtn.getBoundingClientRect();
        const rBox = right.getBoundingClientRect();
        return {
          collision: bBox.right > rBox.left,
          gap: rBox.left - bBox.right,
          brandBox: { w: bBox.width, right: bBox.right },
          rightBox: { w: rBox.width, left: rBox.left },
        };
      });
      results.scenarios.headerSE = headerSE;
      console.log('Header iPhone SE (375px):', headerSE);
      await pageSE.screenshot({ path: path.join(shotsDir, '14-header-375px-se.jpg'), type: 'jpeg', quality: 80 });

      await contextSE.close();
    }

    console.log('--- TEST 3: Landscape Mode & Orientation Switch ---');
    {
      const contextLand = await browser.newContext({
        ...devices['iPhone 13 landscape'],
        deviceScaleFactor: 1,
      });
      const pageLand = await contextLand.newPage();
      pageLand.on('console', msg => recordLog(msg.type(), msg.text()));
      pageLand.on('pageerror', err => recordLog('error', err.stack || err.message));

      await pageLand.goto(mobileUrl);
      await pageLand.waitForFunction(() => window.__fest && window.__fest.ready);

      await pageLand.screenshot({ path: path.join(shotsDir, '15-iphone13-landscape-big.jpg'), type: 'jpeg', quality: 80 });

      // Open venue picker in landscape
      await pageLand.tap('.brand-btn');
      await pageLand.waitForTimeout(300);

      const landPickerBox = await pageLand.evaluate(() => {
        const dlg = document.querySelector('.venue-picker');
        const r = dlg.getBoundingClientRect();
        return { w: r.width, h: r.height, top: r.top, left: r.left };
      });
      results.scenarios.landscapeVenuePicker = landPickerBox;
      console.log('Landscape venue picker box:', landPickerBox);
      await pageLand.screenshot({ path: path.join(shotsDir, '16-iphone13-landscape-venue-picker.jpg'), type: 'jpeg', quality: 80 });

      // Switch to Chamber in landscape
      await pageLand.tap('.venue-item[data-venue="chamber"]');
      await pageLand.waitForFunction(() => window.__fest && window.__fest.venue() === 'chamber');
      await pageLand.waitForTimeout(300);

      // Open light sheet in landscape
      await pageLand.tap('.mtab[data-tab="light"]');
      await pageLand.waitForTimeout(300);

      const landSheetBox = await pageLand.evaluate(() => {
        const sheet = document.querySelector('.sheet');
        const r = sheet.getBoundingClientRect();
        return { w: r.width, h: r.height, top: r.top, left: r.left, right: window.innerWidth - r.right };
      });
      results.scenarios.landscapeSheetBox = landSheetBox;
      console.log('Landscape bottom sheet box (sidebar):', landSheetBox);
      await pageLand.screenshot({ path: path.join(shotsDir, '17-iphone13-landscape-chamber-sheet.jpg'), type: 'jpeg', quality: 80 });

      // Check rotation while dialog is open:
      // Start in portrait with dialog open, then rotate to landscape
      await pageLand.setViewportSize({ width: 390, height: 844 });
      await pageLand.waitForTimeout(200);
      await pageLand.tap('.brand-btn');
      await pageLand.waitForTimeout(200);
      console.log('Rotating to landscape with dialog open...');
      await pageLand.setViewportSize({ width: 844, height: 390 });
      await pageLand.waitForTimeout(300);

      const rotatedDialogState = await pageLand.evaluate(() => {
        const dlg = document.querySelector('.venue-picker');
        const r = dlg?.getBoundingClientRect();
        return {
          open: dlg?.open,
          box: r ? { w: r.width, h: r.height, top: r.top, left: r.left } : null,
          viewport: { w: window.innerWidth, h: window.innerHeight },
        };
      });
      results.scenarios.rotatedDialogState = rotatedDialogState;
      console.log('Rotated dialog state:', rotatedDialogState);
      await pageLand.screenshot({ path: path.join(shotsDir, '18-rotated-dialog-landscape.jpg'), type: 'jpeg', quality: 80 });

      await contextLand.close();
    }

    console.log('--- TEST 4: Tablet (iPad Mini Portrait & Landscape) ---');
    {
      // iPad Mini Portrait
      const contextPadP = await browser.newContext({
        ...devices['iPad Mini'],
        deviceScaleFactor: 1,
      });
      const pagePadP = await contextPadP.newPage();
      await pagePadP.goto(mobileUrl);
      await pagePadP.waitForFunction(() => window.__fest && window.__fest.ready);
      await pagePadP.screenshot({ path: path.join(shotsDir, '19-ipad-mini-portrait.jpg'), type: 'jpeg', quality: 80 });

      // iPad Mini Landscape
      const contextPadL = await browser.newContext({
        ...devices['iPad Mini landscape'],
        deviceScaleFactor: 1,
      });
      const pagePadL = await contextPadL.newPage();
      await pagePadL.goto(mobileUrl);
      await pagePadL.waitForFunction(() => window.__fest && window.__fest.ready);
      await pagePadL.screenshot({ path: path.join(shotsDir, '20-ipad-mini-landscape.jpg'), type: 'jpeg', quality: 80 });

      await contextPadP.close();
      await contextPadL.close();
    }

    console.log('--- TEST 5: Landing Page (index.html) on Mobile ---');
    {
      const contextIndex = await browser.newContext({
        ...devices['iPhone 13'],
        deviceScaleFactor: 1,
      });
      const pageIndex = await contextIndex.newPage();
      pageIndex.on('console', msg => recordLog(msg.type(), msg.text()));
      pageIndex.on('pageerror', err => recordLog('error', err.stack || err.message));

      await pageIndex.goto(indexUrl);
      await pageIndex.waitForTimeout(300);

      await pageIndex.screenshot({ path: path.join(shotsDir, '21-index-page-mobile.jpg'), type: 'jpeg', quality: 80 });

      // Inspect index page elements
      const indexInfo = await pageIndex.evaluate(() => {
        const choices = [...document.querySelectorAll('a.choice')].map(c => ({
          href: c.getAttribute('href'),
          text: c.textContent.replace(/\s+/g, ' ').trim(),
          isRec: c.classList.contains('rec'),
          box: c.getBoundingClientRect(),
        }));
        const venueCards = [...document.querySelectorAll('.venue-card')].map(vc => ({
          name: vc.querySelector('b')?.textContent?.trim(),
          meta: vc.querySelector('.venue-info > span:last-child')?.textContent?.trim(),
          soon: vc.classList.contains('soon'),
          links: [...vc.querySelectorAll('.venue-links a')].map(a => ({
            text: a.textContent.trim(),
            href: a.getAttribute('href'),
            box: a.getBoundingClientRect(),
          })),
        }));
        return { choices, venueCards };
      });
      results.scenarios.indexPage = indexInfo;
      console.log('Index page info:', indexInfo);

      // Check touch targets on index page
      const indexViolations = await checkTouchTargets(pageIndex, 'Index Page (Mobile)', 'a, button');
      results.touchTargetViolations.push(...indexViolations);
      console.log(`Touch target violations on index page: ${indexViolations.length}`);

      await contextIndex.close();
    }

    console.log('--- TEST 6: Rapid Switching & Memory Leaks ---');
    {
      const contextStress = await browser.newContext({
        ...devices['iPhone 13'],
        deviceScaleFactor: 1,
      });
      const pageStress = await contextStress.newPage();
      const stressErrors = [];
      pageStress.on('console', msg => {
        if (msg.type() === 'error') stressErrors.push(msg.text());
      });
      pageStress.on('pageerror', err => stressErrors.push(err.message));

      await pageStress.goto(mobileUrl);
      await pageStress.waitForFunction(() => window.__fest && window.__fest.ready);

      const memInitial = await pageStress.evaluate(() => ({
        geometries: window.__fest.stage.renderer.info.memory.geometries,
        textures: window.__fest.stage.renderer.info.memory.textures,
      }));
      console.log('Initial memory:', memInitial);

      const switchTimes = [];
      for (let i = 0; i < 6; i++) {
        const target = i % 2 === 0 ? 'chamber' : 'big';
        const t0 = Date.now();
        await pageStress.evaluate((id) => window.__fest.loadVenue(id), target);
        const dt = Date.now() - t0;
        switchTimes.push({ to: target, timeMs: dt });
      }

      const memFinal = await pageStress.evaluate(() => ({
        geometries: window.__fest.stage.renderer.info.memory.geometries,
        textures: window.__fest.stage.renderer.info.memory.textures,
      }));
      console.log('Memory after 6 switches:', memFinal);
      console.log('Switch times:', switchTimes);
      console.log('Stress errors encountered:', stressErrors);

      results.performance.rapidSwitches = {
        memInitial,
        memFinal,
        switchTimes,
        stressErrors,
      };

      await contextStress.close();
    }

    console.log('--- TEST 7: Hash Navigation & State Memory ---');
    {
      const contextHash = await browser.newContext({
        ...devices['iPhone 13'],
        deviceScaleFactor: 1,
      });
      const pageHash = await contextHash.newPage();
      // Load chamber directly via hash
      await pageHash.goto(`${mobileUrl}#v=chamber`);
      await pageHash.waitForFunction(() => window.__fest && window.__fest.ready);

      const currentVenue = await pageHash.evaluate(() => window.__fest.venue());
      console.log('Loaded venue from #v=chamber:', currentVenue);
      results.scenarios.hashNavigation = { loadedVenue: currentVenue };

      await contextHash.close();
    }

  } finally {
    await browser.close();
  }

  // Save full results JSON for analysis
  const resultsPath = path.resolve(__dirname, 'audit-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('Audit completed. Results saved to:', resultsPath);
}

run().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
