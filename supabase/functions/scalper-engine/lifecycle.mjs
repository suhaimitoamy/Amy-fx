import { normalizeCandles, timestampSeconds } from './candles.mjs';

const EPSILON = 1e-9;
export const NON_TERMINAL_STATUSES = Object.freeze(['WAITING_NEXT_OPEN', 'ACTIVE', 'BE_ACTIVE']);

export function findNextOpen(candidate, { m1 = [], m15 = [] } = {}) {
  const signalClose = timestampSeconds(candidate?.signal_candle_close_time);
  if (!signalClose) return null;
  const detectedAt = timestampSeconds(candidate?.created_at);
  const liveMinuteOpen = detectedAt ? Math.floor(detectedAt / 60) * 60 + 60 : signalClose;
  const minuteNotBefore = Math.max(signalClose, liveMinuteOpen);
  const minute = normalizeCandles(m1, 60).find(candle =>
    candle.open_time >= minuteNotBefore &&
    candle.open_time < minuteNotBefore + 900
  );
  if (minute) return { open_time: minute.open_time, price: minute.open, source: 'M1_NEXT_OPEN' };
  const liveM15Open = detectedAt ? Math.floor(detectedAt / 900) * 900 + 900 : signalClose;
  const candle = normalizeCandles(m15, 900).find(item => item.open_time >= Math.max(signalClose, liveM15Open));
  return candle ? { open_time: candle.open_time, price: candle.open, source: 'M15_NEXT_OPEN' } : null;
}

export function activateCandidate(candidate, nextOpen) {
  if (!candidate || !nextOpen || !Number.isFinite(Number(nextOpen.price))) return { setup: candidate, event: null };
  const entry = Number(nextOpen.price);
  const reference = Number(candidate.stop_reference);
  const referenceIsStructural = candidate.direction === 'BUY'
    ? reference < entry - EPSILON
    : reference > entry + EPSILON;
  if (!Number.isFinite(reference) || !referenceIsStructural) return {
    setup: {
      ...candidate,
      status: 'INVALIDATED',
      recommendation_status: 'INVALID',
      exit_time: nextOpen.open_time,
      quality: {
        ...(candidate.quality || {}),
        lifecycle_sequence: Number(candidate.quality?.lifecycle_sequence || 0) + 1,
        invalidation_reason: 'STRUCTURAL_REFERENCE_WRONG_SIDE'
      }
    },
    event: { status: 'INVALIDATED', price: entry, candle_time: nextOpen.open_time, result_r: null }
  };
  const buffer = Number(candidate.atr_at_signal) * Number(candidate.buffer_atr || 0);
  const stop = candidate.direction === 'BUY' ? reference - buffer : reference + buffer;
  const risk = candidate.direction === 'BUY' ? entry - stop : stop - entry;
  if (!(risk > EPSILON)) return {
    setup: {
      ...candidate,
      status: 'INVALIDATED',
      recommendation_status: 'INVALID',
      exit_time: nextOpen.open_time,
      quality: {
        ...(candidate.quality || {}),
        lifecycle_sequence: Number(candidate.quality?.lifecycle_sequence || 0) + 1,
        invalidation_reason: 'NON_POSITIVE_STRUCTURAL_RISK'
      }
    },
    event: { status: 'INVALIDATED', price: entry, candle_time: nextOpen.open_time, result_r: null }
  };
  const sign = candidate.direction === 'BUY' ? 1 : -1;
  const setup = {
    ...candidate, status: 'ACTIVE', entry_candle_open_time: nextOpen.open_time,
    entry_price: entry, initial_stop_loss: stop, stop_loss: stop,
    break_even_trigger: entry + sign * risk, target_price: entry + sign * risk * 2,
    risk, bars_elapsed: 0, last_evaluated_open_time: null,
    quality: {
      ...(candidate.quality || {}),
      entry_source: nextOpen.source || 'UNKNOWN',
      entry_locked: true,
      entry_locked_at: nextOpen.open_time,
      entry_timestamp: nextOpen.open_time,
      lifecycle_sequence: Number(candidate.quality?.lifecycle_sequence || 0) + 1
    }
  };
  return { setup, event: { status: 'ACTIVE', price: entry, candle_time: nextOpen.open_time, result_r: null } };
}

function realizedR(setup, exitPrice) {
  const entry = Number(setup.entry_price), risk = Number(setup.risk), exit = Number(exitPrice);
  if (!(risk > EPSILON) || !Number.isFinite(entry) || !Number.isFinite(exit)) return null;
  return setup.direction === 'BUY' ? (exit - entry) / risk : (entry - exit) / risk;
}

export function advanceSetupLifecycle(inputSetup, rows, options = {}) {
  let setup = { ...inputSetup, quality: { ...(inputSetup?.quality || {}) } };
  if (
    !NON_TERMINAL_STATUSES.includes(setup.status) ||
    (setup.status !== 'ACTIVE' && setup.status !== 'BE_ACTIVE') ||
    setup.quality.entry_locked !== true ||
    !Number.isFinite(Number(setup.entry_candle_open_time))
  ) return { setup, events: [] };
  const evaluationSeconds = Math.max(60, Number(options.evaluationSeconds || 900));
  const entryOpenTime = Number(setup.entry_candle_open_time);
  const maxBars = Number(setup.max_bars || 4);
  const timeExitAt = entryOpenTime + maxBars * 900;
  const values = normalizeCandles(rows, evaluationSeconds)
    .filter(candle => candle.open_time >= entryOpenTime)
    .filter(candle => !setup.last_evaluated_open_time || candle.open_time > Number(setup.last_evaluated_open_time));
  const events = [];
  for (const candle of values) {
    if (!NON_TERMINAL_STATUSES.includes(setup.status)) break;
    const currentStop = setup.status === 'BE_ACTIVE' || setup.be_armed ? Number(setup.entry_price) : Number(setup.initial_stop_loss);
    const stopHit = setup.direction === 'BUY' ? candle.low <= currentStop : candle.high >= currentStop;
    const targetHit = setup.direction === 'BUY' ? candle.high >= Number(setup.target_price) : candle.low <= Number(setup.target_price);
    const oneRHit = setup.direction === 'BUY' ? candle.high >= Number(setup.break_even_trigger) : candle.low <= Number(setup.break_even_trigger);
    setup.bars_elapsed = Math.min(maxBars, Math.max(Number(setup.bars_elapsed || 0), Math.floor((candle.close_time - entryOpenTime) / 900)));
    setup.last_evaluated_open_time = candle.open_time;
    if (stopHit) {
      const be = setup.status === 'BE_ACTIVE' || setup.be_armed;
      setup = {
        ...setup,
        status: be ? 'BE_HIT' : 'SL_HIT',
        stop_loss: currentStop,
        exit_price: currentStop,
        exit_time: candle.close_time,
        result_r: be ? 0 : -1,
        recommendation_status: 'CLOSED',
        quality: { ...setup.quality, lifecycle_sequence: Number(setup.quality.lifecycle_sequence || 0) + 1 }
      };
      events.push({ status: setup.status, price: currentStop, candle_time: candle.open_time, result_r: setup.result_r });
      break;
    }
    if (targetHit) {
      setup = {
        ...setup,
        status: 'TP_HIT',
        exit_price: Number(setup.target_price),
        exit_time: candle.close_time,
        result_r: 2,
        recommendation_status: 'CLOSED',
        quality: { ...setup.quality, lifecycle_sequence: Number(setup.quality.lifecycle_sequence || 0) + 1 }
      };
      events.push({ status: 'TP_HIT', price: setup.exit_price, candle_time: candle.open_time, result_r: 2 });
      break;
    }
    if (candle.close_time >= timeExitAt) {
      setup = {
        ...setup,
        bars_elapsed: maxBars,
        status: 'TIME_EXIT',
        exit_price: candle.close,
        exit_time: candle.close_time,
        result_r: realizedR(setup, candle.close),
        recommendation_status: 'CLOSED',
        quality: { ...setup.quality, lifecycle_sequence: Number(setup.quality.lifecycle_sequence || 0) + 1 }
      };
      events.push({ status: 'TIME_EXIT', price: candle.close, candle_time: candle.open_time, result_r: setup.result_r });
      break;
    }
    if (setup.model === 'IFVG_SCALPER' && !setup.be_armed && oneRHit) {
      setup = {
        ...setup,
        be_armed: true,
        status: 'BE_ACTIVE',
        stop_loss: Number(setup.entry_price),
        quality: { ...setup.quality, lifecycle_sequence: Number(setup.quality.lifecycle_sequence || 0) + 1 }
      };
      events.push({ status: 'BE_ACTIVE', price: setup.entry_price, candle_time: candle.open_time, result_r: null });
    }
  }
  return { setup, events };
}

function zonesOverlap(a, b) { return Number(a.zone_top) >= Number(b.zone_bottom) && Number(b.zone_top) >= Number(a.zone_bottom); }

export function assignRecommendations(setups, maxActive = 2) {
  const values = (Array.isArray(setups) ? setups : []).map(setup => ({ ...setup }));
  const active = values.filter(setup => NON_TERMINAL_STATUSES.includes(setup.status))
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99) || Number(a.signal_candle_close_time || 0) - Number(b.signal_candle_close_time || 0));
  const selected = [];
  for (const setup of active) {
    const duplicate = selected.some(other => other.direction === setup.direction && Math.abs(Number(other.signal_candle_close_time) - Number(setup.signal_candle_close_time)) <= 1800 && zonesOverlap(other, setup));
    if (duplicate) setup.recommendation_status = 'DUPLICATE_CLUSTER';
    else if (selected.length >= maxActive) setup.recommendation_status = 'RISK_LIMIT';
    else { setup.recommendation_status = 'VALID'; selected.push(setup); }
  }
  const byId = new Map(active.map(setup => [setup.id, setup]));
  return values.map(setup => byId.get(setup.id) || setup);
}

export function lifecycleMessage(setup, status = setup?.status) {
  const side = setup?.direction || 'WAIT';
  const model = setup?.model === 'IFVG_SCALPER' ? 'IFVG' : 'FVG BUY HQ';
  const price = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
  if (status === 'WAITING_NEXT_OPEN') return `${model} ${side} terkonfirmasi. Menunggu open M15 berikutnya.`;
  if (status === 'ACTIVE') return `${model} ${side} aktif · Entry ${price(setup.entry_price)} · SL ${price(setup.stop_loss)} · TP ${price(setup.target_price)}.`;
  if (status === 'BE_ACTIVE') return `${model} ${side} mencapai 1R. Pindahkan SL ke entry ${price(setup.entry_price)}.`;
  if (status === 'TP_HIT') return `${model} ${side} mencapai target 2R.`;
  if (status === 'SL_HIT') return `${model} ${side} selesai terkena Stop Loss.`;
  if (status === 'BE_HIT') return `${model} ${side} selesai di breakeven.`;
  if (status === 'TIME_EXIT') return `${model} ${side} time exit setelah 4 candle · ${Number(setup.result_r || 0).toFixed(2)}R.`;
  if (status === 'INVALIDATED') return `${model} ${side} dibatalkan karena geometri SL lokal tidak valid.`;
  return `${model} ${side} · ${status || 'WAIT'}`;
}
