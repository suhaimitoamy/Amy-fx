import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const runtimePath = 'app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js';
const coordinatorPath = 'app/src/main/assets/apps/mapping/js/api-request-coordinator.js';
const candleCoordinatorPath = 'app/src/main/assets/apps/mapping/js/candle-refresh-coordinator.js';
const timeframePath = 'app/src/main/assets/apps/mapping/js/engine/mapping-timeframes.js';
const scannerGatePath = 'app/src/main/assets/apps/mapping/js/scanner-visibility-gate.js';
const stabilityPath = 'app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js';
const backendPath = 'api/twelvedata.js';
const scannerServicePath = 'app/src/main/java/com/amyelitesuite/ScannerService.kt';

const index = fs.readFileSync(indexPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const coordinator = fs.readFileSync(coordinatorPath, 'utf8');
const candleCoordinator = fs.readFileSync(candleCoordinatorPath, 'utf8');
const timeframe = fs.readFileSync(timeframePath, 'utf8');
const scannerGate = fs.readFileSync(scannerGatePath, 'utf8');
const stability = fs.readFileSync(stabilityPath, 'utf8');
const backend = fs.readFileSync(backendPath, 'utf8');
const scannerService = fs.readFileSync(scannerServicePath, 'utf8');

test('new Mapping and backend runtime files remain syntactically valid', () => {
  for (const path of [runtimePath, coordinatorPath, candleCoordinatorPath, timeframePath, scannerGatePath, stabilityPath, backendPath]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
});

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
  assert.match(runtime, /result\.mappingSnapshot/);
  assert.match(runtime, /snapshot\?\.scenario/);
  assert.doesNotMatch(runtime, /result\.bestSetup\s*=/);
  assert.doesNotMatch(runtime, /result\.setups\s*=/);
});

test('shared candle coordinator refreshes only closed watch timeframes', () => {
  assert.equal(candleCoordinator.includes('PROXY_URL'), false);
  assert.equal(candleCoordinator.includes('fetch('), false);
  assert.match(candleCoordinator, /import \{ fetchTf \}/);
  assert.match(candleCoordinator, /watch\.triggerTf/);
  assert.match(candleCoordinator, /watch\.sourceTf/);
  assert.match(candleCoordinator, /expectedClosedOpenTime/);
  assert.match(candleCoordinator, /expectedClosedCandleOpenTime/);
  assert.match(candleCoordinator, /amyfx:candles-updated/);
  assert.match(timeframe, /W1:\s*7 \* 24 \* 60 \* 60/);
  assert.match(timeframe, /mondayUtcAnchorSeconds/);
});

test('legacy native Mapping scanner remains permanently disabled', () => {
  assert.ok(index.includes('js/scanner-visibility-gate.js'));
  assert.match(scannerGate, /stopBackgroundScanner/);
  assert.doesNotMatch(scannerGate, /startBackgroundScanner/);
  assert.match(scannerGate, /amyfx:entry-watch-updated/);
  assert.match(scannerGate, /only active notification source/);
  assert.match(scannerService, /Legacy local Mapping scanner is retired/);
  assert.match(scannerService, /putBoolean\(KEY_SCANNER_ENABLED, false\)/);
  assert.match(scannerService, /return START_NOT_STICKY/);
  assert.doesNotMatch(scannerService, /MARKET_POLL_MS/);
});

test('analysis view stays statically open without forced scroll or autonomous refresh hooks', () => {
  assert.ok(index.includes('js/analysis-ui-stability-v4.js'));
  assert.equal(index.includes('js/view-stability.js'), false);
  assert.match(stability, /details\.open = true/);
  assert.match(stability, /event\.preventDefault\(\)/);
  assert.match(stability, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.match(stability, /amyfx:mapping-state-change/);
  assert.doesNotMatch(stability, /DISCLOSURE_STATE_KEY/);
  assert.doesNotMatch(stability, /visibilitychange/);
  assert.doesNotMatch(stability, /amyfx:market-update/);
  assert.doesNotMatch(stability, /window\.scrollTo/);
  assert.doesNotMatch(stability, /window\.scrollBy/);
  assert.doesNotMatch(stability, /scrollIntoView/);
});

test('client Twelve Data requests are canonicalized, deduplicated and cached', () => {
  assert.match(coordinator, /const inFlight = new Map/);
  assert.match(coordinator, /const responseCache = new Map/);
  assert.match(coordinator, /const intervalSnapshots = new Map/);
  assert.match(coordinator, /LIVE_TTL_MS = 90_000/);
  assert.match(coordinator, /SHARED_M1_OUTPUT_SIZE = 300/);
  assert.match(coordinator, /url\.searchParams\.set\('symbol', symbol\)/);
  assert.match(coordinator, /fetchUrl: url\.toString\(\)/);
  assert.match(coordinator, /snapshotResponse/);
  assert.match(coordinator, /window\.fetch = coordinatedFetch/);
});

test('closed candle cache survives app reload and blocks quota-wasting refetches', () => {
  assert.match(coordinator, /PERSISTENT_CACHE_KEY = 'amyfx_market_response_cache_v3'/);
  assert.match(coordinator, /restorePersistentCache\(\)/);
  assert.match(coordinator, /persistResponseCache\(\)/);
  assert.match(coordinator, /localStorage\.setItem\(PERSISTENT_CACHE_KEY/);
  assert.match(coordinator, /storedIsCurrent\(exactCached, info, now\)/);
  assert.match(coordinator, /expectedClosedOpenTime\(info, now/);
  assert.match(coordinator, /marketReferenceNowMs/);
  assert.match(coordinator, /MONDAY_UTC_ANCHOR_SECONDS/);
});

test('background M1 refresh is throttled while selected M1 remains candle-close accurate', () => {
  assert.match(coordinator, /BACKGROUND_M1_REFRESH_SECONDS = 300/);
  assert.match(coordinator, /activeMappingTf\(\) === 'M1'/);
  assert.match(coordinator, /refreshSecondsFor/);
  assert.match(coordinator, /RETRY_COOLDOWN_MS = 60_000/);
  assert.match(coordinator, /retryAfter/);
});

test('current Supabase fallback is verified instead of rejected only for containing stale label', () => {
  assert.match(coordinator, /dataIsCurrent\(data, info, now\)/);
  assert.match(coordinator, /SUPABASE_VERIFIED_CURRENT/);
  assert.match(coordinator, /amyfxOriginalCacheState/);
  assert.match(coordinator, /amyfxProviderDegraded/);
  assert.match(coordinator, /amyfxExpectedClosedOpenTime/);
});

test('backend shares provider responses and serves stale cache during provider failure', () => {
  assert.match(backend, /globalThis\.__amyFxTwelveDataCache/);
  assert.match(backend, /globalThis\.__amyFxTwelveDataInFlight/);
  assert.match(backend, /CACHE_TTL_SECONDS/);
  assert.match(backend, /STALE_IF_ERROR_SECONDS/);
  assert.match(backend, /stale-if-error/);
});
