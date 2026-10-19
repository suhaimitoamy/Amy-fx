import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('1. MainActivity.kt contains clearAppCache method targeting updates and background-video', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/amyelitesuite/MainActivity.kt'), 'utf8');
  assert.match(content, /fun clearAppCache\(\): String/, 'Must declare clearAppCache');
  assert.match(content, /File\(mContext\.cacheDir, "updates"\)/, 'Must clean updates cache');
  assert.match(content, /File\(mContext\.cacheDir, "background-video"\)/, 'Must clean background-video cache');
  assert.match(content, /freedBytes/, 'Must calculate freed space');
  assert.match(content, /Berhasil membebaskan.*MB ruang penyimpanan/, 'Must show toast feedback');
});

test('2. app.js contains profileClearCacheBtn in DOM and handles click event', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/app.js'), 'utf8');
  assert.match(content, /id="profileClearCacheBtn"/, 'Profile HTML must render button');
  assert.match(content, /document\.getElementById\('profileClearCacheBtn'\)\?\.addEventListener\('click'/, 'Must attach click listener');
  assert.match(content, /window\.Android\?\.clearAppCache/, 'Must invoke Android clearAppCache bridge');
  assert.match(content, /Berhasil membebaskan.*MB ruang penyimpanan/, 'Must provide user toast confirmation');
});
