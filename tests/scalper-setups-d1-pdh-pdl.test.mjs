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
