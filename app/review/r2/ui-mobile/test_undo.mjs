import { chromium, devices } from '@playwright/test';

async function testUndo() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext(devices['iPhone 13']);
  const page = await context.newPage();
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Open mechanics
  await page.locator('.mtab[data-tab="rig"]').tap();
  await page.waitForTimeout(300);

  // Initial Sh5 height
  const h0 = await page.evaluate(() => window.__fest.height('Sh5'));

  // Tap '⤒ Всё вверх'
  const upBtn = page.locator('.sheet-body button', { hasText: 'Всё вверх' });
  await upBtn.tap();
  await page.waitForTimeout(300);

  const hAfterUp = await page.evaluate(() => window.__fest.height('Sh5'));

  // Inspect the Undo toast
  const undoToastInfo = await page.evaluate(() => {
    const t = document.querySelector('.toast.act');
    if (!t) return null;
    const btn = t.querySelector('.toast-btn');
    const tr = t.getBoundingClientRect();
    const br = btn ? btn.getBoundingClientRect() : null;
    return {
      text: t.innerText,
      toastBox: { x: tr.x, y: tr.y, w: tr.width, h: tr.height },
      btnBox: br ? { x: br.x, y: br.y, w: br.width, h: br.height } : null,
    };
  });

  await page.screenshot({
    path: 'review/r2/ui-mobile/toast_undo_iphone.jpg',
    type: 'jpeg',
    quality: 70,
  });

  // Tap '↺ Отменить'
  const undoBtn = page.locator('.toast-btn', { hasText: '↺ Отменить' });
  if (await undoBtn.count() > 0) {
    await undoBtn.tap();
    await page.waitForTimeout(300);
  }

  const hAfterUndo = await page.evaluate(() => window.__fest.height('Sh5'));

  console.log(JSON.stringify({ h0, hAfterUp, undoToastInfo, hAfterUndo }, null, 2));

  await context.close();
  await browser.close();
}

testUndo().catch(console.error);
