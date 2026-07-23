import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app/src/main/assets/apps/mapping/index.html', 'utf8');
const runtime = fs.readFileSync('app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js', 'utf8');
const coordinator = fs.readFileSync('app/src/main/assets/apps/mapping/js/api-request-coordinator.js', 'utf8');
const stability = fs.readFileSync('app/src/main/assets/apps/mapping/js/view-stability.js', 'utf8');

test('request coordinator loads before Mapping modules', () => {
  const coordinatorPosition = index.indexOf('js/api-request-coordinator.js');
  const mainPosition = index.indexOf('js/main.js');
  assert.ok(coordinatorPosition >= 0);
  assert.ok(mainPosition > coordinatorPosition);
});

test('Entry Watch consumes shared Mapping candles without a second API fetcher', () => {
  assert.equal(runtime.includes('fetchClosedCandles'), false);
  assert.equal(runtime.includes('PROXY_URL'), false);
  assert.equal(runtime.includes('CANDLE_REFRESH_MS'), false);
  assert.equal(runtime.includes('fetch('), false);
  assert.match(runtime, /candlesByTf:\s*state\.candles/);
});

test('analysis view has scroll stability protection', () => {
  assert.ok(index.includes('js/view-stability.js'));
  assert.match(stability, /MutationObserver/);
  assert.match(stability, /window\.scrollTo/);
});

test('Twelve Data requests are deduplicated and cached', () => {
  assert.match(coordinator, /const inFlight = new Map/);
  assert.match(coordinator, /const responseCache = new Map/);
  assert.match(coordinator, /outputsize <= 2/);
  assert.match(coordinator, /window\.fetch = coordinatedFetch/);
});
