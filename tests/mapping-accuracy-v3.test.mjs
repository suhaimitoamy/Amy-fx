import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_MAPPING_TIMEFRAMES,
  TIMEFRAME_CONTEXT,
  TIMEFRAME_ENTRY_PROFILES,
  expectedClosedCandleOpenTime,
  timeframeDurationMs
} from '../app/src/main/assets/apps/mapping/js/engine/mapping-timeframes.js';
import {
  advanceTimeframeEntryLifecycle,
  createTimeframeEntryPlan,
  detectTimeframeEntryMap,
  entryTrendFiltersAt,
  structuralTargetAssessment
} from '../app/src/main/assets/apps/mapping/js/engine/concept-entry-map-v3.js';
import { buildCausalEntryWatch } from '../app/src/main/assets/apps/mapping/js/engine/concept-analyze.js';
import { buildMappingSnapshot } from '../app/src/main/assets/apps/mapping/js/engine/mapping-snapshot.js';
import { structureDisplacementMetrics } from '../app/src/main/assets/apps/mapping/js/engine/concept-structure-metrics.js';
import { evaluateZoneLifecycle } from '../app/src/main/assets/apps/mapping/js/engine/concept-zone-lifecycle.js';
import { balancedH1ForecastCandidate } from '../app/src/main/assets/apps/mapping/js/engine/validated-market-context-balanced.js';

function entryFixture(tf) {
  const durationSeconds = timeframeDurationMs(tf) / 1000;
  const triggerTime = Date.parse('2026-07-01T12:00:00Z') / 1000;
  const startTime = triggerTime - 96 * durationSeconds;
  const candles = Array.from({ length: 100 }, (_, index) => {
    const close = 97 + index * 0.02;
    return {
      time: startTime + index * durationSeconds,
      open: close - 0.1,
      high: close + 1,
      low: close - 1,
      close
    };
  });
  candles[94] = {
    time: startTime + 94 * durationSeconds,
    open: 98,
    high: 99.5,
    low: 96,
    close: 98.5
  };
  candles[95] = {
    time: startTime + 95 * durationSeconds,
    open: 98.5,
    high: 99.5,
    low: 97,
    close: 98.8
  };
  candles[96] = {
    time: triggerTime,
    open: 98,
    high: 100.5,
    low: 97.5,
    close: 100.2
  };
  const marketConcepts = {
    liquidityLevels: [
      {
        id: 'ssl-sweep',
        type: 'SSL',
        subtype: 'INTERNAL_SWING',
        tier: 'INTERNAL_SWING',
        level: 97,
        availableIndex: 80,
        interactionIndex: 94,
        interactionTime: candles[94].time,
        confirmed: true,
        status: 'CONFIRMED_REACTION'
      },
      {
        id: 'bsl-target',
        type: 'BSL',
        subtype: 'EXTERNAL_SWING',
        tier: 'EXTERNAL_KEY',
        level: 114,
        availableIndex: 80,
        interactionIndex: -1,
        status: 'DETECTED'
      }
    ],
    orderBlocks: [],
    fairValueGaps: [],
    structureSnapshot: {
      sweepEvents: [],
      structureEvents: [{
        id: 'mss',
        concept: 'MSS',
        direction: 'BULLISH',
        scope: 'INTERNAL',
        level: 99.5,
        index: 96,
        valid: true,
        hasDisplacement: true,
        status: 'CONFIRMED_BREAK'
      }],
      slowSwings: {
        highs: [{ index: 70, high: 120 }],
        lows: [{ index: 80, low: 90 }]
      }
    }
  };
  const validatedContext = {
    directionForecast: {
      active: true,
      direction: 'BULLISH',
      directionValue: 1,
      startIndex: 90,
      triggerRule: 'TEST FORECAST'
    }
  };
  const contextTf = TIMEFRAME_CONTEXT[tf];
  const htfCandles = {};
  if (contextTf) {
    const contextDuration = timeframeDurationMs(contextTf) / 1000;
    const triggerClose = triggerTime + durationSeconds;
    const latestContextClose = Math.floor(triggerClose / contextDuration) * contextDuration;
    const contextStart = latestContextClose - 100 * contextDuration;
    htfCandles[contextTf] = Array.from({ length: 100 }, (_, index) => {
      const close = 90 + index * 0.1;
      return {
        time: contextStart + index * contextDuration,
        open: close - 0.1,
        high: close + 0.4,
        low: close - 0.4,
        close
      };
    });
  }
  return { candles, marketConcepts, validatedContext, htfCandles };
}

test('Mapping V3 supports every Amy FX timeframe with an explicit context and profile', () => {
  assert.deepEqual(SUPPORTED_MAPPING_TIMEFRAMES, [
    'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'
  ]);
  for (const tf of SUPPORTED_MAPPING_TIMEFRAMES) {
    assert.ok(TIMEFRAME_ENTRY_PROFILES[tf]);
    assert.ok(timeframeDurationMs(tf) > 0);
    assert.equal(TIMEFRAME_ENTRY_PROFILES[tf].sourceTimeframe, tf);
    assert.equal(TIMEFRAME_ENTRY_PROFILES[tf].triggerTimeframe, tf);
  }
  assert.equal(TIMEFRAME_CONTEXT.M1, 'M5');
  assert.equal(TIMEFRAME_CONTEXT.M5, 'H4');
  assert.equal(TIMEFRAME_CONTEXT.H4, 'D1');
  assert.equal(TIMEFRAME_CONTEXT.W1, null);
  assert.equal(TIMEFRAME_ENTRY_PROFILES.H1.sessionMode, 'NEW_YORK_ONLY');
});

test('client W1 refresh boundary uses the latest completed Monday-anchored candle', () => {
  assert.equal(
    expectedClosedCandleOpenTime('W1', Date.parse('2026-07-28T12:00:00Z')),
    Date.parse('2026-07-20T00:00:00Z') / 1000
  );
});

test('H1 bearish remains suppressed exactly as the trusted reference specifies', () => {
  const candidate = balancedH1ForecastCandidate({
    rawBreakBear: true,
    htfBearConfirmed: true,
    priceBear: true,
    momentum3Atr: -1.2
  });
  assert.equal(candidate.directionValue, 0);
  assert.equal(candidate.direction, 'NO CLEAR DIRECTION');
  assert.equal(candidate.bearishTrigger, false);
});

test('structure break needs the reference close buffer and displacement quality', () => {
  const weak = structureDisplacementMetrics(
    { open: 100, high: 100.25, low: 99.9, close: 100.12 },
    1,
    100,
    'BULLISH'
  );
  const valid = structureDisplacementMetrics(
    { open: 99.7, high: 100.3, low: 99.6, close: 100.2 },
    1,
    100,
    'BULLISH'
  );
  assert.equal(weak.valid, false);
  assert.equal(valid.valid, true);
  assert.ok(valid.penetrationAtr >= 0.10);
  assert.ok(valid.bodyAtr >= 0.30);
  assert.ok(valid.bodyRatio >= 0.45);
});

test('zone acceptance needs three closed candles plus continuation before inverse conversion', () => {
  const firstTwoCloses = [
    { time: 0, open: 101, high: 101.2, low: 100.5, close: 100.8 },
    { time: 1, open: 100.2, high: 100.4, low: 99.6, close: 99.8 },
    { time: 2, open: 99.9, high: 100.1, low: 99.4, close: 99.7 }
  ];
  const zone = {
    id: 'fvg',
    kind: 'FVG',
    direction: 'BULLISH',
    bottom: 100,
    top: 101,
    availableIndex: 0,
    localAtr: 1
  };
  const warning = evaluateZoneLifecycle(firstTwoCloses, zone, { convertedKind: 'IFVG' });
  assert.equal(warning.converted, false);
  assert.equal(warning.breakIndex, -1);

  const converted = evaluateZoneLifecycle([
    ...firstTwoCloses,
    { time: 3, open: 99.7, high: 99.9, low: 99, close: 99.2 },
    { time: 4, open: 99.4, high: 100.5, low: 99.2, close: 99.6 }
  ], zone, { convertedKind: 'IFVG' });
  assert.equal(converted.breakIndex, 3);
  assert.equal(converted.inverseConfirmedIndex, 4);
  assert.equal(converted.kind, 'IFVG');
  assert.equal(converted.direction, 'BEARISH');
  assert.equal(converted.status, 'IFVG_CONFIRMED_REACTION');
});

test('causal entry plan is available on all timeframes and always uses a structural target of at least 2R', () => {
  for (const tf of SUPPORTED_MAPPING_TIMEFRAMES) {
    const fixture = entryFixture(tf);
    const result = detectTimeframeEntryMap(fixture.candles, {
      tf,
      marketConcepts: fixture.marketConcepts,
      validatedContext: fixture.validatedContext,
      htfCandles: fixture.htfCandles
    });
    assert.equal(result.supported, true, tf);
    assert.ok(result.activeSetup, tf);
    assert.equal(result.activeSetup.tf, tf);
    assert.equal(result.activeSetup.sourceTf, tf);
    assert.equal(result.activeSetup.triggerTf, tf);
    assert.equal(result.activeSetup.executionMode, 'CAUSAL_ENTRY_MAP_ALL_TF');
    assert.ok(result.activeSetup.targetR >= 2, tf);
    assert.ok(result.activeSetup.tp2 > result.activeSetup.tp1, tf);
    assert.equal(result.scenario.missing.length, 0, tf);
    assert.equal(result.activeSetup.trendFilters.emaStack, true, tf);
    assert.equal(result.activeSetup.trendFilters.context.aligned, true, tf);
  }
});

test('Structural Target diagnosis distinguishes every existing hard-gate failure without changing thresholds', () => {
  const profile = TIMEFRAME_ENTRY_PROFILES.M5;
  const target = level => ({
    type: 'BSL',
    subtype: 'EXTERNAL_SWING',
    tier: 'EXTERNAL_KEY',
    level,
    availableIndex: 10,
    interactionIndex: -1
  });
  const assess = ({ levels, risk = 5, atr = 1 }) => structuralTargetAssessment({
    marketConcepts: { liquidityLevels: levels },
    direction: 'BULLISH',
    entry: 100,
    risk,
    atr,
    triggerIndex: 50,
    profile
  });

  assert.equal(assess({ levels: [] }).code, 'NO TARGET');
  assert.equal(assess({ levels: [target(109)] }).code, 'TARGET < 2R');
  assert.equal(assess({ levels: [target(145)] }).code, 'TARGET > 8R');
  assert.equal(assess({ levels: [target(114)], risk: 7 }).code, 'RISK > 6 ATR');

  const valid = assess({ levels: [target(115)] });
  assert.equal(valid.code, 'TARGET VALID 2R–8R');
  assert.equal(valid.valid, true);
  assert.equal(valid.target.level, 115);
  assert.equal(profile.minimumTargetR, 2);
  assert.equal(profile.maximumTargetR, 8);
  assert.equal(profile.maximumRiskAtr, 6);
});

test('Entry Watch preserves a terminal Causal V3 outcome and locked geometry', () => {
  const setup = {
    executionMode: 'CAUSAL_ENTRY_MAP_ALL_TF',
    live: false,
    lifecycleStatus: 'TP1 / BE',
    timestamp: 1_700_000_000_000,
    entry: 100,
    entryLow: 100,
    entryHigh: 100,
    initialSl: 95,
    sl: 100,
    tp1: 105,
    tp2: 112,
    tp1Hit: true,
    endIndex: 120,
    endTime: 1_700_007_200_000
  };
  const watch = buildCausalEntryWatch({
    setup,
    activeSetup: null,
    scenario: {
      direction: 'BUY',
      status: 'TP1 / BE',
      reason: 'Closed-candle lifecycle terminal.'
    }
  }, 'M5');

  assert.equal(watch.status, 'TP1 / BE');
  assert.equal(watch.lifecycleStage, 'STOPPED');
  assert.equal(watch.active, false);
  assert.equal(watch.entryAllowed, false);
  assert.equal(watch.terminal, true);
  assert.equal(watch.executionPlan.lifecycleStatus, 'TP1 / BE');
  assert.equal(watch.executionPlan.initialSl, 95);
  assert.equal(watch.executionPlan.sl, 100);
  assert.equal(watch.executionPlan.endIndex, 120);
  assert.equal(watch.executionPlan.endTime, 1_700_007_200_000);
});

test('entry trend gates use only HTF candles that were closed by the trigger close', () => {
  const fixture = entryFixture('M5');
  const futureStart = fixture.candles[96].time + timeframeDurationMs('M5') / 1000;
  fixture.htfCandles.H4.push({
    time: futureStart,
    open: 70,
    high: 71,
    low: 49,
    close: 50
  });
  const result = detectTimeframeEntryMap(fixture.candles, {
    tf: 'M5',
    marketConcepts: fixture.marketConcepts,
    validatedContext: fixture.validatedContext,
    htfCandles: fixture.htfCandles
  });
  assert.ok(result.activeSetup);
  assert.notEqual(result.activeSetup.trendFilters.context.candleTime, futureStart);
  assert.equal(result.activeSetup.trendFilters.context.aligned, true);
});

test('opposing HTF bias blocks an otherwise complete M5 entry sequence', () => {
  const fixture = entryFixture('M5');
  fixture.htfCandles.H4 = fixture.htfCandles.H4.map((candle, index) => {
    const close = 110 - index * 0.1;
    return {
      ...candle,
      open: close + 0.1,
      high: close + 0.4,
      low: close - 0.4,
      close
    };
  });
  const result = detectTimeframeEntryMap(fixture.candles, {
    tf: 'M5',
    marketConcepts: fixture.marketConcepts,
    validatedContext: fixture.validatedContext,
    htfCandles: fixture.htfCandles
  });
  assert.equal(result.activeSetup, null);
  assert.ok(result.scenario.missing.includes('HTF ALIGNMENT'));
  assert.equal(result.scenario.trendFilters.context.aligned, false);
});

test('H1 rejects a trigger farther than two ATR from EMA21', () => {
  const fixture = entryFixture('H1');
  const filters = entryTrendFiltersAt(fixture.candles, {
    tf: 'H1',
    index: 96,
    direction: 'BULLISH',
    atr: 0.2,
    htfCandles: fixture.htfCandles
  });
  assert.equal(filters.emaStack, true);
  assert.equal(filters.context.aligned, true);
  assert.ok(filters.emaDistanceAtr > 2);
  assert.equal(filters.emaDistance, false);
  assert.equal(filters.ready, false);
});

test('entry lifecycle is closed-candle causal and moves the stop to break-even only after TP1', () => {
  const profile = TIMEFRAME_ENTRY_PROFILES.H4;
  const plan = createTimeframeEntryPlan({
    tf: 'H4',
    direction: 'BULLISH',
    candle: { time: 100, open: 99, high: 101, low: 98, close: 100 },
    index: 10,
    atr: 2,
    protectedLevel: 97,
    sweep: { type: 'SSL', subtype: 'INTERNAL' },
    mss: { index: 10, scope: 'INTERNAL' },
    target: { type: 'BSL', subtype: 'EXTERNAL', tier: 'EXTERNAL_KEY', level: 110 },
    profile
  });
  assert.ok(plan);
  assert.equal(plan.sl, plan.initialSl);
  advanceTimeframeEntryLifecycle(plan, {
    time: 200,
    open: 100,
    high: plan.tp1 + 0.1,
    low: plan.entry + 0.1,
    close: plan.tp1
  }, 11, profile);
  assert.equal(plan.tp1Hit, true);
  assert.equal(plan.sl, plan.entry);
  assert.equal(plan.live, true);
});

test('single Mapping snapshot is deeply frozen and separates live overlay from closed facts', () => {
  const snapshot = buildMappingSnapshot({
    tf: 'H4',
    price: 105,
    marketConcepts: {
      structure: { trend: 'BULLISH', confirmedTrend: 'BULLISH', events: [] },
      structureSnapshot: {},
      fairValueGaps: [],
      orderBlocks: []
    },
    liquidityHierarchy: { activeTargets: [], swept: [], tolerance: {} },
    validatedMarketContext: {
      source: 'AMY_RULE_BASED_TIMEFRAME_CONTEXT_V3',
      marketState: {},
      directionForecast: {}
    },
    entryMap: {
      source: 'AMY_CAUSAL_ENTRY_MAP_V3',
      scenario: { tf: 'H4', status: 'WAIT' }
    },
    setupExecution: { active: false }
  }, {
    candles: [{ time: 100, open: 99, high: 101, low: 98, close: 100, isClosed: true }],
    livePrice: 105,
    capturedAt: 200
  });
  assert.equal(snapshot.source, 'AMY_MAPPING_SINGLE_AUTHORITY_V3');
  assert.equal(snapshot.data.closedCandleOnly, true);
  assert.equal(snapshot.liveOverlay.mayRewriteClosedCandleFacts, false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.facts), true);
  assert.throws(() => {
    snapshot.facts.structure.trend = 'BEARISH';
  }, TypeError);
});
