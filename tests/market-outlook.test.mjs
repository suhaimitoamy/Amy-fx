import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildAmyMarketContextOutlook } from '../app/src/main/assets/apps/mapping/js/outlook/amy-market-context-final-core.js';

const uiUrl = new URL('../app/src/main/assets/apps/mapping/js/market-outlook.js', import.meta.url);
const activeCoreUrl = new URL('../app/src/main/assets/apps/mapping/js/outlook/amy-market-context-final-core.js', import.meta.url);
const archivedCoreUrl = new URL('../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js', import.meta.url);
const scriptUrl = new URL('../scripts/backtest-trade-scenarios-2024.mjs', import.meta.url);
const indexUrl = new URL('../app/src/main/assets/apps/mapping/index.html', import.meta.url);
const cssUrl = new URL('../app/src/main/assets/apps/mapping/css/market-outlook.css', import.meta.url);
const reportUrl = new URL('../docs/backtests/AMY_FX_TRADE_SCENARIOS_2024.md', import.meta.url);
const dataUrl = new URL('../docs/backtests/amy-fx-trade-scenarios-2024.json', import.meta.url);
const directReportUrl = new URL('../docs/backtests/AMY_FX_M5_DIRECT_ENTRY_2024.md', import.meta.url);
const directDataUrl = new URL('../docs/backtests/amy-fx-m5-direct-entry-2024.json', import.meta.url);

function assertSyntax(url) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function candles(count, step, start = Date.UTC(2026, 0, 1), base = 2600) {
  return Array.from({ length: count }, (_, index) => {
    const open = base + index * 0.1;
    return { time: start + index * step, open, high: open + 0.3, low: open - 0.3, close: open + 0.05 };
  });
}

test('Market Outlook Final JavaScript remains syntactically valid', () => {
  assertSyntax(uiUrl);
  assertSyntax(activeCoreUrl);
  assertSyntax(archivedCoreUrl);
  assertSyntax(scriptUrl);
});

test('mapping keeps the existing Market Outlook asset entry points', () => {
  const html = readFileSync(indexUrl, 'utf8');
  assert.match(html, /css\/market-outlook\.css/);
  assert.match(html, /js\/market-outlook\.js/);
});

test('Market Outlook uses AMY Market Context Final logic', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(activeCoreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /AMY Market Context Final/);
  assert.match(ui, /FVG revisit/);
  assert.match(ui, /OB revisit/);
  assert.match(ui, /DOL/);
  assert.match(ui, /Asia entry/);
  assert.match(ui, /AMY_MARKET_CONTEXT_FINAL/);
  assert.match(ui, /state\.candles\?\.M1/);
  assert.match(ui, /state\.candles\?\.M5/);
  assert.match(ui, /state\.candles\?\.M15/);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /swingLength: 3/);
  assert.match(core, /fvgBodyMult: 1\.20/);
  assert.match(core, /fvgMinGapAtr: 0\.15/);
  assert.match(core, /fvgMaxGapAtr: 0\.75/);
  assert.match(core, /obBodyMult: 2\.00/);
  assert.match(core, /acceptCloses: 3/);
  assert.match(core, /poiMaxDistanceAtr: 1\.25/);
  assert.match(core, /dolMaxDistanceAtr: 0\.75/);
  assert.match(core, /asiaEntryRewardRisk: 0\.20/);
  assert.match(core, /fourHoursM5: 48/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('Market Context Final stays WAIT without a qualified event', () => {
  const result = buildAmyMarketContextOutlook({
    M1: candles(500, 60_000),
    M5: candles(100, 300_000),
    M15: candles(100, 900_000),
    H1: candles(30, 3_600_000),
    H4: candles(30, 14_400_000),
    D1: candles(30, 86_400_000),
    now: Date.UTC(2026, 0, 2)
  });
  assert.equal(result.mode, 'AMY_MARKET_CONTEXT_FINAL');
  assert.equal(result.primaryDirection, 'WAIT');
  assert.equal(result.status, 'WAITING_EVENT');
  assert.deepEqual(result.scenarios, []);
});

test('2024 M5 Reaction First result remains archived honestly', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));

  assert.equal(result.status, 'FINAL_BACKTEST_M5_REACTION_FIRST_2024');
  assert.equal(result.methodology.m5Candles, 71133);
  assert.equal(result.methodology.m1Candles, 355592);
  assert.equal(result.overall.entries, 165);
  assert.equal(result.overall.tp1Rate, 53.94);
  assert.equal(result.overall.tp2Rate, 42.42);
  assert.equal(result.overall.expectancyAtTp2R, 0.273);
  assert.match(report, /M5 Reaction First/);
  assert.match(report, /Stress biaya/);
});

test('direct-entry experiment remains archived without overstating the speed hypothesis', () => {
  const report = readFileSync(directReportUrl, 'utf8');
  const result = JSON.parse(readFileSync(directDataUrl, 'utf8'));
  assert.equal(result.status, 'FINAL_BACKTEST_M5_DIRECT_ENTRY_COMPARISON_2024');
  assert.equal(result.models.marketAfterFvgClose.overall.expectancyAtTp2R, -0.127);
  assert.equal(result.models.directProximalTouch.overall.entries, 898);
  assert.equal(result.models.directProximalTouch.overall.expectancyAtTp2R, 0.063);
  assert.equal(result.models.directMidpointTouch.overall.entries, 631);
  assert.equal(result.models.directMidpointTouch.overall.tp2Rate, 38.19);
  assert.equal(result.models.directMidpointTouch.overall.expectancyAtTp2R, 0.146);
  assert.match(report, /Direct midpoint touch/);
  assert.match(report, /tidak terbukti/);
  assert.match(report, /belum menggantikan logika aktif/);
});
