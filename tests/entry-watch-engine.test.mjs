import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntryWatchCandidates,
  calculateMultiTimeframeEntryWatch,
  evaluateEntryWatchCandidate,
  ENTRY_WATCH_CONFIG
} from '../app/src/main/assets/apps/mapping/js/engine/entry-watch-engine.js';

function candle(time, open, high, low, close) {
  return { time, open, high, low, close };
}

function trendCandles(count, seconds, start = 2000) {
  return Array.from({ length: count }, (_, index) => {
    const open = start + index * 0.2;
    const close = open + 0.1;
    return candle(1_700_000_000 + index * seconds, open, close + 0.4, open - 0.4, close);
  });
}

function baseCandidate(overrides = {}) {
  return {
    id: 'WATCH:1',
    sourceId: 'SOURCE:1',
    sourceTf: 'H1',
    triggerTf: 'M5',
    sourceKind: 'FVG',
    sourceLabel: 'FVG',
    direction: 'BUY',
    bottom: 1999,
    top: 2001,
    level: 1999,
    atr: 4,
    availableTime: 1_700_000_000,
    ...overrides
  };
}

test('config locks multi-timeframe source and lower-timeframe trigger rules', () => {
  assert.deepEqual(ENTRY_WATCH_CONFIG.sourceTimeframes, ['M5', 'M15', 'H1', 'H4']);
  assert.equal(ENTRY_WATCH_CONFIG.triggerTimeframes.H1, 'M5');
  assert.equal(ENTRY_WATCH_CONFIG.breakRule, 'CLOSE_SOURCE_TIMEFRAME_BEYOND_LEVEL');
});

test('candidate builder uses FVG, OB, and directional liquidity from multiple timeframes', () => {
  const conceptsByTf = {
    M15: {
      fairValueGaps: [{ id: 'fvg', direction: 'BULLISH', bottom: 1998, top: 2000, status: 'DETECTED', createdAt: 1 }],
      orderBlocks: [],
      liquidityLevels: [{ id: 'ssl', type: 'SSL', level: 1997, status: 'DETECTED', active: true }]
    },
    H1: {
      fairValueGaps: [],
      orderBlocks: [{ id: 'ob', direction: 'BULLISH', bottom: 1995, top: 1999, status: 'TESTING', createdAt: 1 }],
      liquidityLevels: [{ id: 'bsl', type: 'BSL', level: 2010, status: 'DETECTED', active: true }]
    }
  };
  const candlesByTf = { M15: trendCandles(30, 900), H1: trendCandles(30, 3600) };
  const candidates = buildEntryWatchCandidates({ conceptsByTf, candlesByTf, direction: 'BUY', currentPrice: 2002 });
  assert.ok(candidates.some(item => item.sourceKind === 'FVG' && item.sourceTf === 'M15'));
  assert.ok(candidates.some(item => item.sourceKind === 'ORDER_BLOCK' && item.sourceTf === 'H1'));
  assert.ok(candidates.some(item => item.sourceKind === 'LIQUIDITY' && item.liquidityType === 'SSL'));
  assert.equal(candidates.some(item => item.liquidityType === 'BSL'), false);
});

test('H1 level enters only after M5 wick sweep and close reclaim', () => {
  const h1 = trendCandles(20, 3600, 2002);
  h1.push(candle(h1.at(-1).time + 3600, 2002, 2004, 2000, 2001));
  const m5 = trendCandles(20, 300, 2002);
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998, 2000.5));
  const result = evaluateEntryWatchCandidate(baseCandidate(), { H1: h1, M5: m5 });
  assert.equal(result.lifecycleStage, 'ENTRY_TRIGGERED');
  assert.equal(result.entryAllowed, true);
  assert.equal(result.direction, 'BUY');
});

test('source timeframe close break cancels entry and converts FVG to iFVG', () => {
  const h1 = trendCandles(20, 3600, 2002);
  h1.push(candle(h1.at(-1).time + 3600, 2000, 2001, 1996, 1998));
  const m5 = trendCandles(20, 300, 2002);
  const result = evaluateEntryWatchCandidate(baseCandidate(), { H1: h1, M5: m5 });
  assert.equal(result.lifecycleStage, 'VALID_BREAK');
  assert.equal(result.entryAllowed, false);
  assert.equal(result.transformed.sourceKind, 'IFVG');
  assert.equal(result.transformed.direction, 'SELL');
});

test('broken Order Block converts into Breaker Block', () => {
  const h1 = trendCandles(20, 3600, 2002);
  h1.push(candle(h1.at(-1).time + 3600, 2000, 2001, 1996, 1998));
  const result = evaluateEntryWatchCandidate(baseCandidate({ sourceKind: 'ORDER_BLOCK', sourceLabel: 'Order Block' }), { H1: h1, M5: trendCandles(20, 300, 2002) });
  assert.equal(result.transformed.sourceKind, 'BREAKER_BLOCK');
  assert.equal(result.transitionText, 'ORDER_BLOCK → BREAKER_BLOCK');
});

test('broken SSL becomes bearish Valid Break instead of liquidity sweep entry', () => {
  const h1 = trendCandles(20, 3600, 2002);
  h1.push(candle(h1.at(-1).time + 3600, 2000, 2001, 1996, 1998));
  const result = evaluateEntryWatchCandidate(baseCandidate({ sourceKind: 'LIQUIDITY', sourceLabel: 'SSL', liquidityType: 'SSL', bottom: 1999, top: 1999 }), { H1: h1, M5: trendCandles(20, 300, 2002) });
  assert.equal(result.lifecycleStage, 'VALID_BREAK');
  assert.equal(result.transformed.sourceKind, 'VALID_BREAK');
  assert.equal(result.transformed.direction, 'SELL');
});

test('previous watched level stays locked instead of jumping to another candidate', () => {
  const previous = baseCandidate({ lifecycleStage: 'WATCHING_LEVEL', status: 'PANTAU HARGA', active: true, terminal: false, candidates: [] });
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const result = calculateMultiTimeframeEntryWatch({
    conceptsByTf: {},
    candlesByTf: { H1: h1, M5: m5 },
    direction: 'BUY',
    currentPrice: 2004,
    previous
  });
  assert.equal(result.id, previous.id);
  assert.ok(['WATCHING_LEVEL', 'LEVEL_TESTING'].includes(result.lifecycleStage));
});
