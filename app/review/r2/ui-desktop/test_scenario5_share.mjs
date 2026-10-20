import { chromium } from '@playwright/test';

const OUT_DIR = 'review/r2/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  // 1. Initial Page: Check view button highlight upon pure load!
  const page1 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page1.goto('http://localhost:5173/desktop.html');
  await page1.waitForFunction(() => window.__fest?.ready);

  console.log('=== TEST SCENARIO 5: SHARE LINK & VIEW HIGHLIGHT ===');

  // Check 'views' tab upon pure load
  await page1.click('button[data-tab="views"]');
  await page1.waitForTimeout(100);

  const activeButtonsOnLoad = await page1.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.panel-views button.view'));
    return btns.map(b => ({ text: b.textContent, isOn: b.classList.contains('on') }));
  });
  console.log('View buttons on clean load:', activeButtonsOnLoad);
  const overviewIsOn = activeButtonsOnLoad.find(b => b.text === 'Общий вид')?.isOn;
  console.log('Is "Общий вид" button highlighted with .on upon initial load?', overviewIsOn);

  // 2. Modify state:
  // - Sh5 to 2.0m
  // - C2 to 3.5m
  // - Solo C2
  // - Duty light OFF
  // - Switch view to 'Из зала (8-й ряд)'
  await page1.evaluate(() => {
    window.__fest.setHeight('Sh5', 2.0);
    window.__fest.setHeight('C2', 3.5);
    window.__fest.stage.soloGroupSet('C2');
    window.__fest.flag('duty', false);
  });
  await page1.click('button.view:has-text("Из зала")');
  await page1.waitForTimeout(600);

  // Check active view button after click
  const activeButtonsAfterHallClick = await page1.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.panel-views button.view'));
    return btns.filter(b => b.classList.contains('on')).map(b => b.textContent);
  });
  console.log('Active view button after clicking "Из зала":', activeButtonsAfterHallClick);

  // 3. Click Share button
  // In desktop, topbar share button has text "🔗 Ссылка"
  await page1.click('.topbar button:has-text("🔗 Ссылка")');
  await page1.waitForTimeout(200);

  const shareToast = await page1.evaluate(() => document.querySelector('.toast')?.textContent);
  console.log('Share toast:', shareToast);

  const shareUrl = await page1.evaluate(() => window.__fest.stage.shareUrl());
  console.log('Share URL generated:', shareUrl);

  await page1.screenshot({ path: `${OUT_DIR}/12_share_source_page.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 4. Open shared link in completely new browser context
  console.log('--- Opening shared URL in new browser context ---');
  const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page2 = await context2.newPage();
  await page2.goto(shareUrl);
  await page2.waitForFunction(() => window.__fest?.ready);

  // Check restored state
  const restoredState = await page2.evaluate(() => {
    const f = window.__fest;
    return {
      view: f.stage.view,
      sh5H: f.height('Sh5'),
      c2H: f.height('C2'),
      dutyFlag: f.stage.flags.duty,
      c2State: f.stage.groupSetState('C2'),
      c1State: f.stage.groupSetState('C1'),
      stageState: f.stage.stageState()
    };
  });
  console.log('Restored state on page 2:', restoredState);

  // Open 'views' tab on page 2 and check active view button highlight!
  await page2.click('button[data-tab="views"]');
  await page2.waitForTimeout(100);

  const activeButtonsOnSharedPage = await page2.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.panel-views button.view'));
    return btns.map(b => ({ text: b.textContent, isOn: b.classList.contains('on') }));
  });
  console.log('View buttons on restored shared page:', activeButtonsOnSharedPage);
  const hallIsOn = activeButtonsOnSharedPage.find(b => b.text.includes('Из зала'))?.isOn;
  console.log('Is "Из зала" button highlighted with .on on restored shared page?', hallIsOn);

  await page2.screenshot({ path: `${OUT_DIR}/13_share_restored_page.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  await browser.close();
  console.log('=== TEST SCENARIO 5 FINISHED ===');
}

run().catch(console.error);
