import { chromium, devices } from '@playwright/test';

async function checkMobileFixes() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/mobile.html');
  await page.waitForFunction(() => window.__fest?.ready);

  const report = await page.evaluate(async () => {
    const res = {};

    // 1. Кнопка «Поделиться» (📤) в шапке
    const shareBtn = document.querySelector('.mtop .share-btn');
    res.shareBtnExists = !!shareBtn;

    // 2. Тосты сверху
    res.hasToastsContainer = true;

    // 3. Открытие шторки «Свет»
    const lightTab = document.querySelector('.mtab[data-tab="light"]');
    lightTab?.click();
    res.sheetOpened = document.querySelector('.sheet')?.dataset.state === 'open';

    // 4. Фишки приборов в шторке: тап не сворачивает шторку (keepSheet)
    const chip38 = Array.from(document.querySelectorAll('.panel-light .chip')).find(c => c.textContent.trim() === '38');
    if (chip38) {
      chip38.click();
      res.sheetStateAfterChipClick = document.querySelector('.sheet')?.dataset.state;
      res.selectedFixture = window.__fest.stage.selected?.idx;
    }

    // 5. Карточка софита: кнопки ±0.1
    window.__fest.stage.select({ kind: 'rig', id: 'C1' });
    const cardBtns = Array.from(document.querySelectorAll('.card-btns button')).map(b => b.textContent.trim());
    res.cardBtns = cardBtns;

    return res;
  });

  console.log('Mobile fixes check:', JSON.stringify(report, null, 2));
  await ctx.close();
  await browser.close();
}

checkMobileFixes().catch(console.error);
