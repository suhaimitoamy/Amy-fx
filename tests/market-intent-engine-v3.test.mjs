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
    rows.push({
      time: index * 900,
      open,
      high: Math.max(open, close) + 0.18,
      low: Math.min(open, close) - 0.18,
      close,
      isClosed: true
    });
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
  const context = deriveLiquidityContext({
    result: resultFor(),
    regime: { features: { htfScore: 1 } },
    candles: candles()
  });
  assert.equal(context.status, 'READY');
  assert.ok(context.nearestLiquidity);
  assert.equal(context.htfAlignedLiquidity.type, 'BSL');
  assert.match(context.warning, /BSL-first bukan BUY/);
});

test('liquidity context does not generate direction or trade decision', () => {
  const context = deriveLiquidityContext({
    result: resultFor(),
    regime: { features: { htfScore: 1 } },
    candles: candles()
  });
  assert.equal('direction' in context, false);
  assert.equal('decision' in context, false);
  assert.doesNotMatch(context.statement, /\bBUY\b|\bSELL\b/);
});

test('Market Intent uses closed candles and never rerenders from live price ticks', () => {
  const ui = readFileSync(
    new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url),
    'utf8'
  );
  assert.match(ui, /function closedCandlePrice/);
  assert.match(ui, /function closedCandleFingerprint/);
  assert.match(ui, /M15 CANDLE TERTUTUP/);
  assert.match(ui, /amyfx:mapping-state-change/);
  assert.match(ui, /amyfx:candles-updated/);
  assert.doesNotMatch(ui, /setInterval\s*\(/);
  assert.doesNotMatch(ui, /document\.addEventListener\('click',\s*\(\)\s*=>\s*schedule/);
  assert.doesNotMatch(ui, /price:\s*Number\(state\.price/);
  assert.doesNotMatch(ui, /current\.outerHTML\s*=/);
});

test('Preview Market Intent keeps a professional closed-candle hierarchy', () => {
  const ui = readFileSync(
    new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url),
    'utf8'
  );
  assert.match(ui, /AMY FX · MARKET INTELLIGENCE/);
  assert.match(ui, /RINGKASAN MARKET/);
  assert.match(ui, /Konteks Market Lanjutan/);
  assert.match(ui, /TARGET TERDEKAT/);
  assert.match(ui, /TARGET TIMEFRAME BESAR/);
  assert.match(ui, /data-market-intent-ready/);
  assert.doesNotMatch(ui, /NAIK KE BSL|TURUN KE SSL|Market mau ke mana\?/);
});
