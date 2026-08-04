import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const versionUrl = new URL('../app/src/main/assets/app-version.js', import.meta.url);
const checkerUrl = new URL('../app/src/main/assets/update-checker.js', import.meta.url);
const indexUrl = new URL('../app/src/main/assets/index.html', import.meta.url);
const mappingUiUrl = new URL('../app/src/main/assets/apps/mapping/js/ui/ui-render.js', import.meta.url);
const source = url => readFileSync(url, 'utf8');
const syntax = url => {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

test('version and update scripts remain syntactically valid', () => {
  syntax(versionUrl);
  syntax(checkerUrl);
});

test('profile displays Amy FX 2.3.1 and supports manual update checks', () => {
  const version = source(versionUrl);
  const index = source(indexUrl);
  const mappingUi = source(mappingUiUrl);

  assert.match(version, /name: '2\.3\.1'/);
  assert.match(version, /code: 59/);
  assert.match(version, /Amy FX v\$\{VERSION\.name\}/);
  assert.match(version, /main\/update\.json/);
  assert.doesNotMatch(version, /personal\/amyfx-private|preview-update\.json|learningpreview|amyfxpreview/);
  assert.match(version, /Versi Aplikasi/);
  assert.match(version, /AmyFXUpdate\?\.checkNow/);
  assert.match(index, /<script src="app-version\.js"><\/script>\s*<script src="app\.js"><\/script>\s*<script src="update-checker\.js"><\/script>/);
  assert.match(mappingUi, /window\.AmyFXUpdate\?\.checkNow\(\)/);
});

test('update checks bypass caches and compare published version code', () => {
  const checker = source(checkerUrl);
  assert.match(checker, /fetch\(`\$\{UPDATE_URL\}\?_\=\$\{now\}`/);
  assert.match(checker, /cache: 'no-store'/);
  assert.match(checker, /latestCode > CURRENT_VERSION_CODE/);
  assert.match(checker, /showUpdatePopup\(data, latestCode, latestName\)/);
  assert.match(checker, /DOMContentLoaded', scheduleCheck/);
  assert.doesNotMatch(checker, /Amy FX Preview|preview-update\.json|personal\/amyfx-private/);
});

test('native updater owns progress with browser fallback', () => {
  const checker = source(checkerUrl);
  assert.match(checker, /window\.Android\.startAppUpdate/);
  assert.match(checker, /window\.Android\.cancelAppUpdate/);
  assert.match(checker, /window\.AmyFXUpdateNative/);
  assert.match(checker, /onProgress\(percent, downloaded, total\)/);
  assert.match(checker, /File tidak menumpuk di folder Download/);
  assert.match(checker, /window\.location\.href = downloadUrl/);
  assert.match(checker, /hasNativeUpdater\(\)/);
});

test('cancel never persists dismissal', () => {
  const checker = source(checkerUrl);
  assert.doesNotMatch(checker, /localStorage\.setItem\(['"]amy_fx_update_dismissed_version/);
  assert.match(checker, /localStorage\.removeItem\('amy_fx_update_dismissed_version'\)/);
  assert.match(checker, /visibilitychange/);
  assert.match(checker, /checkUpdate\(\{ force: true \}\)/);
  assert.match(checker, /window\.AmyFXUpdate/);
});
