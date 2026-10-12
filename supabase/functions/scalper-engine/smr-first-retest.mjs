import { normalizeCandles, timestampSeconds, latestConfirmedSwing } from './candles.mjs';
import { ENGINE_VERSION, SETUP_SCHEMA_VERSION } from './drivers.mjs';
import { BASE_CONFIG_VERSION, REPAIR_CONFIG_VERSION } from './pattern-gates.mjs';

export const SMR_FIRST_RETEST_VERSION = 'SMR-FIRST-RETEST-BT09F-LIVE-V1';
export const SMR_FIRST_RETEST_DRIVER = Object.freeze({
  enabled: true,
  id: 'SMR_FIRST_RETEST',
  name: 'SMR / First Retest',
  version: SMR_FIRST_RETEST_VERSION,
  timeframes: ['M5'],
});

const M5_SECONDS = 300;
const D1_SECONDS = 86400;
const FOUR_HOURS = 4 * 60 * 60;
const EPSILON = 1e-9;

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function body(candle) {
  return Math.abs(Number(candle.close) - Number(candle.open));
}

function range(candle) {
  return Math.max(EPSILON, Number(candle.high) - Number(candle.low));
}

function atrSeries(values, length = 14) {
  const output = Array(values.length).fill(NaN);
  if (values.length <= length) return output;
  const tr = values.map((candle, index) => index === 0
    ? range(candle)
    : Math.max(
      range(candle),
      Math.abs(candle.high - values[index - 1].close),
      Math.abs(candle.low - values[index - 1].close),
    ));
  let average = tr.slice(1, length + 1).reduce((sum, value) => sum + value, 0) / length;
  output[length] = average;
  for (let index = length + 1; index < values.length; index += 1) {
    average = ((average * (length - 1)) + tr[index]) / length;
    output[index] = average;
  }
  return output;
}

function dailyBiasAt(d1Rows, signalCloseTime) {
  const values = normalizeCandles(d1Rows, D1_SECONDS)
    .filter(candle => candle.close_time <= timestampSeconds(signalCloseTime));
  let bias = 'NEUTRAL';
  let lastBreak = null;
  for (let index = 0; index < values.length; index += 1) {
    const high = latestConfirmedSwing(values, index, 2, 'HIGH');
    const low = latestConfirmedSwing(values, index, 2, 'LOW');
    if (high && values[index].close > high.price) {
      bias = 'BULLISH';
      lastBreak = { side: 'HIGH', level: high.price, break_time: values[index].close_time };
    } else if (low && values[index].close < low.price) {
      bias = 'BEARISH';
      lastBreak = { side: 'LOW', level: low.price, break_time: values[index].close_time };
    }
  }
  return { bias, lastBreak, source_close_time: values.at(-1)?.close_time || null };
}

function alignedDaily(direction, daily) {
  return direction === 'BUY' ? daily.bias === 'BULLISH' : daily.bias === 'BEARISH';
}

function sweepAt(values, index) {
  const candle = values[index];
  const high = latestConfirmedSwing(values, index, 1, 'HIGH');
  const low = latestConfirmedSwing(values, index, 1, 'LOW');
  // Missing anchors are false, not null: equality below requires booleans.
  const lowSweep = Boolean(low) && candle.low < low.price && candle.close > low.price;
  const highSweep = Boolean(high) && candle.high > high.price && candle.close < high.price;
  if (lowSweep === highSweep) return null;
  return lowSweep
    ? { direction: 'BUY', side: 'SSL', level: low.price, extreme: candle.low, index, close_time: candle.close_time }
    : { direction: 'SELL', side: 'BSL', level: high.price, extreme: candle.high, index, close_time: candle.close_time };
}

function mssAt(values, atr, index, direction) {
  if (index < 2) return null;
  const candle = values[index];
  const priorAtr = finite(atr[index - 1]);
  if (!(priorAtr > 0)) return null;
  const aligned = direction === 'BUY' ? candle.close > candle.open : candle.close < candle.open;
  if (!aligned || body(candle) < priorAtr * 0.80) return null;
  const opposing = latestConfirmedSwing(values, index, 1, direction === 'BUY' ? 'HIGH' : 'LOW');
  if (!opposing) return null;
  const broken = direction === 'BUY' ? candle.close > opposing.price : candle.close < opposing.price;
  if (!broken) return null;
  return {
    index,
    direction,
    level: opposing.price,
    body_atr: body(candle) / priorAtr,
    body_ratio: body(candle) / range(candle),
    atr: priorAtr,
    close_time: candle.close_time,
  };
}

function fvgAt(values, index, direction) {
  if (index < 2) return null;
  const first = values[index - 2];
  const third = values[index];
  if (direction === 'BUY' && third.low > first.high) {
    return { kind: 'FVG', bottom: first.high, top: third.low, origin_index: index - 2, confirmation_index: index };
  }
  if (direction === 'SELL' && third.high < first.low) {
    return { kind: 'FVG', bottom: third.high, top: first.low, origin_index: index - 2, confirmation_index: index };
  }
  return null;
}

function orderBlockBefore(values, breakIndex, direction) {
  const start = Math.max(0, breakIndex - 8);
  for (let index = breakIndex - 1; index >= start; index -= 1) {
    const candle = values[index];
    const opposite = direction === 'BUY' ? candle.close < candle.open : candle.close > candle.open;
    if (!opposite) continue;
    const bottom = direction === 'BUY' ? candle.low : candle.open;
    const top = direction === 'BUY' ? candle.open : candle.high;
    if (top > bottom) return { kind: 'OB', bottom, top, origin_index: index, confirmation_index: breakIndex };
  }
  return null;
}

function firstRetest(values, fromIndex, direction, zone) {
  const deadline = values[fromIndex].close_time + FOUR_HOURS;
  for (let index = fromIndex + 1; index < values.length; index += 1) {
    const candle = values[index];
    if (candle.open_time > deadline) break;
    const invalidated = direction === 'BUY' ? candle.close < zone.bottom : candle.close > zone.top;
    const touched = candle.high >= zone.bottom && candle.low <= zone.top;
    if (invalidated && !touched) return null;
    if (touched) return { index, candle };
  }
  return null;
}

function stable(value) {
  return Number(value).toFixed(5);
}

function candidateId(direction, sweep, mss, zone, retest) {
  return [
    ENGINE_VERSION,
    SMR_FIRST_RETEST_DRIVER.id,
    SMR_FIRST_RETEST_VERSION,
    direction,
    sweep.close_time,
    mss.close_time,
    zone.kind,
    retest.candle.open_time,
    stable(zone.bottom),
    stable(zone.top),
  ].join(':');
}

function buildCandidate({ direction, sweep, mss, zone, retest, daily }) {
  const signal = retest.candle;
  const atr = Number(mss.atr);
  const stopReference = direction === 'BUY'
    ? Math.min(sweep.extreme, zone.bottom, signal.low)
    : Math.max(sweep.extreme, zone.top, signal.high);
  if (!(zone.top > zone.bottom) || !(atr > 0) || !Number.isFinite(stopReference)) return null;
  return {
    id: candidateId(direction, sweep, mss, zone, retest),
    engine_version: ENGINE_VERSION,
    model: SMR_FIRST_RETEST_DRIVER.id,
    driver_id: SMR_FIRST_RETEST_DRIVER.id,
    driver_name: SMR_FIRST_RETEST_DRIVER.name,
    driver_rule_version: SMR_FIRST_RETEST_VERSION,
    timeframe: 'M5',
    schema_version: SETUP_SCHEMA_VERSION,
    symbol: 'XAU/USD',
    direction,
    status: 'WAITING_NEXT_OPEN',
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
    buffer_atr: 0.18,
    max_bars: 288,
    bars_elapsed: 0,
    last_evaluated_open_time: null,
    htf_bias: daily.bias,
    htf_candle_close_time: daily.source_close_time,
    zone_bottom: zone.bottom,
    zone_top: zone.top,
    source_fvg_id: `SMR:${zone.kind}:${zone.origin_index}:${zone.confirmation_index}`,
    stop_reference: stopReference,
    atr_at_signal: atr,
    be_armed: false,
    result_r: null,
    exit_price: null,
    exit_time: null,
    quality: {
      driver_id: SMR_FIRST_RETEST_DRIVER.id,
      driver_name: SMR_FIRST_RETEST_DRIVER.name,
      driver_rule_version: SMR_FIRST_RETEST_VERSION,
      timeframe: 'M5',
      timeframe_seconds: M5_SECONDS,
      schema_version: SETUP_SCHEMA_VERSION,
      source_candle_timestamp: signal.close_time,
      source_anchor: `SWEEP:${sweep.side}:${sweep.close_time}:MSS:${mss.close_time}`,
      reason: `HTF-aligned SMR: ${sweep.side} sweep/reclaim → displaced MSS → first ${zone.kind} retest`,
      research_reference: 'ICT_BT09F_SMR_2005_2026',
      research_scope: 'DIRECTIONAL_SELECTOR_AND_RETEST_TIMING_NOT_EXPECTANCY',
      daily_htf_bias: daily.bias,
      daily_htf_break: daily.lastBreak,
      sweep_side: sweep.side,
      sweep_level: sweep.level,
      sweep_extreme: sweep.extreme,
      mss_level: mss.level,
      mss_body_atr: mss.body_atr,
      mss_body_ratio: mss.body_ratio,
      poi_kind: zone.kind,
      poi_bottom: zone.bottom,
      poi_top: zone.top,
      first_retest: true,
      stop_basis: 'SWEEP_OR_POI_STRUCTURAL_INVALIDATION_ATR_BUFFER',
      stop_basis_label: 'SMR structural invalidation + ATR buffer',
      max_hold_seconds: 24 * 60 * 60,
      entry_model: 'NEXT_OPEN',
      tp1_points: 10,
      tp2_points: 20,
      stop_cap_points: 50,
      lifecycle_policy: 'BT6_FIXED_POINTS_NO_BE',
    },
    priority: 32,
  };
}

export function detectSmrFirstRetestCandidates({
  series = {},
  nowSeconds = Math.floor(Date.now() / 1000),
  maxSignalAgeSeconds = 21600,
  config = {},
} = {}) {
  const enabled = config?.enabled !== false
    && config?.driver_enabled?.[SMR_FIRST_RETEST_DRIVER.id] !== false;
  if (!enabled) return [];
  const values = normalizeCandles(series.M5 || [], M5_SECONDS);
  const d1 = normalizeCandles(series.D1 || [], D1_SECONDS);
  if (values.length < 30 || d1.length < 8) return [];
  const atr = atrSeries(values, 14);
  const minimum = timestampSeconds(nowSeconds) - Math.max(M5_SECONDS, Number(maxSignalAgeSeconds) || 0);
  const out = [];

  for (let sweepIndex = 3; sweepIndex < values.length; sweepIndex += 1) {
    const sweep = sweepAt(values, sweepIndex);
    if (!sweep) continue;
    const daily = dailyBiasAt(d1, sweep.close_time);
    if (!alignedDaily(sweep.direction, daily)) continue;
    const mssDeadline = sweep.close_time + FOUR_HOURS;
    let mss = null;
    for (let index = sweepIndex + 1; index < values.length; index += 1) {
      if (values[index].open_time > mssDeadline) break;
      mss = mssAt(values, atr, index, sweep.direction);
      if (mss) break;
    }
    if (!mss) continue;
    const zone = fvgAt(values, mss.index, sweep.direction) || orderBlockBefore(values, mss.index, sweep.direction);
    if (!zone) continue;
    const retest = firstRetest(values, mss.index, sweep.direction, zone);
    if (!retest || retest.candle.close_time < minimum) continue;
    const candidate = buildCandidate({ direction: sweep.direction, sweep, mss, zone, retest, daily });
    if (candidate) out.push(candidate);
  }

  return [...new Map(out.map(item => [item.id, item])).values()]
    .sort((a, b) => a.signal_candle_close_time - b.signal_candle_close_time);
}

function acceptedTelemetry(candidate, config = {}) {
  return {
    candidate_id: candidate.id,
    engine_version: candidate.engine_version,
    base_config_version: config?.base_version || BASE_CONFIG_VERSION,
    repair_config_version: config?.repair_version || REPAIR_CONFIG_VERSION,
    driver_id: candidate.driver_id,
    timeframe: candidate.timeframe,
    direction: candidate.direction,
    signal_candle_close_time: candidate.signal_candle_close_time,
    accepted: true,
    gate_id: 'SMR_BT09F_LOCKED',
    failed_conditions: [],
    features: {
      daily_htf_bias: candidate.quality.daily_htf_bias,
      sweep_side: candidate.quality.sweep_side,
      sweep_level: candidate.quality.sweep_level,
      mss_level: candidate.quality.mss_level,
      mss_body_atr: candidate.quality.mss_body_atr,
      poi_kind: candidate.quality.poi_kind,
      poi_bottom: candidate.quality.poi_bottom,
      poi_top: candidate.quality.poi_top,
      first_retest: true,
    },
  };
}

export function evaluateSmrFirstRetestCandidates(input = {}) {
  const enabled = input?.config?.enabled !== false
    && input?.config?.driver_enabled?.[SMR_FIRST_RETEST_DRIVER.id] !== false;
  if (!enabled) return { candidates: [], telemetry: [], raw_count: 0, rejected_count: 0 };
  const candidates = detectSmrFirstRetestCandidates(input);
  return {
    candidates,
    telemetry: candidates.map(candidate => acceptedTelemetry(candidate, input?.config)),
    raw_count: candidates.length,
    rejected_count: 0,
  };
}
