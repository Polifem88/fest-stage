import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5173/desktop.html');
await p.waitForFunction(() => window.__fest?.ready, null, { timeout: 60000 });
for (const no of ['УФ-Л', 'П', 17, 20, 201, 187]) {
  const r = await p.evaluate((no) => { window.__fest.selectFixture(no); return window.__fest.describe(); }, no);
  console.log(no, JSON.stringify(r?.rows ?? r));
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
