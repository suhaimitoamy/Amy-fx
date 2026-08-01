import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const versionUrl = new URL('../app/src/main/assets/app-version.js', import.meta.url);
const checkerUrl = new URL('../app/src/main/assets/update-checker.js', import.meta.url);
const indexUrl = new URL('../app/src/main/assets/index.html', import.meta.url);
const mappingUiUrl = new URL('../app/src/main/assets/apps/mapping/js/ui/ui-render.js', import.meta.url);
const gradleUrl = new URL('../app/build.gradle.kts', import.meta.url);
const manifestUrl = new URL('../preview-update.json', import.meta.url);

function source(url) {
  return readFileSync(url, 'utf8');
}

function assertSyntax(url) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function readPreviewIdentity() {
  const version = source(versionUrl);
  const gradle = source(gradleUrl);
  const manifest = JSON.parse(source(manifestUrl));
  const identity = version.match(/name:\s*'(2\.0\.0-preview\.(\d+))'\s*,\s*code:\s*(94\d{4})/);

  assert.ok(identity, 'Preview source version name and code must be readable');
  const [, versionName, sequenceText, versionCodeText] = identity;
  const sequence = Number(sequenceText);
  const versionCode = Number(versionCodeText);

  assert.equal(versionCode, 940000 + sequence, 'Preview version code must match its sequence');
  assert.match(gradle, /com\.amyelitesuite\.learningpreview/);
  assert.match(gradle, /Amy FX Preview/);
  assert.match(gradle, /amyfxpreview/);
  assert.match(gradle, /personal\/amyfx-private\/preview-update\.json/);
  assert.ok(gradle.includes(`?: ${versionCode})`), 'Gradle versionCode must match app-version.js');
  assert.ok(gradle.includes(`?: "${versionName}"`), 'Gradle versionName must match app-version.js');

  assert.equal(manifest.channel, 'amyfx-preview-blueprint-v1');
  assert.equal(manifest.latest_version_code, manifest.versionCode);
  assert.equal(manifest.latest_version_name, manifest.version);
  assert.ok(
    Number(manifest.latest_version_code) <= versionCode,
    'The active update manifest must never advertise a version newer than the source candidate'
  );
  if (Number(manifest.latest_version_code) === versionCode) {
    assert.equal(manifest.latest_version_name, versionName);
  }

  return { version, versionName, versionCode };
}

test('version and update scripts remain syntactically valid', () => {
  assertSyntax(versionUrl);
  assertSyntax(checkerUrl);
});

test('Preview source, Gradle, package, channel, and active manifest remain consistent', () => {
  readPreviewIdentity();
});

test('profile displays the Amy FX Preview version and supports manual update checks', () => {
  const { version } = readPreviewIdentity();
  const index = source(indexUrl);
  assert.match(version, /Amy FX Preview v\$\{VERSION\.name\}/);
  assert.match(version, /personal\/amyfx-private\/preview-update\.json/);
  assert.match(version, /Versi Aplikasi/);
  assert.match(version, /data-profile-action=\\?"version/);
  assert.match(version, /AmyFXUpdate\?\.checkNow/);
  assert.match(index, /<script src="app-version\.js"><\/script>\s*<script src="app\.js"><\/script>\s*<script src="update-checker\.js"><\/script>/);
  const mappingUi = source(mappingUiUrl);
  assert.match(mappingUi, /window\.AmyFXUpdate\?\.checkNow\(\)/);
  assert.doesNotMatch(mappingUi, /window\.AmyFXUpdater/);
});

test('update checks bypass caches and compare the published version code', () => {
  const checker = source(checkerUrl);
  assert.match(checker, /fetch\(`\$\{UPDATE_URL\}\?_\=\$\{now\}`/);
  assert.match(checker, /cache: 'no-store'/);
  assert.match(checker, /latestCode > CURRENT_VERSION_CODE/);
  assert.match(checker, /showUpdatePopup\(data, latestCode, latestName\)/);
  assert.match(checker, /DOMContentLoaded', scheduleCheck/);
});

test('native updater owns download progress while browser remains a legacy fallback', () => {
  const checker = source(checkerUrl);
  assert.match(checker, /window\.Android\.startAppUpdate/);
  assert.match(checker, /window\.Android\.cancelAppUpdate/);
  assert.match(checker, /window\.AmyFXUpdateNative/);
  assert.match(checker, /onProgress\(percent, downloaded, total\)/);
  assert.match(checker, /File tidak menumpuk di folder Download/);
  assert.match(checker, /window\.location\.href = downloadUrl/);
  assert.match(checker, /hasNativeUpdater\(\)/);
});

test('cancel never persists dismissal of a newer version', () => {
  const checker = source(checkerUrl);
  assert.doesNotMatch(checker, /localStorage\.setItem\(['"]amy_fx_update_dismissed_version/);
  assert.doesNotMatch(checker, /localStorage\.setItem\(['"]amy_fx_update_last_check/);
  assert.match(checker, /localStorage\.removeItem\('amy_fx_update_dismissed_version'\)/);
  assert.match(checker, /visibilitychange/);
  assert.match(checker, /checkUpdate\(\{ force: true \}\)/);
  assert.match(checker, /window\.AmyFXUpdate/);
});
