// Legacy Mapping contract retained for the archived Pro336 page.
// Production ICT workspace is covered by ict-workspace.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const source = relative => readFileSync(path(relative), 'utf8');

test('Amy FX Pro main promotes Preview lineage into a dedicated Pro release channel', () => {
  const gradle = source('app/build.gradle.kts');
  const version = source('app/src/main/assets/app-version.js');
  const workflow = source('.github/workflows/build-apk.yml');
  const identity = version.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'Pro source identity must be readable');
  const [, versionName, sequence, versionCode] = identity;

  assert.match(gradle, /com\.amyelitesuite\.learningpreview/);
  assert.match(gradle, /Amy FX Pro/);
  assert.match(gradle, /amyfxpreview/);
  assert.match(gradle, /Amy-fx-pro\/main\/update\.json/);
  assert.equal(Number(versionCode), 950000 + Number(sequence));
  assert.ok(gradle.includes(`?: ${versionCode})`));
  assert.ok(gradle.includes(`?: "${versionName}"`));
  assert.match(version, /Amy-fx-pro\/main\/update\.json/);

  assert.match(workflow, /AMYFX_APPLICATION_ID: com\.amyelitesuite\.learningpreview/);
  assert.match(workflow, /AMYFX_APP_LABEL: Amy FX Pro/);
  assert.match(workflow, /AMYFX_URI_SCHEME: amyfxpreview/);
  assert.match(workflow, /Resolve source version/);
  assert.match(workflow, /AMYFX_VERSION_NAME=\$version_name/);
  assert.match(workflow, /AMYFX_VERSION_CODE=\$version_code/);
  assert.match(workflow, /AMYFX_RELEASE_TAG=amyfx-pro-\$version_name/);
  assert.match(workflow, /AmyFX-Pro-latest\.apk/);
  assert.match(workflow, /Publish Amy FX Pro release/);
  assert.match(workflow, /Verify published APK endpoint/);
});

test('Mapping presents a clean product interface without duplicate Preview badges', () => {
  const html = source('app/src/main/assets/apps/mapping/legacy-index.html');
  const main = source('app/src/main/assets/apps/mapping/js/main.js');
  const branding = source('app/src/main/assets/apps/mapping/js/production-branding.js');

  execFileSync(process.execPath, ['--check', fileURLToPath(path('app/src/main/assets/apps/mapping/js/production-branding.js'))], { stdio: 'pipe' });
  assert.match(html, /<title>Amy FX · Market Intelligence<\/title>/);
  assert.doesNotMatch(html, /Amy FX Preview/);
  assert.match(html, /js\/production-branding\.js/);
  assert.ok(html.indexOf('js/production-branding.js') < html.indexOf('js/main.js'));
  assert.doesNotMatch(main, /UPDATE · AMY FX v1\.5 PREVIEW/);
  assert.doesNotMatch(main, /mountPreviewUpdateBadge/);
  assert.match(branding, /amyfx-preview-update/);
  assert.match(branding, /AMY FX V1\.5 PREVIEW AKTIF/);
  assert.match(branding, /card\?\.remove\(\)/);
});
