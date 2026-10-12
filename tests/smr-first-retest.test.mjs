import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SMR_FIRST_RETEST_DRIVER,
  detectSmrFirstRetestCandidates,
  evaluateSmrFirstRetestCandidates
} from '../supabase/functions/scalper-engine/smr-first-retest.mjs';

function candle(time, open, high, low, close, seconds) {
  return { open_time: time, close_time: time + seconds, open, high, low, close, is_closed: true };
}

function dailySeries(base) {
  const day = 86400;
  const rows = [
    [95, 100, 90, 96],
    [96, 102, 91, 98],
    [98, 105, 92, 101],
    [101, 103, 93, 100],
    [100, 101, 94, 99],
    [99, 108, 98, 106],
    [106, 109, 102, 107],
    [107, 110, 103, 108],
    [108, 111, 104, 109],
    [109, 112, 105, 110],
  ];
  return rows.map((row, index) => candle(base + index * day, ...row, day));
}

function m5Series(base) {
  const step = 300;
  const rows = [];
  for (let index = 0; index < 22; index += 1) {
    rows.push(candle(base + index * step, 100, 101, 99, 100, step));
  }
  rows.push(candle(base + 22 * step, 100, 101, 99.5, 100, step));
  rows.push(candle(base + 23 * step, 100, 102.5, 99.3, 101, step));
  rows.push(candle(base + 24 * step, 101, 101.5, 99.5, 100, step));
  rows.push(candle(base + 25 * step, 100, 101, 98, 99, step));
  rows.push(candle(base + 26 * step, 99, 101, 99, 100, step));
  rows.push(candle(base + 27 * step, 100, 101, 97, 99.5, step));
  rows.push(candle(base + 28 * step, 99.5, 104, 99.3, 103.5, step));
  rows.push(candle(base + 29 * step, 103.5, 104, 99.8, 102.5, step));
  for (let index = 30; index < 35; index += 1) {
    rows.push(candle(base + index * step, 102.5, 103.5, 101.5, 102.5, step));
  }
  return rows;
}

test('SMR driver is M5-only and evidence lineage is explicit', () => {
  assert.equal(SMR_FIRST_RETEST_DRIVER.id, 'SMR_FIRST_RETEST');
  assert.deepEqual(SMR_FIRST_RETEST_DRIVER.timeframes, ['M5']);
});

test('HTF-aligned SSL sweep -> displaced MSS -> first OB retest creates deterministic candidate', () => {
  const base = 1_700_000_000;
  const m5 = m5Series(base);
  const d1 = dailySeries(base - 12 * 86400);
  const nowSeconds = m5[30].close_time;
  const input = { series: { M5: m5, D1: d1 }, nowSeconds, maxSignalAgeSeconds: 3600 };
  const first = detectSmrFirstRetestCandidates(input);
  const second = detectSmrFirstRetestCandidates(input);
  assert.ok(first.length >= 1);
  assert.deepEqual(first.map(item => item.id), second.map(item => item.id));
  const setup = first.find(item => item.signal_candle_open_time === m5[29].open_time) || first.at(-1);
  assert.equal(setup.driver_id, 'SMR_FIRST_RETEST');
  assert.equal(setup.timeframe, 'M5');
  assert.equal(setup.direction, 'BUY');
  assert.equal(setup.htf_bias, 'BULLISH');
  assert.equal(setup.quality.sweep_side, 'SSL');
  assert.equal(setup.quality.first_retest, true);
  assert.match(setup.quality.reason, /sweep\/reclaim.*MSS.*first/i);
  assert.equal(setup.quality.research_scope, 'DIRECTIONAL_SELECTOR_AND_RETEST_TIMING_NOT_EXPECTANCY');
});

test('SMR evaluator adds accepted telemetry without generic post-hoc pattern gating', () => {
  const base = 1_700_000_000;
  const m5 = m5Series(base);
  const d1 = dailySeries(base - 12 * 86400);
  const evaluation = evaluateSmrFirstRetestCandidates({ series: { M5: m5, D1: d1 }, nowSeconds: m5[30].close_time, maxSignalAgeSeconds: 3600 });
  assert.equal(evaluation.raw_count, evaluation.candidates.length);
  assert.equal(evaluation.rejected_count, 0);
  assert.ok(evaluation.telemetry.every(item => item.gate_id === 'SMR_BT09F_LOCKED' && item.accepted === true));
  assert.ok(evaluation.telemetry.every(item => item.base_config_version && item.repair_config_version));
});
