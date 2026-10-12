import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-clarity-v1.js', import.meta.url),
  'utf8'
);

test('clarity runtime has no cross-timeframe scalper direction chooser', () => {
  assert.doesNotMatch(source, /chooseScalperDirection|matchingRows|SCALPER_WEIGHTS/);
  assert.match(source, /SUPPORTED_MAPPING_TIMEFRAMES\.map\(analyzeTimeframe\)/);
});

test('each timeframe renders its own D Final Bias and Next Move', () => {
  assert.match(source, /d\.descriptive\.finalBias\.direction/);
  assert.match(source, /d\.predictive\.nextMove\.signal/);
  assert.doesNotMatch(source, /d\.predictive\.nextMove\.source/);
  assert.doesNotMatch(source, /primary scalping|lower-timeframe conflict|weighted vote/i);
});

test('non-priority timeframes stay independent instead of voting on M5 M15 or H1', () => {
  assert.match(source, /Setiap timeframe memakai perilaku Amy-SMC-D\/Z miliknya sendiri/);
  assert.match(source, /Boundary 70\/30, 60\/40, dan rolling-240 hanya diterapkan pada M5, M15, dan H1/);
  assert.doesNotMatch(source, /SCALPER_AUTHORITY_TFS/);
});

test('clarity runtime no longer watches nested mutations or live quote events', () => {
  assert.match(source, /subtree: false/);
  assert.doesNotMatch(source, /amyfx:market-update/);
});
