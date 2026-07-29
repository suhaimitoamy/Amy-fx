import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-live-consistency-v1.js';
const contractPath = 'app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js';

test('mapping page loads live consistency runtime after core mapping modules', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const contract = html.indexOf('data-amyfx-market-contract="v2"');
  const core = html.indexOf('js/mapping-v2.js');
  const consistency = html.indexOf('js/mapping-live-consistency-v1.js');
  assert.ok(contract >= 0, 'canonical market contract missing');
  assert.ok(core > contract, 'mapping core must load after canonical market contract');
  assert.ok(consistency > core, 'consistency runtime must load after mapping-v2');
});

test('live consistency runtime is valid JavaScript without a DOM observer loop', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, runtimePath)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('fresh status requires same-timeframe canonical Mapping freshness', async () => {
  const source = await read(runtimePath);
  assert.match(source, /contract\?\.assess\?\.\("mapping", mapping\)/);
  assert.match(source, /sameTimeframe/);
  assert.match(source, /fresh\.state === "FRESH"/);
  assert.match(source, /!mapping\?\.dataStale/);
  assert.doesNotMatch(source, /storedAt.*FRESH|Date\.now\(\).*storedAt/);
});

test('status dot never marks stale or expired Mapping as fresh', async () => {
  const source = await read(runtimePath);
  assert.match(source, /conn\.textContent !== "●"/);
  assert.match(source, /conn\.dataset\.quoteFreshness = quoteState/);
  assert.match(source, /conn\.dataset\.analysisFreshness = mappingState/);
  assert.match(source, /data-quote-freshness="LIVE"\]\[data-analysis-freshness="FRESH"/);
  assert.match(source, /data-analysis-freshness="STALE"/);
  assert.match(source, /data-analysis-freshness="EXPIRED"/);
  assert.match(source, /aria-label/);
  assert.doesNotMatch(source, /conn\.textContent\s*=\s*`Price|conn\.textContent\s*=\s*`Connected/);
});

test('expired Mapping triggers guarded candle analysis refresh so structure can repopulate', async () => {
  const source = await read(runtimePath);
  assert.match(source, /quoteFreshness\.state === "LIVE" && \(mappingFreshness\.state !== "FRESH" \|\| isCandleStale\(state\.tf\)\)/);
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

test('command strip exposes BSL and SSL only from canonical Intel Liquidity with explicit freshness', async () => {
  const source = await read('app/src/main/assets/apps/shared/market-intelligence.js');
  const contract = await read(contractPath);
  assert.match(source, /contract\.nearestLevels\(state\)/);
  assert.match(source, /levels\.bsl\?\.freshness \|\| 'UNAVAILABLE'/);
  assert.match(source, /levels\.ssl\?\.freshness \|\| 'UNAVAILABLE'/);
  assert.match(contract, /source: "INTEL_LIQUIDITY_ONLY"/);
  assert.match(contract, /const liquidity = state\?\.liquidity \|\| null/);
  assert.doesNotMatch(source, /mappingBsl|mappingSsl|heatmapBsl|heatmapSsl/);
});
