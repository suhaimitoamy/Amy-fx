const SOURCE_TIMEFRAMES = Object.freeze(['M5', 'M15', 'H1', 'H4']);
const TRIGGER_TIMEFRAME = Object.freeze({ M5: 'M1', M15: 'M5', H1: 'M5', H4: 'M15' });
const TF_SECONDS = Object.freeze({ M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400 });
const TF_PRIORITY = Object.freeze({ H4: -0.30, H1: -0.20, M15: -0.10, M5: 0 });
const KIND_PRIORITY = Object.freeze({ LIQUIDITY: 0, ORDER_BLOCK: 0.04, FVG: 0.08, IFVG: 0.03, BREAKER_BLOCK: 0.03, VALID_BREAK: 0.02 });

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeCandles(candles) {
  const unique = new Map();
  for (const row of Array.isArray(candles) ? candles : []) {
    const candle = {
      time: finite(row?.time),
      open: finite(row?.open),
      high: finite(row?.high),
      low: finite(row?.low),
      close: finite(row?.close)
    };
    if (![candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
    if (candle.high < Math.max(candle.open, candle.close, candle.low)) continue;
    if (candle.low > Math.min(candle.open, candle.close, candle.high)) continue;
    unique.set(candle.time, candle);
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}

function atr14(candles) {
  const values = normalizeCandles(candles);
  if (values.length < 14) return NaN;
  const ranges = values.map((candle, index) => {
    const previous = values[index - 1];
    return previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low;
  });
  let current = ranges.slice(0, 14).reduce((sum, value) => sum + value, 0) / 14;
  for (let index = 14; index < ranges.length; index += 1) current = ((current * 13) + ranges[index]) / 14;
  return current;
}

export function normalizeEntryDirection(value) {
  const direction = String(value || '').toUpperCase();
  if (direction.includes('BUY') || direction.includes('BULL')) return 'BUY';
  if (direction.includes('SELL') || direction.includes('BEAR')) return 'SELL';
  return 'WAIT';
}

function oppositeDirection(direction) {
  return direction === 'BUY' ? 'SELL' : direction === 'SELL' ? 'BUY' : 'WAIT';
}

function transformedKind(kind) {
  if (kind === 'FVG') return 'IFVG';
  if (kind === 'ORDER_BLOCK') return 'BREAKER_BLOCK';
  if (kind === 'LIQUIDITY') return 'VALID_BREAK';
  if (kind === 'IFVG') return 'FVG';
  if (kind === 'BREAKER_BLOCK') return 'ORDER_BLOCK';
  return 'VALID_BREAK';
}

function candidateId(tf, kind, direction, id, bottom, top) {
  return ['ENTRY_WATCH', tf, kind, direction, id || '', finite(bottom, 0).toFixed(5), finite(top, 0).toFixed(5)].join(':');
}

function zoneCandidate(zone, tf, direction, kind, currentPrice, atr) {
  const bottom = finite(zone?.bottom);
  const top = finite(zone?.top);
  if (![bottom, top].every(Number.isFinite) || top < bottom) return null;
  const level = direction === 'BUY' ? bottom : top;
  const distance = Math.abs(currentPrice - level);
  return {
    id: candidateId(tf, kind, direction, zone?.id, bottom, top),
    sourceId: zone?.id || '',
    sourceTf: tf,
    triggerTf: TRIGGER_TIMEFRAME[tf] || tf,
    sourceKind: kind,
    sourceLabel: zone?.label || zone?.kind || kind,
    direction,
    bottom,
    top,
    level,
    atr,
    distance,
    distanceAtr: Number.isFinite(atr) && atr > 0 ? distance / atr : Infinity,
    availableTime: finite(zone?.createdAt, 0),
    originIndex: finite(zone?.originIndex, -1),
    sourceStatus: zone?.status || 'DETECTED',
    converted: Boolean(zone?.converted)
  };
}

function liquidityCandidate(levelItem, tf, direction, currentPrice, atr) {
  const level = finite(levelItem?.level);
  if (!Number.isFinite(level)) return null;
  const type = String(levelItem?.type || '').toUpperCase();
  if (direction === 'BUY' && type !== 'SSL') return null;
  if (direction === 'SELL' && type !== 'BSL') return null;
  const distance = Math.abs(currentPrice - level);
  return {
    id: candidateId(tf, 'LIQUIDITY', direction, levelItem?.id, level, level),
    sourceId: levelItem?.id || '',
    sourceTf: tf,
    triggerTf: TRIGGER_TIMEFRAME[tf] || tf,
    sourceKind: 'LIQUIDITY',
    sourceLabel: levelItem?.label || levelItem?.subtype || type,
    liquidityType: type,
    direction,
    bottom: level,
    top: level,
    level,
    atr,
    distance,
    distanceAtr: Number.isFinite(atr) && atr > 0 ? distance / atr : Infinity,
    availableTime: finite(levelItem?.availableTime ?? levelItem?.createdAt, 0),
    originIndex: finite(levelItem?.originIndex, -1),
    sourceStatus: levelItem?.status || 'DETECTED',
    converted: false
  };
}

function eligibleSide(candidate, currentPrice) {
  const tolerance = Math.max(finite(candidate.atr, 0) * 0.05, 0.01);
  if (candidate.direction === 'BUY') return candidate.level <= currentPrice + tolerance;
  if (candidate.direction === 'SELL') return candidate.level >= currentPrice - tolerance;
  return false;
}

function candidateScore(candidate) {
  const distance = Number.isFinite(candidate.distanceAtr) ? candidate.distanceAtr : 999;
  return distance + (TF_PRIORITY[candidate.sourceTf] ?? 0.20) + (KIND_PRIORITY[candidate.sourceKind] ?? 0.15);
}

export function buildEntryWatchCandidates({
  conceptsByTf = {},
  candlesByTf = {},
  direction,
  currentPrice
} = {}) {
  const normalizedDirection = normalizeEntryDirection(direction);
  const price = finite(currentPrice);
  if (normalizedDirection === 'WAIT' || !Number.isFinite(price)) return [];
  const candidates = [];

  for (const tf of SOURCE_TIMEFRAMES) {
    const concepts = conceptsByTf?.[tf];
    if (!concepts) continue;
    const atr = atr14(candlesByTf?.[tf]);

    for (const zone of Array.isArray(concepts.fairValueGaps) ? concepts.fairValueGaps : []) {
      if (normalizeEntryDirection(zone?.direction) !== normalizedDirection) continue;
      if (!['DETECTED', 'TESTING'].includes(String(zone?.status || 'DETECTED'))) continue;
      const candidate = zoneCandidate(zone, tf, normalizedDirection, 'FVG', price, atr);
      if (candidate && eligibleSide(candidate, price) && candidate.distanceAtr <= 8) candidates.push(candidate);
    }

    for (const zone of Array.isArray(concepts.orderBlocks) ? concepts.orderBlocks : []) {
      if (normalizeEntryDirection(zone?.direction) !== normalizedDirection) continue;
      if (!['DETECTED', 'TESTING'].includes(String(zone?.status || 'DETECTED'))) continue;
      const candidate = zoneCandidate(zone, tf, normalizedDirection, 'ORDER_BLOCK', price, atr);
      if (candidate && eligibleSide(candidate, price) && candidate.distanceAtr <= 8) candidates.push(candidate);
    }

    for (const levelItem of Array.isArray(concepts.liquidityLevels) ? concepts.liquidityLevels : []) {
      if (levelItem?.active === false || String(levelItem?.status || 'DETECTED') !== 'DETECTED') continue;
      const candidate = liquidityCandidate(levelItem, tf, normalizedDirection, price, atr);
      if (candidate && eligibleSide(candidate, price) && candidate.distanceAtr <= 8) candidates.push(candidate);
    }
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.sourceTf}:${candidate.sourceKind}:${candidate.direction}:${candidate.level.toFixed(3)}`;
    const previous = unique.get(key);
    if (!previous || candidateScore(candidate) < candidateScore(previous)) unique.set(key, candidate);
  }
  return [...unique.values()].sort((a, b) => candidateScore(a) - candidateScore(b));
}

function latestClosed(candlesByTf, tf) {
  return normalizeCandles(candlesByTf?.[tf]).at(-1) || null;
}

function previousClosed(candlesByTf, tf) {
  return normalizeCandles(candlesByTf?.[tf]).at(-2) || null;
}

function conversionFor(candidate, breakCandle) {
  const kind = transformedKind(candidate.sourceKind);
  const direction = oppositeDirection(candidate.direction);
  const level = direction === 'BUY' ? candidate.bottom : candidate.top;
  return {
    id: `${candidate.id}:CONVERTED:${kind}:${direction}`,
    sourceId: candidate.sourceId,
    sourceTf: candidate.sourceTf,
    triggerTf: candidate.triggerTf,
    sourceKind: kind,
    sourceLabel: kind === 'IFVG' ? 'Inversion FVG' : kind === 'BREAKER_BLOCK' ? 'Breaker Block' : 'Valid Break',
    direction,
    bottom: candidate.bottom,
    top: candidate.top,
    level,
    atr: candidate.atr,
    distance: 0,
    distanceAtr: 0,
    availableTime: breakCandle?.time || 0,
    originIndex: candidate.originIndex,
    sourceStatus: 'CONVERTED',
    converted: true,
    convertedFrom: candidate.sourceKind
  };
}

export function evaluateEntryWatchCandidate(candidate, candlesByTf = {}, previous = null) {
  if (!candidate || normalizeEntryDirection(candidate.direction) === 'WAIT') return null;
  const sourceCandle = latestClosed(candlesByTf, candidate.sourceTf);
  let triggerCandle = latestClosed(candlesByTf, candidate.triggerTf);
  let triggerPrevious = previousClosed(candlesByTf, candidate.triggerTf);
  if (!triggerCandle) {
    triggerCandle = sourceCandle;
    triggerPrevious = previousClosed(candlesByTf, candidate.sourceTf);
  }
  if (!sourceCandle || !triggerCandle) return null;

  const direction = normalizeEntryDirection(candidate.direction);
  const level = finite(candidate.level);
  const sourceBreak = direction === 'BUY'
    ? sourceCandle.close < level
    : sourceCandle.close > level;
  const swept = direction === 'BUY'
    ? triggerCandle.low < level && triggerCandle.close > level
    : triggerCandle.high > level && triggerCandle.close < level;
  const approached = direction === 'BUY'
    ? triggerCandle.low <= candidate.top
    : triggerCandle.high >= candidate.bottom;
  const freshSweep = swept && (!triggerPrevious || (direction === 'BUY'
    ? triggerPrevious.close >= level
    : triggerPrevious.close <= level));

  const base = {
    version: '1.0.0',
    model: 'AMY_MULTI_TF_LEVEL_WATCH',
    ...candidate,
    sourceCandleTime: sourceCandle.time,
    triggerCandleTime: triggerCandle.time,
    sourceClose: sourceCandle.close,
    triggerClose: triggerCandle.close,
    updatedAt: Date.now(),
    entryAllowed: false,
    terminal: false,
    active: true,
    touched: approached,
    sweepDetected: false,
    validBreak: false,
    entryPrice: null,
    breakTime: null,
    transformed: previous?.transformed || null
  };

  if (sourceBreak) {
    const transformed = conversionFor(candidate, sourceCandle);
    return {
      ...base,
      active: false,
      terminal: true,
      validBreak: true,
      lifecycleStage: 'VALID_BREAK',
      status: 'VALID BREAK — ENTRY BATAL',
      reason: `${candidate.sourceTf} close menembus ${candidate.sourceLabel} di ${level.toFixed(2)}. Rencana ${direction} dibatalkan.`,
      breakTime: sourceCandle.time,
      transformed,
      transitionText: `${candidate.sourceKind} → ${transformed.sourceKind}`
    };
  }

  if (freshSweep) {
    return {
      ...base,
      entryAllowed: true,
      sweepDetected: true,
      lifecycleStage: 'ENTRY_TRIGGERED',
      status: `ENTRY ${direction} — SWEEP VALID`,
      reason: `${candidate.triggerTf} menyapu ${level.toFixed(2)} lalu close kembali. Entry mengikuti Direction Forecast ${direction}.`,
      entryPrice: triggerCandle.close,
      entryTime: triggerCandle.time
    };
  }

  return {
    ...base,
    lifecycleStage: approached ? 'LEVEL_TESTING' : 'WATCHING_LEVEL',
    status: approached ? 'LEVEL SEDANG DIUJI' : 'PANTAU HARGA',
    reason: `${candidate.sourceTf} ${candidate.sourceLabel} dipantau. Sweep pada ${candidate.triggerTf} memicu entry; close ${candidate.sourceTf} menembus level membatalkan entry.`
  };
}

function convertedCandidate(previous, direction, currentPrice) {
  const transformed = previous?.transformed;
  if (!transformed || normalizeEntryDirection(transformed.direction) !== normalizeEntryDirection(direction)) return null;
  const candidate = { ...transformed };
  candidate.distance = Math.abs(finite(currentPrice, candidate.level) - candidate.level);
  candidate.distanceAtr = Number.isFinite(candidate.atr) && candidate.atr > 0 ? candidate.distance / candidate.atr : Infinity;
  return candidate;
}

function sameDirectionPrevious(previous, direction) {
  return previous && normalizeEntryDirection(previous.direction) === normalizeEntryDirection(direction);
}

function terminalHoldActive(previous, candlesByTf) {
  if (!previous?.terminal || previous.lifecycleStage !== 'VALID_BREAK' || !previous.breakTime) return false;
  const sourceLast = latestClosed(candlesByTf, previous.sourceTf);
  const seconds = TF_SECONDS[previous.sourceTf] || 900;
  return !sourceLast || sourceLast.time <= previous.breakTime + seconds;
}

export function calculateMultiTimeframeEntryWatch({
  conceptsByTf = {},
  candlesByTf = {},
  direction,
  currentPrice,
  previous = null
} = {}) {
  const normalizedDirection = normalizeEntryDirection(direction);
  const price = finite(currentPrice);
  if (normalizedDirection === 'WAIT' || !Number.isFinite(price)) {
    return {
      version: '1.0.0',
      model: 'AMY_MULTI_TF_LEVEL_WATCH',
      status: 'WAIT — DIRECTION FORECAST TIDAK AKTIF',
      lifecycleStage: 'WAIT_DIRECTION',
      direction: 'WAIT',
      active: false,
      terminal: false,
      entryAllowed: false,
      candidates: []
    };
  }

  if (terminalHoldActive(previous, candlesByTf)) return { ...previous, updatedAt: Date.now() };

  const converted = convertedCandidate(previous, normalizedDirection, price);
  if (converted) {
    const evaluated = evaluateEntryWatchCandidate(converted, candlesByTf, previous);
    if (evaluated) return { ...evaluated, candidates: [converted] };
  }

  if (sameDirectionPrevious(previous, normalizedDirection) && !previous?.terminal && previous?.id) {
    const evaluated = evaluateEntryWatchCandidate(previous, candlesByTf, previous);
    if (evaluated) return { ...evaluated, candidates: previous.candidates || [previous] };
  }

  const candidates = buildEntryWatchCandidates({ conceptsByTf, candlesByTf, direction: normalizedDirection, currentPrice: price });
  const primary = candidates[0];
  if (!primary) {
    return {
      version: '1.0.0',
      model: 'AMY_MULTI_TF_LEVEL_WATCH',
      status: `WAIT — BELUM ADA LEVEL ${normalizedDirection}`,
      lifecycleStage: 'WAIT_LEVEL',
      direction: normalizedDirection,
      active: false,
      terminal: false,
      entryAllowed: false,
      candidates
    };
  }
  const evaluated = evaluateEntryWatchCandidate(primary, candlesByTf, previous);
  return evaluated ? { ...evaluated, candidates: candidates.slice(0, 12) } : null;
}

export const ENTRY_WATCH_CONFIG = Object.freeze({
  sourceTimeframes: [...SOURCE_TIMEFRAMES],
  triggerTimeframes: { ...TRIGGER_TIMEFRAME },
  breakRule: 'CLOSE_SOURCE_TIMEFRAME_BEYOND_LEVEL',
  entryRule: 'LOWER_TIMEFRAME_WICK_SWEEP_AND_CLOSE_RECLAIM'
});
