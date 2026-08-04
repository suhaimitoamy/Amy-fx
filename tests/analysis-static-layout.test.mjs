import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stability = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js', import.meta.url),
  'utf8'
);
const panels = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js', import.meta.url),
  'utf8'
);
const appVersion = fs.readFileSync(
  new URL('../app/src/main/assets/app-version.js', import.meta.url),
  'utf8'
);
const updateManifest = JSON.parse(fs.readFileSync(
  new URL('../update.json', import.meta.url),
  'utf8'
));

test('Analyze disclosures are forced open and cannot toggle closed', () => {
  assert.match(stability, /details\.open = true/);
  assert.match(stability, /details\.removeAttribute\('name'\)/);
  assert.match(stability, /event\.preventDefault\(\)/);
  assert.match(stability, /if \(!details\.open\) details\.open = true/);
  assert.match(stability, /pointer-events: none/);
});

test('Analyze DOM is never reordered', () => {
  assert.doesNotMatch(panels, /ANALYZE_ORDER/);
  assert.doesNotMatch(panels, /reorderAnalyzePanels/);
  assert.match(panels, /Analyze is intentionally never reordered/);
  assert.match(panels, /reorderedAnalyze: 0/);
});

test('Observers do not watch every nested mutation or every click', () => {
  assert.match(stability, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.match(panels, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.doesNotMatch(panels, /document\.addEventListener\('click', scheduleCleanup/);
  assert.doesNotMatch(panels, /visibilitychange/);
  assert.doesNotMatch(panels, /amyfx:market-update/);
  assert.doesNotMatch(panels, /amyfx:scalper-state-change/);
});

test('production source identity is never behind the activated update manifest', () => {
  const match = appVersion.match(/name:\s*'(\d+\.\d+\.\d+)'\s*,\s*code:\s*(\d+)/);
  assert.ok(match, 'Production source identity must be readable');

  const [, sourceName, sourceCodeText] = match;
  const sourceCode = Number(sourceCodeText);
  const publishedCode = Number(updateManifest.latest_version_code);
  const publishedName = String(updateManifest.latest_version_name || '');

  assert.equal(sourceName, '2.3.0');
  assert.equal(sourceCode, 58);
  assert.ok(sourceCode >= publishedCode, 'Production source must not be older than update.json');
  assert.ok(sourceCode - publishedCode <= 1, 'Pending source may be at most one version ahead of the active APK');

  if (sourceCode === publishedCode) assert.equal(publishedName, sourceName);
});
