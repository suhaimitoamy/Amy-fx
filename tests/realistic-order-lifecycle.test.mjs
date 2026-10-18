import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tradeEngineSource = readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/trade-engine.js', 'utf8');
const historySource = readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/backtest-history.js', 'utf8');
const practiceCssSource = readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/css/practice.css', 'utf8');

test('Item 2.17: practice.css includes elegant styling for result-missed and badge-missed', () => {
  assert.match(practiceCssSource, /\.result-missed\s*\{/, 'practice.css must define .result-missed');
  assert.match(practiceCssSource, /\.badge-missed\s*\{/, 'practice.css must define .badge-missed');
});

test('Item 2.17: trade-engine.js detects MISSED setup when TP reached before entry fill', () => {
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

  const engine = context.AmyPracticeTrades;

  // Create pending limit BUY order at 2650.00, SL 2640.00, TP 2680.00
  const order = engine.create({
    bias: 'BUY',
    entry: 2650.00,
    stopLoss: 2640.00,
    takeProfit: 2680.00,
    tradeTime: 1000,
    currentPrice: 2655.00
  });
  assert.equal(order.result, 'OPEN');
  assert.equal(order.entryStatus, 'WAITING_FILL');

  // Next candle rockets to 2685.00 without dipping to 2650.00 (Low 2660.00, High 2685.00)
  const candle1 = { time: 1060, open: 2662.00, high: 2685.00, low: 2660.00, close: 2682.00 };
  const evaluated = engine.evaluate(order, [candle1]);

  assert.equal(evaluated.result, 'MISSED', 'Order must be marked as MISSED');
  assert.equal(evaluated.r, 0, 'Missed setup must have R = 0 (no loss)');
  assert.equal(evaluated.entryStatus, 'EXPIRED_TARGET_HIT_FIRST');
  assert.equal(evaluated.outcomeEvidence?.type, 'MISSED');
  assert.equal(evaluated.outcomeEvidence?.level, 2680.00);
});

test('Item 2.17: backtest-history.js renders [ ⏳ MISSED ] badge with distinct styling', () => {
  assert.match(historySource, /result === 'MISSED'[\s\S]*?'result-missed'/, 'backtest-history.js must map MISSED to result-missed');
  assert.match(historySource, /\[ ⏳ MISSED \]/, 'backtest-history.js must render [ ⏳ MISSED ] badge text');
  assert.match(historySource, /class="badge-missed"/, 'backtest-history.js must use badge-missed CSS class');
});
