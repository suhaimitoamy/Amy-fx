import { CONCEPT_THRESHOLDS } from './concept-config.js';
import {
  averageConceptBody,
  cleanConceptCandles,
  conceptAtrAtClean,
  conceptNumber
} from './concept-candles.js';

function liveStatus(zone, currentPrice) {
  const price = conceptNumber(currentPrice);
  if (Number.isFinite(price) && price >= zone.bottom && price <= zone.top) return 'TESTING';
  return zone.status;
}

export function detectFvgConcepts(candles, {
  lookback = 500,
  currentPrice = null,
  minWidthAtr = CONCEPT_THRESHOLDS.fvgMinWidthAtr,
  maxPerDirection = 3
} = {}) {
  const values = cleanConceptCandles(candles);
  const start = Math.max(2, values.length - Math.max(3, lookback));
  const active = [];

  for (let index = start; index < values.length; index += 1) {
    const first = values[index - 2];
    const middle = values[index - 1];
    const third = values[index];

    if (first && middle && third && index - 1 >= CONCEPT_THRESHOLDS.fvgBodyLength - 1) {
      const body = Math.abs(middle.close - middle.open);
      const meanBody = averageConceptBody(values, index - 1, CONCEPT_THRESHOLDS.fvgBodyLength);
      const range = Math.max(middle.high - middle.low, 0.0000001);
      const bodyRatio = body / range;
      const upperWick = middle.high - Math.max(middle.open, middle.close);
      const lowerWick = Math.min(middle.open, middle.close) - middle.low;
      const displacement = body > meanBody
        && body > 0
        && bodyRatio >= CONCEPT_THRESHOLDS.fvgBodyRatio
        && upperWick < body * CONCEPT_THRESHOLDS.fvgWickBodyRatio
        && lowerWick < body * CONCEPT_THRESHOLDS.fvgWickBodyRatio;
      const bullish = displacement && middle.close > middle.open && third.low > first.high;
      const bearish = displacement && middle.close < middle.open && third.high < first.low;

      if (bullish || bearish) {
        const direction = bullish ? 'BULLISH' : 'BEARISH';
        const bottom = bullish ? first.high : third.high;
        const top = bullish ? third.low : first.low;
        const localAtr = Math.max(conceptAtrAtClean(values, index - 1), 0.0000001);
        const widthAtr = (top - bottom) / localAtr;

        if (top > bottom && widthAtr >= minWidthAtr) {
          const zone = {
            id: `FVG:${direction}:${index}:${bottom.toFixed(5)}:${top.toFixed(5)}`,
            kind: 'FVG',
            direction,
            type: direction,
            bottom,
            top,
            mid: (bottom + top) / 2,
            originIndex: index - 2,
            displacementIndex: index - 1,
            availableIndex: index,
            createdAt: third.time,
            localAtr,
            widthAtr,
            bodyRatio,
            touchIndex: -1,
            confirmedIndex: -1,
            breakIndex: -1,
            status: 'DETECTED',
            active: true,
            converted: false,
            filterPassed: true,
            filterReason: `FVG tiga candle dengan displacement ${bodyRatio.toFixed(2)} body/range.`
          };
          active.unshift(zone);
          const sameDirection = active.filter(item => item.direction === direction);
          if (sameDirection.length > maxPerDirection) {
            active.splice(active.indexOf(sameDirection.at(-1)), 1);
          }
        }
      }
    }

    for (const zone of [...active]) {
      if (index <= zone.availableIndex) continue;
      const candle = values[index];
      const filled = zone.direction === 'BULLISH'
        ? candle.low <= zone.bottom
        : candle.high >= zone.top;
      if (filled) {
        zone.breakIndex = index;
        zone.status = 'INVALID';
        zone.active = false;
        active.splice(active.indexOf(zone), 1);
        continue;
      }

      const touched = zone.direction === 'BULLISH'
        ? candle.low < zone.top
        : candle.high > zone.bottom;
      if (touched && zone.touchIndex < 0) {
        zone.touchIndex = index;
        const rejected = zone.direction === 'BULLISH'
          ? candle.close > zone.top
          : candle.close < zone.bottom;
        if (rejected) zone.confirmedIndex = index;
      }
      zone.status = zone.touchIndex < 0 ? 'DETECTED'
        : zone.confirmedIndex === zone.touchIndex ? 'CONFIRMED_REACTION' : 'TESTING';
    }
  }

  return active
    .map(zone => ({ ...zone, status: liveStatus(zone, currentPrice) }))
    .sort((a, b) => b.availableIndex - a.availableIndex);
}
