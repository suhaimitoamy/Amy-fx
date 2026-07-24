import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const uiUrl = new URL('../app/src/main/assets/apps/mapping/js/market-outlook.js', import.meta.url);
const coreUrl = new URL('../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js', import.meta.url);
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

test('Saran Level JavaScript remains syntactically valid', () => {
  assertSyntax(uiUrl);
  assertSyntax(coreUrl);
  assertSyntax(scriptUrl);
});

test('mapping keeps the existing Market Outlook asset entry points', () => {
  const html = readFileSync(indexUrl, 'utf8');
  assert.match(html, /css\/market-outlook\.css/);
  assert.match(html, /js\/market-outlook\.js/);
});

test('Market Outlook remains M5 Reaction First while direct entry is experimental', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(coreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /Saran Level/);
  assert.match(ui, /M5 Reaction First/);
  assert.match(ui, /MENUNGGU REJECTION M5/);
  assert.match(ui, /50% fresh FVG M5/);
  assert.equal(/Prediction Tracker/i.test(ui), false);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /timeframe: 'M5'/);
  assert.match(core, /displacementBodyAtr: 0\.8/);
  assert.match(core, /minimumLiquidityRoomR: 2\.0/);
  assert.match(core, /tp1R: 1\.5/);
  assert.match(core, /tp2R: 2\.0/);
  assert.match(core, /FVG_FIRST_TOUCH_REACTION/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('2024 M5 Reaction First result is recorded honestly', () => {
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

test('direct-entry experiment does not overstate the speed hypothesis', () => {
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
