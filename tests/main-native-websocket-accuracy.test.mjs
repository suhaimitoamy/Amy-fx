import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Amy FX main uses the same native Twelve Data WebSocket price path as Preview', async () => {
  const [bridge, activity, market, androidBridge, proguard] = await Promise.all([
    read('app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt'),
    read('app/src/main/java/com/amyelitesuite/MainActivity.kt'),
    read('app/src/main/assets/apps/mapping/js/api/market-data.js'),
    read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js'),
    read('app/proguard-rules.pro')
  ]);

  assert.match(bridge, /wss:\/\/ws\.twelvedata\.com\/v1\/quotes\/price/);
  assert.match(bridge, /PRICE_EVENT = "amyfx:twelvedata-price"/);
  assert.match(bridge, /BuildConfig\.TWELVE_DATA_API_KEY/);
  assert.match(activity, /TwelveDataPriceBridge\(this, webView\)/);
  assert.match(activity, /addJavascriptInterface\(twelveDataPriceBridge, "AmyLivePrice"\)/);
  assert.match(activity, /twelveDataPriceBridge\.close\(\)/);

  assert.match(market, /window\.addEventListener\('amyfx:twelvedata-price'/);
  assert.match(market, /window\.addEventListener\('amyfx:twelvedata-status'/);
  assert.match(market, /window\.AmyLivePrice/);
  assert.doesNotMatch(market, /function pollLivePrice\s*\(/);
  assert.doesNotMatch(market, /LIVE_POLL_MS/);
  assert.match(market, /export async function fetchTf/);
  assert.match(market, /PROXY_URL/);

  assert.match(androidBridge, /AmyLivePrice\?\.saveApiKey/);
  assert.match(androidBridge, /connect\(\{ force: true \}\)/);
  assert.match(proguard, /class com\.amyelitesuite\.TwelveDataPriceBridge/);
});
