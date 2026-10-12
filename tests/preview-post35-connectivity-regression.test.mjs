import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(root, 'app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js');
const marketPath = path.join(root, 'app/src/main/assets/apps/shared/market-intelligence.js');
const homePath = path.join(root, 'app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js');
const contractSource = fs.readFileSync(contractPath, 'utf8');
const marketSource = fs.readFileSync(marketPath, 'utf8');

function createMarketRuntime(initialState = {}, online = true) {
  const values = new Map([['amyfx.market.intel.v1', JSON.stringify(initialState)]]);
  const listeners = new Map();
  const window = {
    state: { tf: 'M15', candles: { M15: [] } },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    }
  };
  const context = {
    window,
    navigator: { onLine: online },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
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
  vm.runInNewContext(marketSource, context);
  return { api: window.AmyFXIntel, contract: window.AmyFXMarketContract, window, values };
}

test('updated post-35 integration runtimes are valid JavaScript', () => {
  for (const file of [contractPath, marketPath, homePath]) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('fresh non-price domains cannot combine with an old Mapping price to create a quote', () => {
  const now = Date.now();
  const { api } = createMarketRuntime({
    schemaVersion: 2,
    mapping: { price: 4100, capturedAt: new Date(now - 12 * 60 * 1000).toISOString(), storedAt: now },
    heatmap: { capturedAt: new Date(now).toISOString(), zones: [], storedAt: now },
    news: { capturedAt: new Date(now).toISOString(), items: [{ title: 'Fresh headline' }], storedAt: now }
  });
  const state = api.freshness();
  assert.equal(state.label, 'EXPIRED');
  assert.equal(state.source, null);
  assert.equal(api.bestCurrentPrice(), 0);
});

test('explicit quote source timestamp wins over a newer storage write time', () => {
  const now = Date.now();
  const { api } = createMarketRuntime({
    schemaVersion: 2,
    quote: {
      price: 4101,
      source: 'M1_QUOTE',
      capturedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      storedAt: now
    }
  });
  const freshness = api.freshness();
  assert.equal(freshness.label, 'EXPIRED');
  assert.equal(freshness.source, 'M1_QUOTE');
});

test('one genuinely fresh official M1 quote is enough for a LIVE state', () => {
  const now = Date.now();
  const { api } = createMarketRuntime({
    schemaVersion: 2,
    mapping: { price: 4090, capturedAt: new Date(now - 12 * 60 * 1000).toISOString(), storedAt: now - 1000 },
    liquidity: { currentPrice: 4102, capturedAt: new Date(now - 30_000).toISOString(), storedAt: now },
    quote: { price: 4102, source: 'M1_QUOTE', capturedAt: new Date(now - 5_000).toISOString(), storedAt: now }
  });
  const state = api.freshness();
  assert.equal(state.label, 'LIVE');
  assert.equal(state.source, 'M1_QUOTE');
  assert.equal(api.bestCurrentPrice(), 4102);
});

test('syncGlobals clears a stale heatmap global when the persisted heatmap is removed', () => {
  const now = Date.now();
  const { api, window } = createMarketRuntime({
    schemaVersion: 2,
    heatmap: { currentPrice: 4100, capturedAt: new Date(now).toISOString(), storedAt: now }
  });
  assert.ok(window.AmyFXHeatmapState);
  api.syncGlobals({});
  assert.equal(window.AmyFXHeatmapState, null);
});

test('Home publishes Journal, Library and Mapping counts even before Profile cards exist', async () => {
  const source = await readFile(homePath, 'utf8');
  assert.match(source, /const ITEMS_RECORD = "items\.v2"/);
  assert.match(source, /readMetadataCounts/);
  assert.match(source, /window\.AmyFXHomeStats = Object\.freeze\(\{ analyses, journals, library/);
  assert.match(source, /amyfx:library-state-change/);
  assert.doesNotMatch(source, /if \(!journalTarget && !mappingTarget\) return/);
});
