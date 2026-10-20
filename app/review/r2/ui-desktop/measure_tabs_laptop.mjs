import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const tabsInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.desktop .tabs .tab'));
    return tabs.map(t => ({
      text: t.textContent,
      clientHeight: t.clientHeight,
      clientWidth: t.clientWidth,
      scrollHeight: t.scrollHeight,
      scrollWidth: t.scrollWidth,
    }));
  });
  console.log('1366x768 Tabs measurement:', tabsInfo);

  // Check master light toggles text wrapping
  await page.click('button[data-tab="light"]');
  await page.waitForTimeout(100);

  const masterToggles = await page.evaluate(() => {
    const toggles = Array.from(document.querySelectorAll('.panel-light .grid-2 .tgl'));
    return toggles.map(t => {
      const lbl = t.querySelector('.lbl');
      return {
        text: lbl?.textContent,
        tglW: t.clientWidth,
        lblW: lbl?.clientWidth,
        lblH: lbl?.clientHeight,
        lines: Math.round((lbl?.clientHeight || 0) / 16)
      };
    });
  });
  console.log('1366x768 Master toggles measurement:', masterToggles);

  await browser.close();
}

run().catch(console.error);
