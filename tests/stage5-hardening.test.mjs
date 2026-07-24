import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Amy FX 1.5.3 uses versionCode 44 without changing the production applicationId', () => {
  const gradle = read('app/build.gradle.kts');
  const version = read('app/src/main/assets/app-version.js');
  assert.match(gradle, /val configuredApplicationId = System\.getenv\("AMYFX_APPLICATION_ID"\) \?: "com\.amyelitesuite"/);
  assert.match(gradle, /applicationId = configuredApplicationId/);
  assert.match(gradle, /versionCode[^\n]*44/);
  assert.match(gradle, /versionName[^\n]*"1\.5\.3"/);
  assert.match(version, /name: '1\.5\.3', code: 44/);
});

test('published metadata is never ahead of the APK source version', () => {
  const metadata = JSON.parse(read('update.json'));
  assert.ok([40, 41, 42, 43, 44].includes(metadata.latest_version_code));
  const expected = metadata.latest_version_code === 44
    ? '1.5.3'
    : metadata.latest_version_code === 43
      ? '1.5.2'
      : metadata.latest_version_code === 42
        ? '1.5.1'
        : metadata.latest_version_code === 41
          ? '1.5.0'
          : '1.4.17';
  assert.equal(metadata.latest_version_name, expected);
  assert.ok(metadata.latest_version_code <= 44);
  assert.ok(Array.isArray(metadata.release_notes));
  assert.ok(metadata.release_notes.length > 0);
});

test('client no longer persists TwelveData credentials', () => {
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const bridge = read('app/src/main/assets/apps/mapping/js/bridge/android-bridge.js');
  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  assert.doesNotMatch(main, /localStorage\.getItem\('twelve_api_key'\)/);
  assert.doesNotMatch(bridge, /localStorage\.setItem\('twelve_api_key'/);
  assert.doesNotMatch(native, /putString\("api_key"/);
  assert.doesNotMatch(native, /SecurePrefs\.putString\(mContext, "api_key"/);
  assert.match(native, /SecurePrefs\.remove\(mContext, "api_key"\)/);
});

test('market proxy accepts only validated server-side requests', () => {
  const api = read('api/twelvedata.js');
  assert.match(api, /process\.env\.TWELVEDATA_API_KEY/);
  assert.doesNotMatch(api, /req\.query[^\n]*apikey/);
  assert.match(api, /req\.method !== 'GET'/);
  assert.match(api, /ALLOWED_INTERVALS\.has\(interval\)/);
  assert.match(api, /new AbortController\(\)/);
  assert.match(api, /Market service timeout/);
});

test('native notifications only open trusted local routes', () => {
  const native = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  assert.match(native, /normalizeLocalUrl\(url\)/);
  assert.match(native, /setSmallIcon\(R\.drawable\.ic_stat_amy_fx\)/);
});

test('release workflows pin the certificate and inspect v1 plus v2 structures', () => {
  const gradle = read('app/build.gradle.kts');
  assert.match(gradle, /enableV1Signing = true/);
  assert.match(gradle, /enableV2Signing = true/);

  for (const path of ['.github/workflows/build-apk.yml', '.github/workflows/build-release.yml', '.github/workflows/stage5-apply.yml']) {
    const workflow = read(path);
    assert.match(workflow, /META-INF\/\[\^\/\]\+\\\.SF/);
    assert.match(workflow, /META-INF\/\[\^\/\]\+\\\.\(RSA\|DSA\|EC\)/);
    assert.match(workflow, /0x7109871A/);
    assert.match(workflow, /keytool -printcert/);
    assert.match(workflow, /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/);
  }

  const rolling = read('.github/workflows/build-apk.yml');
  assert.match(rolling, /AMYFX_VERSION_NAME: "1\.5\.3"/);
  assert.match(rolling, /AMYFX_VERSION_CODE: "44"/);
  assert.match(rolling, /Verify public update manifest source/);

  const manual = read('.github/workflows/build-release.yml');
  assert.match(manual, /default: "1\.5\.3"/);
  assert.match(manual, /default: "44"/);

  const candidate = read('.github/workflows/stage5-apply.yml');
  assert.match(candidate, /AMYFX_VERSION_NAME: "1\.5\.3"/);
  assert.match(candidate, /AMYFX_VERSION_CODE: "44"/);
});

test('Firebase Android client remains bound to the release applicationId', () => {
  const firebase = JSON.parse(read('app/google-services.json'));
  assert.equal(firebase.client[0].client_info.android_client_info.package_name, 'com.amyelitesuite');
  assert.equal('private_key' in firebase, false);
});
