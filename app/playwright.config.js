import { defineConfig, devices } from '@playwright/test';

// Используем уже установленный Google Chrome (отдельный браузер не скачивается).
// WebGL в фоновом режиме — через программный рендер SwiftShader: медленнее видеокарты,
// поэтому FPS в тестах — оценка «снизу».
const BASE = process.env.FEST_URL || 'http://localhost:5173/';
const chromeArgs = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    channel: 'chrome',
    launchOptions: { args: chromeArgs },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'iphone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
    { name: 'android', use: { ...devices['Pixel 5'], channel: 'chrome' } },
  ],
});
