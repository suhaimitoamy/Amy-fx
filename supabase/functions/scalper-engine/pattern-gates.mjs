import { normalizeCandles } from './candles.mjs';

const EPSILON = 1e-9;

export const BASE_CONFIG_VERSION = 'BT6-2025-V1';
export const REPAIR_CONFIG_VERSION = 'BT6.1-2026-H1-V1';
export const AMD_CONFIG_VERSION = 'AMD-2025-V1';

const DRIVER_IDS = Object.freeze([
  'FVG',
  'EMA_PULLBACK',
  'CRT',
  'FALSE_BREAKOUT',
  'TRENDLINE_BREAK_RETEST',
  'BREAKER_BLOCK',
  'ORDER_BLOCK',
  'RETEST_BOS',
  'RANGE_EXPANSION',
  'AMD',
]);

const DEFAULT_DRIVER_SWITCHES = Object.freeze(Object.fromEntries(DRIVER_IDS.map(id => [id, true])));

export const DEFAULT_PATTERN_CONFIG = Object.freeze({
  enabled: true,
  repair_enabled: true,
  shadow_mode: true,
  base_version: BASE_CONFIG_VERSION,
  repair_version: REPAIR_CONFIG_VERSION,
  amd_version: AMD_CONFIG_VERSION,
  driver_enabled: DEFAULT_DRIVER_SWITCHES,
  lifecycle: Object.freeze({
    normal_buffer_atr: 0.18,
    high_volatility_buffer_atr: 0.20,
    high_volatility_ratio: 1.20,
    minimum_volatility_samples: 20,
    stop_cap_points: 50,
    tp1_points: 10,
    tp2_points: 20,
    max_hold_seconds: 24 * 60 * 60,
    break_even_enabled: false,
    same_candle_rule: 'SL_FIRST',
  }),
});

export function resolvePatternConfig(overrides = {}) {
  const driverEnabled = Object.freeze({
    ...DEFAULT_DRIVER_SWITCHES,
    ...(overrides?.driver_enabled || {}),
  });
  const lifecycle = Object.freeze({
    ...DEFAULT_PATTERN_CONFIG.lifecycle,
    ...(overrides?.lifecycle || {}),
  });
  return Object.freeze({
    ...DEFAULT_PATTERN_CONFIG,
    ...overrides,
    driver_enabled: driverEnabled,
    lifecycle,
  });
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function candleRange(candle) {
  return Math.max(EPSILON, finite(candle?.high) - finite(candle?.low));
}

function trueRange(values, index) {
  const candle = values[index];
  if (!candle) return NaN;
  if (index === 0) return candleRange(candle);
  const previous = values[index - 1];
  return Math.max(
    candleRange(candle),
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close),
  );
}

function wilderAtr(values, length = 14) {
  const output = Array(values.length).fill(NaN);
  if (values.length <= length) return output;
  let average = 0;
  for (let index = 1; index <= length; index += 1) average += trueRange(values, index);
  average /= length;
  output[length] = average;
  for (let index = length + 1; index < values.length; index += 1) {
    average = ((average * (length - 1)) + trueRange(values, index)) / length;
    output[index] = average;
  }
  return output;
}

function ema(values, length) {
  const output = Array(values.length).fill(NaN);
  if (!values.length) return output;
  const weight = 2 / (length + 1);
  let current = values[0].close;
  output[0] = current;
  for (let index = 1; index < values.length; index += 1) {
    current = values[index].close * weight + current * (1 - weight);
    output[index] = current;
  }
  return output;
}

function median(input) {
  const values = input.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return NaN;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function inclusive(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function derivePatternFeatures({
  rows = [],
  timeframeSeconds = 900,
  signalOpenTime,
  direction,
  stopReference,
  plannedEntryPrice,
  lifecycle = DEFAULT_PATTERN_CONFIG.lifecycle,
} = {}) {
  const values = normalizeCandles(rows, timeframeSeconds);
  const index = values.findIndex(candle => Number(candle.open_time) === Number(signalOpenTime));
  if (index < 0) return null;

  const signal = values[index];
  const atr = wilderAtr(values, 14);
  const ema20 = ema(values, 20);
  const ema50 = ema(values, 50);
  const localAtr = finite(atr[index]);
  if (!(localAtr > EPSILON)) return null;

  const previousAtr = atr.slice(Math.max(0, index - 50), index).filter(Number.isFinite);
  const atrMedian50 = median(previousAtr);
  const atrRatio50 = atrMedian50 > EPSILON ? localAtr / atrMedian50 : NaN;
  const highVolatility = previousAtr.length >= Number(lifecycle.minimum_volatility_samples || 20)
    && atrRatio50 >= Number(lifecycle.high_volatility_ratio || 1.20);
  const bufferAtr = highVolatility
    ? Number(lifecycle.high_volatility_buffer_atr || 0.20)
    : Number(lifecycle.normal_buffer_atr || 0.18);

  const side = String(direction || '').toUpperCase();
  const entry = Number.isFinite(finite(plannedEntryPrice)) ? finite(plannedEntryPrice) : signal.close;
  const reference = finite(stopReference);
  const plannedStop = side === 'BUY' ? reference - localAtr * bufferAtr : reference + localAtr * bufferAtr;
  const riskPoints = Math.abs(entry - plannedStop);
  const signalRange = candleRange(signal);
  const signalBody = Math.abs(signal.close - signal.open);
  const lowerWick = Math.max(0, Math.min(signal.open, signal.close) - signal.low);
  const upperWick = Math.max(0, signal.high - Math.max(signal.open, signal.close));
  const closeStrength = side === 'BUY'
    ? (signal.close - signal.low) / signalRange
    : (signal.high - signal.close) / signalRange;
  const rejectionWick = side === 'BUY' ? lowerWick : upperWick;
  const trendAligned = side === 'BUY' ? ema20[index] > ema50[index] : ema20[index] < ema50[index];
  const trendStrengthAtr = Math.abs(ema20[index] - ema50[index]) / localAtr;

  return Object.freeze({
    source_candle_open_time: signal.open_time,
    source_candle_close_time: signal.close_time,
    trend_aligned: trendAligned,
    trend_strength_atr: trendStrengthAtr,
    signal_body_atr: signalBody / localAtr,
    signal_body_ratio: signalBody / signalRange,
    close_strength: closeStrength,
    rejection_wick_ratio: rejectionWick / signalRange,
    risk_points: riskPoints,
    risk_atr: riskPoints / localAtr,
    atr14: localAtr,
    atr_median50: Number.isFinite(atrMedian50) ? atrMedian50 : null,
    atr_ratio50: Number.isFinite(atrRatio50) ? atrRatio50 : null,
    atr_ratio50_samples: previousAtr.length,
    volatility_bucket: inclusive(atrRatio50, 0.75, 1.20)
      ? 'NORMAL'
      : inclusive(atrRatio50, 0.95, 1.50)
        ? 'ACTIVE'
        : atrRatio50 <= 1.50
          ? 'NOT_EXTREME'
          : 'EXTREME',
    high_volatility: highVolatility,
    buffer_atr: bufferAtr,
    planned_entry_price: entry,
    planned_stop_price: plannedStop,
  });
}

function rule(id, checks) {
  const failed = checks.filter(check => !check[1]).map(check => check[0]);
  return Object.freeze({ id, passed: failed.length === 0, failed });
}

function normal(features) {
  return inclusive(Number(features.atr_ratio50), 0.75, 1.20);
}

function active(features) {
  return inclusive(Number(features.atr_ratio50), 0.95, 1.50);
}

function notExtreme(features) {
  return Number.isFinite(Number(features.atr_ratio50)) && Number(features.atr_ratio50) <= 1.50;
}

function basePatterns(driverId, timeframe, f) {
  switch (driverId) {
    case 'FVG':
      return [
        rule('FVG_A', [['trend_strength>=0.60', f.trend_strength_atr >= 0.60], ['body_atr>=0.20', f.signal_body_atr >= 0.20], ['risk_atr=1.20..3.50', inclusive(f.risk_atr, 1.20, 3.50)], ['volatility=normal', normal(f)]]),
        rule('FVG_B', [['wick>=0.15', f.rejection_wick_ratio >= 0.15], ['close_strength>=0.70', f.close_strength >= 0.70], ['risk_atr=1.00..3.00', inclusive(f.risk_atr, 1.00, 3.00)], ['volatility=normal', normal(f)]]),
      ];
    case 'EMA_PULLBACK':
      return [
        rule('EMA_A', [['timeframe=H4', timeframe === 'H4'], ['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['close_strength>=0.55', f.close_strength >= 0.55], ['risk_points=8..25', inclusive(f.risk_points, 8, 25)]]),
        rule('EMA_B', [['wick>=0.45', f.rejection_wick_ratio >= 0.45], ['close_strength>=0.82', f.close_strength >= 0.82], ['risk_atr=1.20..3.50', inclusive(f.risk_atr, 1.20, 3.50)], ['volatility=not_extreme', notExtreme(f)]]),
      ];
    case 'CRT':
      return [
        rule('CRT_A', [['wick>=0.30', f.rejection_wick_ratio >= 0.30], ['close_strength>=0.70', f.close_strength >= 0.70], ['risk_atr=1.20..3.50', inclusive(f.risk_atr, 1.20, 3.50)], ['volatility=not_extreme', notExtreme(f)]]),
        rule('CRT_B', [['trend_aligned', f.trend_aligned === true], ['body_atr>=0.35', f.signal_body_atr >= 0.35], ['close_strength>=0.55', f.close_strength >= 0.55], ['risk_points=8..25', inclusive(f.risk_points, 8, 25)]]),
      ];
    case 'FALSE_BREAKOUT':
      return [
        rule('FALSE_BREAKOUT_A', [['wick>=0.15', f.rejection_wick_ratio >= 0.15], ['close_strength>=0.70', f.close_strength >= 0.70], ['risk_points=15..35', inclusive(f.risk_points, 15, 35)]]),
        rule('FALSE_BREAKOUT_B', [['timeframe=H1/H4', ['H1', 'H4'].includes(timeframe)], ['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['close_strength>=0.82', f.close_strength >= 0.82], ['risk_points=15..35', inclusive(f.risk_points, 15, 35)]]),
      ];
    case 'TRENDLINE_BREAK_RETEST':
      return [rule('TRENDLINE', [['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['close_strength>=0.82', f.close_strength >= 0.82], ['risk_points=12..30', inclusive(f.risk_points, 12, 30)], ['volatility=normal', normal(f)]])];
    case 'BREAKER_BLOCK':
      return [
        rule('BREAKER_A', [['trend_strength>=0.25', f.trend_strength_atr >= 0.25], ['body_atr>=0.20', f.signal_body_atr >= 0.20], ['risk_points=12..30', inclusive(f.risk_points, 12, 30)], ['volatility=active', active(f)]]),
        rule('BREAKER_B', [['trend_aligned', f.trend_aligned === true], ['body_atr>=0.20', f.signal_body_atr >= 0.20], ['risk_points=15..35', inclusive(f.risk_points, 15, 35)], ['volatility=not_extreme', notExtreme(f)]]),
      ];
    case 'ORDER_BLOCK':
      return [
        rule('ORDER_BLOCK_A', [['trend_strength>=0.60', f.trend_strength_atr >= 0.60], ['body_atr>=0.20', f.signal_body_atr >= 0.20], ['close_strength>=0.55', f.close_strength >= 0.55], ['risk_points=8..25', inclusive(f.risk_points, 8, 25)]]),
        rule('ORDER_BLOCK_B', [['wick>=0.15', f.rejection_wick_ratio >= 0.15], ['close_strength>=0.70', f.close_strength >= 0.70], ['risk_atr=0.80..2.50', inclusive(f.risk_atr, 0.80, 2.50)], ['volatility=active', active(f)]]),
      ];
    case 'RETEST_BOS':
      return [
        rule('RETEST_BOS_A', [['trend_strength>=0.60', f.trend_strength_atr >= 0.60], ['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['close_strength>=0.55', f.close_strength >= 0.55], ['risk_points=10..25', inclusive(f.risk_points, 10, 25)]]),
        rule('RETEST_BOS_B', [['trend_strength>=0.60', f.trend_strength_atr >= 0.60], ['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['risk_points=10..25', inclusive(f.risk_points, 10, 25)], ['volatility=normal', normal(f)]]),
      ];
    case 'RANGE_EXPANSION':
      return [rule('RANGE_EXPANSION', [['body_ratio>=0.70', f.signal_body_ratio >= 0.70], ['close_strength>=0.82', f.close_strength >= 0.82], ['risk_points=15..35', inclusive(f.risk_points, 15, 35)], ['volatility=active', active(f)]])];
    default:
      return [];
  }
}

function repairOverlay(driverId, direction, f) {
  switch (driverId) {
    case 'ORDER_BLOCK':
      return rule('BT6.1_ORDER_BLOCK', [[
        '(body_atr>=0.35 AND close_strength<=0.82) OR (timeframe!=M15 AND risk_points<=25)',
        (f.signal_body_atr >= 0.35 && f.close_strength <= 0.82)
          || (String(f.timeframe) !== 'M15' && f.risk_points <= 25),
      ]]);
    case 'RETEST_BOS':
      return rule('BT6.1_RETEST_BOS', [[
        'risk_points<=18 OR (trend_strength=0.60..1.50 AND risk_points<=20)',
        f.risk_points <= 18 || (inclusive(f.trend_strength_atr, 0.60, 1.50) && f.risk_points <= 20),
      ]]);
    case 'EMA_PULLBACK':
      return rule('BT6.1_EMA', [[
        'SELL OR (BUY AND body_atr>=0.35 AND trend_strength=0.00..1.00)',
        direction === 'SELL' || (direction === 'BUY' && f.signal_body_atr >= 0.35 && inclusive(f.trend_strength_atr, 0, 1.00)),
      ]]);
    case 'BREAKER_BLOCK':
      return rule('BT6.1_BREAKER', [[
        'SELL OR (BUY AND atr_ratio50>=1.10 AND wick>=0.15)',
        direction === 'SELL' || (direction === 'BUY' && Number(f.atr_ratio50) >= 1.10 && f.rejection_wick_ratio >= 0.15),
      ]]);
    default:
      return rule('NO_REPAIR_OVERLAY', []);
  }
}

function telemetry(candidate, accepted, gateId, failedConditions, features, config) {
  return Object.freeze({
    candidate_id: candidate.id,
    engine_version: candidate.engine_version,
    base_config_version: config.base_version,
    repair_config_version: config.repair_version,
    driver_id: candidate.driver_id,
    timeframe: candidate.timeframe,
    direction: candidate.direction,
    signal_candle_close_time: candidate.signal_candle_close_time,
    accepted,
    gate_id: gateId,
    failed_conditions: failedConditions,
    features,
  });
}

export function evaluatePatternGate(candidate, rows, suppliedConfig = DEFAULT_PATTERN_CONFIG) {
  const config = resolvePatternConfig(suppliedConfig);
  const driverId = String(candidate?.driver_id || '');
  if (!config.enabled) {
    return { candidate: null, telemetry: telemetry(candidate, false, 'GLOBAL_KILL_SWITCH', ['config.enabled=false'], null, config) };
  }
  if (config.driver_enabled?.[driverId] !== true) {
    return { candidate: null, telemetry: telemetry(candidate, false, 'DRIVER_KILL_SWITCH', [`driver_enabled.${driverId}=false`], null, config) };
  }

  const sourceOpenTime = candidate?.quality?.feature_candle_open_time || candidate?.signal_candle_open_time;
  const features = derivePatternFeatures({
    rows,
    timeframeSeconds: candidate?.quality?.timeframe_seconds,
    signalOpenTime: sourceOpenTime,
    direction: candidate.direction,
    stopReference: candidate.stop_reference,
    plannedEntryPrice: candidate?.quality?.planned_entry_price,
    lifecycle: config.lifecycle,
  });
  if (!features) {
    return { candidate: null, telemetry: telemetry(candidate, false, 'FEATURES_UNAVAILABLE', ['closed_signal_features_unavailable'], null, config) };
  }

  const enrichedFeatures = Object.freeze({ ...features, timeframe: candidate.timeframe });
  let gateId = 'AMD_DISTRIBUTION';
  let failedConditions = [];
  if (driverId === 'AMD') {
    const amd = rule('AMD_DISTRIBUTION', [
      ['amd_detector_passed', candidate?.quality?.amd_detector_passed === true],
      ['timeframe=M30/H1', ['M30', 'H1'].includes(candidate.timeframe)],
      ['risk_points=10..30', inclusive(enrichedFeatures.risk_points, 10, 30)],
      ['risk_points<=50', enrichedFeatures.risk_points <= Number(config.lifecycle.stop_cap_points || 50)],
    ]);
    if (!amd.passed) {
      return { candidate: null, telemetry: telemetry(candidate, false, amd.id, amd.failed, enrichedFeatures, config) };
    }
  } else {
    const patterns = basePatterns(driverId, candidate.timeframe, enrichedFeatures);
    const passed = patterns.find(pattern => pattern.passed);
    if (!passed) {
      gateId = 'BT6_BASE_REJECTED';
      failedConditions = patterns.flatMap(pattern => pattern.failed.map(item => `${pattern.id}:${item}`));
      return { candidate: null, telemetry: telemetry(candidate, false, gateId, failedConditions, enrichedFeatures, config) };
    }
    gateId = passed.id;
    if (config.repair_enabled) {
      const overlay = repairOverlay(driverId, candidate.direction, enrichedFeatures);
      if (!overlay.passed) {
        return { candidate: null, telemetry: telemetry(candidate, false, overlay.id, overlay.failed, enrichedFeatures, config) };
      }
      if (overlay.id !== 'NO_REPAIR_OVERLAY') gateId = `${gateId}+${overlay.id}`;
    }
  }

  const quality = Object.freeze({
    ...(candidate.quality || {}),
    pattern_features: enrichedFeatures,
    pattern_gate: gateId,
    base_config_version: config.base_version,
    repair_config_version: config.repair_version,
    amd_config_version: config.amd_version,
    lifecycle_policy: 'BT6_FIXED_POINTS_NO_BE',
    tp1_points: config.lifecycle.tp1_points,
    tp2_points: config.lifecycle.tp2_points,
    target_r: null,
    be_trigger_r: null,
    break_even_enabled: false,
    max_hold_seconds: config.lifecycle.max_hold_seconds,
    same_candle_rule: config.lifecycle.same_candle_rule,
    stop_cap_points: config.lifecycle.stop_cap_points,
  });
  const accepted = Object.freeze({
    ...candidate,
    buffer_atr: enrichedFeatures.buffer_atr,
    quality,
  });
  return { candidate: accepted, telemetry: telemetry(accepted, true, gateId, [], enrichedFeatures, config) };
}
