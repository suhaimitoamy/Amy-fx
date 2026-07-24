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

test('Saran Level uses two OCO breakout-retest scenarios with healthy RR', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(coreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /Saran Level/);
  assert.match(ui, /Skenario Buy/);
  assert.match(ui, /Skenario Sell/);
  assert.match(ui, /breakout dan retest/);
  assert.match(ui, /TP1 memakai RR 1:1,5 dan TP2 memakai RR 1:2/);
  assert.match(ui, /Saran level ditahan/);
  assert.match(ui, /WAIT_CONDITIONAL/);
  assert.equal(/Prediction Tracker/i.test(ui), false);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /lookbackBars: 32/);
  assert.match(core, /entryBufferAtr: 0\.05/);
  assert.match(core, /retestBars: 8/);
  assert.match(core, /stopPadAtr: 1\.0/);
  assert.match(core, /tp1R: 1\.5/);
  assert.match(core, /tp2R: 2\.0/);
  assert.match(core, /M15_CLOSE_ABOVE_THEN_RETEST/);
  assert.match(core, /M15_CLOSE_BELOW_THEN_RETEST/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('2024 retest backtest records more entries with RR 1.5 and 2.0', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));

  assert.equal(result.status, 'FINAL_BACKTEST_DUAL_SCENARIO_RETEST_RR_2024');
  assert.equal(result.setupFlow.armedSetups, 1008);
  assert.equal(result.setupFlow.entries, 600);
  assert.equal(result.overall.buyEntries, 373);
  assert.equal(result.overall.sellEntries, 227);
  assert.equal(result.overall.tp1Reached, 246);
  assert.equal(result.overall.tp1Rate, 41);
  assert.equal(result.overall.tp2Reached, 199);
  assert.equal(result.overall.tp2Rate, 33.17);
  assert.equal(result.overall.expectancyAtTp1R, 0.078);
  assert.equal(result.overall.expectancyAtTp2R, 0.078);
  assert.match(report, /524 → 600/);
  assert.match(report, /Tidak ada look-ahead/);
  assert.match(report, /stop dihitung lebih dahulu/);
  assert.match(report, /Spread, slippage, komisi/);
});
