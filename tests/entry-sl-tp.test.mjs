import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createM15EntryPlan,
  advanceM15EntryLifecycle
} from '../app/src/main/assets/apps/mapping/js/engine/concept-entry-map.js';

const candle = (open, high, low, close, time = 0) => ({ open, high, low, close, time });

test('M15 Entry Map uses MSS close, 0.10 ATR stop buffer, 0.35R TP1 and 1.75R TP2', () => {
  const plan = createM15EntryPlan({
    direction: 'BULLISH',
    candle: candle(104, 108, 103, 107, 100),
    index: 10,
    atr: 5,
    protectedSwing: 100,
    sweep: { type: 'SSL', index: 7 }
  });
  assert.equal(plan.entry, 107);
  assert.equal(plan.initialSl, 99.5);
  assert.equal(plan.risk, 7.5);
  assert.equal(plan.tp1, 109.625);
  assert.equal(plan.tp2, 120.125);
  assert.equal(plan.expiryBars, 36);
});

test('setup candle itself cannot hit SL or target', () => {
  const plan = createM15EntryPlan({ direction: 'BULLISH', candle: candle(99.5, 101, 99, 100), index: 5, atr: 1, protectedSwing: 98 });
  advanceM15EntryLifecycle(plan, candle(100, 200, 1, 110), 5);
  assert.equal(plan.live, true);
  assert.equal(plan.lifecycleStatus, 'LONG ACTIVE');
});

test('before TP1, SL has priority when one candle spans SL and targets', () => {
  const plan = createM15EntryPlan({ direction: 'BULLISH', candle: candle(100, 101, 99, 100), index: 5, atr: 1, protectedSwing: 98 });
  advanceM15EntryLifecycle(plan, candle(100, 110, 90, 105), 6);
  assert.equal(plan.live, false);
  assert.equal(plan.lifecycleStatus, 'SL HIT');
});

test('TP1 moves stop to break-even and a later return closes the runner', () => {
  const plan = createM15EntryPlan({ direction: 'BEARISH', candle: candle(100, 101, 99, 100), index: 5, atr: 1, protectedSwing: 102 });
  advanceM15EntryLifecycle(plan, candle(100, 100.2, 98.9, 99), 6);
  assert.equal(plan.tp1Hit, true);
  assert.equal(plan.sl, plan.entry);
  assert.equal(plan.live, true);
  advanceM15EntryLifecycle(plan, candle(99, 100.1, 98.8, 99.5), 7);
  assert.equal(plan.live, false);
  assert.equal(plan.lifecycleStatus, 'TP1 / BE');
});

test('after TP1, TP2 has priority over break-even on the same candle', () => {
  const plan = createM15EntryPlan({ direction: 'BULLISH', candle: candle(100, 101, 99, 100), index: 5, atr: 1, protectedSwing: 98 });
  advanceM15EntryLifecycle(plan, candle(100, 102, 99.5, 101), 6);
  assert.equal(plan.tp1Hit, true);
  advanceM15EntryLifecycle(plan, candle(100, 110, 90, 101), 7);
  assert.equal(plan.lifecycleStatus, 'TP2 HIT');
});

test('live setup expires after exactly 36 M15 candles', () => {
  const plan = createM15EntryPlan({ direction: 'BULLISH', candle: candle(100, 101, 99, 100), index: 5, atr: 1, protectedSwing: 98 });
  for (let index = 6; index <= 41; index += 1) {
    advanceM15EntryLifecycle(plan, candle(100, 100.1, 99.9, 100), index);
  }
  assert.equal(plan.live, false);
  assert.equal(plan.lifecycleStatus, 'EXPIRED');
  assert.equal(plan.endIndex, 41);
});
