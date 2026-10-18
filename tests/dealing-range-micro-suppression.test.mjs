import test from 'node:test';
import assert from 'node:assert/strict';
import { entryAssistantV3 } from '../app/src/main/assets/apps/mapping/js/ict-workspace/amy-ict.js';

test('Item 1.79: entryAssistantV3 suppresses micro-range distortion when range < minRange', () => {
  // Candle close at 2650.00
  const candles = [
    { open_time: 1000, close_time: 1900, open: 2650, high: 2651, low: 2649, close: 2650, is_closed: true },
    { open_time: 1900, close_time: 2800, open: 2650, high: 2651.2, low: 2649.5, close: 2650.5, is_closed: true }
  ];

  // Micro range: rangeHigh = 2651.50, rangeLow = 2650.00 (delta = 1.50, way below 6.0 minRange)
  const d = {
    biasDir: 1,
    atr: 1.0,
    rangeHigh: 2651.50,
    rangeLow: 2650.00,
    invalidStatus: 0
  };

  const plan = entryAssistantV3(d, candles, {}, {}, {});
  assert.ok(plan, 'Plan must be returned');
  // With micro range of 1.50, inFiboOte must be false because autoRangeSize is suppressed
  assert.equal(plan.inFiboOte, false, 'Micro-range distortion must not trigger inFiboOte');
});

test('Item 1.79: entryAssistantV3 calculates valid Fibo OTE on healthy structural swing leg >= 6.0 points', () => {
  const candles = [
    { open_time: 1000, close_time: 1900, open: 2640, high: 2660, low: 2639, close: 2655, is_closed: true },
    { open_time: 1900, close_time: 2800, open: 2655, high: 2656, low: 2645, close: 2646, is_closed: true }
  ];

  // Healthy impulse swing: rangeHigh = 2660.00, rangeLow = 2640.00 (delta = 20.0 points)
  const d = {
    biasDir: 1,
    atr: 2.0,
    rangeHigh: 2660.00,
    rangeLow: 2640.00,
    invalidStatus: 0
  };

  const plan = entryAssistantV3(d, candles, {}, {}, {});
  assert.ok(plan);
  // Close at 2646 is between 61.8% (2647.64) and 78.6% (2644.28) of 2660->2640 BUY range
  assert.equal(plan.inFiboOte, true, 'Healthy impulse swing must trigger inFiboOte');
});
