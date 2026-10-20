import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  await page.click('button[data-tab="light"]');
  await page.waitForTimeout(100);

  const measurements = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.groups .grp-cell'));
    return cells.map(c => {
      const tgl = c.querySelector('.tgl');
      const lbl = c.querySelector('.lbl');
      const solo = c.querySelector('.solo');
      return {
        text: lbl?.textContent,
        cellW: c.clientWidth,
        tglW: tgl?.clientWidth,
        lblScrollW: lbl?.scrollWidth,
        lblClientW: lbl?.clientWidth,
        soloW: solo?.clientWidth,
        isClipped: lbl ? lbl.scrollWidth > lbl.clientWidth : false
      };
    });
  });

  console.log('1920x1080 Light group clipping measurements:');
  for (const m of measurements) {
    console.log(`- ${m.text.padEnd(16)}: clientW=${m.lblClientW}px, scrollW=${m.lblScrollW}px, clipped=${m.isClipped}`);
  }

  await browser.close();
}

run().catch(console.error);
