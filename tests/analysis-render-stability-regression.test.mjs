import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

const files = {
  intent: 'app/src/main/assets/apps/mapping/js/market-intent-ui.js',
  live: 'app/src/main/assets/apps/mapping/js/live-price-display-only-v1.js',
  stable: 'app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js',
  dom: 'app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js',
  consistency: 'app/src/main/assets/apps/mapping/js/mapping-live-consistency-v1.js',
  candles: 'app/src/main/assets/apps/mapping/js/candle-refresh-coordinator.js'
};

test('analysis render stability runtimes are valid JavaScript', () => {
  Object.values(files).forEach(relative => {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${relative}\n${result.stderr || result.stdout}`);
  });
});

test('Ringkasan Market is closed-candle driven and excludes live price from its signature', async () => {
  const source = await read(files.intent);
  const signatureStart = source.indexOf('function renderSignature(');
  const signatureEnd = source.indexOf('export function syncMarketIntentV3()', signatureStart);
  const signature = source.slice(signatureStart, signatureEnd);
  assert.match(source, /function closedCandlePrice/);
  assert.match(source, /function closedCandleFingerprint/);
  assert.match(signature, /m15:\s*closedCandleFingerprint/);
  assert.doesNotMatch(signature, /state\.price|result\?\.price|live/i);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /current\.outerHTML\s*=/);
});

test('ready Ringkasan Market is not replaced by a transient loading state', async () => {
  const source = await read(files.intent);
  assert.match(source, /current\?\.dataset\.marketIntentReady === 'true' && !ready/);
  assert.match(source, /MEMPERBARUI CANDLE/);
  assert.match(source, /return false/);
});

test('execution plan and other semantic live-price fields receive the same WebSocket price', async () => {
  const source = await read(files.live);
  assert.match(source, /LIVE_LABEL_PATTERN = \/\^harga/);
  assert.match(source, /Harga saat ini|saat\\s\+ini/i);
  assert.match(source, /markSemanticLivePriceNodes/);
  assert.match(source, /data-live-price/);
  assert.match(source, /amyfx:market-intent-rendered/);
  assert.match(source, /amyfx:mapping-ui-rendered/);
  assert.doesNotMatch(source, /window\.render\s*\(/);
  assert.doesNotMatch(source, /runAnalysis\s*\(/);
});

test('Analyze stability layer does not remove and reinsert Market Intent content', async () => {
  const source = await read(files.stable);
  assert.match(source, /ensureMarketContextDisclosure/);
  assert.match(source, /amyfx:market-intent-rendered/);
  assert.doesNotMatch(source, /removeHistoricalReliability/);
  assert.doesNotMatch(source, /Performa Historis Model.*remove/s);
  assert.doesNotMatch(source, /RELIABILITAS HISTORIS.*remove/s);
});

test('only same-view renders are patched while Dashboard and Analyze use separate roots', async () => {
  const source = await read(files.dom);
  assert.match(source, /lastAppView && lastAppView !== view/);
  assert.match(source, /nativeInnerHtml\.set\.call\(this, markup\)/);
  assert.match(source, /patchSameViewApp/);
});

test('Mapping refresh uses one exact closed-candle coordinator without periodic polling', async () => {
  const [consistency, candles] = await Promise.all([
    read(files.consistency),
    read(files.candles)
  ]);
  assert.match(consistency, /amyfx:candle-refresh-request/);
  assert.doesNotMatch(consistency, /setInterval\s*\(/);
  assert.match(candles, /nextBoundaryMs/);
  assert.match(candles, /scheduled-close/);
  assert.match(candles, /AbortController/);
  assert.match(candles, /pagehide/);
  assert.match(candles, /pageshow/);
});
