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
const updateManifest = JSON.parse(fs.readFileSync(
  new URL('../update.json', import.meta.url),
  'utf8'
));

test('closed-candle adapter is loaded after Mapping clarity', () => {
  assert.match(mappingV2, /mapping-clarity-v1\.js/);
  assert.match(mappingV2, /closed-candle-freshness-adapter-v1\.js/);
  assert.ok(
    mappingV2.indexOf('mapping-clarity-v1.js') < mappingV2.indexOf('closed-candle-freshness-adapter-v1.js')
  );
});

test('last closed candle remains the displayed analysis source without mutating engine freshness', () => {
  assert.match(adapter, /Basis candle terakhir tertutup/);
  assert.match(adapter, /CLOSED_CANDLE/);
  assert.match(adapter, /hasClosedCandle/);
  assert.match(adapter, /Freshness tetap menjadi proteksi internal/);
  assert.doesNotMatch(adapter, /state\.result\.dataStale\s*=\s*false/);
  assert.doesNotMatch(adapter, /ANALISIS KEDALUWARSA/);
});

test('stale labels are presentation-only and do not create nested mutation loops', () => {
  assert.match(adapter, /CANDLE TERTUTUP/);
  assert.match(adapter, /subtree: false/);
  assert.doesNotMatch(adapter, /amyfx:market-update/);
});

test('analysis badge reports a closed-candle source instead of stale', () => {
  assert.match(stability, /CANDLE TERTUTUP/);
  assert.match(stability, /latestClosedCandle/);
  assert.doesNotMatch(stability, /M15 STALE/);
});

test('Pro release source advances beyond the active manifest when a release is pending', () => {
  const match = appVersion.match(/name:\s*'2\.0\.0-pro\.(\d+)'\s*,\s*code:\s*(95\d{4})/);
  assert.ok(match, 'Pro source identity must be readable');
  const sourceSequence = Number(match[1]);
  const sourceCode = Number(match[2]);
  const publishedCode = Number(updateManifest.latest_version_code);
  const publishedSequence = Number(String(updateManifest.latest_version_name || '').split('.').pop());

  assert.equal(sourceCode, 950000 + sourceSequence);
  assert.ok(sourceCode >= publishedCode, 'Pro source must not be older than the active manifest');
  if (sourceCode > publishedCode) assert.ok(sourceSequence > publishedSequence);
});
