import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app/src/main/assets/apps/mapping/index.html', 'utf8');
const runtime = fs.readFileSync('app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js', 'utf8');
const coordinator = fs.readFileSync('app/src/main/assets/apps/mapping/js/api-request-coordinator.js', 'utf8');
const candleCoordinator = fs.readFileSync('app/src/main/assets/apps/mapping/js/candle-refresh-coordinator.js', 'utf8');
const scannerGate = fs.readFileSync('app/src/main/assets/apps/mapping/js/scanner-visibility-gate.js', 'utf8');
const stability = fs.readFileSync('app/src/main/assets/apps/mapping/js/view-stability.js', 'utf8');

test('request and candle coordinators load before Entry Watch', () => {
  const requestPosition = index.indexOf('js/api-request-coordinator.js');
  const mainPosition = index.indexOf('js/main.js');
  const candlePosition = index.indexOf('js/candle-refresh-coordinator.js');
  const entryWatchPosition = index.indexOf('js/entry-watch-runtime-v2.js');
  assert.ok(requestPosition >= 0);
  assert.ok(mainPosition > requestPosition);
  assert.ok(candlePosition > mainPosition);
  assert.ok(entryWatchPosition > candlePosition);
});

test('Entry Watch consumes shared Mapping candles without a second API fetcher', () => {
  assert.equal(runtime.includes('fetchClosedCandles'), false);
  assert.equal(runtime.includes('PROXY_URL'), false);
  assert.equal(runtime.includes('CANDLE_REFRESH_MS'), false);
  assert.equal(runtime.includes('fetch('), false);
  assert.match(runtime, /candlesByTf:\s*state\.candles/);
});

test('shared candle coordinator refreshes only closed watch timeframes', () => {
  assert.equal(candleCoordinator.includes('PROXY_URL'), false);
  assert.equal(candleCoordinator.includes('fetch('), false);
  assert.match(candleCoordinator, /import \{ fetchTf \}/);
  assert.match(candleCoordinator, /watch\.triggerTf/);
  assert.match(candleCoordinator, /watch\.sourceTf/);
  assert.match(candleCoordinator, /expectedClosedOpenTime/);
  assert.match(candleCoordinator, /amyfx:candles-updated/);
});

test('native scanner is gated to background visibility', () => {
  assert.ok(index.includes('js/scanner-visibility-gate.js'));
  assert.match(scannerGate, /document\.hidden/);
  assert.match(scannerGate, /stopBackgroundScanner/);
  assert.match(scannerGate, /startBackgroundScanner/);
  assert.match(scannerGate, /amyfx:entry-watch-updated/);
});

test('analysis view has scroll stability protection', () => {
  assert.ok(index.includes('js/view-stability.js'));
  assert.match(stability, /MutationObserver/);
  assert.match(stability, /window\.scrollTo/);
});

test('Twelve Data requests are deduplicated and cached', () => {
  assert.match(coordinator, /const inFlight = new Map/);
  assert.match(coordinator, /const responseCache = new Map/);
  assert.match(coordinator, /const intervalSnapshots = new Map/);
  assert.match(coordinator, /LIVE_TTL_MS = 90_000/);
  assert.match(coordinator, /snapshotResponse/);
  assert.match(coordinator, /window\.fetch = coordinatedFetch/);
});
