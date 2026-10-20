import { chromium, devices } from '@playwright/test';

async function checkMetrics() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const deviceList = [
    { name: 'iPhone 13', dev: devices['iPhone 13'], orientation: 'portrait' },
    { name: 'iPhone 13 landscape', dev: devices['iPhone 13 landscape'], orientation: 'landscape' },
    { name: 'Pixel 5', dev: devices['Pixel 5'], orientation: 'portrait' },
  ];

  const report = {};

  for (const item of deviceList) {
    const context = await browser.newContext(item.dev);
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', m => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLogs.push({ type: 'pageerror', text: e.message }));

    await page.goto('http://localhost:5173/mobile.html');
    await page.waitForFunction(() => window.__fest?.ready);

    // 1. Measure header quick buttons
    const headerMetrics = await page.evaluate(() => {
      const top = document.querySelector('.mtop');
      const topRect = top ? top.getBoundingClientRect() : null;
      const brand = document.querySelector('.mtop .brand');
      const brandRect = brand ? brand.getBoundingClientRect() : null;
      const quickBtns = Array.from(document.querySelectorAll('.mtop .quick .tgl')).map(b => {
        const r = b.getBoundingClientRect();
        return {
          id: b.dataset.id || b.getAttribute('aria-label') || b.className,
          label: b.getAttribute('aria-label') || b.title,
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
          bottom: r.bottom,
          right: r.right,
        };
      });

      // Sheet handle & tabs in peek state
      const handle = document.querySelector('.sheet .handle');
      const handleRect = handle ? handle.getBoundingClientRect() : null;
      const tabs = Array.from(document.querySelectorAll('.sheet .mtab')).map(t => {
        const r = t.getBoundingClientRect();
        return {
          tab: t.dataset.tab,
          text: t.innerText.replace('\n', ' ').trim(),
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
        };
      });

      const sheet = document.querySelector('.sheet');
      const sheetRect = sheet ? sheet.getBoundingClientRect() : null;

      // Hint banner
      const hint = document.querySelector('.mhint');
      const hintRect = hint ? hint.getBoundingClientRect() : null;

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        topRect,
        brandRect,
        quickBtns,
        handleRect,
        tabs,
        sheetRect,
        hintRect,
      };
    });

    // 2. Open sheet - Tab "Механика"
    await page.locator('.mtab[data-tab="rig"]').tap();
    await page.waitForTimeout(300);

    const rigMetrics = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet');
      const sheetRect = sheet.getBoundingClientRect();
      const top = document.querySelector('.mtop');
      const topRect = top.getBoundingClientRect();

      // Check collision/overlap between sheet and top bar
      const sheetOverlapTop = (sheetRect.top < topRect.bottom) && (sheetRect.right > topRect.left && sheetRect.left < topRect.right);

      const topBtns = Array.from(document.querySelectorAll('.mtop .quick .tgl')).map(b => {
        const r = b.getBoundingClientRect();
        const covered = (r.left < sheetRect.right && r.right > sheetRect.left && r.top < sheetRect.bottom && r.bottom > sheetRect.top);
        return {
          id: b.getAttribute('aria-label') || b.dataset.id,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          coveredBySheet: covered,
        };
      });

      // Check buttons in rig panel
      const actionBtns = Array.from(document.querySelectorAll('.panel-rig .btn')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), width: r.width, height: r.height };
      });

      // Check batten rows
      const rows = Array.from(document.querySelectorAll('.panel-rig .rig-row')).slice(0, 5).map(row => {
        const nameBtn = row.querySelector('.rig-name');
        const slider = row.querySelector('input[type="range"]');
        const num = row.querySelector('.num');
        const nr = nameBtn.getBoundingClientRect();
        const sr = slider.getBoundingClientRect();
        const ir = num.getBoundingClientRect();
        return {
          id: row.dataset.id,
          nameBtn: { width: nr.width, height: nr.height },
          slider: { width: sr.width, height: sr.height },
          input: { width: ir.width, height: ir.height },
        };
      });

      return {
        sheetState: sheet.dataset.state,
        sheetRect: { x: sheetRect.x, y: sheetRect.y, w: sheetRect.width, h: sheetRect.height },
        sheetOverlapTop,
        topBtns,
        actionBtns,
        sampleRows: rows,
      };
    });

    await page.screenshot({
      path: `review/ui-mobile/metrics_${item.name.replace(/\s+/g, '_')}_rig.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // 3. Open tab "Свет"
    await page.locator('.mtab[data-tab="light"]').tap();
    await page.waitForTimeout(300);

    const lightMetrics = await page.evaluate(() => {
      // Master toggles
      const masters = Array.from(document.querySelectorAll('.panel-light .grid-2 .tgl')).map(t => {
        const r = t.getBoundingClientRect();
        return { text: t.innerText.trim(), width: r.width, height: r.height };
      });

      // Group toggles
      const groups = Array.from(document.querySelectorAll('.panel-light .grid-3 .tgl')).map(t => {
        const r = t.getBoundingClientRect();
        return { text: t.innerText.trim(), width: r.width, height: r.height };
      });

      // Portable buttons
      const portables = Array.from(document.querySelectorAll('.panel-light .btn-row .btn')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), width: r.width, height: r.height };
      });

      // Search input & find button
      const search = document.querySelector('.panel-light .search');
      const findBtn = document.querySelector('.panel-light .search-row .btn');
      const sr = search ? search.getBoundingClientRect() : null;
      const fr = findBtn ? findBtn.getBoundingClientRect() : null;

      // Chips
      const chips = Array.from(document.querySelectorAll('.panel-light .chip')).slice(0, 8).map(c => {
        const r = c.getBoundingClientRect();
        return { text: c.innerText.trim(), width: r.width, height: r.height };
      });

      return {
        masters,
        groups: groups.slice(0, 4),
        portables,
        search: sr ? { width: sr.width, height: sr.height } : null,
        findBtn: fr ? { width: fr.width, height: fr.height } : null,
        chips,
      };
    });

    // 4. Open tab "Виды"
    await page.locator('.mtab[data-tab="views"]').tap();
    await page.waitForTimeout(300);

    const viewsMetrics = await page.evaluate(() => {
      const viewBtns = Array.from(document.querySelectorAll('.panel-views .grid-2 .btn')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), width: r.width, height: r.height };
      });
      const actionBtns = Array.from(document.querySelectorAll('.panel-views .grid-1 .btn')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), width: r.width, height: r.height };
      });
      return { viewBtns, actionBtns };
    });

    // 5. Open tab "Ещё" (layers)
    await page.locator('.mtab[data-tab="layers"]').tap();
    await page.waitForTimeout(300);

    const layersMetrics = await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('.panel-layers .tgl')).map(t => {
        const r = t.getBoundingClientRect();
        return { text: t.innerText.trim(), width: r.width, height: r.height };
      });
      return { toggles };
    });

    // 6. Select Sh5 to check infoCard metrics and toast overlap
    await page.evaluate(() => {
      window.__fest.select({ kind: 'rig', id: 'Sh5' });
    });
    await page.waitForTimeout(400);

    const cardRigMetrics = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const cr = card ? card.getBoundingClientRect() : null;
      const toast = document.querySelector('.toast');
      const tr = toast ? toast.getBoundingClientRect() : null;
      const closeBtn = card ? card.querySelector('.x') : null;
      const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
      const slider = card ? card.querySelector('input[type="range"]') : null;
      const sliderRect = slider ? slider.getBoundingClientRect() : null;
      const presetBtns = card ? Array.from(card.querySelectorAll('.btn')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.innerText.trim(), width: r.width, height: r.height };
      }) : [];

      let toastOverlapCard = false;
      if (cr && tr) {
        toastOverlapCard = (tr.left < cr.right && tr.right > cr.left && tr.top < cr.bottom && tr.bottom > cr.top);
      }

      return {
        cardVisible: card ? !card.hidden : false,
        cardRect: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height } : null,
        toastRect: tr ? { x: tr.x, y: tr.y, w: tr.width, h: tr.height } : null,
        toastOverlapCard,
        closeRect: closeRect ? { w: closeRect.width, h: closeRect.height } : null,
        sliderRect: sliderRect ? { w: sliderRect.width, h: sliderRect.height } : null,
        presetBtns,
        cardScrollHeight: card ? card.scrollHeight : 0,
        cardClientHeight: card ? card.clientHeight : 0,
      };
    });

    await page.screenshot({
      path: `review/ui-mobile/metrics_${item.name.replace(/\s+/g, '_')}_card_rig.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    // 7. Select fixture 53 to check infoCard metrics for fixture
    await page.evaluate(() => {
      window.__fest.selectFixture(53);
    });
    await page.waitForTimeout(400);

    const cardFixtureMetrics = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const cr = card ? card.getBoundingClientRect() : null;
      const toggle = card ? card.querySelector('.tgl') : null;
      const toggleRect = toggle ? toggle.getBoundingClientRect() : null;
      const closeBtn = card ? card.querySelector('.x') : null;
      const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
      const rows = card ? Array.from(card.querySelectorAll('dt')).map((dt, i) => {
        const dd = card.querySelectorAll('dd')[i];
        return { key: dt.innerText.trim(), val: dd ? dd.innerText.trim() : '' };
      }) : [];

      return {
        cardRect: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height } : null,
        cardScrollHeight: card ? card.scrollHeight : 0,
        cardClientHeight: card ? card.clientHeight : 0,
        isTruncated: card ? card.scrollHeight > card.clientHeight : false,
        toggleRect: toggleRect ? { w: toggleRect.width, h: toggleRect.height } : null,
        closeRect: closeRect ? { w: closeRect.width, h: closeRect.height } : null,
        rowsCount: rows.length,
      };
    });

    await page.screenshot({
      path: `review/ui-mobile/metrics_${item.name.replace(/\s+/g, '_')}_card_fixture.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    report[item.name] = {
      headerMetrics,
      rigMetrics,
      lightMetrics,
      viewsMetrics,
      layersMetrics,
      cardRigMetrics,
      cardFixtureMetrics,
      consoleLogs,
    };

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

checkMetrics().catch(console.error);
