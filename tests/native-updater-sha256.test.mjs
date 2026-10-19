import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('NativeAppUpdater validates SHA-256 checksum when expectedSha256 is provided (Item 1.14)', () => {
  const updater = read('app/src/main/java/com/amyelitesuite/NativeAppUpdater.kt');
  const main = read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  const checker = read('app/src/main/assets/update-checker.js');

  // NativeAppUpdater start method accepts expectedSha256
  assert.match(updater, /expectedSha256:\s*String\?\s*=\s*null/);

  // verifyApk validates SHA-256 checksum
  assert.match(updater, /fun verifyApk\([\s\S]*?expectedSha256:\s*String\?\s*=\s*null/);
  assert.match(updater, /if\s*\(!expectedSha256\.isNullOrBlank\(\)\)\s*\{/);
  assert.match(updater, /val actualSha = calculateFileSha256\(file\)/);
  assert.match(updater, /Checksum SHA-256 APK tidak cocok/);

  // calculateFileSha256 streams file through MessageDigest
  assert.match(updater, /fun calculateFileSha256\(file:\s*File\):\s*String\s*\{/);
  assert.match(updater, /MessageDigest\.getInstance\("SHA-256"\)/);

  // MainActivity exposes 4-argument startAppUpdate with sha256
  assert.match(main, /fun startAppUpdate\(downloadUrl: String\?, versionName: String\?, versionCode: Int, sha256: String\?\)/);

  // update-checker forwards data.sha256
  assert.match(checker, /expectedSha = String\(data\.sha256 \|\| data\.apk_sha256 \|\| ''\)\.trim\(\)/);
  assert.match(checker, /window\.Android\.startAppUpdate\(String\(downloadUrl\),\s*String\(latestName\),\s*Number\(latestCode\),\s*expectedSha\)/);
});
