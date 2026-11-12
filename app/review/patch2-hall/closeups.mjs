// Контрольные крупные планы зрительного зала Большой сцены (Патч 2: замеры зала и потолок по фото).
// Запуск (из каталога app): node review/patch2-hall/closeups.mjs <distDir> <outDir>
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const CHROME_ARGS = process.env.FEST_GPU
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

// Камеры: pos / target — [x, y, d]; house — зальный свет, duty — дежурный, off — выключить приборы сцены
export const CAMERAS = [
  // ракурс присланного фото: справа сзади на левую стену и потолок, сцена справа
  { name: 'photoMatch', pos: [5.5, 2.4, -16.0], target: [-7.5, 4.6, -7.0], fov: 62 },
  { name: 'ceilingFromStage', pos: [0.0, 1.7, 3.0], target: [0.0, 4.6, -12.0], fov: 62 },
  { name: 'nicheCloseFromStage', pos: [0.0, 2.6, -1.5], target: [0.0, 5.8, -5.6] },
  { name: 'ceilingSideProfile', pos: [-6.2, 3.0, -9.0], target: [7.9, 4.6, -9.0], fov: 70 },
  { name: 'boothWindowCeiling', pos: [0.0, 2.4, -12.5], target: [0.0, 3.8, -18.0] },
  { name: 'hallFromBooth', pos: [0.0, 4.0, -17.6], target: [0.0, 1.2, -2.0] },
  { name: 'aisleStepsRight', pos: [7.5, 1.2, -4.5], target: [6.9, 0.6, -12.0] },
  { name: 'aisleWidthPlan', pos: [7.45, 9.0, -9.0], target: [7.45, 0.0, -9.01], fov: 50 },
  { name: 'boothCornerRight', pos: [4.8, 2.5, -13.5], target: [8.8, 2.2, -18.8] },
  { name: 'exitPocketRight', pos: [8.2, 2.5, -14.0], target: [10.6, 2.0, -20.2] },
  { name: 'dutyOnlyHall', pos: [0.0, 2.0, 3.8], target: [0.0, 2.6, -13.0], house: false, duty: true, off: true },
  { name: 'hallOutsideDollhouse', pos: [18.5, 8.0, -11.0], target: [0.0, 1.8, -11.0] },
];

const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) {
  console.error('Использование: node review/patch2-hall/closeups.mjs <distDir> <outDir>');
  process.exit(2);
}

const distDir = resolve(APP, distArg);
const outDir = resolve(APP, outArg);
const htmlPath = join(distDir, 'desktop.html');
if (!existsSync(htmlPath)) {
  console.error(`Не найден файл сборки: ${htmlPath}`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${pathToFileURL(htmlPath).href}#v=big`);
  await page.waitForFunction(() => window.__fest?.ready && window.__fest.venue() === 'big', null, { timeout: 180_000 });

  await page.evaluate(() => {
    document.body.classList.add('side-hidden');
    document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
    window.__fest.stage.resize();
    window.__fest.renderNow();
  });
  await page.waitForTimeout(250);

  for (const cam of CAMERAS) {
    await page.evaluate(({ pos, target, fov, house, duty, off }) => {
      const f = window.__fest;
      document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
      f.stage.setFlag('house', house !== false);
      f.stage.setFlag('duty', duty !== false);
      f.light('all', !off);
      f.setCamera(pos, target, fov);
      f.renderNow();
    }, cam);
    await page.waitForTimeout(200);
    const png = await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled', caret: 'hide' });
    writeFileSync(join(outDir, `${cam.name}.png`), png);
    console.log(`  ✔ ${cam.name}.png`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
