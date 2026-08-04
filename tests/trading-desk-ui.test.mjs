import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const asset = relative => new URL(`../app/src/main/assets/${relative}`, import.meta.url);
const read = relative => readFileSync(asset(relative), 'utf8');

function assertSyntax(relative) {
  const url = asset(relative);
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Trading Desk presentation loads after the legacy design contract', () => {
  const home = read('index.html');
  const mapping = read('apps/mapping/index.html');

  assert.match(home, /amyfx-trading-desk-v1\.css/);
  assert.ok(home.indexOf('amyfx-trading-desk-v1.css') > home.indexOf('amyfx-components.css'));
  assert.match(home, /amyfx-trading-desk-home-v1\.js/);
  assert.ok(home.indexOf('amyfx-trading-desk-home-v1.js') > home.indexOf('amyfx-blueprint-hotfix-v1.js'));

  assert.match(mapping, /amyfx-trading-desk-v1\.css/);
  assert.match(mapping, /css\/trading-desk-v1\.css/);
  assert.ok(mapping.indexOf('css/trading-desk-v1.css') > mapping.indexOf('amyfx-components.css'));
  assert.match(mapping, /js\/trading-desk-ui-v1\.js/);
});

test('Trading Desk uses calm solid surfaces and keeps state colors semantic', () => {
  const shared = read('apps/shared/amyfx-trading-desk-v1.css');
  const mapping = read('apps/mapping/css/trading-desk-v1.css');

  assert.match(shared, /--desk-bg:\s*#0b0e12/i);
  assert.match(shared, /--desk-surface:\s*#11151b/i);
  assert.match(shared, /--desk-accent:\s*#4c8dff/i);
  assert.match(shared, /--desk-buy:\s*#2fbf71/i);
  assert.match(shared, /--desk-sell:\s*#f05a67/i);
  assert.match(shared, /--desk-wait:\s*#d8a23a/i);
  assert.match(shared, /background-image:\s*none\s*!important/);
  assert.match(shared, /backdrop-filter:\s*none\s*!important/);

  assert.match(mapping, /\.amy-sticky-bar[\s\S]*display:\s*none\s*!important/);
  assert.match(mapping, /\.execution-plan[\s\S]*border-left:\s*3px solid/);
  assert.match(mapping, /\.nav[\s\S]*background:\s*var\(--mapping-panel-raised\)/);
  assert.match(mapping, /\.decision-main\.buy/);
  assert.match(mapping, /\.decision-main\.sell/);
  assert.match(mapping, /\.decision-main\.wait/);
});

test('home snapshot is derived from existing local state without polling or fabricated market values', () => {
  const homeUi = read('apps/shared/amyfx-trading-desk-home-v1.js');

  assertSyntax('apps/shared/amyfx-trading-desk-home-v1.js');
  assert.match(homeUi, /amy_mapping_analyses/);
  assert.match(homeUi, /amy_entry_watch_state_v3/);
  assert.match(homeUi, /data-open="mapping"/);
  assert.match(homeUi, /Belum ada snapshot Mapping|Belum ada candle tersimpan/);
  assert.doesNotMatch(homeUi, /setInterval\s*\(/);
  assert.doesNotMatch(homeUi, /fetch\s*\(/);
  assert.doesNotMatch(homeUi, /WebSocket\s*\(/);
});

test('Mapping UI helper changes presentation copy only and does not touch engine state', () => {
  const mappingUi = read('apps/mapping/js/trading-desk-ui-v1.js');

  assertSyntax('apps/mapping/js/trading-desk-ui-v1.js');
  assert.match(mappingUi, /WAITING_FOR_AREA/);
  assert.match(mappingUi, /Menunggu harga masuk area/);
  assert.match(mappingUi, /MutationObserver/);
  assert.doesNotMatch(mappingUi, /localStorage\.setItem/);
  assert.doesNotMatch(mappingUi, /setInterval\s*\(/);
  assert.doesNotMatch(mappingUi, /fetch\s*\(/);
  assert.doesNotMatch(mappingUi, /entryAllowed\s*=/);
  assert.doesNotMatch(mappingUi, /setupExecution\s*=/);
});

test('Preview 311 identity remains consistent before and after CI release activation', () => {
  const version = read('app-version.js');
  const gradle = readFileSync(new URL('../app/build.gradle.kts', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../preview-update.json', import.meta.url), 'utf8'));

  assert.match(version, /2\.0\.0-preview\.311/);
  assert.match(version, /code:\s*940311/);
  assert.match(gradle, /940311/);
  assert.match(gradle, /2\.0\.0-preview\.311/);

  const publishedCode = Number(manifest.latest_version_code);
  assert.ok(publishedCode <= 940311);
  if (publishedCode === 940311) {
    assert.equal(manifest.latest_version_name, '2.0.0-preview.311');
  }
});
