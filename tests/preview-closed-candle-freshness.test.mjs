import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js';
const runtime = readFileSync(`${root}/${runtimePath}`, 'utf8');

test('Preview keeps valid closed-candle cache analyzable without a freshness hard gate', () => {
  const syntax = spawnSync(process.execPath, ['--check', `${root}/${runtimePath}`], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  assert.match(runtime, /markCachedSeriesUsable/);
  assert.match(runtime, /setCandleFetchedAt\(tf, nowMs\)/);
  assert.match(runtime, /candle\?\.isClosed !== false/);
  assert.match(runtime, /sourceSignature/);
  assert.match(runtime, /latestClosedCandleClose/);
  assert.match(runtime, /dataStale: false/);
  assert.match(runtime, /version: '5\.0\.0'/);
});

test('Preview preserves the previous result when a provider failure returns DATA_STALE', () => {
  assert.match(runtime, /state\.result\?\.dataStale && previousResult/);
  assert.match(runtime, /state\.result = previousResult/);
  assert.match(runtime, /window\.runAnalysis = tf => refreshMapping/);
});

test('Preview Mapping runtime is event-driven instead of periodic', () => {
  assert.doesNotMatch(runtime, /setInterval/);
  assert.doesNotMatch(runtime, /addEventListener\('focus'/);
  assert.doesNotMatch(runtime, /addEventListener\('online'/);
  assert.doesNotMatch(runtime, /visibilitychange/);
  assert.match(runtime, /amyfx:candles-updated/);
  assert.match(runtime, /amyfx:mapping-refresh-request/);
});
