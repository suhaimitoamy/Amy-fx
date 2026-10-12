import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('Amy FX Pro keeps Preview package lineage while using the Pro release identity', () => {
  const gradle = read('app/build.gradle.kts');
  const version = read('app/src/main/assets/app-version.js');
  const identity = version.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'current Pro identity must be readable from app-version.js');

  const [, versionName, suffixText, versionCodeText] = identity;
  const versionCode = Number(versionCodeText);
  assert.equal(versionCode, 950000 + Number(suffixText));

  assert.match(gradle, /val configuredApplicationId = System\.getenv\("AMYFX_APPLICATION_ID"\) \?: "com\.amyelitesuite\.learningpreview"/);
  assert.match(gradle, /val configuredAppLabel = System\.getenv\("AMYFX_APP_LABEL"\) \?: "Amy FX Pro"/);
  assert.match(gradle, /val configuredUriScheme = System\.getenv\("AMYFX_URI_SCHEME"\) \?: "amyfxpreview"/);
  assert.match(gradle, /Amy-fx-pro\/main\/update\.json/);
  assert.match(gradle, /applicationId = configuredApplicationId/);
  assert.match(gradle, new RegExp(`versionCode[^\\n]*${versionCode}`));
  assert.match(gradle, new RegExp(`versionName[^\\n]*"${escapeRegex(versionName)}"`));
});

test('published Pro metadata is never ahead of the Pro APK source version', () => {
  const metadata = JSON.parse(read('update.json'));
  const version = read('app/src/main/assets/app-version.js');
  const identity = version.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'current Pro source identity must be readable');
  const [, sourceName, , sourceCodeText] = identity;
  const sourceCode = Number(sourceCodeText);

  assert.equal(metadata.latest_version_code, metadata.versionCode);
  assert.equal(metadata.latest_version_name, metadata.version);
  assert.match(metadata.latest_version_name, /^2\.0\.0-pro\.\d+$/);
  assert.ok(Number(metadata.latest_version_code) <= sourceCode);
  if (Number(metadata.latest_version_code) === sourceCode) {
    assert.equal(metadata.latest_version_name, sourceName);
  }
  const publishedTag = `amyfx-pro-${metadata.latest_version_name}`;
  assert.match(metadata.apk_url || metadata.downloadUrl || '', new RegExp(`${escapeRegex(publishedTag)}/AmyFX-Pro-latest\\.apk`));
  assert.ok(Array.isArray(metadata.release_notes));
  assert.ok(metadata.release_notes.length > 0);
});

test('Twelve Data WebSocket credentials stay out of source and WebView storage', () => {
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const bridge = read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js');
  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  const priceBridge = read('app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt');
  assert.doesNotMatch(main, /localStorage\.getItem\('twelve_api_key'\)/);
  assert.doesNotMatch(bridge, /localStorage\.setItem\('twelve_api_key'/);
  assert.doesNotMatch(native, /putString\("api_key"/);
  assert.doesNotMatch(native, /SecurePrefs\.putString\(mContext, "api_key"/);
  assert.match(native, /SecurePrefs\.remove\(mContext, "api_key"\)/);
  assert.match(native, /addJavascriptInterface\(twelveDataPriceBridge, "AmyLivePrice"\)/);
  assert.doesNotMatch(priceBridge, /SecurePrefs\.putString|configuredApiKey/);
  assert.doesNotMatch(priceBridge, /BuildConfig\.TWELVE_DATA_API_KEY/);
  assert.match(priceBridge, /fun hasApiKey\(\): Boolean/);
  assert.doesNotMatch(priceBridge, /fun (?:get|read|export)ApiKey\(/);
});

test('market proxy accepts only validated server-side requests', () => {
  const api = read('api/twelvedata.js');
  const store = read('lib/market-candle-store.mjs');
  assert.match(api, /process\.env\.TWELVEDATA_API_KEY/);
  assert.doesNotMatch(api, /req\.query[^\n]*apikey/);
  assert.match(api, /req\.method !== 'GET'/);
  assert.match(api, /ALLOWED_INTERVALS\.has\(interval\)/);
  assert.match(store, /new AbortController\(\)/);
  assert.match(store, /PROVIDER_TIMEOUT_MS/);
  assert.match(store, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(store, /req\.query[^\n]*apikey/);
});

test('native notifications only open trusted local routes', () => {
  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  assert.match(native, /normalizeLocalUrl\(url\)/);
  assert.match(native, /setSmallIcon\(R\.drawable\.ic_stat_amy_fx\)/);
});

test('active Pro release workflow pins signing continuity and verifies the built APK', () => {
  const gradle = read('app/build.gradle.kts');
  assert.match(gradle, /enableV1Signing = true/);
  assert.match(gradle, /enableV2Signing = true/);

  const workflow = read('.github/workflows/build-apk.yml');
  assert.match(workflow, /Resolve source version/);
  assert.match(workflow, /AMYFX_VERSION_NAME=\$version_name/);
  assert.match(workflow, /AMYFX_VERSION_CODE=\$version_code/);
  assert.match(workflow, /AMYFX_RELEASE_TAG=amyfx-pro-\$version_name/);
  assert.doesNotMatch(workflow, /amy-fx-debug-keystore-v1/);
  assert.match(workflow, /amy-fx-pro-signing-key-v1/);
  assert.match(workflow, /AMYFX_PRO_KEYSTORE_BASE64/);
  assert.match(workflow, /97:E0:B1:B6:F6:A1:B3:98:59:00:69:7F:97:63:51:B6:09:BD:BC:ED:19:07:FE:EC:90:49:EC:8F:D7:B5:02:32/);
  assert.doesNotMatch(workflow, /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/);
  assert.match(workflow, /test "\$actual" = "\$AMYFX_SIGNING_CERT_SHA256"/);
  assert.match(workflow, /keytool -list -v/);
  assert.match(workflow, /apksigner" verify --verbose --print-certs/);
  assert.match(workflow, /aapt" dump badging/);
  assert.match(workflow, /Publish Amy FX Pro release/);
  assert.match(workflow, /Verify published APK endpoint/);

  const manual = read('.github/workflows/build-release.yml');
  assert.match(manual, /workflow_dispatch/);
  const preview = read('.github/workflows/build-learning-preview.yml');
  assert.match(preview, /github\.head_ref == 'feature\/learning-context-stage1'/);
  const candidate = read('.github/workflows/stage5-apply.yml');
  assert.match(candidate, /workflow_dispatch/);
  assert.match(candidate, /github\.head_ref == 'agent\/amyfx-stage5-release'/);
  assert.doesNotMatch(candidate, /push:\s*\n\s*branches:\s*\n\s*- main/);
});

test('public Firebase Android client remains bound to the public release applicationId', () => {
  const firebase = JSON.parse(read('app/google-services.json'));
  assert.equal(firebase.client[0].client_info.android_client_info.package_name, 'com.amyelitesuite');
  assert.equal('private_key' in firebase, false);
});
