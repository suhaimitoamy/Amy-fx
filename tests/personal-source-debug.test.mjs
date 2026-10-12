import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('promoted source keeps immutable Amy FX Pro release identity', () => {
  const gradle = read('app/build.gradle.kts');
  const version = read('app/src/main/assets/app-version.js');
  const updater = read('app/src/main/assets/update-checker.js');
  const identity = version.match(/name: '(2\.0\.0-pro\.\d+)', code: (95\d{4})/);
  assert.ok(identity, 'current Pro identity must be readable from app-version.js');
  const [, versionName, versionCode] = identity;

  assert.match(gradle, /com\.amyelitesuite\.learningpreview/);
  assert.match(gradle, /Amy FX Pro/);
  assert.match(gradle, /amyfxpreview/);
  assert.ok(gradle.includes(`?: "${versionName}"`));
  assert.ok(gradle.includes(`?: ${versionCode})`));
  assert.match(version, /Amy-fx-pro\/main\/update\.json/);
  assert.match(updater, /Amy-fx-pro\/main\/update\.json/);
});

test('Mapping only blocks when its active timeframe is unavailable', () => {
  const source = read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  assert.doesNotMatch(source, /staleFetchFailed/);
  assert.match(source, /currentDataUnavailable/);
  assert.match(source, /dataDegraded/);
  assert.match(source, /dataWarnings/);
});

test('Mapping clock and labels use WITA', () => {
  const clock = read('app/src/main/assets/apps/mapping/js/clock-sync.js');
  const ui = read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  assert.match(clock, /Asia\/Makassar/);
  assert.match(clock, /WITA/);
  assert.doesNotMatch(clock, /Asia\/Jakarta/);
  assert.match(ui, /WITA/);
});

test('home storage and clear-data flow are hardened', () => {
  const source = read('app/src/main/assets/app.js');
  assert.match(source, /function readJsonArray/);
  assert.match(source, /deleteIndexedDatabase\('tradingLibraryManager\.files'\)/);
  assert.match(source, /await clearPersonalLocalData\(\)/);
});

test('Market Intel clears stale heatmap visuals and labels backend freshness', () => {
  const source = read('app/src/main/assets/apps/market-intel/app.js');
  assert.match(source, /clearHeatmapState/);
  assert.match(source, /payloadIsFresh/);
  assert.match(source, /SUPABASE_EDGE/);
  assert.match(source, /VERCEL_NEWS/);
});

test('Journal assistant base runtime updates the correct loading message', () => {
  const source = read('app/src/main/assets/apps/journal/app.js');
  assert.doesNotMatch(source, /pendingId/);
  assert.match(source, /updateAssistantChatMessage\(loadingId/);
  assert.match(source, /state\.isAiProcessing = false/);
});

test('Academy explicitly declares personal Preview access mode', () => {
  const source = read('app/src/main/assets/apps/academy/assets/js/auth.js');
  assert.match(source, /PERSONAL_PREVIEW/);
  assert.match(source, /AmyAcademyAccess/);
});
