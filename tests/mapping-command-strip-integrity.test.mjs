import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const contractSource = fs.readFileSync(
  new URL('../app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js', import.meta.url),
  'utf8'
);
const intelSource = fs.readFileSync(
  new URL('../app/src/main/assets/apps/shared/market-intelligence.js', import.meta.url),
  'utf8'
);

function runtime() {
  const store = new Map();
  const window = {
    state: { tf: 'M15', candles: { M15: [] } },
    dispatchEvent() {},
    addEventListener() {}
  };
  const localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
  const context = {
    window,
    navigator: { onLine: true },
    localStorage,
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init?.detail; }
    },
    Date,
    Intl,
    Number,
    String,
    Array,
    Object,
    Map,
    Math,
    JSON,
    RegExp,
    console
  };
  vm.runInNewContext(contractSource, context);
  vm.runInNewContext(intelSource, context);
  return { api: window.AmyFXIntel, contract: window.AmyFXMarketContract, store };
}

test('command strip hanya memilih BSL Intel di atas harga dan SSL Intel di bawah harga', () => {
  const { api } = runtime();
  const capturedAt = new Date().toISOString();
  api.write('quote', {
    price: 4074.87,
    capturedAt,
    source: 'M1_QUOTE'
  });
  api.write('liquidity', {
    capturedAt,
    currentPrice: 4074.87,
    levels: [
      { type: 'BSL', price: 4073.65, status: 'ACTIVE' },
      { type: 'BSL', price: 4088.64, status: 'ACTIVE' },
      { type: 'SSL', price: 4066.64, status: 'ACTIVE' },
      { type: 'SSL', price: 4076, status: 'ACTIVE' }
    ]
  });

  const levels = api.nearestLevels(api.read());
  assert.equal(levels.bsl.price, 4088.64);
  assert.equal(levels.ssl.price, 4066.64);
  assert.equal(levels.source, 'INTEL_LIQUIDITY_ONLY');
});

test('command strip menolak level touched atau swept dan memberi label STRUCTURAL pada Intel yang stale', () => {
  const { api } = runtime();
  const quoteAt = new Date().toISOString();
  const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  api.write('quote', { price: 4074.87, capturedAt: quoteAt, source: 'M1_QUOTE' });
  api.write('liquidity', {
    capturedAt: staleAt,
    currentPrice: 4074.87,
    levels: [
      { type: 'BSL', price: 4080, status: 'LIVE_TOUCHED' },
      { type: 'SSL', price: 4069, status: 'SWEPT' },
      { type: 'BSL', price: 4090, status: 'ACTIVE' },
      { type: 'SSL', price: 4060, status: 'ACTIVE' }
    ]
  });

  const structural = api.nearestLevels(api.read());
  assert.equal(structural.bsl.price, 4090);
  assert.equal(structural.ssl.price, 4060);
  assert.equal(structural.bsl.freshness, 'STRUCTURAL');
  assert.equal(structural.ssl.freshness, 'STRUCTURAL');

  api.write('liquidity', {
    capturedAt: quoteAt,
    currentPrice: 4074.87,
    levels: [
      { type: 'BSL', price: 4080, status: 'LIVE_TOUCHED' },
      { type: 'SSL', price: 4069, status: 'SWEPT' }
    ]
  });
  const inactiveOnly = api.nearestLevels(api.read());
  assert.equal(inactiveOnly.bsl, null);
  assert.equal(inactiveOnly.ssl, null);
});
