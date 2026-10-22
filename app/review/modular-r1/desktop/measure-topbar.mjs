import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const desktopUrl = pathToFileURL(path.resolve('dist/desktop.html')).href;
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(desktopUrl);
await page.waitForFunction(() => window.__fest?.ready);

const widths = await page.evaluate(() => {
  const top = document.querySelector('.topbar');
  const items = [...top.children].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      className: el.className,
      rect: { left: rect.left, right: rect.right, width: rect.width },
      scrollWidth: el.scrollWidth,
      children: [...el.children].map((c) => ({
        className: c.className,
        width: c.getBoundingClientRect().width,
        text: c.innerText?.trim(),
      })),
    };
  });
  const actions = document.querySelector('.top-actions');
  const actionItems = [...actions.children].map((c) => ({
    className: c.className,
    text: c.innerText?.trim(),
    rect: c.getBoundingClientRect(),
  }));

  return {
    topbar: { clientWidth: top.clientWidth, scrollWidth: top.scrollWidth },
    items,
    actionItems,
  };
});

console.log(JSON.stringify(widths, null, 2));
await browser.close();
