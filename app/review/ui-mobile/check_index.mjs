import { chromium, devices } from '@playwright/test';

async function testIndex() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const configs = [
    { name: 'iphone', dev: devices['iPhone 13'] },
    { name: 'iphone-land', dev: devices['iPhone 13 landscape'] },
    { name: 'pixel', dev: devices['Pixel 5'] },
    { name: 'desktop', dev: { viewport: { width: 1280, height: 800 } } },
  ];

  const results = [];

  for (const cfg of configs) {
    const context = await browser.newContext(cfg.dev);
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', m => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLogs.push({ type: 'pageerror', text: e.message }));

    // Test with hash state as well
    await page.goto('http://localhost:5173/index.html#s=test123');
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const desk = document.getElementById('desk');
      const mob = document.getElementById('mob');
      const rec = document.getElementById('rec');
      const deskBox = desk ? desk.getBoundingClientRect() : null;
      const mobBox = mob ? mob.getBoundingClientRect() : null;
      return {
        recText: rec ? rec.textContent : null,
        deskRec: desk ? desk.classList.contains('rec') : false,
        mobRec: mob ? mob.classList.contains('rec') : false,
        deskHref: desk ? desk.getAttribute('href') : null,
        mobHref: mob ? mob.getAttribute('href') : null,
        deskBox: deskBox ? { width: deskBox.width, height: deskBox.height } : null,
        mobBox: mobBox ? { width: mobBox.width, height: mobBox.height } : null,
        bodyHeight: document.body.scrollHeight,
        windowHeight: window.innerHeight,
      };
    });

    await page.screenshot({
      path: `review/ui-mobile/index_${cfg.name}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results.push({ name: cfg.name, info, consoleLogs });
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testIndex().catch(console.error);
