import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildAmyExecutionContext,
  buildExecutionPlanViewModel,
  determineExecutionDisplayStatus
} from '../app/src/main/assets/apps/mapping/js/execution-plan-core.js';

const candleTime = 1_785_571_200;
const closedM15 = {
  time: candleTime,
  open: 3300,
  high: 3310,
  low: 3295,
  close: 3305,
  isClosed: true
};

function staleResult() {
  return {
    tf: 'M15',
    dataStale: true,
    st: { confirmedTrend: 'BEARISH', protectedHigh: 3310 },
    directionDecision: {
      bias: 'SELL',
      signal: 'WAIT',
      source: 'DATA_STALE',
      invalidated: false
    },
    mappingSnapshot: {
      timeframe: 'M15',
      freshness: {
        state: 'STALE',
        sourceCandleTime: candleTime
      },
      facts: {
        structure: { confirmedTrend: 'BEARISH', protectedHigh: 3310 }
      }
    }
  };
}

test('closed candle keeps the last analysis visible while stale remains internal', () => {
  const vm = buildExecutionPlanViewModel({
    result: staleResult(),
    runtimeState: { candles: { M15: [closedM15] } },
    mappingFreshness: { state: 'STALE' }
  });

  assert.equal(vm.mappingFreshness, 'CLOSED_CANDLE');
  assert.equal(vm.internalFreshness, 'STALE');
  assert.equal(vm.dataStatus, 'CANDLE TERTUTUP');
  assert.equal(vm.sourceTimeframe, 'M15');
  assert.match(vm.analysisTimeWita, /WITA/);
  assert.equal(vm.focusDirection, 'SELL');
  assert.doesNotMatch(vm.headline, /KEDALUWARSA|DATA MAPPING SUDAH LAMA/);
});

test('no candle and no analysis remains unavailable', () => {
  const status = determineExecutionDisplayStatus({});
  assert.equal(status.freshness.valid, false);
  assert.equal(status.freshness.state, 'UNAVAILABLE');
});

test('zero, null, and non-positive trade levels never enter Amy context', () => {
  const context = buildAmyExecutionContext({
    decision: 'WAIT',
    entry: 0,
    entryLow: 0,
    entryHigh: -1,
    stopLoss: 0,
    tp1: 0,
    tp2: -2,
    area: { low: 0, high: -3, level: 0 },
    structuralTarget: { level: 0 }
  });

  assert.equal(context.entry, null);
  assert.equal(context.entryArea.low, null);
  assert.equal(context.entryArea.high, null);
  assert.equal(context.stopLoss, null);
  assert.equal(context.tp1, null);
  assert.equal(context.tp2, null);
  assert.equal(context.watchArea.level, null);
  assert.equal(context.structuralTarget.level, null);
});

test('quote timestamp and liquidity-source differences do not create a scalper hard conflict', () => {
  const status = determineExecutionDisplayStatus({
    result: staleResult(),
    runtimeState: { candles: { M15: [closedM15] } },
    conflicts: [
      'QUOTE_MAPPING_TIMESTAMP_SKEW',
      'BSL_SOURCE_DIFFERENCE'
    ]
  });
  assert.equal(status.checks.noContextConflict, true);
});

test('scalping horizon keeps M15 primary and excludes H4 D1 W1', () => {
  const base = fs.readFileSync('app/src/main/assets/apps/mapping/js/outlook/v2/base.js', 'utf8');
  const block = base.match(/id: 'SCALPING'[\s\S]*?\n  \},/)?.[0] || '';
  assert.match(block, /M15: 0\.45/);
  assert.match(block, /M5: 0\.25/);
  assert.match(block, /M1: 0\.2/);
  assert.match(block, /M30: 0\.05/);
  assert.match(block, /H1: 0\.05/);
  assert.doesNotMatch(block, /H4|D1|W1/);

  const projection = fs.readFileSync('app/src/main/assets/apps/mapping/js/outlook/v2/projection.js', 'utf8');
  assert.match(projection, /config\.id === 'SCALPING' && m15Trend !== 0/);
  assert.match(projection, /outlooks\.length === OUTLOOK_HORIZONS\.length/);
});

test('SCALPING tracker uses WITA, half-hour slots, and normalized candle timestamps', () => {
  const tracker = fs.readFileSync('app/src/main/assets/apps/mapping/js/outlook/v2/tracker.js', 'utf8');
  assert.match(tracker, /Asia\/Makassar/);
  assert.match(tracker, /Math\.floor\(now \/ \(HOUR \/ 2\)\)/);
  assert.match(tracker, /candleTimeMs\(candle\.time\)/);
  assert.doesNotMatch(tracker, /Asia\/Jakarta/);
});

test('Analyze stability has no observer or synthetic scrolling', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/view-stability.js', 'utf8');
  assert.doesNotMatch(code, /MutationObserver|scrollIntoView|scrollTo\(|scrollBy\(/);
  assert.match(code, /STATIC_NATIVE_SCROLL/);
});

test('market data uses complete aggregation and keeps WebSocket display-only', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/api/market-data.js', 'utf8');
  assert.match(code, /aggregateClosedCandles/);
  assert.match(code, /WebSocket is display-only/);
  const liveTick = code.match(/function applyLivePriceTick[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(liveTick, /buildSetupExecution|buildMappingSnapshot|publishMappingSnapshot|notifyImportant/);
});

test('Asia Range uses canonical 06:00–14:00 WITA window', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/session/asia-range.js', 'utf8');
  assert.match(code, /const ASIA_START_HOUR = 6;/);
  assert.match(code, /const ASIA_END_HOUR = 14;/);
});

test('Preview version remains unchanged', () => {
  const appVersion = fs.readFileSync('app/src/main/assets/app-version.js', 'utf8');
  assert.match(appVersion, /2\.0\.0-preview\.306/);
});
