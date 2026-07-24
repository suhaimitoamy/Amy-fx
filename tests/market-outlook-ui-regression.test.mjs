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

test('Market Outlook is rendered as two conditional level scenarios', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(coreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /Amy Market Outlook · Saran Level/);
  assert.match(ui, /Dua Skenario Kondisional/);
  assert.match(ui, /Skenario Buy/);
  assert.match(ui, /Skenario Sell/);
  assert.match(ui, /Saran level ditahan/);
  assert.match(ui, /WAIT_CONDITIONAL/);
  assert.equal(/Prediction Tracker/i.test(ui), false);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /lookbackBars: 32/);
  assert.match(core, /entryBufferAtr: 0\.05/);
  assert.match(core, /stopPadAtr: 0\.75/);
  assert.match(core, /tp1R: 0\.5/);
  assert.match(core, /tp2R: 1\.0/);
  assert.match(core, /M15_CLOSE_ABOVE/);
  assert.match(core, /M15_CLOSE_BELOW/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('2024 backtest result is recorded without overstating TP2 accuracy', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));

  assert.equal(result.status, 'FINAL_BACKTEST_DUAL_CONDITIONAL_SCENARIOS_2024');
  assert.equal(result.overall.snapshots, 731);
  assert.equal(result.overall.activated, 524);
  assert.equal(result.overall.tp1Reached, 320);
  assert.equal(result.overall.tp1Rate, 61.07);
  assert.equal(result.overall.tp2Reached, 230);
  assert.equal(result.overall.tp2Rate, 43.89);
  assert.equal(result.overall.stoppedBeforeTp1, 192);
  assert.equal(result.overall.noTp1OrStop, 12);
  assert.match(report, /Tidak ada look-ahead/);
  assert.match(report, /TP1 tercapai sebelum stop/);
  assert.match(report, /TP2 tercapai sebelum stop/);
  assert.match(report, /Spread, slippage, komisi/);
});
