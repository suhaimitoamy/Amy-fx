import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateValidatedMarketContext,
  evaluateValidatedSeries
} from '../app/src/main/assets/apps/mapping/js/engine/validated-market-context.js';

const START = 1_577_836_800;
const M15_SECONDS = 15 * 60;
const H4_SECONDS = 4 * 60 * 60;

function deterministicM15(count = 520) {
  const candles = [];
  let previousClose = 1_520;
  for (let index = 0; index < count; index += 1) {
    const trend = index < 150 ? 0.07 : index < 300 ? -0.05 : 0.09;
    const wave = Math.sin(index / 8) * 0.32 + Math.cos(index / 19) * 0.18;
    const shock = index % 97 === 0 ? 2.4 : index % 131 === 0 ? -2.1 : 0;
    const open = previousClose;
    const close = open + trend + wave + shock;
    const wick = 0.35 + Math.abs(Math.sin(index / 5)) * 0.55;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick * 0.9;
    candles.push({
      time: START + index * M15_SECONDS,
      open,
      high,
      low,
      close
    });
    previousClose = close;
  }
  return candles;
}

function aggregateH4(m15) {
  const groups = new Map();
  for (const candle of m15) {
    const bucket = candle.time - (candle.time % H4_SECONDS);
    const existing = groups.get(bucket);
    if (!existing) {
      groups.set(bucket, { ...candle, time: bucket });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    }
  }
  return [...groups.values()].sort((left, right) => left.time - right.time);
}

function forecastComparable(forecast) {
  return {
    directionValue: forecast.directionValue,
    startIndex: forecast.startIndex,
    startTime: forecast.startTime,
    expiryIndex: forecast.expiryIndex,
    triggerRule: forecast.triggerRule,
    active: forecast.active,
    invalidated: forecast.invalidated,
    expired: forecast.expired,
    invalidationReason: forecast.invalidationReason
  };
}

function snapshotComparable(snapshot) {
  return {
    time: snapshot.time,
    structureTrend: snapshot.structureTrend,
    rawBreakBull: snapshot.rawBreakBull,
    rawBreakBear: snapshot.rawBreakBear,
    mssBull: snapshot.mssBull,
    mssBear: snapshot.mssBear,
    bosBull: snapshot.bosBull,
    bosBear: snapshot.bosBear,
    marketState: snapshot.marketState,
    htf: snapshot.htf,
    priceBull: snapshot.priceBull,
    priceBear: snapshot.priceBear,
    rangeHigh: snapshot.rangeHigh,
    rangeLow: snapshot.rangeLow,
    rangePosition: snapshot.rangePosition,
    momentum3Atr: snapshot.momentum3Atr,
    candidate: snapshot.candidate,
    forecast: forecastComparable(snapshot.forecast)
  };
}

test('validated M15 series is prefix-invariant and does not read future H4 candles', () => {
  const candles = deterministicM15();
  const h4 = aggregateH4(candles);
  const full = evaluateValidatedSeries({ candles, tf: 'M15', htfCandles: { H4: h4 } });

  assert.equal(full.status, 'READY');
  assert.equal(full.snapshots.length, candles.length);

  for (const index of [120, 180, 260, 340, 430, candles.length - 1]) {
    const eventTime = candles[index].time;
    const prefixCandles = candles.slice(0, index + 1);
    const closedH4Input = h4.filter(candle => candle.time <= eventTime);
    const prefix = evaluateValidatedSeries({
      candles: prefixCandles,
      tf: 'M15',
      htfCandles: { H4: closedH4Input }
    });

    assert.equal(prefix.status, 'READY');
    assert.deepEqual(
      snapshotComparable(prefix.snapshots.at(-1)),
      snapshotComparable(full.snapshots[index]),
      `historical output changed after future candles were supplied at index ${index}`
    );
  }
});

test('forecast lifecycle never points beyond the decision candle', () => {
  const candles = deterministicM15();
  const h4 = aggregateH4(candles);
  const series = evaluateValidatedSeries({ candles, tf: 'M15', htfCandles: { H4: h4 } });

  for (const snapshot of series.snapshots) {
    const forecast = snapshot.forecast;
    if (forecast.startIndex != null) {
      assert.ok(forecast.startIndex <= snapshot.index);
      assert.ok(forecast.startTime <= snapshot.time);
    }
    if (forecast.active) {
      assert.notEqual(forecast.directionValue, 0);
      assert.ok(snapshot.index <= forecast.expiryIndex);
    }
  }
  for (const event of series.events) {
    assert.equal(event.time, candles[event.index].time);
    assert.ok(event.index < candles.length);
  }
});

test('display confidence explicitly states that it is not live win probability', () => {
  const candles = deterministicM15();
  const h4 = aggregateH4(candles);
  const context = evaluateValidatedMarketContext({ candles, tf: 'M15', htfCandles: { H4: h4 } });

  assert.equal(context.status, 'READY');
  assert.match(
    context.directionForecast.confidenceMeaning,
    /NOT_LIVE_WIN_PROBABILITY/
  );
});
