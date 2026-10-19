import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const analyticsCode = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/trading-practice/assets/js/practice-analytics.js'), 'utf8');
const vmCtx = { console };
vmCtx.window = vmCtx;
vmCtx.globalThis = vmCtx;
vm.createContext(vmCtx);
vm.runInContext(analyticsCode, vmCtx);
const AmyPracticeAnalytics = vmCtx.AmyPracticeAnalytics;

test('1. AmyPracticeAnalytics correctly classifies trading sessions based on UTC candle time', () => {
  // Asia: 00:00 - 07:00 UTC (e.g. 04:00 UTC)
  const asiaTimestamp = Math.floor(new Date('2026-10-19T04:00:00Z').getTime() / 1000);
  assert.equal(AmyPracticeAnalytics.classifySession(asiaTimestamp), 'Asia');

  // London: 07:00 - 13:00 UTC (e.g. 09:30 UTC)
  const londonTimestamp = Math.floor(new Date('2026-10-19T09:30:00Z').getTime() / 1000);
  assert.equal(AmyPracticeAnalytics.classifySession(londonTimestamp), 'London');

  // New York: 13:00 - 21:00 UTC (e.g. 15:30 UTC)
  const nyTimestamp = Math.floor(new Date('2026-10-19T15:30:00Z').getTime() / 1000);
  assert.equal(AmyPracticeAnalytics.classifySession(nyTimestamp), 'New York');
});

test('2. AmyPracticeAnalytics classifies ICT setup archetypes from notes and reasons', () => {
  assert.equal(AmyPracticeAnalytics.classifySetup('M15 Bullish FVG displacement', ''), 'FVG');
  assert.equal(AmyPracticeAnalytics.classifySetup('Rejection at Bearish Order Block', ''), 'Order Block');
  assert.equal(AmyPracticeAnalytics.classifySetup('Turtle soup sweep of BSL', ''), 'Liquidity Sweep');
  assert.equal(AmyPracticeAnalytics.classifySetup('MSS trend shift', ''), 'Structure Break');
  assert.equal(AmyPracticeAnalytics.classifySetup('', '', 'Manual Entry'), 'Manual Entry');
});

test('3. computeStats produces comprehensive win rate, expectancy, and habit breakdowns', () => {
  const sampleTrades = [
    {
      id: 'T1',
      tradeTime: Math.floor(new Date('2026-10-19T08:30:00Z').getTime() / 1000), // London
      setupType: 'FVG',
      result: 'WIN',
      r: 2.0
    },
    {
      id: 'T2',
      tradeTime: Math.floor(new Date('2026-10-19T09:15:00Z').getTime() / 1000), // London
      setupType: 'Order Block',
      result: 'LOSS',
      r: -1.0
    },
    {
      id: 'T3',
      tradeTime: Math.floor(new Date('2026-10-19T14:30:00Z').getTime() / 1000), // New York
      setupType: 'Liquidity Sweep',
      result: 'WIN',
      r: 3.0
    },
    {
      id: 'T4',
      tradeTime: Math.floor(new Date('2026-10-19T16:00:00Z').getTime() / 1000), // New York
      setupType: 'FVG',
      result: 'MISSED',
      r: 0
    }
  ];

  const stats = AmyPracticeAnalytics.computeStats(sampleTrades);
  assert.equal(stats.totalTrades, 4);
  assert.equal(stats.closedTrades, 3);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.missed, 1);
  // Win rate: 2 / 3 = 66.7%
  assert.equal(stats.winRate, 66.7);
  // Total R: 2 - 1 + 3 = 4.0R, Expectancy: 4 / 3 = 1.33R
  assert.equal(stats.expectancyR, 1.33);
  // Profit factor: 5.0 / 1.0 = 5.0
  assert.equal(stats.profitFactor, 5.0);
  assert.ok(stats.breakdownBySetup.length >= 3);
  assert.ok(stats.breakdownBySession.some(s => s.session === 'London' && s.wins === 1));
});

test('4. storage.js has amy_practice_analytics store and helper methods', () => {
  const storageContent = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/trading-practice/assets/js/storage.js'), 'utf8');
  assert.match(storageContent, /analytics:\s*'amy_practice_analytics'/);
  assert.match(storageContent, /DB_VERSION\s*=\s*3/);
  assert.match(storageContent, /savePracticeAnalytics/);
  assert.match(storageContent, /listPracticeAnalytics/);
});

test('5. backtest-history.html and backtest-history.js render analytics dashboard cards', () => {
  const htmlContent = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/trading-practice/backtest-history.html'), 'utf8');
  const jsContent = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/academy/trading-practice/assets/js/backtest-history.js'), 'utf8');

  assert.match(htmlContent, /metricWinRate/);
  assert.match(htmlContent, /metricExpectancy/);
  assert.match(htmlContent, /setupBreakdownList/);
  assert.match(htmlContent, /sessionBreakdownList/);
  assert.match(htmlContent, /practice-analytics\.js/);

  assert.match(jsContent, /renderAnalytics/);
  assert.match(jsContent, /computeStats/);
});
