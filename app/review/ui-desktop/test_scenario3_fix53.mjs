import { chromium } from '@playwright/test';

const outDir = 'review/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('--- Scenario 3: Find fixture #53, open card, turn off ---');

  // Check where search input is located
  const globalSearchCount = await page.locator('input[type="search"]').count();
  console.log('Search inputs present on page on load:', globalSearchCount);

  // Switch to '💡 Свет' tab
  await page.click('button.tab[data-tab="light"]');
  await page.waitForTimeout(100);

  const searchInput = page.locator('input.search');
  const isSearchVisible = await searchInput.isVisible();
  console.log('Search input visible in Light tab:', isSearchVisible);

  // Check scroll position needed to see search input
  const searchBox = await searchInput.boundingBox();
  console.log('Search input bounding box:', searchBox);

  // Type 53 and press Enter
  await searchInput.scrollIntoViewIfNeeded();
  await searchInput.fill('53');
  await searchInput.press('Enter');
  await page.waitForTimeout(1000); // wait for camera focus anim

  // Check selected fixture
  const sel = await page.evaluate(() => window.__fest.stage.selected);
  const desc = await page.evaluate(() => window.__fest.describe());
  console.log('Selected object:', sel);
  console.log('Object description:', desc);

  // Check Info Card
  const card = page.locator('.card:not([hidden])');
  console.log('Card visible:', await card.isVisible());
  const cardTitle = await card.locator('.card-head b').textContent();
  console.log('Card title:', cardTitle);
  const cardDlText = await card.locator('dl').innerText();
  console.log('Card details:\n', cardDlText);

  // Take screenshot of focused fixture and card
  await page.screenshot({ path: `${outDir}/07_fixture53_focused_card.jpg`, quality: 70, type: 'jpeg' });

  // Now turn it OFF via card toggle
  const cardToggle = card.locator('button.tgl');
  console.log('Card toggle label:', await cardToggle.textContent());
  console.log('Card toggle checked before:', await cardToggle.getAttribute('aria-checked'));

  await cardToggle.click();
  await page.waitForTimeout(300);

  console.log('Card toggle checked after click:', await cardToggle.getAttribute('aria-checked'));
  const isFixOn = await page.evaluate(() => {
    const f = window.__fest.stage.fixtures.byNo.get('53');
    return f.on;
  });
  console.log('Is fixture #53 ON in state:', isFixOn);

  // Check chip in the panel list
  // Which group is #53 in?
  const group = desc.rows.find(r => r[0] === 'Группа')?.[1];
  console.log('Fixture 53 group:', group);

  // Find chip for 53
  const chip53 = page.locator('.chip:has-text("53")');
  const chipCount = await chip53.count();
  console.log('Chip 53 found in list count:', chipCount);
  if (chipCount > 0) {
    const chipClass = await chip53.getAttribute('class');
    console.log('Chip 53 class:', chipClass);
  }

  await page.screenshot({ path: `${outDir}/08_fixture53_turned_off.jpg`, quality: 70, type: 'jpeg' });

  // Test what happens with invalid search query: e.g. "999"
  console.log('Testing invalid search query "999"...');
  await searchInput.fill('999');
  await searchInput.press('Enter');
  await page.waitForTimeout(300);
  const toastText = await page.locator('.toast').innerText().catch(() => null);
  console.log('Toast notification for 999:', toastText);

  console.log('Console logs count:', logs.length);
  if (logs.length > 0) console.log('Logs:', logs);

  await browser.close();
  console.log('Test 3 finished successfully.');
}

run().catch(e => {
  console.error('Test 3 failed:', e);
  process.exit(1);
});
