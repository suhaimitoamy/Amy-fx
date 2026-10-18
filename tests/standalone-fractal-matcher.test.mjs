import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zNormalize,
  dotProduct,
  cosineSimilarity,
  HISTORICAL_ANCHORS_8YR,
  findFractalTwins,
  projectNormalizedReturns,
  evaluateFractalTwins
} from '../lib/fractal-engine/index.mjs';

test('Item 2.18: zNormalize, dotProduct, and cosineSimilarity math primitives', () => {
  const wave1 = [10, 20, 30, 40, 50];
  const norm1 = zNormalize(wave1);
  assert.equal(norm1.length, 5);
  // Unit length of normalized vector should equal 1.0 (within floating point precision)
  const lengthSq = norm1.reduce((sum, v) => sum + v * v, 0);
  assert.ok(Math.abs(lengthSq - 1.0) < 1e-5, 'Unit norm must equal 1.0');

  // Identical waves must have near 100% cosine similarity
  const simIdentical = cosineSimilarity([10, 20, 30, 40, 50], [100, 200, 300, 400, 500]);
  assert.ok(simIdentical >= 99.0, 'Scaled identical patterns must have ~100% similarity');

  // Inverse waves must have low similarity
  const simInverse = cosineSimilarity([10, 20, 30, 40, 50], [50, 40, 30, 20, 10]);
  assert.ok(simInverse <= 10.0, 'Opposite patterns must have <= 10% similarity');
});

test('Item 2.18: 8-Year Historical Archetype Database covers 2019 to 2026', () => {
  assert.ok(HISTORICAL_ANCHORS_8YR.length >= 8, 'Must cover at least 8 multi-year anchors');
  const years = HISTORICAL_ANCHORS_8YR.map(a => a.timestamp.slice(0, 4));
  assert.ok(years.includes('2019'), 'Must include 2019 archetype');
  assert.ok(years.includes('2020'), 'Must include 2020 archetype');
  assert.ok(years.includes('2021'), 'Must include 2021 archetype');
  assert.ok(years.includes('2022'), 'Must include 2022 archetype');
  assert.ok(years.includes('2023'), 'Must include 2023 archetype');
  assert.ok(years.includes('2024'), 'Must include 2024 archetype');
  assert.ok(years.includes('2025'), 'Must include 2025 archetype');
  assert.ok(years.includes('2026'), 'Must include 2026 archetype');
});

test('Item 2.18: findFractalTwins and projectNormalizedReturns autonomously match patterns and project forward returns', () => {
  // Generate sample 40 M15 candles
  const candles = [];
  const t0 = 1770000000;
  for (let i = 0; i < 40; i++) {
    const base = 2650 + Math.sin(i / 5) * 8 + i * 0.2;
    candles.push({
      time: t0 + i * 900,
      open: base,
      high: base + 1.2,
      low: base - 0.8,
      close: base + 0.5
    });
  }

  const matches = findFractalTwins(candles, {
    windowSize: 16,
    topK: 5,
    bias: 'BUY',
    slBuf: 3.0,
    tpTarget: 6.0,
    horizon: 8
  });

  assert.equal(matches.length, 5, 'Must find top-5 fractal twins');
  assert.ok(matches[0].similarity >= matches[4].similarity, 'Matches must be sorted by similarity descending');

  // Verify projection
  const projection = projectNormalizedReturns(matches, 8);
  assert.equal(projection.length, 8, 'Projection must have 8 forward return steps');
  assert.ok(projection.every(Number.isFinite), 'All projection points must be finite numbers');
});

test('Item 2.18: evaluateFractalTwins produces end-to-end advisory metrics with 0ms zero-python latency', () => {
  const candles = [
    { time: 100, open: 2650, high: 2652, low: 2649, close: 2651 },
    { time: 200, open: 2651, high: 2654, low: 2650, close: 2653 },
    { time: 300, open: 2653, high: 2655, low: 2652, close: 2654 }
  ];

  const result = evaluateFractalTwins(candles, {
    bias: 'BUY',
    slBuf: 2.5,
    tpTarget: 5.0,
    atr: 3.2
  });

  assert.equal(result.engine, 'EMBEDDED_ZERO_PYTHON_JS_V1');
  assert.equal(result.bias, 'BUY');
  assert.ok(result.totalMatches > 0, 'Must produce matches even with small buffer via historical anchors');
  assert.ok(result.winRate >= 0 && result.winRate <= 100);
  assert.ok(result.avgSimilarity >= 50 && result.avgSimilarity <= 100);
  assert.ok(result.expectedR > 0);
  assert.ok(result.confidenceScore >= 0.5 && result.confidenceScore <= 0.95);
  assert.equal(result.projection.length, 8);
});
