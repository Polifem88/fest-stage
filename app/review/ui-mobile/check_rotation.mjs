import { chromium, devices } from '@playwright/test';

async function testRotation() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage({ ...devices['iPhone 13'] });
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // 1. Initial portrait state
  const portraitState = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    return {
      vp: { w: window.innerWidth, h: window.innerHeight },
      canvas: { w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight },
      cameraAspect: window.__fest.stage.camera.aspect,
      sheetRect: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
    };
  });

  // Open card by selecting Sh5
  await page.evaluate(() => window.__fest.select({ kind: 'rig', id: 'Sh5' }));
  await page.waitForTimeout(300);

  const cardInPortrait = await page.evaluate(() => {
    const card = document.querySelector('.card');
    const cr = card.getBoundingClientRect();
    return { x: cr.x, y: cr.y, w: cr.width, h: cr.height };
  });

  await page.screenshot({
    path: 'review/ui-mobile/rot_1_portrait.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // 2. Rotate to landscape (844 x 390)
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);

  const landscapeState = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    const card = document.querySelector('.card');
    const cr = card ? card.getBoundingClientRect() : null;
    return {
      vp: { w: window.innerWidth, h: window.innerHeight },
      canvas: { w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight },
      cameraAspect: window.__fest.stage.camera.aspect,
      sheetRect: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
      cardRect: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height } : null,
      cardScrollH: card ? card.scrollHeight : 0,
      cardClientH: card ? card.clientHeight : 0,
    };
  });

  await page.screenshot({
    path: 'review/ui-mobile/rot_2_rotated_landscape.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // Open sheet in landscape to check layout
  await page.locator('.mtab[data-tab="rig"]').tap();
  await page.waitForTimeout(300);

  const openSheetLandscape = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    const card = document.querySelector('.card');
    const top = document.querySelector('.mtop');
    const tr = top.getBoundingClientRect();
    return {
      sheetRect: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
      cardVisible: card ? !card.hidden && window.getComputedStyle(card).display !== 'none' : false,
      topOverlapped: sr.x < tr.right && sr.y < tr.bottom,
    };
  });

  await page.screenshot({
    path: 'review/ui-mobile/rot_3_landscape_open_sheet.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // 3. Rotate back to portrait (390 x 844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  const backToPortraitState = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    return {
      vp: { w: window.innerWidth, h: window.innerHeight },
      canvas: { w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight },
      cameraAspect: window.__fest.stage.camera.aspect,
      sheetRect: { x: sr.x, y: sr.y, w: sr.width, h: sr.height },
    };
  });

  await page.screenshot({
    path: 'review/ui-mobile/rot_4_back_to_portrait.jpg',
    type: 'jpeg',
    quality: 70,
  });

  await browser.close();

  console.log(JSON.stringify({
    portraitState,
    cardInPortrait,
    landscapeState,
    openSheetLandscape,
    backToPortraitState,
  }, null, 2));
}

testRotation().catch(console.error);
