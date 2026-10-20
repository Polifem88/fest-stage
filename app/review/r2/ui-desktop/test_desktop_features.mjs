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

  console.log('=== TEST DESKTOP FEATURES & NEW FIXES ===');

  // 1. Undo "Всё вниз" / "Всё вверх"
  console.log('--- 1. Testing Undo "Всё вниз" ---');
  await page.evaluate(() => window.__fest.setHeight('Sh5', 2.0));
  const beforeDown = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Sh5 before "Всё вниз":', beforeDown);

  await page.click('button:has-text("⤓ Всё вниз")');
  await page.waitForTimeout(100);

  const afterDown = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Sh5 immediately after "Всё вниз":', afterDown);

  const toastAction = page.locator('.toast button.toast-btn');
  console.log('Toast undo button exists:', await toastAction.count());
  const toastText = await page.evaluate(() => document.querySelector('.toast')?.textContent);
  console.log('Toast text:', toastText);
  await page.screenshot({ path: `${OUT_DIR}/14_toast_all_down_undo.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  await toastAction.click();
  await page.waitForTimeout(150);

  const afterUndo = await page.evaluate(() => window.__fest.height('Sh5'));
  console.log('Sh5 after clicking "↺ Отменить":', afterUndo);
  console.log('Did undo restore height?', Math.abs(afterUndo - beforeDown) < 0.01);

  // 2. Help Modal (Esc, Backdrop click)
  console.log('--- 2. Testing Help Modal ---');
  const helpBtn = page.locator('.topbar button[title="Подсказка по управлению"]');
  await helpBtn.click();
  await page.waitForTimeout(150);

  const helpInfo = await page.evaluate(() => {
    const h = document.querySelector('.help');
    const b = document.querySelector('.backdrop');
    const rect = h?.getBoundingClientRect();
    return {
      hidden: h?.hidden,
      role: h?.getAttribute('role'),
      ariaModal: h?.getAttribute('aria-modal'),
      rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
      backdropHidden: b?.hidden,
      activeElement: document.activeElement?.textContent
    };
  });
  console.log('Help modal state after opening:', helpInfo);
  await page.screenshot({ path: `${OUT_DIR}/15_help_modal_centered.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Test close via Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const helpHiddenAfterEsc = await page.evaluate(() => document.querySelector('.help')?.hidden);
  console.log('Is help hidden after Escape?', helpHiddenAfterEsc);

  // Re-open and test close via backdrop click
  await helpBtn.click();
  await page.waitForTimeout(100);
  await page.mouse.click(100, 100);
  await page.waitForTimeout(100);
  const helpHiddenAfterBackdrop = await page.evaluate(() => document.querySelector('.help')?.hidden);
  console.log('Is help hidden after backdrop click?', helpHiddenAfterBackdrop);

  // 3. Tab Keyboard Navigation (ArrowLeft / ArrowRight)
  console.log('--- 3. Testing Tablist Arrow Navigation ---');
  await page.focus('button[data-tab="rig"]');
  await page.waitForTimeout(50);
  console.log('Initial focused tab:', await page.evaluate(() => document.activeElement?.textContent));

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const activeTab1 = await page.evaluate(() => {
    const onTab = document.querySelector('.tab.on');
    return { id: onTab?.dataset.tab, text: onTab?.textContent, focused: document.activeElement === onTab };
  });
  console.log('Active tab after ArrowRight:', activeTab1);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const activeTab2 = await page.evaluate(() => {
    const onTab = document.querySelector('.tab.on');
    return { id: onTab?.dataset.tab, text: onTab?.textContent, focused: document.activeElement === onTab };
  });
  console.log('Active tab after second ArrowRight:', activeTab2);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const activeTab3 = await page.evaluate(() => {
    const onTab = document.querySelector('.tab.on');
    return { id: onTab?.dataset.tab, text: onTab?.textContent, focused: document.activeElement === onTab };
  });
  console.log('Active tab after third ArrowRight:', activeTab3);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const activeTab4 = await page.evaluate(() => {
    const onTab = document.querySelector('.tab.on');
    return { id: onTab?.dataset.tab, text: onTab?.textContent, focused: document.activeElement === onTab };
  });
  console.log('Active tab after fourth ArrowRight (wrap):', activeTab4);

  // 4. Check :focus-visible styling
  console.log('--- 4. Testing :focus-visible styling ---');
  await page.focus('.topbar button:has-text("📷 PNG")');
  await page.waitForTimeout(50);
  const focusOutline = await page.evaluate(() => {
    const b = document.activeElement;
    const style = window.getComputedStyle(b);
    return {
      tag: b.tagName,
      text: b.textContent,
      outline: style.outline,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset
    };
  });
  console.log('Focus outline on focused button:', focusOutline);
  await page.screenshot({ path: `${OUT_DIR}/16_focus_visible.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // 5. Group tooltips in Light Panel
  console.log('--- 5. Testing Light Group Tooltips ---');
  await page.click('button[data-tab="light"]');
  await page.waitForTimeout(100);
  const groupTooltips = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.groups .grp-cell'));
    return cells.map(c => {
      const tgl = c.querySelector('.tgl');
      const solo = c.querySelector('.solo');
      return {
        lbl: tgl?.querySelector('.lbl')?.textContent,
        title: tgl?.title,
        soloTitle: solo?.title
      };
    });
  });
  console.log('Light group tooltips count:', groupTooltips.length);
  console.log('Sample group tooltip (C2):', groupTooltips[2]);

  // 6. Laptop Screen 1366x768
  console.log('--- 6. Testing Laptop Screen 1366x768 ---');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);

  // Check panel widths
  const laptopLayout = await page.evaluate(() => {
    const side = document.querySelector('aside.side');
    const card = document.querySelector('.card');
    const topbar = document.querySelector('.topbar');
    const brand = document.querySelector('.brand span');
    const topSearch = document.querySelector('.top-search');
    return {
      sideWidth: side ? window.getComputedStyle(side).width : null,
      cardWidth: card ? window.getComputedStyle(card).width : null,
      brandSpanDisplay: brand ? window.getComputedStyle(brand).display : null,
      topSearchDisplay: topSearch ? window.getComputedStyle(topSearch).display : null,
      topbarScrollWidth: topbar?.scrollWidth,
      topbarClientWidth: topbar?.clientWidth,
      isTopbarOverflowing: topbar ? topbar.scrollWidth > topbar.clientWidth : null
    };
  });
  console.log('Laptop 1366x768 layout measurements:', laptopLayout);

  // Check group buttons in Light panel on 1366x768
  const laptopGroups = await page.evaluate(() => {
    const grps = Array.from(document.querySelectorAll('.groups .grp-cell'));
    return grps.map(g => {
      const lbl = g.querySelector('.lbl');
      const tgl = g.querySelector('.tgl');
      const solo = g.querySelector('.solo');
      return {
        text: lbl?.textContent,
        tglW: tgl?.clientWidth,
        soloW: solo?.clientWidth,
        lblScrollW: lbl?.scrollWidth,
        lblClientW: lbl?.clientWidth,
        isClipped: lbl ? lbl.scrollWidth > lbl.clientWidth : false
      };
    });
  });
  console.log('Laptop light groups clipped count:', laptopGroups.filter(g => g.isClipped).length);

  // Screenshot on laptop
  await page.screenshot({ path: `${OUT_DIR}/17_laptop_1366x768_light.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  // Open help on laptop to see modal fit
  await page.click('.topbar button[title="Подсказка по управлению"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT_DIR}/18_laptop_1366x768_help.jpg`, type: 'jpeg', quality: 70, scale: 'css' });

  await browser.close();
  console.log('=== TEST DESKTOP FEATURES FINISHED ===');
}

run().catch(console.error);
