import { h1OrderFlowAt, normalizeCandles } from './candles.mjs';
import { ENGINE_VERSION, SETUP_SCHEMA_VERSION } from './drivers.mjs';
import { BASE_CONFIG_VERSION, REPAIR_CONFIG_VERSION } from './pattern-gates.mjs';

const EPSILON = 1e-9;
const M15_SECONDS = 900;
const THREE_HOURS = 3 * 60 * 60;

export const EXPANSION_RANGE_REENTRY_VERSION = 'ERR-V3-2026-M15-V1';
export const EXPANSION_RANGE_REENTRY_DRIVER = Object.freeze({
  enabled: true,
  id: 'EXPANSION_RANGE_REENTRY',
  name: 'Expansion Range Re-entry',
  version: EXPANSION_RANGE_REENTRY_VERSION,
  timeframes: ['M15'],
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function candleRange(candle) {
  return Math.max(EPSILON, finite(candle?.high) - finite(candle?.low));
}

function candleBody(candle) {
  return Math.abs(finite(candle?.close) - finite(candle?.open));
}

function mean(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN;
}

function atrSeries(values, length = 14) {
  const output = Array(values.length).fill(NaN);
  if (values.length <= length) return output;
  const trueRanges = values.map((candle, index) => {
    if (index === 0) return candleRange(candle);
    const previous = values[index - 1];
    return Math.max(
      candleRange(candle),
      Math.abs(candle.high - previous.close),
      Math.abs(candle.low - previous.close),
    );
  });
  let average = mean(trueRanges.slice(1, length + 1));
  output[length] = average;
  for (let index = length + 1; index < values.length; index += 1) {
    average = ((average * (length - 1)) + trueRanges[index]) / length;
    output[index] = average;
  }
  return output;
}

function isExpansion(values, atr, index) {
  const candle = values[index];
  const priorAtr = finite(atr[index - 1]);
  if (!candle || !(priorAtr > EPSILON)) return false;
  const span = candleRange(candle);
  return span >= priorAtr * 1.5 && candleBody(candle) / span >= 0.55;
}

function htfContext(h1, signal) {
  const context = h1OrderFlowAt(h1, signal.close_time);
  return {
    bias: ['BULLISH', 'BEARISH'].includes(context?.bias) ? context.bias : 'NEUTRAL',
    candle_close_time: Number(context?.candle_close_time) || null,
  };
}

function stable(value) {
  return Number(value).toFixed(5);
}

function candidateId(direction, signal, parentAnchor, armIndex, entry) {
  return [
    ENGINE_VERSION,
    EXPANSION_RANGE_REENTRY_DRIVER.id,
    EXPANSION_RANGE_REENTRY_VERSION,
    'M15',
    direction,
    signal.close_time,
    parentAnchor,
    armIndex,
    stable(entry),
  ].join(':');
}

function makeCandidate({
  direction,
  signal,
  parent,
  armIndex,
  armReason,
  atrValue,
  h1,
}) {
  const rangeLow = parent.rangeLow;
  const rangeHigh = parent.rangeHigh;
  const midpoint = parent.midpoint;
  const buyEntry = rangeLow + 1;
  const sellEntry = rangeHigh - 1;
  const entry = direction === 'BUY' ? buyEntry : sellEntry;
  const stop = direction === 'BUY' ? rangeLow - 3 : rangeHigh + 3;
  const oppositeEntry = direction === 'BUY' ? sellEntry : buyEntry;
  const tp1 = entry + (oppositeEntry - entry) * 0.35;
  const tp2 = oppositeEntry;
  const risk = Math.abs(entry - stop);
  if (!(risk > EPSILON)) return null;
  if (direction === 'BUY' && !(stop < entry && tp1 > entry && tp2 > tp1)) return null;
  if (direction === 'SELL' && !(stop > entry && tp1 < entry && tp2 < tp1)) return null;

  const htf = htfContext(h1, signal);
  const anchor = `${parent.anchor}:${direction}:ARM:${armIndex}`;
  const zoneBottom = direction === 'BUY' ? rangeLow : entry;
  const zoneTop = direction === 'BUY' ? entry : rangeHigh;
  const triggerWaitSeconds = Math.max(M15_SECONDS, parent.entryDeadline - signal.close_time);

  return {
    id: candidateId(direction, signal, parent.anchor, armIndex, entry),
    engine_version: ENGINE_VERSION,
    model: EXPANSION_RANGE_REENTRY_DRIVER.id,
    driver_id: EXPANSION_RANGE_REENTRY_DRIVER.id,
    driver_name: EXPANSION_RANGE_REENTRY_DRIVER.name,
    driver_rule_version: EXPANSION_RANGE_REENTRY_VERSION,
    timeframe: 'M15',
    schema_version: SETUP_SCHEMA_VERSION,
    symbol: 'XAU/USD',
    direction,
    status: 'WAITING_TRIGGER',
    recommendation_status: 'PENDING',
    signal_candle_open_time: signal.open_time,
    signal_candle_close_time: signal.close_time,
    entry_candle_open_time: null,
    entry_price: null,
    initial_stop_loss: null,
    stop_loss: null,
    break_even_trigger: null,
    target_price: null,
    risk: null,
    buffer_atr: 0,
    max_bars: 96,
    bars_elapsed: 0,
    last_evaluated_open_time: null,
    htf_bias: htf.bias,
    htf_candle_close_time: htf.candle_close_time,
    zone_bottom: zoneBottom,
    zone_top: zoneTop,
    source_fvg_id: anchor,
    stop_reference: stop,
    atr_at_signal: Number(atrValue),
    be_armed: false,
    result_r: null,
    exit_price: null,
    exit_time: null,
    quality: {
      driver_id: EXPANSION_RANGE_REENTRY_DRIVER.id,
      driver_name: EXPANSION_RANGE_REENTRY_DRIVER.name,
      driver_rule_version: EXPANSION_RANGE_REENTRY_VERSION,
      timeframe: 'M15',
      timeframe_seconds: M15_SECONDS,
      schema_version: SETUP_SCHEMA_VERSION,
      source_candle_timestamp: signal.close_time,
      source_anchor: anchor,
      reason: 'M15 expansion followed by narrow sideways range; re-entry armed from the opposite half of the range.',
      lifecycle_policy: 'EXPANSION_RANGE_REENTRY_V3',
      entry_model: 'ERR_RANGE_LIMIT',
      planned_entry_price: entry,
      exact_stop_price: stop,
      exact_tp1_price: tp1,
      exact_tp2_price: tp2,
      profit_lock_at_tp1: true,
      extension_starts_next_m1: true,
      same_candle_rule: 'SL_FIRST',
      max_hold_seconds: 24 * 60 * 60,
      stop_cap_points: 50,
      range_low: rangeLow,
      range_high: rangeHigh,
      range_midpoint: midpoint,
      range_span: parent.rangeSpan,
      range_confirmation_open_time: parent.confirmation.open_time,
      range_confirmation_close_time: parent.confirmation.close_time,
      parent_entry_deadline: parent.entryDeadline,
      cancel_on_m15_close_break: true,
      trigger_wait_seconds: triggerWaitSeconds,
      expansion_start_open_time: parent.expansionStart.open_time,
      expansion_end_close_time: parent.expansionEnd.close_time,
      expansion_range_atr_ratio: parent.expansionRangeAtrRatio,
      expansion_body_ratio: parent.expansionBodyRatio,
      expansion_group_size: parent.expansionGroupSize,
      sideways_start_open_time: parent.sidewaysStart.open_time,
      sideways_candle_count: 4,
      reentry_index: armIndex,
      reentry_reason: armReason,
      err_detector_passed: true,
      backtest_generation: 'V3',
    },
    priority: 40,
  };
}

function addArm(output, parent, direction, signal, armIndex, armReason, atrValue, h1, minimumSignalTime) {
  if (signal.close_time < minimumSignalTime) return armIndex + 1;
  if (signal.close_time >= parent.entryDeadline) return armIndex + 1;
  const candidate = makeCandidate({ direction, signal, parent, armIndex, armReason, atrValue, h1 });
  if (candidate) output.push(candidate);
  return armIndex + 1;
}

export function detectExpansionRangeReentryCandidates({
  series = {},
  h1 = [],
  nowSeconds = Math.floor(Date.now() / 1000),
  maxSignalAgeSeconds = 21600,
} = {}) {
  const values = normalizeCandles(series.M15 || [], M15_SECONDS);
  const atr = atrSeries(values);
  const output = [];
  const minimumSignalTime = Number(nowSeconds) - Math.max(M15_SECONDS, Number(maxSignalAgeSeconds) || 0);

  let index = 15;
  while (index < values.length - 4) {
    if (!isExpansion(values, atr, index)) {
      index += 1;
      continue;
    }

    const expansionStartIndex = index;
    let expansionEndIndex = index;
    while (expansionEndIndex + 1 < values.length && isExpansion(values, atr, expansionEndIndex + 1)) {
      expansionEndIndex += 1;
    }

    let parent = null;
    const latestSidewaysStart = Math.min(expansionEndIndex + 4, values.length - 4);
    for (let start = expansionEndIndex + 1; start <= latestSidewaysStart; start += 1) {
      const sideways = values.slice(start, start + 4);
      if (sideways.length !== 4) continue;
      const rangeLow = Math.min(...sideways.map(candle => candle.low));
      const rangeHigh = Math.max(...sideways.map(candle => candle.high));
      const rangeSpan = rangeHigh - rangeLow;
      if (rangeSpan < 2.5 || rangeSpan > 10) continue;
      const confirmation = sideways.at(-1);
      const expansionEnd = values[expansionEndIndex];
      const expansionAtr = finite(atr[expansionEndIndex - 1]);
      parent = {
        anchor: `ERR:${values[expansionStartIndex].open_time}:${expansionEnd.close_time}:${confirmation.close_time}:${stable(rangeLow)}:${stable(rangeHigh)}`,
        expansionStart: values[expansionStartIndex],
        expansionEnd,
        expansionGroupSize: expansionEndIndex - expansionStartIndex + 1,
        expansionRangeAtrRatio: expansionAtr > EPSILON ? candleRange(expansionEnd) / expansionAtr : null,
        expansionBodyRatio: candleBody(expansionEnd) / candleRange(expansionEnd),
        sidewaysStart: sideways[0],
        confirmation,
        confirmIndex: start + 3,
        rangeLow,
        rangeHigh,
        rangeSpan,
        midpoint: (rangeLow + rangeHigh) / 2,
        entryDeadline: confirmation.close_time + THREE_HOURS,
      };
      break;
    }

    if (!parent) {
      index = expansionEndIndex + 1;
      continue;
    }

    let armIndex = 0;
    const confirmationClose = parent.confirmation.close;
    if (confirmationClose >= parent.midpoint) {
      armIndex = addArm(output, parent, 'BUY', parent.confirmation, armIndex, 'RANGE_CONFIRMED_ABOVE_MID', atr[parent.confirmIndex], h1, minimumSignalTime);
    }
    if (confirmationClose <= parent.midpoint) {
      armIndex = addArm(output, parent, 'SELL', parent.confirmation, armIndex, 'RANGE_CONFIRMED_BELOW_MID', atr[parent.confirmIndex], h1, minimumSignalTime);
    }

    let terminalIndex = parent.confirmIndex;
    for (let candleIndex = parent.confirmIndex + 1; candleIndex < values.length; candleIndex += 1) {
      const candle = values[candleIndex];
      if (candle.open_time >= parent.entryDeadline) break;
      if (candle.close < parent.rangeLow || candle.close > parent.rangeHigh) {
        terminalIndex = candleIndex;
        break;
      }
      const previous = values[candleIndex - 1];
      const crossedUp = previous.close < parent.midpoint && candle.close >= parent.midpoint;
      const crossedDown = previous.close > parent.midpoint && candle.close <= parent.midpoint;
      if (crossedUp) {
        armIndex = addArm(output, parent, 'BUY', candle, armIndex, 'MIDPOINT_REARM_BUY', atr[candleIndex], h1, minimumSignalTime);
      }
      if (crossedDown) {
        armIndex = addArm(output, parent, 'SELL', candle, armIndex, 'MIDPOINT_REARM_SELL', atr[candleIndex], h1, minimumSignalTime);
      }
      terminalIndex = candleIndex;
    }

    index = Math.max(expansionEndIndex + 1, terminalIndex + 1);
  }

  return [...new Map(output.map(candidate => [candidate.id, candidate])).values()]
    .sort((a, b) => a.signal_candle_close_time - b.signal_candle_close_time || a.priority - b.priority);
}

function acceptedTelemetry(candidate, config = {}) {
  return Object.freeze({
    candidate_id: candidate.id,
    engine_version: candidate.engine_version,
    base_config_version: config?.base_version || BASE_CONFIG_VERSION,
    repair_config_version: config?.repair_version || REPAIR_CONFIG_VERSION,
    driver_id: candidate.driver_id,
    timeframe: candidate.timeframe,
    direction: candidate.direction,
    signal_candle_close_time: candidate.signal_candle_close_time,
    accepted: true,
    gate_id: 'ERR_V3_LOCKED',
    failed_conditions: [],
    features: {
      range_span: candidate.quality.range_span,
      range_low: candidate.quality.range_low,
      range_high: candidate.quality.range_high,
      expansion_range_atr_ratio: candidate.quality.expansion_range_atr_ratio,
      expansion_body_ratio: candidate.quality.expansion_body_ratio,
      reentry_index: candidate.quality.reentry_index,
      planned_entry_price: candidate.quality.planned_entry_price,
      exact_stop_price: candidate.quality.exact_stop_price,
      exact_tp1_price: candidate.quality.exact_tp1_price,
      exact_tp2_price: candidate.quality.exact_tp2_price,
    },
  });
}

export function evaluateExpansionRangeReentryCandidates(input = {}) {
  const enabled = input?.config?.enabled !== false
    && input?.config?.driver_enabled?.[EXPANSION_RANGE_REENTRY_DRIVER.id] !== false;
  if (!enabled) return { candidates: [], telemetry: [], raw_count: 0, rejected_count: 0 };
  const candidates = detectExpansionRangeReentryCandidates(input);
  return {
    candidates,
    telemetry: candidates.map(candidate => acceptedTelemetry(candidate, input?.config)),
    raw_count: candidates.length,
    rejected_count: 0,
  };
}
