import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configurePreviewWebVersion } from '../tools/configure-preview-web-version.mjs';

const APP_VERSION_SOURCE = `(function () {\n  const VERSION = Object.freeze({ name: '1.4.15', code: 38 });\n  window.AmyFXAppVersion = VERSION;\n})();\n`;
const UPDATE_SOURCE = `(function () {\n  const VERSION = window.AmyFXAppVersion || { name: '1.4.11', code: 34 };\n  const CURRENT_VERSION_CODE = Number(VERSION.code) || 34;\n  const CURRENT_VERSION_NAME = String(VERSION.name || '1.4.11');\n  const UPDATE_URL = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';\n  function notify(message) { console.log(message); }\n  function showUpdatePopup(data, latestCode, latestName) {}\n  async function checkUpdate() {\n    const latestCode = 90042; const latestName = '1.4.15-preview.5'; const data = {};\n    if (latestCode > CURRENT_VERSION_CODE) {\n      showUpdatePopup(data, latestCode, latestName);\n      return { status: 'update_available', latestCode, latestName };\n    }\n  }\n})();\n`;

test('preview build configuration patches version, branch manifest and native update notification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'amyfx-preview-config-'));
  const assets = join(root, 'app/src/main/assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, 'app-version.js'), APP_VERSION_SOURCE);
  await writeFile(join(assets, 'update-checker.js'), UPDATE_SOURCE);

  const manifestUrl = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/experiment/mapping-regime-engine-20260721/preview-update.json';
  await configurePreviewWebVersion({ root, versionName: '1.4.15-preview.4', versionCode: 90041, manifestUrl });

  const version = await readFile(join(assets, 'app-version.js'), 'utf8');
  const updater = await readFile(join(assets, 'update-checker.js'), 'utf8');
  assert.match(version, /name: '1\.4\.15-preview\.4', code: 90041/);
  assert.match(version, /AmyFXUpdateManifestUrl = 'https:\/\/raw\.githubusercontent\.com\/suhaimitoamy\/Amy-fx\/experiment\/mapping-regime-engine-20260721\/preview-update\.json'/);
  assert.match(updater, /CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| 90041/);
  assert.match(updater, /window\.AmyFXUpdateManifestUrl/);
  assert.match(updater, /function announceNativeUpdate/);
  assert.match(updater, /Android\.showNotification\('Update Amy FX Preview Tersedia'/);
  assert.match(updater, /announceNativeUpdate\(latestCode, latestName\);/);
});

test('preview configuration rejects non-HTTPS manifests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'amyfx-preview-config-'));
  const assets = join(root, 'app/src/main/assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, 'app-version.js'), APP_VERSION_SOURCE);
  await writeFile(join(assets, 'update-checker.js'), UPDATE_SOURCE);
  await assert.rejects(
    configurePreviewWebVersion({ root, versionName: 'preview', versionCode: 1, manifestUrl: 'http://example.com/update.json' }),
    /HTTPS/
  );
});
