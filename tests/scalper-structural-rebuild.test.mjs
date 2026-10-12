import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScalperCandidates, DRIVER_REGISTRY, resolveTriggerEntry, activateCandidate, advanceSetupLifecycle } from '../supabase/functions/scalper-engine/engine.mjs';
import { REBUILD_VERSION } from '../supabase/functions/scalper-engine/rebuilt-drivers.mjs';
const base = 1780002000;
const candle = (i, o, h, l, c, seconds = 3600) => ({ open_time: base + i * seconds, close_time: base + (i + 1) * seconds, open: o, high: h, low: l, close: c, is_closed: true });
function input(rows, id, now = rows.at(-1).close_time) {
  return { series: { H1: rows, config: { enabledDrivers: Object.fromEntries(DRIVER_REGISTRY.map(d => [d.id, d.id === id])) } }, nowSeconds: now, maxSignalAgeSeconds: 3600 };
}
function bos() {
  const rows = Array.from({ length: 20 }, (_, i) => candle(i, 100, 102, 98, 100));
  rows.push(candle(20, 104, 110, 102, 108), candle(21, 106, 108, 101, 103), candle(22, 103, 106, 99, 104), candle(23, 104, 107, 101, 106), candle(24, 106, 108, 102, 107), candle(25, 109, 115, 108, 114), candle(26, 110, 115, 109, 114));
  return rows;
}
function range() {
  const rows = Array.from({ length: 30 }, (_, i) => candle(i, 100, 105, 95, 100));
  for (let i = 30; i < 36; i++) rows.push(candle(i, 100, 101, 99, 100));
  rows.push(candle(36, 100, 105, 99.5, 104.5), candle(37, 101.5, 104, 100.8, 103.8));
  return rows;
}
for (const [id, fixture] of [['RETEST_BOS', bos], ['RANGE_EXPANSION', range]]) {
  for (const sell of [false, true]) test(`${id} ${sell ? 'SELL' : 'BUY'} requires first confirmed retest and ignores future bars`, () => {
    const rows = fixture().map(c => sell ? { ...c, open: 220-c.open, high: 220-c.low, low: 220-c.high, close: 220-c.close } : c);
    assert.equal(evaluateScalperCandidates(input(rows.slice(0, -1), id)).candidates.length, 0);
    const result = evaluateScalperCandidates(input(rows, id)).candidates;
    assert.equal(result.length, 1);
    assert.equal(result[0].direction, sell ? 'SELL' : 'BUY');
    assert.equal(result[0].driver_rule_version, REBUILD_VERSION);
    const future = { ...rows.at(-1), open_time: rows.at(-1).close_time, close_time: rows.at(-1).close_time + 3600, high: 1000, low: 1 };
    assert.deepEqual(evaluateScalperCandidates(input([...rows, future], id, rows.at(-1).close_time)).candidates, result);
    const failed = fixture();
    failed.at(-1).close = id === 'RETEST_BOS' ? 109.5 : 100.9;
    failed.push({ ...fixture().at(-1), open_time: failed.at(-1).close_time, close_time: failed.at(-1).close_time + 3600 });
    assert.equal(evaluateScalperCandidates(input(failed, id)).candidates.length, 0);
  });
}
function pending(driver = 'AMD', limit = true) {
  return { driver_id: driver, direction: 'BUY', status: limit ? 'WAITING_TRIGGER' : 'WAITING_NEXT_OPEN', signal_candle_close_time: base, created_at: new Date((base + 130) * 1000).toISOString(), stop_reference: 95, atr_at_signal: 5,
    quality: { rebuild_version: REBUILD_VERSION, planned_entry_price: 100, entry_deadline: base + 900, entry_model: 'FVG_MIDPOINT_LIMIT', max_hold_seconds: 900 } };
}
const minute = (offset, o, h, l, c) => ({ open_time: base + offset, close_time: base + offset + 60, open: o, high: h, low: l, close: c, is_closed: true });
test('limit cannot fill before detection, on future candles or after deadline; structure break wins over fill', () => {
  const s = pending();
  assert.equal(resolveTriggerEntry(s, { m1: [minute(60, 101, 102, 99, 100)], nowSeconds: base + 300 }).nextOpen, null);
  assert.equal(resolveTriggerEntry(s, { m1: [minute(180, 101, 102, 99, 100)], nowSeconds: base + 200 }).nextOpen, null);
  const broken = resolveTriggerEntry(s, { m1: [minute(180, 101, 102, 94, 100)], nowSeconds: base + 300 });
  assert.equal(broken.setup.status, 'CANCELLED');
  const expired = resolveTriggerEntry(s, { m1: [minute(900, 101, 102, 99, 100)], nowSeconds: base + 960 });
  assert.equal(expired.setup.status, 'CANCELLED');
  const filled = resolveTriggerEntry(s, { m1: [minute(180, 101, 102, 99, 100)], nowSeconds: base + 240 });
  assert.equal(filled.nextOpen.open_time, base + 180);
});
test('actual next-open gap, excessive risk and wrong structural side fail closed', () => {
  const s = pending('RETEST_BOS', false);
  assert.equal(activateCandidate(s, { open_time: base + 180, price: 110 }).setup.status, 'INVALIDATED');
  assert.equal(activateCandidate({ ...s, stop_reference: 75 }, { open_time: base + 180, price: 100 }).setup.status, 'INVALIDATED');
  assert.equal(activateCandidate({ ...s, stop_reference: 101 }, { open_time: base + 180, price: 100 }).setup.status, 'INVALIDATED');
  assert.equal(activateCandidate(s, { open_time: base + 120, price: 100 }).setup.status, 'INVALIDATED');
});
test('limit fill candle cannot claim an earlier TP; SL first and gap losses remain honest', () => {
  const active = activateCandidate(pending(), { open_time: base + 180, price: 100 }).setup;
  assert.equal(active.status, 'ACTIVE');
  const first = advanceSetupLifecycle(active, [minute(180, 110, 125, 99, 101)]);
  assert.equal(first.setup.status, 'ACTIVE');
  const stop = advanceSetupLifecycle(first.setup, [minute(240, 90, 125, 89, 100)]);
  assert.equal(stop.setup.status, 'SL_HIT');
  assert.ok(stop.setup.result_r < -1);
  assert.equal(activateCandidate(stop.setup, { open_time: base + 300, price: 100 }).setup.status, 'SL_HIT');
});
test('expiry gap cannot harvest a later target', () => {
  const active = activateCandidate(pending(), { open_time: base + 180, price: 100 }).setup;
  const result = advanceSetupLifecycle(active, [minute(1200, 101, 140, 100, 130)]);
  assert.equal(result.setup.status, 'TIME_EXIT');
  assert.equal(result.setup.exit_price, 101);
});
test('new release changes only the four measured underperforming rule versions', () => {
  assert.deepEqual(DRIVER_REGISTRY.filter(d => d.version === REBUILD_VERSION).map(d => d.id).sort(), ['AMD','DISCIPLINE_SCALPER','RANGE_EXPANSION','RETEST_BOS']);
  assert.equal(DRIVER_REGISTRY.some(d => ['IFVG_LEGACY','FVG_BUY_HIGH_QUALITY'].includes(d.id)), false);
});
