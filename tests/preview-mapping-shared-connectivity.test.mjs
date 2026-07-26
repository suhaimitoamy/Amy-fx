import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = 'app/src/main/assets/apps/mapping/js/blueprint-context-bridge.js';
const absolute = path.join(root, relative);
const read = () => readFile(absolute, 'utf8');

test('Mapping bridge JavaScript is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Mapping publishes a canonical snapshot into shared Market Intelligence', async () => {
  const source = await read();
  assert.match(source, /window\.AmyFXIntel\.write\("mapping", payload\)/);
  assert.match(source, /source:\s*"mapping-context-bridge-v2"/);
  assert.match(source, /pair:\s*marketState\.pair/);
  assert.match(source, /timeframe:\s*marketState\.timeframe/);
  assert.match(source, /price:\s*marketState\.price/);
  assert.match(source, /levels,/);
  assert.match(source, /bsl:\s*nearest\("BSL"\)/);
  assert.match(source, /ssl:\s*nearest\("SSL"\)/);
});

test('Mapping never invents a current timestamp for missing or stale market data', async () => {
  const source = await read();
  assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\s*:\s*null/);
  assert.match(source, /if \(!valid\.length\) return null/);
  assert.match(source, /dataStale = Boolean\(result\?\.dataStale \|\| !capturedAt/);
  assert.match(source, /if \(!marketState\.capturedAt \|\| !marketState\.price \|\| marketState\.dataStale\) return false/);
});

test('shared Mapping publication is deduplicated and guarded against market-update loops', async () => {
  const source = await read();
  assert.match(source, /let lastSharedFingerprint = ""/);
  assert.match(source, /let writingShared = false/);
  assert.match(source, /if \(fingerprint === lastSharedFingerprint\) return true/);
  assert.match(source, /if \(!writingShared\) publish\(true\)/);
  assert.match(source, /finally \{\s*writingShared = false/);
});
