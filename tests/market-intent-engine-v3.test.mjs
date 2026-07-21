import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLiquidityContext } from '../app/src/main/assets/apps/mapping/js/engine/market-intent-engine.js';

function candles(count = 180) {
  const rows = [];
  let price = 2000;
  for (let index = 0; index < count; index += 1) {
    const open = price;
    const close = open + 0.10;
    rows.push({ time: index * 900, open, high: Math.max(open, close) + 0.18, low: Math.min(open, close) - 0.18, close });
    price = close;
  }
  return rows;
}

function resultFor() {
  return {
    price: 2018,
    htfNarrative: { htfBias: 'BULLISH' },
    marketConcepts: { liquidityHierarchy: { activeTargets: [
      { type: 'BSL', label: 'PDH', level: 2028, strength: 'STRONG' },
      { type: 'SSL', label: 'PDL', level: 2008, strength: 'STRONG' }
    ] } }
  };
}

test('liquidity context separates nearest and HTF aligned target', () => {
  const context = deriveLiquidityContext({ result: resultFor(), regime: { features: { htfScore: 1 } }, candles: candles() });
  assert.equal(context.status, 'READY');
  assert.ok(context.nearestLiquidity);
  assert.equal(context.htfAlignedLiquidity.type, 'BSL');
  assert.match(context.warning, /BSL-first bukan BUY/);
});

test('liquidity context does not generate direction or trade decision', () => {
  const context = deriveLiquidityContext({ result: resultFor(), regime: { features: { htfScore: 1 } }, candles: candles() });
  assert.equal('direction' in context, false);
  assert.equal('decision' in context, false);
  assert.doesNotMatch(context.statement, /\bBUY\b|\bSELL\b/);
});

test('preview UI exposes regime, health, router and neutral liquidity copy', () => {
  const ui = readFileSync(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /Market sedang apa\?/);
  assert.match(ui, /MARKET HEALTH/);
  assert.match(ui, /STRATEGY ROUTER/);
  assert.match(ui, /NEAREST LIQUIDITY/);
  assert.match(ui, /HTF-ALIGNED LIQUIDITY/);
  assert.doesNotMatch(ui, /NAIK KE BSL|TURUN KE SSL|Market mau ke mana\?/);
});
