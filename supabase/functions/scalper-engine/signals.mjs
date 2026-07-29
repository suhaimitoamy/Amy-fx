import { detectFvgZones, displacementQuality, h1OrderFlowAt, timestampSeconds } from './candles.mjs';

export const ENGINE_VERSION = 'amyfx-preview-scalper-v1.1';

function overlaps(candle, bottom, top) { return candle.high >= bottom && candle.low <= top; }
function rejectionClose(candle, direction, bottom, top) { return direction === 'BUY' ? candle.close > top : candle.close < bottom; }
function brokenByClose(candle, direction, bottom, top) { return direction === 'BUY' ? candle.close < bottom : candle.close > top; }

function buildCandidate({ model, direction, signalCandle, zone, stopReference, bufferAtr, atrValue, h1, quality }) {
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
    max_bars: 4, bars_elapsed: 0, last_evaluated_open_time: null,
    htf_bias: h1.bias, htf_candle_close_time: h1.candle_close_time,
    zone_bottom: zone.bottom, zone_top: zone.top, source_fvg_id: zone.id,
    stop_reference: stopReference, atr_at_signal: atrValue, be_armed: false,
    result_r: null, exit_price: null, exit_time: null,
    quality: quality || {}, priority: model === 'IFVG_SCALPER' ? 1 : 2
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
          stopReference: values[zone.displacement_index].low, bufferAtr: 0.15,
          atrValue: atr[reactionIndex], h1: h1Context, quality
        });
        if (candidate) candidates.push(candidate);
      }
    }

    if (breakIndex < 0) continue;
    const inverseDirection = zone.direction === 'BUY' ? 'SELL' : 'BUY';
    for (let index = breakIndex + 1; index < values.length; index += 1) {
      const candle = values[index];
      if (!overlaps(candle, zone.bottom, zone.top)) continue;
      if (!rejectionClose(candle, inverseDirection, zone.bottom, zone.top)) continue;
      const h1Context = h1OrderFlowAt(h1, candle.close_time);
      const expected = inverseDirection === 'BUY' ? 'BULLISH' : 'BEARISH';
      if (candle.close_time >= minimumSignalTime && h1Context.bias === expected) {
        const breakCandle = values[breakIndex];
        const candidate = buildCandidate({
          model: 'IFVG_SCALPER', direction: inverseDirection, signalCandle: candle, zone,
          stopReference: inverseDirection === 'BUY' ? breakCandle.low : breakCandle.high,
          bufferAtr: 0.10, atrValue: atr[index], h1: h1Context,
          quality: { original_direction: zone.direction, break_candle_open_time: breakCandle.open_time, break_candle_close_time: breakCandle.close_time, inverse_retest_index: index }
        });
        if (candidate) candidates.push(candidate);
      }
      break;
    }
  }
  return [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()]
    .sort((a, b) => a.signal_candle_close_time - b.signal_candle_close_time || a.priority - b.priority);
}
