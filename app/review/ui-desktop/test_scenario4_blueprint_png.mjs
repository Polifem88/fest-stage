import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const outDir = 'review/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('--- Scenario 4: Plan in Blueprint mode with dimensions + PNG download ---');

  // Step 1: Switch to 'План сверху'
  // Go to Views tab
  await page.click('button.tab[data-tab="views"]');
  await page.waitForTimeout(100);
  const planBtn = page.locator('.panel-views button.view:has-text("План сверху")');
  console.log('Clicking "План сверху"...');
  await planBtn.click();
  await page.waitForTimeout(300);

  // Check view state
  console.log('Current view in state:', await page.evaluate(() => window.__fest.stage.view));

  // Step 2: Enable Blueprint mode (Чертёж)
  // Use quickbar in header: button.tgl[data-id="q-bp"]
  const bpQuick = page.locator('button.tgl[data-id="q-bp"]');
  console.log('Enabling Blueprint via quickbar...');
  await bpQuick.click();
  await page.waitForTimeout(200);
  console.log('Blueprint flag:', await page.evaluate(() => window.__fest.stage.flags.blueprint));

  // Step 3: Enable Dimensions (Размеры)
  // Switch to Layers tab
  await page.click('button.tab[data-tab="layers"]');
  await page.waitForTimeout(100);
  const dimsToggle = page.locator('.panel-layers button.tgl:has-text("Размеры")');
  console.log('Enabling Dimensions via Layers panel...');
  await dimsToggle.click();
  await page.waitForTimeout(300);
  console.log('Dims flag:', await page.evaluate(() => window.__fest.stage.flags.dims));

  // Step 4: Click '📷 PNG' button in topbar and wait for download
  const pngBtn = page.locator('.top-actions button:has-text("📷 PNG")');
  console.log('Waiting for download event after clicking "📷 PNG"...');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    pngBtn.click()
  ]);

  const downloadPath = path.resolve(outDir, 'downloaded_blueprint_plan.png');
  await download.saveAs(downloadPath);
  console.log('Download completed. Saved to:', downloadPath);

  // Check file stats
  const stats = fs.statSync(downloadPath);
  console.log('Downloaded file size:', stats.size, 'bytes');

  // Take a full page screenshot via playwright to compare with downloaded PNG
  await page.screenshot({ path: `${outDir}/09_plan_blueprint_dims_page.jpg`, quality: 70, type: 'jpeg' });

  // Read header of downloaded file to verify PNG
  const buf = fs.readFileSync(downloadPath);
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  console.log('Is valid PNG signature:', isPng);

  // Check toast notification
  const toastText = await page.locator('.toast').innerText().catch(() => null);
  console.log('Toast after PNG click:', toastText);

  // Let's also inspect downloaded PNG brightness/variance to verify it is NOT blank/black
  const pngStats = await page.evaluate(async (dataBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, sum2 = 0;
        const total = data.length / 4;
        let nonZeroAlpha = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 0) nonZeroAlpha++;
          const y = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
          sum += y;
          sum2 += y * y;
        }
        const mean = sum / total;
        const std = Math.sqrt(Math.max(0, sum2 / total - mean * mean));
        resolve({ width: img.width, height: img.height, mean: +mean.toFixed(1), std: +std.toFixed(1), nonZeroAlpha });
      };
      img.src = 'data:image/png;base64,' + dataBase64;
    });
  }, buf.toString('base64'));

  console.log('Downloaded PNG image analysis:', pngStats);

  console.log('Console logs count:', logs.length);
  if (logs.length > 0) console.log('Logs:', logs);

  await browser.close();
  console.log('Test 4 finished successfully.');
}

run().catch(e => {
  console.error('Test 4 failed:', e);
  process.exit(1);
});
