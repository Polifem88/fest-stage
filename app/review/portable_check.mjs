import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5173/desktop.html');
await p.waitForFunction(() => window.__fest?.ready, null, { timeout: 60000 });
await p.getByRole('tab', { name: /Свет/ }).click().catch(async () => { await p.getByText('Свет', { exact: false }).first().click(); });
await p.getByRole('button', { name: 'На штативах' }).click();
await p.getByRole('button', { name: '6 шт.' }).click();
const st = await p.evaluate(() => {
  const s = window.__fest.stage;
  return { portable: s.fixtures.portable, visible: s.fixtures.list.filter((f) => f.portable && !f.hidden).map((f) => f.no), url: s.shareUrl(), stage: s.stageState() };
});
console.log(JSON.stringify({ portable: st.portable, visible: st.visible, stage: st.stage }));
const chipsShown = await p.locator('.chip:not([hidden])', { hasText: /^Н\d$/ }).count();
console.log('chips shown', chipsShown);
// ссылка восстанавливает режим
const p2 = await b.newPage();
await p2.goto(st.url);
await p2.waitForFunction(() => window.__fest?.ready, null, { timeout: 60000 });
await p2.waitForTimeout(500);
console.log('restored', JSON.stringify(await p2.evaluate(() => window.__fest.stage.fixtures.portable)));
await p.getByRole('button', { name: 'Нет' }).click();
console.log('after off', JSON.stringify(await p.evaluate(() => ({ m: window.__fest.stage.fixtures.portable, st: window.__fest.stage.stageState() }))));
console.log(errs.length ? errs.join('\n') : 'no errors');
await b.close();
