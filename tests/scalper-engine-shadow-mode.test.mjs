import test from 'node:test';
import assert from 'node:assert/strict';
import { activateCandidate, advanceSetupLifecycle, assignRecommendations, h1OrderFlowAt } from '../supabase/functions/scalper-engine/engine.mjs';

function candle(openTime, open, high, low, close, seconds = 900) {
  return { open_time: openTime, close_time: openTime + seconds, open, high, low, close, is_closed: true };
}

test('H1 bias hanya memakai candle close dan swing causal', () => {
  const base = 1_700_000_000;
  const rows = [
    candle(base,100,101,99,100,3600), candle(base+3600,100,102,99.5,101,3600),
    candle(base+7200,101,105,100,104,3600), candle(base+10800,104,104.5,101,102,3600),
    candle(base+14400,102,103,100.5,102,3600), candle(base+18000,102,106,101.5,106,3600)
  ];
  assert.equal(h1OrderFlowAt(rows, base + 21600).bias, 'BULLISH');
});

test('IFVG mengunci next-open, local wick, BE 1R dan target 2R', () => {
  const candidate = { model:'IFVG_SCALPER', direction:'BUY', status:'WAITING_NEXT_OPEN', stop_reference:100, atr_at_signal:10, buffer_atr:0.10, quality:{} };
  const { setup } = activateCandidate(candidate, { open_time:1000, price:105, source:'M1_NEXT_OPEN' });
  assert.equal(setup.initial_stop_loss, 99);
  assert.equal(setup.risk, 6);
  assert.equal(setup.break_even_trigger, 111);
  assert.equal(setup.target_price, 117);
});

test('SL adverse diperiksa sebelum BE pada candle yang sama', () => {
  const base = 1_700_000_000;
  const setup = { model:'IFVG_SCALPER', direction:'BUY', status:'ACTIVE', entry_candle_open_time:base, entry_price:105, initial_stop_loss:99, stop_loss:99, break_even_trigger:111, target_price:117, risk:6, max_bars:4, bars_elapsed:0, be_armed:false, quality:{} };
  const result = advanceSetupLifecycle(setup, [candle(base,105,112,98,110)]);
  assert.equal(result.setup.status, 'SL_HIT');
  assert.equal(result.setup.result_r, -1);
});

test('candle keempat langsung TIME_EXIT tanpa event BE berlebih', () => {
  const base = 1_700_000_000;
  const setup = { model:'IFVG_SCALPER', direction:'BUY', status:'ACTIVE', entry_candle_open_time:base, entry_price:100, initial_stop_loss:95, stop_loss:95, break_even_trigger:105, target_price:110, risk:5, max_bars:4, bars_elapsed:3, be_armed:false, last_evaluated_open_time:base+1800, quality:{} };
  const result = advanceSetupLifecycle(setup, [candle(base+2700,102,106,101,104)]);
  assert.equal(result.setup.status, 'TIME_EXIT');
  assert.deepEqual(result.events.map(item => item.status), ['TIME_EXIT']);
});

test('semua setup dipantau tetapi hanya dua berstatus VALID', () => {
  const base = { status:'ACTIVE', direction:'BUY', zone_bottom:100, zone_top:102, priority:1 };
  const result = assignRecommendations([
    {...base,id:'a',signal_candle_close_time:1000},
    {...base,id:'b',signal_candle_close_time:5000,zone_bottom:105,zone_top:106},
    {...base,id:'c',signal_candle_close_time:9000,zone_bottom:108,zone_top:109}
  ], 2);
  assert.deepEqual(result.map(item => item.recommendation_status), ['VALID','VALID','RISK_LIMIT']);
  assert.equal(result.length, 3);
});
