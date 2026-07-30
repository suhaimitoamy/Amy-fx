import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dedupeCandleRows } from '../lib/market-candle-store.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('live quote stays on one backend API and uses provider freshness', () => {
  const source = read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  assert.match(source, /const LIVE_POLL_MS = 20_000/);
  assert.match(source, /validateLiveMarketPayload\(data\)/);
  assert.match(source, /data\?\.quoteCapturedAt/);
  assert.match(source, /assertBackendPayloadFresh\(data, `Candle \${tf}`\)/);
  assert.doesNotMatch(source, /lastWsTickAt = Date\.now\(\)/);
  assert.doesNotMatch(source, /new WebSocket|twelve_api_key/);
});
test('duplicate candle keys collapse before Supabase upsert', () => {
  const rows = dedupeCandleRows([
    { symbol: 'XAU/USD', timeframe: 'M1', open_time: 10, close: 1 },
    { symbol: 'XAU/USD', timeframe: 'M1', open_time: 10, close: 2 },
    { symbol: 'XAU/USD', timeframe: 'M1', open_time: 11, close: 3 }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.open_time === 10).close, 2);
});
test('native Mapping scanner remains safely retired', () => {
  const source = read('app/src/main/java/com/amyelitesuite/ScannerService.kt');
  assert.match(source, /Legacy local Mapping scanner is retired/);
  assert.doesNotMatch(source, /pollMarket\(/);
});
