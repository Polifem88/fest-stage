// Границы модулей: общий код не знает о конкретных сценах (правило GEMINI.md §1).
//  • engine/, systems/, core/, ui/, library/, export/ обращаются к площадкам только через
//    venues/registry.js или venues/catalog.js;
//  • площадка не импортирует другую площадку (кроме общего шаблона venues/_template/);
//  • library/ и core/ не зависят от движка и интерфейса;
//  • в общем коде нет названий и id конкретных сцен.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { CATALOG } from '../../src/venues/catalog.js';

const SRC = resolve(__dirname, '../../src');
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.js')) files.push(p);
  }
})(SRC);

const rel = (p) => relative(SRC, p).split(sep).join('/');
const top = (p) => rel(p).split('/')[0];
/** Все относительные импорты файла → пути от src/. */
function imports(file) {
  const t = readFileSync(file, 'utf8');
  const out = [];
  for (const m of t.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const spec = m[1] || m[2];
    out.push(rel(resolve(dirname(file), spec)));
  }
  return out;
}

const SHARED = ['engine', 'systems', 'core', 'ui', 'library', 'export'];
const VENUE_GATES = ['venues/registry.js', 'venues/catalog.js'];

describe('Границы модулей', () => {
  it('общий код обращается к площадкам только через реестр/каталог', () => {
    const bad = [];
    for (const f of files.filter((f) => SHARED.includes(top(f)))) {
      for (const i of imports(f)) if (i.startsWith('venues/') && !VENUE_GATES.includes(i)) bad.push(`${rel(f)} → ${i}`);
    }
    expect(bad).toEqual([]);
  });

  it('площадка не импортирует другую площадку (общий шаблон — можно)', () => {
    const bad = [];
    for (const f of files.filter((f) => /^venues\/[^/]+\//.test(rel(f)))) {
      const own = rel(f).split('/')[1];
      for (const i of imports(f)) {
        const m = i.match(/^venues\/([^/]+)\//);
        if (m && m[1] !== own && m[1] !== '_template') bad.push(`${rel(f)} → ${i}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('library/ и core/ не зависят от движка, интерфейса и площадок', () => {
    const bad = [];
    for (const f of files.filter((f) => ['library', 'core'].includes(top(f)))) {
      for (const i of imports(f)) if (/^(engine|ui|systems|venues)\//.test(i)) bad.push(`${rel(f)} → ${i}`);
    }
    expect(bad).toEqual([]);
  });

  it('в общем коде нет названий и id конкретных сцен', () => {
    const NAMES = /Большая сцена|Камерная|БОЛЬШАЯ СЦЕНА|'flyGallery'|'planStage'|'Sh\d+'|'C[0-3]'|GAL_LAMP/;
    const bad = [];
    for (const f of files.filter((f) => ['engine', 'systems', 'ui', 'library', 'export'].includes(top(f)))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
        if (/^(\/\/|\/\*|\*)/.test(line.trim())) return; // комментарии — можно
        if (NAMES.test(line)) bad.push(`${rel(f)}:${n + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('в движке, системах, ядре, справочнике и экспорте нет id площадок', () => {
    const ids = new RegExp(`['"\`](${CATALOG.map((v) => v.id).join('|')})['"\`]`);
    const bad = [];
    for (const f of files.filter((f) => ['engine', 'systems', 'core', 'library', 'export'].includes(top(f)))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
        if (/^(\/\/|\/\*|\*)/.test(line.trim())) return;
        if (ids.test(line)) bad.push(`${rel(f)}:${n + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
