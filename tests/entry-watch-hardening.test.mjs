import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrozenExecutionPlan,
  candidateStillActive,
  hardenEntryWatch,
  setupFromHardenedWatch
} from '../app/src/main/assets/apps/mapping/js/engine/entry-watch-hardening.js';
import { balancedH1ForecastCandidate } from '../app/src/main/assets/apps/mapping/js/engine/validated-market-context-balanced.js';

function triggeredWatch(overrides = {}) {
  return {
    id: 'ENTRY_WATCH:M15:FVG:BUY:test',
    sourceId: 'fvg-1',
    sourceTf: 'M15',
    triggerTf: 'M5',
    sourceKind: 'FVG',
    sourceLabel: 'FVG',
    direction: 'BUY',
    bottom: 2300,
    top: 2302,
    level: 2300,
    atr: 10,
    active: true,
    terminal: false,
    entryAllowed: true,
    lifecycleStage: 'ENTRY_TRIGGERED',
    entryPrice: 2301,
    entryTime: 1_700_000_000,
    entryCloseTime: 1_700_000_300,
    ...overrides
  };
}

function activeConcepts() {
  return {
    M15: {
      fairValueGaps: [{ id: 'fvg-1', bottom: 2300, top: 2302, status: 'DETECTED', active: true }],
      orderBlocks: [],
      liquidityLevels: []
    }
  };
}

test('entry timestamp is moved from trigger open to confirmed close', () => {
  const hardened = hardenEntryWatch({ watch: triggeredWatch(), conceptsByTf: activeConcepts(), direction: 'BUY' });
  assert.equal(hardened.triggerCandleOpenTime, 1_700_000_000);
  assert.equal(hardened.entryTime, 1_700_000_300);
  assert.equal(hardened.entryConfirmedAt, 1_700_000_300);
});

test('execution geometry is frozen from entry close and does not depend on later live price', () => {
  const watch = triggeredWatch();
  const first = buildFrozenExecutionPlan(watch);
  const second = buildFrozenExecutionPlan({ ...watch, executionPlan: first, entryPrice: 2500 });
  assert.deepEqual(second, first);
  assert.equal(first.entry, 2301);
  assert.ok(first.entryLow < first.entryHigh);
  assert.ok(first.sl < first.entryLow);
  assert.ok(first.tp1 > first.entryHigh);
  assert.ok(first.tp2 > first.tp1);
});

test('WAIT forecast forcibly disables an already-triggered BUY/SELL state', () => {
  const paused = hardenEntryWatch({ watch: triggeredWatch(), conceptsByTf: activeConcepts(), direction: 'WAIT' });
  assert.equal(paused.lifecycleStage, 'FORECAST_PAUSED');
  assert.equal(paused.entryAllowed, false);
  assert.equal(paused.active, false);
});

test('source removed by detector retires the level before entry is accepted', () => {
  const retired = hardenEntryWatch({
    watch: triggeredWatch(),
    conceptsByTf: { M15: { fairValueGaps: [], orderBlocks: [], liquidityLevels: [] } },
    direction: 'BUY'
  });
  assert.equal(retired.lifecycleStage, 'LEVEL_RETIRED');
  assert.equal(retired.entryAllowed, false);
  assert.equal(retired.terminal, true);
});

test('active detector source remains eligible and creates one locked setup', () => {
  const hardened = hardenEntryWatch({ watch: triggeredWatch(), conceptsByTf: activeConcepts(), direction: 'BUY' });
  assert.equal(candidateStillActive(hardened, activeConcepts()), true);
  const setup = setupFromHardenedWatch(hardened);
  assert.equal(setup.timestamp, 1_700_000_300_000);
  assert.equal(setup.entryStyle, 'MULTI_TF_LEVEL_SWEEP_LOCKED');
  assert.equal(setup.entry, 2301);
});

test('H1 bearish forecast uses the mirrored bullish conditions', () => {
  const bearish = balancedH1ForecastCandidate({
    rawBreakBear: true,
    htfBearConfirmed: true,
    priceBear: true,
    momentum3Atr: -1.2
  });
  assert.equal(bearish.directionValue, -1);
  assert.equal(bearish.direction, 'BEARISH');
  assert.equal(bearish.bearishTrigger, true);
});

test('H1 overextended bearish momentum is rejected symmetrically', () => {
  const bearish = balancedH1ForecastCandidate({
    rawBreakBear: true,
    htfBearConfirmed: true,
    priceBear: true,
    momentum3Atr: -3.1
  });
  assert.equal(bearish.directionValue, 0);
});
