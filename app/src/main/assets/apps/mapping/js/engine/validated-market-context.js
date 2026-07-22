const DEFAULTS = Object.freeze({
  swingLength: 4,
  slowSwingLength: 6,
  atrLength: 14,
  emaFastLength: 21,
  emaMidLength: 34,
  emaSlowLength: 90,
  htfEmaLength: 20,
  rangeLookback: 80
});

export const VALIDATED_FORECAST_PROFILES = Object.freeze({
  M5: Object.freeze({ horizonBars: 288, cooldownBars: 144, confidence: 65, horizonText: '24H' }),
  M15: Object.freeze({ horizonBars: 192, cooldownBars: 96, confidence: 60, horizonText: '48H' }),
  H1: Object.freeze({ horizonBars: 72, cooldownBars: 36, confidence: 65, horizonText: '72H' })
});

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeTf(tf) {
  const value = String(tf || '').toUpperCase().replaceAll(' ', '');
  if (value === '5' || value === '5MIN' || value === 'M5') return 'M5';
  if (value === '15' || value === '15MIN' || value === 'M15') return 'M15';
  if (value === '60' || value === '1H' || value === 'H1') return 'H1';
  return value;
}

function cleanCandles(candles) {
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

function emaSeries(values, length) {
  const output = Array(values.length).fill(null);
  if (!values.length) return output;
  const alpha = 2 / (Math.max(1, length) + 1);
  let average = values[0];
  output[0] = average;
  for (let index = 1; index < values.length; index += 1) {
    average = alpha * values[index] + (1 - alpha) * average;
    output[index] = average;
  }
  return output;
}

function atrSeries(candles, length) {
  const output = Array(candles.length).fill(null);
  if (candles.length < length) return output;
  const ranges = candles.map((candle, index) => {
    const previous = candles[index - 1];
    return previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low;
  });
  let average = ranges.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  output[length - 1] = average;
  for (let index = length; index < ranges.length; index += 1) {
    average = (average * (length - 1) + ranges[index]) / length;
    output[index] = average;
  }
  return output;
}

function pivotAt(values, confirmationIndex, direction, length) {
  const originIndex = confirmationIndex - length;
  if (originIndex < length || originIndex + length >= values.length) return null;
  const price = direction === 'HIGH' ? values[originIndex].high : values[originIndex].low;
  for (let index = originIndex - length; index < originIndex; index += 1) {
    if (direction === 'HIGH' ? price <= values[index].high : price >= values[index].low) return null;
  }
  for (let index = originIndex + 1; index <= originIndex + length; index += 1) {
    if (direction === 'HIGH' ? price <= values[index].high : price >= values[index].low) return null;
  }
  return { index: originIndex, price };
}

function closedHtfContext(htf, ema, eventTime, cursor) {
  while (cursor + 1 < htf.length && htf[cursor + 1].time <= eventTime) cursor += 1;
  const closedIndex = cursor - 1;
  if (closedIndex < 1) return { cursor, ready: false, bullish: false, bearish: false, close: NaN, ema: NaN, emaPrevious: NaN };
  const close = htf[closedIndex].close;
  const average = ema[closedIndex];
  const averagePrevious = ema[closedIndex - 1];
  return {
    cursor,
    ready: [close, average, averagePrevious].every(Number.isFinite),
    bullish: close > average && average >= averagePrevious,
    bearish: close < average && average <= averagePrevious,
    close,
    ema: average,
    emaPrevious: averagePrevious
  };
}

export function classifyValidatedMarketState({
  fastHigh,
  previousFastHigh,
  fastLow,
  previousFastLow,
  slowHigh,
  previousSlowHigh,
  slowLow,
  previousSlowLow,
  structureTrend = 'NEUTRAL',
  lastPivotType = 0,
  close,
  ema21,
  atr
} = {}) {
  const tolerance = Math.max(0, finite(atr, 0)) * 0.05;
  const fastBull = [fastHigh, previousFastHigh, fastLow, previousFastLow].every(Number.isFinite)
    && fastHigh > previousFastHigh + tolerance && fastLow > previousFastLow + tolerance;
  const fastBear = [fastHigh, previousFastHigh, fastLow, previousFastLow].every(Number.isFinite)
    && fastHigh < previousFastHigh - tolerance && fastLow < previousFastLow - tolerance;
  const slowBull = [slowHigh, previousSlowHigh, slowLow, previousSlowLow].every(Number.isFinite)
    && slowHigh > previousSlowHigh + tolerance && slowLow > previousSlowLow + tolerance;
  const slowBear = [slowHigh, previousSlowHigh, slowLow, previousSlowLow].every(Number.isFinite)
    && slowHigh < previousSlowHigh - tolerance && slowLow < previousSlowLow - tolerance;
  const structureBull = structureTrend === 'BULLISH' || structureTrend === 'BULL';
  const structureBear = structureTrend === 'BEARISH' || structureTrend === 'BEAR';
  const bullIntact = !Number.isFinite(fastLow) || close > fastLow;
  const bearIntact = !Number.isFinite(fastHigh) || close < fastHigh;
  const bullConfirmed = fastBull && slowBull && structureBull && bullIntact;
  const bearConfirmed = fastBear && slowBear && structureBear && bearIntact;
  const bullVotes = Number(fastBull) + Number(slowBull) + Number(structureBull);
  const bearVotes = Number(fastBear) + Number(slowBear) + Number(structureBear);
  const bullTransition = !bullConfirmed && !bearConfirmed && bullVotes >= 2 && bullVotes > bearVotes && bullIntact;
  const bearTransition = !bullConfirmed && !bearConfirmed && bearVotes >= 2 && bearVotes > bullVotes && bearIntact;
  const bullPullback = bullConfirmed && lastPivotType === 1 && close < ema21;
  const bearPullback = bearConfirmed && lastPivotType === -1 && close > ema21;
  const directionValue = bullConfirmed ? 1 : bearConfirmed ? -1 : 0;
  const state = bullConfirmed
    ? (bullPullback ? 'BULLISH PULLBACK' : 'UPTREND CONFIRMED')
    : bearConfirmed
      ? (bearPullback ? 'BEARISH PULLBACK' : 'DOWNTREND CONFIRMED')
      : bullTransition
        ? 'BULLISH TRANSITION'
        : bearTransition
          ? 'BEARISH TRANSITION'
          : 'RANGE / TRANSITION';
  return {
    state,
    direction: directionValue > 0 ? 'BULLISH' : directionValue < 0 ? 'BEARISH' : 'NEUTRAL',
    directionValue,
    confirmed: bullConfirmed || bearConfirmed,
    transition: bullTransition || bearTransition,
    pullback: bullPullback || bearPullback,
    fastBull,
    fastBear,
    slowBull,
    slowBear,
    bullIntact,
    bearIntact,
    bullVotes,
    bearVotes,
    tolerance
  };
}

export function validatedForecastCandidate({
  tf,
  mssBull = false,
  mssBear = false,
  rawBreakBull = false,
  rawBreakBear = false,
  marketBullConfirmed = false,
  marketBearConfirmed = false,
  priceBull = false,
  priceBear = false,
  htfBullConfirmed = false,
  htfBearConfirmed = false,
  rangePosition = 0.5,
  momentum3Atr = 0
} = {}) {
  const timeframe = normalizeTf(tf);
  let bull = false;
  let bear = false;
  let rule = 'UNSUPPORTED';
  if (timeframe === 'M5') {
    bull = mssBull && marketBullConfirmed && priceBull;
    bear = mssBear && marketBearConfirmed && priceBear;
    rule = 'MSS + CONFIRMED LOCAL MARKET STATE + PRICE ALIGNMENT';
  } else if (timeframe === 'M15') {
    bull = rawBreakBull && htfBullConfirmed && rangePosition < 0.45;
    bear = rawBreakBear && htfBearConfirmed && rangePosition > 0.55;
    rule = 'H4-ALIGNED STRUCTURAL BREAK FROM OPPOSITE SIDE OF 80-BAR RANGE';
  } else if (timeframe === 'H1') {
    const bullishMomentum = momentum3Atr > 0 && momentum3Atr < 2.5;
    bull = rawBreakBull && htfBullConfirmed && priceBull && bullishMomentum;
    bear = false;
    rule = 'BULLISH STRUCTURAL BREAK + H4/PRICE ALIGNMENT + POSITIVE NON-OVEREXTENDED 3-BAR MOMENTUM';
  }
  const directionValue = bull && !bear ? 1 : bear && !bull ? -1 : 0;
  return {
    directionValue,
    direction: directionValue > 0 ? 'BULLISH' : directionValue < 0 ? 'BEARISH' : 'NO CLEAR DIRECTION',
    bullishTrigger: bull,
    bearishTrigger: bear,
    rule
  };
}

export function advanceValidatedForecast(previous, {
  index,
  time,
  candidate,
  rawBreakBull = false,
  rawBreakBear = false,
  profile
} = {}) {
  const state = {
    directionValue: finite(previous?.directionValue, 0),
    startIndex: Number.isInteger(previous?.startIndex) ? previous.startIndex : null,
    startTime: finite(previous?.startTime),
    expiryIndex: Number.isInteger(previous?.expiryIndex) ? previous.expiryIndex : null,
    expiryTime: finite(previous?.expiryTime),
    triggerRule: previous?.triggerRule || '',
    newForecast: false,
    invalidated: Boolean(previous?.invalidated),
    expired: Boolean(previous?.expired),
    invalidationReason: previous?.invalidationReason || ''
  };

  const activeBefore = state.directionValue !== 0 && state.expiryIndex != null && index <= state.expiryIndex;
  const expiredNow = activeBefore && state.expiryIndex != null && index > state.expiryIndex;
  const invalidatedNow = activeBefore && ((state.directionValue === 1 && rawBreakBear) || (state.directionValue === -1 && rawBreakBull));

  if (expiredNow || invalidatedNow) {
    state.directionValue = 0;
    state.startIndex = null;
    state.startTime = NaN;
    state.expiryIndex = null;
    state.expiryTime = NaN;
    state.triggerRule = '';
    state.expired = Boolean(expiredNow);
    state.invalidated = true;
    state.invalidationReason = invalidatedNow
      ? 'Direction Forecast dihentikan oleh structural break berlawanan.'
      : 'Direction Forecast telah melewati batas horizon.';
  }

  const candidateDirection = finite(candidate?.directionValue, 0);
  const canRefresh = state.startIndex == null
    || candidateDirection !== state.directionValue
    || index - state.startIndex >= profile.cooldownBars;

  if (candidateDirection !== 0 && canRefresh) {
    state.directionValue = candidateDirection;
    state.startIndex = index;
    state.startTime = time;
    state.expiryIndex = index + profile.horizonBars;
    state.expiryTime = NaN;
    state.triggerRule = candidate.rule;
    state.newForecast = true;
    state.invalidated = false;
    state.expired = false;
    state.invalidationReason = '';
  }

  state.active = state.directionValue !== 0 && state.expiryIndex != null && index <= state.expiryIndex;
  return state;
}

export function evaluateValidatedSeries({
  candles = [],
  tf = 'M15',
  htfCandles = {},
  options = {}
} = {}) {
  const timeframe = normalizeTf(tf);
  const profile = VALIDATED_FORECAST_PROFILES[timeframe];
  const values = cleanCandles(candles);
  const h4 = cleanCandles(htfCandles?.H4 || htfCandles?.['4H'] || []);
  const settings = { ...DEFAULTS, ...(options || {}) };
  if (!profile || values.length < Math.max(100, settings.emaSlowLength + settings.slowSwingLength * 2 + 1)) {
    return { status: profile ? 'INSUFFICIENT_DATA' : 'UNSUPPORTED_TIMEFRAME', tf: timeframe, snapshots: [], events: [] };
  }

  const closes = values.map(candle => candle.close);
  const ema21 = emaSeries(closes, settings.emaFastLength);
  const ema34 = emaSeries(closes, settings.emaMidLength);
  const ema90 = emaSeries(closes, settings.emaSlowLength);
  const atr = atrSeries(values, settings.atrLength);
  const h4Ema = emaSeries(h4.map(candle => candle.close), settings.htfEmaLength);

  let lastHigh = null;
  let lastLow = null;
  let bslBroken = false;
  let sslBroken = false;
  let structureTrend = 'NEUTRAL';
  let fastHigh = NaN;
  let previousFastHigh = NaN;
  let fastLow = NaN;
  let previousFastLow = NaN;
  let slowHigh = NaN;
  let previousSlowHigh = NaN;
  let slowLow = NaN;
  let previousSlowLow = NaN;
  let lastPivotType = 0;
  let h4Cursor = -1;
  let forecastState = null;
  const snapshots = [];
  const events = [];

  for (let index = 0; index < values.length; index += 1) {
    const candle = values[index];
    const previous = values[index - 1];

    const fastPivotHigh = pivotAt(values, index, 'HIGH', settings.swingLength);
    const fastPivotLow = pivotAt(values, index, 'LOW', settings.swingLength);
    const slowPivotHigh = pivotAt(values, index, 'HIGH', settings.slowSwingLength);
    const slowPivotLow = pivotAt(values, index, 'LOW', settings.slowSwingLength);

    if (fastPivotHigh) {
      previousFastHigh = fastHigh;
      fastHigh = fastPivotHigh.price;
      lastHigh = fastPivotHigh;
      lastPivotType = 1;
      bslBroken = false;
    }
    if (fastPivotLow) {
      previousFastLow = fastLow;
      fastLow = fastPivotLow.price;
      lastLow = fastPivotLow;
      lastPivotType = -1;
      sslBroken = false;
    }
    if (slowPivotHigh) {
      previousSlowHigh = slowHigh;
      slowHigh = slowPivotHigh.price;
    }
    if (slowPivotLow) {
      previousSlowLow = slowLow;
      slowLow = slowPivotLow.price;
    }

    const rawBreakBull = Boolean(previous && !bslBroken && lastHigh && candle.close > lastHigh.price && previous.close <= lastHigh.price);
    const rawBreakBear = Boolean(previous && !sslBroken && lastLow && candle.close < lastLow.price && previous.close >= lastLow.price);
    const mssBull = rawBreakBull && structureTrend !== 'BULLISH';
    const mssBear = rawBreakBear && structureTrend !== 'BEARISH';
    const bosBull = rawBreakBull && structureTrend === 'BULLISH';
    const bosBear = rawBreakBear && structureTrend === 'BEARISH';
    if (rawBreakBull) {
      structureTrend = 'BULLISH';
      bslBroken = true;
    }
    if (rawBreakBear) {
      structureTrend = 'BEARISH';
      sslBroken = true;
    }

    const marketState = classifyValidatedMarketState({
      fastHigh,
      previousFastHigh,
      fastLow,
      previousFastLow,
      slowHigh,
      previousSlowHigh,
      slowLow,
      previousSlowLow,
      structureTrend,
      lastPivotType,
      close: candle.close,
      ema21: ema21[index],
      atr: atr[index]
    });

    const htf = closedHtfContext(h4, h4Ema, candle.time, h4Cursor);
    h4Cursor = htf.cursor;
    const priceBull = Number.isFinite(ema34[index]) && Number.isFinite(ema90[index]) && candle.close >= ema34[index] && ema34[index] >= ema90[index];
    const priceBear = Number.isFinite(ema34[index]) && Number.isFinite(ema90[index]) && candle.close <= ema34[index] && ema34[index] <= ema90[index];
    const start = Math.max(0, index - settings.rangeLookback + 1);
    const window = values.slice(start, index + 1);
    const rangeHigh = Math.max(...window.map(item => item.high));
    const rangeLow = Math.min(...window.map(item => item.low));
    const rangeSize = Math.max(rangeHigh - rangeLow, 1e-9);
    const rangePosition = (candle.close - rangeLow) / rangeSize;
    const momentum3Atr = index >= 3 && Number.isFinite(atr[index]) && atr[index] > 0
      ? (candle.close - values[index - 3].close) / atr[index]
      : 0;
    const candidate = validatedForecastCandidate({
      tf: timeframe,
      mssBull,
      mssBear,
      rawBreakBull,
      rawBreakBear,
      marketBullConfirmed: marketState.directionValue === 1,
      marketBearConfirmed: marketState.directionValue === -1,
      priceBull,
      priceBear,
      htfBullConfirmed: htf.ready && htf.bullish,
      htfBearConfirmed: htf.ready && htf.bearish,
      rangePosition,
      momentum3Atr
    });
    forecastState = advanceValidatedForecast(forecastState, {
      index,
      time: candle.time,
      candidate,
      rawBreakBull,
      rawBreakBear,
      profile
    });
    if (forecastState.newForecast) {
      forecastState.expiryTime = values[forecastState.expiryIndex]?.time ?? NaN;
      events.push({
        index,
        time: candle.time,
        directionValue: forecastState.directionValue,
        direction: forecastState.directionValue > 0 ? 'BULLISH' : 'BEARISH',
        horizonBars: profile.horizonBars,
        expiryIndex: forecastState.expiryIndex,
        rule: candidate.rule,
        marketState: marketState.state,
        rangePosition,
        momentum3Atr
      });
    }

    snapshots.push({
      index,
      time: candle.time,
      close: candle.close,
      structureTrend,
      rawBreakBull,
      rawBreakBear,
      mssBull,
      mssBear,
      bosBull,
      bosBear,
      marketState,
      htf,
      priceBull,
      priceBear,
      rangeHigh,
      rangeLow,
      rangePosition,
      momentum3Atr,
      candidate,
      forecast: { ...forecastState }
    });
  }

  return { status: 'READY', tf: timeframe, values, snapshots, events, profile };
}

export function evaluateValidatedMarketContext(input = {}) {
  const series = evaluateValidatedSeries(input);
  if (series.status !== 'READY') {
    return {
      version: '1.0.0',
      source: 'AMY_VALIDATED_PINE_PARITY',
      status: series.status,
      tf: series.tf,
      marketState: { state: 'DATA BELUM CUKUP', direction: 'NEUTRAL', directionValue: 0, confirmed: false },
      directionForecast: {
        active: false,
        direction: 'NO CLEAR DIRECTION',
        directionValue: 0,
        invalidated: false,
        expired: false,
        invalidationReason: ''
      }
    };
  }
  const latest = series.snapshots.at(-1);
  const forecast = latest.forecast;
  const direction = forecast.active
    ? (forecast.directionValue > 0 ? 'BULLISH' : 'BEARISH')
    : 'NO CLEAR DIRECTION';
  return {
    version: '1.0.0',
    source: 'AMY_VALIDATED_PINE_PARITY',
    status: 'READY',
    tf: series.tf,
    calculatedAt: latest.time,
    marketState: {
      ...latest.marketState,
      structureTrend: latest.structureTrend,
      sourceRule: 'FAST 4/4 + SLOW 6/6 FRACTAL STRUCTURE + CONFIRMED BREAK + INTACT SWING'
    },
    directionForecast: {
      active: Boolean(forecast.active),
      direction,
      directionValue: forecast.active ? forecast.directionValue : 0,
      confidence: forecast.active ? series.profile.confidence : 0,
      horizonBars: series.profile.horizonBars,
      horizonText: series.profile.horizonText,
      startIndex: forecast.startIndex,
      startTime: forecast.startTime,
      expiryIndex: forecast.expiryIndex,
      expiryTime: forecast.expiryTime,
      triggerRule: forecast.triggerRule || '',
      invalidated: Boolean(forecast.invalidated),
      expired: Boolean(forecast.expired),
      invalidationReason: forecast.invalidationReason || '',
      confidenceMeaning: 'DISPLAY_CONFIDENCE_FROM_VALIDATED_BACKTEST_NOT_LIVE_WIN_PROBABILITY'
    },
    latestEvent: {
      rawBreakBull: latest.rawBreakBull,
      rawBreakBear: latest.rawBreakBear,
      mssBull: latest.mssBull,
      mssBear: latest.mssBear,
      bosBull: latest.bosBull,
      bosBear: latest.bosBear
    },
    features: {
      htfBullConfirmed: latest.htf.ready && latest.htf.bullish,
      htfBearConfirmed: latest.htf.ready && latest.htf.bearish,
      priceBull: latest.priceBull,
      priceBear: latest.priceBear,
      rangePosition: latest.rangePosition,
      momentum3Atr: latest.momentum3Atr
    },
    isolation: {
      regimeMayExplain: true,
      regimeMayOverrideMarketState: false,
      regimeMayOverrideDirectionForecast: false,
      automaticTradeExecution: false
    }
  };
}
