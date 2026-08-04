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

function createRuntime(initialState) {
  const values = new Map([
    ['amyfx.market.intel.v1', JSON.stringify(initialState)]
  ]);
  const listeners = new Map();
  const window = {
    state: { tf: 'M15', price: 0, candles: { M15: [] } },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    }
  };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const context = {
    window,
    navigator: { onLine: true },
    localStorage,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
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
  return { window, localStorage };
}

test('command strip shows official M1 quote and Intel Liquidity BSL SSL only', () => {
  const capturedAt = new Date().toISOString();
  const { window } = createRuntime({
    schemaVersion: 2,
    quote: {
      capturedAt,
      price: 4111.42,
      source: 'M1_QUOTE'
    },
    liquidity: {
      capturedAt,
      currentPrice: 4111.42,
      levels: [
        { type: 'BSL', price: 4120.25, distance: 8.83, status: 'ACTIVE' },
        { type: 'SSL', price: 4101.75, distance: -9.67, status: 'ACTIVE' }
      ]
    },
    mapping: {
      capturedAt,
      timeframe: 'M15',
      price: 4111.42,
      bsl: 4199,
      ssl: 4001,
      levels: [
        { type: 'BSL', price: 4199, distance: 87.58, status: 'ACTIVE' },
        { type: 'SSL', price: 4001, distance: -110.42, status: 'ACTIVE' }
      ]
    }
  });

  const target = { innerHTML: '' };
  window.AmyFXIntel.mountStrip(target);

  assert.match(target.innerHTML, /4111\.42/);
  assert.match(target.innerHTML, /4120\.25/);
  assert.match(target.innerHTML, /4101\.75/);
  assert.doesNotMatch(target.innerHTML, /4199\.00/);
  assert.doesNotMatch(target.innerHTML, /4001\.00/);
  assert.match(target.innerHTML, /data-live-price/);
  assert.match(target.innerHTML, /data-freshness="FRESH"/);
  assert.match(target.innerHTML, /data-domain="quote" data-freshness="LIVE"/);
});

test('live WebSocket display replaces an older contract quote without recalculating Mapping', () => {
  const oldCapturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const { window, localStorage } = createRuntime({
    schemaVersion: 2,
    quote: {
      capturedAt: oldCapturedAt,
      price: 4059.10,
      source: 'M1_QUOTE'
    },
    liquidity: {
      capturedAt: oldCapturedAt,
      currentPrice: 4059.10,
      levels: [
        { type: 'BSL', price: 4064.21, distance: 5.11, status: 'ACTIVE' },
        { type: 'SSL', price: 4030.47, distance: -28.63, status: 'ACTIVE' }
      ]
    }
  });

  const target = { innerHTML: '' };
  window.AmyFXIntel.mountStrip(target);
  assert.match(target.innerHTML, /4059\.10/);
  assert.match(target.innerHTML, /data-freshness="EXPIRED"/);

  const tickAt = Date.now();
  window.state.price = 4056.80;
  window.__amyFxDisplayLastTickAt = tickAt;
  localStorage.setItem('last_ws_tick_at', tickAt);
  localStorage.setItem('last_price', 4056.80);
  window.dispatchEvent({ type: 'amyfx:live-price-display', detail: { price: 4056.80, capturedAt: tickAt } });

  assert.match(target.innerHTML, /4056\.80/);
  assert.doesNotMatch(target.innerHTML, /4059\.10/);
  assert.match(target.innerHTML, /data-live-price/);
  assert.match(target.innerHTML, /data-domain="quote" data-freshness="LIVE"/);
});

test('Asia session label follows New York local time across daylight saving changes', () => {
  const { window } = createRuntime({ schemaVersion: 2 });

  assert.equal(window.AmyFXIntel.sessionInfo(new Date('2026-07-14T00:00:00Z')).id, 'ASIA');
  assert.equal(window.AmyFXIntel.sessionInfo(new Date('2026-12-15T00:00:00Z')).id, 'ASIA');
  assert.equal(window.AmyFXIntel.sessionInfo(new Date('2026-07-14T08:00:00Z')).id, 'OFF_SESSION');
});
