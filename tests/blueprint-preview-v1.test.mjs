import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');

const modulePages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html'
];

test('blueprint runtime defines canonical contracts and lifecycle', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js');
  for (const contract of ['MarketSnapshot', 'Decision', 'SetupEvent', 'LiquiditySnapshot', 'JournalEntry', 'ContextEnvelope', 'Conversation', 'MigrationLedger']) {
    assert.match(source, new RegExp(`\\b${contract}\\b`));
  }
  for (const state of ['DATA_INVALID', 'WAIT', 'WATCH', 'ARMED', 'TRIGGERED', 'MANAGEMENT', 'TP', 'SL', 'EXPIRED', 'CANCELLED', 'REPLACED']) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  assert.match(source, /Asia\/Makassar/);
  assert.match(source, /WAIT adalah keputusan valid/);
  assert.match(source, /Context Envelope/);
});

test('global mentor is installed in every principal module', async () => {
  for (const page of modulePages) {
    const html = await read(page);
    assert.match(html, /data-amyfx-blueprint-css="v1"/, `${page} missing blueprint CSS`);
    assert.match(html, /data-amyfx-blueprint-js="v1"/, `${page} missing blueprint runtime`);
  }
});

test('native secret vault never exposes a secret getter to WebView', async () => {
  const bridge = await read('app/src/main/java/com/amyelitesuite/AmyFxAiBridge.kt');
  const activity = await read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  assert.match(activity, /addJavascriptInterface\(AmyFxAiBridge\(this, webView\), "AmyNativeAI"\)/);
  assert.match(bridge, /EncryptedSharedPreferences|SecurePrefs\.putString/);
  assert.match(bridge, /fun storeSecret/);
  assert.match(bridge, /fun listSecrets/);
  assert.match(bridge, /fun deleteSecret/);
  assert.match(bridge, /fun send/);
  assert.doesNotMatch(bridge, /fun\s+(get|read|export)Secret\s*\(/);
  assert.doesNotMatch(bridge, /return\s+SecurePrefs\.getString/);
  for (const host of ['generativelanguage.googleapis.com', 'openrouter.ai', 'api.deepseek.com']) assert.match(bridge, new RegExp(host.replaceAll('.', '\\.')));
});

test('private Preview release remains isolated from production main', async () => {
  const workflow = await read('.github/workflows/amyfx-blueprint-preview-release.yml');
  assert.match(workflow, /personal\/amyfx-private/);
  assert.match(workflow, /com\.amyelitesuite\.learningpreview/);
  assert.match(workflow, /Amy FX Preview/);
  assert.match(workflow, /amyfxpreview/);
  assert.match(workflow, /AMYFX_VERSION_NAME: 2\.0\.0-preview\.292/);
  assert.match(workflow, /AMYFX_VERSION_CODE: "940292"/);
  assert.match(workflow, /test "\$version_code" -gt "\$published_code"/);
  assert.match(workflow, /preview-update\.json/);
  assert.doesNotMatch(workflow, /git push origin (?:HEAD:)?main/);
  assert.doesNotMatch(workflow, /refs\/heads\/main/);
});

test('blueprint assets are non-empty and syntax checked by release gate', async () => {
  const jsStat = await stat(new URL('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js', root));
  const cssStat = await stat(new URL('app/src/main/assets/apps/shared/amyfx-blueprint-v1.css', root));
  assert.ok(jsStat.size > 20_000);
  assert.ok(cssStat.size > 2_000);
  const workflow = await read('.github/workflows/amyfx-blueprint-preview-release.yml');
  assert.match(workflow, /node --check app\/src\/main\/assets\/apps\/shared\/amyfx-blueprint-v1\.js/);
  assert.match(workflow, /testReleaseUnitTest/);
  assert.match(workflow, /lintRelease/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /apksigner/);
});
