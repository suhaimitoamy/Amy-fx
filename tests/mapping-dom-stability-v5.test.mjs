import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const runtimePath = 'app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js';

test('stable DOM renderer is valid JavaScript and loads before Mapping data modules', async () => {
  execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'pipe' });
  const main = await read('app/src/main/assets/apps/mapping/js/main.js');
  const stablePosition = main.indexOf('./ui/dom-stable-render.js');
  const marketPosition = main.indexOf('./api/market-data.js');
  assert.ok(stablePosition >= 0);
  assert.ok(marketPosition > stablePosition);
});

test('same-view Mapping updates patch existing DOM instead of replacing the app root', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /this\.id !== 'app'/);
  assert.match(runtime, /patchSameViewApp/);
  assert.match(runtime, /patchNode\(current, nextNode\)/);
  assert.match(runtime, /current\.hasAttribute\('data-dom-persistent'\)/);
  assert.match(runtime, /next\.hasAttribute\('data-dom-persistent'\)/);
  assert.doesNotMatch(runtime, /lastAppView !== view[\s\S]*nativeInnerHtml\.set/);
  assert.doesNotMatch(runtime, /window\.scrollTo|window\.scrollBy/);
});

test('Market Regime card keeps its element identity during live refresh', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /REGIME_CARD_ID = 'amy-regime-router-v3'/);
  assert.match(runtime, /Object\.defineProperty\(Element\.prototype, 'outerHTML'/);
  assert.match(runtime, /patchNode\(this, next\)/);
  assert.match(runtime, /keepOpen/);
});
