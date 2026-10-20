import { chromium, devices } from '@playwright/test';

async function testScenario4and5() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const configs = [
    { name: 'iPhone 13', dev: devices['iPhone 13'] },
    { name: 'iPhone 13 landscape', dev: devices['iPhone 13 landscape'] },
    { name: 'Pixel 5', dev: devices['Pixel 5'] },
  ];

  const results = {};

  for (const cfg of configs) {
    const context = await browser.newContext(cfg.dev);
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', m => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLogs.push({ type: 'pageerror', text: e.message }));

    await page.goto('http://localhost:5173/mobile.html');
    await page.waitForFunction(() => window.__fest?.ready);

    // ==========================================
    // SCENARIO 4: PLAN + BLUEPRINT + SHARE BUTTON 📤
    // ==========================================
    // 1. Switch to 'plan' view via Views panel or quick bar
    const viewsTab = page.locator('.mtab[data-tab="views"]');
    await viewsTab.tap();
    await page.waitForTimeout(300);

    const planBtn = page.locator('.grid-2 button.view', { hasText: 'План сверху' });
    await planBtn.tap();
    await page.waitForTimeout(300);

    // Check highlight on active view button in Views panel
    const viewButtonOn = await planBtn.evaluate(el => el.classList.contains('on'));

    // Peek sheet
    await page.evaluate(() => {
      document.body.dataset.sheet = 'peek';
      const s = document.querySelector('.sheet');
      if (s) s.dataset.state = 'peek';
      window.__fest.stage.resize();
    });
    await page.waitForTimeout(300);

    // 2. Turn on Blueprint mode via Quick bar button (blueprint icon is document/scroll)
    // Quick bar has 5 toggle buttons + share button:
    // [duty, stage, house, haze, blueprint] + [shareBtn]
    const bpBtn = page.locator('.mobile .quick .tgl[data-id="q-bp"]');
    await bpBtn.tap();
    await page.waitForTimeout(300);

    const isBlueprintOn = await page.evaluate(() => window.__fest.stage.flags.blueprint);

    // Check ladder-like battens labels in plan view
    const labelLayoutInfo = await page.evaluate(() => {
      const items = Array.from(window.__fest.stage.rigging.items.values());
      const pos = items.map(it => ({
        id: it.cfg.id,
        kind: it.cfg.kind,
        labelX: it.label?.position.x,
        labelY: it.label?.position.y,
        labelZ: it.label?.position.z,
      }));
      return pos;
    });

    // 3. Check Share button in header 📤
    const shareBtn = page.locator('.mobile .share-btn');
    const shareBtnBox = await shareBtn.boundingBox();
    const shareBtnMetrics = await page.evaluate(() => {
      const b = document.querySelector('.mobile .share-btn');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: r.width, h: r.height, title: b.title, ariaLabel: b.getAttribute('aria-label') };
    });

    // Tap share button to open menu
    await shareBtn.tap();
    await page.waitForTimeout(200);

    const menuInfo = await page.evaluate(() => {
      const m = document.querySelector('.mobile .share-menu');
      if (!m || m.hidden) return null;
      const r = m.getBoundingClientRect();
      const btns = Array.from(m.querySelectorAll('.btn')).map(b => {
        const br = b.getBoundingClientRect();
        return { text: b.innerText, w: br.width, h: br.height };
      });
      return { menuBox: { x: r.x, y: r.y, w: r.width, h: r.height }, btns };
    });

    await page.screenshot({
      path: `review/r2/ui-mobile/s4_plan_bp_sharemenu_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // 4. Test screenshot PNG trigger
    // Intercept download or evaluate stage.screenshot()
    const screenshotDataUrl = await page.evaluate(() => {
      // test whether stage.screenshot() works without throwing
      let ok = false;
      try {
        const origCreate = document.createElement.bind(document);
        let capturedHref = null;
        document.createElement = function(tag) {
          const el = origCreate(tag);
          if (tag === 'a') {
            const origSet = el.setAttribute.bind(el);
            Object.defineProperty(el, 'href', {
              set(v) { capturedHref = v; origSet('href', v); },
              get() { return capturedHref; }
            });
            el.click = () => {};
          }
          return el;
        };
        window.__fest.stage.screenshot('test.png');
        document.createElement = origCreate;
        return { success: true, isDataUrl: !!capturedHref?.startsWith('data:image/png') };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    // 5. Test Copy Link trigger
    const linkResult = await page.evaluate(async () => {
      let copiedText = null;
      const origWrite = navigator.clipboard?.writeText;
      if (navigator.clipboard) {
        navigator.clipboard.writeText = async (txt) => { copiedText = txt; };
      }
      const shareUrl = window.__fest.stage.shareUrl();
      return { shareUrl, hasHash: shareUrl.includes('#s=') };
    });

    // ==========================================
    // SCENARIO 5: STATE RESTORATION VIA LINK
    // ==========================================
    // Set a complex state:
    // Sh5 = 2.0 m
    // only C2 on (solo C2)
    // view = plan
    // blueprint = true
    // haze = true
    await page.evaluate(() => {
      window.__fest.setHeight('Sh5', 2.0);
      window.__fest.stage.soloGroupSet('C2');
      window.__fest.setView('plan');
      window.__fest.flag('blueprint', true);
      window.__fest.flag('haze', true);
    });
    await page.waitForTimeout(300);

    const originalState = await page.evaluate(() => {
      const st = window.__fest.stage;
      const list = st.fixtures.list;
      const onNos = list.filter(f => f.on).map(f => f.no);
      return {
        sh5Height: window.__fest.height('Sh5'),
        view: window.__fest.stage.view,
        blueprint: st.flags.blueprint,
        haze: st.flags.haze,
        onNos,
        onCount: onNos.length,
      };
    });

    const fullShareUrl = await page.evaluate(() => window.__fest.stage.shareUrl());

    // Now open a brand new page with fullShareUrl
    const context2 = await browser.newContext(cfg.dev);
    const page2 = await context2.newPage();
    const consoleLogs2 = [];
    page2.on('console', m => consoleLogs2.push({ type: m.type(), text: m.text() }));
    page2.on('pageerror', e => consoleLogs2.push({ type: 'pageerror', text: e.message }));

    await page2.goto(fullShareUrl);
    await page2.waitForFunction(() => window.__fest?.ready);
    await page2.waitForTimeout(400);

    const restoredState = await page2.evaluate(() => {
      const st = window.__fest.stage;
      const list = st.fixtures.list;
      const onNos = list.filter(f => f.on).map(f => f.no);
      return {
        sh5Height: window.__fest.height('Sh5'),
        view: window.__fest.stage.view,
        blueprint: st.flags.blueprint,
        haze: st.flags.haze,
        onNos,
        onCount: onNos.length,
      };
    });

    const isIdentical = JSON.stringify(originalState) === JSON.stringify(restoredState);

    await page2.screenshot({
      path: `review/r2/ui-mobile/s5_restored_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    results[cfg.name] = {
      viewButtonOn,
      isBlueprintOn,
      shareBtnMetrics,
      menuInfo,
      screenshotDataUrl,
      linkResult,
      originalState,
      restoredState,
      isIdentical,
      consoleLogs: [...consoleLogs, ...consoleLogs2],
    };

    await context.close();
    await context2.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testScenario4and5().catch(console.error);
