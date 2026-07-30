import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFvgConcepts } from '../app/src/main/assets/apps/mapping/js/engine/concept-fvg.js';
import { obCreatedImbalance } from '../app/src/main/assets/apps/mapping/js/engine/concept-ob-helpers.js';
import { detectOrderBlockConcepts } from '../app/src/main/assets/apps/mapping/js/engine/concept-ob.js';

const candle = (open, high, low, close, time) => ({ time, open, high, low, close });

function filteredFvgSeed() {
  const values = Array.from({ length: 20 }, (_, index) =>
    candle(100, 100.5, 99.5, index % 2 ? 99.9 : 100.1, index)
  );
  values.push(candle(100, 100.5, 99.5, 100.1, 20));
  values.push(candle(100.1, 100.6, 99.8, 100.2, 21));
  values.push(candle(100.8, 102.5, 100.7, 102.2, 22));
  return values;
}

function filteredObSeed() {
  const values = Array.from({ length: 21 }, (_, index) =>
    candle(100, 100.5, 99.5, index % 2 ? 99.9 : 100.1, index)
  );
  values.push(candle(101, 101.2, 100.2, 100.5, 21));
  values.push(candle(100.5, 103, 100.4, 102.8, 22));
  return values;
}

test('FVG needs a 1.2× previous-20-body displacement and a 0.15–0.75 ATR gap', () => {
  const zones = detectFvgConcepts(filteredFvgSeed(), { currentPrice: 102.2 });
  assert.equal(zones.length, 1);
  assert.equal(zones[0].bottom, 100.5);
  assert.equal(zones[0].top, 100.7);
  assert.equal(zones[0].displacementIndex, 22);
  assert.ok(zones[0].bodyMeanMultiple >= 1.2);
  assert.ok(zones[0].widthAtr >= 0.15);
  assert.ok(zones[0].widthAtr <= 0.75);
});

test('full wick mitigation is preserved as terminal history and does not self-convert', () => {
  const values = filteredFvgSeed();
  values.push(candle(101, 101.1, 100.4, 100.6, 23));
  const zones = detectFvgConcepts(values, { currentPrice: 100.6 });
  assert.equal(zones.length, 1);
  assert.equal(zones[0].status, 'MITIGATED');
  assert.equal(zones[0].active, false);
  assert.equal(zones[0].converted, false);
});

test('Order Block requires the immediate opposite origin and a 2× mean-body displaced break', () => {
  const values = filteredObSeed();
  const structure = {
    structureEvents: [{
      index: 22,
      direction: 'BULLISH',
      concept: 'MSS',
      scope: 'MAJOR',
      valid: true,
      status: 'CONFIRMED_BREAK',
      hasDisplacement: true
    }]
  };
  const zones = detectOrderBlockConcepts(values, structure, { htfCandles: {}, currentPrice: 102.8 });
  assert.equal(zones.length, 1);
  assert.equal(zones[0].bottom, 100.2);
  assert.equal(zones[0].top, 101);
  assert.equal(zones[0].originIndex, 21);
  assert.equal(zones[0].availableIndex, 22);
  assert.equal(zones[0].structureBreakIndex, 22);
  assert.ok(zones[0].impulseMultiple >= 2);
  assert.equal(zones[0].createdImbalance, false);
  assert.equal(zones[0].htfAligned, false);
});

test('Order Block does not fall back to an older opposite candle', () => {
  const values = filteredObSeed();
  values[21] = candle(100.2, 101.2, 100, 101, 21);
  const structure = {
    structureEvents: [{
      index: 22,
      direction: 'BULLISH',
      concept: 'MSS',
      scope: 'MAJOR',
      valid: true,
      status: 'CONFIRMED_BREAK',
      hasDisplacement: true
    }]
  };
  assert.equal(detectOrderBlockConcepts(values, structure, { currentPrice: 102.8 }).length, 0);
});

test('OB imbalance metadata never reads candles after the structure break', () => {
  const values = [
    candle(100, 102, 99, 101, 0),
    candle(101, 103, 100, 102, 1),
    candle(102, 103, 101, 102.5, 2),
    candle(104, 105, 104, 105, 3)
  ];
  assert.equal(obCreatedImbalance(values, 0, 2, 'BULLISH'), false);
});
