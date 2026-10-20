import { chromium } from '@playwright/test';

const OUT_DIR = 'review/r2/ui-desktop';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('=== TEST SCENARIO 3: FIXTURE 53 ===');

  // 1. Check topbar search field
  const topSearchInput = page.locator('.topbar .top-search input.search');
  console.log('Topbar search field count:', await topSearchInput.count());
  const topSearchPlaceholder = await topSearchInput.getAttribute('placeholder');
  console.log('Topbar search placeholder:', topSearchPlaceholder);

  // Type '53' in topbar search and hit Enter
  await topSearchInput.fill('53');
  await topSearchInput.press('Enter');
  await page.waitForTimeout(900); // wait for camera flight animation

  // Check what is selected
  const selAfterSearch = await page.evaluate(() => window.__fest.stage.selected);
  console.log('Selected after topbar search:', selAfterSearch);

  // Check card content
  const cardData = await page.evaluate(() => {
    const card = document.querySelector('.card');
    if (!card) return null;
    return {
      title: card.querySelector('.card-head h3, h3')?.textContent,
      rows: Array.from(card.querySelectorAll('tr, dl div')).map(el => el.textContent.trim()),
      isToggleOn: card.querySelector('.tgl')?.classList.contains('on'),
    };
  });
  console.log('Card data for Fixture 53:', cardData);

  // Check if group accordion in "Свет" tab was opened
  await page.click('button[data-tab="light"]');
  await page.waitForTimeout(100);

  const accordionStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('details.grp')).map(dt => ({
      summary: dt.querySelector('summary')?.textContent,
      open: dt.open
    }));
  });
  const c2Acc = accordionStatus.find(a => a.summary?.includes('Софит 2'));
  console.log('C2 Accordion in Light panel:', c2Acc);

  // Take screenshot with fixture 53 focused and card open
  await page.screenshot({ path: `${OUT_DIR}/08_fixture53_focused_card.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 2. Turn off fixture 53 from card
  console.log('--- Turning off fixture 53 ---');
  const cardToggle = page.locator('.card .tgl');
  await cardToggle.click();
  await page.waitForTimeout(100);

  const fix53State = await page.evaluate(() => {
    const f = window.__fest.stage.fixtures.byNo.get('53');
    return { no: f.no, on: f.on };
  });
  console.log('Fixture 53 state after toggle:', fix53State);
  await page.screenshot({ path: `${OUT_DIR}/09_fixture53_turned_off.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Turn it back on
  await cardToggle.click();
  await page.waitForTimeout(100);

  // 3. Test Direct 3D Click on Fixture 53 body/head
  console.log('--- Testing Direct 3D Click on Fixture 53 head ---');
  await page.evaluate(() => window.__fest.select(null));
  await page.waitForTimeout(100);

  const fix53HeadCoords = await page.evaluate(() => {
    const f = window.__fest.stage.fixtures.byNo.get('53');
    const p = f.world.head;
    return window.__fest.project([p.x, p.y, -p.z]);
  });
  console.log('Projected Fixture 53 head coords:', fix53HeadCoords);

  // Hover over fixture 53 head
  await page.mouse.move(fix53HeadCoords.x, fix53HeadCoords.y);
  await page.waitForTimeout(50);
  const cursorStyle = await page.evaluate(() => window.__fest.stage.renderer.domElement.style.cursor);
  console.log('Cursor style over fixture 53 head:', cursorStyle);

  // Click on fixture 53
  await page.mouse.click(fix53HeadCoords.x, fix53HeadCoords.y);
  await page.waitForTimeout(150);

  const selAfter3DClick = await page.evaluate(() => window.__fest.stage.selected);
  console.log('Selected after direct 3D click on fixture 53 head:', selAfter3DClick);

  const pickedFixtureNo = await page.evaluate(() => {
    const s = window.__fest.stage.selected;
    if (s?.kind === 'fixture') return window.__fest.stage.fixtures.list[s.idx].no;
    return null;
  });
  console.log('Picked fixture number via 3D click:', pickedFixtureNo);

  // Also check picking fixture 53 from Overview view!
  console.log('--- Testing Picking Fixture 53 from Overview ---');
  await page.evaluate(() => {
    window.__fest.setView('overview');
    window.__fest.select(null);
  });
  await page.waitForTimeout(600);

  const fix53OverviewCoords = await page.evaluate(() => {
    const f = window.__fest.stage.fixtures.byNo.get('53');
    const p = f.world.head;
    return window.__fest.project([p.x, p.y, -p.z]);
  });
  console.log('Overview Fixture 53 head coords:', fix53OverviewCoords);

  await page.mouse.click(fix53OverviewCoords.x, fix53OverviewCoords.y);
  await page.waitForTimeout(150);
  const selFromOverview = await page.evaluate(() => window.__fest.stage.selected);
  const pickedFromOverview = await page.evaluate(() => {
    const s = window.__fest.stage.selected;
    if (s?.kind === 'fixture') return window.__fest.stage.fixtures.list[s.idx].no;
    return s?.id || null;
  });
  console.log('Picked from Overview at fixture 53:', selFromOverview, '->', pickedFromOverview);

  await browser.close();
  console.log('=== TEST SCENARIO 3 FINISHED ===');
}

run().catch(console.error);
