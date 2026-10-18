import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tradeEngineSource = readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/trade-engine.js', 'utf8');

function setupEngine() {
  const context = {
    console,
    AmyPracticeCore: {
      finite: v => Number.isFinite(Number(v)) ? Number(v) : null,
      normalizeCandles: list => Array.isArray(list) ? list : []
    },
    AmyPracticeStorage: {
      identifier: prefix => `${prefix}-${Date.now()}`
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(tradeEngineSource, context);
  return context.AmyPracticeTrades;
}

test('Item 2.40: calculateExecutionFriction dynamically adjusts spread and slippage', () => {
  const engine = setupEngine();

  // Calm bar (range = 2.0) -> baseline spread 2.0 pips ($0.20), micro-slippage 0.5 pips ($0.05)
  const calmCandle = { high: 2652, low: 2650 };
  const calmBuy = engine.calculateExecutionFriction('BUY', 2650.00, calmCandle, { isMarket: true });
  assert.equal(calmBuy.spreadPips, 2.0);
  assert.equal(calmBuy.slippagePips, 0.5);
  // ASK fill: 2650.00 + (0.20 / 2) + 0.05 = 2650.15
  assert.equal(calmBuy.fillPrice, 2650.15);
  assert.equal(calmBuy.frictionCost, 0.15);

  // Volatile bar (range = 7.0) -> widened spread 4.5 pips ($0.45), spike slippage 1.5 pips ($0.15)
  const volatileCandle = { high: 2657, low: 2650 };
  const volatileBuy = engine.calculateExecutionFriction('BUY', 2650.00, volatileCandle, { isMarket: true });
  assert.equal(volatileBuy.spreadPips, 4.5);
  assert.equal(volatileBuy.slippagePips, 1.5);
  // ASK fill: 2650.00 + (0.45 / 2) + 0.15 = 2650.38 (rounded)
  assert.equal(volatileBuy.fillPrice, 2650.38);

  // SELL execution fills at BID
  const calmSell = engine.calculateExecutionFriction('SELL', 2650.00, calmCandle, { isMarket: true });
  // BID fill: 2650.00 - (0.20 / 2) - 0.05 = 2649.85
  assert.equal(calmSell.fillPrice, 2649.85);
});

test('Item 2.40: trade-engine records realistic fillPrice and adjusted realized R', () => {
  const engine = setupEngine();

  // BUY market trade placed at 2650.00, SL 2640.00 (Risk planned = 10.0), TP 2670.00 (Reward planned = 20.0 -> plannedR = 2.0)
  const order = engine.create({
    bias: 'BUY',
    entry: 2650.00,
    stopLoss: 2640.00,
    takeProfit: 2670.00,
    tradeTime: 1000,
    currentPrice: 2650.00,
    orderType: 'MARKET',
    currentCandle: { high: 2652, low: 2650 }
  });

  // Verify fillPrice reflects ASK execution (2650.15)
  assert.equal(order.fillPrice, 2650.15);
  assert.equal(order.spreadPips, 2.0);
  assert.equal(order.slippagePips, 0.5);

  // Target hit on candle 2
  const nextBar = { time: 1060, open: 2655, high: 2671, low: 2652, close: 2670 };
  const evaluated = engine.evaluate(order, [nextBar]);

  assert.equal(evaluated.result, 'WIN');
  // Realized R: Risk = 2650.15 - 2640.00 = 10.15. Reward = 2670.00 - 2650.15 = 19.85.
  // 19.85 / 10.15 = 1.96 R (realistic, slightly lower than idealized 2.0 R due to spread & slippage!)
  assert.equal(evaluated.r, 1.96);
});
