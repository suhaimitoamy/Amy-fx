import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateCandidate,
  advanceSetupLifecycle,
  derivePatternFeatures,
  evaluateScalperCandidates,
  resolveTriggerEntry,
} from '../supabase/functions/scalper-engine/engine.mjs';

function candle(time, open, high, low, close, seconds = 60) {
  return { open_time: time, close_time: time + seconds, open, high, low, close, is_closed: true };
}

function passingCrtFixture() {
  const base = 1_700_000_000;
  const h4 = [];
  for (let index = 0; index < 80; index += 1) {
    h4.push(candle(base + index * 14400, 100, 102, 98, 100, 14400));
  }
  h4.push(candle(base + 80 * 14400, 99, 101, 93, 100.5, 14400));
  return { base, h4 };
}

test('pattern features use the selected closed signal candle without future-candle leakage', () => {
  const base = 1_710_000_000;
  const rows = [];
  for (let index = 0; index < 80; index += 1) {
    const price = 100 + index * 0.1;
    rows.push(candle(base + index * 900, price, price + 2, price - 2, price + 0.5, 900));
  }
  const signalOpenTime = rows[70].open_time;
  const before = derivePatternFeatures({
    rows: rows.slice(0, 71),
    timeframeSeconds: 900,
    signalOpenTime,
    direction: 'BUY',
    stopReference: 90,
  });
  const after = derivePatternFeatures({
    rows: [...rows, candle(base + 80 * 900, 1000, 2000, 1, 1500, 900)],
    timeframeSeconds: 900,
    signalOpenTime,
    direction: 'BUY',
    stopReference: 90,
  });
  assert.deepEqual(after, before);
  assert.equal(before.trend_aligned, true);
  assert.ok(before.close_strength > 0.5);
  assert.equal(before.atr_ratio50_samples, 50);
});

test('per-driver kill switch rejects an otherwise accepted CRT candidate with telemetry', () => {
  const { base, h4 } = passingCrtFixture();
  const result = evaluateScalperCandidates({
    series: { H4: h4 },
    h1: h4,
    nowSeconds: base + 81 * 14400,
    maxSignalAgeSeconds: 20000,
    config: { driver_enabled: { CRT: false } },
  });
  assert.equal(result.candidates.some(candidate => candidate.driver_id === 'CRT'), false);
  const rejection = result.telemetry.find(item => item.driver_id === 'CRT');
  assert.equal(rejection.accepted, false);
  assert.equal(rejection.gate_id, 'DRIVER_KILL_SWITCH');
});

test('BT6 lifecycle locks fixed +10/+20 targets and never moves stop to breakeven', () => {
  const candidate = {
    schema_version: 3,
    direction: 'BUY',
    status: 'WAITING_NEXT_OPEN',
    stop_reference: 95,
    atr_at_signal: 10,
    buffer_atr: 0.18,
    recommendation_status: 'PENDING',
    quality: {
      lifecycle_policy: 'BT6_FIXED_POINTS_NO_BE',
      tp1_points: 10,
      tp2_points: 20,
      stop_cap_points: 50,
      max_hold_seconds: 86400,
    },
  };
  const activated = activateCandidate(candidate, { open_time: 1000, price: 100, source: 'M1_NEXT_OPEN' }).setup;
  assert.equal(activated.initial_stop_loss, 93.2);
  assert.equal(activated.break_even_trigger, 110);
  assert.equal(activated.target_price, 120);

  const tp1 = advanceSetupLifecycle(activated, [candle(1000, 100, 111, 99, 110)], { evaluationSeconds: 60 });
  assert.equal(tp1.setup.status, 'ACTIVE');
  assert.equal(tp1.setup.stop_loss, 93.2);
  assert.equal(tp1.setup.be_armed, false);
  assert.equal(tp1.setup.quality.tp1_hit, true);
  assert.deepEqual(tp1.events.map(event => event.status), ['TP1_HIT']);

  const tp2 = advanceSetupLifecycle(tp1.setup, [candle(1060, 110, 121, 109, 120)], { evaluationSeconds: 60 });
  assert.equal(tp2.setup.status, 'TP_HIT');
  assert.deepEqual(tp2.events.map(event => event.status), ['TP_HIT']);
});

test('BT6 same M1 candle resolves Stop Loss before TP1 or TP2', () => {
  const setup = {
    schema_version: 3,
    direction: 'BUY',
    status: 'ACTIVE',
    entry_candle_open_time: 2000,
    entry_price: 100,
    initial_stop_loss: 95,
    stop_loss: 95,
    break_even_trigger: 110,
    target_price: 120,
    risk: 5,
    quality: { entry_locked: true, lifecycle_policy: 'BT6_FIXED_POINTS_NO_BE', max_hold_seconds: 86400, tp1_hit: false },
  };
  const result = advanceSetupLifecycle(setup, [candle(2000, 100, 121, 94, 110)], { evaluationSeconds: 60 });
  assert.equal(result.setup.status, 'SL_HIT');
  assert.deepEqual(result.events.map(event => event.status), ['SL_HIT']);
});

test('AMD midpoint entry cancels on manipulation break before evaluating a same-candle fill', () => {
  const base = 1_720_000_000;
  const candidate = {
    status: 'WAITING_TRIGGER',
    direction: 'BUY',
    signal_candle_close_time: base,
    stop_reference: 90,
    quality: {
      planned_entry_price: 100,
      manipulation_extreme: 90,
      trigger_wait_seconds: 16 * 3600,
    },
  };
  const filled = resolveTriggerEntry(candidate, {
    m1: [candle(base, 101, 102, 99, 100)],
    nowSeconds: base + 60,
  });
  assert.equal(filled.nextOpen.price, 100);
  assert.equal(filled.nextOpen.source, 'FVG_MIDPOINT_LIMIT');

  const cancelled = resolveTriggerEntry(candidate, {
    m1: [candle(base, 101, 102, 89, 100)],
    nowSeconds: base + 60,
  });
  assert.equal(cancelled.nextOpen, null);
  assert.equal(cancelled.setup.status, 'CANCELLED');
  assert.equal(cancelled.setup.quality.invalidation_reason, 'AMD_MANIPULATION_EXTREME_BROKEN_BEFORE_FILL');
});

test('AMD detects the shortest valid accumulation window and emits an M30 midpoint-limit candidate', () => {
  const base = 1_730_000_000;
  const m30 = [];
  for (let index = 0; index < 74; index += 1) {
    m30.push(candle(base + index * 1800, 100, 102, 98, 100, 1800));
  }
  for (const [offset, price] of [96, 98, 100, 102, 104, 100].entries()) {
    m30.push(candle(base + (74 + offset) * 1800, price, price + 2, price - 2, price, 1800));
  }
  m30.push(candle(base + 80 * 1800, 98, 101, 92, 99.5, 1800));
  m30.push(candle(base + 81 * 1800, 99.5, 105, 99, 104.5, 1800));
  m30.push(candle(base + 82 * 1800, 103, 106, 102, 105, 1800));

  const result = evaluateScalperCandidates({
    series: { M30: m30 },
    h1: [],
    nowSeconds: base + 83 * 1800,
    maxSignalAgeSeconds: 4000,
  });
  const amd = result.candidates.find(candidate => candidate.driver_id === 'AMD');
  assert.ok(amd);
  assert.equal(amd.status, 'WAITING_TRIGGER');
  assert.equal(amd.timeframe, 'M30');
  assert.equal(amd.quality.accumulation_window, 6);
  assert.equal(amd.quality.entry_model, 'FVG_MIDPOINT_LIMIT');
  assert.equal(amd.quality.fvg_midpoint, 101.5);
  assert.equal(amd.quality.pattern_gate, 'AMD_DISTRIBUTION');
});
