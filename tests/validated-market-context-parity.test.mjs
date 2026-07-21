import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALIDATED_FORECAST_PROFILES,
  advanceValidatedForecast,
  classifyValidatedMarketState,
  validatedForecastCandidate
} from '../app/src/main/assets/apps/mapping/js/engine/validated-market-context.js';

test('Pine Market State: fast + slow HH/HL and bullish break produce confirmed uptrend', () => {
  const result = classifyValidatedMarketState({
    fastHigh: 2050, previousFastHigh: 2040,
    fastLow: 2025, previousFastLow: 2015,
    slowHigh: 2060, previousSlowHigh: 2035,
    slowLow: 2010, previousSlowLow: 1995,
    structureTrend: 'BULLISH', lastPivotType: -1,
    close: 2045, ema21: 2038, atr: 10
  });
  assert.equal(result.state, 'UPTREND CONFIRMED');
  assert.equal(result.directionValue, 1);
  assert.equal(result.confirmed, true);
});

test('Pine Market State: confirmed bullish structure labels pullback only after last high pivot and close below EMA21', () => {
  const result = classifyValidatedMarketState({
    fastHigh: 2050, previousFastHigh: 2040,
    fastLow: 2025, previousFastLow: 2015,
    slowHigh: 2060, previousSlowHigh: 2035,
    slowLow: 2010, previousSlowLow: 1995,
    structureTrend: 'BULLISH', lastPivotType: 1,
    close: 2030, ema21: 2035, atr: 10
  });
  assert.equal(result.state, 'BULLISH PULLBACK');
  assert.equal(result.pullback, true);
});

test('Pine Market State refuses confirmed trend when latest protected swing is broken', () => {
  const result = classifyValidatedMarketState({
    fastHigh: 2050, previousFastHigh: 2040,
    fastLow: 2025, previousFastLow: 2015,
    slowHigh: 2060, previousSlowHigh: 2035,
    slowLow: 2010, previousSlowLow: 1995,
    structureTrend: 'BULLISH', lastPivotType: 1,
    close: 2020, ema21: 2035, atr: 10
  });
  assert.equal(result.confirmed, false);
  assert.notEqual(result.state, 'UPTREND CONFIRMED');
  assert.notEqual(result.state, 'BULLISH PULLBACK');
});

test('Pine M5 forecast requires MSS, confirmed local state, and price alignment', () => {
  assert.equal(validatedForecastCandidate({
    tf: 'M5', mssBull: true, marketBullConfirmed: true, priceBull: true
  }).directionValue, 1);
  assert.equal(validatedForecastCandidate({
    tf: 'M5', mssBull: true, marketBullConfirmed: false, priceBull: true
  }).directionValue, 0);
});

test('Pine M15 forecast only accepts H4-aligned break from opposite side of 80-bar range', () => {
  assert.equal(validatedForecastCandidate({
    tf: 'M15', rawBreakBull: true, htfBullConfirmed: true, rangePosition: 0.44
  }).directionValue, 1);
  assert.equal(validatedForecastCandidate({
    tf: 'M15', rawBreakBull: true, htfBullConfirmed: true, rangePosition: 0.45
  }).directionValue, 0);
  assert.equal(validatedForecastCandidate({
    tf: 'M15', rawBreakBear: true, htfBearConfirmed: true, rangePosition: 0.56
  }).directionValue, -1);
});

test('Pine H1 bearish forecast stays suppressed and bullish momentum must be below 2.5 ATR', () => {
  assert.equal(validatedForecastCandidate({
    tf: 'H1', rawBreakBear: true, htfBearConfirmed: true, priceBear: true, momentum3Atr: -1
  }).directionValue, 0);
  assert.equal(validatedForecastCandidate({
    tf: 'H1', rawBreakBull: true, htfBullConfirmed: true, priceBull: true, momentum3Atr: 2.49
  }).directionValue, 1);
  assert.equal(validatedForecastCandidate({
    tf: 'H1', rawBreakBull: true, htfBullConfirmed: true, priceBull: true, momentum3Atr: 2.5
  }).directionValue, 0);
});

test('Pine forecast lifecycle invalidates immediately on opposite confirmed structural break', () => {
  const profile = VALIDATED_FORECAST_PROFILES.M15;
  const started = advanceValidatedForecast(null, {
    index: 100, time: 1000,
    candidate: { directionValue: 1, rule: 'M15 RULE' },
    profile
  });
  assert.equal(started.active, true);
  const invalidated = advanceValidatedForecast(started, {
    index: 101, time: 1900,
    candidate: { directionValue: 0, rule: 'M15 RULE' },
    rawBreakBear: true,
    profile
  });
  assert.equal(invalidated.active, false);
  assert.equal(invalidated.invalidated, true);
});
