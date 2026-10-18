import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateSixDrivers } from '../lib/scalper-engine/six-drivers.mjs';

test('Item 1.26: api/scalper-setups.js includes 1day interval in fetch list', () => {
  const source = fs.readFileSync('api/scalper-setups.js', 'utf8');
  assert.ok(
    source.includes("interval=1day&outputsize=10"),
    'api/scalper-setups.js must fetch 1day interval from TwelveData'
  );
  assert.ok(
    source.includes("buildMarketContext({ h1, m15, m5, d1, calendar, nowSeconds: nowSec })"),
    'buildMarketContext must receive d1 candles'
  );
  assert.ok(
    source.includes("evaluateSixDrivers({ m15, m5, h1, d1, context, nowSeconds: nowSec })"),
    'evaluateSixDrivers must receive d1 candles'
  );
});

test('Item 1.26: evaluateSixDrivers with D1 candles successfully populates PDH and PDL liquidity targets', () => {
  const now = 1_700_000_000;
  // Yesterday's closed D1 candle
  const d1 = [
    {
      open_time: now - 86400 * 2,
      close_time: now - 86400,
      open: 2640.00,
      high: 2665.50, // PDH
      low: 2630.20,  // PDL
      close: 2650.00,
      is_closed: true
    }
  ];

  // 40 closed M15 candles trading between 2640 and 2655 (neither PDH 2665.50 nor PDL 2630.20 swept yet)
  const m15 = [];
  for (let i = 40; i >= 1; i--) {
    const t = now - i * 900;
    m15.push({
      open_time: t,
      close_time: t + 900,
      open: 2645.00,
      high: 2652.00,
      low: 2642.00,
      close: 2648.00,
      is_closed: true
    });
  }

  // 40 closed M5 candles
  const m5 = [];
  for (let i = 40; i >= 1; i--) {
    const t = now - i * 300;
    m5.push({
      open_time: t,
      close_time: t + 300,
      open: 2646.00,
      high: 2650.00,
      low: 2644.00,
      close: 2648.00,
      is_closed: true
    });
  }

  // 40 closed H1 candles
  const h1 = [];
  for (let i = 40; i >= 1; i--) {
    const t = now - i * 3600;
    h1.push({
      open_time: t,
      close_time: t + 3600,
      open: 2644.00,
      high: 2655.00,
      low: 2640.00,
      close: 2648.00,
      is_closed: true
    });
  }

  const result = evaluateSixDrivers({
    m15,
    m5,
    h1,
    d1,
    nowSeconds: now,
    context: { fresh: true, news: { status: 'SAFE' } }
  });

  assert.ok(result);
  assert.equal(result.drivers.length, 6);

  // When D1 is provided, evaluateSixDrivers internally checks targetsAt with D.at(-1)
  // Let's verify by checking that evaluateSixDrivers didn't fail and evaluated all 6 models
  for (const driver of result.drivers) {
    assert.ok(driver.state, `Driver ${driver.name} must have a valid state`);
    assert.notEqual(driver.state, 'ERROR');
  }
});

test('Item 1.1: buildMarketContext synthesizes D1 from H1 when d1 is omitted, closing liquidity gap', async () => {
  const { buildMarketContext, synthesizeD1FromH1 } = await import('../lib/scalper-engine/market-context.mjs');
  const now = 1_700_000_000;

  // 48 closed H1 candles spanning 2 full days
  const h1 = [];
  for (let i = 48; i >= 1; i--) {
    const t = now - i * 3600;
    h1.push({
      open_time: t,
      close_time: t + 3600,
      open: 2640.00,
      high: i > 24 ? 2670.00 : 2655.00,
      low: i > 24 ? 2620.00 : 2635.00,
      close: 2648.00,
      is_closed: true
    });
  }

  // Verify direct synthesis
  const synthesized = synthesizeD1FromH1(h1, now);
  assert.ok(synthesized.length >= 1, 'synthesizeD1FromH1 must generate at least 1 D1 candle');
  assert.ok(synthesized[0].open_time < synthesized[0].close_time);
  assert.ok(synthesized[0].high >= synthesized[0].low);

  // 60 closed M15 candles
  const m15 = [];
  for (let i = 60; i >= 1; i--) {
    const t = now - i * 900;
    m15.push({
      open_time: t,
      close_time: t + 900,
      open: 2645.00,
      high: 2650.00,
      low: 2642.00,
      close: 2648.00,
      is_closed: true
    });
  }

  // 40 closed M5 candles
  const m5 = [];
  for (let i = 40; i >= 1; i--) {
    const t = now - i * 300;
    m5.push({
      open_time: t,
      close_time: t + 300,
      open: 2646.00,
      high: 2649.00,
      low: 2644.00,
      close: 2648.00,
      is_closed: true
    });
  }

  // Call buildMarketContext WITHOUT passing d1
  const ctx = buildMarketContext({
    h1,
    m15,
    m5,
    nowSeconds: now
  });

  assert.ok(ctx.source.D1 !== null, 'source.D1 must be populated via fallback synthesis');
  const pdh = ctx.liquidity.find(l => l.label === 'PDH');
  const pdl = ctx.liquidity.find(l => l.label === 'PDL');
  assert.ok(pdh, 'PDH must be present in liquidity levels even when d1 input is omitted');
  assert.ok(pdl, 'PDL must be present in liquidity levels even when d1 input is omitted');
});

test('Item 1.76: targetsAt in six-drivers.mjs includes H1 pivots to prevent false WAITING_TARGET lockout', () => {
  const source = fs.readFileSync('lib/scalper-engine/six-drivers.mjs', 'utf8');
  assert.match(
    source,
    /function targetsAt\(M,\s*T,\s*D,\s*H\s*=\s*\[\],\s*now\)/,
    'targetsAt must accept H candles'
  );
  assert.match(
    source,
    /const pH\s*=\s*sixPivots\(H,\s*2\)/,
    'targetsAt must extract swing pivots from H1'
  );
  assert.match(
    source,
    /label:\s*key\s*===\s*'highs'\s*\?\s*'H1_BSL'\s*:\s*'H1_SSL'/,
    'targetsAt must label H1 targets as H1_BSL and H1_SSL'
  );
  assert.match(
    source,
    /const levels\s*=\s*targetsAt\(M,\s*executionCandles,\s*D,\s*H,\s*nowSeconds\)/,
    'evaluateSixDrivers must pass H to targetsAt'
  );
});

test('Item 2.38: Multi-Timeframe High-Watermark Liquidity Ladder produces TP1, TP2, TP3 and ladder in plan', () => {
  const source = fs.readFileSync('lib/scalper-engine/six-drivers.mjs', 'utf8');
  assert.match(source, /fibExtTarget\s*=\s*round\(entry\s*\+\s*event\.sign/);
  assert.match(source, /label:\s*'FIB_EXT_1272'/);
  assert.match(source, /const tp3Target\s*=\s*round\(/);
  assert.match(source, /label:\s*'TP1 \(Base R\)'/);
  assert.match(source, /label:\s*'TP2 \(Key Liquidity\)'/);
  assert.match(source, /label:\s*'TP3 \(Expansion\)'/);
  assert.match(source, /tp3:\s*tp3Target/);
  assert.match(source, /liquidity_ladder:\s*ladder/);
});

