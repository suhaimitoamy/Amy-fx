import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/outlook/market-outlook-core.js', import.meta.url),
  'utf8'
);
const outlook = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function candles(start = 4000, direction = 1, count = 80) {
  return Array.from({ length: count }, (_, index) => {
    const open = start + direction * index * 0.8;
    const close = open + direction * 0.5;
    return {
      time: 1_700_000_000 + index * 900,
      open,
      high: Math.max(open, close) + 1.2,
      low: Math.min(open, close) - 1.1,
      close
    };
  });
}

function result(direction = 'BULLISH', price = 4070) {
  const bullish = direction === 'BULLISH';
  return {
    tf: 'M15',
    price,
    final: direction,
    st: {
      trend: direction,
      last: {
        breakType: 'VALID_BREAK',
        valid: true,
        dir: direction,
        kind: 'BOS'
      }
    },
    htfNarrative: { htfBias: direction },
    premiumDiscountZone: bullish ? 'DISCOUNT' : 'PREMIUM',
    dealingRange: { low: 4040, high: 4100, equilibrium: 4070 },
    activeLiquidityTargets: [
      { type: 'BSL', level: 4090, status: 'ACTIVE' },
      { type: 'BSL', level: 4110, status: 'ACTIVE' },
      { type: 'SSL', level: 4050, status: 'ACTIVE' },
      { type: 'SSL', level: 4030, status: 'ACTIVE' }
    ],
    liquidityHierarchy: {
      activeTargets: [
        { type: 'BSL', level: 4090, status: 'ACTIVE' },
        { type: 'BSL', level: 4110, status: 'ACTIVE' },
        { type: 'SSL', level: 4050, status: 'ACTIVE' },
        { type: 'SSL', level: 4030, status: 'ACTIVE' }
      ],
      drawTarget: bullish
        ? { type: 'BSL', level: 4090 }
        : { type: 'SSL', level: 4050 }
    }
  };
}

test('aligned bullish context produces a capped bullish outlook and BSL target', () => {
  const base = result('BULLISH');
  const projection = outlook.buildMarketOutlooks({
    result: base,
    analyses: {
      M15: base,
      M30: result('BULLISH'),
      H1: result('BULLISH'),
      H4: result('BULLISH'),
      D1: result('BULLISH')
    },
    candlesByTf: { M15: candles(4000, 1) },
    price: 4070,
    newsRisk: 'NORMAL',
    freshness: {
      M15: { state: 'FRESH' },
      H1: { state: 'FRESH' },
      H4: { state: 'FRESH' }
    },
    session: { id: 'LONDON', label: 'LONDON ACTIVE' },
    now: 1_800_000_000_000
  });

  assert.equal(projection.outlooks.length, 3);
  assert.equal(projection.outlooks[0].direction, 'BULLISH');
  assert.equal(projection.outlooks[0].primaryTargetType, 'BSL');
  assert.equal(projection.outlooks[0].primaryTarget, 4090);
  assert.ok(projection.outlooks[0].probability <= 76);
  assert.equal(
    projection.outlooks[0].probability
      + projection.outlooks[0].alternativeProbability
      + projection.outlooks[0].invalidationProbability,
    100
  );
});

test('bearish outlook in discount carries a chase-risk warning and lower probability', () => {
  const base = result('BEARISH');
  base.premiumDiscountZone = 'DISCOUNT';
  const projection = outlook.buildMarketOutlooks({
    result: base,
    analyses: {
      M15: base,
      M30: result('BEARISH'),
      H1: result('BEARISH'),
      H4: result('BEARISH'),
      D1: result('BEARISH')
    },
    candlesByTf: { M15: candles(4100, -1) },
    price: 4070,
    newsRisk: 'NORMAL',
    freshness: {
      M15: { state: 'FRESH' },
      H1: { state: 'FRESH' },
      H4: { state: 'FRESH' }
    },
    session: { id: 'ASIA', label: 'ASIA ACTIVE' },
    now: 1_800_000_000_000
  });

  const first = projection.outlooks[0];
  assert.equal(first.direction, 'BEARISH');
  assert.ok(first.risks.some(item => item.toLowerCase().includes('discount')));
  assert.ok(first.probability < 76);
});

test('mixed timeframe structure produces range or reduced directional confidence', () => {
  const base = result('BULLISH');
  const projection = outlook.buildMarketOutlooks({
    result: base,
    analyses: {
      M15: result('BULLISH'),
      M30: result('BEARISH'),
      H1: result('BULLISH'),
      H4: result('BEARISH'),
      D1: { ...result('BULLISH'), st: { trend: 'NEUTRAL', last: null }, final: 'NEUTRAL' }
    },
    candlesByTf: { M15: candles(4070, 0) },
    price: 4070,
    newsRisk: 'ELEVATED',
    freshness: {
      M15: { state: 'FRESH' },
      H1: { state: 'FRESH' },
      H4: { state: 'FRESH' }
    },
    session: { id: 'OFF_SESSION', label: 'OFF-SESSION' },
    now: 1_800_000_000_000
  });

  assert.ok(['RANGE', 'BULLISH', 'BEARISH'].includes(projection.outlooks[0].direction));
  assert.ok(projection.outlooks[0].probability <= 65);
});

test('prediction tracker resolves bullish target before invalidation', () => {
  const createdAt = 1_700_000_000_000;
  const history = [{
    id: 'x',
    slot: 'x',
    horizonId: 'INTRADAY',
    horizonLabel: '1–4 Jam',
    createdAt,
    expiresAt: createdAt + 4 * 60 * 60 * 1000,
    startPrice: 4070,
    direction: 'BULLISH',
    probability: 60,
    target: 4080,
    invalidation: 4060,
    status: 'PENDING',
    maxHigh: 4070,
    minLow: 4070
  }];
  const candlesByTf = {
    M1: [
      { time: (createdAt + 60_000) / 1000, high: 4075, low: 4068, close: 4074 },
      { time: (createdAt + 120_000) / 1000, high: 4081, low: 4072, close: 4080 }
    ]
  };
  const evaluated = outlook.evaluatePredictionHistory(history, {
    candlesByTf,
    livePrice: 4080,
    now: createdAt + 180_000
  });
  assert.equal(evaluated[0].status, 'RESOLVED');
  assert.equal(evaluated[0].outcome, 'TARGET_HIT');
  assert.equal(evaluated[0].directionCorrect, true);
});

test('tracker hides accuracy readiness until minimum sample size', () => {
  const history = Array.from({ length: 19 }, (_, index) => ({
    id: String(index),
    horizonId: 'INTRADAY',
    status: 'RESOLVED',
    directionCorrect: true,
    targetHit: index % 2 === 0,
    invalidated: false,
    resolvedAt: index
  }));
  const stats = outlook.predictionStats(history, 20);
  assert.equal(stats.overall.ready, false);
  assert.equal(stats.overall.needed, 1);

  const ready = outlook.predictionStats([
    ...history,
    {
      id: '20',
      horizonId: 'INTRADAY',
      status: 'RESOLVED',
      directionCorrect: false,
      targetHit: false,
      invalidated: true,
      resolvedAt: 20
    }
  ], 20);
  assert.equal(ready.overall.ready, true);
  assert.equal(ready.overall.count, 20);
});
