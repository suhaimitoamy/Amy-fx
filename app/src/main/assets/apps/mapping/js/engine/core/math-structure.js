export function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function atr(candles) {
  const ranges = [];
  const start = Math.max(0, (candles?.length || 0) - 14);
  for (let index = start; index < (candles?.length || 0); index += 1) {
    const previous = candles[index - 1];
    const candle = candles[index];
    const range = previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low;
    if (Number.isFinite(range) && range > 0) ranges.push(range);
  }
  return avg(ranges) || 0.5;
}

export function atrAt(candles, index, period = 14) {
  const end = Math.max(0, Math.min(index, candles?.length || 0));
  const ranges = [];
  for (let cursor = Math.max(0, end - period); cursor < end; cursor += 1) {
    const previous = candles[cursor - 1];
    const candle = candles[cursor];
    const range = previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low;
    if (Number.isFinite(range) && range > 0) ranges.push(range);
  }
  return avg(ranges) || 0.5;
}

export function bodyRatio(candle) {
  return Math.abs(candle.close - candle.open) / Math.max(candle.high - candle.low, 0.0001);
}

export function swings(candles, left = 3, right = 3) {
  const highs = [];
  const lows = [];
  for (let index = left; index < candles.length - right; index += 1) {
    let isHigh = true;
    let isLow = true;
    for (let offset = 1; offset <= left; offset += 1) {
      if (candles[index].high <= candles[index - offset].high) isHigh = false;
      if (candles[index].low >= candles[index - offset].low) isLow = false;
    }
    for (let offset = 1; offset <= right; offset += 1) {
      if (candles[index].high <= candles[index + offset].high) isHigh = false;
      if (candles[index].low >= candles[index + offset].low) isLow = false;
    }
    if (isHigh) highs.push({ ...candles[index], index });
    if (isLow) lows.push({ ...candles[index], index });
  }
  return { highs, lows };
}

export const p2 = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const directionSign = value => value === 'BULLISH' ? 1 : value === 'BEARISH' ? -1 : 0;

function displacementMetrics(candle, localAtr, level, direction) {
  const body = Math.abs(candle.close - candle.open);
  const range = Math.max(candle.high - candle.low, 0.0001);
  const ratio = body / range;
  const atrValue = Math.max(localAtr, 0.0001);
  const penetration = direction === 'BULLISH'
    ? candle.close - level
    : level - candle.close;
  const hasSize = body >= atrValue * 0.6 && range >= atrValue * 0.75;
  const hasDominance = ratio >= 0.55;
  const hasPenetration = penetration >= atrValue * 0.05;
  return {
    body,
    range,
    ratio,
    penetration,
    valid: hasSize && hasDominance && hasPenetration
  };
}

function structureEvent({ candle, level, index, direction, trend, metrics, type }) {
  const valid = type === 'VALID_BREAK';
  return {
    kind: valid && trend !== 'NEUTRAL' && trend !== direction ? 'CHOCH' : 'BOS',
    dir: direction,
    price: level,
    index,
    valid,
    sweepOnly: type === 'SWEEP_ONLY',
    failed: type === 'BREAK_FAILED',
    hasDisplacement: metrics?.valid || false,
    breakType: type,
    candleClose: candle.close,
    candleHigh: candle.high,
    candleLow: candle.low,
    bodyRatio: metrics?.ratio ?? bodyRatio(candle),
    localAtr: metrics?.localAtr ?? 0,
    penetration: metrics?.penetration ?? 0
  };
}

export function detectStructure(cs, sw) {
  let trend = 'NEUTRAL';
  let lastConfirmedBreak = null;
  let lastSweep = null;
  let lastFailedBreak = null;
  let lastEvent = null;
  const events = [];
  const brokenHighSwings = new Set();
  const brokenLowSwings = new Set();

  for (let index = 1; index < cs.length; index += 1) {
    const candle = cs[index];
    const previousHigh = [...sw.highs].reverse().find(item => item.index < index - 1);
    const previousLow = [...sw.lows].reverse().find(item => item.index < index - 1);
    const localAtr = Math.max(atrAt(cs, index), 0.0001);

    if (lastConfirmedBreak && !lastConfirmedBreak.failed) {
      const returnedInside = lastConfirmedBreak.dir === 'BULLISH'
        ? candle.close < lastConfirmedBreak.price
        : candle.close > lastConfirmedBreak.price;
      if (returnedInside) {
        lastConfirmedBreak = { ...lastConfirmedBreak, failed: true };
        lastFailedBreak = {
          ...lastConfirmedBreak,
          breakType: 'BREAK_FAILED',
          failureIndex: index,
          failureClose: candle.close
        };
        lastEvent = lastFailedBreak;
        events.push(lastFailedBreak);
      }
    }

    let breaksHigh = Boolean(previousHigh && !brokenHighSwings.has(previousHigh.index) && candle.high > previousHigh.high);
    let breaksLow = Boolean(previousLow && !brokenLowSwings.has(previousLow.index) && candle.low < previousLow.low);

    if (breaksHigh && breaksLow) {
      if (candle.close > previousHigh.high) breaksLow = false;
      else if (candle.close < previousLow.low) breaksHigh = false;
      else {
        breaksHigh = false;
        breaksLow = false;
      }
    }

    if (breaksHigh) {
      const closedBeyond = candle.close > previousHigh.high;
      const metrics = displacementMetrics(candle, localAtr, previousHigh.high, 'BULLISH');
      metrics.localAtr = localAtr;
      const type = closedBeyond && metrics.valid ? 'VALID_BREAK' : !closedBeyond ? 'SWEEP_ONLY' : null;
      if (type) {
        const event = structureEvent({ candle, level: previousHigh.high, index, direction: 'BULLISH', trend, metrics, type });
        events.push(event);
        lastEvent = event;
        if (type === 'VALID_BREAK') {
          lastConfirmedBreak = event;
          brokenHighSwings.add(previousHigh.index);
          trend = 'BULLISH';
        } else {
          lastSweep = event;
        }
      }
    }

    if (breaksLow) {
      const closedBeyond = candle.close < previousLow.low;
      const metrics = displacementMetrics(candle, localAtr, previousLow.low, 'BEARISH');
      metrics.localAtr = localAtr;
      const type = closedBeyond && metrics.valid ? 'VALID_BREAK' : !closedBeyond ? 'SWEEP_ONLY' : null;
      if (type) {
        const event = structureEvent({ candle, level: previousLow.low, index, direction: 'BEARISH', trend, metrics, type });
        events.push(event);
        lastEvent = event;
        if (type === 'VALID_BREAK') {
          lastConfirmedBreak = event;
          brokenLowSwings.add(previousLow.index);
          trend = 'BEARISH';
        } else {
          lastSweep = event;
        }
      }
    }
  }

  return {
    trend,
    confirmedTrend: trend,
    last: lastEvent,
    lastEvent,
    lastConfirmedBreak,
    lastSweep,
    lastFailedBreak,
    events: events.slice(-30)
  };
}
