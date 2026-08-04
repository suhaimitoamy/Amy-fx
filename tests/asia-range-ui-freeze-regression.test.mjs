import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const uiUrl = new URL('../app/src/main/assets/apps/mapping/js/session/asia-range-ui.js', import.meta.url);

function source() {
  return readFileSync(uiUrl, 'utf8');
}

test('Asia range UI module remains syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(uiUrl)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('MutationObserver queues a bounded top-level sync instead of calling renderer directly', () => {
  const code = source();
  assert.match(code, /observer = new MutationObserver\(scheduleAsiaRangeSync\)/);
  assert.match(code, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.doesNotMatch(code, /new MutationObserver\(\(\) => syncAsiaRangeUi\(\)\)/);
  assert.match(code, /if \(syncQueued\) return;/);
});

test('Asia range markup is only written when content changes', () => {
  const code = source();
  assert.match(code, /const renderedMarkup = new WeakMap\(\)/);
  assert.match(code, /renderedMarkup\.get\(element\) === markup/);
  assert.match(code, /setMarkupIfChanged\(block, dashboardMarkup\(range\)\)/);
  assert.match(code, /setMarkupIfChanged\(strip, analyzeMarkup\(range\)\)/);
  assert.doesNotMatch(code, /block\.innerHTML = dashboardMarkup\(range\)/);
  assert.doesNotMatch(code, /strip\.innerHTML = analyzeMarkup\(range\)/);
});

test('Asia range follows live price, closed candles, render events, and exact session boundaries without polling', () => {
  const code = source();
  assert.match(code, /nextAsiaSessionBoundary/);
  assert.match(code, /amyfx:live-price-display/);
  assert.match(code, /amyfx:candles-updated/);
  assert.match(code, /amyfx:mapping-ui-rendered/);
  assert.match(code, /amyfx:mapping-state-change/);
  assert.match(code, /boundaryTimer = setTimeout/);
  assert.doesNotMatch(code, /setInterval/);
});

test('Asia range UI owns and tears down its observer, timer, and event listeners', () => {
  const code = source();
  assert.match(code, /observer\?\.disconnect\(\)/);
  assert.match(code, /lifecycleController\?\.abort\(\)/);
  assert.match(code, /clearTimeout\(boundaryTimer\)/);
  assert.match(code, /window\.addEventListener\('pagehide', stop/);
  assert.match(code, /AmyFXAsiaRangeUiLifecycle/);
});
