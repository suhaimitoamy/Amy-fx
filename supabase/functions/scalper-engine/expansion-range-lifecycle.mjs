import { normalizeCandles, timestampSeconds } from './candles.mjs';
import {
  activateCandidate as activateBaseCandidate,
  advanceSetupLifecycle as advanceBaseLifecycle,
  lifecycleMessage as baseLifecycleMessage,
  resolveTriggerEntry as resolveBaseTriggerEntry,
} from './lifecycle.mjs';

const EPSILON = 1e-9;
const POLICY = 'EXPANSION_RANGE_REENTRY_V3';

function isExpansionRangeV3(setup) {
  return setup?.quality?.lifecycle_policy === POLICY
    || setup?.driver_id === 'EXPANSION_RANGE_REENTRY';
}

function transition(setup, status, fields = {}) {
  const { quality: qualityPatch, ...rest } = fields;
  return {
    ...setup,
    ...rest,
    status,
    quality: {
      ...(setup?.quality || {}),
      ...(qualityPatch || {}),
      lifecycle_sequence: Number(setup?.quality?.lifecycle_sequence || 0) + 1,
    },
  };
}

function realizedR(setup, exitPrice) {
  const entry = Number(setup?.entry_price);
  const risk = Number(setup?.risk);
  const exit = Number(exitPrice);
  if (!(risk > EPSILON) || !Number.isFinite(entry) || !Number.isFinite(exit)) return null;
  return setup.direction === 'BUY' ? (exit - entry) / risk : (entry - exit) / risk;
}

function cancellation(candidate, reason, candleTime, price = null) {
  const setup = transition(candidate, 'CANCELLED', {
    recommendation_status: 'CLOSED',
    exit_price: Number.isFinite(Number(price)) ? Number(price) : null,
    exit_time: candleTime || null,
    quality: { invalidation_reason: reason },
  });
  return {
    setup,
    event: { status: 'CANCELLED', price: setup.exit_price, candle_time: candleTime || null, result_r: null },
    nextOpen: null,
  };
}

export function resolveTriggerEntry(candidate, options = {}) {
  if (!isExpansionRangeV3(candidate)) return resolveBaseTriggerEntry(candidate, options);
  if (!candidate || candidate.status !== 'WAITING_TRIGGER') return { setup: candidate, event: null, nextOpen: null };

  const signalClose = timestampSeconds(candidate.signal_candle_close_time);
  const entry = Number(candidate?.quality?.planned_entry_price);
  const rangeLow = Number(candidate?.quality?.range_low);
  const rangeHigh = Number(candidate?.quality?.range_high);
  const configuredDeadline = timestampSeconds(candidate?.quality?.parent_entry_deadline);
  const fallbackWait = Math.max(900, Number(candidate?.quality?.trigger_wait_seconds || 3 * 60 * 60));
  const deadline = configuredDeadline || (signalClose ? signalClose + fallbackWait : 0);

  if (!signalClose || !Number.isFinite(entry) || !(rangeHigh > rangeLow) || !deadline) {
    return cancellation(candidate, 'ERR_TRIGGER_GEOMETRY_UNAVAILABLE', signalClose || null);
  }

  const values = normalizeCandles(options?.m1 || [], 60)
    .filter(candle => candle.open_time >= signalClose && candle.open_time <= deadline);

  for (const candle of values) {
    const closesM15 = Number(candle.close_time) % 900 === 0;
    const rangeBroken = closesM15 && (candle.close < rangeLow || candle.close > rangeHigh);
    if (rangeBroken) {
      return cancellation(candidate, 'ERR_RANGE_M15_CLOSE_BREAK_BEFORE_FILL', candle.close_time, candle.close);
    }

    if (candle.low <= entry && candle.high >= entry) {
      return {
        setup: candidate,
        event: null,
        nextOpen: { open_time: candle.open_time, price: entry, source: 'ERR_RANGE_LIMIT' },
      };
    }
  }

  if (timestampSeconds(options?.nowSeconds ?? Math.floor(Date.now() / 1000)) >= deadline) {
    return cancellation(candidate, 'ERR_PARENT_RANGE_ENTRY_WINDOW_EXPIRED', deadline);
  }

  return { setup: candidate, event: null, nextOpen: null };
}

export function activateCandidate(candidate, nextOpen) {
  if (!isExpansionRangeV3(candidate)) return activateBaseCandidate(candidate, nextOpen);
  if (!candidate || !nextOpen || !Number.isFinite(Number(nextOpen.price))) return { setup: candidate, event: null };

  const entry = Number(nextOpen.price);
  const plannedEntry = Number(candidate?.quality?.planned_entry_price);
  const stop = Number(candidate?.quality?.exact_stop_price);
  const tp1 = Number(candidate?.quality?.exact_tp1_price);
  const tp2 = Number(candidate?.quality?.exact_tp2_price);
  const buy = candidate.direction === 'BUY';
  const geometryValid = Number.isFinite(plannedEntry)
    && Math.abs(entry - plannedEntry) <= 1e-6
    && Number.isFinite(stop)
    && Number.isFinite(tp1)
    && Number.isFinite(tp2)
    && (buy ? stop < entry && entry < tp1 && tp1 < tp2 : stop > entry && entry > tp1 && tp1 > tp2);

  if (!geometryValid) {
    const setup = transition(candidate, 'INVALIDATED', {
      recommendation_status: 'INVALID',
      exit_time: nextOpen.open_time,
      quality: { invalidation_reason: 'ERR_ACTIVATION_GEOMETRY_INVALID' },
    });
    return { setup, event: { status: 'INVALIDATED', price: entry, candle_time: nextOpen.open_time, result_r: null } };
  }

  const risk = Math.abs(entry - stop);
  if (!(risk > EPSILON) || risk > Number(candidate?.quality?.stop_cap_points || 50)) {
    const setup = transition(candidate, 'INVALIDATED', {
      recommendation_status: 'INVALID',
      exit_time: nextOpen.open_time,
      quality: { invalidation_reason: 'ERR_STRUCTURAL_RISK_INVALID' },
    });
    return { setup, event: { status: 'INVALIDATED', price: entry, candle_time: nextOpen.open_time, result_r: null } };
  }

  const setup = {
    ...candidate,
    status: 'ACTIVE',
    recommendation_status: candidate.recommendation_status === 'PENDING' ? 'VALID' : candidate.recommendation_status,
    entry_candle_open_time: nextOpen.open_time,
    entry_price: entry,
    initial_stop_loss: stop,
    stop_loss: stop,
    break_even_trigger: tp1,
    target_price: tp2,
    risk,
    be_armed: false,
    bars_elapsed: 0,
    last_evaluated_open_time: null,
    quality: {
      ...(candidate.quality || {}),
      entry_source: nextOpen.source || 'ERR_RANGE_LIMIT',
      entry_locked: true,
      entry_locked_at: nextOpen.open_time,
      entry_timestamp: nextOpen.open_time,
      tp1_hit: false,
      runner_exit: null,
      lifecycle_sequence: Number(candidate?.quality?.lifecycle_sequence || 0) + 1,
    },
  };

  return { setup, event: { status: 'ACTIVE', price: entry, candle_time: nextOpen.open_time, result_r: null } };
}

export function advanceSetupLifecycle(inputSetup, rows, options = {}) {
  if (!isExpansionRangeV3(inputSetup)) return advanceBaseLifecycle(inputSetup, rows, options);

  let setup = { ...inputSetup, quality: { ...(inputSetup?.quality || {}) } };
  if (setup.status !== 'ACTIVE' || setup.quality.entry_locked !== true || !Number.isFinite(Number(setup.entry_candle_open_time))) {
    return { setup, events: [] };
  }

  const evaluationSeconds = Math.max(60, Number(options?.evaluationSeconds || 60));
  const entryOpenTime = Number(setup.entry_candle_open_time);
  const maxHoldSeconds = Math.max(900, Number(setup?.quality?.max_hold_seconds || 24 * 60 * 60));
  const timeExitAt = entryOpenTime + maxHoldSeconds;
  const values = normalizeCandles(rows, evaluationSeconds)
    .filter(candle => candle.open_time >= entryOpenTime)
    .filter(candle => !setup.last_evaluated_open_time || candle.open_time > Number(setup.last_evaluated_open_time));
  const events = [];

  for (const candle of values) {
    if (setup.status !== 'ACTIVE') break;
    const tp1WasHit = setup.quality.tp1_hit === true;
    const initialStop = Number(setup.initial_stop_loss);
    const tp1 = Number(setup.break_even_trigger);
    const tp2 = Number(setup.target_price);
    const currentStop = tp1WasHit && setup.quality.profit_lock_at_tp1 === true ? tp1 : initialStop;
    const stopHit = setup.direction === 'BUY' ? candle.low <= currentStop : candle.high >= currentStop;
    const tp1Hit = setup.direction === 'BUY' ? candle.high >= tp1 : candle.low <= tp1;
    const tp2Hit = setup.direction === 'BUY' ? candle.high >= tp2 : candle.low <= tp2;

    setup.bars_elapsed = Math.max(Number(setup.bars_elapsed || 0), Math.floor((candle.close_time - entryOpenTime) / 900));
    setup.last_evaluated_open_time = candle.open_time;

    if (stopHit) {
      if (tp1WasHit) {
        const result = realizedR(setup, currentStop);
        setup = transition(setup, 'TP_HIT', {
          stop_loss: currentStop,
          exit_price: currentStop,
          exit_time: candle.close_time,
          result_r: result,
          recommendation_status: 'CLOSED',
          quality: { runner_exit: 'TP1_LOCK' },
        });
        events.push({ status: 'TP_HIT', price: currentStop, candle_time: candle.open_time, result_r: result });
      } else {
        setup = transition(setup, 'SL_HIT', {
          stop_loss: currentStop,
          exit_price: currentStop,
          exit_time: candle.close_time,
          result_r: -1,
          recommendation_status: 'CLOSED',
        });
        events.push({ status: 'SL_HIT', price: currentStop, candle_time: candle.open_time, result_r: -1 });
      }
      break;
    }

    if (!tp1WasHit && tp1Hit) {
      const result = realizedR(setup, tp1);
      setup = {
        ...setup,
        stop_loss: tp1,
        quality: {
          ...setup.quality,
          tp1_hit: true,
          runner_exit: null,
          lifecycle_sequence: Number(setup.quality?.lifecycle_sequence || 0) + 1,
        },
      };
      events.push({ status: 'TP1_HIT', price: tp1, candle_time: candle.open_time, result_r: result });
      // V3 starts evaluating the extension on the next M1 candle.
      continue;
    }

    if (tp1WasHit && tp2Hit) {
      const result = realizedR(setup, tp2);
      setup = transition(setup, 'TP_HIT', {
        stop_loss: tp1,
        exit_price: tp2,
        exit_time: candle.close_time,
        result_r: result,
        recommendation_status: 'CLOSED',
        quality: { runner_exit: 'TP2' },
      });
      events.push({ status: 'TP_HIT', price: tp2, candle_time: candle.open_time, result_r: result });
      break;
    }

    if (candle.close_time >= timeExitAt) {
      const result = realizedR(setup, candle.close);
      setup = transition(setup, 'TIME_EXIT', {
        exit_price: candle.close,
        exit_time: candle.close_time,
        result_r: result,
        recommendation_status: 'CLOSED',
        quality: { runner_exit: tp1WasHit ? 'TIME_AFTER_TP1' : 'TIME_BEFORE_TP1' },
      });
      events.push({ status: 'TIME_EXIT', price: candle.close, candle_time: candle.open_time, result_r: result });
      break;
    }
  }

  return { setup, events };
}

export function lifecycleMessage(setup, status = setup?.status) {
  if (!isExpansionRangeV3(setup)) return baseLifecycleMessage(setup, status);
  const side = setup?.direction || 'WAIT';
  const name = setup?.driver_name || 'Expansion Range Re-entry';
  const price = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';

  if (status === 'WAITING_TRIGGER') {
    return `${name} ${side} siap · menunggu re-entry limit di tepi range M15 selama parent range masih valid.`;
  }
  if (status === 'ACTIVE') {
    return `${name} M15 ${side} aktif · Entry ${price(setup.entry_price)} · SL ${price(setup.stop_loss)} · TP1 ${price(setup.break_even_trigger)} · TP2 ${price(setup.target_price)}.`;
  }
  if (status === 'TP1_HIT') {
    return `${name} ${side} mencapai TP1. Profit dikunci di TP1 dan runner mulai mengejar TP2 pada candle M1 berikutnya.`;
  }
  if (status === 'TP_HIT' && setup?.quality?.runner_exit === 'TP1_LOCK') {
    return `${name} ${side} selesai WIN di profit-lock TP1.`;
  }
  if (status === 'TP_HIT' && setup?.quality?.runner_exit === 'TP2') {
    return `${name} ${side} runner mencapai TP2.`;
  }
  if (status === 'CANCELLED') {
    return `${name} ${side} dibatalkan karena parent range M15 tidak lagi valid atau jendela entry berakhir.`;
  }
  return baseLifecycleMessage(setup, status);
}
