import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/live-price.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt', import.meta.url), 'utf8');

test('live-price lifetime is 20s and OkHttp readTimeout is 35s to prevent race condition', () => {
  // Lifetime in serverless Vercel function
  assert.match(api, /setTimeout\(finish,\s*20000\)/, 'Vercel stream lifetime must be 20 seconds');

  // Client OkHttp readTimeout
  assert.match(bridge, /\.readTimeout\(35,\s*TimeUnit\.SECONDS\)/, 'OkHttp readTimeout must be 35 seconds (15s margin)');
});

test('TwelveDataPriceBridge reconnects with 0ms delay on graceful stream completion', () => {
  assert.match(bridge, /reconnect\(currentGeneration,\s*current,\s*graceful\)/);
  assert.match(bridge, /val delay = if \(graceful\) 0L else minOf/);
  assert.match(bridge, /if \(graceful\) reconnectAttempt = 0/);
});
