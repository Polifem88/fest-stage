import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  // Tab to first element (quick toggle)
  await page.keyboard.press('Tab');
  await page.screenshot({ path: 'review/ui-desktop/17_focus_quick_toggle.jpg', quality: 70, type: 'jpeg' });

  // Tab to PNG button
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await page.screenshot({ path: 'review/ui-desktop/18_focus_png_btn.jpg', quality: 70, type: 'jpeg' });

  // Tab to slider
  for (let i = 0; i < 11; i++) await page.keyboard.press('Tab');
  await page.screenshot({ path: 'review/ui-desktop/19_focus_slider.jpg', quality: 70, type: 'jpeg' });

  await browser.close();
}

run();
