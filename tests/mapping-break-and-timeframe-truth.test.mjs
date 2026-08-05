import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBreak,
  resolveBreakInfo
} from '../app/src/main/assets/apps/mapping/js/integrity/mapping-integrity-core.js';
import {
  analyzeTimeframeSafely
} from '../app/src/main/assets/apps/mapping/js/engine/timeframe-analysis-contract.js';

function series(count = 300) {
  return Array.from({ length: count }, (_, index) => {
    const open = 4000 + index * 0.1;
    return {
      time: 1_700_000_000 + index * 900,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.4,
      isClosed: true
    };
  });
}

test('modern confirmed structure schema resolves as valid break', () => {
  const result = {
    st: {
      trend: 'BULLISH',
      lastEvent: {
        concept: 'BOS',
        direction: 'BULLISH',
        level: 4105.94,
        status: 'CONFIRMED_BREAK',
        valid: true,
        hasDisplacement: true
      }
    }
  };
  const info = resolveBreakInfo(result);
  const classification = classifyBreak(info, 'BULLISH');
  assert.equal(info.breakType, 'VALID_BREAK');
  assert.equal(info.price, 4105.94);
  assert.equal(classification.state, 'CONFIRMED');
  assert.match(classification.title, /VALID BOS BULLISH/);
});

test('break candidate is not falsely described as no candle close', () => {
  const classification = classifyBreak({
    concept: 'MSS',
    direction: 'BULLISH',
    level: 4105.94,
    status: 'BREAK_CANDIDATE',
    valid: false
  });
  assert.equal(classification.state, 'CANDIDATE');
  assert.match(classification.title, /BREAK CANDIDATE/);
  assert.doesNotMatch(classification.explanation, /Belum ada candle close/);
});

test('analysis exception with 300 candles is ANALYSIS_ERROR', () => {
  const state = analyzeTimeframeSafely({
    timeframe: 'M15',
    candles: series(),
    analyze() {
      throw new Error('synthetic engine failure');
    },
    currentPrice: 4135,
    minimumCandles: 30,
    nowMs: Date.UTC(2026, 7, 5, 5, 5, 0)
  });
  assert.equal(state.candleCount, 300);
  assert.equal(state.status, 'ANALYSIS_ERROR');
  assert.match(state.error, /synthetic engine failure/);
});

test('300 candles with successful analyzer produce READY', () => {
  const state = analyzeTimeframeSafely({
    timeframe: 'M15',
    candles: series(),
    analyze(values, tf) {
      return { tf, count: values.length, st: { trend: 'BULLISH' } };
    },
    currentPrice: 4135,
    minimumCandles: 30,
    nowMs: Date.UTC(2026, 7, 5, 5, 5, 0)
  });
  assert.equal(state.status, 'READY');
  assert.equal(state.result.count, 300);
});
