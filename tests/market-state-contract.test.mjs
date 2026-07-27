import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const sourcePath = (repoPath, fallback) => {
  const candidate = resolve(root, repoPath);
  return existsSync(candidate) ? candidate : resolve(root, fallback);
};
const contractSource = readFileSync(sourcePath(
  'app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js',
  'amyfx-market-state-contract-v1.js'
), 'utf8');
const intelSource = readFileSync(sourcePath(
  'app/src/main/assets/apps/shared/market-intelligence.js',
  'market-intelligence.js'
), 'utf8');
const registrySource = readFileSync(sourcePath(
  'app/src/main/assets/apps/shared/amyfx-professional-market-source-registry-v1.js',
  'amyfx-professional-market-source-registry-v1.js'
), 'utf8');
const hotfixSource = readFileSync(sourcePath(
  'app/src/main/assets/apps/shared/amyfx-blueprint-hotfix-v1.js',
  'amyfx-blueprint-hotfix-v1.js'
), 'utf8');
const mappingIndexSource = readFileSync(sourcePath(
  'app/src/main/assets/apps/mapping/index.html',
  'mapping-index.html'
), 'utf8');
const intelIndexSource = readFileSync(sourcePath(
  'app/src/main/assets/apps/market-intel/index.html',
  'market-intel-index.html'
), 'utf8');

function storage(seed = {}) {
  const rows = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return rows.has(key) ? rows.get(key) : null; },
    setItem(key, value) { rows.set(key, String(value)); },
    removeItem(key) { rows.delete(key); },
    clear() { rows.clear(); }
  };
}

function createRuntime({ candleAt = Date.now() - 60_000 } = {}) {
  const localStorage = storage();
  const sessionStorage = storage();
  const listeners = new Map();
  const window = {
    state: {
      tf: 'M15',
      candles: { M15: candleAt ? [{ time: candleAt / 1000 }] : [] },
      result: null,
      price: 0,
      conn: 'Connected'
    },
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    },
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout(handler) { handler?.(); return 0; },
    clearTimeout() {}
  };
  const sandbox = {
    window,
    localStorage,
    sessionStorage,
    navigator: { onLine: true },
    location: { pathname: '/apps/mapping/index.html' },
    document: { body: null },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    Date, Number, Object, Array, String, Boolean, RegExp, Map, Math, JSON, Intl, console
  };
  vm.runInNewContext(contractSource, sandbox, { filename: 'amyfx-market-state-contract-v1.js' });
  vm.runInNewContext(intelSource, sandbox, { filename: 'market-intelligence.js' });
  return { window, localStorage, sessionStorage, sandbox };
}

test('M1 quote tick updates quote without laundering Mapping capturedAt', () => {
  const now = Date.now();
  const runtime = createRuntime({ candleAt: now - 60_000 });
  runtime.localStorage.setItem('last_ws_tick_at', String(now));
  runtime.window.AmyFXIntel.write('mapping', {
    price: 4091,
    timeframe: 'M15',
    bias: 'BUY',
    direction: 'BUY',
    bsl: 4110,
    ssl: 4080,
    levels: [{ type: 'BSL', price: 4110, distance: 19 }, { type: 'SSL', price: 4080, distance: -11 }]
  });
  const mappingCapturedAt = runtime.window.AmyFXIntel.read().mapping.capturedAt;

  runtime.localStorage.setItem('last_ws_tick_at', String(now + 20_000));
  runtime.window.AmyFXIntel.write('mapping', {
    price: 4092,
    timeframe: 'M15',
    bias: 'BUY',
    direction: 'BUY',
    bsl: 4110,
    ssl: 4080,
    levels: [{ type: 'BSL', price: 4110, distance: 18 }, { type: 'SSL', price: 4080, distance: -12 }]
  });

  const state = runtime.window.AmyFXIntel.read();
  assert.equal(state.mapping.capturedAt, mappingCapturedAt);
  assert.equal(state.quote.price, 4092);
  assert.equal(new Date(state.quote.capturedAt).getTime(), now + 20_000);
});

test('Mapping payload cannot invent an official quote without an M1 provider timestamp', () => {
  const runtime = createRuntime();
  runtime.window.AmyFXIntel.write('mapping', {
    price: 4091,
    updated: new Date().toISOString(),
    timeframe: 'M15',
    bias: 'BUY',
    direction: 'BUY'
  });
  assert.equal(runtime.window.AmyFXIntel.read().quote, undefined);
});

test('local analyzedAt cannot make Mapping fresh without a source candle', () => {
  const runtime = createRuntime({ candleAt: 0 });
  runtime.window.AmyFXIntel.write('mapping', {
    price: 4091,
    analyzedAt: new Date().toISOString(),
    timeframe: 'M15',
    bias: 'BUY',
    direction: 'BUY'
  });
  const mapping = runtime.window.AmyFXIntel.read().mapping;
  assert.equal(mapping.capturedAt, null);
  assert.equal(mapping.dataStale, true);
  assert.equal(runtime.window.AmyFXMarketContract.assess('mapping', mapping).state, 'EXPIRED');
});

test('storedAt cannot make an expired quote fresh or LIVE', () => {
  const runtime = createRuntime();
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  const freshness = runtime.window.AmyFXMarketContract.assess('quote', {
    capturedAt: old,
    storedAt: Date.now()
  });
  assert.equal(freshness.state, 'EXPIRED');
  assert.notEqual(freshness.label, 'LIVE');
});

test('Heatmap freshness follows source candle, not recent compute time', () => {
  const runtime = createRuntime();
  const oldCandle = new Date(Date.now() - 40 * 60_000).toISOString();
  runtime.window.AmyFXIntel.write('heatmap', {
    sourceCandleTime: oldCandle,
    computedAt: new Date().toISOString(),
    currentPrice: 4092,
    zones: []
  });
  const heatmap = runtime.window.AmyFXIntel.read().heatmap;
  assert.equal(runtime.window.AmyFXMarketContract.assess('heatmap', heatmap).state, 'EXPIRED');
});

test('official BSL and SSL come only from Intel Liquidity', () => {
  const runtime = createRuntime();
  const now = new Date().toISOString();
  runtime.window.AmyFXIntel.write('quote', { price: 4091.5, capturedAt: now, source: 'M1_QUOTE' });
  runtime.window.AmyFXIntel.write('mapping', {
    timeframe: 'M15', bias: 'BUY', direction: 'BUY', bsl: 4110.15, ssl: 4084.14,
    levels: [{ type: 'BSL', price: 4110.15 }, { type: 'SSL', price: 4084.14 }]
  });
  runtime.window.AmyFXIntel.write('liquidity', {
    capturedAt: now,
    currentPrice: 4091.5,
    levels: [
      { type: 'BSL', price: 4092, status: 'ACTIVE', active: true },
      { type: 'SSL', price: 4087.5, status: 'ACTIVE', active: true }
    ]
  });
  const levels = runtime.window.AmyFXIntel.nearestLevels();
  assert.equal(levels.bsl.price, 4092);
  assert.equal(levels.ssl.price, 4087.5);
  assert.equal(levels.source, 'INTEL_LIQUIDITY_ONLY');
});

test('Amy Bot discloses quote versus Mapping timestamp skew and stays WAIT', () => {
  const now = Date.now();
  const mappingAt = now - 10 * 60_000;
  const runtime = createRuntime({ candleAt: mappingAt });
  runtime.window.AmyFXProfessionalBot = { answer() { return 'fallback'; } };
  runtime.window.AmyFXMappingIntentHotfix = runtime.window.AmyFXProfessionalBot;
  runtime.window.AmyFXProfessionalBotHandlerLock = { lock() {} };

  runtime.window.AmyFXIntel.write('mapping', {
    timeframe: 'M15', price: 4091, bias: 'BUY', direction: 'BUY',
    bsl: 4110.15, ssl: 4084.14,
    directionDecision: { bias: 'BUY', signal: 'BUY' }
  });
  runtime.window.AmyFXIntel.write('quote', {
    price: 4092,
    capturedAt: new Date(now).toISOString(),
    source: 'M1_QUOTE'
  });
  runtime.window.state.result = {
    tf: 'M15',
    capturedAt: new Date(mappingAt).toISOString(),
    validatedMarketContext: {
      directionForecast: { active: true, direction: 'BULLISH', confidence: 80 },
      marketState: { structureTrend: 'BULLISH' }
    },
    st: { confirmedTrend: 'BULLISH' }
  };
  runtime.window.AmyFXMarketState = { result: runtime.window.state.result };

  vm.runInNewContext(registrySource, runtime.sandbox, { filename: 'amyfx-professional-market-source-registry-v1.js' });
  const answer = runtime.window.AmyFXMarketSourceRegistry.answer('Arah market sekarang?');
  assert.match(answer, /tidak sinkron/i);
  assert.match(answer, /tetap WAIT/i);
});

test('Blueprint duplicate market listeners are registered only once', async () => {
  const registrations = [];
  const window = {
    addEventListener(name, listener, options) { registrations.push({ name, listener, options }); },
    dispatchEvent() {}
  };
  const document = {
    readyState: 'loading',
    hidden: false,
    addEventListener() {},
    querySelector() { return null; }
  };
  const sandbox = {
    window, document,
    location: { pathname: '/apps/mapping/index.html' },
    localStorage: storage(),
    sessionStorage: storage(),
    CustomEvent: class {},
    Date, Number, Object, Array, String, Boolean, RegExp, Set, Map, Math, JSON, Intl, Promise,
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, console
  };
  vm.runInNewContext(hotfixSource, sandbox, { filename: 'amyfx-blueprint-hotfix-v1.js' });
  const listener = function () { return refreshMentorContext(); };
  window.addEventListener('amyfx:market-update', listener);
  window.addEventListener('amyfx:market-update', listener);
  window.addEventListener('amyfx:market-update', listener);
  assert.equal(registrations.filter(row => row.name === 'amyfx:market-update').length, 1);
  await new Promise(resolve => setTimeout(resolve, 5));
});

test('Blueprint listener guard loads before Blueprint runtime on market pages', () => {
  for (const html of [mappingIndexSource, intelIndexSource]) {
    assert.ok(html.indexOf('amyfx-blueprint-hotfix-v1.js') >= 0);
    assert.ok(html.indexOf('amyfx-blueprint-v1.js') >= 0);
    assert.ok(html.indexOf('amyfx-blueprint-hotfix-v1.js') < html.indexOf('amyfx-blueprint-v1.js'));
  }
});

test('Blueprint context exposes separate market timestamps and canonical conflicts', async () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  const canonicalState = {
    quote: { price: 4092, capturedAt: now },
    mapping: { capturedAt: old, timeframe: 'M15' },
    liquidity: { capturedAt: now },
    heatmap: { capturedAt: old },
    news: { capturedAt: now }
  };
  const contract = {
    read() { return canonicalState; },
    snapshot() { return { currentPrice: 4092, conflicts: [{ code: 'QUOTE_MAPPING_TIMESTAMP_SKEW' }] }; },
    assess(domain, value) { return { state: domain === 'quote' ? 'LIVE' : 'FRESH', capturedAt: value?.capturedAt || null }; }
  };
  const window = {
    AmyFXMarketContract: contract,
    AmyFXMarketState: { result: { tf: 'M15' } },
    AmyFXOS: {
      async buildContext(sourceModule) { return { source_module: sourceModule, payload: {}, source_refs: [] }; },
      repository: null
    },
    addEventListener() {},
    dispatchEvent() {}
  };
  const document = {
    readyState: 'loading',
    hidden: false,
    addEventListener() {},
    querySelector() { return null; }
  };
  const sandbox = {
    window, document,
    location: { pathname: '/apps/mapping/index.html' },
    localStorage: storage(),
    sessionStorage: storage(),
    CustomEvent: class {},
    Date, Number, Object, Array, String, Boolean, RegExp, Set, Map, Math, JSON, Intl, Promise,
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {}, console
  };
  vm.runInNewContext(hotfixSource, sandbox, { filename: 'amyfx-blueprint-hotfix-v1.js' });
  assert.equal(window.AmyFXBlueprintHotfix.patchCanonicalContext(), true);
  const context = await window.AmyFXOS.buildContext('mapping');
  assert.equal(context.captured_at, old);
  assert.equal(context.payload.workspace.market.timestamps.quote, now);
  assert.equal(context.payload.workspace.market.timestamps.mapping, old);
  assert.equal(context.conflicts[0].code, 'QUOTE_MAPPING_TIMESTAMP_SKEW');
});
