import { CONCEPT_THRESHOLDS } from './concept-config.js';
import {
  averageConceptBody,
  cleanConceptCandles,
  conceptAtrAtClean
} from './concept-candles.js';
import { evaluateZoneLifecycle } from './concept-zone-lifecycle.js';

function limitedHistory(zones, maxPerDirection) {
  const output = new Map();
  for (const direction of ['BULLISH', 'BEARISH']) {
    for (const zone of zones
      .filter(item => (item.originalDirection || item.direction) === direction)
      .sort((a, b) => b.availableIndex - a.availableIndex)
      .slice(0, maxPerDirection)) {
      output.set(zone.id, zone);
    }
  }
  return [...output.values()].sort((a, b) => b.availableIndex - a.availableIndex);
}

export function detectFvgConcepts(candles, {
  lookback = 500,
  currentPrice = null,
  minWidthAtr = CONCEPT_THRESHOLDS.fvgMinWidthAtr,
  maxWidthAtr = CONCEPT_THRESHOLDS.fvgMaxWidthAtr,
  maxPerDirection = 8
} = {}) {
  const values = cleanConceptCandles(candles);
  const start = Math.max(
    2,
    values.length - Math.max(3, lookback),
    CONCEPT_THRESHOLDS.fvgBodyLength + 1
  );
  const zones = [];

  for (let index = start; index < values.length; index += 1) {
    const first = values[index - 2];
    const middle = values[index - 1];
    const third = values[index];
    if (!first || !middle || !third) continue;

    // Pine Script parity (AMY_ICT_NextGen.pine line 633):
    // In ICT standard, Candle 2 (middle) is the primary displacement candle creating the imbalance.
    // Candle 3 (third) confirms the gap (third.low > first.high for bullish, third.high < first.low for bearish).
    // Backward compatibility: also accept Candle 3 displacement if present.
    const middleBody = Math.abs(middle.close - middle.open);
    const thirdBody = Math.abs(third.close - third.open);
    const middleRange = Math.max(middle.high - middle.low, 0.0000001);
    const thirdRange = Math.max(third.high - third.low, 0.0000001);
    const meanBody = averageConceptBody(
      values,
      index - 2,
      CONCEPT_THRESHOLDS.fvgBodyLength
    ) || averageConceptBody(
      values,
      index - 1,
      CONCEPT_THRESHOLDS.fvgBodyLength
    );

    const middleDisplacement = meanBody > 0
      && middleBody >= meanBody * CONCEPT_THRESHOLDS.fvgBodyMeanMultiplier;
    const thirdDisplacement = meanBody > 0
      && thirdBody >= meanBody * CONCEPT_THRESHOLDS.fvgBodyMeanMultiplier;

    const bullishMiddle = middleDisplacement && middle.close > middle.open && third.low > first.high;
    const bullishThird = thirdDisplacement && third.close > third.open && third.low > first.high;
    const bullish = bullishMiddle || bullishThird;

    const bearishMiddle = middleDisplacement && middle.close < middle.open && third.high < first.low;
    const bearishThird = thirdDisplacement && third.close < third.open && third.high < first.low;
    const bearish = bearishMiddle || bearishThird;

    if (!bullish && !bearish) continue;

    const isMiddleDisplaced = bullish ? bullishMiddle : bearishMiddle;
    const body = isMiddleDisplaced ? middleBody : thirdBody;
    const range = isMiddleDisplaced ? middleRange : thirdRange;
    const bodyRatio = body / range;
    const displacementIndex = isMiddleDisplaced ? (index - 1) : index;

    const direction = bullish ? 'BULLISH' : 'BEARISH';
    const bottom = bullish ? first.high : third.high;
    const top = bullish ? third.low : first.low;
    const localAtr = Math.max(conceptAtrAtClean(values, index), 0.0000001);
    const widthAtr = (top - bottom) / localAtr;
    if (!(top > bottom) || widthAtr < minWidthAtr || widthAtr > maxWidthAtr) continue;

    zones.push({
      id: `FVG:${direction}:${index}:${bottom.toFixed(5)}:${top.toFixed(5)}`,
      kind: 'FVG',
      direction,
      type: direction,
      bottom,
      top,
      mid: (bottom + top) / 2,
      originIndex: index - 2,
      displacementIndex,
      availableIndex: index,
      createdAt: third.time,
      localAtr,
      widthAtr,
      bodyRatio,
      bodyMeanMultiple: body / meanBody,
      status: 'DETECTED',
      active: true,
      converted: false,
      filterPassed: true,
      quality: body / meanBody >= 1.5 ? 'STRONG' : 'VALID',
      filterReason: `FVG displacement ${bodyRatio.toFixed(2)} body/range · width ${widthAtr.toFixed(2)} ATR.`
    });
  }

  const evaluated = zones.map(zone => evaluateZoneLifecycle(values, zone, {
    convertedKind: 'IFVG',
    currentPrice
  }));
  return limitedHistory(evaluated, maxPerDirection);
}
