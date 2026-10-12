import { normalizeCandles, timestampSeconds } from './candles.mjs';
import { REBUILD_VERSION, rebuiltGeometry } from './rebuilt-drivers.mjs';
import * as legacy from './discipline-lifecycle.mjs';
const owns = s => s?.quality?.rebuild_version === REBUILD_VERSION;
const signOf = s => s.direction === 'BUY' ? 1 : -1;
const startTime = s => Math.max(Number(s.signal_candle_close_time), timestampSeconds(s.created_at) ? Math.floor(timestampSeconds(s.created_at) / 60) * 60 + 60 : 0);
function change(s, status, fields = {}, reason) {
  const setup = { ...s, ...fields, status, recommendation_status: status === 'ACTIVE' ? 'VALID' : 'CLOSED',
    quality: { ...s.quality, ...(fields.quality || {}), lifecycle_sequence: Number(s.quality?.lifecycle_sequence || 0) + 1, ...(reason ? { invalidation_reason: reason } : {}) } };
  return { setup, event: { status, price: setup.exit_price ?? setup.entry_price ?? null, candle_time: setup.exit_time ?? setup.entry_candle_open_time ?? null, result_r: setup.result_r ?? null } };
}
export function resolveTriggerEntry(s, { m1 = [], nowSeconds = Date.now() / 1000 } = {}) {
  if (!owns(s)) return legacy.resolveTriggerEntry(s, { m1, nowSeconds });
  if (!['WAITING_TRIGGER', 'WAITING_NEXT_OPEN', 'ENTRY_READY'].includes(s.status)) return { setup: s, event: null, nextOpen: null };
  const geometry = rebuiltGeometry(s), start = startTime(s), deadline = Number(s.quality.entry_deadline);
  if (!geometry || !Number.isFinite(deadline)) return { ...change(s, 'INVALIDATED', {}, 'INVALID_STRUCTURAL_GEOMETRY'), nextOpen: null };
  const now = timestampSeconds(nowSeconds), limit = s.status === 'WAITING_TRIGGER', sign = signOf(s);
  const candles = normalizeCandles(m1, 60).filter(c => c.open_time >= start && c.close_time <= Math.min(deadline, now));
  for (const c of candles) {
    if (!limit) return { setup: s, event: null, nextOpen: { price: c.open, open_time: c.open_time, source: 'M1_NEXT_OPEN' } };
    // Unknown intrabar ordering: invalidate the setup before asserting a fill.
    if (sign > 0 ? c.low <= s.stop_reference : c.high >= s.stop_reference) return { ...change(s, 'CANCELLED', { exit_time: c.close_time }, 'STRUCTURE_BROKEN_BEFORE_FILL'), nextOpen: null };
    if (c.low <= geometry.entry && c.high >= geometry.entry) return { setup: s, event: null, nextOpen: { price: geometry.entry, open_time: c.open_time, source: s.quality.entry_model } };
  }
  if (now >= deadline) return { ...change(s, 'CANCELLED', { exit_time: deadline }, 'ENTRY_WINDOW_EXPIRED'), nextOpen: null };
  return { setup: s, event: null, nextOpen: null };
}
export function activateCandidate(s, nextOpen) {
  if (!owns(s)) return legacy.activateCandidate(s, nextOpen);
  if (!['WAITING_TRIGGER', 'WAITING_NEXT_OPEN', 'ENTRY_READY'].includes(s.status) || !nextOpen) return { setup: s, event: null };
  const geometry = rebuiltGeometry(s, nextOpen.price), time = Number(nextOpen.open_time), limit = s.status === 'WAITING_TRIGGER';
  if (!geometry || !Number.isFinite(time) || time < startTime(s) || time + 60 > Number(s.quality.entry_deadline)
      || (limit && Math.abs(Number(nextOpen.price) - Number(s.quality.planned_entry_price)) > 1e-6)
      || (!limit && Math.abs(Number(nextOpen.price) - Number(s.quality.planned_entry_price)) > Number(s.atr_at_signal) * .25)) {
    return change(s, 'INVALIDATED', { exit_time: time || null }, 'ENTRY_GEOMETRY_OR_TIMING_CHANGED');
  }
  return change(s, 'ACTIVE', { entry_price: geometry.entry, entry_candle_open_time: time, initial_stop_loss: geometry.stop, stop_loss: geometry.stop,
    risk: geometry.risk, target_price: geometry.target, break_even_trigger: s.driver_id === 'DISCIPLINE_SCALPER' ? null : geometry.entry + signOf(s) * 10,
    last_evaluated_open_time: null, be_armed: false, quality: { entry_locked: true, entry_source: nextOpen.source, entry_timestamp: time, entry_was_limit: limit, reward_r_at_entry: geometry.reward_r } });
}
export function advanceSetupLifecycle(s, rows, options = {}) {
  if (!owns(s)) return legacy.advanceSetupLifecycle(s, rows, options);
  if (s.status !== 'ACTIVE' || !s.quality.entry_locked) return { setup: s, events: [] };
  let setup = { ...s, quality: { ...s.quality } };
  const sign = signOf(s), entryTime = Number(s.entry_candle_open_time), deadline = entryTime + Number(s.quality.max_hold_seconds || 86400);
  const events = [];
  for (const c of normalizeCandles(rows, 60).filter(c => c.open_time >= entryTime && c.open_time > Number(s.last_evaluated_open_time || 0))) {
    setup.last_evaluated_open_time = c.open_time;
    setup.bars_elapsed = Math.floor((c.close_time - entryTime) / 60);
    // A gap after expiry must not turn a time exit into a later TP/SL.
    const afterDeadline = c.open_time >= deadline;
    const sl = !afterDeadline && (sign > 0 ? c.low <= s.initial_stop_loss : c.high >= s.initial_stop_loss);
    const ambiguousFillBar = s.quality.entry_was_limit && c.open_time === entryTime;
    const tp = !afterDeadline && !ambiguousFillBar && (sign > 0 ? c.high >= s.target_price : c.low <= s.target_price);
    const state = afterDeadline ? 'TIME_EXIT' : sl ? 'SL_HIT' : tp ? 'TP_HIT' : c.close_time >= deadline ? 'TIME_EXIT' : null;
    if (state) {
      const price = afterDeadline ? c.open : sl ? (sign > 0 ? Math.min(c.open, s.initial_stop_loss) : Math.max(c.open, s.initial_stop_loss)) : tp ? s.target_price : c.close;
      const result = change(setup, state, { exit_price: price, exit_time: afterDeadline ? c.open_time : c.close_time, result_r: (price - s.entry_price) * sign / s.risk });
      return { setup: result.setup, events: [...events, result.event] };
    }
    if (!ambiguousFillBar && s.break_even_trigger != null && !setup.quality.tp1_hit && (sign > 0 ? c.high >= s.break_even_trigger : c.low <= s.break_even_trigger)) {
      setup.quality.tp1_hit = true;
      setup.quality.lifecycle_sequence = Number(setup.quality.lifecycle_sequence || 0) + 1;
      events.push({ status: 'TP1_HIT', price: s.break_even_trigger, candle_time: c.open_time, result_r: 10 / s.risk });
    }
  }
  return { setup, events };
}
export function lifecycleMessage(setup, status = setup?.status) {
  if (!owns(setup)) return legacy.lifecycleMessage(setup, status);
  return `${setup.driver_name} ${setup.direction} ${status} · Entry ${setup.entry_price ?? setup.quality.planned_entry_price} · SL ${setup.stop_loss ?? '-'} · TP ${setup.target_price ?? '-'}.`;
}
