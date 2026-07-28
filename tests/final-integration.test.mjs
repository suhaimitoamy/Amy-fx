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
  'app/src/main/assets/apps/mapping/js/engine/concept-entry-map-v3.js',
  'app/src/main/assets/apps/mapping/js/engine/mapping-timeframes.js',
  'app/src/main/assets/apps/mapping/js/engine/mapping-snapshot.js',
  'app/src/main/assets/apps/mapping/js/engine/validated-market-context-balanced.js',
  'app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js',
  'app/src/main/assets/apps/mapping/js/integrity/mapping-integrity-core.js'
];

test('all critical Mapping modules pass JavaScript syntax validation', () => {
  for (const module of criticalModules) {
    execFileSync(process.execPath, ['--check', fileURLToPath(path(module))], { stdio: 'pipe' });
  }
});

test('causal all-timeframe Entry Map owns execution and the watch runtime is read-only', () => {
  const analyze = source('app/src/main/assets/apps/mapping/js/engine/concept-analyze.js');
  const runtime = source('app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js');

  assert.match(analyze, /detectTimeframeEntryMap/);
  assert.match(analyze, /activeSetup \? \[activeSetup\] : \[\]/);
  assert.match(analyze, /bestSetup: activeSetup/);
  assert.match(analyze, /AMY_CAUSAL_ENTRY_MAP_MONITOR/);
  assert.doesNotMatch(analyze, /legacyEntryMap/);
  assert.match(runtime, /result\.mappingSnapshot/);
  assert.match(runtime, /READ ONLY/);
  assert.doesNotMatch(runtime, /result\.bestSetup\s*=/);
  assert.doesNotMatch(runtime, /result\.setups\s*=/);
});

test('Mapping UI loads one read-only watch, all timeframe controls, and WITA labels', () => {
  const html = source('app/src/main/assets/apps/mapping/index.html');
  const main = source('app/src/main/assets/apps/mapping/js/main.js');
  const ui = source('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const timeframes = source('app/src/main/assets/apps/mapping/js/engine/mapping-timeframes.js');

  assert.match(html, /entry-watch-runtime-v2\.js/);
  assert.doesNotMatch(html, /entry-map-ui-sync\.js/);
  assert.doesNotMatch(html, /src="js\/entry-watch-runtime\.js"/);
  assert.match(main, /Asia\/Makassar/);
  assert.doesNotMatch(main, /Asia\/Jakarta/);
  assert.match(ui, /SUPPORTED_MAPPING_TIMEFRAMES/);
  assert.match(ui, /Mapping Semua Timeframe/);
  for (const tf of ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']) {
    assert.match(timeframes, new RegExp(`'${tf}'`));
  }
});
