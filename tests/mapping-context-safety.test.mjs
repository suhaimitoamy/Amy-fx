import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const router = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/strategy-router-engine.js', import.meta.url), 'utf8');
const marketData = await readFile(new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url), 'utf8');
const conceptAnalyze = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/concept-analyze.js', import.meta.url), 'utf8');
const entryRuntime = await readFile(new URL('../app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');

test('Market Shift stays advisory and cannot become an automatic hard gate', () => {
  assert.match(router, /const activeRegime = state\.activeRegime/);
  assert.doesNotMatch(router, /blockRecommended \? 'TRANSITION'/);
  assert.match(router, /marketShiftHardGate: false/);
});

test('Strategy Router remains contextual and cannot create or replace a primary setup', () => {
  assert.match(router, /const setup = null/);
  assert.match(router, /routerCanReplaceEntrySetup: false/);
  assert.match(router, /STRATEGY_SUITABILITY_ACCURACY_48_53_2022_2025/);
  assert.match(marketData, /mayReplaceEntryMap: false/);
  assert.match(marketData, /result\.unroutedBestSetup = originalBestSetup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.setup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.watchSetup/);
});

test('Entry Map remains audit-only while hardened Entry Watch owns the primary setup', () => {
  assert.match(marketData, /ENTRY_MAP_REACTION_ACCURACY_48_24_2022_2025/);
  assert.match(marketData, /result\.experimentalSetups = experimentalSetups/);
  assert.match(marketData, /result\.experimentalBestSetup = experimentalBestSetup/);
  assert.match(conceptAnalyze, /setups: \[\]/);
  assert.match(conceptAnalyze, /bestSetup: null/);
  assert.match(conceptAnalyze, /signal: 'WAIT'/);
  assert.match(conceptAnalyze, /status: 'REPLACED_BY_MULTI_TF_LEVEL_WATCH'/);
  assert.match(entryRuntime, /setupFromHardenedWatch\(watch\)/);
  assert.match(entryRuntime, /result\.bestSetup = setup/);
  assert.match(ui, /SKENARIO PEMANTAUAN/);
  assert.match(ui, /Konfirmasi harga tetap diperlukan/);
});

test('Validated Direction Forecast conflict protection remains active', () => {
  assert.match(marketData, /const setupConflict = Boolean/);
  assert.match(marketData, /result\.validatedSetupConflict = setupConflict/);
  assert.match(marketData, /const experimentalSetups = setupConflict \|\| !forecastActive \? \[\]/);
  assert.match(marketData, /if \(!forecastActive \|\| setupConflict\)/);
  assert.match(marketData, /result\.setups = \[\]/);
  assert.match(marketData, /result\.bestSetup = null/);
  assert.match(entryRuntime, /if \(directions\.length !== 1\) return null/);
});
