import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSweepMssFvg } from '../app/src/main/assets/apps/mapping/js/engine/core/setup-model.js';

function fixture(bullish) {
  const candles = Array.from({ length: 20 }, () => ({ open: 100, high: 101, low: 99, close: 100 }));
  candles[10] = bullish
    ? { open: 100, high: 101, low: 97, close: 99.5 }
    : { open: 100, high: 103, low: 99, close: 100.5 };
  return { candles, context: {
    price: 100, eq: bullish ? 101 : 99, bsl: 105, ssl: 95,
    st: { lastConfirmedBreak: { valid: true, breakType: 'VALID_BREAK', dir: bullish ? 'BULLISH' : 'BEARISH', index: 12 } },
    sw: { lows: bullish ? [{ index: 5, low: 98 }] : [], highs: bullish ? [] : [{ index: 5, high: 102 }] },
    htfNarrative: { htfBias: bullish ? 'BULLISH' : 'BEARISH' },
    liquidityHierarchy: { activeTargets: [{ type: bullish ? 'BSL' : 'SSL', level: bullish ? 105 : 95, hierarchy: 'EXTERNAL' }] },
    dealingRange: { currentZone: bullish ? 'DISCOUNT' : 'PREMIUM' },
    fvgs: [{ type: bullish ? 'BULLISH' : 'BEARISH', index: 13, status: 'FRESH', qualityLabel: 'STRONG', qualityScore: 90, bottom: bullish ? 99 : 100, top: bullish ? 100 : 101 }]
  } };
}

for (const bullish of [true, false]) {
  test(`${bullish ? 'BUY' : 'SELL'} FVG model keeps its geometry without falsely attributing a Sniper trade`, () => {
    const { candles, context } = fixture(bullish);
    const setup = modelSweepMssFvg(candles, 'M15', context);
    assert.ok(setup);
    assert.equal(setup.type, 'SWEEP_MSS_FVG');
    assert.equal(setup.entryLow, context.fvgs[0].bottom);
    assert.equal(setup.entryHigh, context.fvgs[0].top);
    assert.equal(setup.tp1, context.eq);
    assert.equal(setup.tp2, bullish ? 105 : 95);
    assert.ok(bullish ? setup.sl < 97 : setup.sl > 103);
    assert.equal(setup.components.sweepIndex, 10);
    assert.equal(setup.components.mssIndex, 12);
    assert.equal(setup.components.fvgIndex, 13);
    assert.equal(setup.components.model, 'Sweep → MSS → FVG');
    assert.equal(setup.components.entry, 'FVG STRONG');
    for (const key of ['driverId', 'driverName', 'fibEntry', 'quickScalpRR']) {
      assert.equal(Object.hasOwn(setup.components, key), false, `${key} would misrepresent an unimplemented driver`);
    }
  });
}
