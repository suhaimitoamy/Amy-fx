import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileBt71MarketState } from '../app/src/main/assets/apps/mapping/js/engine/bt71-market-state-reconciliation.js';

const context = (marketState = {}) => ({
  version: '2.0.0',
  marketState,
  directionForecast: { active: true, direction: 'BEARISH', directionValue: -1 },
  isolation: { regimeMayOverrideDirectionForecast: false }
});

test('BT7.1 promotes objective bullish structure and keeps forecast untouched', () => {
  const result = reconcileBt71MarketState(context({
    state: 'RANGE / TRANSITION', direction: 'NEUTRAL', directionValue: 0
  }), {
    objectiveStructure: { confirmedTrend: 'BULLISH', localTrend: 'BEARISH' },
    objectiveStructureSnapshot: { protectedLow: 100 },
    close: 110
  });
  assert.equal(result.marketState.direction, 'BULLISH');
  assert.equal(result.marketState.state, 'BULLISH PULLBACK');
  assert.equal(result.marketState.phase, 'PULLBACK');
  assert.equal(result.directionForecast.direction, 'BEARISH');
  assert.equal(result.directionForecast.directionValue, -1);
  assert.equal(result.isolation.marketStateMayOverrideDirectionForecast, false);
});

test('BT7.1 separates continuation from direction', () => {
  const result = reconcileBt71MarketState(context({
    state: 'BULLISH TRANSITION', direction: 'NEUTRAL', directionValue: 0
  }), {
    objectiveStructure: { trend: 'BULLISH', confirmedTrend: 'BULLISH', localTrend: 'BULLISH' },
    objectiveStructureSnapshot: { protectedLow: 90 },
    close: 110
  });
  assert.equal(result.marketState.directionValue, 1);
  assert.equal(result.marketState.state, 'UPTREND CONFIRMED');
  assert.equal(result.marketState.phase, 'CONTINUATION');
  assert.equal(result.marketState.confirmed, true);
});

test('BT7.1 exposes directional transition without claiming confirmation', () => {
  const result = reconcileBt71MarketState(context({ state: 'RANGE / TRANSITION' }), {
    objectiveStructure: {
      trend: 'NEUTRAL', confirmedTrend: 'NEUTRAL', localTrend: 'BEARISH', transitionDirection: 'BEARISH'
    },
    close: 100
  });
  assert.equal(result.marketState.directionValue, -1);
  assert.equal(result.marketState.state, 'BEARISH TRANSITION');
  assert.equal(result.marketState.phase, 'TRANSITION');
  assert.equal(result.marketState.confirmed, false);
});

test('BT7.1 invalidates displayed direction after protected swing breaks', () => {
  const result = reconcileBt71MarketState(context({
    state: 'UPTREND CONFIRMED', direction: 'BULLISH', directionValue: 1
  }), {
    objectiveStructure: { trend: 'BULLISH', confirmedTrend: 'BULLISH', localTrend: 'BULLISH' },
    objectiveStructureSnapshot: { protectedLow: 105 },
    close: 100
  });
  assert.equal(result.marketState.directionValue, 0);
  assert.equal(result.marketState.state, 'RANGE / TRANSITION');
  assert.equal(result.marketState.protectedSwingIntact, false);
});

test('concept analyzer no longer lets BT7.1 reconcile or override Amy-SMC-D Mapping', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = fs.readFileSync(
    path.join(root, 'app/src/main/assets/apps/mapping/js/engine/concept-analyze.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /reconcileBt71MarketState/);
  assert.match(source, /replayAmySmcD/);
  assert.match(source, /mappingSource:\s*'AMY_SMC_D'/);
  assert.match(source, /directionalAuthority:\s*true/);
});
