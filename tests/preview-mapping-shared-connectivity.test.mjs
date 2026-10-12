import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgeRelative = 'app/src/main/assets/apps/mapping/js/blueprint-context-bridge.js';
const marketDataRelative = 'app/src/main/assets/apps/mapping/js/api/market-data.js';
const bridgeAbsolute = path.join(root, bridgeRelative);
const readBridge = () => readFile(bridgeAbsolute, 'utf8');
const readMarketData = () => readFile(path.join(root, marketDataRelative), 'utf8');

test('Mapping bridge JavaScript is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', bridgeAbsolute], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Mapping engine publishes canonical state once and bridge consumes that shared snapshot', async () => {
  const bridge = await readBridge();
  const marketData = await readMarketData();
  assert.match(marketData, /intel\.write\('mapping', \{/);
  assert.match(bridge, /const contract = window\.AmyFXMarketContract/);
  assert.match(bridge, /contract\?\.read\?\.\(\)/);
  assert.match(bridge, /contract\?\.snapshot\?\.\(state\)/);
  assert.match(bridge, /quoteCapturedAt:/);
  assert.match(bridge, /mappingCapturedAt:/);
  assert.match(bridge, /liquidityCapturedAt:/);
  assert.match(bridge, /heatmapCapturedAt:/);
  assert.doesNotMatch(bridge, /AmyFXIntel\.write\(["']mapping["']/);
});

test('Mapping bridge never invents a current source timestamp', async () => {
  const source = await readBridge();
  assert.match(source, /capturedAt:\s*mapping\.capturedAt \|\| null/);
  assert.match(source, /updatedAt:\s*mapping\.computedAt \|\| mapping\.capturedAt \|\| null/);
  assert.match(source, /quoteCapturedAt:\s*quote\.capturedAt \|\| null/);
  assert.match(source, /mappingCapturedAt:\s*mapping\.capturedAt \|\| null/);
  assert.match(source, /dataStale:\s*mappingFreshness\.state === "STALE" \|\| mappingFreshness\.state === "EXPIRED"/);
  assert.doesNotMatch(source, /Date\.now\(\).*capturedAt|new Date\(\)\.toISOString\(\).*capturedAt/);
});

test('shared Mapping publication is deduplicated without a market-update write loop', async () => {
  const source = await readBridge();
  assert.match(source, /let lastFingerprint = ""/);
  assert.match(source, /if \(!force && fingerprint === lastFingerprint\) return true/);
  assert.match(source, /lastFingerprint = fingerprint/);
  assert.match(source, /window\.addEventListener\("amyfx:candles-updated", \(\) => publish\(true\)\)/);
  assert.doesNotMatch(source, /amyfx:market-update/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /writingShared|AmyFXIntel\.write|MarketContract\?\.write/);
});
