import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const router = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/strategy-router-engine.js', import.meta.url), 'utf8');
const marketData = await readFile(new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');

test('Market Shift stays advisory and cannot become an automatic hard gate', () => {
  assert.match(router, /const activeRegime = state\.activeRegime/);
  assert.doesNotMatch(router, /blockRecommended \? 'TRANSITION'/);
  assert.match(router, /marketShiftHardGate: false/);
});

test('Strategy Router cannot create or replace a primary setup', () => {
  assert.match(router, /const setup = null/);
  assert.match(router, /routerCanReplaceEntrySetup: false/);
  assert.match(router, /STRATEGY_SUITABILITY_ACCURACY_48_53_2022_2025/);
  assert.match(marketData, /mayReplaceEntryMap: false/);
  assert.match(marketData, /result\.routerCandidateSetup = router\.watchSetup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.setup/);
});

test('Entry Map remains non-primary while the UI presents it as a monitoring scenario', () => {
  assert.match(marketData, /ENTRY_MAP_REACTION_ACCURACY_48_24_2022_2025/);
  assert.match(marketData, /result\.experimentalSetups = experimentalSetups/);
  assert.match(marketData, /result\.experimentalBestSetup = experimentalBestSetup/);
  assert.match(marketData, /result\.setups = \[\]/);
  assert.match(marketData, /result\.bestSetup = null/);
  assert.match(marketData, /result\.signal = 'WAIT'/);
  assert.match(ui, /SKENARIO PEMANTAUAN/);
  assert.match(ui, /Konfirmasi harga tetap diperlukan/);
});

test('Validated Direction Forecast conflict protection remains active', () => {
  assert.match(marketData, /const setupConflict = Boolean/);
  assert.match(marketData, /result\.validatedSetupConflict = setupConflict/);
  assert.match(marketData, /KANDIDAT ROUTER BERTENTANGAN DENGAN DIRECTION FORECAST/);
});
