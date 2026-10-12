import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE_URL = new URL(
  '../app/src/main/assets/apps/mapping/js/honesty-audit-runtime-v1.js',
  import.meta.url
);

function buildRuntime(overrides = {}) {
  const storage = new Map();
  const listeners = new Map();
  const window = {
    state: {
      tf: 'M15',
      candles: {
        M15: [
          { time: 1_577_836_800, open: 1_520, high: 1_521, low: 1_519, close: 1_520.5 }
        ]
      },
      result: {
        tf: 'M15',
        dataStale: false,
        directionDecision: {
          signal: 'BUY',
          source: 'VALIDATED_DIRECTION_FORECAST',
          status: 'BULLISH · VALIDATED FORECAST (60%)'
        },
        validatedMarketContext: {
          directionForecast: {
            active: true,
            direction: 'BULLISH',
            directionValue: 1,
            confidence: 60,
            confidenceMeaning: 'DISPLAY_CONFIDENCE_FROM_VALIDATED_BACKTEST_NOT_LIVE_WIN_PROBABILITY'
          }
        },
        setupExecution: {
          active: false,
          terminal: false,
          direction: 'WAIT'
        }
      }
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatchEvent() {},
    ...overrides
  };
  const document = {
    body: { appendChild() {} },
    getElementById() { return null; },
    createTreeWalker() { return { nextNode() { return null; } }; },
    createElement() {
      return { click() {}, remove() {} };
    }
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  return {
    context: {
      window,
      document,
      localStorage,
      NodeFilter: { SHOW_TEXT: 4 },
      CustomEvent: class CustomEvent {
        constructor(type, options) { this.type = type; this.detail = options?.detail; }
      },
      Blob: class Blob {},
      URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
      console,
      setInterval() { return 1; },
      setTimeout(callback) { callback(); return 1; },
      clearInterval() {},
      clearTimeout() {},
      Date,
      JSON,
      Math,
      Number,
      Object,
      Array,
      String,
      RegExp,
      Boolean
    },
    window,
    storage
  };
}

async function loadRuntime(runtime) {
  const source = await readFile(SOURCE_URL, 'utf8');
  vm.runInNewContext(source, runtime.context, { filename: SOURCE_URL.pathname });
}

test('runtime removes forecast percentage instead of presenting it as live probability', async () => {
  const runtime = buildRuntime();
  await loadRuntime(runtime);

  const item = runtime.window.AmyFXHonestyAudit.capture();
  assert.equal(
    runtime.window.state.result.directionDecision.status,
    'BULLISH · AMY-SMC-D · HISTORICAL REFERENCE ONLY'
  );
  assert.equal(item.directionDecision.status.includes('%'), false);
  assert.equal(
    runtime.window.AmyFXHonestyAudit.getAnomalies().some(
      issue => issue.code === 'SCORE_PRESENTED_AS_PROBABILITY'
    ),
    false
  );
});

test('runtime records stale-data and inactive-forecast setup contradictions', async () => {
  const runtime = buildRuntime();
  runtime.window.state.result.dataStale = true;
  runtime.window.state.result.directionDecision.signal = 'SELL';
  runtime.window.state.result.validatedMarketContext.directionForecast.active = false;
  runtime.window.state.result.setupExecution = {
    active: true,
    terminal: false,
    direction: 'SELL',
    entryLow: 1_518,
    entryHigh: 1_519,
    stopLoss: 1_521,
    target1: 1_514,
    singleTarget: true
  };
  await loadRuntime(runtime);

  runtime.window.AmyFXHonestyAudit.capture();
  const codes = new Set(
    runtime.window.AmyFXHonestyAudit.getAnomalies().map(issue => issue.code)
  );
  assert.ok(codes.has('STALE_DATA_DIRECTION'));
  assert.ok(codes.has('STALE_DATA_ACTIVE_SETUP'));
  assert.ok(codes.has('INACTIVE_FORECAST_ACTIVE_SETUP'));
});
