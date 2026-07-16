import { CONCEPT_THRESHOLDS } from './concept-config.js';
import { cleanConceptCandles, conceptNumber } from './concept-candles.js';
import { htfDirectionAt, obCreatedImbalance } from './concept-ob-helpers.js';

function liveStatus(zone, currentPrice) {
  const price = conceptNumber(currentPrice);
  if (Number.isFinite(price) && price >= zone.bottom && price <= zone.top) return 'TESTING';
  return zone.status;
}

export function detectOrderBlockConcepts(candles, structureSnapshot, {
  htfCandles = {},
  currentPrice = null,
  maxZones = 12,
  maxPerDirection = 2,
  useBody = true
} = {}) {
  const values = cleanConceptCandles(candles);
  const events = (structureSnapshot?.structureEvents || []).filter(event => event.valid);
  const byIndex = new Map();

  for (const event of events) {
    const breakIndex = event.index;
    const direction = event.direction;
    const start = Math.max(0, breakIndex - CONCEPT_THRESHOLDS.obLookbackCandles);
    let originIndex = -1;

    for (let index = breakIndex - 1; index >= start; index -= 1) {
      const candle = values[index];
      const opposite = direction === 'BULLISH'
        ? candle.close < candle.open
        : candle.close > candle.open;
      if (opposite) {
        originIndex = index;
        break;
      }
    }
    if (originIndex < 0) continue;

    const origin = values[originIndex];
    const imbalance = obCreatedImbalance(values, originIndex, breakIndex, direction);
    const htfDirection = htfDirectionAt(htfCandles, values[breakIndex]?.time);
    const bottom = useBody ? Math.min(origin.open, origin.close) : origin.low;
    const top = useBody ? Math.max(origin.open, origin.close) : origin.high;
    const zone = {
      id: `OB:${direction}:${breakIndex}:${bottom.toFixed(5)}:${top.toFixed(5)}`,
      kind: 'ORDER_BLOCK',
      direction,
      type: direction,
      bottom,
      top,
      mid: (bottom + top) / 2,
      originIndex,
      structureBreakIndex: breakIndex,
      availableIndex: breakIndex,
      createdAt: values[breakIndex]?.time,
      causedValidBreak: true,
      createdImbalance: imbalance,
      htfAligned: htfDirection === direction,
      htfDirection,
      sourceStructure: event.concept,
      structureScope: event.scope,
      touchIndex: -1,
      confirmedIndex: -1,
      breakIndex: -1,
      status: 'DETECTED',
      active: true,
      converted: false,
      filterPassed: true,
      filterReason: 'Candle berlawanan terakhir sebelum close-break struktur.'
    };
    if (!byIndex.has(breakIndex)) byIndex.set(breakIndex, []);
    byIndex.get(breakIndex).push(zone);
  }

  const active = [];
  for (let index = 0; index < values.length; index += 1) {
    for (const zone of byIndex.get(index) || []) {
      active.unshift(zone);
      const sameDirection = active.filter(item => item.direction === zone.direction);
      if (sameDirection.length > maxPerDirection) {
        active.splice(active.indexOf(sameDirection.at(-1)), 1);
      }
    }

    for (const zone of [...active]) {
      if (index <= zone.availableIndex) continue;
      const candle = values[index];
      const invalid = zone.direction === 'BULLISH'
        ? candle.close < zone.bottom
        : candle.close > zone.top;
      if (invalid) {
        zone.breakIndex = index;
        zone.status = 'INVALID';
        zone.active = false;
        active.splice(active.indexOf(zone), 1);
        continue;
      }

      const touched = candle.high >= zone.bottom && candle.low <= zone.top;
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
    .sort((a, b) => b.availableIndex - a.availableIndex)
    .slice(0, maxZones);
}
