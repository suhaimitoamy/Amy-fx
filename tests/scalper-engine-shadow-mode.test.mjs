import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateCandidate,
  advanceSetupLifecycle,
  assignRecommendations,
  findNextOpen,
  h1OrderFlowAt
} from '../supabase/functions/scalper-engine/engine.mjs';

function candle(openTime, open, high, low, close, seconds = 900) {
  return { open_time: openTime, close_time: openTime + seconds, open, high, low, close, is_closed: true };
}

test('H1 order flow only uses fully closed candles and causal confirmed swings', () => {
  const base = 1_700_000_000;
  const rows = [
    candle(base, 100, 101, 99, 100, 3600),
    candle(base + 3600, 100, 102, 99.5, 101, 3600),
    candle(base + 7200, 101, 105, 100, 104, 3600),
    candle(base + 10800, 104, 104.5, 101, 102, 3600),
    candle(base + 14400, 102, 103, 100.5, 102, 3600),
    candle(base + 18000, 102, 106, 101.5, 106, 3600)
  ];
  assert.equal(h1OrderFlowAt(rows, base + 21600).bias, 'BULLISH');
});

test('IFVG geometry locks next-open entry, structural wick stop, 1R BE and 2R target', () => {
  const candidate = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'WAITING_NEXT_OPEN',
    stop_reference: 100, atr_at_signal: 10, buffer_atr: 0.20,
    quality: { stop_basis_label: 'Structural Wick + ATR Buffer' }
  };
  const { setup } = activateCandidate(candidate, { open_time: 1000, price: 105, source: 'M1_NEXT_OPEN' });
  assert.equal(setup.initial_stop_loss, 98);
  assert.equal(setup.risk, 7);
  assert.equal(setup.break_even_trigger, 112);
  assert.equal(setup.target_price, 119);
  assert.equal(setup.quality.entry_locked, true);
  assert.equal(setup.quality.stop_basis_label, 'Structural Wick + ATR Buffer');
});

test('next-open entry starts after setup detection and ignores older historical M1 candles', () => {
  const base = 1_700_200_000;
  const candidate = {
    signal_candle_close_time: base,
    created_at: base + 310
  };
  const result = findNextOpen(candidate, {
    m1: [
      candle(base + 60, 101, 102, 100, 101, 60),
      candle(base + 300, 102, 103, 101, 102, 60),
      candle(base + 360, 103, 104, 102, 103, 60)
    ]
  });
  assert.equal(result.open_time, base + 360);
  assert.equal(result.price, 103);
});

test('ATR buffer cannot rescue a structural stop reference on the wrong side of entry', () => {
  const candidate = {
    model: 'IFVG_SCALPER', direction: 'SELL', status: 'WAITING_NEXT_OPEN',
    stop_reference: 99, atr_at_signal: 20, buffer_atr: 0.20, quality: {}
  };
  const { setup } = activateCandidate(candidate, { open_time: 1000, price: 100, source: 'M1_NEXT_OPEN' });
  assert.equal(setup.status, 'INVALIDATED');
  assert.equal(setup.quality.invalidation_reason, 'STRUCTURAL_REFERENCE_WRONG_SIDE');
  assert.equal(setup.entry_price ?? null, null);
});

test('adverse stop is checked before BE on the same candle', () => {
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: 1_700_000_000,
    entry_price: 105, initial_stop_loss: 99, stop_loss: 99, break_even_trigger: 111,
    target_price: 117, risk: 6, max_bars: 4, bars_elapsed: 0, be_armed: false,
    quality: { entry_locked: true, lifecycle_sequence: 1 }
  };
  const result = advanceSetupLifecycle(setup, [candle(1_700_000_000, 105, 112, 98, 110)]);
  assert.equal(result.setup.status, 'SL_HIT');
  assert.equal(result.setup.result_r, -1);
});

test('fourth candle exits directly without redundant BE event', () => {
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: 1_700_000_000,
    entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105,
    target_price: 110, risk: 5, max_bars: 4, bars_elapsed: 3, be_armed: false,
    last_evaluated_open_time: 1_700_001_800,
    quality: { entry_locked: true, lifecycle_sequence: 1 }
  };
  const result = advanceSetupLifecycle(setup, [candle(1_700_002_700, 102, 106, 101, 104)]);
  assert.equal(result.setup.status, 'TIME_EXIT');
  assert.deepEqual(result.events.map(item => item.status), ['TIME_EXIT']);
});

test('all setups remain monitored while only two receive VALID recommendation', () => {
  const base = { status: 'ACTIVE', direction: 'BUY', zone_bottom: 100, zone_top: 102, priority: 1 };
  const result = assignRecommendations([
    { ...base, id: 'a', signal_candle_close_time: 1000 },
    { ...base, id: 'b', signal_candle_close_time: 5000, zone_bottom: 105, zone_top: 106 },
    { ...base, id: 'c', signal_candle_close_time: 9000, zone_bottom: 108, zone_top: 109 }
  ], 2);
  assert.deepEqual(result.map(item => item.recommendation_status), ['VALID', 'VALID', 'RISK_LIMIT']);
  assert.equal(result.length, 3);
});

test('live M1 monitoring arms BE promptly while lifecycle remains four M15 candles', () => {
  const base = 1_700_100_000;
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: base,
    entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105,
    target_price: 110, risk: 5, max_bars: 4, bars_elapsed: 0, be_armed: false,
    quality: { entry_locked: true, lifecycle_sequence: 1 }
  };
  const first = advanceSetupLifecycle(setup, [candle(base, 100, 105.5, 99, 105, 60)], { evaluationSeconds: 60 });
  assert.equal(first.setup.status, 'BE_ACTIVE');
  assert.equal(first.setup.bars_elapsed, 0);
  assert.deepEqual(first.events.map(item => item.status), ['BE_ACTIVE']);

  const finalMinute = candle(base + 3540, 104, 106, 103, 104, 60);
  const last = advanceSetupLifecycle({ ...first.setup, last_evaluated_open_time: base }, [finalMinute], { evaluationSeconds: 60 });
  assert.equal(last.setup.status, 'TIME_EXIT');
  assert.equal(last.setup.bars_elapsed, 4);
});

test('SL is not evaluated until entry lock is durable', () => {
  const base = 1_700_300_000;
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: base,
    entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105,
    target_price: 110, risk: 5, max_bars: 4, bars_elapsed: 0, be_armed: false, quality: {}
  };
  const result = advanceSetupLifecycle(setup, [candle(base, 100, 101, 94, 95, 60)], { evaluationSeconds: 60 });
  assert.equal(result.setup.status, 'ACTIVE');
  assert.deepEqual(result.events, []);
  assert.equal(result.setup.last_evaluated_open_time, undefined);
});

test('high or low from before entry timestamp cannot trigger lifecycle', () => {
  const base = 1_700_400_000;
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: base,
    entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105,
    target_price: 110, risk: 5, max_bars: 4, bars_elapsed: 0, be_armed: false,
    quality: { entry_locked: true, lifecycle_sequence: 1 }
  };
  const result = advanceSetupLifecycle(setup, [
    candle(base - 60, 100, 101, 90, 94, 60),
    candle(base, 100, 102, 99, 101, 60)
  ], { evaluationSeconds: 60 });
  assert.equal(result.setup.status, 'ACTIVE');
  assert.deepEqual(result.events, []);
  assert.equal(result.setup.last_evaluated_open_time, base);
});

test('unclosed M1 candle cannot define or trigger final lifecycle state', () => {
  const base = 1_700_500_000;
  const setup = {
    model: 'IFVG_SCALPER', direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: base,
    entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105,
    target_price: 110, risk: 5, max_bars: 4, bars_elapsed: 0, be_armed: false,
    quality: { entry_locked: true, lifecycle_sequence: 1 }
  };
  const active = { ...candle(base, 100, 101, 90, 94, 60), is_closed: false };
  const result = advanceSetupLifecycle(setup, [active], { evaluationSeconds: 60 });
  assert.equal(result.setup.status, 'ACTIVE');
  assert.deepEqual(result.events, []);
  assert.equal(result.setup.last_evaluated_open_time, undefined);
});
