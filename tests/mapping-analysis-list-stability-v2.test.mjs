import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const runtimePath = 'app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js';
const cssPath = 'app/src/main/assets/apps/mapping/css/analysis-list-polish-v1.css';
const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const renderPath = 'app/src/main/assets/apps/mapping/js/ui/ui-render.js';

test('stable Mapping renderer is valid JavaScript and removes unused duplicate top-level cards', async () => {
  execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'pipe' });
  const runtime = await read(runtimePath);
  assert.match(runtime, /const pools = new Map\(\)/);
  assert.match(runtime, /const used = new Set\(\)/);
  assert.match(runtime, /!used\.has\(node\) && node\.parentNode === app/);
  assert.match(runtime, /removedDuplicateNodes \+= 1/);
  assert.doesNotMatch(runtime, /scrollTo|scrollBy/);
});

test('analysis source contains one canonical disclosure for every approved card', async () => {
  const render = await read(renderPath);
  for (const title of ['Valid Break', 'Mapping Semua Timeframe', 'Penjelasan Mapping', 'Setup Aktif']) {
    const matches = render.match(new RegExp(`<summary>${title.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'g')) || [];
    assert.equal(matches.length, 1, `${title} must have exactly one canonical source card`);
  }
});

test('Mapping loads scoped analysis polish after the blueprint stylesheet', async () => {
  const html = await read(indexPath);
  const blueprint = html.indexOf('../shared/amyfx-blueprint-v1.css');
  const polish = html.indexOf('css/analysis-list-polish-v1.css');
  assert.ok(blueprint >= 0);
  assert.ok(polish > blueprint);
});

test('two-item Mapping navigation uses balanced columns and a compact active marker', async () => {
  const css = await read(cssPath);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.nav button\.active::after/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /#app > details\.disclosure/);
});
