import { detectStructureConcepts } from '../engine/concept-structure.js';
import { detectOrderBlockConcepts } from '../engine/concept-ob.js';

const DEFAULT_FVG_VISIBLE_PER_DIRECTION = 2;
const DEFAULT_OB_VISIBLE_PER_DIRECTION = 1;

function number(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bodyHigh(candle, useBody = true) {
  return useBody
    ? Math.max(number(candle?.open), number(candle?.close))
    : number(candle?.high);
}

function bodyLow(candle, useBody = true) {
  return useBody
    ? Math.min(number(candle?.open), number(candle?.close))
    : number(candle?.low);
}

function validCandle(candle) {
  const open = number(candle?.open);
  const high = number(candle?.high);
  const low = number(candle?.low);
  const close = number(candle?.close);
  return [open, high, low, close].every(Number.isFinite)
    && high >= Math.max(open, close)
    && low <= Math.min(open, close)
    && high >= low;
}

function cleanCandles(candles) {
  return (Array.isArray(candles) ? candles : [])
    .filter(validCandle)
    .map((candle, index) => ({
      ...candle,
      index,
      open: number(candle.open),
      high: number(candle.high),
      low: number(candle.low),
      close: number(candle.close),
      time: number(candle.time, index)
    }));
}

function averageBody(candles, endIndex, length) {
  const start = Math.max(0, endIndex - length + 1);
  const values = [];
  for (let index = start; index <= endIndex; index += 1) {
    const candle = candles[index];
    if (!candle) continue;
    values.push(Math.abs(candle.close - candle.open));
  }
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function evaluateFvgStatus(zone, candles) {
  let status = 'FRESH';
  let lastTouchIndex = null;
  for (let index = zone.endIndex + 1; index < candles.length; index += 1) {
    const candle = candles[index];
    if (zone.type === 'BULLISH') {
      if (candle.low < zone.bottom) {
        return { status: 'BROKEN', active: false, lastTouchIndex: index };
      }
      if (candle.low < zone.mid) {
        status = 'MITIGATED';
        lastTouchIndex = index;
      } else if (candle.low < zone.top && status === 'FRESH') {
        status = 'TESTED';
        lastTouchIndex = index;
      }
    } else {
      if (candle.high > zone.top) {
        return { status: 'BROKEN', active: false, lastTouchIndex: index };
      }
      if (candle.high > zone.mid) {
        status = 'MITIGATED';
        lastTouchIndex = index;
      } else if (candle.high > zone.bottom && status === 'FRESH') {
        status = 'TESTED';
        lastTouchIndex = index;
      }
    }
  }
  return { status, active: true, lastTouchIndex };
}

export function detectIndicatorFvgs(candles, {
  bodyLength = 5,
  wickBodyRatio = 0.36,
  visiblePerDirection = DEFAULT_FVG_VISIBLE_PER_DIRECTION,
  lookback = 1000
} = {}) {
  const all = cleanCandles(candles);
  const offset = Math.max(0, all.length - lookback);
  const values = all.slice(offset).map((candle, index) => ({ ...candle, index }));
  const raw = [];

  for (let index = 2; index < values.length; index += 1) {
    const first = values[index - 2];
    const second = values[index - 1];
    const third = values[index];
    const avgBody = averageBody(values, index - 1, bodyLength);
    const body = Math.abs(second.close - second.open);

    if (body <= avgBody || avgBody <= 0) continue;

    const upperWick = second.high - Math.max(second.open, second.close);
    const lowerWick = Math.min(second.open, second.close) - second.low;
    if (upperWick > body * wickBodyRatio || lowerWick > body * wickBodyRatio) continue;

    const bullish = third.low > first.high;
    const bearish = third.high < first.low;
    if (!bullish && !bearish) continue;

    const type = bullish ? 'BULLISH' : 'BEARISH';
    const bottom = bullish ? first.high : third.high;
    const top = bullish ? third.low : first.low;
    const zone = {
      kind: 'FVG',
      type,
      bottom,
      top,
      mid: (bottom + top) / 2,
      originIndex: index - 2 + offset,
      endIndex: index + offset,
      createdAt: third.time,
      active: true,
      status: 'FRESH'
    };
    raw.push(zone);
  }

  const evaluated = raw.map(zone => ({
    ...zone,
    ...evaluateFvgStatus(zone, all)
  }));

  const latest = type => evaluated
    .filter(zone => zone.type === type && zone.active)
    .sort((a, b) => b.endIndex - a.endIndex)
    .slice(0, visiblePerDirection);

  return [...latest('BULLISH'), ...latest('BEARISH')]
    .sort((a, b) => b.endIndex - a.endIndex);
}

/**
 * Adapter tampilan validated Order Block:
 * Meneruskan hasil dari detectOrderBlockConcepts (concept-ob.js) sebagai satu-satunya mesin OB.
 */
export function detectIndicatorOrderBlocks(candles, {
  validatedOrderBlocks = null,
  currentPrice = null,
  visiblePerDirection = DEFAULT_OB_VISIBLE_PER_DIRECTION
} = {}) {
  const clean = cleanCandles(candles);
  const zones = Array.isArray(validatedOrderBlocks)
    ? validatedOrderBlocks
    : detectOrderBlockConcepts(
        clean,
        detectStructureConcepts(clean),
        { currentPrice, maxZones: 12 }
      );

  const latest = type => zones
    .filter(zone => (zone.direction === type || zone.type === type) && zone.active !== false && zone.status !== 'INVALID')
    .sort((a, b) => Number(b.availableIndex || 0) - Number(a.availableIndex || 0))
    .slice(0, visiblePerDirection);

  return [...latest('BULLISH'), ...latest('BEARISH')];
}

export function zoneDistance(zone, price) {
  const value = number(price);
  if (!Number.isFinite(value)) return Infinity;
  if (value < zone.bottom) return zone.bottom - value;
  if (value > zone.top) return value - zone.top;
  return 0;
}

export function zoneLiveStatus(zone, price) {
  if (!zone) return 'TIDAK ADA';
  const value = number(price);
  if (zone.status === 'INVALID') return 'INVALID';
  if (!Number.isFinite(value)) return zone.status || 'DETECTED';
  if (value >= zone.bottom && value <= zone.top) return 'SEDANG DIUJI';
  if (zone.type === 'BEARISH' || zone.direction === 'BEARISH') {
    return value < zone.bottom ? 'BELUM RETEST · DI ATAS HARGA' : 'TERMITIGASI';
  }
  if (zone.type === 'BULLISH' || zone.direction === 'BULLISH') {
    return value > zone.top ? 'BELUM RETEST · DI BAWAH HARGA' : 'TERMITIGASI';
  }
  return zone.status || 'DETECTED';
}

export function nearestZones(zones, price, limit = 2) {
  return (Array.isArray(zones) ? zones : [])
    .filter(zone => zone.active !== false)
    .map(zone => ({ ...zone, distance: zoneDistance(zone, price) }))
    .sort((a, b) => a.distance - b.distance || (b.endIndex || b.breakIndex || 0) - (a.endIndex || a.breakIndex || 0))
    .slice(0, limit);
}

export function detectIndicatorZones(candles, price, options = {}) {
  const orderBlocks = detectIndicatorOrderBlocks(candles, options.orderBlocks);
  const fairValueGaps = detectIndicatorFvgs(candles, options.fairValueGaps);
  return {
    orderBlocks,
    fairValueGaps,
    nearestOrderBlocks: nearestZones(orderBlocks, price, 2),
    nearestFairValueGaps: nearestZones(fairValueGaps, price, 2),
    metadata: {
      source: 'ICT Concepts [amygmgo]',
      obUseBody: options.orderBlocks?.useBody ?? true,
      obSwingLength: options.orderBlocks?.swingLength ?? 10,
      fvgBodyLength: options.fairValueGaps?.bodyLength ?? 5,
      fvgWickBodyRatio: options.fairValueGaps?.wickBodyRatio ?? 0.36
    }
  };
}
