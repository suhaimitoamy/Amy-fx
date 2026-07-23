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

function trendCandles(count, seconds, start = 2000, startTime = 1_700_000_000) {
  return Array.from({ length: count }, (_, index) => {
    const open = start + index * 0.2;
    const close = open + 0.1;
    return candle(startTime + index * seconds, open, close + 0.4, open - 0.4, close);
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
    expiryTime: 1_800_000_000,
    ...overrides
  };
}

function conceptsFor(candidate, status = 'DETECTED') {
  const zone = {
    id: candidate.sourceId,
    direction: candidate.direction === 'BUY' ? 'BULLISH' : 'BEARISH',
    bottom: candidate.bottom,
    top: candidate.top,
    status,
    active: true
  };
  if (candidate.sourceKind === 'FVG') return { [candidate.sourceTf]: { fairValueGaps: [zone], orderBlocks: [], liquidityLevels: [] } };
  if (candidate.sourceKind === 'ORDER_BLOCK') return { [candidate.sourceTf]: { fairValueGaps: [], orderBlocks: [zone], liquidityLevels: [] } };
  return { [candidate.sourceTf]: { fairValueGaps: [], orderBlocks: [], liquidityLevels: [{ id: candidate.sourceId, type: candidate.liquidityType || 'SSL', level: candidate.level, status, active: true }] } };
}

test('config locks causal multi-timeframe rules', () => {
  assert.deepEqual(ENTRY_WATCH_CONFIG.sourceTimeframes, ['M5', 'M15', 'H1', 'H4']);
  assert.equal(ENTRY_WATCH_CONFIG.triggerTimeframes.H1, 'M5');
  assert.equal(ENTRY_WATCH_CONFIG.breakRule, 'REPLAY_ALL_SOURCE_CLOSES_BEYOND_LEVEL');
  assert.equal(ENTRY_WATCH_CONFIG.reentryRule, 'ONE_ENTRY_PER_LEVEL_THEN_ENTRY_SPENT');
});

test('candidate builder derives availability from confirmed source candle close', () => {
  const candles = trendCandles(30, 900);
  const conceptsByTf = {
    M15: {
      fairValueGaps: [{ id: 'fvg', direction: 'BULLISH', bottom: 1998, top: 2000, status: 'DETECTED', availableIndex: 20 }],
      orderBlocks: [],
      liquidityLevels: [{ id: 'ssl', type: 'SSL', level: 1997, status: 'DETECTED', active: true, availableIndex: 18 }]
    }
  };
  const candidates = buildEntryWatchCandidates({ conceptsByTf, candlesByTf: { M15: candles }, direction: 'BUY', currentPrice: 2002 });
  const fvg = candidates.find(item => item.sourceKind === 'FVG');
  assert.equal(fvg.availableTime, candles[20].time + 900);
});

test('new level is armed first and cannot enter on its first evaluation', () => {
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998, 2000.5));
  const result = evaluateEntryWatchCandidate(baseCandidate(), { H1: h1, M5: m5 });
  assert.ok(['WATCHING_LEVEL', 'LEVEL_TESTING'].includes(result.lifecycleStage));
  assert.equal(result.entryAllowed, false);
});

test('H1 level enters only on a later M5 candle after arming', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998, 2000.5));
  const result = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, armed, { conceptsByTf: conceptsFor(candidate) });
  assert.equal(result.lifecycleStage, 'ENTRY_TRIGGERED');
  assert.equal(result.entryAllowed, true);
});

test('source timeframe close break cancels entry and converts FVG to iFVG', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  h1.push(candle(h1.at(-1).time + 3600, 2000, 2001, 1996, 1998));
  const result = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, armed, { conceptsByTf: conceptsFor(candidate) });
  assert.equal(result.lifecycleStage, 'VALID_BREAK');
  assert.equal(result.transformed.sourceKind, 'IFVG');
  assert.equal(result.transformed.direction, 'SELL');
});

test('hidden source break is reconciled while forecast is paused', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  h1.push(candle(h1.at(-1).time + 3600, 2000, 2001, 1996, 1998));
  const paused = calculateMultiTimeframeEntryWatch({ candlesByTf: { H1: h1, M5: m5 }, direction: 'WAIT', currentPrice: 1998, previous: armed });
  assert.equal(paused.lifecycleStage, 'VALID_BREAK');
  assert.equal(paused.terminal, true);
});

test('pause advances trigger cursor so sweep during inactive forecast cannot enter later', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998, 2000.5));
  const paused = calculateMultiTimeframeEntryWatch({ candlesByTf: { H1: h1, M5: m5 }, direction: 'WAIT', currentPrice: 2000.5, previous: armed });
  assert.equal(paused.lifecycleStage, 'FORECAST_PAUSED');
  const resumed = calculateMultiTimeframeEntryWatch({ conceptsByTf: conceptsFor(candidate), candlesByTf: { H1: h1, M5: m5 }, direction: 'BUY', currentPrice: 2000.5, previous: paused });
  assert.notEqual(resumed.lifecycleStage, 'ENTRY_TRIGGERED');
});

test('level removed from detector becomes terminal instead of orphan entry', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998.5, 1998.8));
  const result = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, armed, { conceptsByTf: { H1: { fairValueGaps: [], orderBlocks: [], liquidityLevels: [] } } });
  assert.equal(result.lifecycleStage, 'LEVEL_RETIRED');
  assert.equal(result.entryAllowed, false);
});

test('one entry becomes ENTRY_SPENT on the next trigger candle', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  m5.push(candle(m5.at(-1).time + 300, 2000, 2001, 1998, 2000.5));
  const entered = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, armed, { conceptsByTf: conceptsFor(candidate) });
  m5.push(candle(m5.at(-1).time + 300, 2000.5, 2001.5, 1998, 2000.8));
  const spent = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, entered, { conceptsByTf: conceptsFor(candidate) });
  assert.equal(spent.lifecycleStage, 'ENTRY_SPENT');
  assert.equal(spent.entryAllowed, false);
  assert.equal(spent.terminal, true);
});

test('expired converted level cannot stay alive forever', () => {
  const candidate = baseCandidate({ converted: true, sourceKind: 'IFVG', expiryTime: 1_700_010_000 });
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  const result = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 }, armed);
  assert.equal(result.lifecycleStage, 'LEVEL_EXPIRED');
});

test('forecast change closes old level instead of resurrecting it', () => {
  const candidate = baseCandidate();
  const h1 = trendCandles(20, 3600, 2002);
  const m5 = trendCandles(20, 300, 2002);
  const armed = evaluateEntryWatchCandidate(candidate, { H1: h1, M5: m5 });
  const result = calculateMultiTimeframeEntryWatch({ conceptsByTf: {}, candlesByTf: { H1: h1, M5: m5 }, direction: 'SELL', currentPrice: 2004, previous: armed });
  assert.equal(result.lifecycleStage, 'FORECAST_CHANGED');
  assert.equal(result.terminal, true);
});
