import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Amy FX public source uses the permanent production Android identity', () => {
  const gradle = read('app/build.gradle.kts');
  const version = read('app/src/main/assets/app-version.js');

  assert.match(gradle, /configuredApplicationId = System\.getenv\("AMYFX_APPLICATION_ID"\) \?: "com\.amyelitesuite"/);
  assert.match(gradle, /configuredAppLabel = System\.getenv\("AMYFX_APP_LABEL"\) \?: "Amy FX"/);
  assert.match(gradle, /configuredUriScheme = System\.getenv\("AMYFX_URI_SCHEME"\) \?: "amyfx"/);
  assert.match(gradle, /versionCode[^\n]*58/);
  assert.match(gradle, /versionName[^\n]*"2\.3\.0"/);
  assert.match(version, /name: '2\.3\.0', code: 58/);
  assert.match(version, /main\/update\.json/);
  assert.doesNotMatch(gradle, /learningpreview|Amy FX Preview|amyfxpreview|preview-update\.json/);
  assert.doesNotMatch(version, /personal\/amyfx-private|preview-update\.json|learningpreview|amyfxpreview/);
});

test('published public metadata is never ahead of the production source version', () => {
  const metadata = JSON.parse(read('update.json'));
  const versions = new Map([
    [40, '1.4.17'], [41, '1.5.0'], [42, '1.5.1'], [43, '1.5.2'], [44, '1.5.3'],
    [45, '1.5.4'], [46, '1.5.5'], [47, '1.5.6'], [48, '1.5.7'], [49, '1.5.8'],
    [50, '1.5.9'], [51, '2.0.0'], [52, '2.0.1'], [53, '2.0.2'], [54, '2.1.0'],
    [55, '2.1.1'], [56, '2.2.0'], [57, '2.2.1'], [58, '2.3.0']
  ]);

  assert.equal(metadata.latest_version_name, versions.get(Number(metadata.latest_version_code)));
  assert.ok(Number(metadata.latest_version_code) <= 58);
  assert.ok(Array.isArray(metadata.release_notes) && metadata.release_notes.length > 0);
  assert.match(metadata.apk_url || metadata.downloadUrl || '', /AmyFX-latest\.apk/);
  assert.doesNotMatch(metadata.apk_url || metadata.downloadUrl || '', /AmyFX-Preview-latest\.apk/);
});

test('native WebSocket credential stays native and REST remains candle-only', () => {
  const gradle = read('app/build.gradle.kts');
  const native = read('app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt');
  const activity = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const bridge = read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js');
  const market = read('app/src/main/assets/apps/mapping/js/api/market-data.js');

  assert.match(gradle, /TWELVE_DATA_API_KEY/);
  assert.match(native, /BuildConfig\.TWELVE_DATA_API_KEY/);
  assert.match(native, /wss:\/\/ws\.twelvedata\.com/);
  assert.match(activity, /addJavascriptInterface\(twelveDataPriceBridge, "AmyLivePrice"\)/);
  assert.doesNotMatch(main, /localStorage\.getItem\('twelve_api_key'\)/);
  assert.doesNotMatch(bridge, /localStorage\.setItem\('twelve_api_key'/);
  assert.doesNotMatch(market, /new WebSocket|function pollLivePrice|LIVE_POLL_MS/);
  assert.match(market, /amyfx:twelvedata-price/);
  assert.match(market, /PROXY_URL/);
});

test('persistent candle cache keeps freshness while protecting Twelve Data quota', () => {
  const coordinator = read('app/src/main/assets/apps/mapping/js/api-request-coordinator.js');
  const runtime = read('app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js');

  assert.match(coordinator, /PERSISTENT_CACHE_KEY = 'amyfx_market_response_cache_v3'/);
  assert.match(coordinator, /restorePersistentCache\(\)/);
  assert.match(coordinator, /BACKGROUND_M1_REFRESH_SECONDS = 300/);
  assert.match(coordinator, /RETRY_COOLDOWN_MS = 60_000/);
  assert.match(coordinator, /SUPABASE_VERIFIED_CURRENT/);
  assert.match(runtime, /version: '5\.0\.0'/);
  assert.match(runtime, /markCachedSeriesUsable/);
  assert.match(runtime, /lastAnalyzedSignature/);
});

test('Pattern v3 final engine remains connected to the public Mapping UI', () => {
  const html = read('app/src/main/assets/apps/mapping/index.html');
  const panel = read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const authority = read('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js');
  const patterns = read('supabase/functions/scalper-engine/pattern-gates.mjs');
  const drivers = read('supabase/functions/scalper-engine/drivers.mjs');

  assert.match(html, /scalper-entry-watch-v1\.js/);
  assert.match(html, /scalper-execution-authority\.js/);
  assert.match(html, /scalper-execution-decision-bridge\.js/);
  assert.match(panel, /SCALPER ENGINE · SHADOW MODE/);
  assert.match(panel, /TP1 \+10/);
  assert.match(panel, /TP2 \+20/);
  assert.match(panel, /amyfx\.production\.scalper\.permanent-history\.v1/);
  assert.doesNotMatch(panel, /aktif dalam simulasi Preview/);
  assert.match(authority, /amyfx-preview-scalper-pattern-v3\.0/);
  assert.match(authority, /let applyQueued = false/);
  assert.match(patterns, /BT6-2025-V1/);
  assert.match(patterns, /BT6\.1-2026-H1-V1/);
  assert.match(patterns, /AMD-2025-V1/);
  assert.match(drivers, /id:\s*'AMD'/);
});

test('release workflows pin version, certificate, and signer verification', () => {
  const fingerprint = /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/;
  const rolling = read('.github/workflows/build-apk.yml');
  const manual = read('.github/workflows/build-release.yml');

  for (const workflow of [rolling, manual]) {
    assert.match(workflow, fingerprint);
    assert.match(workflow, /apksigner/);
    assert.match(workflow, /verify --verbose --print-certs/);
    assert.match(workflow, /Signer #1 certificate SHA-256 digest/);
    assert.match(workflow, /TWELVEDATA_API_KEY/);
    assert.match(workflow, /com\.amyelitesuite/);
    assert.match(workflow, /AmyFX-latest\.apk/);
  }

  assert.match(rolling, /AMYFX_VERSION_NAME: "2\.3\.0"/);
  assert.match(rolling, /AMYFX_VERSION_CODE: "58"/);
  assert.match(rolling, /Verify public update manifest/);
  assert.match(manual, /default: "2\.3\.0"/);
  assert.match(manual, /default: "58"/);
});

test('public Firebase Android client remains bound to the production applicationId', () => {
  const firebase = JSON.parse(read('app/google-services.json'));
  const packages = firebase.client.map(client => client.client_info?.android_client_info?.package_name).filter(Boolean);
  assert.ok(packages.includes('com.amyelitesuite'));
  assert.equal('private_key' in firebase, false);
});
