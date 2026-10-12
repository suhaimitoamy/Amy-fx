import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js';
const runtime = readFileSync(`${root}/${runtimePath}`, 'utf8');

test('Preview keeps cached closed-candle analysis visible without forging provider freshness', () => {
  const syntax = spawnSync(process.execPath, ['--check', `${root}/${runtimePath}`], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  assert.match(runtime, /inspectCachedSeries/);
  assert.match(runtime, /getCandleFetchedAt/);
  assert.match(runtime, /isCandleStale/);
  assert.match(runtime, /candle\?\.isClosed !== false/);
  assert.match(runtime, /sourceSignature/);
  assert.match(runtime, /latestClosedCandleClose/);
  assert.match(runtime, /providerDelayed/);
  assert.match(runtime, /executionFresh/);
  assert.match(runtime, /CACHED_PROVIDER_DELAYED/);
  assert.match(runtime, /version: '6\.0\.0'/);
  assert.doesNotMatch(runtime, /setCandleFetchedAt\(tf, nowMs\)/);
  assert.doesNotMatch(runtime, /dataStale:\s*false/);
});

test('Preview blocks execution nonterminally while provider refresh is delayed', () => {
  assert.match(runtime, /WAIT — PEMBARUAN CANDLE TERTUNDA/);
  assert.match(runtime, /lifecycleStage: 'DATA_DELAYED'/);
  assert.match(runtime, /executionBlocked: true/);
  assert.match(runtime, /freshnessBlocked: true/);
  assert.match(runtime, /terminal: false/);
  assert.match(runtime, /invalidated: false/);
  assert.match(runtime, /__amyFxFreshSetupExecution/);
});

test('Preview preserves the previous result when a provider failure returns DATA_STALE', () => {
  assert.match(runtime, /state\.result\?\.dataStale && previousResult/);
  assert.match(runtime, /state\.result = previousResult/);
  assert.match(runtime, /window\.runAnalysis = tf => refreshMapping/);
  assert.match(runtime, /publishFreshMappingClock\(\)/);
});

test('Preview Mapping runtime is event-driven instead of periodic', () => {
  assert.doesNotMatch(runtime, /setInterval/);
  assert.doesNotMatch(runtime, /addEventListener\('focus'/);
  assert.doesNotMatch(runtime, /addEventListener\('online'/);
  assert.doesNotMatch(runtime, /visibilitychange/);
  assert.match(runtime, /amyfx:candles-updated/);
  assert.match(runtime, /amyfx:mapping-refresh-request/);
});
