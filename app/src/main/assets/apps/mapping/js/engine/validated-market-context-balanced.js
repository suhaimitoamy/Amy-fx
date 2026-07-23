import {
  VALIDATED_FORECAST_PROFILES,
  advanceValidatedForecast,
  evaluateValidatedMarketContext as evaluateBaseContext,
  evaluateValidatedSeries
} from './validated-market-context.js';

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeTf(tf) {
  const value = String(tf || '').toUpperCase().replaceAll(' ', '');
  if (value === '60' || value === '1H' || value === 'H1') return 'H1';
  return value;
}

export function balancedH1ForecastCandidate({
  rawBreakBull = false,
  rawBreakBear = false,
  htfBullConfirmed = false,
  htfBearConfirmed = false,
  priceBull = false,
  priceBear = false,
  momentum3Atr = 0
} = {}) {
  const bullishMomentum = momentum3Atr > 0 && momentum3Atr < 2.5;
  const bearishMomentum = momentum3Atr < 0 && momentum3Atr > -2.5;
  const bull = rawBreakBull && htfBullConfirmed && priceBull && bullishMomentum;
  const bear = rawBreakBear && htfBearConfirmed && priceBear && bearishMomentum;
  const directionValue = bull && !bear ? 1 : bear && !bull ? -1 : 0;
  return {
    directionValue,
    direction: directionValue > 0 ? 'BULLISH' : directionValue < 0 ? 'BEARISH' : 'NO CLEAR DIRECTION',
    bullishTrigger: bull,
    bearishTrigger: bear,
    rule: 'SYMMETRIC H1 STRUCTURAL BREAK + H4/PRICE ALIGNMENT + NON-OVEREXTENDED 3-BAR MOMENTUM'
  };
}

function rebuildBalancedH1Forecast(series) {
  const profile = VALIDATED_FORECAST_PROFILES.H1;
  let state = null;
  for (const snapshot of series.snapshots) {
    const candidate = balancedH1ForecastCandidate({
      rawBreakBull: snapshot.rawBreakBull,
      rawBreakBear: snapshot.rawBreakBear,
      htfBullConfirmed: snapshot.htf?.ready && snapshot.htf?.bullish,
      htfBearConfirmed: snapshot.htf?.ready && snapshot.htf?.bearish,
      priceBull: snapshot.priceBull,
      priceBear: snapshot.priceBear,
      momentum3Atr: snapshot.momentum3Atr
    });
    state = advanceValidatedForecast(state, {
      index: snapshot.index,
      time: snapshot.time,
      candidate,
      rawBreakBull: snapshot.rawBreakBull,
      rawBreakBear: snapshot.rawBreakBear,
      profile
    });
    if (state.newForecast) state.expiryTime = series.values[state.expiryIndex]?.time ?? NaN;
  }
  return state;
}

export function evaluateValidatedMarketContext(input = {}) {
  const base = evaluateBaseContext(input);
  if (normalizeTf(input.tf) !== 'H1') return base;

  const series = evaluateValidatedSeries(input);
  if (series.status !== 'READY') return base;
  const forecast = rebuildBalancedH1Forecast(series);
  if (!forecast) return base;

  const active = Boolean(forecast.active);
  const direction = active
    ? (forecast.directionValue > 0 ? 'BULLISH' : 'BEARISH')
    : 'NO CLEAR DIRECTION';

  return {
    ...base,
    version: '1.1.0',
    source: 'AMY_VALIDATED_PINE_PARITY_BALANCED_H1',
    directionForecast: {
      ...base.directionForecast,
      active,
      direction,
      directionValue: active ? forecast.directionValue : 0,
      confidence: active ? series.profile.confidence : 0,
      startIndex: forecast.startIndex,
      startTime: forecast.startTime,
      expiryIndex: forecast.expiryIndex,
      expiryTime: finite(forecast.expiryTime),
      triggerRule: forecast.triggerRule || '',
      invalidated: Boolean(forecast.invalidated),
      expired: Boolean(forecast.expired),
      invalidationReason: forecast.invalidationReason || '',
      balanceRule: 'H1_BUY_AND_SELL_USE_MIRRORED_CONDITIONS'
    }
  };
}
