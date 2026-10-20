import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:5173/desktop.html');
  await page.waitForFunction(() => window.__fest?.ready);

  console.log('=== Keyboard Navigation & Accessibility Audit ===');

  // 1. Focus order and active element when pressing Tab
  const focusedElements = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const el = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return {
        tag: a.tagName,
        class: a.className,
        text: (a.textContent || '').trim().slice(0, 30),
        ariaLabel: a.getAttribute('aria-label'),
        role: a.getAttribute('role'),
        type: a.getAttribute('type'),
        outline: window.getComputedStyle(a).outline
      };
    });
    if (el) focusedElements.push(el);
  }
  console.log('First 25 focused elements:');
  focusedElements.forEach((f, idx) => console.log(`${idx + 1}. <${f.tag}> .${f.class} [${f.text}] aria=${f.ariaLabel} role=${f.role}`));

  // 2. Check if tabs in side panel can be switched via keyboard
  // WAI-ARIA tablist: ArrowLeft/ArrowRight to switch tabs
  const tablist = page.locator('div[role="tablist"]');
  console.log('Tablist exists:', await tablist.count());
  // Focus on first tab
  await page.locator('button.tab[data-tab="rig"]').focus();
  // Try ArrowRight
  await page.keyboard.press('ArrowRight');
  const activeTabAfterArrow = await page.evaluate(() => {
    const on = document.querySelector('button.tab.on');
    return on ? on.getAttribute('data-tab') : null;
  });
  console.log('Active tab after pressing ArrowRight (WAI-ARIA pattern):', activeTabAfterArrow);

  // 3. Contrast check for muted text
  // --muted: #9aa3b2 on --bg: #0b0d11 or --panel: rgba(20,23,30,0.94)
  // Contrast ratio:
  // #9aa3b2 = rgb(154, 163, 178)
  // #14171e = rgb(20, 23, 30)
  // Let's compute exact contrast ratio in browser
  const contrast = await page.evaluate(() => {
    function lum(r, g, b) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    const L1 = lum(154, 163, 178); // --muted #9aa3b2
    const L2 = lum(20, 23, 30);    // --panel
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    // Also check legend / unit text / status
    const Lunit = lum(154, 163, 178);
    const LinputBg = lum(17, 20, 26);
    const ratioInput = (Math.max(Lunit, LinputBg) + 0.05) / (Math.min(Lunit, LinputBg) + 0.05);

    return { panelToMutedRatio: +ratio.toFixed(2), inputToMutedRatio: +ratioInput.toFixed(2) };
  });
  console.log('Contrast ratios:', contrast);

  // 4. Check focus outlines: is outline visible?
  const outlineStyles = await page.evaluate(() => {
    const btn = document.querySelector('.btn');
    const tgl = document.querySelector('.tgl');
    const tab = document.querySelector('.tab');
    const num = document.querySelector('.num');
    return {
      btnOutline: window.getComputedStyle(btn).outline,
      tglOutline: window.getComputedStyle(tgl).outline,
      tabOutline: window.getComputedStyle(tab).outline,
      numOutline: window.getComputedStyle(num).outline,
    };
  });
  console.log('Focus outline styles:', outlineStyles);

  await browser.close();
}

run();
