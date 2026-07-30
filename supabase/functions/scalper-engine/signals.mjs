import { detectFvgZones, displacementQuality, h1OrderFlowAt, timestampSeconds } from './candles.mjs';

export const ENGINE_VERSION = 'amyfx-preview-scalper-v1.3';

function overlaps(candle, bottom, top) { return candle.high >= bottom && candle.low <= top; }
function rejectionClose(candle, direction, bottom, top) { return direction === 'BUY' ? candle.close > top : candle.close < bottom; }
function brokenByClose(candle, direction, bottom, top) { return direction === 'BUY' ? candle.close < bottom : candle.close > top; }

function inversionQuality(candle, atrValue) {
  const atr = Number(atrValue);
  if (!candle || !Number.isFinite(atr) || atr <= 0) {
    return { passed: false, body_atr: null, body_ratio: null };
  }
  const body = Math.abs(Number(candle.close) - Number(candle.open));
  const range = Math.max(Number(candle.high) - Number(candle.low), 1e-9);
  const bodyAtr = body / atr;
  const bodyRatio = body / range;
  return {
    passed: bodyAtr >= 0.50 && bodyRatio >= 0.40,
    body_atr: bodyAtr,
    body_ratio: bodyRatio,
    minimum_body_atr: 0.50,
    minimum_body_ratio: 0.40
  };
}

function buildCandidate({ model, direction, signalCandle, zone, stopReference, stopReferenceType, bufferAtr, atrValue, h1, quality, maxBars = 4 }) {
  if (!Number.isFinite(atrValue) || atrValue <= 0 || !Number.isFinite(stopReference)) return null;
  return {
    id: `${ENGINE_VERSION}:${model}:${direction}:${signalCandle.open_time}:${zone.id}`,
    engine_version: ENGINE_VERSION, model, symbol: 'XAU/USD', direction,
    status: 'WAITING_NEXT_OPEN', recommendation_status: 'PENDING',
    signal_candle_open_time: signalCandle.open_time,
    signal_candle_close_time: signalCandle.close_time,
    entry_candle_open_time: null, entry_price: null,
    initial_stop_loss: null, stop_loss: null, break_even_trigger: null,
    target_price: null, risk: null, buffer_atr: bufferAtr,
    max_bars: maxBars, bars_elapsed: 0, last_evaluated_open_time: null,
    htf_bias: h1.bias, htf_candle_close_time: h1.candle_close_time,
    zone_bottom: zone.bottom, zone_top: zone.top, source_fvg_id: zone.id,
    stop_reference: stopReference, atr_at_signal: atrValue, be_armed: false,
    result_r: null, exit_price: null, exit_time: null,
    quality: {
      ...(quality || {}),
      source_candle_timestamp: signalCandle.close_time,
      stop_basis: 'STRUCTURAL_WICK_ATR_BUFFER',
      stop_basis_label: 'Structural Wick + ATR Buffer',
      stop_reference_type: stopReferenceType || 'STRUCTURAL_WICK'
    },
    priority: model === 'IFVG_SCALPER' ? 1 : 2
  };
}

export function detectScalperCandidates({ m15, h1, nowSeconds = Math.floor(Date.now() / 1000), maxSignalAgeSeconds = 21600 } = {}) {
  const { values, atr, zones } = detectFvgZones(m15);
  const candidates = [];
  const minimumSignalTime = timestampSeconds(nowSeconds) - Math.max(900, Number(maxSignalAgeSeconds) || 0);
  for (const zone of zones) {
    let reactionIndex = -1;
    let breakIndex = -1;
    for (let index = zone.available_index + 1; index < values.length; index += 1) {
      const candle = values[index];
      if (brokenByClose(candle, zone.direction, zone.bottom, zone.top)) { breakIndex = index; break; }
      if (reactionIndex < 0 && overlaps(candle, zone.bottom, zone.top) && rejectionClose(candle, zone.direction, zone.bottom, zone.top)) reactionIndex = index;
    }

    if (zone.direction === 'BUY' && reactionIndex >= 0) {
      const signalCandle = values[reactionIndex];
      const h1Context = h1OrderFlowAt(h1, signalCandle.close_time);
      const quality = displacementQuality(values, atr, zone);
      if (signalCandle.close_time >= minimumSignalTime && h1Context.bias === 'BULLISH' && quality.passed) {
        const candidate = buildCandidate({
          model: 'FVG_BUY_HIGH_QUALITY', direction: 'BUY', signalCandle, zone,
          stopReference: Math.min(
            values[zone.displacement_index].low,
            signalCandle.low,
            zone.bottom
          ),
          stopReferenceType: 'FVG_STRUCTURAL_WICK',
          bufferAtr: 0.20,
          atrValue: atr[reactionIndex], h1: h1Context, quality
        });
        if (candidate) candidates.push(candidate);
      }
    }

    if (breakIndex < 0) continue;
    const breakCandle = values[breakIndex];
    const inverseQuality = inversionQuality(breakCandle, atr[breakIndex]);
    if (!inverseQuality.passed) continue;

    const inverseDirection = zone.direction === 'BUY' ? 'SELL' : 'BUY';
    for (let index = breakIndex + 1; index < values.length; index += 1) {
      const candle = values[index];
      if (!overlaps(candle, zone.bottom, zone.top)) continue;
      const h1Context = h1OrderFlowAt(h1, candle.close_time);
      if (candle.close_time >= minimumSignalTime) {
        const candidate = buildCandidate({
          model: 'IFVG_SCALPER', direction: inverseDirection, signalCandle: candle, zone,
          stopReference: inverseDirection === 'BUY'
            ? Math.min(candle.low, zone.bottom)
            : Math.max(candle.high, zone.top),
          stopReferenceType: 'IFVG_INVALIDATION_WICK',
          bufferAtr: 0.30,
          atrValue: atr[index], h1: h1Context,
          maxBars: 8,
          quality: {
            original_direction: zone.direction,
            break_candle_open_time: breakCandle.open_time,
            break_candle_close_time: breakCandle.close_time,
            inverse_retest_index: index,
            inversion_body_atr: inverseQuality.body_atr,
            inversion_body_ratio: inverseQuality.body_ratio,
            minimum_inversion_body_atr: inverseQuality.minimum_body_atr,
            minimum_inversion_body_ratio: inverseQuality.minimum_body_ratio,
            htf_filter_applied: false,
            retest_requirement: 'FIRST_OVERLAP'
          }
        });
        if (candidate) candidates.push(candidate);
      }
      break;
    }
  }
  return [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()]
    .sort((a, b) => a.signal_candle_close_time - b.signal_candle_close_time || a.priority - b.priority);
}
