import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIVER_REGISTRY, activateCandidate, advanceSetupLifecycle, assignRecommendations, detectScalperCandidates, selectPrimarySetup } from '../supabase/functions/scalper-engine/engine.mjs';

function candle(time, open, high, low, close, seconds = 900) {
  return { open_time: time, close_time: time + seconds, open, high, low, close, is_closed: true };
}

test('registry contains thirteen active Scalper drivers including ERR and SMR and no IFVG', () => {
  assert.equal(DRIVER_REGISTRY.length, 13);
  assert.equal(DRIVER_REGISTRY.some(driver => driver.id.includes('IFVG')), false);
  assert.deepEqual(DRIVER_REGISTRY.find(driver => driver.id === 'FVG').timeframes, ['H4']);
  assert.deepEqual(DRIVER_REGISTRY.find(driver => driver.id === 'FALSE_BREAKOUT').timeframes, ['M15', 'H1', 'H4']);
  assert.deepEqual(DRIVER_REGISTRY.find(driver => driver.id === 'AMD').timeframes, ['M30', 'H1']);
  assert.deepEqual(DRIVER_REGISTRY.find(driver => driver.id === 'EXPANSION_RANGE_REENTRY').timeframes, ['M15']);
  assert.equal(DRIVER_REGISTRY.find(driver => driver.id === 'EXPANSION_RANGE_REENTRY').name, 'Expansion Range Re-entry');
  assert.deepEqual(DRIVER_REGISTRY.find(driver => driver.id === 'SMR_FIRST_RETEST').timeframes, ['M5']);
  assert.equal(DRIVER_REGISTRY.find(driver => driver.id === 'SMR_FIRST_RETEST').name, 'SMR / First Retest');
});

test('CRT H4 creates deterministic candidate from one-sided sweep reclaim', () => {
  const base = 1_700_000_000;
  const h4 = [];
  for (let index = 0; index < 80; index += 1) h4.push(candle(base + index * 14400, 100, 102, 98, 100, 14400));
  h4.push(candle(base + 80 * 14400, 99, 101, 93, 100.5, 14400));
  const input = { series: { H4: h4 }, h1: h4, nowSeconds: base + 81 * 14400, maxSignalAgeSeconds: 20000 };
  const first = detectScalperCandidates(input).find(candidate => candidate.driver_id === 'CRT');
  const second = detectScalperCandidates(input).find(candidate => candidate.driver_id === 'CRT');
  assert.ok(first);
  assert.equal(first.id, second.id);
  assert.equal(first.direction, 'BUY');
  assert.equal(first.timeframe, 'H4');
  assert.equal(first.schema_version, 3);
  assert.equal(first.quality.pattern_gate, 'CRT_A');
});

test('activation uses structural invalidation and locks entry before lifecycle', () => {
  const candidate = { direction: 'BUY', status: 'WAITING_NEXT_OPEN', stop_reference: 100, atr_at_signal: 10, buffer_atr: .1, recommendation_status: 'PENDING', quality: { target_r: 2, max_hold_seconds: 86400 } };
  const { setup } = activateCandidate(candidate, { open_time: 1000, price: 105, source: 'M1_NEXT_OPEN' });
  assert.equal(setup.status, 'ACTIVE');
  assert.equal(setup.initial_stop_loss, 99);
  assert.equal(setup.break_even_trigger, 111);
  assert.equal(setup.target_price, 117);
  assert.equal(setup.quality.entry_locked, true);
});

test('pre-entry candle cannot hit SL', () => {
  const setup = { direction: 'BUY', status: 'ACTIVE', entry_candle_open_time: 1000, entry_price: 100, initial_stop_loss: 95, stop_loss: 95, break_even_trigger: 105, target_price: 110, risk: 5, quality: { entry_locked: true, max_hold_seconds: 86400 } };
  const result = advanceSetupLifecycle(setup, [candle(940, 100, 101, 90, 91, 60), candle(1000, 100, 101, 99, 100, 60)], { evaluationSeconds: 60 });
  assert.equal(result.setup.status, 'ACTIVE');
});

test('all active setups remain available and primary ranking is display-only', () => {
  const setups = [
    { id: 'a', status: 'WAITING_NEXT_OPEN', priority: 20, signal_candle_close_time: 100, direction: 'BUY', zone_bottom: 1, zone_top: 2 },
    { id: 'b', status: 'ACTIVE', priority: 40, signal_candle_close_time: 200, direction: 'SELL', zone_bottom: 3, zone_top: 4 },
    { id: 'c', status: 'ACTIVE', priority: 10, signal_candle_close_time: 300, direction: 'BUY', zone_bottom: 5, zone_top: 6 }
  ];
  const assigned = assignRecommendations(setups);
  assert.deepEqual(assigned.map(setup => setup.recommendation_status), ['VALID', 'VALID', 'VALID']);
  assert.equal(selectPrimarySetup(assigned).id, 'c');
  assert.equal(assigned.length, 3);
});

test('terminal lifecycle cannot be activated again', () => {
  const terminal = { status: 'SL_HIT', direction: 'BUY', entry_price: 100, stop_reference: 95, quality: { lifecycle_sequence: 4 } };
  const result = activateCandidate(terminal, { open_time: 2000, price: 101, source: 'M1_NEXT_OPEN' });
  assert.equal(result.setup.status, 'SL_HIT');
  assert.equal(result.event, null);
});
