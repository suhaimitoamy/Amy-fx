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

test('Market Outlook remains the safer breakout-retest production model', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(coreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /Saran Level/);
  assert.match(ui, /Skenario Buy/);
  assert.match(ui, /Skenario Sell/);
  assert.match(ui, /Saran level ditahan/);
  assert.match(ui, /WAIT_CONDITIONAL/);
  assert.equal(/Prediction Tracker/i.test(ui), false);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /lookbackBars: 32/);
  assert.match(core, /entryBufferAtr: 0\.05/);
  assert.match(core, /retestBars: 8/);
  assert.match(core, /tp1R: 1\.5/);
  assert.match(core, /tp2R: 2\.0/);
  assert.match(core, /BREAKOUT_RETEST/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('2024 comparison records retest versus 3-point and 4-point stop orders honestly', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));

  assert.equal(result.status, 'FINAL_BACKTEST_RETEST_VS_STOP_ORDER_2024');
  assert.equal(result.methodology.m15Candles, 23713);
  assert.equal(result.methodology.m1Candles, 355592);

  assert.equal(result.models.breakoutRetest.overall.entries, 605);
  assert.equal(result.models.breakoutRetest.overall.expectancyAtTp2R, 0.036);

  assert.equal(result.models.stopOrder3Point.overall.entries, 1270);
  assert.equal(result.models.stopOrder3Point.overall.expectancyAtTp2R, -0.05);

  assert.equal(result.models.stopOrder4Point.overall.entries, 1049);
  assert.equal(result.models.stopOrder4Point.overall.expectancyAtTp2R, -0.017);

  assert.match(report, /SL dihitung lebih dahulu/);
  assert.match(report, /Buy Stop\/Sell Stop tidak menggantikan model retest/);
  assert.match(report, /Spread, slippage, komisi/);
});
