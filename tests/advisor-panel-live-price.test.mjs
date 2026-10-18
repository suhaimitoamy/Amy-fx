import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../app/src/main/assets/apps/mapping/js/ict-workspace/advisor-panel.js', import.meta.url);
const code = readFileSync(file, 'utf8');

function setupEnvironment(overrides = {}) {
  const domElements = new Map();
  const context = {
    console,
    window: {
      addEventListener: () => {},
      localStorage: { getItem: () => null, setItem: () => {} },
      ...overrides.window
    },
    document: {
      getElementById: id => domElements.get(id) || null,
      querySelectorAll: () => [],
      ...overrides.document
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    ...overrides
  };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);
  return { context, domElements };
}

test('getLivePrice prioritizes window.amyfxCurrentPrice over pending plan.entry', () => {
  const { context } = setupEnvironment({
    window: { amyfxCurrentPrice: 2745.80 }
  });

  const ctx = {
    amy: { assistant: { plan: { entry: 2650.00 } } },
    primary: { entry: 2640.00 }
  };
  const candles = [{ close: 2740.00 }];

  const price = context.window.AmyAdvisorPanel.getLivePrice(ctx, candles);
  assert.equal(price, 2745.80, 'Must return active live tick price 2745.80, NOT pending plan.entry 2650.00');
});

test('getLivePrice falls back to DOM #chart-price when window.amyfxCurrentPrice is absent', () => {
  const { context, domElements } = setupEnvironment();
  domElements.set('chart-price', { textContent: '$2,738.50' });

  const ctx = {
    amy: { assistant: { plan: { entry: 2650.00 } } }
  };
  const candles = [{ close: 2730.00 }];

  const price = context.window.AmyAdvisorPanel.getLivePrice(ctx, candles);
  assert.equal(price, 2738.50, 'Must return DOM price 2738.50');
});

test('getLivePrice falls back to latest candle close when tick price and DOM are absent', () => {
  const { context } = setupEnvironment();

  const ctx = {
    amy: { assistant: { plan: { entry: 2650.00 } } }
  };
  const candles = [{ close: 2725.20 }];

  const price = context.window.AmyAdvisorPanel.getLivePrice(ctx, candles);
  assert.equal(price, 2725.20, 'Must return latest candle close 2725.20');
});

test('getLivePrice only uses plan.entry as last resort when no live prices or candles exist', () => {
  const { context } = setupEnvironment();

  const ctx = {
    amy: { assistant: { plan: { entry: 2690.00 } } }
  };
  const candles = [];

  const price = context.window.AmyAdvisorPanel.getLivePrice(ctx, candles);
  assert.equal(price, 2690.00, 'Must fall back to plan.entry 2690.00 when candles array is empty');
});

test('getLivePrice returns 2650.0 default when completely uninitialized', () => {
  const { context } = setupEnvironment();
  const price = context.window.AmyAdvisorPanel.getLivePrice(null, null);
  assert.equal(price, 2650.0);
});
