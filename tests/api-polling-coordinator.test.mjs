import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const runtimePath = 'app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js';
const coordinatorPath = 'app/src/main/assets/apps/mapping/js/api-request-coordinator.js';
const candleCoordinatorPath = 'app/src/main/assets/apps/mapping/js/candle-refresh-coordinator.js';
const scannerGatePath = 'app/src/main/assets/apps/mapping/js/scanner-visibility-gate.js';
const stabilityPath = 'app/src/main/assets/apps/mapping/js/view-stability.js';
const backendPath = 'api/twelvedata.js';
const scannerServicePath = 'app/src/main/java/com/amyelitesuite/ScannerService.kt';

const index = fs.readFileSync(indexPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const coordinator = fs.readFileSync(coordinatorPath, 'utf8');
const candleCoordinator = fs.readFileSync(candleCoordinatorPath, 'utf8');
const scannerGate = fs.readFileSync(scannerGatePath, 'utf8');
const stability = fs.readFileSync(stabilityPath, 'utf8');
const backend = fs.readFileSync(backendPath, 'utf8');
const scannerService = fs.readFileSync(scannerServicePath, 'utf8');

test('new Mapping and backend runtime files remain syntactically valid', () => {
  for (const path of [runtimePath, coordinatorPath, candleCoordinatorPath, scannerGatePath, stabilityPath, backendPath]) {
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

test('native scanner is background-only and rate limited', () => {
  assert.ok(index.includes('js/scanner-visibility-gate.js'));
  assert.match(scannerGate, /document\.hidden/);
  assert.match(scannerGate, /stopBackgroundScanner/);
  assert.match(scannerGate, /startBackgroundScanner/);
  assert.match(scannerGate, /amyfx:entry-watch-updated/);
  assert.match(scannerService, /MARKET_POLL_MS = 5L \* 60L \* 1000L/);
  assert.match(scannerService, /memeriksa harga setiap 5 menit/);
});

test('analysis view has scroll stability protection', () => {
  assert.ok(index.includes('js/view-stability.js'));
  assert.match(stability, /MutationObserver/);
  assert.match(stability, /window\.scrollTo/);
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

test('backend shares provider responses and serves stale cache during provider failure', () => {
  assert.match(backend, /globalThis\.__amyFxTwelveDataCache/);
  assert.match(backend, /globalThis\.__amyFxTwelveDataInFlight/);
  assert.match(backend, /CACHE_TTL_SECONDS/);
  assert.match(backend, /Vercel-CDN-Cache-Control/);
  assert.match(backend, /STALE_FALLBACK/);
  assert.match(backend, /canonicalM1Url/);
  assert.match(backend, /res\.redirect\(307, canonicalM1Url\(symbol\)\)/);
  assert.match(backend, /s-maxage=\$\{ttl\}/);
});
