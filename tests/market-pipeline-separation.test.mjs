import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Supabase candle writes deduplicate conflict keys before upsert', () => {
  const store = read('lib/market-candle-store.mjs');
  assert.match(store, /function dedupeCandleRows\(/);
  assert.match(store, /JSON\.stringify\(dedupedRows\)/);
});

test('live display uses Twelve Data WebSocket without writing Mapping candles', () => {
  const websocket = read('app/src/main/assets/apps/mapping/js/api/live-price-websocket.js');
  assert.match(websocket, /wss:\/\/ws\.twelvedata\.com\/v1\/quotes\/price/);
  assert.match(websocket, /action: 'subscribe'/);
  assert.match(websocket, /action: 'heartbeat'/);
  assert.match(websocket, /source: 'TWELVEDATA_WEBSOCKET'/);
  assert.doesNotMatch(websocket, /\/rest\/v1\/candles|upsert|ScannerService/);
});

test('REST Mapping quote and WebSocket display quote remain separate', () => {
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const market = read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  const contract = read('app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js');
  assert.match(main, /last_mapping_price/);
  assert.doesNotMatch(main, /removeItem\('twelve_api_key'\)/);
  assert.match(market, /last_mapping_quote_at/);
  assert.doesNotMatch(market, /setItem\('last_ws_tick_at'/);
  assert.match(contract, /TWELVEDATA_WEBSOCKET/);
  assert.match(contract, /MAPPING_REST_FALLBACK/);
});
