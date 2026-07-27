import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-live-consistency-v1.js';

test('mapping page loads live consistency runtime after core mapping modules', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const core = html.indexOf('js/mapping-v2.js');
  const consistency = html.indexOf('js/mapping-live-consistency-v1.js');
  assert.ok(core >= 0, 'mapping-v2 runtime missing');
  assert.ok(consistency > core, 'consistency runtime must load after mapping-v2');
});

test('live consistency runtime is valid JavaScript without a DOM observer loop', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, runtimePath)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('fresh label requires same-timeframe non-expired analysis timestamp', async () => {
  const source = await read(runtimePath);
  assert.match(source, /ANALYSIS_MAX_AGE_MS = 5 \* 60 \* 1000/);
  assert.match(source, /sameTimeframe/);
  assert.match(source, /Date\.now\(\) - capturedAt <= ANALYSIS_MAX_AGE_MS/);
  assert.match(source, /!mappingExplicitlyStale\(mapping\)/);
  assert.match(source, /DATA USANG\|EXPIRED\|INVALID/);
});

test('connected live price never claims M15 Fresh while Mapping is expired', async () => {
  const source = await read(runtimePath);
  assert.match(source, /Connected · \$\{state\.tf\} Fresh/);
  assert.match(source, /Price Live · \$\{state\.tf\} Expired/);
  assert.match(source, /Mapping \$\{state\.tf\} kedaluwarsa/);
  assert.match(source, /data-analysis-freshness/);
});

test('expired Mapping triggers guarded candle analysis refresh so BSL and SSL can repopulate', async () => {
  const source = await read(runtimePath);
  assert.match(source, /return !mappingIsFresh\(mapping\) \|\| isCandleStale\(state\.tf\)/);
  assert.match(source, /await runAnalysis\(state\.tf\)/);
  assert.match(source, /REFRESH_COOLDOWN_MS = 30 \* 1000/);
  assert.match(source, /refreshInFlight/);
  assert.match(source, /amyfx:market-update/);
  assert.doesNotMatch(source, /new MutationObserver/);
});

test('Mapping user-facing clocks are normalized to WITA', async () => {
  const source = await read(runtimePath);
  assert.match(source, /WITA \$\{nowTime\(\)\}/);
  assert.match(source, /replace\(\/\\bWIB\\b\/g, "WITA"\)/);
  assert.match(source, /kz-wita/);
});

test('command strip only exposes BSL and SSL from fresh source data', async () => {
  const source = await read('app/src/main/assets/apps/shared/market-intelligence.js');
  assert.match(source, /const mappingBsl = partIsFresh\(mapping\)/);
  assert.match(source, /const mappingSsl = partIsFresh\(mapping\)/);
  assert.match(source, /bsl \? Number\(bsl\.price\)\.toFixed\(2\) : '--'/);
  assert.match(source, /ssl \? Number\(ssl\.price\)\.toFixed\(2\) : '--'/);
});
