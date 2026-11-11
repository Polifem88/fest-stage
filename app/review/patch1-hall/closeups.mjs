// Контрольные крупные планы зрительного зала Большой сцены (Патч 1 · часть 2): до/после по всем узлам ТЗ.
// Запуск (из каталога app): node review/patch1-hall/closeups.mjs <distDir> <outDir>
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const CHROME_ARGS = process.env.FEST_GPU
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

export const CAMERAS = [
  { name: 'frontDoorRight', pos: [3.2, 1.3, -2.4], target: [8.4, 0.3, -1.0] },
  { name: 'frontStairLeft', pos: [-2.8, 1.2, -3.6], target: [-6.8, -0.4, -0.8] },
  { name: 'aisleStepsLeft', pos: [-7.5, 0.4, -4.6], target: [-7.1, 0.2, -9.5] },
  { name: 'sawtoothLedsRight', pos: [5.2, 1.4, -3.5], target: [8.4, 1.3, -11.0], house: true },
  { name: 'sawtoothLedsOff', pos: [5.2, 1.4, -3.5], target: [8.4, 1.3, -11.0], house: false },
  { name: 'boothCornerRight', pos: [4.8, 2.5, -13.5], target: [8.8, 2.2, -18.8] },
  { name: 'exitPocketRight', pos: [7.8, 2.3, -14.2], target: [10.6, 2.1, -20.2] },
  { name: 'stageToHallWide', pos: [0.0, 2.0, 3.8], target: [0.0, 1.8, -13.0] },
  { name: 'hallFromBooth', pos: [0.0, 3.6, -17.4], target: [0.0, 1.2, -2.0] },
  { name: 'hallOutsideDollhouse', pos: [18.5, 8.0, -11.0], target: [0.0, 1.8, -11.0] },
];

const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) {
  console.error('Использование: node review/patch1-hall/closeups.mjs <distDir> <outDir>');
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

  // Скрываем боковую панель (360 px слева) и тосты, включаем зальный свет по умолчанию
  await page.evaluate(() => {
    document.body.classList.add('side-hidden');
    document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
    window.__fest.stage.setFlag('house', true);
    window.__fest.stage.resize();
    window.__fest.renderNow();
  });
  await page.waitForTimeout(250);

  for (const cam of CAMERAS) {
    await page.evaluate(({ pos, target, fov, house }) => {
      const f = window.__fest;
      document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
      f.stage.setFlag('house', house !== false);
      f.setCamera(pos, target, fov);
      f.renderNow();
    }, cam);
    await page.waitForTimeout(200);
    const png = await page.screenshot({ type: 'png', scale: 'css', animations: 'disabled', caret: 'hide' });
    const file = join(outDir, `${cam.name}.png`);
    writeFileSync(file, png);
    console.log(`  ✔ ${cam.name}.png`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
