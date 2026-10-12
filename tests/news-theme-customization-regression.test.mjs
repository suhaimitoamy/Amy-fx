import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('news UI removes Telegram navigation and sanitizes provider branding', () => {
  const source = read('../app/src/main/assets/apps/market-intel/app.js');
  const renderBlock = source.slice(source.indexOf('function renderNews'), source.indexOf('// ─── Heatmap Loader'));
  assert.match(source, /function cleanNewsContent/);
  assert.match(source, /telegram\\\.me\|telegram\\\.dog/);
  assert.match(source, /SM\[\\s_-\]\*News/);
  assert.doesNotMatch(renderBlock, /href=|target=|SM_News_24h|t\.me/);
  assert.doesNotMatch(source, /Data dari SM_News_24h/);
});

test('theme customization is persisted and exposed from Profile settings', () => {
  const controller = read('../app/src/main/assets/apps/shared/amyfx-theme-controller.js');
  const settings = read('../app/src/main/assets/profile-system-settings-v1.js');
  const marketStyles = read('../app/src/main/assets/apps/market-intel/styles.css');
  assert.match(controller, /amyfx\.ui\.colors\.v1/);
  assert.match(controller, /setColors\(values = \{\}\)/);
  assert.match(controller, /resetColors\(\)/);
  assert.match(settings, /Personalisasi warna/);
  assert.match(settings, /data-theme-color/);
  assert.match(settings, /background.*surface.*text.*accent/s);
  assert.match(marketStyles, /--bg: var\(--amy-bg\)/);
  assert.match(marketStyles, /--text: var\(--amy-text\)/);
});
