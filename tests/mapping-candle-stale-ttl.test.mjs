import assert from 'node:assert/strict';
import test from 'node:test';

// Setup browser globals before importing modules
const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: key => store.delete(key),
  clear: () => store.clear()
};

globalThis.window = {
  location: { href: 'http://localhost/' },
  localStorage: globalThis.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  AmyFXIntel: { read: () => ({}), write: () => {}, mountStrip: () => {}, mountBriefing: () => {} }
};

const createDummyElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
  dataset: {},
  classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [createDummyElement()],
  addEventListener: () => {},
  removeEventListener: () => {}
});

globalThis.document = {
  hidden: false,
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [createDummyElement()],
  getElementById: () => createDummyElement(),
  addEventListener: () => {},
  removeEventListener: () => {}
};

const { isCandleStale, setCandleFetchedAt } = await import('../app/src/main/assets/apps/mapping/js/api/market-data.js');
const { entryMapDisplayState } = await import('../app/src/main/assets/apps/mapping/js/ui/entry-map-status.js');

test('isCandleStale returns false for valid cache within TTL thresholds', () => {
  const now = Date.now();
  setCandleFetchedAt('M1', now - 1 * 60 * 1000); // 1 min ago (< 2 min)
  setCandleFetchedAt('M15', now - 3 * 60 * 1000); // 3 min ago (< 5 min)
  setCandleFetchedAt('H1', now - 10 * 60 * 1000); // 10 min ago (< 15 min)
  setCandleFetchedAt('D1', now - 120 * 60 * 1000); // 2 hours ago (< 4 hours)

  assert.equal(isCandleStale('M1'), false);
  assert.equal(isCandleStale('1min'), false);
  assert.equal(isCandleStale('M15'), false);
  assert.equal(isCandleStale('15min'), false);
  assert.equal(isCandleStale('H1'), false);
  assert.equal(isCandleStale('1h'), false);
  assert.equal(isCandleStale('D1'), false);
  assert.equal(isCandleStale('1day'), false);
});

test('isCandleStale returns true when cache exceeds TTL limits', () => {
  const now = Date.now();
  setCandleFetchedAt('M1', now - 3 * 60 * 1000); // 3 min ago (> 2 min)
  setCandleFetchedAt('M15', now - 6 * 60 * 1000); // 6 min ago (> 5 min)
  setCandleFetchedAt('H1', now - 16 * 60 * 1000); // 16 min ago (> 15 min)
  setCandleFetchedAt('D1', now - 250 * 60 * 1000); // 250 min ago (> 240 min)

  assert.equal(isCandleStale('M1'), true);
  assert.equal(isCandleStale('1min'), true);
  assert.equal(isCandleStale('M15'), true);
  assert.equal(isCandleStale('15min'), true);
  assert.equal(isCandleStale('H1'), true);
  assert.equal(isCandleStale('1h'), true);
  assert.equal(isCandleStale('D1'), true);
  assert.equal(isCandleStale('1day'), true);
});

test('entryMapDisplayState suppresses signals and returns DATA USANG when cache is stale or API fails', () => {
  const staleSetup = {
    status: 'DATA USANG',
    dataStale: true,
    statusText: 'DATA USANG'
  };

  const state = entryMapDisplayState(staleSetup);
  assert.equal(state.status, 'DATA USANG');
  assert.equal(state.terminal, true);
  assert.equal(state.dataStale, true);
  assert.match(state.note, /DATA USANG/);
  assert.match(state.note, /dinonaktifkan/);
});

test('entryMapDisplayState returns DATA USANG when no setup is available and stale flag is set', () => {
  const state = entryMapDisplayState({ dataStale: true });
  assert.equal(state.status, 'DATA USANG');
  assert.equal(state.terminal, true);
  assert.equal(state.dataStale, true);
});
