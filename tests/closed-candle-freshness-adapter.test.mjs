import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const adapter = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/closed-candle-freshness-adapter-v1.js', import.meta.url),
  'utf8'
);
const mappingV2 = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-v2.js', import.meta.url),
  'utf8'
);
const stability = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js', import.meta.url),
  'utf8'
);
const appVersion = fs.readFileSync(
  new URL('../app/src/main/assets/app-version.js', import.meta.url),
  'utf8'
);

test('closed-candle adapter is loaded after Mapping clarity', () => {
  assert.match(mappingV2, /mapping-clarity-v1\.js/);
  assert.match(mappingV2, /closed-candle-freshness-adapter-v1\.js/);
  assert.ok(
    mappingV2.indexOf('mapping-clarity-v1.js') < mappingV2.indexOf('closed-candle-freshness-adapter-v1.js')
  );
});

test('last closed candle remains the displayed analysis source', () => {
  assert.match(adapter, /Basis candle terakhir tertutup/);
  assert.match(adapter, /CLOSED_CANDLE/);
  assert.match(adapter, /state\.result\.dataStale = false/);
  assert.match(adapter, /Status data lama tidak menghapus arah market/);
  assert.doesNotMatch(adapter, /ANALISIS KEDALUWARSA/);
  assert.doesNotMatch(adapter, /Freshness resmi menandai/);
});

test('stale command-strip labels are replaced without nested mutation loops', () => {
  assert.match(adapter, /CANDLE TERTUTUP/);
  assert.match(adapter, /subtree: false/);
  assert.doesNotMatch(adapter, /amyfx:market-update/);
});

test('analysis badge reports a closed-candle source instead of stale', () => {
  assert.match(stability, /CANDLE TERTUTUP/);
  assert.match(stability, /latestClosedCandle/);
  assert.doesNotMatch(stability, /M15 STALE/);
});

test('checkpoint does not bump Preview version', () => {
  assert.match(appVersion, /2\.0\.0-preview\.305/);
});
