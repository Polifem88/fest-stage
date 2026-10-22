// Check header widths across screen sizes: 320, 360, 375, 390
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../../..');
const mobileUrl = pathToFileURL(path.resolve(appDir, 'dist/mobile.html')).href;

const widths = [320, 360, 375, 390, 414];

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });

  for (const w of widths) {
    const page = await browser.newPage({
      viewport: { width: w, height: 700 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    await page.goto(mobileUrl);
    await page.waitForFunction(() => window.__fest && window.__fest.ready);

    const data = await page.evaluate(() => {
      const share = document.querySelector('.share-btn');
      const r = share.getBoundingClientRect();
      const lastVisibleRight = window.innerWidth;
      const brand = document.querySelector('.brand-btn').getBoundingClientRect();
      const right = document.querySelector('.mtop-right').getBoundingClientRect();
      return {
        brandWidth: brand.width,
        rightWidth: right.width,
        shareRight: r.right,
        shareLeft: r.left,
        clippedPixels: Math.max(0, r.right - lastVisibleRight),
        fullyVisible: r.right <= lastVisibleRight,
      };
    });
    console.log(`Width ${w}px:`, data);
    await page.close();
  }

  await browser.close();
}

run();
