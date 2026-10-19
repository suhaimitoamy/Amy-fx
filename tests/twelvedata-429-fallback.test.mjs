import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCandles } from '../lib/market-candle-store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Item 1.4: lib/market-snapshot-offline.json contains valid fallback candles for XAU/USD', () => {
  const snapshotPath = path.join(__dirname, '../lib/market-snapshot-offline.json');
  assert.ok(fs.existsSync(snapshotPath), 'market-snapshot-offline.json must exist');
  
  const raw = fs.readFileSync(snapshotPath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed.snapshots, 'Must contain snapshots object');
  assert.ok(Array.isArray(parsed.snapshots['XAU_USD_15min']), 'Must contain XAU_USD_15min candles');
  assert.ok(Array.isArray(parsed.snapshots['XAU_USD_1h']), 'Must contain XAU_USD_1h candles');
  assert.ok(Array.isArray(parsed.snapshots['XAU_USD_5min']), 'Must contain XAU_USD_5min candles');
  
  const sample = parsed.snapshots['XAU_USD_15min'][0];
  assert.equal(sample.symbol, 'XAU/USD');
  assert.ok(Number.isFinite(sample.open), 'Open price must be finite');
  assert.ok(Number.isFinite(sample.high), 'High price must be finite');
  assert.ok(Number.isFinite(sample.low), 'Low price must be finite');
  assert.ok(Number.isFinite(sample.close), 'Close price must be finite');
  assert.ok(sample.open_time > 0, 'Open time must be valid positive timestamp');
});

test('Item 1.4: getCandles falls back to offline snapshot on cold start when provider is unavailable (HTTP 429 simulation)', async () => {
  // Clear any existing runtime memory cache
  if (globalThis.__amyFxRuntimeCandles) {
    globalThis.__amyFxRuntimeCandles.clear();
  }

  // Request candles with invalid/empty API key to trigger provider error
  const prevEnvKey = process.env.TWELVEDATA_API_KEY;
  delete process.env.TWELVEDATA_API_KEY;
  let result;
  try {
    result = await getCandles({
      symbol: 'XAU/USD',
      interval: '15min',
      outputsize: 50,
      apiKey: '', // will trigger provider error and invoke snapshot fallback
      forceRefresh: true
    });
  } finally {
    if (prevEnvKey !== undefined) process.env.TWELVEDATA_API_KEY = prevEnvKey;
  }

  assert.equal(result.status, 'ok', 'Status must be ok even when provider fails');
  assert.ok(Array.isArray(result.values), 'Values must be an array');
  assert.ok(result.values.length > 0, 'Must contain fallback candles');
  assert.equal(result.staleFallback, true, 'staleFallback must be true');
  assert.ok(
    result.source === 'local-stale' || result.source === 'offline-snapshot',
    `Source must indicate local/offline stale fallback, got ${result.source}`
  );

  const firstCandle = result.values[0];
  assert.ok(firstCandle.datetime, 'Must have datetime');
  assert.ok(Number(firstCandle.close) > 0, 'Close price must be valid positive number');
});

test('Item 1.4: api/twelvedata.js and market-candle-store.mjs contain 429 mitigation and staggered fetch', () => {
  const storeSource = fs.readFileSync('lib/market-candle-store.mjs', 'utf8');
  assert.ok(
    storeSource.includes('staggeredFetchProviderCandles'),
    'market-candle-store must implement staggeredFetchProviderCandles for jitter and burst rate mitigation'
  );
  assert.ok(
    storeSource.includes('readBundledSnapshot'),
    'market-candle-store must support readBundledSnapshot for cold-start 429 resilience'
  );

  const apiSource = fs.readFileSync('api/twelvedata.js', 'utf8');
  assert.ok(
    apiSource.includes('readSnapshotFallback'),
    'api/twelvedata.js must implement readSnapshotFallback to prevent returning HTTP 429 to client'
  );
});
