import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const router = await readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/strategy-router-engine.js', import.meta.url), 'utf8');
const marketData = await readFile(new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');

test('Market Shift is advisory and cannot become an automatic router hard gate', () => {
  assert.match(router, /const activeRegime = state\.activeRegime/);
  assert.doesNotMatch(router, /blockRecommended \? 'TRANSITION'/);
  assert.match(router, /marketShiftHardGate: false/);
});

test('Strategy Router is watch-only and cannot replace Entry Map', () => {
  assert.match(router, /const setup = null/);
  assert.match(router, /routerCanReplaceEntrySetup: false/);
  assert.match(marketData, /mayReplaceEntryMap: false/);
  assert.match(marketData, /result\.routerCandidateSetup = router\.watchSetup/);
  assert.doesNotMatch(marketData, /result\.bestSetup = router\.setup/);
});

test('Unstable Entry Map output is downgraded to WATCH and forecast conflicts are blocked', () => {
  assert.match(marketData, /ENTRY_MODEL_NOT_STABLE_2022_2025/);
  assert.match(marketData, /const setupConflict = Boolean/);
  assert.match(marketData, /result\.validatedSetupConflict = setupConflict/);
  assert.match(ui, /WATCH ONLY/);
  assert.match(ui, /bukan setup live/);
});
