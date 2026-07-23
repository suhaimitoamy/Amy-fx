(function () {
  'use strict';

  if (window.__amyFxRequestCoordinatorInstalled) return;
  window.__amyFxRequestCoordinatorInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const inFlight = new Map();
  const responseCache = new Map();
  const API_HOST = 'amy-fx.vercel.app';
  const API_PATH = '/api/twelvedata';

  function isMarketRequest(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') return false;
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      return url.hostname === API_HOST && url.pathname === API_PATH;
    } catch (_) {
      return false;
    }
  }

  function requestInfo(input) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    url.searchParams.delete('_');
    url.searchParams.delete('fresh');
    const interval = String(url.searchParams.get('interval') || '1min').toLowerCase();
    const outputsize = Number(url.searchParams.get('outputsize') || 0);
    const key = `${url.origin}${url.pathname}?${[...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([keyName, value]) => `${encodeURIComponent(keyName)}=${encodeURIComponent(value)}`)
      .join('&')}`;
    return { key, interval, outputsize };
  }

  function ttlFor({ interval, outputsize }) {
    if (outputsize <= 2) return 55_000;
    const ttl = {
      '1min': 55_000,
      '5min': 240_000,
      '15min': 600_000,
      '30min': 900_000,
      '45min': 1_200_000,
      '1h': 1_800_000,
      '2h': 3_600_000,
      '4h': 7_200_000,
      '1day': 14_400_000,
      '1week': 43_200_000
    };
    return ttl[interval] || 300_000;
  }

  function cloneStored(stored) {
    return new Response(stored.body, {
      status: stored.status,
      statusText: stored.statusText,
      headers: stored.headers
    });
  }

  function cleanCache(now = Date.now()) {
    for (const [key, value] of responseCache.entries()) {
      if (value.expiresAt <= now) responseCache.delete(key);
    }
    if (responseCache.size <= 30) return;
    [...responseCache.entries()]
      .sort((a, b) => a[1].storedAt - b[1].storedAt)
      .slice(0, responseCache.size - 20)
      .forEach(([key]) => responseCache.delete(key));
  }

  async function coordinatedFetch(input, init) {
    if (!isMarketRequest(input, init)) return nativeFetch(input, init);

    const info = requestInfo(input);
    const now = Date.now();
    cleanCache(now);

    const cached = responseCache.get(info.key);
    if (cached && cached.expiresAt > now) {
      return cloneStored(cached);
    }

    const active = inFlight.get(info.key);
    if (active) {
      const stored = await active;
      return cloneStored(stored);
    }

    const request = (async () => {
      const response = await nativeFetch(input, init);
      const body = await response.clone().text();
      const stored = {
        body,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        storedAt: Date.now(),
        expiresAt: Date.now() + ttlFor(info)
      };
      if (response.ok) responseCache.set(info.key, stored);
      return stored;
    })();

    inFlight.set(info.key, request);
    try {
      const stored = await request;
      return cloneStored(stored);
    } finally {
      inFlight.delete(info.key);
    }
  }

  window.fetch = coordinatedFetch;
  window.AmyFXRequestCoordinator = Object.freeze({
    clear() {
      responseCache.clear();
      inFlight.clear();
    },
    stats() {
      return {
        cached: responseCache.size,
        inFlight: inFlight.size
      };
    }
  });
})();
