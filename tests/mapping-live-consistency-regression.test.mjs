import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-live-consistency-v1.js';
const clockPath = 'app/src/main/assets/apps/mapping/js/clock-sync.js';
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

test('live consistency and clock runtimes are valid JavaScript', () => {
  for (const relative of [runtimePath, clockPath]) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('fresh status requires same-timeframe canonical Mapping freshness', async () => {
  const source = await read(runtimePath);
  assert.match(source, /contract\?\.assess\?\.\("mapping", mapping\)/);
  assert.match(source, /sameTimeframe/);
  assert.match(source, /fresh\.state === "FRESH"/);
  assert.match(source, /!mapping\?\.dataStale/);
  assert.doesNotMatch(source, /storedAt.*FRESH|Date\.now\(\).*storedAt/);
});

test('Mapping header exposes only one fixed-width status dot', async () => {
  const [source, html] = await Promise.all([
    read(runtimePath),
    read('app/src/main/assets/apps/mapping/index.html')
  ]);
  assert.match(html, /<div id="conn" class="status"[^>]*>●<\/div>/);
  assert.doesNotMatch(html, /id="conn"[^>]*>Offline<\/div>/);
  assert.match(source, /conn\.textContent = "●";/);
  assert.match(source, /width:18px;/);
  assert.match(source, /min-width:18px;/);
  assert.match(source, /max-width:18px;/);
  assert.match(source, /flex:0 0 18px;/);
  assert.match(source, /height:18px;/);
  assert.match(source, /padding:0 !important;/);
  assert.match(source, /overflow:hidden;/);
  assert.match(source, /white-space:nowrap;/);
});

test('status dot never marks stale or expired Mapping as fresh', async () => {
  const source = await read(runtimePath);
  assert.match(source, /conn\.dataset\.quoteFreshness = quoteState/);
  assert.match(source, /conn\.dataset\.analysisFreshness = mappingState/);
  assert.match(source, /data-quote-freshness="LIVE"\]\[data-analysis-freshness="FRESH"/);
  assert.match(source, /data-analysis-freshness="STALE"/);
  assert.match(source, /data-analysis-freshness="EXPIRED"/);
  assert.match(source, /data-quote-freshness="OFFLINE"/);
  assert.match(source, /aria-label/);
});

test('legacy top status clocks are empty and removed from header layout', async () => {
  const [source, clock] = await Promise.all([read(runtimePath), read(clockPath)]);
  assert.match(source, /#top-wib,\s*#top-wita\s*\{\s*display:none !important;/s);
  assert.match(source, /topTime\.textContent = "";/);
  assert.match(source, /topTime\.style\.display = "none";/);
  assert.match(clock, /getElementById\('top-wib'\) \|\| document\.getElementById\('top-wita'\)/);
  assert.match(clock, /setText\(top, ''\)/);
  assert.match(clock, /top\.style\.display = 'none'/);
});

test('expired Mapping requests the exact closed-candle coordinator without direct analysis or polling', async () => {
  const source = await read(runtimePath);
  assert.match(source, /amyfx:candle-refresh-request/);
  assert.match(source, /MAPPING_CONSISTENCY_EVENT_DRIVEN/);
  assert.match(source, /REFRESH_COOLDOWN_MS = 30 \* 1000/);
  assert.match(source, /refreshInFlight/);
  assert.doesNotMatch(source, /await runAnalysis\(/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /new MutationObserver/);
});

test('live price events only synchronize status and do not request Mapping recalculation', async () => {
  const source = await read(runtimePath);
  assert.match(source, /amyfx:live-price-display", scheduleSync/);
  const start = source.indexOf('window.addEventListener("amyfx:live-price-display"');
  const end = source.indexOf('window.addEventListener("amyfx:market-update"', start);
  const listener = source.slice(start, end);
  assert.doesNotMatch(listener, /refresh|candle-refresh-request|runAnalysis/);
});

test('Mapping user-facing session clocks remain normalized to WITA', async () => {
  const source = await read(runtimePath);
  assert.match(source, /killzoneTime\.textContent = `WITA \$\{nowTime\(\)\}`/);
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
