import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

test('mapping sw.js: bypasses dynamic APIs, live streams, and external providers', () => {
  const swCode = fs.readFileSync(path.resolve('app/src/main/assets/apps/mapping/sw.js'), 'utf8');

  const listeners = {};
  const mockSelf = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} }
  };

  const sandbox = {
    self: mockSelf,
    caches: { match: async () => null, open: async () => ({ put: async () => {} }) },
    clients: mockSelf.clients
  };

  vm.createContext(sandbox);
  vm.runInContext(swCode, sandbox);

  assert.ok(listeners.fetch, 'fetch event listener should be registered');

  const createEvent = (method, url) => {
    let responded = false;
    let responsePromise = null;
    return {
      request: { method, url },
      respondWith: (promise) => {
        responded = true;
        responsePromise = promise;
      },
      get responded() { return responded; },
      get responsePromise() { return responsePromise; }
    };
  };

  // 1. Dynamic API endpoints must NOT call respondWith (bypassed to network)
  const apiUrls = [
    'https://amy-fx.vercel.app/api/scalper-setups',
    'https://amy-fx.vercel.app/api/live-price',
    'https://amy-fx.vercel.app/api/news',
    'https://amy-fx.vercel.app/api/calendar',
    'http://localhost:8080/api/twelvedata?symbol=XAU/USD',
    'https://api.twelvedata.com/time_series?symbol=XAU/USD',
    'https://wliecyxzlwhmtftnfnps.supabase.co/rest/v1/candles'
  ];

  for (const url of apiUrls) {
    const event = createEvent('GET', url);
    listeners.fetch(event);
    assert.equal(event.responded, false, `Expected ${url} to bypass Service Worker cache`);
  }

  // 2. Cache busters & timestamps must NOT call respondWith
  const cacheBusterUrls = [
    'https://amy-fx.vercel.app/data/history.json?t=1712345678',
    'https://amy-fx.vercel.app/chart?symbol=GOLD&timestamp=1712345678',
    'https://amy-fx.vercel.app/feed?_t=99999'
  ];
  for (const url of cacheBusterUrls) {
    const event = createEvent('GET', url);
    listeners.fetch(event);
    assert.equal(event.responded, false, `Expected cache-buster ${url} to bypass Service Worker cache`);
  }

  // 3. Non-GET methods must NOT call respondWith
  const postEvent = createEvent('POST', 'https://amy-fx.vercel.app/api/order');
  listeners.fetch(postEvent);
  assert.equal(postEvent.responded, false, 'POST requests must bypass cache');

  // 4. Static assets MUST call respondWith
  const staticEvent = createEvent('GET', 'https://amy-fx.vercel.app/index.html');
  listeners.fetch(staticEvent);
  assert.equal(staticEvent.responded, true, 'Static asset GET must be handled by Cache-First respondWith');
});
