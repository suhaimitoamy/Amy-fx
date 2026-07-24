import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRADE_SCENARIO_CONFIG,
  buildTradeScenarios,
  detectReactionZones
} from '../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js';

const dataUrl = new URL('../docs/backtests/amy-fx-trade-scenarios-2024.json', import.meta.url);

function sampleCandles() {
  const values = [];
  let price = 2000;
  for (let index = 0; index < 90; index += 1) {
    const open = price;
    const close = price + (index % 2 ? -0.08 : 0.10);
    values.push({ time: 1700000000000 + index * 300000, open, high: Math.max(open, close) + 0.12, low: Math.min(open, close) - 0.12, close });
    price = close;
  }
  values[70] = { ...values[70], open: 2000.0, high: 2000.12, low: 1999.88, close: 1999.92 };
  values[71] = { ...values[71], open: 1999.92, high: 2001.10, low: 1999.90, close: 2000.98 };
  values[72] = { ...values[72], open: 2000.98, high: 2001.24, low: 2000.35, close: 2001.12 };
  return values;
}

test('M5 strategy configuration keeps healthy RR and bounded risk', () => {
  assert.equal(TRADE_SCENARIO_CONFIG.timeframe, 'M5');
  assert.equal(TRADE_SCENARIO_CONFIG.tp1R, 1.5);
  assert.equal(TRADE_SCENARIO_CONFIG.tp2R, 2);
  assert.equal(TRADE_SCENARIO_CONFIG.minimumRiskPoints, 0.6);
  assert.equal(TRADE_SCENARIO_CONFIG.maximumRiskPoints, 4);
  assert.equal(TRADE_SCENARIO_CONFIG.minimumLiquidityRoomR, 2);
});

test('fresh FVG detection requires displacement and returns directional zones', () => {
  const detected = detectReactionZones(sampleCandles());
  assert.ok(Array.isArray(detected.zones));
  assert.ok(detected.zones.some(zone => zone.side === 'BUY'));
  for (const zone of detected.zones) {
    assert.ok(zone.top > zone.bottom);
    assert.equal(zone.midpoint, (zone.bottom + zone.top) / 2);
  }
});

test('live builder does not invent levels when data is insufficient', () => {
  const result = buildTradeScenarios({ candles: sampleCandles().slice(0, 30), price: 2000 });
  assert.equal(result.status, 'WAITING_DATA');
  assert.equal(result.scenarios.length, 0);
});

test('stored result remains the audited M5 2024 iteration', () => {
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));
  assert.equal(result.status, 'FINAL_BACKTEST_M5_REACTION_FIRST_2024');
  assert.equal(result.overall.entries, 165);
  assert.equal(result.overall.buyEntries, 81);
  assert.equal(result.overall.sellEntries, 84);
  assert.equal(result.gradeA.tp2Rate, 50);
  assert.equal(result.validationSepDec.expectancyAtTp2R, 0.111);
});
