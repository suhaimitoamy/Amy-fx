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
  new URL('../preview-update.json', import.meta.url),
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

test('Preview source identity is never behind the activated update manifest', () => {
  const match = appVersion.match(/name:\s*'(2\.0\.0-preview\.(\d+))'\s*,\s*code:\s*(94\d{4})/);
  assert.ok(match, 'Preview source identity must be readable');

  const [, sourceName, sourceSequenceText, sourceCodeText] = match;
  const sourceSequence = Number(sourceSequenceText);
  const sourceCode = Number(sourceCodeText);
  const publishedCode = Number(updateManifest.latest_version_code);
  const publishedName = String(updateManifest.latest_version_name || '');
  const publishedMatch = publishedName.match(/^2\.0\.0-preview\.(\d+)$/);

  assert.ok(publishedMatch, 'Activated Preview manifest identity must be readable');
  const publishedSequence = Number(publishedMatch[1]);

  assert.equal(sourceCode, 940000 + sourceSequence);
  assert.equal(publishedCode, 940000 + publishedSequence);
  assert.ok(sourceCode >= publishedCode, 'Preview source must not be older than the update manifest');

  if (sourceCode === publishedCode) {
    assert.equal(sourceName, publishedName);
  } else {
    assert.equal(sourceCode, publishedCode + 1, 'Pending signed release may be exactly one version ahead');
    assert.equal(sourceSequence, publishedSequence + 1);
  }
});
