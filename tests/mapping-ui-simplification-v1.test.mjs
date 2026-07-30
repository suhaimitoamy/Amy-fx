import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Mapping keeps only Dashboard and Analyze navigation without scroll restoration', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(tabs, ['Dashboard', 'Analyze']);
  assert.doesNotMatch(html, /view-stability\.js/);
  assert.doesNotMatch(html, /analysis-ui-fixes\.js/);
  assert.match(html, /analysis-ui-stability-v4\.js/);
});

test('Mapping no longer persists analysis, setup, or event-log history', async () => {
  const main = await read('app/src/main/assets/apps/mapping/js/main.js');
  assert.match(main, /logs: \[\]/);
  assert.match(main, /analyses: \[\]/);
  assert.match(main, /setups: \[\]/);
  assert.doesNotMatch(main, /localStorage\.setItem\('amy_mapping_analyses'/);
  assert.doesNotMatch(main, /localStorage\.setItem\('amy_mapping_setups'/);
  assert.doesNotMatch(main, /localStorage\.setItem\('amy_mapping_logs'/);
  assert.doesNotMatch(main, /window\.downloadLogs/);
});

test('Profile owns market API information and notification test controls', async () => {
  const home = await read('app/src/main/assets/index.html');
  const profileSettings = await read('app/src/main/assets/profile-system-settings-v1.js');
  assert.match(home, /profile-system-settings-v1\.js/);
  assert.match(profileSettings, /Data Market API/);
  assert.match(profileSettings, /test-notification/);
  assert.match(profileSettings, /showNotificationWithUrl/);
});

test('stability runtime removes historical reliability UI without changing Mapping Engine', async () => {
  const runtime = await read('app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js');
  assert.match(runtime, /removeHistoricalReliability/);
  assert.match(runtime, /Performa Historis Model/);
  assert.doesNotMatch(runtime, /scrollTo|scrollBy/);
  assert.doesNotMatch(runtime, /engine\//);
});
