// Legacy Mapping contract retained for the archived Pro336 page.
// Production ICT workspace is covered by ict-workspace.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');

const modulePages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/legacy-index.html',
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

test('Pro release promotes Preview lineage into the Amy-fx-pro main channel', async () => {
  const workflow = await read('.github/workflows/build-apk.yml');
  const appVersion = await read('app/src/main/assets/app-version.js');
  const gradle = await read('app/build.gradle.kts');
  const identity = appVersion.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'current Pro identity must be readable from app-version.js');

  const [, versionName, sequenceText, versionCodeText] = identity;
  assert.equal(Number(versionCodeText), 950000 + Number(sequenceText));
  assert.equal(versionName, `2.0.0-pro.${sequenceText}`);
  assert.match(gradle, new RegExp(`versionCode = .*\\?: ${versionCodeText}\\)`));
  assert.match(gradle, new RegExp(`versionName = .*\\?: "${versionName.replaceAll('.', '\\.') }"`));

  assert.match(workflow, /branches:\s*(?:\[main\]|\n\s*-\s*main)/);
  assert.match(workflow, /com\.amyelitesuite\.learningpreview/);
  assert.match(workflow, /Amy FX Pro/);
  assert.match(workflow, /amyfxpreview/);
  assert.match(workflow, /Amy-fx-pro\/main\/update\.json/);
  assert.match(workflow, /Resolve source version/);
  assert.match(workflow, /app-version\.js/);
  assert.match(workflow, /AMYFX_VERSION_NAME=\$version_name/);
  assert.match(workflow, /AMYFX_VERSION_CODE=\$version_code/);
  assert.match(workflow, /AMYFX_RELEASE_TAG=amyfx-pro-\$version_name/);
  assert.match(workflow, /gh release create/);
  assert.doesNotMatch(workflow, /git push origin (?:HEAD:)?personal\/amyfx-private/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com\/suhaimitoamy\/Amy-fx\/main\/update\.json/);
});

test('blueprint assets are non-empty and syntax checked by Pro release gate', async () => {
  const jsStat = await stat(new URL('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js', root));
  const cssStat = await stat(new URL('app/src/main/assets/apps/shared/amyfx-blueprint-v1.css', root));
  assert.ok(jsStat.size > 20_000);
  assert.ok(cssStat.size > 2_000);
  const workflow = await read('.github/workflows/build-apk.yml');
  assert.match(workflow, /node --check app\/src\/main\/assets\/app-version\.js/);
  assert.match(workflow, /testReleaseUnitTest/);
  assert.match(workflow, /lintRelease/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /apksigner/);
});
