// Контрольные крупные планы Большой сцены (Патч 1): до/после по всем узлам ТЗ.
// Запуск (из каталога app): node review/patch1/closeups.mjs <distDir> <outDir>
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const CHROME_ARGS = process.env.FEST_GPU
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

export const CAMERAS = [
  { name: 'leftGallery', pos: [-2.5, 7.4, 0.6], target: [-7.4, 5.4, 4.5] },
  // d = 7.8 (перед нижней галереей d = 8.3..9.2, иначе её обшивка y = 1.85..2.32 перекрывает кадр)
  { name: 'leftGalleryLow', pos: [-4.5, 1.7, 7.8], target: [-7.8, 5.6, 2.5], fov: 60 },
  { name: 'battenEnds', pos: [-3.0, 6.9, -1.5], target: [-6.8, 6.3, 3.0] },
  { name: 'rightFront', pos: [4.5, 2.2, 3.4], target: [8.1, 1.4, 0.8] },
  { name: 'pit', pos: [5.5, 3.2, 5.6], target: [8.0, -0.6, 2.6] },
  // y = 5.3 (ниже настила правой галереи y = 5.64..5.70, иначе настил закрывает приямок сверху)
  { name: 'pitTop', pos: [7.1, 5.3, 3.05], target: [8.05, -0.6, 3.05], fov: 65 },
  { name: 'gateNiche', pos: [3.0, 1.7, 5.0], target: [4.6, 1.0, 10.0] },
  { name: 'doorNiche', pos: [-3.0, 1.6, 6.0], target: [-4.4, 0.8, 10.0] },
  { name: 'liftPad', pos: [4.0, 3.6, 5.5], target: [7.6, 2.2, 8.3] },
  { name: 'backOutside', pos: [2.0, 6.0, 16.0], target: [0.0, 1.5, 9.0] },
];

const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) {
  console.error('Использование: node review/patch1/closeups.mjs <distDir> <outDir>');
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

  // Скрываем боковую панель (360 px слева) и тосты, чтобы геометрия у левого края кадра не перекрывалась UI
  await page.evaluate(() => {
    document.body.classList.add('side-hidden');
    document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
    window.__fest.stage.resize();
    window.__fest.renderNow();
  });
  await page.waitForTimeout(250);

  for (const cam of CAMERAS) {
    await page.evaluate(({ pos, target, fov }) => {
      const f = window.__fest;
      document.querySelectorAll('.toast, .mhint').forEach((e) => e.remove());
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
