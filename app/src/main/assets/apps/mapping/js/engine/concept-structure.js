import { CONCEPT_THRESHOLDS } from './concept-config.js';
import { liquiditySweepEvent, structureDisplacementMetrics } from './concept-structure-metrics.js';
import { cleanConceptCandles, conceptAtrAtClean, conceptSwingPoints } from './concept-candles.js';

export const STRUCTURE_SWING_LENGTH = 4;

function availablePivotMap(items, confirmationBars) {
  return new Map(items.map(item => [item.index + confirmationBars, item]));
}

function markFailedBreaks(events, values) {
  for (const event of events) {
    if (event.kind !== 'STRUCTURE_BREAK') continue;
    for (let cursor = event.index + 1; cursor < values.length; cursor += 1) {
      const failed = event.direction === 'BULLISH'
        ? values[cursor].close < event.level
        : values[cursor].close > event.level;
      if (!failed) continue;
      event.failureIndex = cursor;
      event.status = 'FAILED';
      break;
    }
  }
}

export function detectStructureConcepts(candles, {
  left = STRUCTURE_SWING_LENGTH,
  right = STRUCTURE_SWING_LENGTH
} = {}) {
  const values = cleanConceptCandles(candles);
  const swings = conceptSwingPoints(values, left, right);
  const confirmedHighAt = availablePivotMap(swings.highs, right);
  const confirmedLowAt = availablePivotMap(swings.lows, right);
  const events = [];

  let trend = 'NEUTRAL';
  let lastHigh = null;
  let lastLow = null;
  let bslConsumed = false;
  let sslConsumed = false;
  let bslBroken = false;
  let sslBroken = false;

  const registerBreak = (direction, swing, level, index) => {
    const candle = values[index];
    const localAtr = Math.max(conceptAtrAtClean(values, index), 0.0000001);
    const metrics = structureDisplacementMetrics(candle, localAtr, level, direction);
    const concept = trend === direction ? 'BOS' : 'MSS';
    const event = {
      id: `${concept}:MAJOR:${direction}:${index}:${level.toFixed(5)}`,
      concept,
      kind: 'STRUCTURE_BREAK',
      scope: 'MAJOR',
      direction,
      level,
      index,
      swingIndex: swing.index,
      availableIndex: swing.index + right,
      localAtr,
      ...metrics,
      hasDisplacement: metrics.valid,
      status: 'CONFIRMED_BREAK',
      valid: true,
      failureIndex: -1
    };
    events.push(event);
    trend = direction;
  };

  for (let index = 0; index < values.length; index += 1) {
    const candle = values[index];
    const confirmedHigh = confirmedHighAt.get(index);
    const confirmedLow = confirmedLowAt.get(index);

    if (confirmedHigh) {
      lastHigh = confirmedHigh;
      bslConsumed = false;
      bslBroken = false;
    }
    if (confirmedLow) {
      lastLow = confirmedLow;
      sslConsumed = false;
      sslBroken = false;
    }
    if (index === 0) continue;

    const localAtr = Math.max(conceptAtrAtClean(values, index), 0.0000001);
    if (!bslConsumed && lastHigh && candle.high > lastHigh.high && candle.close < lastHigh.high) {
      events.push(liquiditySweepEvent({
        direction: 'BULLISH', candle, level: lastHigh.high, index, localAtr
      }));
      bslConsumed = true;
    }
    if (!sslConsumed && lastLow && candle.low < lastLow.low && candle.close > lastLow.low) {
      events.push(liquiditySweepEvent({
        direction: 'BEARISH', candle, level: lastLow.low, index, localAtr
      }));
      sslConsumed = true;
    }

    const previous = values[index - 1];
    const breaksHigh = Boolean(lastHigh && !bslBroken
      && candle.close > lastHigh.high
      && previous.close <= lastHigh.high);
    const breaksLow = Boolean(lastLow && !sslBroken
      && candle.close < lastLow.low
      && previous.close >= lastLow.low);

    if (breaksHigh) {
      registerBreak('BULLISH', lastHigh, lastHigh.high, index);
      bslBroken = true;
    }
    if (breaksLow) {
      registerBreak('BEARISH', lastLow, lastLow.low, index);
      sslBroken = true;
    }
  }

  markFailedBreaks(events, values);
  const structureEvents = events.filter(item => item.kind === 'STRUCTURE_BREAK');
  const sweepEvents = events.filter(item => item.kind === 'LIQUIDITY_SWEEP');
  return {
    trend,
    events,
    structureEvents,
    sweepEvents,
    latestStructure: structureEvents.at(-1) || null,
    latestSweep: sweepEvents.at(-1) || null,
    thresholds: {
      penetrationAtr: CONCEPT_THRESHOLDS.structurePenetrationAtr,
      reclaimAtr: CONCEPT_THRESHOLDS.liquidityReclaimAtr
    }
  };
}
