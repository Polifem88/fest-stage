import { defineConfig, devices } from '@playwright/test';

// Используем уже установленный Google Chrome (отдельный браузер не скачивается).
// WebGL в фоновом режиме — через программный рендер SwiftShader: медленнее видеокарты,
// поэтому FPS в тестах — оценка «снизу». FEST_GPU=1 — попробовать настоящую видеокарту.
const BASE = process.env.FEST_URL || 'http://localhost:5173/';
const chromeArgs = process.env.FEST_GPU
  ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

// Телефоны — с реальными размерами видимой области браузера (без адресной строки)
// и сенсорным вводом; движок — тот же Chrome.
const phone = (name) => ({ ...devices[name], defaultBrowserType: 'chromium', channel: 'chrome' });

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  // dev-сервер Vite поднимается сам, если ещё не запущен
  webServer: process.env.FEST_URL ? undefined : {
    command: 'npx vite --port 5173 --strictPort',
    url: BASE,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: BASE,
    channel: 'chrome',
    launchOptions: { args: chromeArgs },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
    { name: 'iphone', use: phone('iPhone 13') },
    { name: 'iphone-land', use: phone('iPhone 13 landscape') },
    { name: 'android', use: phone('Pixel 5') },
  ],
});
