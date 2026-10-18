import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../app/src/main/assets/apps/mapping/js/ict-workspace/advisor-panel.js', import.meta.url);
const code = readFileSync(file, 'utf8');

function setupEnvironment() {
  const context = {
    console,
    window: {
      addEventListener: () => {},
      localStorage: { getItem: () => null, setItem: () => {} }
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => []
    },
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.AmyAdvisorPanel;
}

test('Item 1.45: computeFractalTwinMatches eliminates lookahead path bias on BUY trades', () => {
  const panel = setupEnvironment();
  assert.equal(typeof panel.computeFractalTwinMatches, 'function');

  const W = 16;
  const entryP = 2650.00;
  const levels = { slBuf: 3.0, tpTarget: 6.0 }; // SL = 2647.00, TP = 2656.00
  const t0 = 1770000000;

  // 1. Build 16 base window candles (ending at entryP 2650.00)
  const windowCandles = [];
  for (let i = 0; i < W; i++) {
    const p = 2640 + i * (10 / (W - 1));
    windowCandles.push({ time: t0 + i * 900, open: p, high: p + 0.5, low: p - 0.5, close: p });
  }

  const windowTargetTimeStr = new Date((t0 + (W - 1) * 900) * 1000).toISOString().replace('T', ' ').slice(0, 16);

  // Scenario 1: Trap Case (Hits SL on bar 1, then rallies past TP on bar 5)
  // Bar 0: drops to 2646.00 (mae = 4.0 >= 3.0 -> SL hit!)
  // Bar 4: rallies to 2658.00 (mfe = 8.0 >= 6.0 -> TP level)
  const forwardBarsSLFirst = [
    { time: t0 + (W + 0) * 900, open: 2649, high: 2650, low: 2646.00, close: 2647 }, // Hits SL!
    { time: t0 + (W + 1) * 900, open: 2647, high: 2648, low: 2646.50, close: 2648 },
    { time: t0 + (W + 2) * 900, open: 2648, high: 2651, low: 2647.00, close: 2650 },
    { time: t0 + (W + 3) * 900, open: 2650, high: 2655, low: 2649.00, close: 2654 },
    { time: t0 + (W + 4) * 900, open: 2654, high: 2658, low: 2653.00, close: 2657 }, // Later reaches TP
    { time: t0 + (W + 5) * 900, open: 2657, high: 2658, low: 2656.00, close: 2657 },
    { time: t0 + (W + 6) * 900, open: 2657, high: 2658, low: 2656.00, close: 2657 },
    { time: t0 + (W + 7) * 900, open: 2657, high: 2658, low: 2656.00, close: 2657 }
  ];

  // Target window matches base window exactly so similarity is ~98.5%
  const targetCandles = windowCandles.map((c, i) => ({
    ...c,
    time: t0 + (W + 8 + i) * 900
  }));

  const fullCandlesSLFirst = [...windowCandles, ...forwardBarsSLFirst, ...targetCandles];
  const resSLFirst = panel.computeFractalTwinMatches(fullCandlesSLFirst, 'BUY', levels, 3.5);
  const matchesSLFirst = resSLFirst.matches_sample;

  assert.ok(matchesSLFirst.length > 0, 'Must produce matches');
  const matchedTrap = matchesSLFirst.find(m => m.timestamp === windowTargetTimeStr);
  assert.ok(matchedTrap, `Must match window at ${windowTargetTimeStr}`);
  // With lookahead bias fixed, this MUST BE 'LOSS', never 'WIN'
  assert.equal(matchedTrap.result, 'LOSS', 'Must record LOSS because SL was penetrated first chronologically');

  // Scenario 2: Clean WIN (Reaches TP on bar 2 before ever reaching SL)
  // Bar 0: quiet, low = 2648.50 (mae = 1.5 < 3.0)
  // Bar 1: high = 2657.00 (mfe = 7.0 >= 6.0 -> TP hit!)
  // Bar 4: drops to 2645.00 (later drops below SL after TP already locked in)
  const forwardBarsTPFirst = [
    { time: t0 + (W + 0) * 900, open: 2650, high: 2652, low: 2648.50, close: 2651 },
    { time: t0 + (W + 1) * 900, open: 2651, high: 2657.00, low: 2650.00, close: 2656 }, // Hits TP!
    { time: t0 + (W + 2) * 900, open: 2656, high: 2656, low: 2652.00, close: 2653 },
    { time: t0 + (W + 3) * 900, open: 2653, high: 2654, low: 2648.00, close: 2649 },
    { time: t0 + (W + 4) * 900, open: 2649, high: 2650, low: 2645.00, close: 2646 }, // Later drops below SL
    { time: t0 + (W + 5) * 900, open: 2646, high: 2647, low: 2645.00, close: 2646 },
    { time: t0 + (W + 6) * 900, open: 2646, high: 2647, low: 2645.00, close: 2646 },
    { time: t0 + (W + 7) * 900, open: 2646, high: 2647, low: 2645.00, close: 2646 }
  ];

  const fullCandlesTPFirst = [...windowCandles, ...forwardBarsTPFirst, ...targetCandles];
  const resTPFirst = panel.computeFractalTwinMatches(fullCandlesTPFirst, 'BUY', levels, 3.5);
  const matchesTPFirst = resTPFirst.matches_sample;
  const matchedCleanWin = matchesTPFirst.find(m => m.timestamp === windowTargetTimeStr);
  assert.ok(matchedCleanWin, `Must match window at ${windowTargetTimeStr}`);
  assert.equal(matchedCleanWin.result, 'WIN', 'Must record WIN because TP was achieved before SL');
});

test('Item 1.45: computeFractalTwinMatches eliminates lookahead path bias on SELL trades', () => {
  const panel = setupEnvironment();
  const W = 16;
  const entryP = 2650.00;
  const levels = { slBuf: 3.0, tpTarget: 6.0 }; // SL = 2653.00, TP = 2644.00
  const t0 = 1770000000;

  // 16 base window candles (downward sloping into entryP 2650.00)
  const windowCandles = [];
  for (let i = 0; i < W; i++) {
    const p = 2660 - i * (10 / (W - 1));
    windowCandles.push({ time: t0 + i * 900, open: p, high: p + 0.5, low: p - 0.5, close: p });
  }

  const windowTargetTimeStr = new Date((t0 + (W - 1) * 900) * 1000).toISOString().replace('T', ' ').slice(0, 16);

  // SELL Trap: Bar 0 spikes up to 2654.50 (mae = 4.5 >= 3.0 -> SL hit!)
  // Later Bar 4 dumps to 2641.00 (mfe = 9.0 >= 6.0 -> TP level)
  const forwardBarsSellSLFirst = [
    { time: t0 + (W + 0) * 900, open: 2651, high: 2654.50, low: 2650, close: 2653 }, // Hits SL!
    { time: t0 + (W + 1) * 900, open: 2653, high: 2653, low: 2649, close: 2650 },
    { time: t0 + (W + 2) * 900, open: 2650, high: 2650, low: 2646, close: 2647 },
    { time: t0 + (W + 3) * 900, open: 2647, high: 2647, low: 2643, close: 2644 },
    { time: t0 + (W + 4) * 900, open: 2644, high: 2644, low: 2641, close: 2642 }, // Later reaches TP
    { time: t0 + (W + 5) * 900, open: 2642, high: 2643, low: 2641, close: 2642 },
    { time: t0 + (W + 6) * 900, open: 2642, high: 2643, low: 2641, close: 2642 },
    { time: t0 + (W + 7) * 900, open: 2642, high: 2643, low: 2641, close: 2642 }
  ];

  const targetCandles = windowCandles.map((c, i) => ({
    ...c,
    time: t0 + (W + 8 + i) * 900
  }));

  const fullCandlesSell = [...windowCandles, ...forwardBarsSellSLFirst, ...targetCandles];
  const resSell = panel.computeFractalTwinMatches(fullCandlesSell, 'SELL', levels, 3.5);
  const matchesSell = resSell.matches_sample;
  const matchedSellTrap = matchesSell.find(m => m.timestamp === windowTargetTimeStr);
  assert.ok(matchedSellTrap, `Must match window at ${windowTargetTimeStr}`);
  assert.equal(matchedSellTrap.result, 'LOSS', 'Sell setup must be LOSS when spike hits SL first');
});
