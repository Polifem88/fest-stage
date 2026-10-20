// Сборка трёх страниц, каждая — в один самодостаточный html (открывается двойным кликом).
import { build } from 'vite';
import { rmSync, statSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
for (const page of ['index', 'desktop', 'mobile']) {
  process.env.PAGE = page;
  await build({ logLevel: 'warn' });
  const kb = (statSync(`dist/${page}.html`).size / 1024).toFixed(0);
  console.log(`✔ dist/${page}.html  (${kb} КБ)`);
}
