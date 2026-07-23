import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const source = relative => readFileSync(path(relative), 'utf8');

const criticalModules = [
  'app/src/main/assets/apps/mapping/js/main.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-analyze.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-engine.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-structure.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-liquidity.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-reference-levels.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-fvg.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-ob.js',
  'app/src/main/assets/apps/mapping/js/engine/concept-entry-map.js',
  'app/src/main/assets/apps/mapping/js/engine/entry-watch-hardening.js',
  'app/src/main/assets/apps/mapping/js/engine/validated-market-context-balanced.js',
  'app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js',
  'app/src/main/assets/apps/mapping/js/ui/entry-map-status.js',
  'app/src/main/assets/apps/mapping/js/entry-map-ui-sync.js'
];

test('all critical Mapping modules pass JavaScript syntax validation', () => {
  for (const module of criticalModules) {
    execFileSync(process.execPath, ['--check', fileURLToPath(path(module))], { stdio: 'pipe' });
  }
});

test('M15 Entry Map is audit-only and Multi-Timeframe Entry Watch owns execution', () => {
  const analyze = source('app/src/main/assets/apps/mapping/js/engine/concept-analyze.js');
  const runtime = source('app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js');
  const hardening = source('app/src/main/assets/apps/mapping/js/engine/entry-watch-hardening.js');

  assert.match(analyze, /setups: \[\]/);
  assert.match(analyze, /bestSetup: null/);
  assert.match(analyze, /signal: 'WAIT'/);
  assert.match(analyze, /status: 'REPLACED_BY_MULTI_TF_LEVEL_WATCH'/);
  assert.match(analyze, /legacyEntryMap: entryMap/);
  assert.match(runtime, /setupFromHardenedWatch\(watch\)/);
  assert.match(runtime, /result\.bestSetup = setup/);
  assert.match(hardening, /MULTI_TF_LEVEL_SWEEP_LOCKED/);
});

test('Mapping UI loads hardened Entry Watch while retaining Entry Map audit sync and WITA labels', () => {
  const html = source('app/src/main/assets/apps/mapping/index.html');
  const main = source('app/src/main/assets/apps/mapping/js/main.js');
  const sync = source('app/src/main/assets/apps/mapping/js/entry-map-ui-sync.js');

  assert.match(html, /entry-map-ui-sync\.js/);
  assert.match(html, /entry-watch-runtime-v2\.js/);
  assert.doesNotMatch(html, /src="js\/entry-watch-runtime\.js"/);
  assert.match(main, /Asia\/Makassar/);
  assert.doesNotMatch(main, /Asia\/Jakarta/);
  assert.match(sync, /Mode Eksekusi/);
  assert.match(sync, /RULE-BASED/);
  assert.match(sync, /WITA/);
});
