import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMarketIntent } from '../app/src/main/assets/apps/mapping/js/engine/market-intent-engine.js';

function candles(direction = 1, count = 160) {
  const rows = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const open = price;
    const close = open + direction * 0.22;
    rows.push({ time: index * 900, open, high: Math.max(open, close) + 0.18, low: Math.min(open, close) - 0.18, close });
    price = close;
  }
  return rows;
}

function resultFor(direction = 1) {
  const price = direction > 0 ? 2035 : 1965;
  return {
    price,
    st: { confirmedTrend: direction > 0 ? 'BULLISH' : 'BEARISH' },
    bestSetup: { dir: direction > 0 ? 'BUY' : 'SELL', tf: 'M15', live: true, lifecycle: { live: true } },
    marketConcepts: {
      liquidityHierarchy: {
        activeTargets: [
          { type: 'BSL', label: 'PDH', level: 2045, strength: 'STRONG', source: 'PREVIOUS_DAY' },
          { type: 'SSL', label: 'PDL', level: 1955, strength: 'STRONG', source: 'PREVIOUS_DAY' }
        ]
      },
      latestConfirmedSweep: direction > 0
        ? { type: 'SSL', level: 2028 }
        : { type: 'BSL', level: 1972 },
      nearestOrderBlocks: [{ direction: direction > 0 ? 'BULLISH' : 'BEARISH', bottom: price - 2, top: price - 1, kind: 'OB', status: 'ACTIVE' }],
      nearestFairValueGaps: []
    }
  };
}

function regime(direction = 1, name = 'TRENDING') {
  return {
    regime: name,
    confidence: 68,
    shift: { risk: 16 },
    features: { atr: 3, htfScore: direction, htfConsensus: 0.9, emaSlopeAtr: direction, rangeLocation: 0.5, dataRisk: 0 }
  };
}

test('bullish context selects BSL and builds visible path', () => {
  const output = deriveMarketIntent({ result: resultFor(1), regime: regime(1), candles: candles(1) });
  assert.equal(output.status, 'READY');
  assert.equal(output.direction, 'BULLISH');
  assert.equal(output.primary.type, 'BSL');
  assert.match(output.headline, /BSL/);
  assert.ok(output.path.some(step => step.includes(output.primary.label)));
  assert.ok(output.confidence <= 89);
});

test('bearish context selects SSL', () => {
  const output = deriveMarketIntent({ result: resultFor(-1), regime: regime(-1), candles: candles(-1) });
  assert.equal(output.direction, 'BEARISH');
  assert.equal(output.primary.type, 'SSL');
  assert.match(output.decision, /SELL/);
});

test('transition regime does not claim immediate entry', () => {
  const output = deriveMarketIntent({ result: resultFor(1), regime: regime(1, 'TRANSITION'), candles: candles(1) });
  assert.match(output.decision, /WAIT/);
  assert.ok(output.path[0].includes('Tunggu'));
});

test('local range fallback still provides objectives', () => {
  const source = candles(1);
  const result = { price: source.at(-1).close, st: { confirmedTrend: 'BULLISH' }, marketConcepts: { liquidityHierarchy: { activeTargets: [] } } };
  const output = deriveMarketIntent({ result, regime: regime(1), candles: source });
  assert.equal(output.status, 'READY');
  assert.ok(output.primary);
});

test('preview UI exposes the requested market intent sections', () => {
  const ui = readFileSync(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /Market mau ke mana\?/);
  assert.match(ui, /PRIMARY LIQUIDITY OBJECTIVE/);
  assert.match(ui, /EXPECTED PRICE PATH/);
  assert.match(ui, /KEPUTUSAN EKSEKUSI/);
  assert.match(ui, /Muat Analisis M15/);
});
