import { chromium, devices } from '@playwright/test';

async function checkUiMetrics() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  const configs = [
    { name: 'iPhone 13', dev: devices['iPhone 13'] },
    { name: 'iPhone 13 landscape', dev: devices['iPhone 13 landscape'] },
    { name: 'Pixel 5', dev: devices['Pixel 5'] },
  ];

  const report = {};

  for (const cfg of configs) {
    const context = await browser.newContext(cfg.dev);
    const page = await context.newPage();
    await page.goto('http://localhost:5173/mobile.html');
    await page.waitForFunction(() => window.__fest?.ready);

    const metrics = await page.evaluate(async () => {
      const getBox = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.x, y: r.y };
      };

      const results = {};

      // 1. Top bar & Quick buttons
      const top = document.querySelector('.mtop');
      const brand = document.querySelector('.brand');
      const quickBtns = Array.from(document.querySelectorAll('.quick .tgl')).map(b => ({
        id: b.dataset.id,
        ...getBox(b),
      }));
      const shareBtn = document.querySelector('.share-btn');

      results.topBar = {
        box: getBox(top),
        brand: getBox(brand),
        quickBtns,
        shareBtn: getBox(shareBtn),
      };

      // 2. Sheet Tabs and Handle
      const handle = document.querySelector('.handle');
      const mtabs = Array.from(document.querySelectorAll('.mtab')).map(t => ({
        tab: t.dataset.tab,
        ...getBox(t),
      }));
      results.sheetNav = {
        handle: getBox(handle),
        mtabs,
      };

      // 3. Tab: Rigging (Механика)
      const tabRig = document.querySelector('.mtab[data-tab="rig"]');
      tabRig.click();
      await new Promise(r => setTimeout(r, 100));

      const rigRows = Array.from(document.querySelectorAll('.rig-row')).slice(0, 5).map(row => {
        const name = row.querySelector('.rig-name');
        const slider = row.querySelector('input[type="range"]');
        const num = row.querySelector('.num');
        return {
          id: row.dataset.id,
          rowBox: getBox(row),
          nameBox: getBox(name),
          sliderBox: getBox(slider),
          numBox: getBox(num),
        };
      });
      results.riggingTab = { rigRows };

      // 4. Tab: Light (Свет)
      const tabLight = document.querySelector('.mtab[data-tab="light"]');
      tabLight.click();
      await new Promise(r => setTimeout(r, 100));

      const searchInp = document.querySelector('.panel-light .search');
      const searchBtn = document.querySelector('.panel-light .search-row .btn');
      const masterTgls = Array.from(document.querySelectorAll('.panel-light .grid-2:first-of-type .tgl')).map(t => ({
        id: t.dataset.id,
        ...getBox(t),
      }));
      const soloBtns = Array.from(document.querySelectorAll('.panel-light .solo')).map(b => ({
        id: b.dataset.id,
        ...getBox(b),
      }));
      const grpSummaries = Array.from(document.querySelectorAll('details.grp summary')).map(s => ({
        text: s.innerText.trim(),
        ...getBox(s),
      }));

      // Open first group to measure chips
      const firstSummary = document.querySelector('details.grp summary');
      if (firstSummary && !firstSummary.parentElement.open) firstSummary.click();
      await new Promise(r => setTimeout(r, 50));

      const chips = Array.from(document.querySelectorAll('.chip')).slice(0, 8).map(c => ({
        text: c.innerText.trim(),
        ...getBox(c),
      }));

      // Portable buttons
      const portableBtns = Array.from(document.querySelectorAll('.panel-light .btn-row .btn')).map(b => ({
        text: b.innerText.trim(),
        ...getBox(b),
      }));

      results.lightTab = {
        searchInp: getBox(searchInp),
        searchBtn: getBox(searchBtn),
        masterTgls,
        soloBtns,
        grpSummaries: grpSummaries.slice(0, 4),
        chips,
        portableBtns,
      };

      // 5. Tab: Views (Виды)
      const tabViews = document.querySelector('.mtab[data-tab="views"]');
      tabViews.click();
      await new Promise(r => setTimeout(r, 100));

      const viewBtns = Array.from(document.querySelectorAll('.grid-2 button.view')).map(b => ({
        text: b.innerText.trim(),
        ...getBox(b),
      }));
      results.viewsTab = { viewBtns };

      // 6. Tab: Layers (Слои)
      const tabLayers = document.querySelector('.mtab[data-tab="layers"]');
      tabLayers.click();
      await new Promise(r => setTimeout(r, 100));

      const layerTgls = Array.from(document.querySelectorAll('.panel-layers .tgl')).map(t => ({
        id: t.dataset.id,
        ...getBox(t),
      }));
      results.layersTab = { layerTgls };

      // 7. Card: Rigging Card
      window.__fest.select({ kind: 'rig', id: 'Sh5' });
      await new Promise(r => setTimeout(r, 100));

      const rigCard = document.querySelector('.card');
      const rigCardClose = rigCard?.querySelector('.x');
      const rigCardBtns = Array.from(rigCard?.querySelectorAll('.card-btns .btn') || []).map(b => ({
        text: b.innerText.trim(),
        ...getBox(b),
      }));
      const rigCardSlider = rigCard?.querySelector('.card-slider input');

      results.rigCard = {
        cardBox: getBox(rigCard),
        closeBtn: getBox(rigCardClose),
        btns: rigCardBtns,
        slider: getBox(rigCardSlider),
      };

      // 8. Card: Fixture Card
      window.__fest.select({ kind: 'fixture', idx: 34 });
      await new Promise(r => setTimeout(r, 100));

      const fxCard = document.querySelector('.card');
      const fxCardClose = fxCard?.querySelector('.x');
      const fxCardTgl = fxCard?.querySelector('.tgl');

      results.fxCard = {
        cardBox: getBox(fxCard),
        scrollHeight: fxCard?.scrollHeight,
        clientHeight: fxCard?.clientHeight,
        closeBtn: getBox(fxCardClose),
        tgl: getBox(fxCardTgl),
      };

      // 9. Toast position vs Card & Sheet
      window.__fest.select({ kind: 'rig', id: 'Sh5' });
      await new Promise(r => setTimeout(r, 100));
      const toast = document.querySelector('.toast');
      results.toast = {
        box: getBox(toast),
        cardBox: getBox(document.querySelector('.card')),
        sheetBox: getBox(document.querySelector('.sheet')),
      };

      // 10. Drag badge position
      const badge = document.querySelector('.drag-badge');
      results.dragBadge = {
        box: getBox(badge),
      };

      // 11. Gestures hint
      const hint = document.querySelector('.mhint');
      results.gestureHint = {
        box: getBox(hint),
        hasHide: hint?.classList.contains('hide'),
      };

      // 12. Landscape specific: check if open sheet covers quick buttons
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        document.body.dataset.sheet = 'open';
        document.querySelector('.sheet').dataset.state = 'open';
        await new Promise(r => setTimeout(r, 200));

        const sheetOpenBox = getBox(document.querySelector('.sheet'));
        const coveredQuickBtns = quickBtns.filter(q => {
          // Check overlap
          const xOverlap = Math.max(0, Math.min(q.x + q.w, sheetOpenBox.x + sheetOpenBox.w) - Math.max(q.x, sheetOpenBox.x));
          const yOverlap = Math.max(0, Math.min(q.y + q.h, sheetOpenBox.y + sheetOpenBox.h) - Math.max(q.y, sheetOpenBox.y));
          return xOverlap > 0 && yOverlap > 0;
        });

        results.landscapeSheetOverlap = {
          sheetOpenBox,
          coveredQuickBtnsCount: coveredQuickBtns.length,
          coveredQuickBtns,
        };
      }

      return results;
    });

    // Take screenshot of metrics state
    await page.screenshot({
      path: `review/r2/ui-mobile/metrics_${cfg.name.replace(/\s+/g, '_')}.jpg`,
      type: 'jpeg',
      quality: 70,
    });

    report[cfg.name] = metrics;
    await context.close();
  }

  await browser.close();
  import('fs').then(fs => fs.writeFileSync('review/r2/ui-mobile/metrics.json', JSON.stringify(report, null, 2)));
  console.log('Metrics saved to review/r2/ui-mobile/metrics.json');
}

checkUiMetrics().catch(console.error);
