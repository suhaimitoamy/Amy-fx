import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const router = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/strategy-router-engine.js', import.meta.url), 'utf8');
const marketData = await readFile(new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url), 'utf8');
const conceptAnalyze = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/concept-analyze.js', import.meta.url), 'utf8');
const entryRuntime = await readFile(new URL('../app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js', import.meta.url), 'utf8');
const snapshot = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/mapping-snapshot.js', import.meta.url), 'utf8');

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
  assert.match(marketData, /result\.unroutedBestSetup = causalBestSetup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.setup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.watchSetup/);
});

test('causal Entry Map owns the primary setup while the Entry Watch only renders it', () => {
  assert.doesNotMatch(marketData, /ENTRY_MAP_REACTION_ACCURACY_48_24_2022_2025/);
  assert.match(marketData, /result\.experimentalSetups = \[\]/);
  assert.match(conceptAnalyze, /setups: activeSetup \? \[activeSetup\] : \[\]/);
  assert.match(conceptAnalyze, /bestSetup: activeSetup/);
  assert.match(conceptAnalyze, /detectTimeframeEntryMap/);
  assert.match(entryRuntime, /result\.mappingSnapshot/);
  assert.doesNotMatch(entryRuntime, /result\.bestSetup\s*=/);
  assert.doesNotMatch(entryRuntime, /result\.setups\s*=/);
});

test('Validated Direction Forecast conflict protection remains active', () => {
  assert.match(marketData, /const setupConflict = Boolean/);
  assert.match(marketData, /result\.validatedSetupConflict = setupConflict/);
  assert.match(marketData, /if \(!forecastActive \|\| setupConflict\)/);
  assert.match(marketData, /result\.setups = \[\]/);
  assert.match(marketData, /result\.bestSetup = null/);
});

test('snapshot contract is the only UI authority and forbids UI mutation', () => {
  assert.match(snapshot, /AMY_SMC_D_SINGLE_MAPPING_AUTHORITY/);
  assert.match(snapshot, /direction:\s*'AMY_SMC_D_NEXT_MOVE'/);
  assert.match(snapshot, /executionRole:\s*'READ_ONLY_CONSUMER'/);
  assert.match(snapshot, /closedCandleOnly: true/);
  assert.match(snapshot, /mayRewriteClosedCandleFacts: false/);
  assert.match(snapshot, /uiMayMutate: false/);
  assert.match(marketData, /buildMappingSnapshot/);
});
