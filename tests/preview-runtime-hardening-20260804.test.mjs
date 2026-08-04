import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sanitizeMarketPayload
} from '../app/src/main/assets/apps/mapping/js/api/closed-candle-response-sanitizer.js';
import {
  mappingRefreshDependencies
} from '../app/src/main/assets/apps/mapping/js/engine/mapping-refresh-dependencies.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(`${root}/${path}`, 'utf8');

test('closed-candle sanitizer removes synthetic and duplicate timestamps before engine input', () => {
  const payload = {
    status: 'ok',
    clientCompatibility: 'CLOSED_SERIES_SENTINEL_V1',
    values: [
      { datetime: '2026-08-04T08:15:00Z', open: '1', high: '2', low: '0', close: '1.5', amyfxSyntheticCurrent: true },
      { datetime: '2026-08-04T08:15:00Z', open: '1', high: '2', low: '0', close: '1.5' },
      { datetime: '2026-08-04T08:15:00Z', open: '9', high: '9', low: '9', close: '9' },
      { datetime: '2026-08-04T08:14:00Z', open: '2', high: '3', low: '1', close: '2.5' }
    ]
  };

  const sanitized = sanitizeMarketPayload(payload);
  assert.equal(sanitized.values.length, 2);
  assert.equal(sanitized.values[0].datetime, '2026-08-04T08:15:00Z');
  assert.equal(sanitized.values[0].close, '1.5');
  assert.equal(sanitized.values[1].datetime, '2026-08-04T08:14:00Z');
  assert.equal(sanitized.clientCompatibility, undefined);
  assert.equal(sanitized.amyfxRemovedDuplicateCount, 2);
  assert.ok(sanitized.values.every(value => value.amyfxSyntheticCurrent !== true));
});

test('Mapping refresh dependency graph includes source and required HTF context without duplicates', () => {
  assert.deepEqual(mappingRefreshDependencies('M15'), ['M15', 'M30', 'H1', 'H4', 'D1', 'W1']);
  assert.deepEqual(mappingRefreshDependencies('H4'), ['H4', 'D1', 'W1']);
  assert.deepEqual(mappingRefreshDependencies('W1'), ['W1']);
  assert.equal(new Set(mappingRefreshDependencies('M1')).size, mappingRefreshDependencies('M1').length);
});

test('live price display no longer suppresses the authoritative WebSocket listener', () => {
  const source = read('app/src/main/assets/apps/mapping/js/live-price-display-only-v1.js');
  assert.doesNotMatch(source, /stopImmediatePropagation/);
  assert.match(source, /authoritative market-data listener/);
  assert.match(source, /version: '2\.0\.0'/);
});

test('Mapping page loads candle sanitizer before main runtime', () => {
  const index = read('app/src/main/assets/apps/mapping/index.html');
  const sanitizerPosition = index.indexOf('js/api/closed-candle-response-sanitizer.js');
  const mainPosition = index.indexOf('js/main.js');
  assert.ok(sanitizerPosition >= 0);
  assert.ok(mainPosition > sanitizerPosition);
});

test('Mapping runtime owns and tears down timers and listeners', () => {
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const stability = read('app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js');
  assert.match(main, /livePriceWatchdogTimer = setInterval/);
  assert.match(main, /clearInterval\(livePriceWatchdogTimer\)/);
  assert.match(main, /removeEventListener\?\.\('online', handleOnline\)/);
  assert.match(main, /removeEventListener\?\.\('visibilitychange', handleVisibilityChange\)/);
  assert.match(main, /stopLivePrice\(\)/);
  assert.match(main, /AmyFXMappingRuntimeLifecycle/);
  assert.match(stability, /observer\?\.disconnect\(\)/);
  assert.match(stability, /lifecycleController\?\.abort\(\)/);
  assert.match(stability, /amyfx:mapping-ui-rendered/);
});

test('legacy Mapping sync bridge owns every timer and stops outside a real browser lifecycle', () => {
  const syncFix = read('app/src/main/assets/apps/mapping/js/bridge/sync-fix.js');
  assert.match(syncFix, /const hasBrowserLifecycle=/);
  assert.match(syncFix, /typeof window\.setTimeout==='function'/);
  assert.match(syncFix, /if\(!hasBrowserLifecycle\)return/);
  assert.match(syncFix, /const pendingTimers=new Set\(\)/);
  assert.match(syncFix, /clockTimer=window\.setInterval\(syncClock,1000\)/);
  assert.match(syncFix, /window\.clearInterval\(clockTimer\)/);
  assert.match(syncFix, /window\.addEventListener\('pagehide',stop,\{once:true\}\)/);
  assert.match(syncFix, /AmyFXSyncFixLifecycle/);
  assert.match(syncFix, /Asia\/Makassar/);
  assert.match(syncFix, /WITA/);
});

test('notification guard scans native bridges only in a real browser and tears down cleanly', () => {
  const guard = read('app/src/main/assets/apps/mapping/js/bridge/notify-guard.js');
  assert.match(guard, /const hasBrowserLifecycle=/);
  assert.match(guard, /if\(!hasBrowserLifecycle\)return/);
  assert.match(guard, /bridgeScanTimer=window\.setInterval\(wrapAll,1500\)/);
  assert.match(guard, /window\.clearInterval\(bridgeScanTimer\)/);
  assert.match(guard, /window\.addEventListener\('pagehide',stop,\{once:true\}\)/);
  assert.match(guard, /AmyFXNotifyGuardLifecycle/);
});

test('regression runner does not force successful process exit with leaked handles', () => {
  const runner = read('tools/run-tests-sequential.mjs');
  assert.doesNotMatch(runner, /--test-force-exit/);
  assert.match(runner, /timeout: testTimeoutMs/);
  assert.match(runner, /ETIMEDOUT/);
});
