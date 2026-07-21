import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMarketRegimeV2 } from '../app/src/main/assets/apps/mapping/js/engine/market-regime-engine.js';

function trending(count = 180, direction = 1) {
  const output = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const drift = direction * (0.28 + Math.sin(index / 9) * 0.04);
    const open = price;
    const close = open + drift;
    output.push({ time: index * 900, open, high: Math.max(open, close) + 0.16, low: Math.min(open, close) - 0.12, close });
    price = close;
  }
  return output;
}

function ranging(count = 180) {
  const output = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const target = 2000 + Math.sin(index / 2.4) * 1.2;
    const open = price;
    const close = target;
    output.push({ time: index * 900, open, high: Math.max(open, close) + 0.55, low: Math.min(open, close) - 0.55, close });
    price = close;
  }
  return output;
}

test('stable directional series is classified as trending', () => {
  const result = detectMarketRegimeV2({
    candles: trending(),
    htfBiases: { H1: 'BULLISH', H4: 'BULLISH', D1: 'BULLISH' }
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.regime, 'TRENDING');
  assert.ok(result.shift.risk < 55);
});

test('alternating low-efficiency series is not forced into trending', () => {
  const result = detectMarketRegimeV2({ candles: ranging(), htfBiases: { H1: 'NEUTRAL' } });
  assert.notEqual(result.regime, 'TRENDING');
  assert.ok(result.probabilities.RANGING >= 20);
});

test('failed opposite transition blocks action', () => {
  const candles = trending();
  const result = detectMarketRegimeV2({
    candles,
    htfBiases: { H1: 'BULLISH', H4: 'BEARISH', D1: 'BEARISH' },
    marketConcepts: {
      structure: {
        confirmedTrend: 'BULLISH',
        transitionBreak: { index: candles.length - 2, dir: 'BEARISH' },
        lastFailedBreak: { index: candles.length - 1 },
        lastEvent: { index: candles.length - 1, bodyRatio: 0.2 }
      }
    },
    entryMap: { activeSetup: { live: true, dir: 'BUY' } }
  });
  assert.equal(result.action, 'WAIT');
  assert.ok(result.shift.risk >= 55);
});

test('entry map is only actionable when strategy and context align', () => {
  const result = detectMarketRegimeV2({
    candles: trending(),
    htfBiases: { H1: 'BULLISH', H4: 'BULLISH', D1: 'BULLISH' },
    entryMap: { activeSetup: { live: true, dir: 'BUY' } }
  });
  assert.equal(result.action, 'BUY');
  assert.ok(result.setupQuality >= 55);
});