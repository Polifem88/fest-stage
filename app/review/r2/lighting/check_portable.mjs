import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const res = await page.evaluate(() => {
    const fest = window.__fest;
    const stage = fest.stage;

    // Включаем portable stand
    stage.setPortable('stand', 8);
    fest.light('all', false);
    fest.light('portable', true);

    const portFixtures = stage.fixtures.list.filter(f => f.portable);
    const portLights = stage.lighting.groupLights.filter(g => g.id.startsWith('PORT'));

    return {
      portFixtures: portFixtures.map(f => ({
        no: f.no,
        on: f.on,
        hidden: f.hidden,
        mount: f.mount,
        aim: f.aim
      })),
      portLights: portLights.map(g => ({
        id: g.id,
        intensity: g.light.intensity,
        pos: g.light.position,
        target: g.light.target.position,
        angle: g.light.angle
      }))
    };
  });

  console.log(JSON.stringify(res, null, 2));
  await browser.close();
}

run();
