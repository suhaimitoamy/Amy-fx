import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const uiUrl = new URL('../app/src/main/assets/apps/mapping/js/market-outlook.js', import.meta.url);
const coreUrl = new URL('../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js', import.meta.url);
const scriptUrl = new URL('../scripts/backtest-trade-scenarios-2024.mjs', import.meta.url);
const cssUrl = new URL('../app/src/main/assets/apps/mapping/css/market-outlook.css', import.meta.url);
const reportUrl = new URL('../docs/backtests/AMY_FX_TRADE_SCENARIOS_2024.md', import.meta.url);
const dataUrl = new URL('../docs/backtests/amy-fx-trade-scenarios-2024.json', import.meta.url);

function assertSyntax(url) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('M5 Reaction First JavaScript remains syntactically valid', () => {
  assertSyntax(uiUrl);
  assertSyntax(coreUrl);
  assertSyntax(scriptUrl);
});

test('Saran Level UI exposes M5 reaction lifecycle rather than breakout prediction', () => {
  const ui = readFileSync(uiUrl, 'utf8');
  const core = readFileSync(coreUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');

  assert.match(ui, /M5 Reaction First/);
  assert.match(ui, /fresh FVG/);
  assert.match(ui, /first touch/);
  assert.match(ui, /rejection M5/);
  assert.match(ui, /50% FVG/);
  assert.match(ui, /Grade A/);
  assert.match(ui, /M5_REACTION_FIRST_LEVELS/);
  assert.match(ui, /state\.candles\?\.M5/);
  assert.equal(/WAIT_CONDITIONAL/.test(ui), false);
  assert.equal(/Prediction Tracker/i.test(ui), false);
  assert.equal(/Probabilitas model/i.test(ui), false);

  assert.match(core, /timeframe: 'M5'/);
  assert.match(core, /displacementBodyAtr: 0\.8/);
  assert.match(core, /entryWaitBars: 5/);
  assert.match(core, /minimumRiskPoints: 0\.6/);
  assert.match(core, /minimumLiquidityRoomR: 2\.0/);
  assert.match(core, /tp1R: 1\.5/);
  assert.match(core, /tp2R: 2\.0/);
  assert.match(core, /FVG_FIRST_TOUCH_REACTION/);
  assert.match(core, /LIQUIDITY_SWEEP_FVG_REACTION/);
  assert.match(css, /amy-level-card\.buy/);
  assert.match(css, /amy-level-card\.sell/);
});

test('2024 M5 backtest is stored with validation and cost stress', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));

  assert.equal(result.status, 'FINAL_BACKTEST_M5_REACTION_FIRST_2024');
  assert.equal(result.methodology.m5Candles, 71133);
  assert.equal(result.methodology.m1Candles, 355592);
  assert.equal(result.overall.entries, 165);
  assert.equal(result.overall.tp1Reached, 89);
  assert.equal(result.overall.tp1Rate, 53.94);
  assert.equal(result.overall.tp2Reached, 70);
  assert.equal(result.overall.tp2Rate, 42.42);
  assert.equal(result.overall.expectancyAtTp2R, 0.273);
  assert.equal(result.gradeA.entries, 44);
  assert.equal(result.validationSepDec.entries, 54);
  assert.equal(result.validationSepDec.expectancyAtTp2R, 0.111);
  assert.equal(result.costStressTp2R['0.20'], 0.022);
  assert.equal(result.costStressTp2R['0.25'], -0.04);

  assert.match(report, /seluruh keputusan setup memakai M5/);
  assert.match(report, /M1 hanya dipakai/);
  assert.match(report, /SL dihitung lebih dahulu/);
  assert.match(report, /Stress biaya/);
});
