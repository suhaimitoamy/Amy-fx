import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

const files = [
  'lib/market-candle-store.mjs',
  'api/twelvedata.js',
  'api/heatmap.js',
  'api/liquidity.js',
  'app/src/main/assets/apps/mapping/js/api-request-coordinator.js',
  'app/src/main/assets/apps/mapping/js/mentor-market-context-sync.js',
  'app/src/main/assets/apps/market-intel/private-market-api-router.js',
  'app/src/main/assets/apps/shared/market-intelligence.js'
];
const { expectedClosedOpenTime } = await import('../lib/market-candle-store.mjs');

test('Supabase-first market gateway files are valid JavaScript', () => {
  for (const relative of files) {
    execFileSync(process.execPath, ['--check', path.join(root, relative)], { stdio: 'pipe' });
  }
});

test('all server market features use one candle store', async () => {
  const store = await read('lib/market-candle-store.mjs');
  const heatmap = await read('api/heatmap.js');
  const liquidity = await read('api/liquidity.js');
  assert.match(store, /rest\/v1\/candles/);
  assert.match(store, /on_conflict=symbol,timeframe,open_time/);
  assert.match(store, /SUPABASE_HIT/);
  assert.match(store, /PROVIDER_SYNCED_TO_SUPABASE/);
  assert.match(store, /SUPABASE_STALE_FALLBACK/);
  assert.match(heatmap, /import \{ getCandles \}/);
  assert.match(liquidity, /import \{ getCandles \}/);
  assert.doesNotMatch(heatmap, /api\.twelvedata\.com/);
  assert.doesNotMatch(liquidity, /api\.twelvedata\.com/);
});

test('weekly candle closure is anchored to Monday UTC instead of the Unix Thursday epoch', () => {
  const tuesday = Date.parse('2026-07-28T12:00:00Z');
  assert.equal(
    expectedClosedOpenTime('1week', tuesday),
    Date.parse('2026-07-20T00:00:00Z') / 1000
  );
  assert.equal(
    expectedClosedOpenTime('1day', tuesday),
    Date.parse('2026-07-27T00:00:00Z') / 1000
  );
});

test('active private clients route market reads through Supabase Edge gateways', async () => {
  const coordinator = await read('app/src/main/assets/apps/mapping/js/api-request-coordinator.js');
  const router = await read('app/src/main/assets/apps/market-intel/private-market-api-router.js');
  const scanner = await read('app/src/main/java/com/amyelitesuite/ScannerService.kt');
  assert.match(coordinator, /functions\/v1\/market-candles/);
  assert.match(coordinator, /normalizeClosedSeries/);
  assert.match(coordinator, /CLOSED_SERIES_SENTINEL_V1/);
  assert.match(router, /functions\/v1\/market-heatmap/);
  assert.match(router, /functions\/v1\/market-liquidity/);
  assert.match(scanner, /Legacy local Mapping scanner is retired/);
  assert.match(scanner, /return START_NOT_STICKY/);
  assert.doesNotMatch(scanner, /functions\/v1\/market-candles|personal-amyfx-private-aplikasi-trading\.vercel\.app/);
});

test('Mapping shares Entry Watch zones with Amy Bot', async () => {
  const sync = await read('app/src/main/assets/apps/mapping/js/mentor-market-context-sync.js');
  const index = await read('app/src/main/assets/apps/mapping/index.html');
  assert.match(index, /mentor-market-context-sync\.js/);
  assert.match(sync, /entryWatch: watch/);
  assert.match(sync, /FVG: fairValueGaps/);
  assert.match(sync, /OB: orderBlocks/);
  assert.match(sync, /ENTRY_WATCH/);
});
