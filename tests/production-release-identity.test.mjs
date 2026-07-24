import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const source = relative => readFileSync(path(relative), 'utf8');

test('Amy FX 1.5.2 keeps the production Android identity and updater channel', () => {
  const gradle = source('app/build.gradle.kts');
  const version = source('app/src/main/assets/app-version.js');
  const workflow = source('.github/workflows/build-apk.yml');

  assert.match(gradle, /com\.amyelitesuite/);
  assert.match(gradle, /main\/update\.json/);
  assert.match(gradle, /\?: 43\)/);
  assert.match(gradle, /\?: "1\.5\.2"/);
  assert.match(version, /name: '1\.5\.2', code: 43/);
  assert.match(workflow, /AMYFX_APPLICATION_ID: com\.amyelitesuite/);
  assert.match(workflow, /AMYFX_APP_LABEL: Amy FX/);
  assert.match(workflow, /AMYFX_URI_SCHEME: amyfx/);
  assert.match(workflow, /AMYFX_VERSION_NAME: "1\.5\.2"/);
  assert.match(workflow, /AMYFX_VERSION_CODE: "43"/);
  assert.match(workflow, /releases\/download\/amyfx-latest\/AmyFX-latest\.apk/);
});

test('Mapping presents Amy FX without visible Preview branding', () => {
  const html = source('app/src/main/assets/apps/mapping/index.html');
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
