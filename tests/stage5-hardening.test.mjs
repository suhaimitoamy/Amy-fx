import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Amy FX 1.4.12 uses versionCode 35 without changing applicationId', () => {
  const gradle = read('app/build.gradle.kts');
  const version = read('app/src/main/assets/app-version.js');
  assert.match(gradle, /applicationId = "com\.amyelitesuite"/);
  assert.match(gradle, /versionCode[^\n]*35/);
  assert.match(gradle, /versionName[^\n]*"1\.4\.12"/);
  assert.match(version, /name: '1\.4\.12', code: 35/);
});

test('published metadata is never ahead of the APK source version', () => {
  const metadata = JSON.parse(read('update.json'));
  assert.ok([34, 35].includes(metadata.latest_version_code));
  assert.equal(
    metadata.latest_version_name,
    metadata.latest_version_code === 35 ? '1.4.12' : '1.4.11'
  );
  assert.ok(metadata.latest_version_code <= 35);
  assert.ok(metadata.release_notes.some(note => note.includes('update') || note.includes('unduh')));
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

test('release workflows pin the existing signing certificate', () => {
  const rolling = read('.github/workflows/build-apk.yml');
  assert.match(rolling, /AMYFX_VERSION_NAME: "1\.4\.12"/);
  assert.match(rolling, /AMYFX_VERSION_CODE: "35"/);
  assert.match(rolling, /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/);

  const manual = read('.github/workflows/build-release.yml');
  assert.match(manual, /default: "1\.4\.12"/);
  assert.match(manual, /default: "35"/);
  assert.match(manual, /47:C2:32:BC:44:FA:63:C9:2F:FE:41:1F:71:40:40:4C:09:AA:2A:9C:BF:82:B1:85:9A:86:0B:85:56:7B:AD:C7/);
});

test('Firebase Android client remains bound to the release applicationId', () => {
  const firebase = JSON.parse(read('app/google-services.json'));
  assert.equal(firebase.client[0].client_info.android_client_info.package_name, 'com.amyelitesuite');
  assert.equal('private_key' in firebase, false);
});
