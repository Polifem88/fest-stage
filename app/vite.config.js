import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// В режиме разработки (npm run dev) доступны все три страницы.
// Для сборки (npm run build) scripts/build.mjs вызывает Vite по разу на каждую
// страницу с переменной PAGE, чтобы каждая собралась в ОДИН самодостаточный html-файл.
const page = process.env.PAGE;

export default defineConfig({
  base: './',
  // review/ — снимки и отчёты проверок; не следим, иначе сервер падает на занятых файлах (EBUSY)
  server: { host: true, port: 5173, watch: { ignored: ['**/review/**', '**/dist/**', '**/test-results/**'] } },
  plugins: page ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
  build: page
    ? {
        outDir: 'dist',
        emptyOutDir: false,
        assetsInlineLimit: 100_000_000,
        chunkSizeWarningLimit: 5000,
        rollupOptions: { input: resolve(__dirname, `${page}.html`) },
      }
    : {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'index.html'),
            desktop: resolve(__dirname, 'desktop.html'),
            mobile: resolve(__dirname, 'mobile.html'),
          },
        },
      },
  test: { include: ['tests/unit/**/*.test.js'] },
});
