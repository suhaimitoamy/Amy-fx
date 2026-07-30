import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dedupeCandleRows } from '../lib/market-candle-store.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('live quote uses one native Twelve Data WebSocket while Mapping keeps REST freshness checks', () => {
  const source = read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  const bridge = read('app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt');
  assert.match(source, /window\.AmyLivePrice/);
  assert.match(source, /amyfx:twelvedata-price/);
  assert.match(source, /amyfx:twelvedata-status/);
  assert.match(source, /validateLiveTickPayload\(detail\)/);
  assert.match(source, /assertBackendPayloadFresh\(data, `Candle \${tf}`\)/);
  assert.doesNotMatch(source, /LIVE_POLL_MS|outputsize=1/);
  assert.doesNotMatch(source, /localStorage\.(?:getItem|setItem)\(['"]twelve_api_key/);
  assert.match(bridge, /wss:\/\/ws\.twelvedata\.com\/v1\/quotes\/price/);
  assert.match(bridge, /client\.newWebSocket/);
  assert.match(bridge, /\.put\("action", "subscribe"\)/);
  assert.match(bridge, /\.put\("symbols", SYMBOL\)/);
  assert.match(bridge, /private const val SYMBOL = "XAU\/USD"/);
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
