const M15_SECONDS = 900;
const H1_SECONDS = 3600;
const EPSILON = 1e-9;

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function timestampSeconds(value) {
  const number = finite(value, 0);
  if (number > 10_000_000_000) return Math.floor(number / 1000);
  if (number > 0) return Math.floor(number);
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

export function normalizeCandles(rows, timeframeSeconds = M15_SECONDS) {
  const output = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const openTime = timestampSeconds(row?.open_time ?? row?.openTime ?? row?.time ?? row?.datetime);
    if (!openTime) continue;
    const candle = {
      open_time: openTime,
      close_time: timestampSeconds(row?.close_time ?? row?.closeTime) || openTime + timeframeSeconds,
      open: finite(row?.open), high: finite(row?.high), low: finite(row?.low), close: finite(row?.close),
      is_closed: row?.is_closed !== false && row?.isClosed !== false
    };
    if (![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
    if (candle.high + EPSILON < Math.max(candle.open, candle.close, candle.low)) continue;
    if (candle.low - EPSILON > Math.min(candle.open, candle.close, candle.high)) continue;
    output.push(candle);
  }
  return output.filter(candle => candle.is_closed)
    .sort((a, b) => a.open_time - b.open_time)
    .filter((candle, index, values) => index === 0 || candle.open_time !== values[index - 1].open_time);
}

export function wilderAtr(candles, length = 14) {
  const values = normalizeCandles(candles);
  const output = Array(values.length).fill(NaN);
  if (values.length <= length) return output;
  const tr = values.map((candle, index) => index === 0 ? candle.high - candle.low : Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - values[index - 1].close),
    Math.abs(candle.low - values[index - 1].close)
  ));
  let average = tr.slice(1, length + 1).reduce((sum, value) => sum + value, 0) / length;
  output[length] = average;
  for (let index = length + 1; index < values.length; index += 1) {
    average = ((average * (length - 1)) + tr[index]) / length;
    output[index] = average;
  }
  return output;
}

function isSwingHigh(values, index, length) {
  const price = values[index]?.high;
  if (!Number.isFinite(price) || index < length || index + length >= values.length) return false;
  for (let offset = 1; offset <= length; offset += 1) {
    if (values[index - offset].high >= price || values[index + offset].high > price) return false;
  }
  return true;
}

function isSwingLow(values, index, length) {
  const price = values[index]?.low;
  if (!Number.isFinite(price) || index < length || index + length >= values.length) return false;
  for (let offset = 1; offset <= length; offset += 1) {
    if (values[index - offset].low <= price || values[index + offset].low < price) return false;
  }
  return true;
}

export function latestConfirmedSwing(values, evaluationIndex, length, kind) {
  for (let index = evaluationIndex - length; index >= length; index -= 1) {
    const passed = kind === 'HIGH' ? isSwingHigh(values, index, length) : isSwingLow(values, index, length);
    if (passed) return {
      index, confirmed_index: index + length,
      price: kind === 'HIGH' ? values[index].high : values[index].low,
      time: values[index].open_time
    };
  }
  return null;
}

export function h1OrderFlowAt(h1Rows, signalCloseTime) {
  const values = normalizeCandles(h1Rows, H1_SECONDS)
    .filter(candle => candle.close_time <= timestampSeconds(signalCloseTime));
  let bias = 'NEUTRAL';
  let brokenSwing = null;
  for (let index = 0; index < values.length; index += 1) {
    const high = latestConfirmedSwing(values, index, 2, 'HIGH');
    const low = latestConfirmedSwing(values, index, 2, 'LOW');
    if (high && values[index].close > high.price) {
      bias = 'BULLISH';
      brokenSwing = { ...high, kind: 'HIGH', break_index: index, break_time: values[index].close_time };
    } else if (low && values[index].close < low.price) {
      bias = 'BEARISH';
      brokenSwing = { ...low, kind: 'LOW', break_index: index, break_time: values[index].close_time };
    }
  }
  return {
    bias,
    direction: bias === 'BULLISH' ? 'BUY' : bias === 'BEARISH' ? 'SELL' : 'WAIT',
    candle_open_time: values.at(-1)?.open_time || null,
    candle_close_time: values.at(-1)?.close_time || null,
    broken_swing: brokenSwing
  };
}

export function detectFvgZones(m15Rows) {
  const values = normalizeCandles(m15Rows, M15_SECONDS);
  const atr = wilderAtr(values, 14);
  const zones = [];
  for (let index = 2; index < values.length; index += 1) {
    const first = values[index - 2];
    const middle = values[index - 1];
    const third = values[index];
    const bullish = third.low > first.high;
    const bearish = third.high < first.low;
    if (!bullish && !bearish) continue;
    const direction = bullish ? 'BUY' : 'SELL';
    const bottom = bullish ? first.high : third.high;
    const top = bullish ? third.low : first.low;
    if (!(top > bottom)) continue;
    zones.push({
      id: `FVG:${direction}:${third.open_time}:${bottom.toFixed(5)}:${top.toFixed(5)}`,
      direction, bottom, top, mid: (bottom + top) / 2,
      origin_index: index - 2, displacement_index: index - 1,
      confirmation_index: index, available_index: index,
      created_at: third.close_time, atr_at_creation: atr[index], middle
    });
  }
  return { values, atr, zones };
}

export function displacementQuality(values, atr, zone) {
  const index = zone.displacement_index;
  const candle = values[index];
  const localAtr = atr[index];
  if (!candle || !Number.isFinite(localAtr) || localAtr <= 0) {
    return { passed: false, body_atr: null, body_ratio: null, bos: false, swing_price: null };
  }
  const body = Math.abs(candle.close - candle.open);
  const range = Math.max(candle.high - candle.low, EPSILON);
  const aligned = zone.direction === 'BUY' ? candle.close > candle.open : candle.close < candle.open;
  const swing = latestConfirmedSwing(values, index, 4, zone.direction === 'BUY' ? 'HIGH' : 'LOW');
  const bos = Boolean(swing) && (zone.direction === 'BUY' ? candle.close > swing.price : candle.close < swing.price);
  const bodyAtr = body / localAtr;
  const bodyRatio = body / range;
  return { passed: aligned && bodyAtr >= 1 && bodyRatio >= 0.60 && bos, aligned, body_atr: bodyAtr, body_ratio: bodyRatio, bos, swing_price: swing?.price ?? null };
}
