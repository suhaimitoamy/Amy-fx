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

test('Item 1.78: trade-engine.js activates market order with flexible epsilon and explicit orderType', () => {
  const engine = setupEngine();

  // Explicit MARKET order with slight price difference (e.g. 0.10)
  const marketOrder = engine.create({
    bias: 'BUY',
    entry: 2650.00,
    stopLoss: 2640.00,
    takeProfit: 2670.00,
    tradeTime: 1000,
    currentPrice: 2650.10,
    orderType: 'MARKET'
  });
  assert.equal(marketOrder.entryStatus, 'ACTIVE');
  assert.equal(marketOrder.orderType, 'MARKET');
  assert.equal(marketOrder.entryActivatedAt, 1000);

  // Auto-detected market order within 0.25 points
  const autoMarketOrder = engine.create({
    bias: 'SELL',
    entry: 2650.00,
    stopLoss: 2660.00,
    takeProfit: 2630.00,
    tradeTime: 1000,
    currentPrice: 2650.20
  });
  assert.equal(autoMarketOrder.entryStatus, 'ACTIVE');
  assert.equal(autoMarketOrder.orderType, 'MARKET');

  // Limit order far from current price remains WAITING_FILL
  const limitOrder = engine.create({
    bias: 'BUY',
    entry: 2630.00,
    stopLoss: 2620.00,
    takeProfit: 2650.00,
    tradeTime: 1000,
    currentPrice: 2650.00,
    orderType: 'LIMIT'
  });
  assert.equal(limitOrder.entryStatus, 'WAITING_FILL');
  assert.equal(limitOrder.orderType, 'LIMIT');
});

test('Item 1.78: trade-engine.js eliminates immediate candle blindspot for active market orders', () => {
  const engine = setupEngine();

  // Market BUY trade placed at tradeTime = 1000
  const order = engine.create({
    bias: 'BUY',
    entry: 2650.00,
    stopLoss: 2640.00,
    takeProfit: 2670.00,
    tradeTime: 1000,
    currentPrice: 2650.00,
    orderType: 'MARKET'
  });

  // Current decision bar (time = 1000) achieves TP at 2672.00 during the bar
  const activeCandle = {
    time: 1000,
    open: 2650.00,
    high: 2672.00,
    low: 2648.00,
    close: 2670.50
  };

  const evaluated = engine.evaluate(order, [activeCandle]);
  assert.equal(evaluated.result, 'WIN', 'Must evaluate current bar and detect TP WIN immediately');
  assert.equal(evaluated.closedAt, 1000, 'Must record closedAt on the entry bar');
  assert.ok(evaluated.r > 0, 'Must record positive R return');
});

test('Item 1.78: limit orders preserve no-lookahead integrity and wait for subsequent bars', () => {
  const engine = setupEngine();

  // Limit order placed at tradeTime = 1000
  const limitOrder = engine.create({
    bias: 'BUY',
    entry: 2640.00,
    stopLoss: 2630.00,
    takeProfit: 2660.00,
    tradeTime: 1000,
    currentPrice: 2650.00,
    orderType: 'LIMIT'
  });

  // Candle at time = 1000 is skipped for pending limit orders
  const bar0 = { time: 1000, open: 2650, high: 2655, low: 2639, close: 2650 };
  const eval0 = engine.evaluate(limitOrder, [bar0]);
  assert.equal(eval0.entryStatus, 'WAITING_FILL', 'Must not fill on the decision bar itself');

  // Next bar (time = 1060) fills the limit order
  const bar1 = { time: 1060, open: 2645, high: 2646, low: 2638, close: 2642 };
  const eval1 = engine.evaluate(limitOrder, [bar1]);
  assert.equal(eval1.entryStatus, 'ACTIVE', 'Must fill on bar1');
});
