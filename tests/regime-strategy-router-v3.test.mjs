import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMarketRegimeV2 } from '../app/src/main/assets/apps/mapping/js/engine/market-regime-engine.js';
import { stabilizeRegime } from '../app/src/main/assets/apps/mapping/js/engine/regime-state-machine.js';
import { routeRegimeStrategy } from '../app/src/main/assets/apps/mapping/js/engine/strategy-router-engine.js';
import { setupContract } from '../app/src/main/assets/apps/mapping/js/engine/strategies/strategy-common.js';
import { deriveLiquidityContext } from '../app/src/main/assets/apps/mapping/js/engine/market-intent-engine.js';
import { isActionableSetup } from '../app/src/main/assets/apps/mapping/js/integrity/mapping-integrity-core.js';

function trending(count = 260, direction = 1) {
  const output = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const drift = direction * (0.35 + Math.sin(index / 8) * 0.03);
    const open = price;
    const close = open + drift;
    output.push({ time: index * 900, open, high: Math.max(open, close) + 0.12, low: Math.min(open, close) - 0.10, close });
    price = close;
  }
  return output;
}

function ranging(count = 260) {
  const output = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const close = 2000 + Math.sin(index / 2.3) * 1.5;
    const open = price;
    output.push({ time: index * 900, open, high: Math.max(open, close) + 0.65, low: Math.min(open, close) - 0.65, close });
    price = close;
  }
  return output;
}

function expansion() {
  const output = ranging(259);
  const open = output.at(-1).close;
  const close = open + 8;
  output.push({ time: 259 * 900, open, high: close + 0.4, low: open - 0.2, close });
  return output;
}

function resultFor(candles, direction = 'BULLISH') {
  const price = candles.at(-1).close;
  return {
    tf: 'M15',
    price,
    htfBiases: { H1: direction, H4: direction, D1: direction },
    st: { trend: direction, confirmedTrend: direction },
    marketConcepts: {
      structure: { trend: direction, confirmedTrend: direction },
      liquidityHierarchy: { activeTargets: [
        { type: 'BSL', label: 'PDH', level: price + 10, status: 'DETECTED' },
        { type: 'SSL', label: 'PDL', level: price - 10, status: 'DETECTED' }
      ] },
      nearestOrderBlocks: [],
      nearestFairValueGaps: []
    },
    entryMap: { activeSetup: null, setup: null },
    setups: [],
    bestSetup: null
  };
}

test('classifier separates trend, range and expansion personalities', () => {
  const trend = detectMarketRegimeV2({ candles: trending(), htfBiases: { H1: 'BULLISH', H4: 'BULLISH', D1: 'BULLISH' } });
  const range = detectMarketRegimeV2({ candles: ranging(), htfBiases: { H1: 'NEUTRAL' } });
  const expand = detectMarketRegimeV2({ candles: expansion(), htfBiases: { H1: 'NEUTRAL' } });
  assert.equal(trend.regime, 'TRENDING');
  assert.equal(range.regime, 'RANGING');
  assert.equal(expand.regime, 'EXPANSION');
  assert.equal(Object.values(trend.probabilities).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(trend.confidenceMeaning, 'REGIME_CLARITY_SCORE_NOT_WIN_PROBABILITY');
});

test('sweep plus reversal structure becomes manipulation', () => {
  const candles = ranging();
  const result = detectMarketRegimeV2({
    candles,
    marketConcepts: {
      latestConfirmedSweep: { index: candles.length - 2, type: 'SSL', reclaimDepthAtr: 0.6 },
      structure: {
        confirmedTrend: 'NEUTRAL',
        lastSweep: { index: candles.length - 2, type: 'SSL' },
        lastEvent: { index: candles.length - 1, kind: 'MSS', dir: 'BULLISH', valid: true, breakType: 'VALID_BREAK', hasDisplacement: true }
      }
    }
  });
  assert.equal(result.regime, 'MANIPULATION');
  assert.ok(result.health.manipulationRisk >= 40);
});

test('failed opposite transition blocks strategy selection', () => {
  const candles = trending();
  const result = detectMarketRegimeV2({
    candles,
    htfBiases: { H1: 'BULLISH', H4: 'BULLISH' },
    marketConcepts: { structure: {
      confirmedTrend: 'BULLISH',
      lastSweep: { index: candles.length - 2, type: 'SSL' },
      lastFailedBreak: { index: candles.length - 1 },
      transitionBreak: { index: candles.length - 1, dir: 'BEARISH' },
      lastEvent: { index: candles.length - 1, bodyRatio: 0.2, penetrationAtr: 0.2 }
    } }
  });
  const router = routeRegimeStrategy({ candles, result: resultFor(candles), regime: result });
  assert.equal(result.regime, 'TRANSITION');
  assert.equal(router.activeStrategy, 'NO_TRADE');
  assert.equal(router.blocked, true);
  assert.equal(router.setup, null);
});

test('router enables exactly one engine for each clear regime', () => {
  const fixtures = [
    ['TRENDING', trending(), { H1: 'BULLISH', H4: 'BULLISH', D1: 'BULLISH' }, 'TREND_PULLBACK'],
    ['RANGING', ranging(), { H1: 'NEUTRAL' }, 'RANGE_MEAN_REVERSION'],
    ['EXPANSION', expansion(), { H1: 'NEUTRAL' }, 'BREAKOUT_CONTINUATION']
  ];
  for (const [expectedRegime, candles, htfBiases, expectedEngine] of fixtures) {
    const regime = detectMarketRegimeV2({ candles, htfBiases });
    const router = routeRegimeStrategy({ candles, result: resultFor(candles, expectedRegime === 'TRENDING' ? 'BULLISH' : 'NEUTRAL'), regime });
    assert.equal(regime.regime, expectedRegime);
    assert.equal(router.activeStrategy, expectedEngine);
    assert.equal(Object.values(router.engines).filter(engine => engine.enabled).length, 1);
    assert.equal(router.safety.automaticTradeExecution, false);
  }
});

test('regime state machine requires persistence before ordinary switch', () => {
  const first = stabilizeRegime({ regime: 'TRENDING', calculatedAt: 100, probabilities: { TRENDING: 70, RANGING: 10, MANIPULATION: 5, EXPANSION: 10, TRANSITION: 5 }, shift: { risk: 5 } }, null);
  const candidate = stabilizeRegime({ regime: 'RANGING', calculatedAt: 200, probabilities: { TRENDING: 15, RANGING: 55, MANIPULATION: 10, EXPANSION: 10, TRANSITION: 10 }, shift: { risk: 10 } }, first);
  const confirmed = stabilizeRegime({ regime: 'RANGING', calculatedAt: 300, probabilities: { TRENDING: 12, RANGING: 58, MANIPULATION: 10, EXPANSION: 10, TRANSITION: 10 }, shift: { risk: 10 } }, candidate);
  assert.equal(first.activeRegime, 'TRENDING');
  assert.equal(candidate.activeRegime, 'TRENDING');
  assert.equal(confirmed.activeRegime, 'RANGING');
});

test('regime-routed setup is accepted by integrity with minimum 1.5R', () => {
  const setup = setupContract({ id: 'test', type: 'TREND PULLBACK', strategy: 'TREND_PULLBACK', direction: 1, entry: 2000, stop: 1998, targetR: 1.5, quality: 75, status: 'READY', timestamp: Date.now() });
  assert.equal(isActionableSetup(setup, Date.now(), 2000), true);
  setup.conflictCheck.rr = 1.49;
  assert.equal(isActionableSetup(setup, Date.now(), 2000), false);
});

test('liquidity context never converts destination into buy or sell', () => {
  const candles = trending();
  const result = resultFor(candles);
  const context = deriveLiquidityContext({ result, regime: { features: { htfScore: 1 } }, candles });
  assert.equal(context.status, 'READY');
  assert.match(context.warning, /bukan BUY/);
  assert.doesNotMatch(context.statement, /\bBUY\b|\bSELL\b/);
});

test('Preview separates Dashboard authority from Analyze experiments', () => {
  const ui = readFileSync(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /DASHBOARD · RINGKASAN KLAIM TERVALIDASI/);
  assert.match(ui, /AKURASI KLAIM FITUR/);
  assert.match(ui, /REGIME EKSPERIMENTAL/);
  assert.match(ui, /STRATEGY ROUTER/);
  assert.match(ui, /Nearest Liquidity/);
  assert.match(ui, /BSL\/SSL bukan BUY\/SELL|tetap bukan sinyal entry/);
  assert.doesNotMatch(ui, /NAIK KE BSL|TURUN KE SSL/);
});
