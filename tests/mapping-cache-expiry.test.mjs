import assert from 'node:assert/strict';
import test from 'node:test';

// Setup localStorage mockup
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};

const { getOfflineCache } = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/data.js');

test('getOfflineCache returns null when no cache exists', () => {
  storage.clear();
  const res = getOfflineCache('test.key');
  assert.equal(res, null);
});

test('getOfflineCache detects fresh cache (< 48 hours)', () => {
  storage.clear();
  const now = Date.now();
  const freshTime = now - (2 * 3600 * 1000); // 2 hours old
  storage.set('amyfx.mapping.candles.M15', JSON.stringify({
    time: freshTime,
    values: [{ open: 2600, high: 2605, low: 2595, close: 2602 }]
  }));

  const res = getOfflineCache('amyfx.mapping.candles.M15');
  assert.ok(res);
  assert.equal(res.degraded, true);
  assert.equal(res.isExpired, false);
  assert.equal(res.outdated, false);
  assert.equal(res.candles.length, 1);
  assert.equal(res.cachedTime, freshTime);
});

test('getOfflineCache detects outdated / expired cache (> 48 hours)', () => {
  storage.clear();
  const now = Date.now();
  const staleTime = now - (50 * 3600 * 1000); // 50 hours old (> 48h)
  storage.set('amyfx.mapping.candles.M15', JSON.stringify({
    time: staleTime,
    values: [{ open: 2500, high: 2510, low: 2490, close: 2505 }]
  }));

  const res = getOfflineCache('amyfx.mapping.candles.M15');
  assert.ok(res);
  assert.equal(res.degraded, true);
  assert.equal(res.isExpired, true);
  assert.equal(res.outdated, true);
  assert.equal(res.candles.length, 1);
  assert.equal(res.cachedTime, staleTime);
});
